import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../supabase/client';

const BACKEND_URL  = 'http://localhost:3001';
const STEPS        = ['Destinatarios', 'Mensaje', 'Envío'];
const TOKENS       = [
  { label: '{nombre}', value: '{nombre}', tip: 'Nombre del SM' },
  { label: '{sector}', value: '{sector}', tip: 'Número de sector' },
];
const MAX_CHARS    = 4096;
const WSP_GREEN    = '#25D366';
const DELAY_OPTIONS = [
  { value: 15,  label: '15 seg', desc: 'Rápido'      },
  { value: 30,  label: '30 seg', desc: 'Recomendado' },
  { value: 60,  label: '1 min',  desc: 'Seguro'      },
  { value: 120, label: '2 min',  desc: 'Muy seguro'  },
];

// ── Helpers ───────────────────────────────────────────────────────────────────
const initials = (sm) =>
  [(sm.nombre || '')[0], (sm.a_paterno || '')[0]].filter(Boolean).join('').toUpperCase();

const fullName = (sm) =>
  [sm.nombre, sm.a_paterno].filter(Boolean).join(' ');

// ── Countdown ring ────────────────────────────────────────────────────────────
const CountdownRing = ({ seconds, total }) => {
  const r    = 16;
  const circ = 2 * Math.PI * r;
  const pct  = total > 0 ? seconds / total : 0;
  return (
    <svg width="40" height="40" className="-rotate-90 flex-shrink-0">
      <circle cx="20" cy="20" r={r} fill="none" stroke="#e2e8f0" strokeWidth="3" />
      <circle cx="20" cy="20" r={r} fill="none" stroke={WSP_GREEN} strokeWidth="3"
        strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 1s linear' }}
      />
    </svg>
  );
};

