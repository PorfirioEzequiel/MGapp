import React, { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";
import supabase from "../supabase/client";
import EscanerQR from "../componentes/EscanerQR";
import codigosPostalesData from "../codigospostales.json";
import { datosDesdeTextoQR } from "../utils/curp";

// ── Constantes ─────────────────────────────────────────────────────────────────
// Jornada única: jueves 23 de julio, 3 módulos de atención en paralelo (una
// cita cada 10 min), tope de 80 citas en total. La ubicación es interna
// (sector 6) y por eso nunca se muestra ese nombre en texto público — solo
// el link del mapa.
const FECHA_CITA_UNICA = "2026-07-23";
const HORA_INICIO_CITAS = "09:30";
const INTERVALO_MINUTOS = 10;
const CUPO_POR_SLOT = 3;
const CUPO_TOTAL_DIA = 80;
const UBICACION_MAPS_URL = "https://maps.app.goo.gl/pPw3DfKM8y18VrwF6";

// ── Helpers puros ────────────────────────────────────────────────────────────
const generarFolio = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `CM-${s}`;
};

// Genera los horarios de la jornada: arranca en HORA_INICIO_CITAS y avanza de
// INTERVALO_MINUTOS en INTERVALO_MINUTOS hasta cubrir CUPO_TOTAL_DIA citas
// (con CUPO_POR_SLOT citas por horario). El tope real de 80 se aplica aparte
// como conteo global, así que el último horario puede quedar con menos cupo.
const horariosDelDia = () => {
  const totalSlots = Math.ceil(CUPO_TOTAL_DIA / CUPO_POR_SLOT);
  const [hh, mm] = HORA_INICIO_CITAS.split(":").map(Number);
  const out = [];
  let minutos = hh * 60 + mm;
  for (let i = 0; i < totalSlots; i++) {
    out.push(`${String(Math.floor(minutos / 60)).padStart(2, "0")}:${String(minutos % 60).padStart(2, "0")}`);
    minutos += INTERVALO_MINUTOS;
  }
  return out;
};

const formatearFechaLarga = (isoDate) => {
  if (!isoDate) return "";
  const [y, m, d] = isoDate.split("-");
  return new Date(+y, +m - 1, +d).toLocaleDateString("es-MX", {
    weekday: "long", day: "numeric", month: "long", year: "numeric",
  });
};

// ── Primitivas de UI ──────────────────────────────────────────────────────────
const PASOS = [
  { key: "tutor-scan",  label: "Tutor" },
  { key: "contacto",    label: "Contacto" },
  { key: "menores-scan",label: "Menores" },
  { key: "cita",        label: "Cita" },
  { key: "encuesta",    label: "Confirmar" },
];

