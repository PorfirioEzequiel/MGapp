/*
 * MercadoControl — Planeación y seguimiento de entregas del Mercado Solidario
 *
 * Flujo:
 *  1. "Nueva Entrega" → genera automáticamente una fila por cada sección en ubt_catalogo
 *  2. Filtra por sector → tabla editable inline (piezas, fecha, coordinador, chofer, viaje, ubicación, estatus)
 *  3. Los campos fracciones (conteo) se auto-calculan de ubt_catalogo al crear la entrega
 *  4. SM activas: se copian de la entrega anterior (si se activa la opción) o se editan manualmente
 *
 * Tabla usada: mercado (flat, misma que ReporteMercado y el importador CSV)
 *
 * SQL de soporte (ejecutar UNA VEZ en Supabase → SQL Editor si aún no existe):
 * ──────────────────────────────────────────────────────────────────────────────
 * ALTER TABLE mercado ADD COLUMN IF NOT EXISTS seccion INT;
 * ALTER TABLE mercado ADD COLUMN IF NOT EXISTS restan INT;
 * ALTER TABLE mercado ADD COLUMN IF NOT EXISTS telefono TEXT;
 * ALTER TABLE mercado ADD COLUMN IF NOT EXISTS ubicacion TEXT;
 * ALTER TABLE mercado ADD COLUMN IF NOT EXISTS latitud DOUBLE PRECISION;
 * ALTER TABLE mercado ADD COLUMN IF NOT EXISTS longitud DOUBLE PRECISION;
 * ALTER TABLE mercado ADD COLUMN IF NOT EXISTS ubicacion_repetida BOOLEAN DEFAULT FALSE;
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

// ── Input helpers ─────────────────────────────────────────────────────────────
const inp = "border border-slate-200 rounded-lg px-2 py-1 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400 transition-all bg-white";

// ── Fila editable de la tabla ─────────────────────────────────────────────────
function FilaEntrega({ row, onSave, saving }) {
  const [ed, setEd] = useState({
    sm_activas:           String(row.sm_activas ?? ""),
    piezas:               String(row.piezas ?? "20"),
    fecha_entrega:        row.fecha_entrega ?? "",
    coordinador:          row.coordinador ?? "",
    camioneta_repartidor: row.camioneta_repartidor ?? "",
    numero_viaje:         String(row.numero_viaje ?? "1"),
    ubicacion:            row.ubicacion ?? "",
    estatus:              row.estatus ?? "PENDIENTE",
    nombre:               row.nombre ?? "",
    entregadas:           String(row.entregadas ?? ""),
  });
  const [dirty, setDirty] = useState(false);

  const smNum    = parseInt(ed.sm_activas, 10) || 0;
  const piezasNum = parseInt(ed.piezas, 10) || 0;
  const total    = smNum * piezasNum;

  const set = (k, v) => { setEd(p => ({ ...p, [k]: v })); setDirty(true); };

  const handleGuardar = () => {
    const payload = {
      sm_activas:           smNum,
      piezas:               piezasNum,
      total,
      fecha_entrega:        ed.fecha_entrega || null,
      coordinador:          ed.coordinador || null,
      camioneta_repartidor: ed.camioneta_repartidor || null,
      numero_viaje:         parseInt(ed.numero_viaje, 10) || 1,
      ubicacion:            ed.ubicacion || null,
      estatus:              ed.estatus,
      nombre:               ed.nombre || null,
      entregadas:           ed.entregadas !== "" ? parseInt(ed.entregadas, 10) : null,
    };
    onSave(row.id, payload, () => setDirty(false));
  };

  const rowBg = dirty ? "bg-blue-50/50" : "hover:bg-slate-50/70";

  return (
    <tr className={`border-b border-slate-100 transition-colors ${rowBg}`}>
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
      {/* Total (calculado) */}
      <td className="px-3 py-2 text-center font-black text-blue-700 text-sm tabular-nums">{total}</td>
      {/* Entregadas */}
      <td className="px-1.5 py-1.5">
        <input type="number" min="0" value={ed.entregadas}
          onChange={e => set("entregadas", e.target.value)}
          placeholder="—"
          className={`${inp} w-14 text-center font-mono`} />
      </td>
      {/* Fecha */}
      <td className="px-1.5 py-1.5">
        <input type="date" value={ed.fecha_entrega || ""}
          onChange={e => set("fecha_entrega", e.target.value)}
          className={`${inp}`} />
      </td>
      {/* Coordinador */}
      <td className="px-1.5 py-1.5">
        <input type="text" value={ed.coordinador}
          onChange={e => set("coordinador", e.target.value)}
          placeholder="Coordinador"
          className={`${inp} w-28`} />
      </td>
      {/* Chofer */}
      <td className="px-1.5 py-1.5">
        <input type="text" value={ed.camioneta_repartidor}
          onChange={e => set("camioneta_repartidor", e.target.value)}
          placeholder="Chofer"
          className={`${inp} w-24`} />
      </td>
      {/* Viaje */}
      <td className="px-1.5 py-1.5">
        <input type="number" min="1" max="9" value={ed.numero_viaje}
          onChange={e => set("numero_viaje", e.target.value)}
          className={`${inp} w-12 text-center font-mono`} />
      </td>
      {/* Ubicación */}
      <td className="px-1.5 py-1.5">
        <input type="text" value={ed.ubicacion}
          onChange={e => set("ubicacion", e.target.value)}
          placeholder="URL o nombre del punto"
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
        <button
          onClick={handleGuardar}
          disabled={saving || !dirty}
          title={dirty ? "Guardar cambios" : "Sin cambios pendientes"}
          className={`w-8 h-8 flex items-center justify-center rounded-lg font-bold text-sm transition-all cursor-pointer
            ${dirty
              ? "bg-blue-600 text-white hover:bg-blue-700 shadow-sm"
              : "bg-slate-100 text-slate-300 cursor-default"
            } disabled:opacity-60`}
        >
          {saving ? "…" : "✓"}
        </button>
      </td>
    </tr>
  );
}

