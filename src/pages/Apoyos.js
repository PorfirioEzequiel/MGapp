import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import supabase from "../supabase/client";
import codigosPostalesData from "../codigospostales.json";

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

const STATUS_CFG = [
  { v: "PENDIENTE",    label: "Pendiente",    cls: "bg-amber-100 text-amber-700 border-amber-300"      },
  { v: "ENTREGADO",    label: "Entregado",    cls: "bg-emerald-100 text-emerald-700 border-emerald-300" },
  { v: "NO ENTREGADO", label: "No entregado", cls: "bg-red-100 text-red-700 border-red-300"             },
];
const statusCls = (s) =>
  STATUS_CFG.find((o) => o.v === s)?.cls ?? "bg-slate-100 text-slate-500 border-slate-200";

const emptyBeneficiario = {
  curp: "", telefono_1: "",
  nombre: "", a_paterno: "", a_materno: "",
  poligono: "", seccion: "", ubt: "",
  calle: "", n_ext_mz: "", n_int_lt: "", n_casa: "",
  c_p: "", col_loc: "",
};

const Spinner = () => (
  <div className="w-4 h-4 rounded-full border-[3px] border-red-700 border-t-transparent animate-spin flex-shrink-0" />
);

const Inp = ({ className = "", ...p }) => (
  <input
    {...p}
    className={`px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800 placeholder-slate-400
      focus:outline-none focus:ring-2 focus:ring-red-400/20 focus:border-red-400 transition-all ${className}`}
  />
);

const EntregaControl = ({ entrega, guardando, foto, setFoto, onEntregar, onNoEntregado, onPendiente }) => (
  <div className="mt-3 space-y-2.5">
    {entrega?.foto_evidencia_url && (
      <img src={entrega.foto_evidencia_url} alt="Evidencia" className="h-24 rounded-xl border border-slate-200" />
    )}
    <div className="flex flex-wrap gap-2">
      <input
        type="file" accept="image/*" capture="environment"
        onChange={(e) => setFoto(e.target.files[0] ?? null)}
        className="text-xs text-slate-500 file:mr-2 file:px-3 file:py-1.5 file:rounded-lg
          file:border-0 file:bg-slate-100 file:text-xs file:font-semibold file:text-slate-600
          file:cursor-pointer file:hover:bg-slate-200 transition-all"
      />
      <button
        disabled={guardando} onClick={() => onEntregar(foto)}
        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-1.5
          rounded-lg disabled:opacity-50 transition-colors active:scale-95"
      >✔ Entregado</button>
      <button
        disabled={guardando} onClick={onNoEntregado}
        className="bg-red-500 hover:bg-red-600 text-white text-xs font-bold px-4 py-1.5
          rounded-lg disabled:opacity-50 transition-colors active:scale-95"
      >✕ No entregado</button>
      {entrega && (
        <button
          disabled={guardando} onClick={onPendiente}
          className="bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold px-4 py-1.5
            rounded-lg disabled:opacity-50 transition-colors active:scale-95"
        >⏳ Pendiente</button>
      )}
    </div>
  </div>
);

