import React, { useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";
import supabase, { supabaseStorage as supabaseAdmin } from "../supabase/client";
import EscanerQR from "../componentes/EscanerQR";
import codigosPostalesData from "../codigospostales.json";
import { datosDesdeTextoQR, parseCurp } from "../utils/curp";

// ── Helpers ────────────────────────────────────────────────────────────────────
const CURP_REGEX =
  /^[A-Z][AEIOUX][A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HM](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QO|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d$/;

const getPeriodo = (frecuencia) => {
  if (frecuencia !== "SEMANAL") return "UNICA";
  const now = new Date();
  const t = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const d = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - d);
  const ys = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const wn = Math.ceil((((t - ys) / 86400000) + 1) / 7);
  return `${t.getUTCFullYear()}-W${String(wn).padStart(2, "0")}`;
};

const nombreCompleto = (r) =>
  `${r.nombre ?? ""} ${r.a_paterno ?? ""} ${r.a_materno ?? ""}`.trim();

// ── UI Atoms ───────────────────────────────────────────────────────────────────
const Btn = ({ children, v = "primary", className = "", ...p }) => {
  const base =
    "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold transition-all " +
    "active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-1";
  const vs = {
    primary: "bg-blue-800 text-white hover:bg-blue-900 shadow-sm focus:ring-blue-700",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm focus:ring-emerald-500",
    ghost:   "text-slate-500 hover:text-slate-800 hover:bg-slate-100 focus:ring-slate-400",
  };
  return <button {...p} className={`${base} ${vs[v]} ${className}`}>{children}</button>;
};

const Campo = ({ label, children }) => (
  <div className="space-y-1">
    <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
      {label}
    </label>
    {children}
  </div>
);

const CampoReq = ({ label, children }) => (
  <div className="space-y-1">
    <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
      {label}<span className="text-red-500">*</span>
    </label>
    {children}
  </div>
);

const Inp = ({ className = "", ...p }) => (
  <input
    {...p}
    className={
      "w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 " +
      "placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2 " +
      `focus:ring-blue-500/20 focus:border-blue-500 transition-all ${className}`
    }
  />
);

const Sel = ({ children, ...p }) => (
  <select
    {...p}
    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
  >
    {children}
  </select>
);

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>
    {children}
  </div>
);

const ErrBox = ({ msg }) =>
  msg ? (
    <div className="flex gap-2 bg-red-50 border border-red-100 rounded-xl p-3">
      <svg className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" />
      </svg>
      <p className="text-sm text-red-700">{msg}</p>
    </div>
  ) : null;

const Spinner = () => (
  <div className="w-4 h-4 rounded-full border-[3px] border-blue-700 border-t-transparent animate-spin flex-shrink-0" />
);

// ── Slug helper ────────────────────────────────────────────────────────────────
const toSlug = (nombre) =>
  nombre.toLowerCase()
    .normalize("NFD").replace(/\p{Mn}/gu, "")
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "");

// ── Barra de progreso ──────────────────────────────────────────────────────────
const PASOS = [
  { key: "id",       label: "Identidad" },
  { key: "apoyos",   label: "Apoyos" },
  { key: "encuesta", label: "Encuesta" },
  { key: "listo",    label: "Listo" },
];
const PASOS_SLUG = [
  { key: "id",       label: "Identidad" },
  { key: "encuesta", label: "Registro" },
  { key: "listo",    label: "Listo" },
];
const pasoBar = (paso) => (paso === "contacto" ? "id" : paso);

