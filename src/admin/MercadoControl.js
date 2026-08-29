/*
 * MercadoControl — Planeación y seguimiento de entregas del Mercado Solidario
 *
 * Lógica al crear nueva entrega:
 *  - fracciones: auto desde ubt_catalogo (COUNT por sector+seccion)
 *  - sm_activas:  auto desde ciudadanos WHERE puesto='SM' AND status='ACTIVO'
 *  - coordinador: auto desde ciudadanos WHERE puesto='SP' AND status='ACTIVO' (no visible en tabla)
 *  - ubicacion + nombre: copiados de la entrega anterior por seccion
 *
 * Por sección se puede agregar más de un punto de entrega (botón "+ Punto" bajo la fila).
 */

import React, { useEffect, useState, useMemo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabaseStorage as supabaseAdmin } from "../supabase/client";

const MESES = [
  "ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO",
  "JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE",
];

const ST_ROW = {
  PENDIENTE:    "bg-amber-50 text-amber-700 border-amber-200",
  ENTREGADO:    "bg-emerald-50 text-emerald-700 border-emerald-200",
  PARCIAL:      "bg-orange-50 text-orange-700 border-orange-200",
  NO_ENTREGADO: "bg-red-50 text-red-700 border-red-200",
};

const inp = "border border-slate-200 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all bg-white";

