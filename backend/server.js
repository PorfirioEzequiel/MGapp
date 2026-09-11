require('dotenv').config();
const express   = require('express');
const cors      = require('cors');
const qrcode    = require('qrcode');
const mongoose  = require('mongoose');
const { Client, LocalAuth } = require('whatsapp-web.js');

const app  = express();
const PORT = process.env.PORT || 3001;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));

// ── MongoDB — caida-credenciales ──────────────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI_CAIDA_CREDENCIALES)
  .then(() => console.log('[MONGO] Conectado a caida-credenciales ✅'))
  .catch(err => console.error('[MONGO] Error de conexión:', err.message));

// ── Estado global ─────────────────────────────────────────────────────────────
let qrBase64     = null;
let clientReady  = false;
let activeCampaign = null;   // null | Campaign
let lastResult   = null;     // último resultado para diagnóstico
const sseClients = new Set();

// ── WhatsApp client ───────────────────────────────────────────────────────────
const client = new Client({
  authStrategy: new LocalAuth({ clientId: 'mgapp', dataPath: './wsp-session' }),
  puppeteer: {
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  },
});

client.on('qr', async (qr) => {
  qrBase64     = await qrcode.toDataURL(qr);
  clientReady  = false;
  broadcast({ type: 'qr', qr: qrBase64 });
  console.log('[WSP] QR generado — escanea con tu WhatsApp');
});

client.on('ready', () => {
  clientReady = true;
  qrBase64    = null;
  broadcast({ type: 'ready' });
  console.log('[WSP] Conectado ✅');
});

client.on('auth_failure', () => {
  clientReady = false;
  broadcast({ type: 'auth_failure' });
  console.log('[WSP] Auth fallida — requiere nuevo QR');
});

client.on('disconnected', (reason) => {
  clientReady = false;
  broadcast({ type: 'disconnected', reason });
  console.log('[WSP] Desconectado:', reason);
});

client.initialize().catch(err => {
  console.error('[WSP] Error inicializando:', err.message);
});

// ── SSE broadcast ─────────────────────────────────────────────────────────────
const broadcast = (data) => {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) {
    try { res.write(payload); } catch (_) { sseClients.delete(res); }
  }
};

// ── Campaign runner ───────────────────────────────────────────────────────────
const sleep = (ms) => new Promise(r => setTimeout(r, ms));

const toWspId = (phone) => {
  const n = phone.replace(/\D/g, '');
  const full = n.startsWith('52') ? n : `52${n}`;
  return `${full}@c.us`;
};

const buildMessage = (template, recipient) =>
  template
    .replace(/{nombre}/gi, recipient.name || '')
    .replace(/{sector}/gi,  String(recipient.sector || ''));

async function runCampaign() {
  const camp = activeCampaign;
  broadcast({ type: 'campaign_start', total: camp.recipients.length });

  for (let i = 0; i < camp.recipients.length; i++) {
    if (!activeCampaign || activeCampaign.cancelled) break;

    const r = camp.recipients[i];
    activeCampaign.currentIndex = i;

    broadcast({ type: 'sending', index: i, total: camp.recipients.length, name: r.name });

    try {
      const clean  = r.phone.replace(/\D/g, '').replace(/^52/, '');
      const numId  = await client.getNumberId(clean);
      if (!numId) throw new Error(`Número no encontrado en WhatsApp: ${clean}`);
      const chatId = numId._serialized;
      const text   = buildMessage(camp.message, r);
      console.log(`[CAMP] Enviando a chatId: ${chatId}`);
      const msg = await client.sendMessage(chatId, text);
      console.log(`[CAMP] ✅ ${r.name} — msgId: ${msg?.id?._serialized || 'ok'}`);

      activeCampaign.results[r.id] = 'sent';
      lastResult = { id: r.id, name: r.name, phone: r.phone, chatId, status: 'sent', ts: new Date().toISOString() };
      broadcast({ type: 'sent', index: i, id: r.id, name: r.name });
    } catch (err) {
      console.log(`[CAMP] ❌ ${r.name} (${r.phone}) — ${err.message}`);
      activeCampaign.results[r.id] = 'error';
      lastResult = { id: r.id, name: r.name, phone: r.phone, status: 'error', error: err.message, ts: new Date().toISOString() };
      broadcast({ type: 'error', index: i, id: r.id, name: r.name, error: err.message });
    }

    // Esperar intervalo antes del siguiente (no esperar después del último)
    const isLast = i === camp.recipients.length - 1;
    if (!isLast && !activeCampaign.cancelled && camp.delay > 0) {
      const next = camp.recipients[i + 1];
      broadcast({ type: 'waiting', seconds: camp.delay, nextName: next?.name });

      // Cuenta regresiva segundo a segundo
      for (let s = camp.delay; s > 0; s--) {
        if (!activeCampaign || activeCampaign.cancelled) break;
        broadcast({ type: 'tick', seconds: s, nextName: next?.name });
        await sleep(1000);
      }
    }
  }

  if (activeCampaign && !activeCampaign.cancelled) {
    const results = activeCampaign.results;
    const sent    = Object.values(results).filter(v => v === 'sent').length;
    const errors  = Object.values(results).filter(v => v === 'error').length;
    broadcast({ type: 'campaign_done', sent, errors, results });
    console.log(`[CAMP] Completa — ${sent} enviados, ${errors} errores`);
  }

  activeCampaign = null;
}