// ── Componente principal ──────────────────────────────────────────────────────
export default function MercadoControl() {
  const navigate = useNavigate();

  // Lista de entregas existentes
  const [entregas, setEntregas] = useState([]);
  // Entrega seleccionada actualmente
  const [selEntrega, setSelEntrega] = useState(null); // {año, mes, entrega}
  // Filas de esa entrega
  const [filas, setFilas] = useState([]);
  const [cargando, setCargando] = useState(false);
  // Sector activo para filtrar
  const [sectorTab, setSectorTab] = useState(null);
  // Fila que se está guardando
  const [savingId, setSavingId] = useState(null);

  // Modal "Nueva Entrega"
  const [modalNueva, setModalNueva] = useState(false);
  const [nuevaForm, setNuevaForm] = useState({
    año: new Date().getFullYear(),
    mes: MESES[new Date().getMonth()],
    entrega: 1,
    copiarSM: true,
  });
  const [generando, setGenerando] = useState(false);
  const [genStatus, setGenStatus] = useState(""); // mensaje de progreso

  // ── Cargar lista de entregas ────────────────────────────────────────────────
  const cargarEntregas = useCallback(async () => {
    const { data } = await supabaseAdmin
      .from("mercado")
      .select("año,mes,entrega,sector")
      .order("entrega", { ascending: false });
    if (!data) return;

    const map = new Map();
    for (const r of data) {
      const key = `${r.año}_${r.mes}_${r.entrega}`;
      if (!map.has(key)) {
        map.set(key, { año: r.año, mes: r.mes, entrega: r.entrega, secciones: 0, sectores: new Set() });
      }
      const entry = map.get(key);
      entry.secciones++;
      if (r.sector) entry.sectores.add(r.sector);
    }
    setEntregas(
      [...map.values()]
        .map(e => ({ ...e, sectores: [...e.sectores].sort((a,b) => a-b) }))
        .sort((a, b) => b.entrega - a.entrega || b.año - a.año)
    );
  }, []);

  useEffect(() => { cargarEntregas(); }, [cargarEntregas]);

  // ── Cargar filas de la entrega seleccionada ─────────────────────────────────
  const cargarFilas = useCallback(async (año, mes, entrega) => {
    setCargando(true);
    const { data } = await supabaseAdmin
      .from("mercado")
      .select("*")
      .eq("año", año).eq("mes", mes).eq("entrega", entrega)
      .order("sector").order("seccion");
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

  // Al abrir el modal: auto-calcular número siguiente
  useEffect(() => {
    if (modalNueva) {
      const nextNum = entregas.length > 0 ? (entregas[0].entrega + 1) : 1;
      setNuevaForm(p => ({ ...p, entrega: nextNum }));
      setGenStatus("");
    }
  }, [modalNueva, entregas]);

  // ── Crear nueva entrega ─────────────────────────────────────────────────────
  const crearNuevaEntrega = async () => {
    setGenerando(true);
    setGenStatus("Obteniendo secciones...");
    try {
      // 1. Fracciones por sección desde ubt_catalogo
      const { data: cats, error: eCat } = await supabaseAdmin
        .from("ubt_catalogo")
        .select("sector, seccion, fraccion")
        .order("sector").order("seccion");
      if (eCat) throw eCat;
      if (!cats?.length) throw new Error("No se encontraron secciones en ubt_catalogo.");

      // Agrupar: sector+seccion → count fracciones
      const grupoMap = new Map();
      for (const r of cats) {
        const key = `${r.sector}_${r.seccion}`;
        if (!grupoMap.has(key)) grupoMap.set(key, { sector: r.sector, seccion: r.seccion, fracciones: 0 });
        grupoMap.get(key).fracciones++;
      }

      // 2. Copiar SM activas de la entrega más reciente (si la opción está activa)
      let smPrevMap = new Map(); // "sector_seccion" → sm_activas
      if (nuevaForm.copiarSM && entregas.length > 0) {
        const prev = entregas[0];
        setGenStatus("Copiando SM activas de entrega anterior...");
        const { data: prevFilas } = await supabaseAdmin
          .from("mercado")
          .select("sector, seccion, sm_activas")
          .eq("año", prev.año).eq("mes", prev.mes).eq("entrega", prev.entrega);
        for (const f of (prevFilas ?? [])) {
          smPrevMap.set(`${f.sector}_${f.seccion}`, f.sm_activas ?? 0);
        }
      }

      // 3. Construir filas
      const rows = [...grupoMap.values()].map(g => ({
        "año":                nuevaForm.año,
        mes:                  nuevaForm.mes,
        entrega:              nuevaForm.entrega,
        sector:               g.sector,
        seccion:              g.seccion,
        fracciones:           g.fracciones,
        sm_activas:           smPrevMap.get(`${g.sector}_${g.seccion}`) ?? 0,
        piezas:               20,
        total:                0,
        entregadas:           null,
        estatus:              "PENDIENTE",
        numero_viaje:         1,
        camioneta_repartidor: null,
        coordinador:          null,
        ubicacion:            null,
        nombre:               null,
        fecha_entrega:        null,
      }));

      setGenStatus(`Borrando entrega ${nuevaForm.entrega} si existía...`);
      await supabaseAdmin.from("mercado").delete()
        .eq("año", nuevaForm.año).eq("mes", nuevaForm.mes).eq("entrega", nuevaForm.entrega);

      setGenStatus(`Insertando ${rows.length} secciones...`);
      const BATCH = 100;
      for (let i = 0; i < rows.length; i += BATCH) {
        const { error } = await supabaseAdmin.from("mercado").insert(rows.slice(i, i + BATCH));
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

  // ── Guardar fila individual ─────────────────────────────────────────────────
  const handleGuardar = async (id, data, resetDirty) => {
    setSavingId(id);
    const { error } = await supabaseAdmin.from("mercado").update(data).eq("id", id);
    if (error) {
      alert("Error al guardar: " + error.message);
    } else {
      setFilas(prev => prev.map(f => f.id === id ? { ...f, ...data } : f));
      resetDirty();
    }
    setSavingId(null);
  };

  // ── Derivados ───────────────────────────────────────────────────────────────
  const sectoresDisp = useMemo(
    () => [...new Set(filas.map(f => f.sector).filter(Boolean))].sort((a, b) => a - b),
    [filas]
  );

  const filasFiltradas = useMemo(
    () => (sectorTab !== null ? filas.filter(f => f.sector === sectorTab) : filas),
    [filas, sectorTab]
  );

  const totales = useMemo(() => ({
    secciones: filasFiltradas.length,
    total:     filasFiltradas.reduce((s, f) => s + ((f.piezas || 0) * (f.sm_activas || 0)), 0),
    entregadas:filasFiltradas.reduce((s, f) => s + (f.entregadas || 0), 0),
    pendientes:filasFiltradas.filter(f => (f.estatus ?? "PENDIENTE") === "PENDIENTE").length,
    entregados:filasFiltradas.filter(f => f.estatus === "ENTREGADO").length,
  }), [filasFiltradas]);

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="bg-gradient-to-r from-blue-800 to-blue-900 px-4 py-4 shadow-lg">
        <div className="flex items-center gap-3 flex-wrap">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-all shrink-0"
          >←</button>

          <div className="mr-auto">
            <p className="text-blue-300 text-[10px] font-bold uppercase tracking-widest leading-none">Mercado Solidario</p>
            <h1 className="text-white font-black text-lg leading-tight">Control de Entregas</h1>
          </div>

          {/* Selector de entrega */}
          <select
            onChange={handleSelectEntrega}
            value={selEntrega ? `${selEntrega.año}|${selEntrega.mes}|${selEntrega.entrega}` : ""}
            className="bg-white/10 border border-white/20 text-white text-sm font-semibold rounded-xl px-3 py-2 focus:outline-none min-w-[200px]"
          >
            <option value="" disabled>Seleccionar entrega...</option>
            {entregas.map(e => (
              <option
                key={`${e.año}_${e.mes}_${e.entrega}`}
                value={`${e.año}|${e.mes}|${e.entrega}`}
                className="text-slate-900 bg-white"
              >
                Entrega {e.entrega} — {e.mes} {e.año} · {e.secciones} secc.
              </option>
            ))}
          </select>

          <button
            onClick={() => setModalNueva(true)}
            className="bg-emerald-500 hover:bg-emerald-400 text-white font-bold text-sm px-4 py-2.5 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer"
          >
            + Nueva entrega
          </button>
        </div>
      </div>

      {/* ── Sin entrega seleccionada ────────────────────────────────────────── */}
      {!selEntrega && (
        <div className="flex-1 flex flex-col items-center justify-center py-24 select-none">
          <p className="text-5xl mb-4 opacity-20">📦</p>
          <p className="text-slate-500 font-semibold text-base">Selecciona una entrega o crea una nueva</p>
          <p className="text-slate-400 text-sm mt-1">Las filas se generan automáticamente para todas las secciones</p>
        </div>
      )}

      {selEntrega && (
        <>
          {/* ── Tabs de sector + totales ──────────────────────────────────── */}
          <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
            <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto">
              <button
                onClick={() => setSectorTab(null)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 whitespace-nowrap transition-all cursor-pointer ${
                  sectorTab === null
                    ? "bg-blue-600 text-white border-blue-600"
                    : "border-slate-200 text-slate-600 hover:border-blue-300"
                }`}
              >
                Todos
              </button>
              {sectoresDisp.map(s => (
                <button key={s}
                  onClick={() => setSectorTab(s)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border-2 whitespace-nowrap transition-all cursor-pointer ${
                    sectorTab === s
                      ? "bg-blue-600 text-white border-blue-600"
                      : "border-slate-200 text-slate-600 hover:border-blue-300"
                  }`}
                >
                  Sector {s}
                </button>
              ))}

              {/* Totales */}
              <div className="ml-auto flex items-center gap-3 text-xs font-semibold text-slate-500 shrink-0 pl-4 border-l border-slate-200">
                <span>{totales.secciones} secc.</span>
                <span className="text-blue-700 font-black">{totales.total} costales</span>
                {totales.entregadas > 0 && (
                  <span className="text-emerald-600">{totales.entregadas} entregados</span>
                )}
                {totales.pendientes > 0 && (
                  <span className="text-amber-600">{totales.pendientes} pendientes</span>
                )}
              </div>
            </div>
          </div>

          {/* ── Tabla ──────────────────────────────────────────────────────── */}
          {cargando ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-3 h-3 rounded-full bg-blue-400 animate-pulse mr-2" />
              <p className="text-slate-400 text-sm">Cargando filas...</p>
            </div>
          ) : (
            <div className="overflow-x-auto flex-1">
              <table className="w-full min-w-max bg-white text-sm">
                <thead className="sticky top-[49px] z-10">
                  <tr className="bg-slate-100 border-b-2 border-slate-300 text-[10px] text-slate-500 uppercase tracking-wider">
                    <th className="px-3 py-3 text-left font-bold whitespace-nowrap">Sección</th>
                    <th className="px-3 py-3 text-center font-bold">Fracc.</th>
                    <th className="px-3 py-3 text-center font-bold">SM Act.</th>
                    <th className="px-3 py-3 text-center font-bold">Piezas</th>
                    <th className="px-3 py-3 text-center font-bold text-blue-700">Total</th>
                    <th className="px-3 py-3 text-center font-bold">Entregadas</th>
                    <th className="px-3 py-3 text-left font-bold">Fecha</th>
                    <th className="px-3 py-3 text-left font-bold">Coordinador</th>
                    <th className="px-3 py-3 text-left font-bold">Chofer</th>
                    <th className="px-3 py-3 text-center font-bold">Viaje</th>
                    <th className="px-3 py-3 text-left font-bold">Ubicación</th>
                    <th className="px-3 py-3 text-left font-bold">Estatus</th>
                    <th className="px-3 py-3 text-center font-bold"></th>
                  </tr>
                </thead>
                <tbody>
                  {filasFiltradas.length === 0 ? (
                    <tr>
                      <td colSpan={13} className="text-center py-10 text-slate-400 text-sm">
                        No hay secciones para este filtro
                      </td>
                    </tr>
                  ) : (
                    filasFiltradas.map(row => (
                      <FilaEntrega
                        key={row.id}
                        row={row}
                        onSave={handleGuardar}
                        saving={savingId === row.id}
                      />
                    ))
                  )}
                </tbody>
                {/* Fila de totales al final de la sección filtrada */}
                {filasFiltradas.length > 0 && (
                  <tfoot>
                    <tr className="bg-blue-50 border-t-2 border-blue-200 text-sm font-bold text-blue-800">
                      <td className="px-3 py-2" colSpan={2}>Total</td>
                      <td className="px-3 py-2 text-center">
                        {filasFiltradas.reduce((s, f) => s + (f.sm_activas || 0), 0)}
                      </td>
                      <td className="px-3 py-2 text-center">—</td>
                      <td className="px-3 py-2 text-center text-blue-900">{totales.total}</td>
                      <td className="px-3 py-2 text-center text-emerald-700">{totales.entregadas || "—"}</td>
                      <td colSpan={7} />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
        </>
      )}

      {/* ── Modal Nueva Entrega ─────────────────────────────────────────────── */}
      {modalNueva && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-gradient-to-r from-blue-700 to-blue-900 px-6 py-5">
              <h2 className="text-white font-black text-base leading-none">Nueva Entrega</h2>
              <p className="text-blue-200 text-xs mt-1 leading-snug">
                Se generará una fila por cada sección registrada en el catálogo
              </p>
            </div>

            <div className="p-6 space-y-4">
              {/* Año / Mes / Número */}
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Año</label>
                  <input
                    type="number"
                    value={nuevaForm.año}
                    onChange={e => setNuevaForm(p => ({ ...p, año: parseInt(e.target.value) || p.año }))}
                    className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Mes</label>
                  <select
                    value={nuevaForm.mes}
                    onChange={e => setNuevaForm(p => ({ ...p, mes: e.target.value }))}
                    className="w-full border-2 border-slate-200 rounded-xl px-2 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500"
                  >
                    {MESES.map(m => <option key={m} value={m}>{m.charAt(0) + m.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Entrega #</label>
                  <input
                    type="number"
                    min="1"
                    value={nuevaForm.entrega}
                    onChange={e => setNuevaForm(p => ({ ...p, entrega: parseInt(e.target.value) || 1 }))}
                    className="w-full border-2 border-slate-200 rounded-xl px-3 py-2 text-sm font-bold font-mono focus:outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Opción: copiar SM activas */}
              <label className="flex items-start gap-3 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={nuevaForm.copiarSM}
                  onChange={e => setNuevaForm(p => ({ ...p, copiarSM: e.target.checked }))}
                  className="mt-0.5 w-4 h-4 rounded accent-blue-600"
                />
                <div>
                  <p className="text-sm font-semibold text-slate-700 group-hover:text-blue-700 transition-colors">
                    Copiar SM activas de entrega anterior
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {entregas.length > 0
                      ? `Tomará los valores de Entrega ${entregas[0].entrega} (${entregas[0].mes} ${entregas[0].año})`
                      : "No hay entrega anterior disponible"}
                  </p>
                </div>
              </label>

              {/* Advertencia si ya existe */}
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2 text-xs text-amber-700">
                ⚠ Si ya existe una Entrega <strong>{nuevaForm.entrega}</strong> para <strong>{nuevaForm.mes} {nuevaForm.año}</strong>, sus datos serán eliminados y reemplazados.
              </div>

              {/* Progreso de generación */}
              {generando && genStatus && (
                <div className="flex items-center gap-2 text-xs text-blue-600">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse shrink-0" />
                  {genStatus}
                </div>
              )}

              {/* Botones */}
              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setModalNueva(false)}
                  disabled={generando}
                  className="flex-1 border-2 border-slate-200 text-slate-600 font-semibold py-2.5 rounded-xl text-sm hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={crearNuevaEntrega}
                  disabled={generando}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black py-2.5 rounded-xl text-sm disabled:opacity-50 transition-all cursor-pointer shadow-sm"
                >
                  {generando ? "Generando..." : "Generar entrega"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