// ── Componente principal ──────────────────────────────────────────────────────
const Mensajeria = () => {
  const navigate     = useNavigate();
  const textareaRef  = useRef(null);
  const esRef        = useRef(null);

  // Wizard
  const [step, setStep]   = useState(0);

  // Datos
  const [sms, setSms]         = useState([]);
  const [loading, setLoading] = useState(true);
  const [sectors, setSectors] = useState([]);

  // Selección de audiencia
  const [selectedSectors, setSelectedSectors] = useState(new Set());
  const [allSelected, setAllSelected]         = useState(false);

  // Mensaje
  const [message, setMessage]         = useState('');
  const [askConfirm, setAskConfirm]   = useState(false);
  const [delay, setDelay]             = useState(30);
  const [dragging, setDragging]       = useState(false);
  const [image, setImage]             = useState(null);

  // Backend / WhatsApp
  const [backendStatus, setBackendStatus] = useState('checking'); // checking | offline | qr | ready
  const [qrImage, setQrImage]             = useState(null);

  // Campaña en progreso
  const [campaign, setCampaign] = useState(null);
  // { running, total, currentIndex, currentName, tick, results: {id: 'sent'|'error'} }

  // ── Fetch SMs ───────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('ciudadania')
        .select('id, nombre, a_paterno, a_materno, telefono_1, poligono, seccion')
        .eq('puesto', 'SM')
        .eq('status', 'ACTIVO')
        .order('poligono');

      if (data) {
        setSms(data);
        const map = {};
        data.forEach(sm => {
          const s = String(sm.poligono ?? '?');
          if (!map[s]) map[s] = { id: s, total: 0, withPhone: 0 };
          map[s].total++;
          if (sm.telefono_1) map[s].withPhone++;
        });
        setSectors(Object.values(map).sort((a, b) => Number(a.id) - Number(b.id)));
      }
      setLoading(false);
    })();
  }, []);

  // ── Conexión SSE al backend ─────────────────────────────────────────────────
  useEffect(() => {
    let es;
    const connect = () => {
      es = new EventSource(`${BACKEND_URL}/events`);
      esRef.current = es;

      es.onmessage = (e) => {
        const data = JSON.parse(e.data);
        handleBackendEvent(data);
      };

      es.onerror = () => {
        setBackendStatus('offline');
        es.close();
        // Reintentar cada 5s
        setTimeout(connect, 5000);
      };
    };

    connect();
    return () => { es?.close(); };
  }, []); // eslint-disable-line

  const handleBackendEvent = useCallback((data) => {
    switch (data.type) {
      case 'status':
        if (data.ready) {
          setBackendStatus('ready'); setQrImage(null);
        } else if (data.qr) {
          setBackendStatus('qr'); setQrImage(data.qr);
        } else {
          setBackendStatus('offline');
        }
        break;
      case 'qr':
        setBackendStatus('qr'); setQrImage(data.qr);
        break;
      case 'ready':
        setBackendStatus('ready'); setQrImage(null);
        break;
      case 'disconnected':
      case 'auth_failure':
        setBackendStatus('offline');
        break;
      case 'campaign_start':
        setCampaign({ running: true, total: data.total, currentIndex: 0, currentName: '', tick: 0, nextName: '', results: {} });
        break;
      case 'sending':
        setCampaign(p => ({ ...p, running: true, currentIndex: data.index, currentName: data.name, tick: 0 }));
        break;
      case 'sent':
        setCampaign(p => ({ ...p, results: { ...p.results, [data.id]: 'sent' } }));
        break;
      case 'error':
        setCampaign(p => ({ ...p, results: { ...p.results, [data.id]: 'error' } }));
        break;
      case 'tick':
        setCampaign(p => ({ ...p, tick: data.seconds, nextName: data.nextName || '' }));
        break;
      case 'campaign_done':
        setCampaign(p => ({ ...p, running: false, tick: 0, results: data.results }));
        break;
      case 'cancelled':
        setCampaign(p => p ? { ...p, running: false, tick: 0 } : null);
        break;
      default: break;
    }
  }, []);

  // ── Audiencia ───────────────────────────────────────────────────────────────
  const selectedSMs = allSelected
    ? sms
    : sms.filter(sm => selectedSectors.has(String(sm.poligono ?? '?')));

  const withPhone = selectedSMs.filter(sm => sm.telefono_1);
  const noPhone   = selectedSMs.filter(sm => !sm.telefono_1);

  const toggleAll = () => { setAllSelected(v => !v); setSelectedSectors(new Set()); };

  const toggleSector = (id) => {
    if (allSelected) {
      setAllSelected(false);
      const all = new Set(sectors.map(s => s.id));
      all.delete(id);
      setSelectedSectors(all);
      return;
    }
    setSelectedSectors(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      if (next.size === sectors.length) { setAllSelected(true); return new Set(); }
      return next;
    });
  };

  // ── Mensaje ─────────────────────────────────────────────────────────────────
  const insertToken = useCallback((token) => {
    const el = textareaRef.current;
    if (!el) { setMessage(m => m + token); return; }
    const s = el.selectionStart, e = el.selectionEnd;
    const next = message.slice(0, s) + token + message.slice(e);
    setMessage(next);
    setTimeout(() => { el.focus(); el.setSelectionRange(s + token.length, s + token.length); }, 0);
  }, [message]);

  const fullMessage = askConfirm
    ? `${message}\n\nResponde con 👍 para confirmar que recibiste este mensaje.`
    : message;

  const handleImageFile = (file) => {
    if (!file || !file.type.startsWith('image/')) return;
    if (image?.url) URL.revokeObjectURL(image.url);
    setImage({ file, url: URL.createObjectURL(file) });
  };

  const removeImage = () => { if (image?.url) URL.revokeObjectURL(image.url); setImage(null); };

  // ── Campaña ─────────────────────────────────────────────────────────────────
  const startCampaign = async () => {
    const recipients = withPhone.map(sm => ({
      id:     sm.id,
      name:   fullName(sm),
      phone:  sm.telefono_1,
      sector: sm.poligono,
    }));

    const res = await fetch(`${BACKEND_URL}/campaign/start`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ recipients, message: fullMessage, delay }),
    });

    if (!res.ok) {
      const err = await res.json();
      alert(`Error: ${err.error}`);
    }
  };

  const cancelCampaign = async () => {
    await fetch(`${BACKEND_URL}/campaign`, { method: 'DELETE' });
  };

  // ── Progreso ─────────────────────────────────────────────────────────────────
  const sentCount  = campaign ? Object.values(campaign.results).filter(v => v === 'sent').length  : 0;
  const errorCount = campaign ? Object.values(campaign.results).filter(v => v === 'error').length : 0;
  const isDone     = campaign && !campaign.running && campaign.total > 0;

  const canProceed = [
    withPhone.length > 0,
    message.trim().length >= 5,
    true,
  ];

  if (loading) return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
      <div className="w-8 h-8 border-2 border-sky-500 border-t-transparent rounded-full animate-spin" />
      <p className="text-slate-400 text-sm">Cargando colaboradores…</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-slate-100 sticky top-0 z-20">
        <div className="max-w-2xl mx-auto px-4 h-14 flex items-center gap-3">
          <button
            onClick={() => step > 0 ? setStep(s => s - 1) : navigate(-1)}
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-slate-100 transition-colors text-slate-500 cursor-pointer"
          >
            <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.2" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 18l-6-6 6-6"/>
            </svg>
          </button>

          <div>
            <h1 className="font-semibold text-slate-900 text-sm leading-none">Mensajería</h1>
            <p className="text-[11px] text-slate-400 mt-0.5">{STEPS[step]}</p>
          </div>

          {/* Estado del backend */}
          <div className={`ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold ${
            backendStatus === 'ready'    ? 'bg-emerald-50 text-emerald-600'
            : backendStatus === 'qr'    ? 'bg-amber-50 text-amber-600'
            : backendStatus === 'offline' ? 'bg-red-50 text-red-500'
                                          : 'bg-slate-100 text-slate-400'
          }`}>
            <span className={`w-1.5 h-1.5 rounded-full ${
              backendStatus === 'ready'   ? 'bg-emerald-500'
              : backendStatus === 'qr'   ? 'bg-amber-500 animate-pulse'
              : backendStatus === 'offline' ? 'bg-red-400'
                                           : 'bg-slate-300 animate-pulse'
            }`} />
            {backendStatus === 'ready'   ? 'WhatsApp conectado'
             : backendStatus === 'qr'   ? 'Escanea QR'
             : backendStatus === 'offline' ? 'Backend offline'
                                           : 'Conectando…'}
          </div>
        </div>

        {/* Barra de progreso del step */}
        <div className="max-w-2xl mx-auto flex">
          {STEPS.map((_, i) => (
            <div key={i} className="flex-1">
              <div className={`h-0.5 transition-all duration-500 ${i <= step ? 'bg-sky-500' : 'bg-slate-100'}`} />
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 pb-32">

        {/* ══ PASO 0 — Destinatarios ═══════════════════════════════════════ */}
        {step === 0 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">¿A quién envías?</h2>
              <p className="text-sm text-slate-400 mt-0.5">Selecciona sectores o envía a todos los SM activos.</p>
            </div>

            {/* Todos */}
            <button onClick={toggleAll}
              className={`w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border-2 transition-all cursor-pointer ${
                allSelected ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white hover:border-sky-300'
              }`}
            >
              <div className="flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${allSelected ? 'bg-sky-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                  <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/>
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-semibold text-slate-900 text-sm">Todos los sectores</p>
                  <p className="text-xs text-slate-400">{sms.length} SM · {sms.filter(s => s.telefono_1).length} con teléfono</p>
                </div>
              </div>
              <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${allSelected ? 'border-sky-500 bg-sky-500' : 'border-slate-300'}`}>
                {allSelected && <svg width="11" height="11" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
              </div>
            </button>

            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400 font-medium">o por sector</span>
              <div className="flex-1 h-px bg-slate-200" />
            </div>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
              {sectors.map(sec => {
                const active = allSelected || selectedSectors.has(sec.id);
                return (
                  <button key={sec.id} onClick={() => toggleSector(sec.id)}
                    className={`rounded-xl px-3 py-3 border-2 text-left transition-all cursor-pointer ${
                      active ? 'border-sky-500 bg-sky-50' : 'border-slate-200 bg-white hover:border-sky-200'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <span className={`text-xs font-bold uppercase tracking-wide ${active ? 'text-sky-600' : 'text-slate-500'}`}>Sector {sec.id}</span>
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${active ? 'border-sky-500 bg-sky-500' : 'border-slate-300'}`}>
                        {active && <svg width="9" height="9" fill="none" stroke="white" strokeWidth="3" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                      </div>
                    </div>
                    <p className="text-base font-bold text-slate-900 mt-1">{sec.total} SM</p>
                    <p className="text-[11px] text-slate-400">{sec.withPhone === sec.total ? 'todos con número' : `${sec.withPhone} con número`}</p>
                  </button>
                );
              })}
            </div>

            {withPhone.length > 0 && (
              <div className="rounded-2xl bg-white border border-slate-100 p-4 flex items-center gap-4">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-slate-900">{withPhone.length} SM listos para envío</p>
                  {noPhone.length > 0 && <p className="text-xs text-amber-600 mt-0.5">{noPhone.length} sin teléfono — se omitirán</p>}
                </div>
                <div className="flex -space-x-2">
                  {withPhone.slice(0, 4).map(sm => (
                    <div key={sm.id} className="w-8 h-8 rounded-full bg-sky-500 border-2 border-white flex items-center justify-center text-[10px] font-bold text-white">{initials(sm)}</div>
                  ))}
                  {withPhone.length > 4 && (
                    <div className="w-8 h-8 rounded-full bg-slate-200 border-2 border-white flex items-center justify-center text-[10px] font-bold text-slate-600">+{withPhone.length - 4}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ PASO 1 — Mensaje ═════════════════════════════════════════════ */}
        {step === 1 && (
          <div className="space-y-5">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Redacta tu mensaje</h2>
              <p className="text-sm text-slate-400 mt-0.5">Usa variables para personalizar cada envío.</p>
            </div>

            {/* Tokens */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Variables</p>
              <div className="flex flex-wrap gap-2">
                {TOKENS.map(t => (
                  <button key={t.value} onClick={() => insertToken(t.value)} title={t.tip}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-sky-50 border border-sky-200 text-sky-700 text-xs font-semibold hover:bg-sky-100 transition-colors cursor-pointer"
                  >
                    <svg width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4"/></svg>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Textarea */}
            <div className="relative">
              <textarea
                ref={textareaRef}
                value={message}
                onChange={e => setMessage(e.target.value)}
                maxLength={MAX_CHARS}
                rows={7}
                placeholder="Hola {nombre}, te escribimos del sector {sector}…"
                className="w-full rounded-2xl border-2 border-slate-200 focus:border-sky-400 focus:ring-4 focus:ring-sky-50 outline-none px-4 py-3.5 text-sm text-slate-900 placeholder:text-slate-300 resize-none transition-all bg-white leading-relaxed"
              />
              <div className={`absolute bottom-3 right-3 text-[11px] font-medium tabular-nums ${message.length > MAX_CHARS * 0.85 ? 'text-amber-500' : 'text-slate-400'}`}>
                {message.length} / {MAX_CHARS}
              </div>
            </div>

            {/* Toggle pedir confirmación */}
            <button onClick={() => setAskConfirm(v => !v)}
              className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-2xl border-2 transition-all cursor-pointer text-left ${
                askConfirm ? 'border-emerald-400 bg-emerald-50' : 'border-slate-200 bg-white hover:border-emerald-300'
              }`}
            >
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-lg flex-shrink-0 ${askConfirm ? 'bg-emerald-500' : 'bg-slate-100'}`}>
                👍
              </div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${askConfirm ? 'text-emerald-800' : 'text-slate-800'}`}>
                  Pedir confirmación de lectura
                </p>
                <p className="text-xs text-slate-400 mt-0.5">
                  Agrega "Responde con 👍" — reduce riesgo de bloqueo porque WhatsApp ve respuestas reales
                </p>
              </div>
              <div className={`w-10 h-6 rounded-full transition-all flex-shrink-0 ${askConfirm ? 'bg-emerald-500' : 'bg-slate-200'}`}>
                <div className={`w-5 h-5 rounded-full bg-white shadow m-0.5 transition-all duration-200 ${askConfirm ? 'translate-x-4' : 'translate-x-0'}`} />
              </div>
            </button>

            {/* Vista previa rápida */}
            {message && withPhone.length > 0 && (
              <div className="rounded-xl bg-slate-50 border border-slate-100 p-3">
                <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Vista previa · {fullName(withPhone[0])}</p>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{fullMessage.replace(/{nombre}/gi, fullName(withPhone[0])).replace(/{sector}/gi, withPhone[0].poligono)}</p>
              </div>
            )}

            {/* Imagen */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Imagen adjunta (opcional)</p>
              {image ? (
                <div className="relative rounded-2xl overflow-hidden border border-slate-200">
                  <img src={image.url} alt="Adjunto" className="w-full max-h-52 object-cover" />
                  <button onClick={removeImage} className="absolute top-2 right-2 w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-white hover:bg-black/70 cursor-pointer">
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                  </button>
                  <div className="absolute bottom-2 left-2 bg-amber-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">Adjuntar manualmente en WhatsApp</div>
                </div>
              ) : (
                <label
                  onDragOver={e => { e.preventDefault(); setDragging(true); }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={e => { e.preventDefault(); setDragging(false); handleImageFile(e.dataTransfer.files[0]); }}
                  className={`flex flex-col items-center gap-2 w-full rounded-2xl border-2 border-dashed py-8 cursor-pointer transition-all ${
                    dragging ? 'border-sky-400 bg-sky-50' : 'border-slate-200 hover:border-sky-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400">
                    <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z"/></svg>
                  </div>
                  <p className="text-sm text-slate-500">Arrastra o <span className="text-sky-600 font-medium">haz clic</span></p>
                  <input type="file" accept="image/*" className="sr-only" onChange={e => handleImageFile(e.target.files[0])} />
                </label>
              )}
            </div>
          </div>
        )}

        {/* ══ PASO 2 — Envío automático ════════════════════════════════════ */}
        {step === 2 && (
          <div className="space-y-5">

            {/* Panel QR — cuando WhatsApp no está conectado */}
            {backendStatus === 'qr' && qrImage && (
              <div className="bg-white rounded-2xl border-2 border-amber-200 p-6 text-center">
                <p className="text-sm font-bold text-slate-900 mb-1">Conecta tu WhatsApp</p>
                <p className="text-xs text-slate-400 mb-4">Escanea con la cámara de WhatsApp → Dispositivos vinculados → Vincular dispositivo</p>
                <img src={qrImage} alt="QR WhatsApp" className="w-52 h-52 mx-auto rounded-xl border border-slate-100" />
                <p className="text-[11px] text-slate-400 mt-3">Solo necesitas hacerlo una vez. La sesión se guarda.</p>
              </div>
            )}

            {backendStatus === 'offline' && (
              <div className="bg-red-50 rounded-2xl border border-red-100 p-4 flex gap-3">
                <svg width="18" height="18" className="text-red-400 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z"/></svg>
                <div>
                  <p className="text-sm font-semibold text-red-700">Backend offline</p>
                  <p className="text-xs text-red-500 mt-0.5">Inicia el servidor: <code className="bg-red-100 px-1 rounded">cd backend && npm start</code></p>
                </div>
              </div>
            )}

            {/* Intervalo */}
            {backendStatus === 'ready' && !campaign?.running && !isDone && (
              <div className="bg-white rounded-2xl border border-slate-100 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <svg width="15" height="15" fill="none" stroke="#D97706" strokeWidth="2" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 6v6l4 2"/></svg>
                  <p className="text-sm font-semibold text-slate-900">Intervalo entre mensajes</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {DELAY_OPTIONS.map(opt => (
                    <button key={opt.value} onClick={() => setDelay(opt.value)}
                      className={`flex flex-col items-center px-3 py-2 rounded-xl border-2 cursor-pointer min-w-[60px] transition-all ${
                        delay === opt.value ? 'border-amber-400 bg-amber-50' : 'border-slate-200 hover:border-amber-200'
                      }`}
                    >
                      <span className={`text-sm font-bold ${delay === opt.value ? 'text-amber-700' : 'text-slate-700'}`}>{opt.label}</span>
                      <span className={`text-[10px] ${delay === opt.value ? 'text-amber-500' : 'text-slate-400'}`}>{opt.desc}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-400 mt-2.5">
                  Tiempo total estimado: <span className="font-semibold text-slate-600">{Math.ceil((withPhone.length * delay) / 60)} min</span> para {withPhone.length} SM
                </p>
              </div>
            )}

            {/* Progreso en vivo */}
            {campaign && (
              <div className="bg-white rounded-2xl border border-slate-100 p-4 space-y-4">
                {/* Barra */}
                <div>
                  <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                    <span>{isDone ? 'Campaña completa' : `Enviando…`}</span>
                    <span className="font-semibold" style={{ color: WSP_GREEN }}>
                      {sentCount}/{campaign.total}
                    </span>
                  </div>
                  <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${campaign.total > 0 ? (sentCount / campaign.total) * 100 : 0}%`, backgroundColor: WSP_GREEN }}
                    />
                  </div>
                  {errorCount > 0 && <p className="text-xs text-red-500 mt-1">{errorCount} errores</p>}
                </div>

                {/* Estado actual */}
                {campaign.running && (
                  campaign.tick > 0 ? (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <CountdownRing seconds={campaign.tick} total={delay} />
                      <div>
                        <p className="text-sm font-semibold text-slate-900">
                          Siguiente en <span style={{ color: WSP_GREEN }}>{campaign.tick}s</span>
                        </p>
                        {campaign.nextName && <p className="text-xs text-slate-400">{campaign.nextName}</p>}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-xl">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: WSP_GREEN }}>
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-slate-900">Enviando mensaje…</p>
                        <p className="text-xs text-slate-400">{campaign.currentName}</p>
                      </div>
                      <div className="ml-auto w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )
                )}

                {isDone && (
                  <div className="text-center py-2">
                    <p className="text-2xl mb-1">🎉</p>
                    <p className="font-bold text-emerald-600">¡Campaña completada!</p>
                    <p className="text-xs text-slate-400 mt-0.5">{sentCount} enviados · {errorCount} errores</p>
                  </div>
                )}
              </div>
            )}

            {/* Lista de SM */}
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
                Destinatarios · {withPhone.length}
                {noPhone.length > 0 && <span className="ml-2 text-amber-500">({noPhone.length} sin número)</span>}
              </p>
              <div className="space-y-2">
                {withPhone.map((sm, i) => {
                  const status = campaign?.results?.[sm.id];
                  const isCurrent = campaign?.running && campaign.currentIndex === i;
                  return (
                    <div key={sm.id} className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                      status === 'sent'   ? 'border-emerald-100 bg-emerald-50'
                      : status === 'error' ? 'border-red-100 bg-red-50'
                      : isCurrent         ? 'border-sky-300 bg-sky-50'
                                          : 'border-slate-100 bg-white'
                    }`}>
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                        status === 'sent'    ? 'bg-emerald-500 text-white'
                        : status === 'error' ? 'bg-red-400 text-white'
                        : isCurrent          ? 'bg-sky-500 text-white'
                                             : 'bg-slate-200 text-slate-500'
                      }`}>
                        {status === 'sent'
                          ? <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                          : status === 'error'
                            ? <svg width="16" height="16" fill="none" stroke="white" strokeWidth="2.5" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12"/></svg>
                            : isCurrent
                              ? <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                              : initials(sm)
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{fullName(sm)} {sm.a_materno || ''}</p>
                        <p className="text-xs text-slate-400">Sector {sm.poligono} · {sm.telefono_1}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                        status === 'sent'    ? 'bg-emerald-100 text-emerald-700'
                        : status === 'error' ? 'bg-red-100 text-red-600'
                        : isCurrent          ? 'bg-sky-100 text-sky-600'
                                             : 'bg-slate-100 text-slate-400'
                      }`}>
                        {status === 'sent' ? 'Enviado' : status === 'error' ? 'Error' : isCurrent ? 'Enviando' : `${i + 1}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── CTA flotante ─────────────────────────────────────────────────── */}
      <div className="fixed bottom-0 left-0 right-0 z-20 bg-white/90 backdrop-blur-sm border-t border-slate-100">
        <div className="max-w-2xl mx-auto px-4 py-4">
          {step < 2 ? (
            <button onClick={() => setStep(s => s + 1)} disabled={!canProceed[step]}
              className="w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: '#0EA5E9' }}
            >
              {step === 0
                ? `Continuar con ${withPhone.length} SM${withPhone.length !== 1 ? 's' : ''}`
                : `Revisar y enviar →`}
            </button>
          ) : campaign?.running ? (
            <button onClick={cancelCampaign}
              className="w-full py-3.5 rounded-2xl text-sm font-bold text-red-600 border-2 border-red-200 hover:bg-red-50 transition-all cursor-pointer"
            >
              Cancelar campaña
            </button>
          ) : isDone ? (
            <button onClick={() => { setCampaign(null); setStep(0); }}
              className="w-full py-3.5 rounded-2xl text-sm font-bold text-white transition-all cursor-pointer"
              style={{ backgroundColor: '#0EA5E9' }}
            >
              Nueva campaña
            </button>
          ) : backendStatus === 'ready' ? (
            <button onClick={startCampaign}
              className="w-full py-3.5 rounded-2xl text-sm font-bold text-white flex items-center justify-center gap-2 transition-all hover:opacity-90 cursor-pointer"
              style={{ backgroundColor: WSP_GREEN }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="white"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              Iniciar campaña automática · {withPhone.length} SM
            </button>
          ) : (
            <div className="text-center text-sm text-slate-400 py-2">
              {backendStatus === 'qr' ? 'Escanea el QR para habilitar el envío' : 'Esperando conexión al backend…'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Mensajeria;