// ── Fila editable ─────────────────────────────────────────────────────────────
// El coordinador se guarda en DB pero no se muestra (se llena automáticamente con el SP)
function FilaEntrega({ row, onSave, saving }) {
  const [ed, setEd] = useState({
    sm_activas:           String(row.sm_activas ?? ""),
    piezas:               String(row.piezas ?? "20"),
    fecha_entrega:        row.fecha_entrega ?? "",
    camioneta_repartidor: row.camioneta_repartidor ?? "",
    numero_viaje:         String(row.numero_viaje ?? "1"),
    ubicacion:            row.ubicacion ?? "",
    nombre:               row.nombre ?? "",
    estatus:              row.estatus ?? "PENDIENTE",
    entregadas:           String(row.entregadas ?? ""),
  });
  const [dirty, setDirty] = useState(false);

  const smNum     = parseInt(ed.sm_activas, 10) || 0;
  const piezasNum = parseInt(ed.piezas, 10) || 0;
  const total     = smNum * piezasNum;

  const set = (k, v) => { setEd(p => ({ ...p, [k]: v })); setDirty(true); };

  const handleGuardar = () => {
    onSave(row.id, {
      sm_activas:           smNum,
      piezas:               piezasNum,
      total,
      fecha_entrega:        ed.fecha_entrega || null,
      camioneta_repartidor: ed.camioneta_repartidor || null,
      numero_viaje:         parseInt(ed.numero_viaje, 10) || 1,
      ubicacion:            ed.ubicacion || null,
      nombre:               ed.nombre || null,
      estatus:              ed.estatus,
      entregadas:           ed.entregadas !== "" ? parseInt(ed.entregadas, 10) : null,
    }, () => setDirty(false));
  };

  return (
    <tr className={`border-b border-slate-100 transition-colors ${dirty ? "bg-blue-50/40" : "hover:bg-slate-50/60"}`}>
      {/* Sección */}
      <td className="px-3 py-2 font-black text-slate-800 text-sm tabular-nums whitespace-nowrap">{row.seccion}</td>
      {/* Fracc. */}
      <td className="px-3 py-2 text-center text-sm text-slate-400 tabular-nums">{row.fracciones ?? "—"}</td>
      {/* SM Activas */}
      <td className="px-1.5 py-1.5">
        <input type="number" min="0" value={ed.sm_activas}
          onChange={e => set("sm_activas", e.target.value)}
          className={`${inp} w-14 text-center font-mono`} />
      </td>
      {/* Piezas */}
      <td className="px-1.5 py-1.5">
        <input type="number" min="0" value={ed.piezas}
          onChange={e => set("piezas", e.target.value)}
          className={`${inp} w-14 text-center font-mono`} />
      </td>
      {/* Total calculado */}
      <td className="px-3 py-2 text-center font-black text-blue-700 text-sm tabular-nums">{total}</td>
      {/* Entregadas */}
      <td className="px-1.5 py-1.5">
        <input type="number" min="0" value={ed.entregadas} placeholder="—"
          onChange={e => set("entregadas", e.target.value)}
          className={`${inp} w-14 text-center font-mono`} />
      </td>
      {/* Fecha */}
      <td className="px-1.5 py-1.5">
        <input type="date" value={ed.fecha_entrega || ""}
          onChange={e => set("fecha_entrega", e.target.value)}
          className={inp} />
      </td>
      {/* Chofer */}
      <td className="px-1.5 py-1.5">
        <input type="text" value={ed.camioneta_repartidor} placeholder="Chofer"
          onChange={e => set("camioneta_repartidor", e.target.value)}
          className={`${inp} w-24`} />
      </td>
      {/* Viaje */}
      <td className="px-1.5 py-1.5">
        <input type="number" min="1" max="9" value={ed.numero_viaje}
          onChange={e => set("numero_viaje", e.target.value)}
          className={`${inp} w-12 text-center font-mono`} />
      </td>
      {/* Nombre responsable */}
      <td className="px-1.5 py-1.5">
        <input type="text" value={ed.nombre} placeholder="Nombre SM"
          onChange={e => set("nombre", e.target.value)}
          className={`${inp} w-32`} />
      </td>
      {/* Ubicación */}
      <td className="px-1.5 py-1.5">
        <input type="text" value={ed.ubicacion} placeholder="URL o nombre del punto"
          onChange={e => set("ubicacion", e.target.value)}
          className={`${inp} w-44`} />
      </td>
      {/* Estatus */}
      <td className="px-1.5 py-1.5">
        <select value={ed.estatus} onChange={e => set("estatus", e.target.value)}
          className={`border rounded-lg px-1.5 py-1 text-[10px] font-bold focus:outline-none cursor-pointer
            ${ST_ROW[ed.estatus] || "bg-slate-100 text-slate-600 border-slate-200"}`}>
          {["PENDIENTE","ENTREGADO","PARCIAL","NO_ENTREGADO"].map(s => (
            <option key={s} value={s}>{s.replace("_"," ")}</option>
          ))}
        </select>
      </td>
      {/* Guardar */}
      <td className="px-2 py-1.5">
        <button onClick={handleGuardar} disabled={saving || !dirty}
          title={dirty ? "Guardar cambios" : "Sin cambios pendientes"}
          className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm transition-all cursor-pointer
            ${dirty ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm" : "bg-slate-100 text-slate-300 cursor-default"}
            disabled:opacity-60`}>
          {saving ? "…" : "✓"}
        </button>
      </td>
    </tr>
  );
}

// ── Fila separador con botón "+ Punto" ────────────────────────────────────────
function FilaAgregarPunto({ onAgregar, agregando }) {
  return (
    <tr className="bg-slate-50/80 border-b-2 border-slate-200">
      <td colSpan={13} className="px-3 py-1">
        <button onClick={onAgregar} disabled={agregando}
          className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:bg-blue-50 px-2.5 py-1 rounded-lg transition-all cursor-pointer disabled:opacity-50">
          {agregando ? "Agregando…" : "+ Punto de entrega"}
        </button>
      </td>
    </tr>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function MercadoControl() {
  const navigate = useNavigate();

  const [entregas,   setEntregas]   = useState([]);
  const [selEntrega, setSelEntrega] = useState(null);
  const [filas,      setFilas]      = useState([]);
  const [cargando,   setCargando]   = useState(false);
  const [sectorTab,  setSectorTab]  = useState(null);
  const [savingId,   setSavingId]   = useState(null);
  const [agregandoId,setAgregandoId]= useState(null); // key "sector_seccion" durante inserción

  const [modalNueva, setModalNueva] = useState(false);
  const [nuevaForm,  setNuevaForm]  = useState({
    año: new Date().getFullYear(),
    mes: MESES[new Date().getMonth()],
    entrega: 1,
  });
  const [generando,  setGenerando]  = useState(false);
  const [genStatus,  setGenStatus]  = useState("");

  // ── Cargar lista de entregas ────────────────────────────────────────────────
  const cargarEntregas = useCallback(async () => {
    const { data } = await supabaseAdmin
      .from("mercado").select("año,mes,entrega,sector")
      .order("entrega", { ascending: false });
    if (!data) return;
    const map = new Map();
    for (const r of data) {
      const key = `${r.año}_${r.mes}_${r.entrega}`;
      if (!map.has(key)) map.set(key, { año: r.año, mes: r.mes, entrega: r.entrega, secciones: 0, sectores: new Set() });
      map.get(key).secciones++;
      if (r.sector) map.get(key).sectores.add(r.sector);
    }
    setEntregas(
      [...map.values()]
        .map(e => ({ ...e, sectores: [...e.sectores].sort((a,b)=>a-b) }))
        .sort((a,b) => b.entrega - a.entrega || b.año - a.año)
    );
  }, []);

  useEffect(() => { cargarEntregas(); }, [cargarEntregas]);

  // ── Cargar filas ────────────────────────────────────────────────────────────
  const cargarFilas = useCallback(async (año, mes, entrega) => {
    setCargando(true);
    const { data } = await supabaseAdmin.from("mercado").select("*")
      .eq("año", año).eq("mes", mes).eq("entrega", entrega)
      .order("sector").order("seccion").order("numero_viaje");
    setFilas(data ?? []);
    setSectorTab(null);
    setCargando(false);
  }, []);

  const handleSelectEntrega = (e) => {
    const val = e.target.value;
    if (!val) return;
    const [año, mes, entrega] = val.split("|");
    const sel = { año: parseInt(año, 10), mes, entrega: parseInt(entrega, 10) };
    setSelEntrega(sel);
    cargarFilas(sel.año, sel.mes, sel.entrega);
  };

  useEffect(() => {
    if (modalNueva) {
      setNuevaForm(p => ({ ...p, entrega: entregas.length > 0 ? entregas[0].entrega + 1 : 1 }));
      setGenStatus("");
    }
  }, [modalNueva, entregas]);

  // ── Crear nueva entrega ─────────────────────────────────────────────────────
  const crearNuevaEntrega = async () => {
    setGenerando(true);
    try {
      // 1. Secciones + fracciones desde ubt_catalogo
      setGenStatus("Obteniendo catálogo de secciones...");
      const { data: cats, error: eCat } = await supabaseAdmin
        .from("ubt_catalogo").select("sector, seccion, fraccion")
        .order("sector").order("seccion");
      if (eCat) throw eCat;
      if (!cats?.length) throw new Error("No hay secciones en ubt_catalogo.");

      const grupoMap = new Map();
      for (const r of cats) {
        const k = `${r.sector}_${r.seccion}`;
        if (!grupoMap.has(k)) grupoMap.set(k, { sector: r.sector, seccion: r.seccion, fracciones: 0 });
        grupoMap.get(k).fracciones++;
      }

      // 2. SM activas y SP (coordinador) desde ciudadanos
      setGenStatus("Consultando SM activas y coordinadores en ciudadanía...");
      const { data: ciudadanos } = await supabaseAdmin
        .from("ciudadanos")
        .select("puesto, status, poligono, seccion, nombre, a_paterno, a_materno")
        .eq("status", "ACTIVO")
        .in("puesto", ["SM", "SP"]);

      const smMap = new Map();  // seccion → count SM
      const spMap = new Map();  // sector (poligono) → nombre SP
      for (const c of (ciudadanos ?? [])) {
        if (c.puesto === "SM" && c.seccion) {
          smMap.set(c.seccion, (smMap.get(c.seccion) || 0) + 1);
        }
        if (c.puesto === "SP" && c.poligono && !spMap.has(c.poligono)) {
          spMap.set(c.poligono, `${c.nombre || ""} ${c.a_paterno || ""} ${c.a_materno || ""}`.trim());
        }
      }

      // 3. Copiar ubicacion + nombre de la entrega anterior
      const prevUbicMap = new Map(); // "sector_seccion" → {ubicacion, nombre}
      if (entregas.length > 0) {
        setGenStatus("Copiando puntos de entrega anteriores...");
        const prev = entregas[0];
        const { data: prevFilas } = await supabaseAdmin.from("mercado")
          .select("sector, seccion, ubicacion, nombre")
          .eq("año", prev.año).eq("mes", prev.mes).eq("entrega", prev.entrega);
        for (const f of (prevFilas ?? [])) {
          const k = `${f.sector}_${f.seccion}`;
          if (!prevUbicMap.has(k)) {
            prevUbicMap.set(k, { ubicacion: f.ubicacion ?? null, nombre: f.nombre ?? null });
          }
        }
      }

      // 4. Construir filas
      const rows = [...grupoMap.values()].map(g => {
        const prev = prevUbicMap.get(`${g.sector}_${g.seccion}`) ?? {};
        return {
          "año":                nuevaForm.año,
          mes:                  nuevaForm.mes,
          entrega:              nuevaForm.entrega,
          sector:               g.sector,
          seccion:              g.seccion,
          fracciones:           g.fracciones,
          sm_activas:           smMap.get(g.seccion) ?? 0,
          piezas:               20,
          total:                0,
          entregadas:           null,
          estatus:              "PENDIENTE",
          numero_viaje:         1,
          camioneta_repartidor: null,
          coordinador:          spMap.get(g.sector) ?? null,
          ubicacion:            prev.ubicacion ?? null,
          nombre:               prev.nombre ?? null,
          fecha_entrega:        null,
        };
      });

      // 5. Borrar e insertar
      setGenStatus(`Generando ${rows.length} filas...`);
      await supabaseAdmin.from("mercado").delete()
        .eq("año", nuevaForm.año).eq("mes", nuevaForm.mes).eq("entrega", nuevaForm.entrega);

      for (let i = 0; i < rows.length; i += 100) {
        const { error } = await supabaseAdmin.from("mercado").insert(rows.slice(i, i + 100));
        if (error) throw error;
      }

      await cargarEntregas();
      const sel = { año: nuevaForm.año, mes: nuevaForm.mes, entrega: nuevaForm.entrega };
      setSelEntrega(sel);
      await cargarFilas(sel.año, sel.mes, sel.entrega);
      setModalNueva(false);
    } catch (err) {
      alert("Error al crear la entrega: " + err.message);
    } finally {
      setGenerando(false);
      setGenStatus("");
    }
  };

  // ── Guardar fila ────────────────────────────────────────────────────────────
  const handleGuardar = async (id, data, resetDirty) => {
    setSavingId(id);
    const { error } = await supabaseAdmin.from("mercado").update(data).eq("id", id);
    if (error) { alert("Error al guardar: " + error.message); }
    else { setFilas(prev => prev.map(f => f.id === id ? { ...f, ...data } : f)); resetDirty(); }
    setSavingId(null);
  };

  // ── Agregar punto extra a una sección ──────────────────────────────────────
  const handleAgregarPunto = async (baseRow) => {
    const grpKey = `${baseRow.sector}_${baseRow.seccion}`;
    setAgregandoId(grpKey);
    const maxViaje = filas
      .filter(f => f.sector === baseRow.sector && f.seccion === baseRow.seccion)
      .reduce((mx, f) => Math.max(mx, f.numero_viaje || 1), 1);

    const nuevoRow = {
      "año":                baseRow["año"],
      mes:                  baseRow.mes,
      entrega:              baseRow.entrega,
      sector:               baseRow.sector,
      seccion:              baseRow.seccion,
      fracciones:           baseRow.fracciones,
      sm_activas:           0,
      piezas:               baseRow.piezas ?? 20,
      total:                0,
      entregadas:           null,
      estatus:              "PENDIENTE",
      numero_viaje:         maxViaje + 1,
      camioneta_repartidor: null,
      coordinador:          baseRow.coordinador ?? null,
      ubicacion:            null,
      nombre:               null,
      fecha_entrega:        null,
    };

    const { data, error } = await supabaseAdmin.from("mercado").insert([nuevoRow]).select();
    if (error) { alert("Error al agregar punto: " + error.message); }
    else if (data?.length) {
      setFilas(prev => {
        // Insertar inmediatamente después del último row de esta sección
        const idx = [...prev].reverse().findIndex(f => f.sector === baseRow.sector && f.seccion === baseRow.seccion);
        const insertAt = prev.length - idx;
        const copy = [...prev];
        copy.splice(insertAt, 0, data[0]);
        return copy;
      });
    }
    setAgregandoId(null);
  };

  // ── Derivados ───────────────────────────────────────────────────────────────
  const sectoresDisp = useMemo(
    () => [...new Set(filas.map(f => f.sector).filter(Boolean))].sort((a,b) => a-b),
    [filas]
  );

  const filasFiltradas = useMemo(
    () => sectorTab !== null ? filas.filter(f => f.sector === sectorTab) : filas,
    [filas, sectorTab]
  );

  // Agrupar por sección para el botón "+ Punto"
  const seccionGroups = useMemo(() => {
    const groups = [];
    let current = null;
    for (const f of filasFiltradas) {
      const key = `${f.sector}_${f.seccion}`;
      if (!current || current.key !== key) {
        current = { key, sector: f.sector, seccion: f.seccion, rows: [] };
        groups.push(current);
      }
      current.rows.push(f);
    }
    return groups;
  }, [filasFiltradas]);

  const totales = useMemo(() => ({
    secciones:  [...new Set(filasFiltradas.map(f => `${f.sector}_${f.seccion}`))].length,
    total:      filasFiltradas.reduce((s,f) => s + ((f.piezas||0)*(f.sm_activas||0)), 0),
    entregadas: filasFiltradas.reduce((s,f) => s + (f.entregadas||0), 0),
    pendientes: filasFiltradas.filter(f => (f.estatus??'PENDIENTE') === 'PENDIENTE').length,
  }), [filasFiltradas]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* Header */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-900 px-4 py-4 shadow-lg shrink-0">
        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-all shrink-0">
            ←
          </button>
          <div className="mr-auto">
            <p className="text-blue-300 text-[10px] font-bold uppercase tracking-widest leading-none">Mercado Solidario</p>
            <h1 className="text-white font-black text-lg leading-tight">Control de Entregas</h1>
          </div>
          <select onChange={handleSelectEntrega}
            value={selEntrega ? `${selEntrega.año}|${selEntrega.mes}|${selEntrega.entrega}` : ""}
            className="bg-white/10 border border-white/20 text-white text-sm font-semibold rounded-xl px-3 py-2 focus:outline-none min-w-[210px]">
            <option value="" disabled>Seleccionar entrega...</option>
            {entregas.map(e => (
              <option key={`${e.año}_${e.mes}_${e.entrega}`} value={`${e.año}|${e.mes}|${e.entrega}`}
                className="text-slate-900 bg-white">
                Entrega {e.entrega} — {e.mes} {e.año} · {e.secciones} filas
              </option>
            ))}
          </select>
          <button onClick={() => setModalNueva(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer">
            + Nueva entrega
          </button>
        </div>
      </div>

      {/* Estado vacío */}
      {!selEntrega && (
        <div className="flex-1 flex flex-col items-center justify-center py-24 select-none">
          <p className="text-5xl mb-4 opacity-20">📦</p>
          <p className="text-slate-500 font-semibold text-base">Selecciona una entrega o crea una nueva</p>
          <p className="text-slate-400 text-sm mt-1">Las filas se generan automáticamente para todas las secciones</p>
        </div>
      )}

      {selEntrega && (
        <>
          {/* Tabs de sector + totales */}
          <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm shrink-0">
            <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto">
              {[null, ...sectoresDisp].map(s => (
                <button key={s ?? "todos"} onClick={() => setSectorTab(s)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 whitespace-nowrap transition-all cursor-pointer ${
                    sectorTab === s ? "bg-blue-600 text-white border-blue-600" : "border-slate-200 text-slate-600 hover:border-blue-300"
                  }`}>
                  {s === null ? "Todos" : `Sector ${s}`}
                </button>
              ))}
              <div className="ml-auto flex items-center gap-4 text-xs font-semibold shrink-0 pl-4 border-l border-slate-200">
                <span className="text-slate-500">{totales.secciones} secciones</span>
                <span className="text-blue-700 font-black">{totales.total} costales</span>
                {totales.entregadas > 0 && <span className="text-emerald-600">{totales.entregadas} entregados</span>}
                {totales.pendientes > 0 && <span className="text-amber-600">{totales.pendientes} pendientes</span>}
              </div>
            </div>
          </div>

          {/* Tabla */}
          {cargando ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse mr-2" />
              <p className="text-slate-400 text-sm">Cargando...</p>
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full min-w-max bg-white text-sm">
                <thead className="sticky top-[49px] z-10">
                  <tr className="bg-slate-100 border-b-2 border-slate-300 text-[10px] text-slate-500 uppercase tracking-wider">
                    <th className="px-3 py-3 text-left font-bold">Sección</th>
                    <th className="px-3 py-3 text-center font-bold">Fracc.</th>
                    <th className="px-3 py-3 text-center font-bold">SM Act.</th>
                    <th className="px-3 py-3 text-center font-bold">Piezas</th>
                    <th className="px-3 py-3 text-center font-bold text-blue-700">Total</th>
                    <th className="px-3 py-3 text-center font-bold">Entregadas</th>
                    <th className="px-3 py-3 text-left font-bold">Fecha</th>
                    <th className="px-3 py-3 text-left font-bold">Chofer</th>
                    <th className="px-3 py-3 text-center font-bold">Viaje</th>
                    <th className="px-3 py-3 text-left font-bold">Nombre SM</th>
                    <th className="px-3 py-3 text-left font-bold">Ubicación</th>
                    <th className="px-3 py-3 text-left font-bold">Estatus</th>
                    <th className="px-3 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {seccionGroups.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center py-12 text-slate-400 text-sm">
                        No hay secciones para este filtro
                      </td>
                    </tr>
                  ) : (
                    seccionGroups.map(grp => (
                      <React.Fragment key={grp.key}>
                        {grp.rows.map(row => (
                          <FilaEntrega key={row.id} row={row}
                            onSave={handleGuardar} saving={savingId === row.id} />
                        ))}
                        <FilaAgregarPunto
                          onAgregar={() => handleAgregarPunto(grp.rows[0])}
                          agregando={agregandoId === grp.key}
                        />
                      </React.Fragment>
                    ))
                  )}
                </tbody>
                {filasFiltradas.length > 0 && (
                  <tfoot>
                    <tr className="bg-blue-50 border-t-2 border-blue-200 text-sm font-bold text-blue-800">
                      <td className="px-3 py-2" colSpan={2}>Total</td>
                      <td className="px-3 py-2 text-center">
                        {filasFiltradas.reduce((s,f) => s+(f.sm_activas||0), 0)}
                      </td>
                      <td className="px-3 py-2 text-center">—</td>
                      <td className="px-3 py-2 text-center text-blue-900">{totales.total}</td>
                      <td className="px-3 py-2 text-center text-emerald-700">
                        {totales.entregadas || "—"}
                      </td>
                      <td colSpan={7} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </>
      )}

      {/* Modal Nueva Entrega */}
      {modalNueva && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-blue-700 to-blue-900 px-6 py-5">
              <h2 className="text-white font-black text-base leading-none">Nueva Entrega</h2>
              <p className="text-blue-200 text-xs mt-1 leading-snug">
                Genera automáticamente una fila por sección con SM activas desde ciudadanía
              </p>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Año</label>
                  <input type="number" value={nuevaForm.año}
                    onChange={e => setNuevaForm(p => ({ ...p, año: parseInt(e.target.value)||p.año }))}
                    className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500" />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mes</label>
                  <select value={nuevaForm.mes}
                    onChange={e => setNuevaForm(p => ({ ...p, mes: e.target.value }))}
                    className="w-full border-2 border-slate-200 rounded-xl px-2 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500">
                    {MESES.map(m => <option key={m} value={m}>{m.charAt(0)+m.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Entrega #</label>
                  <input type="number" min="1" value={nuevaForm.entrega}
                    onChange={e => setNuevaForm(p => ({ ...p, entrega: parseInt(e.target.value)||1 }))}
                    className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold font-mono focus:outline-none focus:border-blue-500" />
                </div>
              </div>

              {/* Resumen de lo que hará */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 space-y-1 text-xs text-slate-600">
                <p className="font-semibold text-slate-700 mb-1">Se generará automáticamente:</p>
                <p>✓ <strong>Fracciones</strong> — conteo desde ubt_catalogo</p>
                <p>✓ <strong>SM activas</strong> — ciudadanos con puesto SM y estatus ACTIVO</p>
                <p>✓ <strong>Coordinador</strong> — ciudadanos con puesto SP (guardado, no visible)</p>
                {entregas.length > 0 && (
                  <p>✓ <strong>Ubicación / Nombre SM</strong> — copiados de la Entrega {entregas[0].entrega}</p>
                )}
              </div>

              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                ⚠ Si ya existe una Entrega <strong>{nuevaForm.entrega}</strong> para <strong>{nuevaForm.mes} {nuevaForm.año}</strong>, sus datos serán reemplazados.
              </div>

              {generando && genStatus && (
                <div className="flex items-center gap-2 text-xs text-blue-600">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
                  {genStatus}
                </div>
              )}

              <div className="flex gap-2 pt-1">
                <button onClick={() => setModalNueva(false)} disabled={generando}
                  className="flex-1 border-2 border-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50">
                  Cancelar
                </button>
                <button onClick={crearNuevaEntrega} disabled={generando}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-xl text-sm disabled:opacity-50 transition-all cursor-pointer shadow-sm">
                  {generando ? "Generando…" : "Generar entrega"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