const BarraProgreso = ({ paso }) => {
  const idx = PASOS.findIndex((p) => p.key === paso);
  if (idx === -1) return null;
  return (
    <div className="mb-6 print:hidden">
      <div className="flex items-center">
        {PASOS.map((p, i) => (
          <React.Fragment key={p.key}>
            <div className="flex flex-col items-center">
              <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all duration-300 ${
                i < idx  ? "bg-blue-800 text-white"
                : i === idx ? "bg-blue-800 text-white ring-[3px] ring-blue-200"
                : "bg-slate-200 text-slate-400"
              }`}>
                {i < idx ? (
                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                ) : i + 1}
              </div>
              <span className={`text-[9px] mt-1 font-bold uppercase tracking-wide hidden sm:block ${i <= idx ? "text-blue-800" : "text-slate-400"}`}>
                {p.label}
              </span>
            </div>
            {i < PASOS.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 sm:mb-5 transition-all duration-500 ${i < idx ? "bg-blue-700" : "bg-slate-200"}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

const Campo = ({ label, required, children }) => (
  <div className="space-y-1">
    <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
      {label}{required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

const InputField = ({ className = "", ...props }) => (
  <input
    {...props}
    className={`w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all ${className}`}
  />
);

const SelectField = ({ children, ...props }) => (
  <select
    {...props}
    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
  >
    {children}
  </select>
);

const Btn = ({ children, v = "primary", className = "", ...props }) => {
  const base = "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100 focus:outline-none focus:ring-2 focus:ring-offset-1";
  const vs = {
    primary: "bg-blue-800 text-white hover:bg-blue-900 shadow-sm focus:ring-blue-700",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm focus:ring-emerald-500",
    ghost:   "text-slate-500 hover:text-slate-800 hover:bg-slate-100 focus:ring-slate-400",
    danger:  "bg-red-600 text-white hover:bg-red-700 shadow-sm focus:ring-red-500",
    scan:    "bg-blue-800 text-white hover:bg-blue-900 shadow-md focus:ring-blue-700 animate-pulse-ring px-6 py-3 text-base",
  };
  return <button {...props} className={`${base} ${vs[v]} ${className}`}>{children}</button>;
};

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>{children}</div>
);

const Spinner = ({ lg }) => (
  <div className={`rounded-full border-[3px] border-blue-700 border-t-transparent animate-spin flex-shrink-0 ${lg ? "w-8 h-8" : "w-4 h-4"}`} />
);

const IcoCheck = ({ className = "w-3.5 h-3.5" }) => (
  <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
  </svg>
);

const IcoArrow = () => (
  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
  </svg>
);

// ── Botón de escaneo (UI pura, sin lógica) ────────────────────────────────────
const BotonesEscanear = ({ onClick, titulo, subtitulo, badge }) => (
  <Card className="p-6 text-center border-2 border-dashed border-slate-200">
    <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
      <svg className="w-7 h-7 text-blue-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
      </svg>
    </div>
    {badge && (
      <span className="inline-flex items-center gap-1 bg-amber-50 border border-amber-200 text-amber-700 text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full mb-3">
        <svg className="w-2.5 h-2.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        {badge}
      </span>
    )}
    <p className="text-sm font-bold text-slate-800 mb-1">{titulo}</p>
    <p className="text-xs text-slate-400 mb-5 leading-relaxed">{subtitulo}</p>
    <Btn v="scan" type="button" onClick={onClick} className="mx-auto">
      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      Abrir cámara y escanear
    </Btn>
  </Card>
);

// ── ConfirmarPersona — diseño, lógica intacta ─────────────────────────────────
const ConfirmarPersona = ({ datosCurp, form, setForm, onConfirmar, onReescanear, error, edadMinima, edadMaxima, textoRequisito }) => {
  const cumpleEdad =
    (edadMinima == null || datosCurp.edad >= edadMinima) &&
    (edadMaxima == null || datosCurp.edad < edadMaxima);
  const bloqueado = !cumpleEdad ? textoRequisito : datosCurp.bloqueo || null;

  return (
    <Card className="overflow-hidden animate-fade-in-up">
      <div className={`px-4 py-3.5 border-b ${bloqueado ? "bg-red-50 border-red-100" : "bg-emerald-50 border-emerald-100"}`}>
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${bloqueado ? "bg-red-100" : "bg-emerald-100"}`}>
            {bloqueado ? (
              <svg className="w-3.5 h-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <IcoCheck className="w-3.5 h-3.5 text-emerald-600" />
            )}
          </div>
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-widest ${bloqueado ? "text-red-600" : "text-emerald-700"}`}>
              {bloqueado ? "CURP no válida para este trámite" : "CURP leída correctamente"}
            </p>
            <p className="font-mono text-sm font-bold text-slate-800 mt-0.5">{datosCurp.curp}</p>
            <p className="text-xs text-slate-500">{datosCurp.edad} años · {datosCurp.sexo ?? "—"}</p>
          </div>
        </div>
      </div>

      {bloqueado ? (
        <div className="px-4 py-4">
          <div className="flex gap-2 bg-red-50 border border-red-100 rounded-xl p-3 mb-4">
            <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
            </svg>
            <p className="text-sm text-red-700 font-medium leading-relaxed">{bloqueado}</p>
          </div>
          <Btn type="button" v="ghost" onClick={onReescanear}>← Escanear otra CURP</Btn>
        </div>
      ) : (
        <div className="px-4 py-4 space-y-3">
          <p className="text-xs text-slate-500 leading-relaxed">
            Verifica que el nombre coincida exactamente con el documento oficial.
          </p>
          <Campo label="Nombre(s)" required>
            <InputField placeholder="Como aparece en la CURP" value={form.nombre}
              onChange={(e) => setForm({ ...form, nombre: e.target.value.toUpperCase() })} />
          </Campo>
          <div className="grid grid-cols-2 gap-2">
            <Campo label="A. Paterno" required>
              <InputField placeholder="Paterno" value={form.a_paterno}
                onChange={(e) => setForm({ ...form, a_paterno: e.target.value.toUpperCase() })} />
            </Campo>
            <Campo label="A. Materno">
              <InputField placeholder="Materno" value={form.a_materno}
                onChange={(e) => setForm({ ...form, a_materno: e.target.value.toUpperCase() })} />
            </Campo>
          </div>
          {error && <p className="text-xs text-red-600 font-bold">{error}</p>}
          <div className="flex items-center gap-2 pt-1">
            <Btn type="button" v="success" onClick={onConfirmar}>
              Confirmar y continuar <IcoArrow />
            </Btn>
            <Btn type="button" v="ghost" onClick={onReescanear}>Volver a escanear</Btn>
          </div>
        </div>
      )}
    </Card>
  );
};

// ── Ticket de comprobante para PDF (off-screen) ───────────────────────────────
const TicketComprobante = React.forwardRef(({ folio, fecha, hora, tutor, curpTutor, menores, generadoEn, ubicacionUrl }, ref) => {
  const s = { /* shorthand */ };
  return (
    <div ref={ref} style={{
      position: "fixed", top: "-12000px", left: "-12000px",
      width: "550px", backgroundColor: "#ffffff",
      fontFamily: "'Montserrat', Verdana, Geneva, Tahoma, sans-serif",
    }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg,#1e3a8a 0%,#1d4ed8 100%)", padding: "22px 30px 18px" }}>
        <p style={{ color: "rgba(255,255,255,0.55)", fontSize: "9px", fontWeight: 700, letterSpacing: "0.2em", textTransform: "uppercase", margin: "0 0 6px" }}>
          Beneficio Social · Salud
        </p>
        <h1 style={{ color: "#fff", fontSize: "22px", fontWeight: 800, margin: "0 0 3px", letterSpacing: "-0.02em" }}>
          Certificado Médico
        </h1>
        <p style={{ color: "rgba(255,255,255,0.7)", fontSize: "11px", fontWeight: 500, margin: 0 }}>
          Comprobante Oficial de Registro
        </p>
      </div>

      {/* Folio + QR — centrado y prominente */}
      <div style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", padding: "24px 30px 20px", textAlign: "center" }}>
        <p style={{ color: "#64748b", fontSize: "9px", fontWeight: 700, letterSpacing: "0.18em", textTransform: "uppercase", margin: "0 0 14px" }}>
          Código de acceso · Folio {folio}
        </p>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "14px" }}>
          <div style={{ background: "#ffffff", padding: "12px", borderRadius: "16px", border: "2px solid #e2e8f0", display: "inline-block", boxShadow: "0 2px 12px rgba(0,0,0,0.06)" }}>
            <QRCodeCanvas value={folio} size={160} level="H" includeMargin={false} />
          </div>
        </div>
        <p style={{ color: "#1e3a8a", fontSize: "30px", fontWeight: 800, fontFamily: "monospace", letterSpacing: "0.15em", margin: "0 0 6px" }}>
          {folio}
        </p>
        <p style={{ color: "#94a3b8", fontSize: "10px", lineHeight: 1.6, margin: 0 }}>
          Presenta este código en el módulo de atención el día de tu cita.
        </p>
      </div>

      {/* Detalles cita */}
      <div style={{ padding: "16px 30px", borderBottom: "1px solid #e2e8f0" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "12px" }}>
          <div style={{ width: "3px", height: "14px", background: "#1d4ed8", borderRadius: "2px" }} />
          <p style={{ color: "#1e293b", fontSize: "10px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>
            Detalles de la Cita
          </p>
        </div>
        <div style={{ display: "flex", gap: "32px" }}>
          <div>
            <p style={{ color: "#64748b", fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 3px" }}>Fecha</p>
            <p style={{ color: "#0f172a", fontSize: "13px", fontWeight: 700, margin: 0, textTransform: "capitalize" }}>{formatearFechaLarga(fecha)}</p>
          </div>
          <div>
            <p style={{ color: "#64748b", fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 3px" }}>Hora</p>
            <p style={{ color: "#0f172a", fontSize: "13px", fontWeight: 700, margin: 0 }}>{hora} hrs</p>
          </div>
        </div>
        {ubicacionUrl && (
          <div style={{ marginTop: "10px" }}>
            <p style={{ color: "#64748b", fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", margin: "0 0 3px" }}>Ubicación</p>
            <p style={{ color: "#1d4ed8", fontSize: "11px", fontWeight: 700, margin: 0, wordBreak: "break-all" }}>{ubicacionUrl}</p>
          </div>
        )}
      </div>

      {/* Tutor */}
      <div style={{ padding: "14px 30px", borderBottom: "1px solid #e2e8f0", background: "#fafafa" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <div style={{ width: "3px", height: "14px", background: "#1d4ed8", borderRadius: "2px" }} />
          <p style={{ color: "#1e293b", fontSize: "10px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>
            Tutor / Responsable
          </p>
        </div>
        <p style={{ color: "#0f172a", fontSize: "13px", fontWeight: 700, margin: "0 0 4px" }}>{tutor}</p>
        <p style={{ color: "#64748b", fontSize: "10px", fontFamily: "monospace", letterSpacing: "0.06em", margin: 0 }}>CURP: {curpTutor}</p>
      </div>

      {/* Menores */}
      {menores.length > 0 && (
        <div style={{ padding: "14px 30px", borderBottom: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <div style={{ width: "3px", height: "14px", background: "#1d4ed8", borderRadius: "2px" }} />
            <p style={{ color: "#1e293b", fontSize: "10px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>
              Menores Beneficiarios ({menores.length})
            </p>
          </div>
          {menores.map((m, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: i < menores.length - 1 ? "6px" : 0 }}>
              <span style={{ width: "18px", height: "18px", background: "#dbeafe", borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: "9px", fontWeight: 800, color: "#1d4ed8", flexShrink: 0 }}>
                {i + 1}
              </span>
              <span style={{ color: "#1e293b", fontSize: "12px", fontWeight: 600 }}>
                {m.nombre} {m.a_paterno} {m.a_materno}
              </span>
              <span style={{ color: "#94a3b8", fontSize: "11px" }}>· {m.edad} años</span>
            </div>
          ))}
        </div>
      )}

      {/* Recomendaciones */}
      <div style={{ padding: "14px 30px", borderBottom: "1px solid #e2e8f0", background: "#eff6ff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
          <div style={{ width: "3px", height: "14px", background: "#f59e0b", borderRadius: "2px" }} />
          <p style={{ color: "#92400e", fontSize: "10px", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase", margin: 0 }}>
            Recomendaciones Importantes
          </p>
        </div>
        {[
          "Llega al menos 15 minutos antes de tu horario de cita.",
          "Presenta este comprobante impreso o desde tu dispositivo móvil.",
          "Porta la CURP original del tutor (padre, madre o tutor legal).",
          "Porta la CURP original de cada menor beneficiario.",
          "Los menores deben acudir acompañados del tutor registrado.",
          "Si no puedes asistir, reagenda en: sm-estructura.netlify.app",
        ].map((rec, i) => (
          <div key={i} style={{ display: "flex", gap: "8px", marginBottom: i < 5 ? "5px" : 0 }}>
            <span style={{ color: "#1d4ed8", fontWeight: 800, fontSize: "11px", flexShrink: 0, marginTop: "1px" }}>✓</span>
            <p style={{ color: "#1e40af", fontSize: "10px", margin: 0, lineHeight: 1.55 }}>{rec}</p>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ padding: "12px 30px", background: "#1e293b", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "9px", margin: "0 0 2px" }}>Generado el {generadoEn}</p>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "8px", margin: 0 }}>
            Documento válido como comprobante oficial de registro al beneficio.
          </p>
        </div>
        <p style={{ color: "rgba(255,255,255,0.45)", fontSize: "10px", fontFamily: "monospace", fontWeight: 700, margin: 0 }}>{folio}</p>
      </div>
    </div>
  );
});

// ── Componente principal ──────────────────────────────────────────────────────
const RegistroCertificadoMedico = () => {
  const navigate = useNavigate();
  const [paso, setPaso] = useState("tutor-scan");

  // UI state para scanner (solo presentación)
  const [scannerTutorActivo, setScannerTutorActivo] = useState(false);
  const [scannerMenorActivo, setScannerMenorActivo] = useState(false);

  // Tutor
  const [tutorCurpDatos, setTutorCurpDatos] = useState(null);
  const [tutorForm, setTutorForm] = useState({ nombre: "", a_paterno: "", a_materno: "" });
  const [errorTutor, setErrorTutor] = useState("");
  const [errorEscaneo, setErrorEscaneo] = useState("");
  const [textoEscaneadoCrudo, setTextoEscaneadoCrudo] = useState("");
  const [verificandoDuplicado, setVerificandoDuplicado] = useState(false);

  // Contacto
  const [cp, setCp] = useState("");
  const [colonia, setColonia] = useState("");
  const [colonias, setColonias] = useState([]);
  const [telefono, setTelefono] = useState("");
  const [errorTelefono, setErrorTelefono] = useState("");

  // Menores
  const [numMenores, setNumMenores] = useState(1);
  const [menores, setMenores] = useState([]);
  const [menorCurpDatos, setMenorCurpDatos] = useState(null);
  const [menorForm, setMenorForm] = useState({ nombre: "", a_paterno: "", a_materno: "" });
  const [errorMenor, setErrorMenor] = useState("");

  // Cita: fecha única (jueves 23 de julio), no seleccionable
  const [fechaCita] = useState(FECHA_CITA_UNICA);
  const horarios = useMemo(() => horariosDelDia(), []);
  const [horaCita, setHoraCita] = useState("");
  const [ocupacion, setOcupacion] = useState({});
  const [totalOcupadosDia, setTotalOcupadosDia] = useState(0);
  const [cargandoOcupacion, setCargandoOcupacion] = useState(false);

  // Encuesta + envío
  const [comoSeEntero, setComoSeEntero] = useState("");
  const [comoSeEnteroOtro, setComoSeEnteroOtro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");
  const [folioFinal, setFolioFinal] = useState(null);

  // PDF / comprobante
  const ticketRef = useRef(null);
  const [generandoPDF, setGenerandoPDF] = useState(false);
  const comprobanteEnviadoRef = useRef(false);
  const [estadoWhatsapp, setEstadoWhatsapp] = useState("enviando"); // enviando | ok | error

  // Cierra el scanner cuando hay un error de escaneo (UI: mostrar botón de nuevo)
  useEffect(() => {
    if (errorEscaneo) { setScannerTutorActivo(false); setScannerMenorActivo(false); }
  }, [errorEscaneo]);

  // Cierra el scanner cuando la CURP fue aceptada (UI: ocultar cámara)
  useEffect(() => { if (tutorCurpDatos) setScannerTutorActivo(false); }, [tutorCurpDatos]);
  useEffect(() => { if (menorCurpDatos)  setScannerMenorActivo(false); }, [menorCurpDatos]);

  useEffect(() => {
    if (paso !== "cita") return;
    const cargar = async () => {
      setCargandoOcupacion(true);
      const { data, error } = await supabase
        .from("beneficiarios_certificados")
        .select("fecha_cita, hora_cita")
        .eq("fecha_cita", FECHA_CITA_UNICA)
        .in("status", ["AGENDADA", "REAGENDADA"]);
      if (!error) {
        const conteo = {};
        (data ?? []).forEach((r) => {
          const key = String(r.hora_cita).slice(0, 5);
          conteo[key] = (conteo[key] ?? 0) + 1;
        });
        setOcupacion(conteo);
        setTotalOcupadosDia((data ?? []).length);
      }
      setCargandoOcupacion(false);
    };
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso]);

  // El navegador sugiere el <title> como nombre de archivo al "Guardar como PDF"
  // desde el diálogo de impresión, así que en el comprobante lo cambiamos al
  // nombre del tutor y lo regresamos a como estaba al salir de ese paso.
  useEffect(() => {
    if (paso !== "confirmacion") return;
    const tituloAnterior = document.title;
    const nombreTutor = `${tutorForm.nombre} ${tutorForm.a_paterno} ${tutorForm.a_materno}`.trim();
    document.title = nombreTutor ? `Comprobante ${nombreTutor}` : "Comprobante de registro";
    return () => { document.title = tituloAnterior; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso]);

  // Un CURP ya usado como tutor o como menor en CUALQUIER registro anterior no se puede volver a usar.
  const verificarCurpDuplicado = async (curp) => {
    const [tutorMatch, menorMatch] = await Promise.all([
      supabase.from("beneficiarios_certificados").select("id").eq("tutor_curp", curp).limit(1),
      supabase.from("beneficiarios_certificados_menores").select("id").eq("curp", curp).limit(1),
    ]);
    return (tutorMatch.data?.length ?? 0) > 0 || (menorMatch.data?.length ?? 0) > 0;
  };

  const handleTutorScan = async (rawText) => {
    const datos = datosDesdeTextoQR(rawText);
    if (!datos) {
      setErrorEscaneo("No se pudo leer una CURP válida en ese código. Intenta de nuevo.");
      setTextoEscaneadoCrudo(rawText);
      return;
    }
    setErrorEscaneo("");
    setTextoEscaneadoCrudo("");
    setVerificandoDuplicado(true);
    const duplicado = await verificarCurpDuplicado(datos.curp);
    setVerificandoDuplicado(false);
    const bloqueo = duplicado ? "Esta CURP ya está registrada (como tutor o como menor) en un trámite anterior." : null;
    setTutorCurpDatos({ ...datos, bloqueo });
    if (!bloqueo) {
      setTutorForm({
        nombre: (datos.nombre || "").toUpperCase(),
        a_paterno: (datos.aPaterno || "").toUpperCase(),
        a_materno: (datos.aMaterno || "").toUpperCase(),
      });
    }
  };

  const confirmarTutor = () => {
    if (!tutorForm.nombre.trim()) { setErrorTutor("El nombre es obligatorio."); return; }
    setErrorTutor("");
    setPaso("contacto");
  };

  const handleCodigoPostalChange = (valor) => {
    const limpio = valor.replace(/\D/g, "").slice(0, 5);
    setCp(limpio);
    setColonia("");
    const encontradas = codigosPostalesData.filter((loc) => loc.d_codigo.toString() === limpio).map((loc) => loc.d_asenta);
    setColonias(encontradas);
  };

  const confirmarContacto = () => {
    if (!cp.trim() || !colonia.trim()) { alert("Código Postal y Colonia son obligatorios."); return; }
    if (!/^\d{10}$/.test(telefono.trim())) { setErrorTelefono("El teléfono debe tener exactamente 10 dígitos."); return; }
    setErrorTelefono("");
    setPaso("menores-scan");
  };

  const handleMenorScan = async (rawText) => {
    const datos = datosDesdeTextoQR(rawText);
    if (!datos) {
      setErrorEscaneo("No se pudo leer una CURP válida en ese código. Intenta de nuevo.");
      setTextoEscaneadoCrudo(rawText);
      return;
    }
    setErrorEscaneo("");
    setTextoEscaneadoCrudo("");
    let bloqueo = null;
    if (datos.curp === tutorCurpDatos?.curp) {
      bloqueo = "Esta CURP es la misma que la del tutor.";
    } else if (menores.some((m) => m.curp === datos.curp)) {
      bloqueo = "Esta CURP ya se registró para otro menor en este mismo trámite.";
    } else {
      setVerificandoDuplicado(true);
      const duplicado = await verificarCurpDuplicado(datos.curp);
      setVerificandoDuplicado(false);
      if (duplicado) bloqueo = "Esta CURP ya está registrada (como tutor o como menor) en un trámite anterior.";
    }
    setMenorCurpDatos({ ...datos, bloqueo });
    if (!bloqueo) {
      setMenorForm({
        nombre: (datos.nombre || "").toUpperCase(),
        a_paterno: (datos.aPaterno || "").toUpperCase(),
        a_materno: (datos.aMaterno || "").toUpperCase(),
      });
    }
  };

  const confirmarMenorActual = () => {
    if (!menorForm.nombre.trim()) { setErrorMenor("El nombre es obligatorio."); return; }
    const nuevo = { ...menorForm, curp: menorCurpDatos.curp, edad: menorCurpDatos.edad };
    const listaActualizada = [...menores, nuevo];
    setMenores(listaActualizada);
    setMenorCurpDatos(null);
    setMenorForm({ nombre: "", a_paterno: "", a_materno: "" });
    setErrorMenor("");
    if (listaActualizada.length >= numMenores) setPaso("cita");
  };

  const handleSubmit = async () => {
    if (!horaCita) { alert("Selecciona un horario para tu cita."); return; }
    if (!comoSeEntero) { alert("Selecciona cómo te enteraste del beneficio."); return; }
    if (comoSeEntero === "OTRO" && !comoSeEnteroOtro.trim()) { alert("Describe cómo te enteraste."); return; }
    setEnviando(true);
    setErrorEnvio("");
    try {
      const { count: totalDia } = await supabase
        .from("beneficiarios_certificados")
        .select("*", { count: "exact", head: true })
        .eq("fecha_cita", fechaCita)
        .in("status", ["AGENDADA", "REAGENDADA"]);
      if ((totalDia ?? 0) >= CUPO_TOTAL_DIA) {
        setErrorEnvio(`Ya se llenaron las ${CUPO_TOTAL_DIA} citas disponibles para este día.`);
        setEnviando(false);
        return;
      }
      const { count } = await supabase
        .from("beneficiarios_certificados")
        .select("*", { count: "exact", head: true })
        .eq("fecha_cita", fechaCita)
        .eq("hora_cita", horaCita)
        .in("status", ["AGENDADA", "REAGENDADA"]);
      if ((count ?? 0) >= CUPO_POR_SLOT) {
        setErrorEnvio("Ese horario se llenó mientras completabas el registro. Elige otro horario abajo.");
        setEnviando(false);
        return;
      }
      const folio = generarFolio();
      const { data: registro, error } = await supabase
        .from("beneficiarios_certificados")
        .insert([{
          folio,
          tutor_nombre: tutorForm.nombre.trim().toUpperCase(),
          tutor_a_paterno: tutorForm.a_paterno.trim().toUpperCase(),
          tutor_a_materno: tutorForm.a_materno.trim().toUpperCase(),
          tutor_curp: tutorCurpDatos.curp,
          tutor_edad: tutorCurpDatos.edad,
          tutor_sexo: tutorCurpDatos.sexo,
          c_p: cp.trim(),
          col_loc: colonia.trim().toUpperCase(),
          telefono: telefono.trim(),
          numero_menores: numMenores,
          como_se_entero: comoSeEntero,
          como_se_entero_otro: comoSeEntero === "OTRO" ? comoSeEnteroOtro.trim() : null,
          fecha_cita: fechaCita,
          hora_cita: horaCita,
        }])
        .select()
        .single();
      if (error) throw error;
      if (menores.length) {
        const filas = menores.map((m) => ({
          beneficiario_certificado_id: registro.id,
          tutor_curp: tutorCurpDatos.curp,
          tutor_nombre_completo: `${tutorForm.nombre} ${tutorForm.a_paterno} ${tutorForm.a_materno}`.trim(),
          nombre: m.nombre.trim().toUpperCase(),
          a_paterno: m.a_paterno.trim().toUpperCase(),
          a_materno: m.a_materno.trim().toUpperCase(),
          curp: m.curp,
          edad: m.edad,
        }));
        const { error: errMenores } = await supabase.from("beneficiarios_certificados_menores").insert(filas);
        if (errMenores) throw errMenores;
      }
      setFolioFinal(folio);
      setPaso("confirmacion");
    } catch (err) {
      setErrorEnvio("Error al guardar el registro: " + err.message);
    } finally {
      setEnviando(false);
    }
  };

  // Renderiza el ticket off-screen a canvas. La comparten el botón de
  // descargar PDF y el envío automático por WhatsApp (misma imagen).
  const generarCanvasTicket = async () => {
    if (!ticketRef.current) return null;
    await new Promise((r) => setTimeout(r, 200));
    return html2canvas(ticketRef.current, {
      scale: 2, useCORS: true, allowTaint: true, logging: false, backgroundColor: "#ffffff",
    });
  };

  // Genera PDF profesional usando html2canvas + jsPDF
  const generarComprobantePDF = async () => {
    setGenerandoPDF(true);
    try {
      const canvas = await generarCanvasTicket();
      if (!canvas) return;
      const imgData = canvas.toDataURL("image/png");
      const pageW = 148;
      const pageH = (canvas.height * pageW) / canvas.width;
      const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: [pageW, pageH] });
      pdf.addImage(imgData, "PNG", 0, 0, pageW, pageH);
      pdf.save(`Comprobante-${folioFinal}.pdf`);
    } catch (err) {
      console.error("Error generando PDF:", err);
      alert("No se pudo generar el PDF. Intenta de nuevo.");
    } finally {
      setGenerandoPDF(false);
    }
  };

  // Al llegar a la confirmación, sube la MISMA imagen del comprobante (el
  // ticket que también arma el PDF) a Storage y dispara el envío automático
  // por WhatsApp con la cita y la ubicación. Es "mejor esfuerzo": si falla,
  // no se le informa como error al tutor porque ya tiene su folio y QR en pantalla.
  useEffect(() => {
    if (paso !== "confirmacion" || !folioFinal || comprobanteEnviadoRef.current) return;
    comprobanteEnviadoRef.current = true;
    const enviar = async () => {
      setEstadoWhatsapp("enviando");
      try {
        const canvas = await generarCanvasTicket();
        if (!canvas) throw new Error("No se pudo generar la imagen del comprobante.");
        const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
        if (!blob) throw new Error("No se pudo generar la imagen del comprobante.");
        const filePath = `${folioFinal}.png`;
        const { error: upErr } = await supabase.storage
          .from("comprobantes_certificados")
          .upload(filePath, blob, { upsert: true, contentType: "image/png" });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("comprobantes_certificados").getPublicUrl(filePath);

        const { error: fnError } = await supabase.functions.invoke("enviar-comprobante-whatsapp", {
          body: {
            telefono: telefono.trim(),
            folio: folioFinal,
            tutorNombre: `${tutorForm.nombre} ${tutorForm.a_paterno} ${tutorForm.a_materno}`.trim(),
            fechaCita,
            horaCita,
            comprobanteUrl: urlData.publicUrl,
            ubicacionUrl: UBICACION_MAPS_URL,
          },
        });
        if (fnError) throw fnError;
        setEstadoWhatsapp("ok");
      } catch (err) {
        console.error("Error enviando comprobante por WhatsApp:", err);
        setEstadoWhatsapp("error");
      }
    };
    enviar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso, folioFinal]);

  const generadoEn = new Date().toLocaleDateString("es-MX", {
    day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
  });

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100">

      {/* Ticket off-screen para PDF */}
      {folioFinal && (
        <TicketComprobante
          ref={ticketRef}
          folio={folioFinal}
          fecha={fechaCita}
          hora={horaCita}
          tutor={`${tutorForm.nombre} ${tutorForm.a_paterno} ${tutorForm.a_materno}`.trim()}
          curpTutor={tutorCurpDatos?.curp ?? ""}
          menores={menores}
          generadoEn={generadoEn}
          ubicacionUrl={UBICACION_MAPS_URL}
        />
      )}

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="bg-blue-900 sticky top-0 z-10 print:hidden">
        <div className="max-w-lg mx-auto px-4 py-3 flex items-center justify-between">
          <div>
            <p className="text-[9px] font-bold text-blue-300 uppercase tracking-[0.2em] leading-none mb-0.5">Beneficio Social</p>
            <h1 className="text-sm font-bold text-white leading-tight">Certificado Médico</h1>
          </div>
          {paso !== "confirmacion" && (
            <button
              onClick={() => navigate("/registro-certificado-medico/reagendar")}
              className="text-xs text-blue-200 hover:text-white transition-colors font-semibold bg-blue-800 hover:bg-blue-700 px-3 py-1.5 rounded-lg"
            >
              ¿Ya tienes cita?
            </button>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6">

        {/* Barra de progreso */}
        {paso !== "confirmacion" && <BarraProgreso paso={paso} />}

        {/* Banner de error de escaneo */}
        {errorEscaneo && (
          <div className="mb-4 rounded-2xl bg-red-50 border border-red-200 p-3.5 animate-fade-in-up">
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
                <svg className="w-3.5 h-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-red-800">Código no reconocido</p>
                <p className="text-xs text-red-600 mt-0.5 leading-relaxed">{errorEscaneo}</p>
                {textoEscaneadoCrudo && (
                  <div className="mt-2 rounded-xl bg-red-100/60 p-2.5">
                    <p className="text-[10px] text-red-500 mb-1 uppercase tracking-wide font-bold">Texto leído</p>
                    <p className="text-xs font-mono text-red-800 break-all select-all">{textoEscaneadoCrudo}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── PASO 1: Tutor scan ──────────────────────────────────────────── */}
        {paso === "tutor-scan" && (
          <div className="space-y-4 animate-fade-in-up">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Identifica al tutor</h2>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Escanea el código QR de la CURP del padre, madre o tutor legal.
                Puedes encontrarlo en la CURP impresa o descargada desde CURP en línea del gobierno.
              </p>
              <div className="mt-3 flex items-start gap-2.5 bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-3">
                <svg className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-xs text-slate-500 leading-relaxed">
                  ¿No cuentas con tu CURP? Puedes obtenerla de forma gratuita{" "}
                  <a href="https://www.gob.mx/curp/" target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-blue-700 font-bold hover:text-blue-900 transition-colors">
                    dando clic aquí
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                  </a>
                </p>
              </div>
            </div>

            {verificandoDuplicado ? (
              <Card className="p-8 flex flex-col items-center gap-3">
                <Spinner lg />
                <p className="text-sm font-bold text-slate-700">Verificando CURP</p>
                <p className="text-xs text-slate-400">Consultando registros anteriores…</p>
              </Card>
            ) : !tutorCurpDatos ? (
              <>
                {!scannerTutorActivo ? (
                  <BotonesEscanear
                    onClick={() => { setScannerTutorActivo(true); setErrorEscaneo(""); setTextoEscaneadoCrudo(""); }}
                    titulo="Escanear CURP del tutor"
                    subtitulo="Acerca el documento con el código QR a la cámara. La lectura es automática."
                    badge="Mayor de 18 años"
                  />
                ) : (
                  <div className="animate-fade-in-up">
                    <EscanerQR onScan={handleTutorScan} onCerrar={() => setScannerTutorActivo(false)} />
                  </div>
                )}
              </>
            ) : (
              <ConfirmarPersona
                datosCurp={tutorCurpDatos}
                form={tutorForm}
                setForm={setTutorForm}
                onConfirmar={confirmarTutor}
                onReescanear={() => setTutorCurpDatos(null)}
                error={errorTutor}
                edadMinima={18}
                textoRequisito="El tutor debe ser mayor de edad para registrar este beneficio."
              />
            )}
          </div>
        )}

        {/* ── PASO 2: Contacto ────────────────────────────────────────────── */}
        {paso === "contacto" && (
          <div className="space-y-4 animate-fade-in-up">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Datos de contacto</h2>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Solo pedimos los datos estrictamente necesarios para coordinar tu cita. No compartimos tu información.
              </p>
            </div>

            <Card className="divide-y divide-slate-100">
              <div className="px-4 py-4 space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Domicilio</p>
                <Campo label="Código Postal" required>
                  <InputField placeholder="Ej. 06600" maxLength={5} value={cp}
                    onChange={(e) => handleCodigoPostalChange(e.target.value)} />
                </Campo>
                <Campo label="Colonia" required>
                  <SelectField value={colonia} onChange={(e) => setColonia(e.target.value)}>
                    <option value="">{colonias.length ? "Selecciona tu colonia" : "Ingresa el C.P. primero"}</option>
                    {colonias.map((c, i) => <option key={i} value={c}>{c}</option>)}
                  </SelectField>
                </Campo>
              </div>

              <div className="px-4 py-4 space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Teléfono</p>
                <Campo label="Número de contacto (10 dígitos)" required>
                  <InputField type="tel" maxLength={10} placeholder="Ej. 5512345678" value={telefono}
                    onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ""))} />
                  {errorTelefono && <p className="text-xs text-red-600 font-bold mt-1">{errorTelefono}</p>}
                  <p className="text-xs text-slate-400 mt-1">Te enviaremos tu comprobante de cita por WhatsApp a este número.</p>
                </Campo>
              </div>

              <div className="px-4 py-4 space-y-3">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Menores a registrar</p>
                <Campo label="¿Cuántos menores recibirán el beneficio?" required>
                  <div className="flex items-center justify-center gap-4 py-1">
                    <button type="button" onClick={() => setNumMenores((n) => Math.max(1, n - 1))}
                      disabled={numMenores <= 1}
                      className="w-11 h-11 rounded-xl border border-slate-200 bg-white text-xl font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-colors">
                      −
                    </button>
                    <span className="text-2xl font-bold text-slate-900 w-8 text-center">{numMenores}</span>
                    <button type="button" onClick={() => setNumMenores((n) => Math.min(10, n + 1))}
                      disabled={numMenores >= 10}
                      className="w-11 h-11 rounded-xl border border-slate-200 bg-white text-xl font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-30 disabled:hover:bg-white transition-colors">
                      +
                    </button>
                  </div>
                </Campo>
                <div className="flex gap-2 bg-blue-50 border border-blue-100 rounded-xl p-3">
                  <svg className="w-3.5 h-3.5 text-blue-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs text-blue-700 leading-relaxed font-medium">
                    En el siguiente paso escanearás la CURP de cada menor. Solo aplica para menores de 15 años.
                  </p>
                </div>
              </div>

              <div className="px-4 py-3">
                <Btn type="button" v="primary" onClick={confirmarContacto} className="w-full justify-center">
                  Continuar <IcoArrow />
                </Btn>
              </div>
            </Card>
          </div>
        )}

        {/* ── PASO 3: Menores scan ─────────────────────────────────────────── */}
        {paso === "menores-scan" && (
          <div className="space-y-4 animate-fade-in-up">
            <div>
              <div className="flex items-baseline justify-between">
                <h2 className="text-lg font-bold text-slate-900">
                  Menor {menores.length + 1} de {numMenores}
                </h2>
                <span className="text-xs bg-blue-100 text-blue-800 font-bold px-2.5 py-1 rounded-full">
                  {menores.length}/{numMenores} completados
                </span>
              </div>
              <p className="text-sm text-slate-500 mt-1 leading-relaxed">
                Escanea el código QR de la CURP del menor. Cada menor debe tener su propia CURP.
              </p>
            </div>

            {menores.length > 0 && (
              <Card className="p-3.5">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2.5">Menores ya registrados</p>
                <div className="space-y-2">
                  {menores.map((m, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <div className="w-5 h-5 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                        <IcoCheck className="w-2.5 h-2.5 text-emerald-600" />
                      </div>
                      <p className="text-sm text-slate-700 font-semibold">
                        {m.nombre} {m.a_paterno} {m.a_materno}
                        <span className="text-slate-400 font-normal ml-1 text-xs">· {m.edad} años</span>
                      </p>
                    </div>
                  ))}
                </div>
              </Card>
            )}

            {verificandoDuplicado ? (
              <Card className="p-8 flex flex-col items-center gap-3">
                <Spinner lg />
                <p className="text-sm font-bold text-slate-700">Verificando CURP</p>
                <p className="text-xs text-slate-400">Un momento…</p>
              </Card>
            ) : !menorCurpDatos ? (
              <>
                {!scannerMenorActivo ? (
                  <BotonesEscanear
                    onClick={() => { setScannerMenorActivo(true); setErrorEscaneo(""); setTextoEscaneadoCrudo(""); }}
                    titulo={`Escanear CURP del menor ${menores.length + 1}`}
                    subtitulo="Acerca la CURP impresa o descargada del menor a la cámara."
                    badge="Menor de 15 años"
                  />
                ) : (
                  <div className="animate-fade-in-up">
                    <EscanerQR onScan={handleMenorScan} titulo="Escanea el código QR de la CURP del menor"
                      onCerrar={() => setScannerMenorActivo(false)} />
                  </div>
                )}
              </>
            ) : (
              <ConfirmarPersona
                datosCurp={menorCurpDatos}
                form={menorForm}
                setForm={setMenorForm}
                onConfirmar={confirmarMenorActual}
                onReescanear={() => setMenorCurpDatos(null)}
                error={errorMenor}
                edadMaxima={15}
                textoRequisito="Este beneficio es solo para menores de 15 años. Esta CURP no cumple el requisito."
              />
            )}
          </div>
        )}

        {/* ── PASO 4: Cita ─────────────────────────────────────────────────── */}
        {paso === "cita" && (
          <div className="space-y-4 animate-fade-in-up">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Elige tu horario</h2>
              <p className="text-sm text-slate-500 mt-1">
                Jueves 23 de julio · Jornada desde las 9:30 am · Una cita cada 10 minutos · Cupo total: {CUPO_TOTAL_DIA} citas.
              </p>
            </div>

            <Card className="px-4 py-3.5">
              <div className="flex items-start gap-2.5">
                <svg className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <div>
                  <p className="text-xs font-bold text-slate-700">Ubicación de la jornada</p>
                  <a href={UBICACION_MAPS_URL} target="_blank" rel="noreferrer"
                    className="text-xs text-blue-700 hover:underline font-semibold">
                    Ver ubicación en Google Maps →
                  </a>
                </div>
              </div>
            </Card>

            <Card className="divide-y divide-slate-100">
              <div className="px-4 py-4">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">
                  Horarios disponibles · {formatearFechaLarga(fechaCita)}
                </p>
                {cargandoOcupacion ? (
                  <div className="flex items-center gap-2.5 text-sm text-slate-400 py-3">
                    <Spinner /> Verificando disponibilidad…
                  </div>
                ) : totalOcupadosDia >= CUPO_TOTAL_DIA ? (
                  <p className="text-sm text-red-600 font-bold py-3">
                    Se agotaron las {CUPO_TOTAL_DIA} citas disponibles para este día.
                  </p>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                    {horarios.map((h) => {
                      const ocupados = ocupacion[h] ?? 0;
                      const lleno = ocupados >= CUPO_POR_SLOT;
                      const libres = CUPO_POR_SLOT - ocupados;
                      return (
                        <button key={h} type="button" disabled={lleno} onClick={() => setHoraCita(h)}
                          className={`flex flex-col items-center px-1.5 py-2 rounded-xl text-xs font-bold border transition-all ${
                            lleno
                              ? "bg-slate-50 text-slate-300 border-slate-100 cursor-not-allowed"
                              : horaCita === h
                              ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                              : "bg-white text-slate-700 border-slate-200 hover:border-emerald-400 hover:text-emerald-700"
                          }`}
                        >
                          <span>{h}</span>
                          <span className={`text-[9px] font-normal mt-0.5 ${
                            lleno ? "text-slate-300" : horaCita === h ? "text-emerald-100" : "text-slate-400"
                          }`}>
                            {lleno ? "Lleno" : `${libres} lib.`}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {horaCita && (
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2.5 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                    <IcoCheck className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    <p className="text-sm font-bold text-emerald-800">
                      {formatearFechaLarga(fechaCita)} · {horaCita} hrs
                    </p>
                  </div>
                </div>
              )}

              <div className="px-4 py-3">
                <Btn type="button" v="primary" disabled={!horaCita}
                  onClick={() => setPaso("encuesta")} className="w-full justify-center">
                  Continuar <IcoArrow />
                </Btn>
              </div>
            </Card>
          </div>
        )}

        {/* ── PASO 5: Encuesta ─────────────────────────────────────────────── */}
        {paso === "encuesta" && (
          <div className="space-y-4 animate-fade-in-up">
            <div>
              <h2 className="text-lg font-bold text-slate-900">Última pregunta</h2>
              <p className="text-sm text-slate-500 mt-1">
                Ya casi terminamos. Esta información nos ayuda a mejorar la difusión del programa.
              </p>
            </div>

            {/* Resumen rápido */}
            <Card className="px-4 py-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Tu registro hasta ahora</p>
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <IcoCheck className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold">Tutor:</span> {tutorForm.nombre} {tutorForm.a_paterno}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <IcoCheck className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold">{menores.length} menor{menores.length !== 1 ? "es" : ""}</span> registrado{menores.length !== 1 ? "s" : ""}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <IcoCheck className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                  <p className="text-xs text-slate-600">
                    <span className="font-semibold">Cita:</span> {formatearFechaLarga(fechaCita)} · {horaCita} hrs
                  </p>
                </div>
              </div>
            </Card>

            <Card className="divide-y divide-slate-100">
              <div className="px-4 py-4 space-y-2">
                <p className="text-sm font-bold text-slate-700 mb-3">¿Cómo te enteraste de este beneficio?</p>
                {[
                  { v: "REDES_SOCIALES", l: "Redes sociales", d: "Facebook, Instagram, etc.", icon: "📱" },
                  { v: "SM_INVITO",      l: "Una SM me invitó", d: "Promotora o trabajadora social", icon: "👤" },
                  { v: "OTRO",           l: "Otro medio", d: "Volante, periódico, conocido, etc.", icon: "💬" },
                ].map((op) => (
                  <label key={op.v} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                    comoSeEntero === op.v
                      ? "border-blue-400 bg-blue-50"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                  }`}>
                    <input type="radio" name="como_se_entero" checked={comoSeEntero === op.v}
                      onChange={() => setComoSeEntero(op.v)} className="sr-only" />
                    <span className="text-lg leading-none flex-shrink-0">{op.icon}</span>
                    <div className="flex-1">
                      <p className={`text-sm font-bold ${comoSeEntero === op.v ? "text-blue-800" : "text-slate-700"}`}>{op.l}</p>
                      <p className="text-xs text-slate-400">{op.d}</p>
                    </div>
                    {comoSeEntero === op.v && (
                      <div className="w-5 h-5 rounded-full bg-blue-700 flex items-center justify-center flex-shrink-0">
                        <IcoCheck className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </label>
                ))}

                {comoSeEntero === "OTRO" && (
                  <Campo label="¿Cómo específicamente?">
                    <InputField placeholder="Cuéntanos brevemente" value={comoSeEnteroOtro}
                      onChange={(e) => setComoSeEnteroOtro(e.target.value.toUpperCase())} />
                  </Campo>
                )}
              </div>

              {errorEnvio && (
                <div className="px-4 py-3 bg-red-50">
                  <p className="text-sm text-red-700 font-bold">{errorEnvio}</p>
                </div>
              )}

              <div className="px-4 py-3">
                <Btn type="button" v="primary" disabled={enviando} onClick={handleSubmit} className="w-full justify-center">
                  {enviando ? <><Spinner /> Guardando…</> : <>Confirmar registro <IcoArrow /></>}
                </Btn>
              </div>
            </Card>
          </div>
        )}

        {/* ── Confirmación ──────────────────────────────────────────────────── */}
        {paso === "confirmacion" && (
          <div className="space-y-4 animate-fade-in-up">

            {/* Hero */}
            <div className="text-center py-6 print:py-2">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4 print:hidden">
                <IcoCheck className="w-8 h-8 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">¡Registro confirmado!</h2>
              <p className="text-sm text-slate-500 mt-2 leading-relaxed max-w-xs mx-auto">
                Tu cita ha sido guardada exitosamente. Descarga o guarda tu comprobante.
              </p>
            </div>

            {/* Folio + QR en pantalla */}
            <Card className="p-5 text-center">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2">Número de folio</p>
              <p className="text-3xl font-mono font-bold text-blue-800 tracking-[0.18em] mb-5">{folioFinal}</p>
              <div className="flex justify-center">
                <div className="p-3.5 bg-white rounded-2xl border border-slate-200 shadow-sm inline-block">
                  <QRCodeSVG value={folioFinal} size={148} />
                </div>
              </div>
              <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                Presenta este QR en el módulo de atención el día de tu cita.
              </p>
              {estadoWhatsapp === "enviando" && (
                <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                  Enviando tu comprobante por WhatsApp al {telefono}…
                </p>
              )}
              {estadoWhatsapp === "ok" && (
                <p className="text-xs text-emerald-600 font-semibold mt-1 leading-relaxed">
                  ✔ También te lo enviamos por WhatsApp al {telefono}.
                </p>
              )}
              {estadoWhatsapp === "error" && (
                <p className="text-xs text-red-600 font-semibold mt-1 leading-relaxed">
                  No pudimos enviarlo por WhatsApp. Descarga el PDF abajo por si acaso.
                </p>
              )}
            </Card>

            {/* Detalle en pantalla */}
            <Card className="overflow-hidden">
              <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Resumen de tu registro</p>
              </div>
              <div className="divide-y divide-slate-100">
                <div className="px-4 py-3.5 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Cita</p>
                    <p className="text-sm font-bold text-slate-900 capitalize">{formatearFechaLarga(fechaCita)}</p>
                    <p className="text-sm text-slate-500">{horaCita} hrs</p>
                  </div>
                </div>
                <div className="px-4 py-3.5 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Ubicación</p>
                    <a href={UBICACION_MAPS_URL} target="_blank" rel="noreferrer"
                      className="text-sm font-bold text-blue-700 hover:underline">
                      Ver ubicación en Google Maps
                    </a>
                  </div>
                </div>
                <div className="px-4 py-3.5 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-0.5">Tutor</p>
                    <p className="text-sm font-bold text-slate-900">{tutorForm.nombre} {tutorForm.a_paterno} {tutorForm.a_materno}</p>
                    <p className="text-xs font-mono text-slate-400 mt-0.5">{tutorCurpDatos?.curp}</p>
                  </div>
                </div>
                <div className="px-4 py-3.5 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0 mt-0.5">
                    <svg className="w-3.5 h-3.5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wide mb-1">Menores ({menores.length})</p>
                    <div className="space-y-1">
                      {menores.map((m, i) => (
                        <p key={i} className="text-sm text-slate-700">
                          {m.nombre} {m.a_paterno} {m.a_materno}
                          <span className="text-xs text-slate-400 ml-1">· {m.edad} años</span>
                        </p>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            {/* Recomendaciones en pantalla */}
            <Card className="overflow-hidden">
              <div className="px-4 py-3 bg-amber-50 border-b border-amber-100">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">Qué debes traer el día de tu cita</p>
              </div>
              <div className="px-4 py-3.5 space-y-2">
                {[
                  "Llega 15 minutos antes de tu horario.",
                  "Este comprobante (impreso o en tu celular).",
                  "CURP original del tutor (papel o digital).",
                  "CURP original de cada menor beneficiario.",
                  "Los menores deben acudir con el tutor registrado.",
                ].map((rec, i) => (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className="w-4 h-4 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0 mt-0.5">
                      <IcoCheck className="w-2.5 h-2.5 text-amber-600" />
                    </div>
                    <p className="text-xs text-slate-600 leading-relaxed">{rec}</p>
                  </div>
                ))}
              </div>
            </Card>

            {/* Acciones */}
            <div className="space-y-2.5 print:hidden pb-8">
              {/* PDF */}
              <Btn type="button" v="primary" onClick={generarComprobantePDF}
                disabled={generandoPDF} className="w-full justify-center py-3">
                {generandoPDF ? (
                  <><Spinner /> Generando PDF…</>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Descargar comprobante PDF
                  </>
                )}
              </Btn>

              <Btn type="button" v="ghost"
                onClick={() => { window.location.href = "/registro-certificado-medico"; }}
                className="w-full justify-center text-xs">
                Registrar otro beneficiario
              </Btn>
            </div>

          </div>
        )}
      </main>
    </div>
  );
};

export default RegistroCertificadoMedico;