export default function Apoyos() {
  const { state }  = useLocation();
  const { user }   = state || {};
  const navigate   = useNavigate();
  const esSP       = user?.puesto?.toLowerCase() === "sp";

  const [programas,         setProgramas]         = useState([]);
  const [programaId,        setProgramaId]        = useState("");
  const [smsSector,         setSmsSector]         = useState([]);
  const [smSel,             setSmSel]             = useState("");
  const [busqueda,          setBusqueda]          = useState("");
  const [buscando,          setBuscando]          = useState(false);
  const [beneficiario,      setBeneficiario]      = useState(null);
  const [mostrarFormNuevo,  setMostrarFormNuevo]  = useState(false);
  const [nuevoBen,          setNuevoBen]          = useState(emptyBeneficiario);
  const [entregaActual,     setEntregaActual]     = useState(null);
  const [guardando,         setGuardando]         = useState(false);
  const [foto,              setFoto]              = useState(null);
  const [lista,             setLista]             = useState([]);
  const [cargandoLista,     setCargandoLista]     = useState(false);
  const [colonias,          setColonias]          = useState([]);
  const [smNombres,         setSmNombres]         = useState({});
  const [guardandoStatus,   setGuardandoStatus]   = useState(null);

  const programaSel   = programas.find((p) => p.id === Number(programaId)) || null;
  const periodoActual = programaSel ? getPeriodo(programaSel.frecuencia) : null;

  // ── Programas activos ────────────────────────────────────────────────────────
  useEffect(() => {
    supabase
      .from("programas_sociales")
      .select("*")
      .eq("activo", true)
      .order("nombre")
      .then(({ data }) => {
        if (data?.length) {
          setProgramas(data);
          setProgramaId((p) => p || String(data[0].id));
        }
      });
  }, []);

  // ── SMs del sector (solo SP) ─────────────────────────────────────────────────
  useEffect(() => {
    if (!esSP || !user?.poligono) return;
    supabase
      .from("ciudadania")
      .select("id, usuario, nombre, a_paterno, a_materno, seccion, ubt")
      .eq("poligono", user.poligono)
      .eq("puesto", "SM")
      .eq("status", "ACTIVO")
      .order("ubt")
      .then(({ data }) => setSmsSector(data ?? []));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esSP, user?.poligono]);

  // ── Lista de beneficiarios ────────────────────────────────────────────────────
  const cargarLista = async () => {
    if (!user || !programaSel) return;
    setCargandoLista(true);
    try {
      let q = supabase
        .from("ciudadania")
        .select("*")
        .eq("puesto", "BENEFICIARIO")
        .eq("status", "ACTIVO")
        .order("seccion",   { ascending: true, nullsLast: true })
        .order("ubt",       { ascending: true, nullsLast: true })
        .order("a_paterno", { ascending: true });
      q = esSP
        ? q.eq("poligono", user.poligono)
        : q.eq("movilizador", user.usuario);

      const { data: benefs, error } = await q;
      if (error) throw error;

      const ids = (benefs ?? []).map((b) => b.id);
      const entregasMap = {};
      if (ids.length) {
        const { data: entregas } = await supabase
          .from("apoyo_entregas")
          .select("*")
          .eq("programa_id", programaSel.id)
          .eq("periodo", periodoActual)
          .in("beneficiario_id", ids);
        (entregas ?? []).forEach((e) => { entregasMap[e.beneficiario_id] = e; });
      }

      const listaConEntregas = (benefs ?? []).map((b) => ({ ...b, entrega: entregasMap[b.id] ?? null }));
      setLista(listaConEntregas);

      // Cargar nombres completos de las SM referenciadas
      const usuarios = [...new Set(listaConEntregas.map((b) => b.movilizador).filter(Boolean))];
      if (usuarios.length) {
        const { data: sms } = await supabase
          .from("ciudadania")
          .select("usuario, nombre, a_paterno, a_materno")
          .in("usuario", usuarios);
        const mapa = {};
        (sms ?? []).forEach((sm) => {
          mapa[sm.usuario] = `${sm.nombre ?? ""} ${sm.a_paterno ?? ""} ${sm.a_materno ?? ""}`.trim();
        });
        setSmNombres(mapa);
      } else {
        setSmNombres({});
      }
    } catch (err) {
      console.error("Error cargando lista:", err.message);
    } finally {
      setCargandoLista(false);
    }
  };

  useEffect(() => {
    cargarLista();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId, user?.id]);

  // ── Actualizar status inline desde la lista ──────────────────────────────────
  const actualizarStatusEnLista = async (beneficiarioId, nuevoStatus) => {
    if (!programaSel) return;
    setGuardandoStatus(beneficiarioId);
    try {
      const { data, error } = await supabase
        .from("apoyo_entregas")
        .upsert([{
          beneficiario_id: beneficiarioId,
          programa_id:     programaSel.id,
          periodo:         periodoActual,
          status:          nuevoStatus,
          cantidad:        1,
          entregado_por:   user.usuario,
          fecha_entrega:   nuevoStatus === "ENTREGADO" ? new Date().toISOString() : null,
        }], { onConflict: "beneficiario_id,programa_id,periodo" })
        .select()
        .single();
      if (!error && data) {
        setLista((prev) => prev.map((b) => b.id === beneficiarioId ? { ...b, entrega: data } : b));
        if (beneficiario?.id === beneficiarioId) setEntregaActual(data);
      }
    } catch (err) {
      console.error("Error actualizando status:", err.message);
    } finally {
      setGuardandoStatus(null);
    }
  };

  // ── Entrega individual (desde el buscador) ────────────────────────────────────
  const cargarEntregaDe = async (b) => {
    if (!programaSel) return;
    const { data } = await supabase
      .from("apoyo_entregas")
      .select("*")
      .eq("beneficiario_id", b.id)
      .eq("programa_id", programaSel.id)
      .eq("periodo", periodoActual)
      .maybeSingle();
    setEntregaActual(data ?? null);
  };

  useEffect(() => {
    if (beneficiario) cargarEntregaDe(beneficiario);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId]);

  const limpiarBusqueda = () => {
    setBusqueda(""); setBeneficiario(null); setMostrarFormNuevo(false);
    setEntregaActual(null); setFoto(null);
    setNuevoBen(emptyBeneficiario); setSmSel(""); setColonias([]);
  };

  const buscar = async () => {
    const q = busqueda.trim();
    if (!q) return;
    setBuscando(true);
    setBeneficiario(null); setMostrarFormNuevo(false); setEntregaActual(null);
    try {
      let encontrado = null;
      const { data: porCurp } = await supabase.from("ciudadania").select("*").eq("curp", q.toUpperCase()).limit(1);
      encontrado = porCurp?.[0] ?? null;
      if (!encontrado) {
        const { data: porTel } = await supabase.from("ciudadania").select("*").eq("telefono_1", q).limit(1);
        encontrado = porTel?.[0] ?? null;
      }
      if (encontrado) {
        setBeneficiario(encontrado);
        await cargarEntregaDe(encontrado);
      } else {
        setMostrarFormNuevo(true);
        setColonias([]);
        setNuevoBen({
          ...emptyBeneficiario,
          curp:       /^[A-Z0-9]{18}$/i.test(q) ? q.toUpperCase() : "",
          telefono_1: /^\d{10}$/.test(q) ? q : "",
          poligono:   user?.poligono ?? "",
          seccion:    esSP ? "" : (user?.seccion ?? ""),
          ubt:        esSP ? "" : (user?.ubt ?? ""),
        });
      }
    } catch (err) {
      alert("Error buscando en la base: " + err.message);
    } finally {
      setBuscando(false);
    }
  };

  const handleCPChange = (cp) => {
    setNuevoBen((p) => ({ ...p, c_p: cp, col_loc: "" }));
    setColonias(
      codigosPostalesData
        .filter((loc) => loc.d_codigo.toString() === cp)
        .map((loc) => loc.d_asenta)
    );
  };

  const seleccionarSM = (id) => {
    setSmSel(id);
    const sm = smsSector.find((s) => String(s.id) === id);
    if (sm)
      setNuevoBen((p) => ({ ...p, poligono: user.poligono ?? "", seccion: sm.seccion ?? "", ubt: sm.ubt ?? "" }));
  };

  const guardarNuevoBeneficiario = async () => {
    if (!nuevoBen.nombre.trim())   { alert("El nombre es obligatorio."); return; }
    if (esSP && !smSel)            { alert("Selecciona a qué SM pertenece este beneficiario."); return; }
    if (!nuevoBen.calle.trim() || !nuevoBen.c_p.trim() || !nuevoBen.col_loc.trim() || !nuevoBen.n_ext_mz.trim()) {
      alert("Calle, Código Postal, Colonia y N° Ext son obligatorios."); return;
    }
    if (nuevoBen.telefono_1.trim() && !/^\d{10}$/.test(nuevoBen.telefono_1.trim())) {
      alert("El teléfono debe tener 10 dígitos."); return;
    }
    setGuardando(true);
    try {
      const smResponsable = esSP ? smsSector.find((s) => String(s.id) === smSel) : null;
      const { data, error } = await supabase
        .from("ciudadania")
        .upsert([{
          puesto: "BENEFICIARIO", status: "ACTIVO",
          nombre:     nuevoBen.nombre.trim().toUpperCase(),
          a_paterno:  nuevoBen.a_paterno.trim().toUpperCase(),
          a_materno:  nuevoBen.a_materno.trim().toUpperCase(),
          curp:       nuevoBen.curp.trim().toUpperCase() || null,
          telefono_1: nuevoBen.telefono_1.trim() || null,
          poligono:   nuevoBen.poligono || null,
          seccion:    nuevoBen.seccion || null,
          ubt:        nuevoBen.ubt || null,
          calle:      nuevoBen.calle.trim().toUpperCase(),
          n_ext_mz:   nuevoBen.n_ext_mz.trim(),
          n_int_lt:   nuevoBen.n_int_lt.trim() || null,
          n_casa:     nuevoBen.n_casa.trim() || null,
          c_p:        nuevoBen.c_p.trim(),
          col_loc:    nuevoBen.col_loc.trim().toUpperCase(),
          movilizador: esSP ? smResponsable?.usuario ?? null : user.usuario,
          ingreso_estructura: new Date().toISOString(),
        }], { onConflict: "curp" })
        .select()
        .single();
      if (error) throw error;
      setBeneficiario(data); setMostrarFormNuevo(false); setEntregaActual(null);
      cargarLista();
    } catch (err) {
      alert("Error guardando beneficiario: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const registrarEntrega = async (status, benObj, fotoFile) => {
    if (!programaSel || !benObj) return;
    setGuardando(true);
    try {
      let fotoUrl = entregaActual?.foto_evidencia_url ?? null;
      if (fotoFile) {
        const fp = `entregas/${benObj.id}-${programaSel.id}-${periodoActual}`;
        const { error: upErr } = await supabase.storage.from("evidencias_apoyos").upload(fp, fotoFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("evidencias_apoyos").getPublicUrl(fp);
        fotoUrl = urlData.publicUrl;
      }
      const { data, error } = await supabase
        .from("apoyo_entregas")
        .upsert([{
          beneficiario_id:    benObj.id,
          programa_id:        programaSel.id,
          periodo:            periodoActual,
          status,
          cantidad:           1,
          foto_evidencia_url: fotoUrl,
          entregado_por:      user.usuario,
          fecha_entrega:      status === "ENTREGADO" ? new Date().toISOString() : null,
        }], { onConflict: "beneficiario_id,programa_id,periodo" })
        .select()
        .single();
      if (error) throw error;
      setEntregaActual(data);
      setFoto(null);
      if (status === "ENTREGADO") {
        const entrada = `${programaSel.nombre} (${periodoActual})`;
        const actual  = benObj.historial_programas || "";
        if (!actual.includes(entrada)) {
          const nuevo = actual ? `${actual}; ${entrada}` : entrada;
          await supabase.from("ciudadania").update({ historial_programas: nuevo }).eq("id", benObj.id);
          setBeneficiario((prev) => prev?.id === benObj.id ? { ...prev, historial_programas: nuevo } : prev);
        }
      }
      cargarLista();
    } catch (err) {
      alert("Error registrando entrega: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  if (!user) return <p className="p-4 text-red-500">Error: usuario no encontrado.</p>;

  // ── Agrupar lista: sección → fracción ────────────────────────────────────────
  const grupos = {};
  lista.forEach((b) => {
    const sec  = b.seccion ?? "—";
    const frac = b.ubt     ?? "—";
    if (!grupos[sec])       grupos[sec]       = {};
    if (!grupos[sec][frac]) grupos[sec][frac] = { smUsuario: b.movilizador ?? null, items: [] };
    grupos[sec][frac].items.push(b);
  });
  const secciones = Object.keys(grupos).sort((a, b) =>
    (Number(a) || 0) - (Number(b) || 0) || String(a).localeCompare(String(b))
  );

  const totEntregado = lista.filter((b) => b.entrega?.status === "ENTREGADO").length;
  const totPendiente = lista.filter((b) => b.entrega?.status === "PENDIENTE").length;
  const totSinReg    = lista.filter((b) => !b.entrega).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-[#7B1528] text-white px-4 py-5 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button type="button" onClick={() => navigate(-1)} className="text-red-200 hover:text-white transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-red-300">
              {esSP ? `Sector ${user.poligono}` : `SM · ${user.usuario}`}
            </p>
            <h1 className="text-xl font-black tracking-tight">Apoyos y Programas Sociales</h1>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">

        {/* Selector de programa */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1.5">
            Programa activo
          </label>
          <select
            value={programaId}
            onChange={(e) => { setProgramaId(e.target.value); limpiarBusqueda(); }}
            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-800 text-sm
              font-semibold focus:outline-none focus:ring-2 focus:ring-red-400/20 focus:border-red-400 transition-all"
          >
            {programas.map((p) => (
              <option key={p.id} value={p.id}>
                {p.nombre} — {p.frecuencia === "SEMANAL" ? "semanal" : "entrega única"}
              </option>
            ))}
          </select>
          {programaSel && (
            <p className="text-[11px] text-slate-400 mt-1.5">
              Periodo: <strong className="text-slate-600">{periodoActual}</strong>
              {programaSel.descripcion && ` · ${programaSel.descripcion}`}
            </p>
          )}
        </div>

        {/* KPIs */}
        {lista.length > 0 && (
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: "Total",        val: lista.length, cls: "bg-white border-slate-200 text-slate-700"          },
              { label: "Entregados",   val: totEntregado, cls: "bg-emerald-50 border-emerald-200 text-emerald-800"  },
              { label: "Pendientes",   val: totPendiente, cls: "bg-amber-50 border-amber-200 text-amber-800"        },
              { label: "Sin registro", val: totSinReg,    cls: "bg-slate-50 border-slate-200 text-slate-500"        },
            ].map((k) => (
              <div key={k.label} className={`rounded-2xl border px-3 py-3 ${k.cls}`}>
                <p className="text-[9px] font-bold uppercase tracking-wider opacity-60 leading-tight">{k.label}</p>
                <p className="text-2xl font-black mt-0.5">{k.val}</p>
              </div>
            ))}
          </div>
        )}

        {/* Buscador / agregar beneficiario */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 pt-4 pb-3 border-b border-slate-100">
            <h2 className="text-sm font-black text-slate-800">Buscar / agregar beneficiario</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Por CURP o teléfono de 10 dígitos</p>
          </div>

          <div className="p-4 space-y-3">
            <div className="flex gap-2">
              <Inp
                type="text"
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && buscar()}
                placeholder="CURP o teléfono"
                className="flex-1"
              />
              <button
                onClick={buscar} disabled={buscando}
                className="bg-[#7B1528] hover:bg-red-900 text-white text-sm font-bold px-5 py-2.5
                  rounded-xl disabled:opacity-50 transition-colors active:scale-95 flex items-center gap-2"
              >
                {buscando ? <><Spinner />Buscando</> : "Buscar"}
              </button>
              {(beneficiario || mostrarFormNuevo) && (
                <button
                  onClick={limpiarBusqueda}
                  className="px-3.5 py-2.5 rounded-xl border border-slate-200 text-slate-500
                    hover:bg-slate-50 text-sm transition-colors"
                >✕</button>
              )}
            </div>

            {/* Resultado de búsqueda */}
            {beneficiario && (
              <div className="bg-slate-50 rounded-xl p-4 border border-slate-200 space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-black text-slate-900 leading-tight text-sm">
                      {beneficiario.nombre} {beneficiario.a_paterno} {beneficiario.a_materno}
                    </p>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {beneficiario.curp || "Sin CURP"} · {beneficiario.telefono_1 || "Sin tel"}
                    </p>
                    {beneficiario.puesto !== "BENEFICIARIO" && (
                      <span className="text-[10px] font-bold text-violet-600 uppercase tracking-wide">
                        {beneficiario.puesto}
                      </span>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold uppercase px-2.5 py-1 rounded-full border flex-shrink-0 ${statusCls(entregaActual?.status ?? null)}`}>
                    {entregaActual?.status ?? "SIN REG."}
                  </span>
                </div>
                {beneficiario.historial_programas && (
                  <p className="text-[10px] text-slate-400">Historial: {beneficiario.historial_programas}</p>
                )}
                <EntregaControl
                  entrega={entregaActual}
                  guardando={guardando}
                  foto={foto}
                  setFoto={setFoto}
                  onEntregar={(file) => registrarEntrega("ENTREGADO", beneficiario, file)}
                  onNoEntregado={() => registrarEntrega("NO ENTREGADO", beneficiario, null)}
                  onPendiente={() => registrarEntrega("PENDIENTE", beneficiario, null)}
                />
              </div>
            )}

            {/* Formulario nuevo beneficiario */}
            {mostrarFormNuevo && (
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <p className="text-sm font-black text-emerald-700">
                  No está registrado — dar de alta como beneficiario
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Inp placeholder="Nombre *" value={nuevoBen.nombre}
                    onChange={(e) => setNuevoBen((p) => ({ ...p, nombre: e.target.value.toUpperCase() }))} />
                  <Inp placeholder="Apellido Paterno *" value={nuevoBen.a_paterno}
                    onChange={(e) => setNuevoBen((p) => ({ ...p, a_paterno: e.target.value.toUpperCase() }))} />
                  <Inp placeholder="Apellido Materno" value={nuevoBen.a_materno}
                    onChange={(e) => setNuevoBen((p) => ({ ...p, a_materno: e.target.value.toUpperCase() }))} />
                  <Inp placeholder="CURP (opcional)" maxLength={18} value={nuevoBen.curp}
                    onChange={(e) => setNuevoBen((p) => ({ ...p, curp: e.target.value.toUpperCase() }))} />
                  <Inp placeholder="Teléfono" maxLength={10} value={nuevoBen.telefono_1}
                    onChange={(e) => setNuevoBen((p) => ({ ...p, telefono_1: e.target.value.replace(/\D/g, "") }))} />
                  <Inp placeholder="Sector" value={nuevoBen.poligono}
                    onChange={(e) => setNuevoBen((p) => ({ ...p, poligono: e.target.value }))} />
                  <Inp placeholder="Sección" value={nuevoBen.seccion}
                    onChange={(e) => setNuevoBen((p) => ({ ...p, seccion: e.target.value.replace(/\D/g, "") }))} />
                  <Inp placeholder="Calle *" value={nuevoBen.calle} className="sm:col-span-2"
                    onChange={(e) => setNuevoBen((p) => ({ ...p, calle: e.target.value.toUpperCase() }))} />
                  <Inp placeholder="N° Ext / Mz *" value={nuevoBen.n_ext_mz}
                    onChange={(e) => setNuevoBen((p) => ({ ...p, n_ext_mz: e.target.value }))} />
                  <Inp placeholder="N° Int / Lt (opcional)" value={nuevoBen.n_int_lt}
                    onChange={(e) => setNuevoBen((p) => ({ ...p, n_int_lt: e.target.value }))} />
                  <Inp placeholder="Código Postal *" maxLength={5} value={nuevoBen.c_p}
                    onChange={(e) => handleCPChange(e.target.value.replace(/\D/g, ""))} />
                  <select
                    value={nuevoBen.col_loc}
                    onChange={(e) => setNuevoBen((p) => ({ ...p, col_loc: e.target.value }))}
                    className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800
                      focus:outline-none focus:ring-2 focus:ring-red-400/20 focus:border-red-400 sm:col-span-2"
                  >
                    <option value="">{colonias.length ? "Selecciona colonia *" : "Ingresa el C.P. para ver colonias"}</option>
                    {colonias.map((c, i) => <option key={i} value={c}>{c}</option>)}
                  </select>
                  {esSP && (
                    <select
                      value={smSel}
                      onChange={(e) => seleccionarSM(e.target.value)}
                      className="px-3 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-800
                        focus:outline-none focus:ring-2 focus:ring-red-400/20 focus:border-red-400 sm:col-span-2"
                    >
                      <option value="">— Selecciona la SM responsable *—</option>
                      {smsSector.map((sm) => (
                        <option key={sm.id} value={sm.id}>
                          {sm.nombre} {sm.a_paterno} {sm.a_materno} · Secc. {sm.seccion} / Fracc. {sm.ubt}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <button
                  onClick={guardarNuevoBeneficiario} disabled={guardando}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-bold px-6 py-2.5
                    rounded-xl disabled:opacity-50 transition-colors active:scale-95"
                >
                  {guardando ? "Guardando..." : "Guardar beneficiario"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Lista agrupada por sección → fracción */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-4 py-3.5 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-black text-slate-800">
                {esSP ? "Beneficiarios del sector" : "Mis beneficiarios"}
              </h2>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {programaSel?.nombre} · <span className="font-semibold text-slate-500">{periodoActual}</span>
              </p>
            </div>
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full">
              {lista.length} reg.
            </span>
          </div>

          {cargandoLista ? (
            <div className="flex items-center gap-3 px-5 py-10">
              <Spinner /><span className="text-sm text-slate-400">Cargando beneficiarios...</span>
            </div>
          ) : lista.length === 0 ? (
            <p className="text-sm text-slate-400 italic px-5 py-10 text-center">
              Aún no hay beneficiarios registrados para este programa.
            </p>
          ) : (
            <div>
              {secciones.map((sec) => {
                const fracciones = Object.keys(grupos[sec]).sort((a, b) =>
                  String(a).localeCompare(String(b), undefined, { numeric: true })
                );
                const totalSec = fracciones.reduce((acc, f) => acc + grupos[sec][f].items.length, 0);
                const entregSec = fracciones.reduce(
                  (acc, f) => acc + grupos[sec][f].items.filter((b) => b.entrega?.status === "ENTREGADO").length, 0
                );

                return (
                  <div key={sec}>
                    {/* Cabecera de sección */}
                    <div className="bg-slate-800 text-white px-4 py-2.5 flex items-center gap-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Sección</span>
                        <span className="text-base font-black">{sec}</span>
                      </div>
                      <div className="ml-auto flex items-center gap-3">
                        <span className="text-[10px] text-slate-400">{totalSec} benef.</span>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          entregSec === totalSec
                            ? "bg-emerald-500 text-white"
                            : entregSec > 0
                            ? "bg-amber-400 text-amber-900"
                            : "bg-slate-600 text-slate-300"
                        }`}>
                          {entregSec}/{totalSec}
                        </span>
                      </div>
                    </div>

                    {fracciones.map((frac) => {
                      const grupo    = grupos[sec][frac];
                      const smNombre = grupo.smUsuario
                        ? (smNombres[grupo.smUsuario] || grupo.smUsuario)
                        : "Sin SM asignada";

                      return (
                        <div key={frac}>
                          {/* Cabecera de fracción */}
                          <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 flex items-center gap-2">
                            <span className="text-[10px] font-bold text-blue-400 uppercase tracking-wide">Fracc.</span>
                            <span className="text-xs font-black text-blue-800">{frac}</span>
                            <span className="text-[10px] text-blue-300 mx-0.5">·</span>
                            <span className="text-[11px] font-semibold text-blue-700 truncate">{smNombre}</span>
                            <span className="ml-auto text-[10px] text-blue-400 flex-shrink-0">
                              {grupo.items.filter((b) => b.entrega?.status === "ENTREGADO").length}/{grupo.items.length}
                            </span>
                          </div>

                          {/* Filas de beneficiarios */}
                          {grupo.items.map((b) => {
                            const st = b.entrega?.status ?? null;
                            return (
                              <div
                                key={b.id}
                                className="flex items-center gap-3 px-4 py-3 border-b border-slate-50 last:border-b-0
                                  hover:bg-slate-50 transition-colors"
                              >
                                {/* Nombre completo */}
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm font-bold text-slate-800 leading-tight truncate">
                                    {b.nombre} {b.a_paterno} {b.a_materno}
                                  </p>
                                  <p className="text-[11px] text-slate-400 mt-0.5">
                                    {b.curp
                                      ? <span className="font-mono">{b.curp}</span>
                                      : b.telefono_1 || "Sin CURP/tel"}
                                  </p>
                                </div>

                                {/* Select de estatus */}
                                <div className="flex-shrink-0">
                                  {guardandoStatus === b.id ? (
                                    <Spinner />
                                  ) : (
                                    <select
                                      value={st ?? ""}
                                      onChange={(e) => e.target.value && actualizarStatusEnLista(b.id, e.target.value)}
                                      disabled={guardandoStatus !== null}
                                      className={`text-[10px] font-bold uppercase rounded-full px-2.5 py-1 border
                                        cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-1
                                        focus:ring-blue-400 disabled:opacity-50 transition-colors
                                        appearance-none text-center ${statusCls(st)}`}
                                    >
                                      {!st && <option value="" disabled>Sin registro</option>}
                                      <option value="PENDIENTE">Pendiente</option>
                                      <option value="ENTREGADO">Entregado</option>
                                      <option value="NO ENTREGADO">No entregado</option>
                                    </select>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </main>
    </div>
  );
}