// ── Rutas ─────────────────────────────────────────────────────────────────────

// Último resultado de diagnóstico
app.get('/last-result', (req, res) => res.json(lastResult || { msg: 'Sin resultados aún' }));

// Estado general
app.get('/status', (req, res) => {
  res.json({
    ready: clientReady,
    qr:    qrBase64,
    campaign: activeCampaign ? {
      total:        activeCampaign.recipients.length,
      currentIndex: activeCampaign.currentIndex,
      running:      !activeCampaign.cancelled,
      results:      activeCampaign.results,
    } : null,
  });
});

// SSE — stream de eventos en tiempo real
app.get('/events', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.flushHeaders();

  sseClients.add(res);

  // Estado actual al conectarse
  res.write(`data: ${JSON.stringify({
    type:  'status',
    ready: clientReady,
    qr:    qrBase64,
    campaign: activeCampaign ? {
      total:        activeCampaign.recipients.length,
      currentIndex: activeCampaign.currentIndex,
      running:      !activeCampaign.cancelled,
    } : null,
  })}\n\n`);

  req.on('close', () => sseClients.delete(res));
});

// Iniciar campaña
app.post('/campaign/start', (req, res) => {
  if (!clientReady)    return res.status(503).json({ error: 'WhatsApp no conectado — escanea el QR' });
  if (activeCampaign)  return res.status(409).json({ error: 'Ya hay una campaña activa' });

  const { recipients, message, delay = 30 } = req.body;

  if (!Array.isArray(recipients) || recipients.length === 0)
    return res.status(400).json({ error: 'Sin destinatarios' });
  if (!message?.trim())
    return res.status(400).json({ error: 'Mensaje vacío' });

  activeCampaign = {
    recipients,
    message,
    delay: Math.max(0, Number(delay)),
    currentIndex: 0,
    results: {},
    cancelled: false,
  };

  runCampaign(); // fire-and-forget

  res.json({ ok: true, total: recipients.length, delay });
  console.log(`[CAMP] Iniciada — ${recipients.length} destinatarios, ${delay}s intervalo`);
});

// Cancelar campaña activa
app.delete('/campaign', (req, res) => {
  if (activeCampaign) {
    activeCampaign.cancelled = true;
    const done = Object.values(activeCampaign.results).filter(v => v === 'sent').length;
    broadcast({ type: 'cancelled', sent: done });
    console.log(`[CAMP] Cancelada tras ${done} envíos`);
  }
  activeCampaign = null;
  res.json({ ok: true });
});

// Conteo de comprobadas por sección desde MongoDB
app.get('/api/comprobadas', async (req, res) => {
  try {
    const col    = mongoose.connection.db.collection('registros-credenciales');
    const result = await col.aggregate([
      { $group: { _id: '$seccion', comprobadas: { $sum: 1 } } },
    ]).toArray();
    res.json(result.map(r => ({ seccion: r._id, comprobadas: r.comprobadas })));
  } catch (err) {
    console.error('[MONGO] /api/comprobadas:', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n MGapp WSP Backend → http://localhost:${PORT}`);
  console.log(' Iniciando WhatsApp...\n');
});