const BarraProgreso = ({ paso, slugMode }) => {
  const lista = slugMode ? PASOS_SLUG : PASOS;
  const actual = pasoBar(paso);
  const idx = lista.findIndex((p) => p.key === actual);
  if (idx === -1) return null;
  return (
    <div className="mb-4">
      <div className="flex items-center">
        {lista.map((p, i) => (
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
            {i < lista.length - 1 && (
              <div className={`flex-1 h-0.5 mx-1 mb-4 sm:mb-5 transition-all duration-500 ${i < idx ? "bg-blue-700" : "bg-slate-200"}`} />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

// ── Autocomplete de SM ─────────────────────────────────────────────────────────
const AutocompleteSM = ({ sms, valor, onChange, smSel, onSelect, onLimpiar }) => {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  const sugerencias = sms
    .filter((sm) => {
      if (!valor.trim()) return false;
      const q = valor.toLowerCase();
      return (
        nombreCompleto(sm).toLowerCase().includes(q) ||
        String(sm.seccion ?? "").includes(q) ||
        String(sm.ubt ?? "").includes(q)
      );
    })
    .slice(0, 8);

  useEffect(() => {
    const cerrar = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener("mousedown", cerrar);
    return () => document.removeEventListener("mousedown", cerrar);
  }, []);

  if (smSel) {
    return (
      <div className="flex items-center gap-3 bg-blue-50 border-2 border-blue-300 rounded-xl px-3.5 py-3">
        <div className="w-9 h-9 rounded-full bg-blue-800 flex items-center justify-center text-xs font-black text-white flex-shrink-0">
          {(smSel.nombre?.[0] ?? "") + (smSel.a_paterno?.[0] ?? "")}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-blue-900 truncate">{nombreCompleto(smSel)}</p>
          <p className="text-[10px] text-blue-600">
            Sección {smSel.seccion} · Fracción {smSel.ubt}
          </p>
        </div>
        <button
          type="button"
          onClick={onLimpiar}
          className="text-blue-400 hover:text-blue-700 font-bold text-lg leading-none px-1"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <Inp
        placeholder="Escribe el nombre de la SM..."
        value={valor}
        onChange={(e) => { onChange(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        autoComplete="off"
      />
      {abierto && sugerencias.length > 0 && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {sugerencias.map((sm) => (
            <button
              key={sm.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onSelect(sm); setAbierto(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-left transition-colors border-b border-slate-50 last:border-0"
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-black text-blue-700 flex-shrink-0">
                {(sm.nombre?.[0] ?? "") + (sm.a_paterno?.[0] ?? "")}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{nombreCompleto(sm)}</p>
                <p className="text-[10px] text-slate-400">
                  Sección {sm.seccion} · Fracción {sm.ubt}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
      {abierto && valor.trim().length > 1 && sugerencias.length === 0 && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3">
          <p className="text-sm text-slate-400">Sin resultados para "{valor}"</p>
        </div>
      )}
    </div>
  );
};

// ── Componente principal ───────────────────────────────────────────────────────
export default function RegistroApoyos() {
  const { slug } = useParams();
  const slugMode = !!slug;

  // Navegación
  const [paso,  setPaso]  = useState("id");
  const [subId, setSubId] = useState("inicio");

  // Identidad
  const [datosCurp,          setDatosCurp]          = useState(null);
  const [form,               setForm]               = useState({ nombre: "", a_paterno: "", a_materno: "" });
  const [manualCurp,         setManualCurp]         = useState("");
  const [ciudadanoExistente, setCiudadanoExistente] = useState(undefined);
  const [esNuevo,            setEsNuevo]            = useState(false);
  const [verificando,        setVerificando]        = useState(false);

  // Contacto
  const [contacto, setContacto] = useState({
    telefono: "", seccion: "",
    c_p: "", col_loc: "",
    calle: "", n_ext_mz: "", n_int_lt: "", n_casa: "",
  });
  const [colonias, setColonias] = useState([]);

  // Programas + cantidades
  const [programas,     setProgramas]     = useState([]);
  const [seleccionados, setSeleccionados] = useState(new Set());
  const [cantidades,    setCantidades]    = useState({});   // { programId: number }
  const [yaRegistrados, setYaRegistrados] = useState(new Set());

  // Encuesta
  const [comoSeEntero, setComoSeEntero] = useState("");
  const [otroTexto,    setOtroTexto]    = useState("");
  const [formaPago,    setFormaPago]    = useState("");
  const [sms,          setSms]          = useState([]);
  const [smQuery,      setSmQuery]      = useState("");
  const [smSel,        setSmSel]        = useState(null);

  // UI
  const [guardando,         setGuardando]         = useState(false);
  const [descargando,       setDescargando]       = useState(false);
  const [error,             setError]             = useState("");
  const [folioId,           setFolioId]           = useState(null);
  const [programasCargados, setProgramasCargados] = useState(false);
  const comprobanteRef = useRef(null);

  // Cargar programas activos (supabaseAdmin bypasses RLS en programas_sociales)
  useEffect(() => {
    supabaseAdmin
      .from("programas_sociales")
      .select("*")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => {
        const lista = data ?? [];
        setProgramas(lista);
        setProgramasCargados(true);
        if (slug) {
          const prog = lista.find((p) => toSlug(p.nombre) === slug);
          if (prog) {
            setSeleccionados(new Set([prog.id]));
            setCantidades({ [prog.id]: 1 });
          }
        }
      });
  }, [slug]);

  // Cargar SM activas
  useEffect(() => {
    supabase
      .from("ciudadania")
      .select("id, usuario, nombre, a_paterno, a_materno, seccion, ubt, poligono, dtto_fed, dtto_loc")
      .eq("puesto", "SM")
      .eq("status", "ACTIVO")
      .order("a_paterno")
      .then(({ data }) => setSms(data ?? []));
  }, []);

  // Colonias al cambiar CP — codigosPostalesData es un array de objetos con d_codigo y d_asenta
  useEffect(() => {
    if (contacto.c_p?.length === 5) {
      const list = codigosPostalesData
        .filter((loc) => String(loc.d_codigo) === contacto.c_p)
        .map((loc) => loc.d_asenta);
      setColonias(list);
      setContacto((c) => ({ ...c, col_loc: list[0] ?? "" }));
    }
  }, [contacto.c_p]);

  // ── Identificación ────────────────────────────────────────────────────────────
  const handleQRScan = (rawText) => {
    const datos = datosDesdeTextoQR(rawText);
    if (!datos) {
      setError("No se pudo leer la CURP del código QR. Intenta de nuevo o ingresa los datos manualmente.");
      setSubId("inicio");
      return;
    }
    setError("");
    setDatosCurp(datos);
    setForm({ nombre: datos.nombre, a_paterno: datos.aPaterno, a_materno: datos.aMaterno });
    setSubId("confirmar");
    verificarEnBD(datos.curp);
  };

  const handleManualSubmit = () => {
    const curp = manualCurp.trim().toUpperCase();
    if (!CURP_REGEX.test(curp)) {
      setError("La CURP no tiene el formato correcto. Verifícala e inténtalo de nuevo.");
      return;
    }
    const datos = parseCurp(curp);
    if (!datos) {
      setError("La fecha de nacimiento codificada en la CURP no es válida.");
      return;
    }
    setError("");
    setDatosCurp(datos);
    setSubId("confirmar");
    verificarEnBD(curp);
  };

  const verificarEnBD = async (curp) => {
    setVerificando(true);
    try {
      // supabaseAdmin bypasses RLS so el SELECT devuelve datos aunque la política anon bloquee
      const { data } = await supabaseAdmin
        .from("ciudadania")
        .select("*")
        .eq("curp", curp)
        .maybeSingle();

      setCiudadanoExistente(data ?? null);

      if (data) {
        setForm({ nombre: data.nombre ?? "", a_paterno: data.a_paterno ?? "", a_materno: data.a_materno ?? "" });
        setEsNuevo(false);
        const { data: entregas } = await supabaseAdmin
          .from("apoyo_entregas")
          .select("programa_id, status, periodo")
          .eq("beneficiario_id", data.id);
        const bloqueados = new Set();
        (entregas ?? []).forEach((e) => {
          if (e.periodo === "UNICA" && (e.status === "ENTREGADO" || e.status === "PENDIENTE"))
            bloqueados.add(e.programa_id);
        });
        setYaRegistrados(bloqueados);
      } else {
        setEsNuevo(true);
        setYaRegistrados(new Set());
      }
    } finally {
      setVerificando(false);
    }
  };

  const confirmarPersona = () => {
    if (!form.nombre.trim() || !form.a_paterno.trim()) {
      setError("Completa el nombre y al menos el apellido paterno.");
      return;
    }
    if (ciudadanoExistente && ciudadanoExistente.puesto !== "BENEFICIARIO") {
      setError(`Esta persona está registrada con el perfil "${ciudadanoExistente.puesto}". Acércate a la oficina para más información.`);
      return;
    }
    setError("");
    if (esNuevo) {
      setPaso("contacto");
    } else {
      setPaso(slugMode ? "encuesta" : "apoyos");
    }
  };

  const confirmarContacto = () => {
    if (!/^\d{10}$/.test(contacto.telefono.trim())) {
      setError("El número de teléfono debe tener exactamente 10 dígitos.");
      return;
    }
    if (contacto.seccion && !/^\d{4}$/.test(contacto.seccion.trim())) {
      setError("La sección electoral debe tener 4 dígitos.");
      return;
    }
    if (!contacto.calle.trim()) {
      setError("Ingresa el nombre de la calle.");
      return;
    }
    if (!contacto.n_ext_mz.trim()) {
      setError("Ingresa el número exterior o manzana.");
      return;
    }
    if (!contacto.n_int_lt.trim()) {
      setError("Ingresa el número interior o lote.");
      return;
    }
    setError("");
    setPaso(slugMode ? "encuesta" : "apoyos");
  };

  // ── Programas ─────────────────────────────────────────────────────────────────
  const togglePrograma = (id) => {
    setSeleccionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        setCantidades((c) => { const n = { ...c }; delete n[id]; return n; });
      } else {
        next.add(id);
        setCantidades((c) => ({ ...c, [id]: 1 }));
      }
      return next;
    });
  };

  const setCantidad = (id, val) => {
    const n = Math.max(1, Number(val) || 1);
    setCantidades((c) => ({ ...c, [id]: n }));
  };

  const confirmarApoyos = () => {
    if (seleccionados.size === 0) {
      setError("Selecciona al menos un apoyo para continuar.");
      return;
    }
    setError("");
    setPaso("encuesta");
  };

  // Detecta si alguno de los programas seleccionados es calentador solar
  const esCalentador = programas.some(
    (p) => seleccionados.has(p.id) && p.nombre.toLowerCase().includes("calentador")
  );

  const confirmarEncuesta = () => {
    if (!comoSeEntero) {
      setError("Indica cómo se enteró del programa.");
      return;
    }
    if (comoSeEntero === "SM_INVITO" && !smSel) {
      setError("Selecciona la Seguidora de Manzana que le invitó.");
      return;
    }
    if (comoSeEntero === "OTRO" && !otroTexto.trim()) {
      setError("Describe por qué otro medio se enteró.");
      return;
    }
    if (esCalentador && !formaPago) {
      setError("Indica la forma de pago del calentador solar.");
      return;
    }
    setError("");
    guardar();
  };

  // ── Guardar ───────────────────────────────────────────────────────────────────
  const guardar = async () => {
    setGuardando(true);
    try {
      // Resolución de territorio
      // Prioridad: sección ingresada > sección de la SM seleccionada
      const seccionFinal = contacto.seccion
        ? Number(contacto.seccion)
        : smSel?.seccion ?? null;

      let territorio = {};
      if (seccionFinal) {
        const { data: cat } = await supabase
          .from("ubt_catalogo")
          .select("dtto_fed, dtto_loc, poligono, nombre_municipio, municipio")
          .eq("seccion", seccionFinal)
          .limit(1)
          .maybeSingle();
        if (cat) {
          territorio = {
            dtto_fed: cat.dtto_fed ?? null,
            dtto_loc: cat.dtto_loc ?? null,
            poligono: cat.poligono ?? null,
          };
        }
      }

      // Si no se obtuvo territorio del catálogo, hereda el de la SM
      if (!territorio.dtto_fed && smSel) {
        territorio = {
          dtto_fed: smSel.dtto_fed ?? null,
          dtto_loc: smSel.dtto_loc ?? null,
          poligono: smSel.poligono ?? null,
        };
      }

      // ── Buscar o crear ciudadano — siempre con service role, nunca depende de esNuevo ──
      // Verificación directa en BD para obtener el id real sin depender del estado de React
      const { data: enBD } = await supabaseAdmin
        .from("ciudadania")
        .select("id, movilizador, seccion, dtto_fed")
        .eq("curp", datosCurp.curp)
        .maybeSingle();

      let beneficiarioId;

      if (enBD) {
        // Ya existe — usar su id y completar campos vacíos
        beneficiarioId = enBD.id;
        const act = {};
        if (smSel && !enBD.movilizador) {
          act.movilizador = smSel.usuario;
          act.ubt         = smSel.ubt ?? null;
        }
        if (seccionFinal && !enBD.seccion) act.seccion = seccionFinal;
        if (!enBD.dtto_fed && territorio.dtto_fed) Object.assign(act, territorio);
        if (Object.keys(act).length > 0)
          await supabaseAdmin.from("ciudadania").update(act).eq("id", beneficiarioId);
      } else {
        // Nuevo ciudadano — upsert onConflict curp para obtener el id de forma confiable
        const { data: nuevo, error: ie } = await supabaseAdmin
          .from("ciudadania")
          .upsert(
            [{
              curp:       datosCurp.curp,
              nombre:     form.nombre.trim().toUpperCase(),
              a_paterno:  form.a_paterno.trim().toUpperCase(),
              a_materno:  form.a_materno.trim().toUpperCase(),
              telefono_1: contacto.telefono  || null,
              c_p:        contacto.c_p       || null,
              col_loc:    contacto.col_loc   || null,
              calle:      contacto.calle     || null,
              n_ext_mz:   contacto.n_ext_mz  || null,
              n_int_lt:   contacto.n_int_lt  || null,
              n_casa:     contacto.n_casa    || null,
              seccion:    seccionFinal,
              ubt:        smSel?.ubt         ?? null,
              movilizador: smSel?.usuario    ?? null,
              puesto:     "BENEFICIARIO",
              status:     "ACTIVO",
              ingreso_estructura: new Date().toISOString().split("T")[0],
              ...territorio,
            }],
            { onConflict: "curp" }
          )
          .select("id")
          .single();
        if (ie) throw ie;
        beneficiarioId = nuevo.id;
      }

      if (!beneficiarioId) throw new Error("No se pudo obtener el folio del beneficiario.");

      // Registrar solicitudes por programa seleccionado
      const programasSel = programas.filter((p) => seleccionados.has(p.id));
      for (const prog of programasSel) {
        const esCalentadorProg = prog.nombre.toLowerCase().includes("calentador");
        const { error: ue } = await supabaseAdmin
          .from("apoyo_entregas")
          .upsert(
            {
              beneficiario_id: beneficiarioId,
              programa_id:     prog.id,
              periodo:         getPeriodo(prog.frecuencia),
              status:          "PENDIENTE",
              cantidad:        cantidades[prog.id] ?? 1,
              ...(esCalentadorProg && formaPago ? { forma_pago: formaPago } : {}),
            },
            { onConflict: "beneficiario_id,programa_id,periodo", ignoreDuplicates: true }
          );
        if (ue) throw ue;
      }

      setFolioId(beneficiarioId);
      setPaso("listo");
    } catch (e) {
      setError(e.message || "Error al guardar el registro. Intenta de nuevo.");
    } finally {
      setGuardando(false);
    }
  };

  // ── Reiniciar ─────────────────────────────────────────────────────────────────
  const reiniciar = () => {
    setPaso("id");
    setSubId("inicio");
    setDatosCurp(null);
    setForm({ nombre: "", a_paterno: "", a_materno: "" });
    setManualCurp("");
    setCiudadanoExistente(undefined);
    setEsNuevo(false);
    setContacto({ telefono: "", seccion: "", c_p: "", col_loc: "", calle: "", n_ext_mz: "", n_int_lt: "", n_casa: "" });
    setColonias([]);
    setSeleccionados(new Set());
    setCantidades({});
    setYaRegistrados(new Set());
    setComoSeEntero("");
    setOtroTexto("");
    setSmQuery("");
    setSmSel(null);
    setError("");
    setFolioId(null);
  };

  // ── Descargar comprobante PDF ─────────────────────────────────────────────────
  const descargarPDF = async () => {
    if (!comprobanteRef.current) return;
    setDescargando(true);
    try {
      const canvas = await html2canvas(comprobanteRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        logging: false,
      });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const margin = 24;
      const imgWidth = pageWidth - margin * 2;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      pdf.addImage(imgData, "JPEG", margin, margin, imgWidth, imgHeight);
      const folio = String(folioId ?? "").padStart(6, "0");
      pdf.save(`comprobante-apoyo-${folio}.pdf`);
    } catch (err) {
      console.error("Error generando PDF:", err);
    } finally {
      setDescargando(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-blue-800 text-white px-4 py-5 shadow-md">
        <div className="max-w-lg mx-auto">
          <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300 mb-0.5">
            Apoyos Sociales
          </p>
          <h1 className="text-xl font-black tracking-tight">
            {slugMode && programas.find((p) => toSlug(p.nombre) === slug)
              ? programas.find((p) => toSlug(p.nombre) === slug).nombre
              : "Registro de Apoyos"}
          </h1>
          {!slugMode && (
            <p className="text-xs text-blue-200 mt-0.5">
              Tinaco · Calentador Solar · Mercado Solidario
            </p>
          )}
        </div>
      </header>

      <main className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {paso !== "listo" && <BarraProgreso paso={paso} slugMode={slugMode} />}

        {/* ════════ IDENTIDAD ══════════════════════════════════════════════ */}

        {paso === "id" && subId === "inicio" && (
          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="text-base font-black text-slate-900 mb-1">¿Cómo quieres identificarte?</h2>
              <p className="text-xs text-slate-500 mb-5">
                Necesitamos tu CURP para registrarte. Puedes escanear el código QR de
                tu credencial o escribir tus datos manualmente.
              </p>
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setSubId("qr-scan")}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100 transition-all text-left"
                >
                  <div className="w-12 h-12 bg-blue-800 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 013.75 9.375v-4.5zM3.75 14.625c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5a1.125 1.125 0 01-1.125-1.125v-4.5zM13.5 4.875c0-.621.504-1.125 1.125-1.125h4.5c.621 0 1.125.504 1.125 1.125v4.5c0 .621-.504 1.125-1.125 1.125h-4.5A1.125 1.125 0 0113.5 9.375v-4.5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75h.75v.75h-.75v-.75zM6.75 16.5h.75v.75h-.75v-.75zM16.5 6.75h.75v.75h-.75v-.75zM13.5 13.5h.75v.75h-.75v-.75zM13.5 19.5h.75v.75h-.75v-.75zM19.5 13.5h.75v.75h-.75v-.75zM19.5 19.5h.75v.75h-.75v-.75zM16.5 16.5h.75v.75h-.75v-.75z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-blue-900">Escanear código QR</p>
                    <p className="text-xs text-blue-600 mt-0.5">Rápido — se leen los datos automáticamente</p>
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setSubId("manual")}
                  className="w-full flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 transition-all text-left"
                >
                  <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                    <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-sm font-bold text-slate-800">Ingresar datos manualmente</p>
                    <p className="text-xs text-slate-500 mt-0.5">Escribe el nombre y la CURP</p>
                  </div>
                </button>
              </div>
            </Card>
            {error && <ErrBox msg={error} />}
          </div>
        )}

        {paso === "id" && subId === "qr-scan" && (
          <EscanerQR
            titulo="Escanea el código QR de tu credencial"
            onScan={handleQRScan}
            onCerrar={() => { setError(""); setSubId("inicio"); }}
          />
        )}

        {paso === "id" && subId === "manual" && (
          <Card className="p-5 space-y-4">
            <div>
              <h2 className="text-base font-black text-slate-900 mb-1">Ingresa los datos</h2>
              <p className="text-xs text-slate-500">La CURP tiene 18 caracteres y aparece en documentos oficiales.</p>
            </div>
            <CampoReq label="CURP">
              <Inp
                placeholder="XXXX000000XXXXXX00"
                value={manualCurp}
                maxLength={18}
                onChange={(e) => setManualCurp(e.target.value.toUpperCase())}
                className="font-mono tracking-widest"
              />
            </CampoReq>
            <CampoReq label="Nombre(s)">
              <Inp
                placeholder="Nombre(s)"
                value={form.nombre}
                onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value.toUpperCase() }))}
              />
            </CampoReq>
            <div className="grid grid-cols-2 gap-2">
              <CampoReq label="A. Paterno">
                <Inp
                  placeholder="Paterno"
                  value={form.a_paterno}
                  onChange={(e) => setForm((f) => ({ ...f, a_paterno: e.target.value.toUpperCase() }))}
                />
              </CampoReq>
              <Campo label="A. Materno">
                <Inp
                  placeholder="Materno"
                  value={form.a_materno}
                  onChange={(e) => setForm((f) => ({ ...f, a_materno: e.target.value.toUpperCase() }))}
                />
              </Campo>
            </div>
            {error && <ErrBox msg={error} />}
            <div className="flex gap-2 pt-1">
              <Btn onClick={handleManualSubmit}>Verificar CURP →</Btn>
              <Btn v="ghost" onClick={() => { setError(""); setSubId("inicio"); }}>← Volver</Btn>
            </div>
          </Card>
        )}

        {paso === "id" && subId === "confirmar" && (
          verificando ? (
            <Card className="p-6 flex items-center gap-3">
              <Spinner />
              <p className="text-sm text-slate-600">Verificando información en el sistema...</p>
            </Card>
          ) : (
            <Card className="overflow-hidden">
              <div className={`px-4 py-3.5 border-b ${
                ciudadanoExistente?.puesto && ciudadanoExistente.puesto !== "BENEFICIARIO"
                  ? "bg-red-50 border-red-100"
                  : ciudadanoExistente ? "bg-amber-50 border-amber-100"
                  : "bg-emerald-50 border-emerald-100"
              }`}>
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                    ciudadanoExistente?.puesto && ciudadanoExistente.puesto !== "BENEFICIARIO"
                      ? "bg-red-100" : ciudadanoExistente ? "bg-amber-100" : "bg-emerald-100"
                  }`}>
                    {ciudadanoExistente?.puesto && ciudadanoExistente.puesto !== "BENEFICIARIO" ? (
                      <svg className="w-3.5 h-3.5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
                    ) : ciudadanoExistente ? (
                      <svg className="w-3.5 h-3.5 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v4m0 4h.01M12 3a9 9 0 110 18A9 9 0 0112 3z" /></svg>
                    ) : (
                      <svg className="w-3.5 h-3.5 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                    )}
                  </div>
                  <div>
                    <p className={`text-[10px] font-bold uppercase tracking-widest ${
                      ciudadanoExistente?.puesto && ciudadanoExistente.puesto !== "BENEFICIARIO"
                        ? "text-red-600" : ciudadanoExistente ? "text-amber-700" : "text-emerald-700"
                    }`}>
                      {ciudadanoExistente?.puesto && ciudadanoExistente.puesto !== "BENEFICIARIO"
                        ? "Perfil no elegible"
                        : ciudadanoExistente ? "Ya registrado en el sistema"
                        : "CURP verificada · Persona nueva"}
                    </p>
                    <p className="font-mono text-sm font-bold text-slate-800 mt-0.5">{datosCurp?.curp}</p>
                    <p className="text-xs text-slate-500">{datosCurp?.edad} años · {datosCurp?.sexo ?? "—"}</p>
                  </div>
                </div>
              </div>

              <div className="px-4 py-4 space-y-3">
                {ciudadanoExistente?.puesto && ciudadanoExistente.puesto !== "BENEFICIARIO" ? (
                  <>
                    <ErrBox msg={`Esta persona está registrada como "${ciudadanoExistente.puesto}". Acércate a la oficina para más información.`} />
                    <Btn v="ghost" onClick={() => { setError(""); setDatosCurp(null); setSubId("inicio"); }}>← Volver al inicio</Btn>
                  </>
                ) : (
                  <>
                    {ciudadanoExistente && (
                      <div className="flex gap-2 bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5">
                        <svg className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                        </svg>
                        <p className="text-xs text-amber-700">Esta persona ya tiene un registro previo. Puedes agregarle nuevos apoyos.</p>
                      </div>
                    )}
                    <p className="text-xs text-slate-500">Verifica que el nombre sea correcto antes de continuar.</p>
                    <CampoReq label="Nombre(s)">
                      <Inp value={form.nombre} readOnly={!!ciudadanoExistente}
                        className={ciudadanoExistente ? "bg-slate-50 text-slate-600" : ""}
                        onChange={(e) => setForm((f) => ({ ...f, nombre: e.target.value.toUpperCase() }))} />
                    </CampoReq>
                    <div className="grid grid-cols-2 gap-2">
                      <CampoReq label="A. Paterno">
                        <Inp value={form.a_paterno} readOnly={!!ciudadanoExistente}
                          className={ciudadanoExistente ? "bg-slate-50 text-slate-600" : ""}
                          onChange={(e) => setForm((f) => ({ ...f, a_paterno: e.target.value.toUpperCase() }))} />
                      </CampoReq>
                      <Campo label="A. Materno">
                        <Inp value={form.a_materno} readOnly={!!ciudadanoExistente}
                          className={ciudadanoExistente ? "bg-slate-50 text-slate-600" : ""}
                          onChange={(e) => setForm((f) => ({ ...f, a_materno: e.target.value.toUpperCase() }))} />
                      </Campo>
                    </div>
                    {error && <ErrBox msg={error} />}
                    <div className="flex gap-2 pt-1">
                      <Btn v="success" onClick={confirmarPersona}>Confirmar y continuar →</Btn>
                      <Btn v="ghost" onClick={() => { setError(""); setDatosCurp(null); setSubId("inicio"); }}>← Volver</Btn>
                    </div>
                  </>
                )}
              </div>
            </Card>
          )
        )}

        {/* ════════ CONTACTO ════════════════════════════════════════════════ */}
        {paso === "contacto" && (
          <Card className="p-5 space-y-4">
            <div>
              <h2 className="text-base font-black text-slate-900 mb-1">Datos de contacto</h2>
              <p className="text-xs text-slate-500">Te contactaremos cuando tu apoyo esté listo para entrega.</p>
            </div>
            <CampoReq label="Teléfono">
              <Inp
                placeholder="10 dígitos"
                value={contacto.telefono}
                maxLength={10}
                inputMode="numeric"
                onChange={(e) => setContacto((c) => ({ ...c, telefono: e.target.value.replace(/\D/g, "") }))}
              />
            </CampoReq>
            <Campo label="Sección electoral">
              <Inp
                placeholder="4 dígitos"
                value={contacto.seccion}
                maxLength={4}
                inputMode="numeric"
                onChange={(e) => setContacto((c) => ({ ...c, seccion: e.target.value.replace(/\D/g, "") }))}
              />
            </Campo>
            <Campo label="Código postal">
              <Inp
                placeholder="5 dígitos"
                value={contacto.c_p}
                maxLength={5}
                inputMode="numeric"
                onChange={(e) => setContacto((c) => ({ ...c, c_p: e.target.value.replace(/\D/g, "") }))}
              />
            </Campo>
            <Campo label="Colonia / Localidad">
              {colonias.length > 0 ? (
                <Sel value={contacto.col_loc} onChange={(e) => setContacto((c) => ({ ...c, col_loc: e.target.value }))}>
                  <option value="">Selecciona...</option>
                  {colonias.map((col) => <option key={col} value={col}>{col}</option>)}
                </Sel>
              ) : (
                <Inp
                  placeholder="Colonia o localidad"
                  value={contacto.col_loc}
                  onChange={(e) => setContacto((c) => ({ ...c, col_loc: e.target.value.toUpperCase() }))}
                />
              )}
            </Campo>
            <CampoReq label="Calle">
              <Inp
                placeholder="Nombre de la calle"
                value={contacto.calle}
                onChange={(e) => setContacto((c) => ({ ...c, calle: e.target.value.toUpperCase() }))}
              />
            </CampoReq>
            <div className="grid grid-cols-3 gap-2">
              <CampoReq label="N° Ext / Mz">
                <Inp
                  placeholder="Ej. 12"
                  value={contacto.n_ext_mz}
                  onChange={(e) => setContacto((c) => ({ ...c, n_ext_mz: e.target.value.toUpperCase() }))}
                />
              </CampoReq>
              <CampoReq label="N° Int / Lt">
                <Inp
                  placeholder="Ej. 3"
                  value={contacto.n_int_lt}
                  onChange={(e) => setContacto((c) => ({ ...c, n_int_lt: e.target.value.toUpperCase() }))}
                />
              </CampoReq>
              <Campo label="N° Casa">
                <Inp
                  placeholder="Opcional"
                  value={contacto.n_casa}
                  onChange={(e) => setContacto((c) => ({ ...c, n_casa: e.target.value.toUpperCase() }))}
                />
              </Campo>
            </div>
            {error && <ErrBox msg={error} />}
            <div className="flex gap-2 pt-1">
              <Btn onClick={confirmarContacto}>Continuar →</Btn>
              <Btn v="ghost" onClick={() => { setError(""); setPaso("id"); setSubId("confirmar"); }}>← Volver</Btn>
            </div>
          </Card>
        )}

        {/* ════════ APOYOS ══════════════════════════════════════════════════ */}
        {paso === "apoyos" && (
          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="text-base font-black text-slate-900 mb-1">¿Qué apoyo te interesa?</h2>
              <p className="text-xs text-slate-500 mb-4">Selecciona uno o más e indica la cantidad que necesitas.</p>
              <div className="space-y-2">
                {!programasCargados && (
                  <div className="flex items-center gap-2 py-4 justify-center">
                    <Spinner /><p className="text-sm text-slate-400">Cargando programas...</p>
                  </div>
                )}
                {programasCargados && programas.length === 0 && (
                  <p className="text-sm text-red-400 text-center py-4 font-semibold">
                    No hay programas activos registrados. Contacta al administrador.
                  </p>
                )}
                {programas.map((prog) => {
                  const bloqueado = yaRegistrados.has(prog.id);
                  const checked   = seleccionados.has(prog.id);
                  return (
                    <div
                      key={prog.id}
                      className={`rounded-xl border-2 transition-all ${
                        bloqueado ? "border-slate-100 bg-slate-50 opacity-60"
                        : checked  ? "border-blue-400 bg-blue-50"
                        : "border-slate-200 bg-white hover:border-blue-200"
                      }`}
                    >
                      <label className={`flex items-start gap-3 p-3.5 ${bloqueado ? "cursor-not-allowed" : "cursor-pointer"}`}>
                        <input
                          type="checkbox"
                          disabled={bloqueado}
                          checked={checked}
                          onChange={() => !bloqueado && togglePrograma(prog.id)}
                          className="mt-0.5 h-4 w-4 rounded text-blue-600 border-slate-300 focus:ring-blue-500"
                        />
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-bold ${bloqueado ? "text-slate-400" : "text-slate-800"}`}>
                            {prog.nombre}
                          </p>
                          {prog.descripcion && (
                            <p className="text-xs text-slate-500 mt-0.5">{prog.descripcion}</p>
                          )}
                          {bloqueado && (
                            <p className="text-[10px] text-slate-400 mt-0.5 font-semibold uppercase tracking-wide">Ya registrado</p>
                          )}
                          <span className={`mt-1 inline-block text-[9px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                            prog.frecuencia === "SEMANAL" ? "bg-blue-100 text-blue-700"
                            : prog.frecuencia === "MENSUAL" ? "bg-purple-100 text-purple-700"
                            : "bg-amber-100 text-amber-700"
                          }`}>
                            {prog.frecuencia === "SEMANAL" ? "Semanal" : prog.frecuencia === "MENSUAL" ? "Mensual" : "Entrega única"}
                          </span>
                        </div>
                      </label>
                      {/* Campo de cantidad — visible solo cuando está seleccionado */}
                      {checked && !bloqueado && (
                        <div className="px-3.5 pb-3.5 flex items-center gap-3 border-t border-blue-100 pt-3">
                          <span className="text-xs font-bold text-slate-600">Cantidad:</span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setCantidad(prog.id, (cantidades[prog.id] ?? 1) - 1)}
                              className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-base hover:bg-slate-50 flex items-center justify-center"
                            >−</button>
                            <input
                              type="number"
                              min={1}
                              value={cantidades[prog.id] ?? 1}
                              onChange={(e) => setCantidad(prog.id, e.target.value)}
                              className="w-14 text-center px-2 py-1 rounded-lg border border-slate-200 text-sm font-black text-blue-800 focus:outline-none focus:border-blue-400"
                            />
                            <button
                              type="button"
                              onClick={() => setCantidad(prog.id, (cantidades[prog.id] ?? 1) + 1)}
                              className="w-7 h-7 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-base hover:bg-slate-50 flex items-center justify-center"
                            >+</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
            {error && <ErrBox msg={error} />}
            <div className="flex gap-2">
              <Btn onClick={confirmarApoyos}>Continuar →</Btn>
              <Btn v="ghost" onClick={() => {
                setError("");
                if (esNuevo) { setPaso("contacto"); }
                else { setPaso("id"); setSubId("confirmar"); }
              }}>← Volver</Btn>
            </div>
          </div>
        )}

        {/* ════════ ENCUESTA ════════════════════════════════════════════════ */}
        {paso === "encuesta" && (
          <div className="space-y-4">
            {/* Selector de cantidad — solo en modo slug */}
            {slugMode && (() => {
              const prog = programas.find((p) => seleccionados.has(p.id));
              if (!prog) return null;
              return (
                <Card className="p-5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-3">Apoyo solicitado</p>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-slate-800">{prog.nombre}</p>
                      {prog.descripcion && <p className="text-xs text-slate-400 mt-0.5">{prog.descripcion}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button type="button"
                        onClick={() => setCantidad(prog.id, (cantidades[prog.id] ?? 1) - 1)}
                        className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-base hover:bg-slate-50 flex items-center justify-center">−</button>
                      <input type="number" min={1}
                        value={cantidades[prog.id] ?? 1}
                        onChange={(e) => setCantidad(prog.id, e.target.value)}
                        className="w-14 text-center px-2 py-1.5 rounded-lg border border-slate-200 text-sm font-black text-blue-800 focus:outline-none focus:border-blue-400" />
                      <button type="button"
                        onClick={() => setCantidad(prog.id, (cantidades[prog.id] ?? 1) + 1)}
                        className="w-8 h-8 rounded-lg border border-slate-200 bg-white text-slate-600 font-bold text-base hover:bg-slate-50 flex items-center justify-center">+</button>
                    </div>
                  </div>
                </Card>
              );
            })()}
            {/* Forma de pago — solo para calentadores solares */}
            {esCalentador && (
              <Card className="p-5 space-y-3">
                <div>
                  <h2 className="text-base font-black text-slate-900 mb-1">Forma de pago</h2>
                  <p className="text-xs text-slate-500">Selecciona cómo deseas pagar el calentador solar.</p>
                </div>
                <div className="space-y-2">
                  {[
                    { v: "CONTADO",  label: "De contado",  desc: "Pago único al momento de la entrega" },
                    { v: "1_MES",    label: "A 1 mes",     desc: "Un solo pago diferido a un mes" },
                    { v: "2_MESES",  label: "A 2 meses",   desc: "Dos pagos iguales en dos meses" },
                  ].map((opt) => (
                    <label
                      key={opt.v}
                      className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                        formaPago === opt.v
                          ? "border-emerald-400 bg-emerald-50"
                          : "border-slate-200 bg-white hover:border-emerald-200"
                      }`}
                    >
                      <input
                        type="radio"
                        name="forma_pago"
                        value={opt.v}
                        checked={formaPago === opt.v}
                        onChange={() => setFormaPago(opt.v)}
                        className="h-4 w-4 text-emerald-600 border-slate-300 focus:ring-emerald-500"
                      />
                      <div>
                        <p className="text-sm font-bold text-slate-800">{opt.label}</p>
                        <p className="text-xs text-slate-400">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </Card>
            )}

            <Card className="p-5 space-y-4">
              <div>
                <h2 className="text-base font-black text-slate-900 mb-1">¿Cómo se enteró del programa?</h2>
                <p className="text-xs text-slate-500">Esta información nos ayuda a mejorar la difusión de los apoyos.</p>
              </div>
              <div className="space-y-2">
                {[
                  { v: "REDES_SOCIALES", label: "Por redes sociales",                 emoji: "📱" },
                  { v: "SM_INVITO",      label: "Una Seguidora de Manzana le invitó", emoji: "👤" },
                  { v: "OTRO",           label: "Otro medio",                         emoji: "💬" },
                ].map((opt) => (
                  <label
                    key={opt.v}
                    className={`flex items-center gap-3 p-3.5 rounded-xl border-2 cursor-pointer transition-all ${
                      comoSeEntero === opt.v ? "border-blue-400 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-200"
                    }`}
                  >
                    <input
                      type="radio"
                      name="como_se_entero"
                      value={opt.v}
                      checked={comoSeEntero === opt.v}
                      onChange={() => { setComoSeEntero(opt.v); setSmSel(null); setSmQuery(""); setOtroTexto(""); }}
                      className="h-4 w-4 text-blue-600 border-slate-300 focus:ring-blue-500"
                    />
                    <span className="text-lg">{opt.emoji}</span>
                    <span className="text-sm font-semibold text-slate-800">{opt.label}</span>
                  </label>
                ))}
              </div>

              {comoSeEntero === "OTRO" && (
                <CampoReq label="¿Por qué medio?">
                  <Inp placeholder="Describe cómo se enteró..." value={otroTexto} onChange={(e) => setOtroTexto(e.target.value)} />
                </CampoReq>
              )}

              {comoSeEntero === "SM_INVITO" && (
                <div className="space-y-2">
                  <CampoReq label="¿Cuál Seguidora de Manzana le invitó?">
                    <AutocompleteSM
                      sms={sms}
                      valor={smQuery}
                      onChange={setSmQuery}
                      smSel={smSel}
                      onSelect={(sm) => { setSmSel(sm); setSmQuery(""); }}
                      onLimpiar={() => { setSmSel(null); setSmQuery(""); }}
                    />
                  </CampoReq>
                  {!smSel && (
                    <p className="text-xs text-slate-400 pl-1">
                      Escribe el nombre o apellido de la SM para buscarla en la base activa.
                    </p>
                  )}
                </div>
              )}
            </Card>
            {error && <ErrBox msg={error} />}
            <div className="flex gap-2">
              <Btn v="success" disabled={guardando} onClick={confirmarEncuesta}>
                {guardando ? <><Spinner /> Guardando...</> : "Completar registro →"}
              </Btn>
              <Btn v="ghost" disabled={guardando} onClick={() => {
                setError("");
                if (slugMode) {
                  if (esNuevo) setPaso("contacto");
                  else { setPaso("id"); setSubId("confirmar"); }
                } else {
                  setPaso("apoyos");
                }
              }}>← Volver</Btn>
            </div>
          </div>
        )}

        {/* ════════ LISTO — COMPROBANTE ═════════════════════════════════════ */}
        {paso === "listo" && (() => {
          const nombreBen = `${form.nombre} ${form.a_paterno} ${form.a_materno}`.trim();
          const progsSel  = programas.filter((p) => seleccionados.has(p.id));
          const folio     = String(folioId ?? "").padStart(6, "0");
          const qrValor   = `APOYO-FOLIO:${folio}|NOMBRE:${nombreBen}|CURP:${datosCurp?.curp ?? ""}`;

          const msgsApoyos = progsSel
            .map((p) => `• ${p.nombre}${(cantidades[p.id] ?? 1) > 1 ? ` ×${cantidades[p.id]}` : ""}`)
            .join("\n");

          const msgWA = encodeURIComponent(
            `✅ *Registro de Apoyos Sociales*\n\n` +
            `*Folio:* #${folio}\n` +
            `*Nombre:* ${nombreBen}\n\n` +
            `*Apoyos solicitados:*\n${msgsApoyos}\n\n` +
            `Guarda este mensaje como comprobante. Te avisaremos cuando tu apoyo esté listo para entrega.`
          );
          const telLimpio = contacto.telefono.replace(/\D/g, "");
          const urlWA = `https://wa.me/52${telLimpio}?text=${msgWA}`;

          return (
            <div className="space-y-4">
              {/* Encabezado éxito */}
              <div className="text-center py-2">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                  <svg className="w-8 h-8 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h2 className="text-xl font-black text-slate-900">¡Registro completado!</h2>
                <p className="text-xs text-slate-500 mt-1">Presenta este comprobante cuando vayas a recoger tu apoyo.</p>
              </div>

              {/* Comprobante */}
              <div ref={comprobanteRef}>
              <Card className="overflow-hidden">
                {/* Header del comprobante */}
                <div className="bg-blue-800 px-4 py-3 text-white flex justify-between items-center">
                  <div>
                    <p className="text-[9px] font-bold uppercase tracking-widest text-blue-300">Comprobante de Registro</p>
                    <p className="text-lg font-black tracking-tight">Folio #{folio}</p>
                  </div>
                  <svg className="w-8 h-8 text-blue-400 opacity-60" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25zM6.75 12h.008v.008H6.75V12zm0 3h.008v.008H6.75V15zm0 3h.008v.008H6.75V18z" />
                  </svg>
                </div>

                {/* Cuerpo del comprobante */}
                <div className="p-4 space-y-4">
                  <div className="flex gap-4 items-start">
                    {/* QR */}
                    <div className="flex-shrink-0 p-2 bg-white border-2 border-slate-200 rounded-xl">
                      <QRCodeSVG value={qrValor} size={100} level="M" />
                    </div>
                    {/* Datos */}
                    <div className="flex-1 space-y-2 min-w-0">
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Nombre</p>
                        <p className="text-sm font-black text-slate-900 leading-tight">{nombreBen}</p>
                      </div>
                      {datosCurp?.curp && (
                        <div>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">CURP</p>
                          <p className="font-mono text-xs text-slate-600 break-all">{datosCurp.curp}</p>
                        </div>
                      )}
                      <div>
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Teléfono</p>
                        <p className="text-sm font-semibold text-slate-700">{contacto.telefono || "—"}</p>
                      </div>
                    </div>
                  </div>

                  {/* Apoyos */}
                  <div>
                    <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">Apoyos solicitados</p>
                    <div className="flex flex-wrap gap-1.5">
                      {progsSel.map((p) => (
                        <span key={p.id}
                          className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 text-xs font-bold px-2.5 py-1 rounded-full">
                          ✓ {p.nombre}
                          {(cantidades[p.id] ?? 1) > 1 && <span className="text-blue-500"> ×{cantidades[p.id]}</span>}
                        </span>
                      ))}
                    </div>
                  </div>

                  {smSel && (
                    <div>
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Seguidora de Manzana</p>
                      <p className="text-sm font-semibold text-slate-700">
                        {nombreCompleto(smSel)}
                        <span className="text-slate-400 font-normal ml-1">· Secc. {smSel.seccion}</span>
                      </p>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-400 border-t border-slate-100 pt-3">
                    Fecha de registro: {new Date().toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" })}
                  </p>
                </div>
              </Card>
              </div>

              {/* Acciones */}
              <div className="space-y-2">
                {telLimpio.length === 10 && (
                  <a
                    href={urlWA}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2.5 w-full bg-[#25D366] hover:bg-[#1fba59] text-white font-bold text-sm py-3 px-4 rounded-xl transition-all active:scale-95 shadow-sm"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>
                      <path d="M12 0C5.373 0 0 5.373 0 12c0 2.127.558 4.122 1.532 5.853L.057 23.857a.5.5 0 00.611.611l6.004-1.475A11.934 11.934 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.89a9.868 9.868 0 01-5.031-1.376l-.36-.214-3.733.917.951-3.634-.235-.374A9.866 9.866 0 012.11 12C2.11 6.533 6.533 2.11 12 2.11c5.467 0 9.89 4.423 9.89 9.89 0 5.467-4.423 9.89-9.89 9.89z"/>
                    </svg>
                    Enviar comprobante por WhatsApp
                  </a>
                )}
                <button
                  type="button"
                  onClick={descargarPDF}
                  disabled={descargando}
                  className="flex items-center justify-center gap-2.5 w-full bg-slate-700 hover:bg-slate-800 disabled:opacity-50 text-white font-bold text-sm py-3 px-4 rounded-xl transition-all active:scale-95 shadow-sm"
                >
                  {descargando ? (
                    <><Spinner /> Generando PDF...</>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                      </svg>
                      Descargar comprobante PDF
                    </>
                  )}
                </button>
                <Btn onClick={reiniciar} className="w-full justify-center">
                  Registrar otra persona
                </Btn>
              </div>
            </div>
          );
        })()}
      </main>
    </div>
  );
}
