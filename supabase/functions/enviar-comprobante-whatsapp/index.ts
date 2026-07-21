// Envía por WhatsApp (vía UltraMsg) el comprobante de la cita del beneficio
// de Certificado Médico: la imagen del QR del folio + los datos de la cita.
//
// Secrets requeridos (supabase secrets set ...):
//   ULTRAMSG_INSTANCE_ID   - ID de instancia de ultramsg.com
//   ULTRAMSG_TOKEN         - token de esa instancia
// Opcional:
//   WHATSAPP_COUNTRY_CODE  - lada de país a anteponer al teléfono (default "52")

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: CORS_HEADERS });
  }

  try {
    const { telefono, folio, tutorNombre, fechaCita, horaCita } = await req.json();

    if (!telefono || !folio) {
      return new Response(JSON.stringify({ error: "Faltan telefono o folio" }), {
        status: 400,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const instanceId = Deno.env.get("ULTRAMSG_INSTANCE_ID");
    const token = Deno.env.get("ULTRAMSG_TOKEN");
    const countryCode = Deno.env.get("WHATSAPP_COUNTRY_CODE") ?? "52";

    if (!instanceId || !token) {
      return new Response(JSON.stringify({ error: "UltraMsg no está configurado (faltan secrets)" }), {
        status: 500,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    const telefonoLimpio = String(telefono).replace(/\D/g, "");
    const to = `${countryCode}${telefonoLimpio}`;
    const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(folio)}`;
    const caption =
      `Hola ${tutorNombre ?? ""}, este es tu comprobante de cita para el Certificado Médico.\n\n` +
      `Folio: ${folio}\n` +
      `Fecha: ${fechaCita} a las ${horaCita} hrs\n\n` +
      `Presenta este folio o el código QR el día de tu cita.`;

    const resp = await fetch(`https://api.ultramsg.com/${instanceId}/messages/image`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, to, image: qrImageUrl, caption }),
    });

    const data = await resp.json().catch(() => ({}));

    if (!resp.ok) {
      return new Response(JSON.stringify({ error: "Error de UltraMsg", detalle: data }), {
        status: 502,
        headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, data }), {
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    });
  }
});
