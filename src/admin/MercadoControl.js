/*
 * ── SQL — Ejecutar en Supabase una sola vez antes de usar este módulo ──────────
 *
 * CREATE TABLE IF NOT EXISTS mercado_entregas (
 *   id         SERIAL PRIMARY KEY,
 *   anio       INT NOT NULL,
 *   mes        TEXT NOT NULL,
 *   numero     INT NOT NULL,
 *   fecha_ini  DATE,
 *   fecha_fin  DATE,
 *   status     TEXT DEFAULT 'PLANIFICANDO'
 *                CHECK (status IN ('PLANIFICANDO','EN_PROCESO','COMPLETADA')),
 *   notas      TEXT,
 *   created_at TIMESTAMPTZ DEFAULT NOW(),
 *   UNIQUE (anio, mes, numero)
 * );
 *
 * CREATE TABLE IF NOT EXISTS mercado_paradas (
 *   id                 SERIAL PRIMARY KEY,
 *   entrega_id         INT NOT NULL REFERENCES mercado_entregas(id) ON DELETE CASCADE,
 *   viaje              INT DEFAULT 1,
 *   camioneta          TEXT,
 *   fecha_viaje        DATE,
 *   orden_parada       INT DEFAULT 0,
 *   coordinador        TEXT,
 *   sector             INT,
 *   seccion            INT,
 *   fracciones         INT DEFAULT 0,
 *   sm_activas         INT DEFAULT 0,
 *   piezas_por_sm      INT DEFAULT 20,
 *   total_costales     INT DEFAULT 0,
 *   entregadas         INT,
 *   nombre_responsable TEXT,
 *   telefono           TEXT,
 *   ubicacion_url      TEXT,
 *   latitud            DOUBLE PRECISION,
 *   longitud           DOUBLE PRECISION,
 *   ubicacion_repetida BOOLEAN DEFAULT FALSE,
 *   status             TEXT DEFAULT 'PENDIENTE'
 *                        CHECK (status IN ('PENDIENTE','ENTREGADO','PARCIAL','NO_ENTREGADO')),
 *   notas              TEXT,
 *   created_at         TIMESTAMPTZ DEFAULT NOW()
 * );
 */

import React, { useEffect, useMemo, useState } from "react";
import supabase from "../supabase/client";

// ── Constantes ────────────────────────────────────────────────────────────────
const MESES = [
  "ENERO","FEBRERO","MARZO","ABRIL","MAYO","JUNIO",
  "JULIO","AGOSTO","SEPTIEMBRE","OCTUBRE","NOVIEMBRE","DICIEMBRE",
];

const ST_ENTREGA = {
  PLANIFICANDO: "bg-amber-100 text-amber-700 border-amber-200",
  EN_PROCESO:   "bg-blue-100 text-blue-700 border-blue-200",
  COMPLETADA:   "bg-emerald-100 text-emerald-700 border-emerald-200",
};
const ST_PARADA = {
  PENDIENTE:     "bg-amber-100 text-amber-700 border-amber-200",
  ENTREGADO:     "bg-emerald-100 text-emerald-700 border-emerald-200",
  PARCIAL:       "bg-orange-100 text-orange-700 border-orange-200",
  NO_ENTREGADO:  "bg-red-100 text-red-700 border-red-200",
};

const EMPTY_ENTREGA = {
  anio: new Date().getFullYear(), mes: MESES[new Date().getMonth()],
  numero: 1, fecha_ini: "", fecha_fin: "", status: "PLANIFICANDO", notas: "",
};
const EMPTY_PARADA = {
  viaje: 1, camioneta: "", fecha_viaje: "", orden_parada: "",
  coordinador: "", sector: "", seccion: "", fracciones: "",
  sm_activas: "", piezas_por_sm: 20,
  nombre_responsable: "", telefono: "", ubicacion_url: "",
  latitud: "", longitud: "", ubicacion_repetida: false,
  status: "PENDIENTE", notas: "", entregadas: "",
};

// ── Helpers ────────────────────────────────────────────────────────────────────
const fmtMes = (m) => (m ? m.charAt(0) + m.slice(1).toLowerCase() : "");
const calcTotal = (sm, piezas) => (Number(sm) || 0) * (Number(piezas) || 0);

// ── UI Atoms ───────────────────────────────────────────────────────────────────
const Btn = ({ children, v = "primary", sm: small, className = "", ...rest }) => {
  const base = `inline-flex items-center gap-1.5 font-bold rounded-xl transition-all active:scale-95
    disabled:opacity-40 disabled:cursor-not-allowed focus:outline-none
    ${small ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"}`;
  const vs = {
    primary: "bg-blue-800 text-white hover:bg-blue-900 shadow-sm",
    success: "bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm",
    danger:  "bg-red-600 text-white hover:bg-red-700 shadow-sm",
    ghost:   "text-slate-500 hover:text-slate-800 hover:bg-slate-100",
    outline: "border border-slate-200 text-slate-700 hover:bg-slate-50",
  };
  return <button {...rest} className={`${base} ${vs[v]} ${className}`}>{children}</button>;
};

const Field = ({ label, required, children }) => (
  <div className="space-y-1">
    {label && (
      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex gap-1">
        {label}{required && <span className="text-red-500">*</span>}
      </label>
    )}
    {children}
  </div>
);

const Inp = ({ label, required, className = "", ...rest }) => (
  <Field label={label} required={required}>
    <input
      {...rest}
      className={`w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900
        placeholder-slate-400 text-sm font-medium focus:outline-none focus:ring-2
        focus:ring-blue-500/20 focus:border-blue-500 transition-all ${className}`}
    />
  </Field>
);

const Sel = ({ label, required, children, ...rest }) => (
  <Field label={label} required={required}>
    <select
      {...rest}
      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white text-slate-900
        text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20
        focus:border-blue-500 transition-all"
    >
      {children}
    </select>
  </Field>
);

const Badge = ({ text, style }) => (
  <span className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold
    uppercase tracking-wide border whitespace-nowrap ${style}`}>
    {text.replace("_", " ")}
  </span>
);

const Card = ({ children, className = "" }) => (
  <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm ${className}`}>
    {children}
  </div>
);

const Modal = ({ title, onClose, children, wide }) => (
  <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40
    backdrop-blur-sm p-4 overflow-y-auto">
    <div className={`bg-white rounded-2xl shadow-xl w-full mt-6 mb-6
      ${wide ? "max-w-2xl" : "max-w-lg"}`}>
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <h3 className="text-sm font-black text-slate-900">{title}</h3>
        <button onClick={onClose}
          className="text-slate-400 hover:text-slate-700 text-xl leading-none font-bold px-2">
          ×
        </button>
      </div>
      <div className="px-5 py-4 max-h-[80vh] overflow-y-auto">{children}</div>
    </div>
  </div>
);

// ── Modal: Nueva / Editar Entrega ─────────────────────────────────────────────
const ModalEntrega = ({ inicial, onSave, onClose, guardando }) => {
  const [f, setF] = useState(inicial ?? EMPTY_ENTREGA);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  return (
    <Modal title={f.id ? "Editar ciclo de entrega" : "Nuevo ciclo de entrega"} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Inp label="Año" required type="number" value={f.anio}
            onChange={e => set("anio", e.target.value)} />
          <Sel label="Mes" required value={f.mes} onChange={e => set("mes", e.target.value)}>
            {MESES.map(m => <option key={m}>{m}</option>)}
          </Sel>
          <Inp label="# Entrega" required type="number" min={1} value={f.numero}
            onChange={e => set("numero", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Inp label="Fecha inicio" type="date" value={f.fecha_ini}
            onChange={e => set("fecha_ini", e.target.value)} />
          <Inp label="Fecha fin" type="date" value={f.fecha_fin}
            onChange={e => set("fecha_fin", e.target.value)} />
        </div>
        <Sel label="Estatus" value={f.status} onChange={e => set("status", e.target.value)}>
          <option value="PLANIFICANDO">Planificando</option>
          <option value="EN_PROCESO">En proceso</option>
          <option value="COMPLETADA">Completada</option>
        </Sel>
        <Field label="Notas">
          <textarea value={f.notas} onChange={e => set("notas", e.target.value)} rows={2}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm resize-none
              focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            placeholder="Observaciones opcionales..." />
        </Field>
        <div className="flex gap-2 pt-1">
          <Btn disabled={guardando} onClick={() => onSave(f)}>
            {guardando ? "Guardando..." : "Guardar"}
          </Btn>
          <Btn v="ghost" onClick={onClose}>Cancelar</Btn>
        </div>
      </div>
    </Modal>
  );
};

// ── Modal: Nueva / Editar Parada ──────────────────────────────────────────────
const ModalParada = ({ inicial, onSave, onClose, guardando }) => {
  const [f, setF] = useState(inicial ?? EMPTY_PARADA);
  const set = (k, v) => setF(p => ({ ...p, [k]: v }));
  const total = calcTotal(f.sm_activas, f.piezas_por_sm);

  return (
    <Modal title={f.id ? "Editar punto de entrega" : "Agregar punto de entrega"} onClose={onClose} wide>
      <div className="space-y-3">
        {/* Ruta */}
        <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest">
          Ruta / Viaje
        </p>
        <div className="grid grid-cols-3 gap-3">
          <Inp label="Viaje #" required type="number" min={1} value={f.viaje}
            onChange={e => set("viaje", e.target.value)} />
          <Inp label="Chofer / Camioneta" value={f.camioneta} placeholder="Ej. SERGIO"
            onChange={e => set("camioneta", e.target.value.toUpperCase())} />
          <Inp label="Fecha de entrega" type="date" value={f.fecha_viaje}
            onChange={e => set("fecha_viaje", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Inp label="Orden en la ruta" type="number" min={0} value={f.orden_parada}
            placeholder="0 = primero"
            onChange={e => set("orden_parada", e.target.value)} />
          <Sel label="Estatus" value={f.status} onChange={e => set("status", e.target.value)}>
            <option value="PENDIENTE">Pendiente</option>
            <option value="ENTREGADO">Entregado</option>
            <option value="PARCIAL">Parcial</option>
            <option value="NO_ENTREGADO">No entregado</option>
          </Sel>
        </div>

        {/* Sector / Sección */}
        <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest pt-1">
          Sector / Sección
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Inp label="Coordinador de sector" required value={f.coordinador}
            placeholder="Nombre del coordinador"
            onChange={e => set("coordinador", e.target.value.toUpperCase())} />
          <Inp label="Sector #" required type="number" value={f.sector}
            onChange={e => set("sector", e.target.value)} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <Inp label="Sección" required type="number" value={f.seccion}
            onChange={e => set("seccion", e.target.value)} />
          <Inp label="Fracciones" type="number" value={f.fracciones}
            onChange={e => set("fracciones", e.target.value)} />
          <Inp label="SM activas" required type="number" value={f.sm_activas}
            onChange={e => set("sm_activas", e.target.value)} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Inp label="Piezas por SM" required type="number" value={f.piezas_por_sm}
            onChange={e => set("piezas_por_sm", e.target.value)} />
          <Field label="Total costales (automático)">
            <div className="px-3 py-2 rounded-xl border border-blue-100 bg-blue-50
              text-sm font-black text-blue-800">
              {total} costales
            </div>
          </Field>
        </div>
        {f.status !== "PENDIENTE" && (
          <Inp label="Cantidad entregada" type="number" min={0} max={total}
            value={f.entregadas} onChange={e => set("entregadas", e.target.value)} />
        )}

        {/* Punto de entrega */}
        <p className="text-[10px] font-bold text-blue-700 uppercase tracking-widest pt-1">
          Punto de entrega
        </p>
        <div className="grid grid-cols-2 gap-3">
          <Inp label="Responsable del punto" value={f.nombre_responsable}
            onChange={e => set("nombre_responsable", e.target.value.toUpperCase())} />
          <Inp label="Teléfono" inputMode="tel" value={f.telefono}
            onChange={e => set("telefono", e.target.value)} />
        </div>
        <Inp label="URL Google Maps" value={f.ubicacion_url}
          placeholder="https://maps.app.goo.gl/..."
          onChange={e => set("ubicacion_url", e.target.value)} />
        <div className="grid grid-cols-2 gap-3">
          <Inp label="Latitud" type="number" step="any" value={f.latitud}
            onChange={e => set("latitud", e.target.value)} />
          <Inp label="Longitud" type="number" step="any" value={f.longitud}
            onChange={e => set("longitud", e.target.value)} />
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={f.ubicacion_repetida}
            onChange={e => set("ubicacion_repetida", e.target.checked)}
            className="h-4 w-4 rounded text-blue-600" />
          <span className="text-sm text-slate-700 font-medium">
            Ubicación compartida entre varias secciones (★)
          </span>
        </label>
        <Field label="Notas">
          <textarea value={f.notas} onChange={e => set("notas", e.target.value)} rows={2}
            className="w-full px-3 py-2 rounded-xl border border-slate-200 text-sm resize-none
              focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
            placeholder="Observaciones..." />
        </Field>
        <div className="flex gap-2 pt-1">
          <Btn disabled={guardando}
            onClick={() => onSave({ ...f, total_costales: total })}>
            {guardando ? "Guardando..." : "Guardar punto"}
          </Btn>
          <Btn v="ghost" onClick={onClose}>Cancelar</Btn>
        </div>
      </div>
    </Modal>
  );
};

// ── Tab: Resumen ──────────────────────────────────────────────────────────────
const TabResumen = ({ paradas, entrega, onEditar }) => {
  const stats = useMemo(() => {
    const totalCostales  = paradas.reduce((s, p) => s + (Number(p.total_costales) || 0), 0);
    const entregadas     = paradas.reduce((s, p) => s + (Number(p.entregadas) || 0), 0);
    const smTotal        = paradas.reduce((s, p) => s + (Number(p.sm_activas) || 0), 0);
    const puntosOk       = paradas.filter(p => p.status === "ENTREGADO").length;
    const viajes         = new Set(paradas.map(p => `${p.viaje}-${p.camioneta}-${p.fecha_viaje}`)).size;
    const secciones      = new Set(paradas.map(p => p.seccion).filter(Boolean)).size;
    return { totalCostales, entregadas, smTotal, puntosOk, viajes, secciones, total: paradas.length };
  }, [paradas]);

  const pct = stats.totalCostales > 0
    ? Math.round((stats.entregadas / stats.totalCostales) * 100) : 0;

  const porSector = useMemo(() => {
    const map = {};
    paradas.forEach(p => {
      const k = p.sector;
      if (!map[k]) map[k] = { sector: k, coord: p.coordinador, paradas: [] };
      map[k].paradas.push(p);
    });
    return Object.values(map).sort((a, b) => (a.sector || 0) - (b.sector || 0));
  }, [paradas]);

  return (
    <div className="space-y-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total costales", val: stats.totalCostales.toLocaleString(), color: "text-blue-800" },
          { label: "Entregados",     val: stats.entregadas.toLocaleString(),     color: "text-emerald-700" },
          { label: "Secciones",      val: stats.secciones,  color: "text-slate-800" },
          { label: "Viajes",         val: stats.viajes,     color: "text-slate-800" },
        ].map(s => (
          <Card key={s.label} className="p-3 text-center">
            <p className={`text-2xl font-black ${s.color}`}>{s.val}</p>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">{s.label}</p>
          </Card>
        ))}
      </div>

      {/* Barra de progreso general */}
      <Card className="p-4">
        <div className="flex justify-between items-center mb-2">
          <p className="text-xs font-bold text-slate-600">Progreso de entrega</p>
          <p className="text-xs font-black text-blue-800">{pct}%</p>
        </div>
        <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
          <div className="h-full bg-blue-700 rounded-full transition-all duration-700"
            style={{ width: `${pct}%` }} />
        </div>
        <p className="text-[10px] text-slate-400 mt-2">
          {stats.puntosOk} de {stats.total} puntos completados
          · {stats.smTotal} SM · {stats.totalCostales - stats.entregadas} costales restantes
        </p>
      </Card>

      {/* Por sector */}
      {porSector.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Por sector</p>
          {porSector.map(s => {
            const t = s.paradas.reduce((a, p) => a + (Number(p.total_costales) || 0), 0);
            const d = s.paradas.reduce((a, p) => a + (Number(p.entregadas) || 0), 0);
            const p = t > 0 ? Math.round((d / t) * 100) : 0;
            const smSec = s.paradas.reduce((a, p) => a + (Number(p.sm_activas) || 0), 0);
            const ok = s.paradas.filter(x => x.status === "ENTREGADO").length;
            return (
              <Card key={s.sector} className="p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-black text-slate-800">Sector {s.sector}</span>
                    {s.coord && <span className="text-xs text-slate-400">— {s.coord}</span>}
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-slate-600">{t} costales · {smSec} SM</span>
                    <span className="text-xs text-slate-400 ml-2">{ok}/{s.paradas.length} puntos</span>
                  </div>
                </div>
                <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                  <div className="h-full bg-emerald-500 rounded-full transition-all"
                    style={{ width: `${p}%` }} />
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {paradas.length === 0 && (
        <Card className="p-8 text-center">
          <p className="text-2xl mb-2">📦</p>
          <p className="text-sm font-bold text-slate-400">Sin puntos de entrega registrados</p>
          <p className="text-xs text-slate-300 mt-1">Ve a Planeación para agregar secciones.</p>
        </Card>
      )}
    </div>
  );
};

// ── Tab: Planeación ────────────────────────────────────────────────────────────
const TabPlaneacion = ({ paradas, onAgregar, onEditar, onEliminar, onCambiarStatus, guardandoId }) => {
  const [filtCoord,  setFiltCoord]  = useState("");
  const [filtSector, setFiltSector] = useState("");
  const [filtStatus, setFiltStatus] = useState("");

  const coords   = [...new Set(paradas.map(p => p.coordinador).filter(Boolean))].sort();
  const sectores = [...new Set(paradas.map(p => p.sector).filter(x => x != null))].sort((a, b) => a - b);

  const lista = paradas.filter(p =>
    (!filtCoord  || p.coordinador === filtCoord) &&
    (!filtSector || String(p.sector) === filtSector) &&
    (!filtStatus || p.status === filtStatus)
  );

  const totFiltrado = lista.reduce((s, p) => s + (Number(p.total_costales) || 0), 0);
  const smFiltradas = lista.reduce((s, p) => s + (Number(p.sm_activas) || 0), 0);

  return (
    <div className="space-y-4">
      {/* Filtros + botón agregar */}
      <div className="flex flex-wrap items-end gap-2">
        <select value={filtCoord} onChange={e => setFiltCoord(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium
            focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
          <option value="">Todos los coordinadores</option>
          {coords.map(c => <option key={c}>{c}</option>)}
        </select>
        <select value={filtSector} onChange={e => setFiltSector(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium
            focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
          <option value="">Todos los sectores</option>
          {sectores.map(s => <option key={s} value={s}>Sector {s}</option>)}
        </select>
        <select value={filtStatus} onChange={e => setFiltStatus(e.target.value)}
          className="px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium
            focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500">
          <option value="">Todos los estatus</option>
          <option value="PENDIENTE">Pendiente</option>
          <option value="ENTREGADO">Entregado</option>
          <option value="PARCIAL">Parcial</option>
          <option value="NO_ENTREGADO">No entregado</option>
        </select>
        <div className="flex-1" />
        <Btn v="primary" sm onClick={onAgregar}>+ Agregar punto</Btn>
      </div>

      {lista.length > 0 && (
        <div className="flex gap-4 text-xs text-slate-500 font-medium">
          <span>{lista.length} puntos</span>
          <span>{smFiltradas} SM</span>
          <span className="font-black text-blue-800">{totFiltrado.toLocaleString()} costales</span>
        </div>
      )}

      {lista.length === 0 ? (
        <Card className="p-6 text-center">
          <p className="text-sm text-slate-400">
            {filtCoord || filtSector || filtStatus
              ? "Sin resultados con estos filtros."
              : "Usa «Agregar punto» para registrar secciones con el coordinador."}
          </p>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50 text-[10px] font-bold
                text-slate-400 uppercase tracking-wider">
                {["Sector","Sección","Coordinador","SM","Piezas","Total","Entregadas",
                  "Estatus","Viaje","Responsable","Ubicación",""].map(h => (
                  <th key={h} className={`px-3 py-2.5 ${h === "" || h === "Estatus" || h === "Viaje"
                    ? "text-center" : h === "SM" || h === "Piezas" || h === "Total" || h === "Entregadas"
                    ? "text-right" : "text-left"}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {lista.map(p => (
                <tr key={p.id} className="border-b border-slate-50 hover:bg-slate-50/50 transition-colors">
                  <td className="px-3 py-2.5 font-bold text-slate-700">{p.sector}</td>
                  <td className="px-3 py-2.5 font-mono font-bold text-slate-900">{p.seccion}</td>
                  <td className="px-3 py-2.5 text-slate-600 max-w-[110px] truncate">{p.coordinador}</td>
                  <td className="px-3 py-2.5 text-right text-slate-700">{p.sm_activas}</td>
                  <td className="px-3 py-2.5 text-right text-slate-500">{p.piezas_por_sm}</td>
                  <td className="px-3 py-2.5 text-right font-black text-blue-800">{p.total_costales}</td>
                  <td className="px-3 py-2.5 text-right">
                    {p.entregadas != null ? (
                      <span className={p.entregadas < p.total_costales
                        ? "text-orange-600 font-bold" : "text-emerald-700 font-bold"}>
                        {p.entregadas}
                      </span>
                    ) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <select
                      value={p.status}
                      disabled={guardandoId === p.id}
                      onChange={e => onCambiarStatus(p, e.target.value)}
                      className={`text-[10px] font-bold rounded-lg px-2 py-1 border
                        focus:outline-none cursor-pointer ${ST_PARADA[p.status] || "bg-slate-100 text-slate-500 border-slate-200"}`}
                    >
                      <option value="PENDIENTE">PENDIENTE</option>
                      <option value="ENTREGADO">ENTREGADO</option>
                      <option value="PARCIAL">PARCIAL</option>
                      <option value="NO_ENTREGADO">NO ENTREGADO</option>
                    </select>
                  </td>
                  <td className="px-3 py-2.5 text-center text-slate-600 whitespace-nowrap">
                    <span className="font-bold">#{p.viaje}</span>
                    {p.camioneta && <span className="text-slate-400"> · {p.camioneta}</span>}
                    {p.fecha_viaje && <div className="text-[9px] text-slate-300">{p.fecha_viaje}</div>}
                  </td>
                  <td className="px-3 py-2.5 text-slate-600 max-w-[130px]">
                    <div className="truncate">{p.nombre_responsable}</div>
                    {p.telefono && <div className="text-slate-400 text-[10px] truncate">{p.telefono}</div>}
                  </td>
                  <td className="px-3 py-2.5">
                    {p.ubicacion_url
                      ? <a href={p.ubicacion_url} target="_blank" rel="noreferrer"
                          className="text-blue-600 underline text-xs">Ver</a>
                      : "—"}
                    {p.ubicacion_repetida && (
                      <span className="ml-1 text-amber-500 font-bold text-xs" title="Ubicación compartida">★</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex gap-1">
                      <Btn sm v="ghost" onClick={() => onEditar(p)}>✏</Btn>
                      <Btn sm v="danger" onClick={() => onEliminar(p.id)}>✕</Btn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

// ── Tab: Rutas ────────────────────────────────────────────────────────────────
const TabRutas = ({ paradas }) => {
  // Agrupar por (viaje, camioneta, fecha_viaje)
  const viajes = useMemo(() => {
    const map = {};
    paradas.forEach(p => {
      const key = `${p.viaje ?? 0}-${p.camioneta ?? ""}-${p.fecha_viaje ?? ""}`;
      if (!map[key]) map[key] = {
        viaje: p.viaje, camioneta: p.camioneta, fecha: p.fecha_viaje, paradas: [],
      };
      map[key].paradas.push(p);
    });
    return Object.values(map).sort((a, b) => {
      const df = (a.fecha ?? "").localeCompare(b.fecha ?? "");
      if (df !== 0) return df;
      return (a.viaje ?? 0) - (b.viaje ?? 0);
    });
  }, [paradas]);

  if (viajes.length === 0) {
    return (
      <Card className="p-6 text-center">
        <p className="text-sm text-slate-400">
          Sin rutas planeadas aún. Agrega puntos de entrega en la pestaña Planeación.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Resumen de viajes */}
      <div className="flex flex-wrap gap-2">
        {viajes.map((v, i) => {
          const t = v.paradas.reduce((s, p) => s + (Number(p.total_costales) || 0), 0);
          return (
            <div key={i}
              className="bg-slate-800 text-white rounded-xl px-3 py-1.5 text-xs font-bold">
              Viaje #{v.viaje} · {v.camioneta || "Sin asignar"} · {t} costales
            </div>
          );
        })}
      </div>

      {/* Cards por viaje */}
      {viajes.map((v, vi) => {
        const total     = v.paradas.reduce((s, p) => s + (Number(p.total_costales) || 0), 0);
        const entregadas = v.paradas.reduce((s, p) => s + (Number(p.entregadas) || 0), 0);
        const puntosOk  = v.paradas.filter(p => p.status === "ENTREGADO").length;

        return (
          <Card key={vi} className="overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-800 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center
                  text-sm font-black">
                  {v.viaje}
                </div>
                <div>
                  <p className="text-sm font-black">
                    Viaje #{v.viaje} — {v.camioneta || "Sin chofer asignado"}
                  </p>
                  <p className="text-xs text-white/60">
                    {v.fecha ?? "Sin fecha"} · {v.paradas.length} paradas
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="text-sm font-black">{total.toLocaleString()} costales</p>
                <p className="text-xs text-white/60">{puntosOk}/{v.paradas.length} completadas</p>
              </div>
            </div>

            {/* Paradas en orden */}
            <div className="divide-y divide-slate-50">
              {[...v.paradas]
                .sort((a, b) => (a.orden_parada ?? 0) - (b.orden_parada ?? 0))
                .map((p, pi) => (
                <div key={p.id} className="px-4 py-3 flex items-start gap-3">
                  {/* Número de parada */}
                  <div className="w-6 h-6 rounded-full bg-slate-100 flex items-center
                    justify-center text-[10px] font-black text-slate-500 flex-shrink-0 mt-0.5">
                    {pi + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className="text-xs font-black text-slate-800">
                        Sector {p.sector} · Sección {p.seccion}
                      </span>
                      <Badge text={p.status} style={ST_PARADA[p.status] || "bg-slate-100 text-slate-500 border-slate-200"} />
                    </div>
                    <p className="text-xs text-slate-500">
                      <span className="text-slate-400">{p.coordinador} · </span>
                      {p.sm_activas} SM × {p.piezas_por_sm} pzas ={" "}
                      <span className="font-bold text-blue-700">{p.total_costales} costales</span>
                      {p.entregadas != null && (
                        <span className="text-slate-400"> · Entregadas: {p.entregadas}</span>
                      )}
                    </p>
                    {p.nombre_responsable && (
                      <p className="text-xs text-slate-400 mt-0.5">
                        📍 {p.nombre_responsable}
                        {p.telefono && ` · ${p.telefono}`}
                        {p.ubicacion_repetida && (
                          <span className="text-amber-500 font-bold ml-1"
                            title="Ubicación compartida con otra sección">★ compartida</span>
                        )}
                        {p.ubicacion_url && (
                          <a href={p.ubicacion_url} target="_blank" rel="noreferrer"
                            className="text-blue-500 ml-2 underline">
                            Ver mapa
                          </a>
                        )}
                      </p>
                    )}
                    {p.notas && (
                      <p className="text-[10px] text-slate-300 mt-0.5 italic">{p.notas}</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </Card>
        );
      })}
    </div>
  );
};

// ── Lista de entregas ─────────────────────────────────────────────────────────
const VistaLista = ({ entregas, cargando, onSeleccionar, onNueva, onEditar }) => (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <div>
        <h1 className="text-xl font-black text-slate-900">Mercado Solidario</h1>
        <p className="text-xs text-slate-500">
          Control de producción y entrega de costal de verdura · sección por sección
        </p>
      </div>
      <Btn onClick={onNueva}>+ Nueva entrega</Btn>
    </div>

    {cargando ? (
      <p className="text-sm text-slate-400 text-center py-8">Cargando...</p>
    ) : entregas.length === 0 ? (
      <Card className="p-10 text-center">
        <p className="text-3xl mb-3">🥕</p>
        <p className="text-sm font-bold text-slate-500">Sin ciclos de entrega</p>
        <p className="text-xs text-slate-400 mt-1">
          Crea el primer ciclo para comenzar la planeación.
        </p>
      </Card>
    ) : (
      <div className="space-y-2">
        {entregas.map(e => (
          <Card key={e.id}
            className="p-4 flex items-center gap-4 hover:border-blue-200 transition-colors cursor-pointer"
            onClick={() => onSeleccionar(e)}>
            <div className="w-11 h-11 bg-blue-50 rounded-xl flex items-center justify-center flex-shrink-0">
              <span className="text-base font-black text-blue-800">#{e.numero}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-black text-slate-900">
                Entrega {e.numero} — {fmtMes(e.mes)} {e.anio}
              </p>
              <p className="text-xs text-slate-400">
                {e.fecha_ini && e.fecha_fin
                  ? `${e.fecha_ini} → ${e.fecha_fin}`
                  : e.fecha_ini
                  ? `Desde ${e.fecha_ini}`
                  : "Sin fechas definidas"}
                {e.notas && ` · ${e.notas}`}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <Badge text={e.status} style={ST_ENTREGA[e.status] || "bg-slate-100 text-slate-500 border-slate-200"} />
              <Btn sm v="outline" onClick={ev => { ev.stopPropagation(); onEditar(e); }}>
                Editar
              </Btn>
            </div>
          </Card>
        ))}
      </div>
    )}
  </div>
);

// ── Componente principal ──────────────────────────────────────────────────────
export default function MercadoControl() {
  const [vista,         setVista]         = useState("lista"); // "lista" | "detalle"
  const [tab,           setTab]           = useState("resumen");
  const [entregas,      setEntregas]      = useState([]);
  const [entregaActiva, setEntregaActiva] = useState(null);
  const [paradas,       setParadas]       = useState([]);
  const [cargando,      setCargando]      = useState(false);
  const [guardando,     setGuardando]     = useState(false);
  const [guardandoId,   setGuardandoId]   = useState(null);
  const [modalEntrega,  setModalEntrega]  = useState(null); // null | "nueva" | entrega_obj
  const [modalParada,   setModalParada]   = useState(null); // null | "nueva" | parada_obj

  // Cargar ciclos de entrega
  useEffect(() => {
    const cargar = async () => {
      setCargando(true);
      const { data } = await supabase
        .from("mercado_entregas")
        .select("*")
        .order("anio", { ascending: false })
        .order("numero", { ascending: false });
      setEntregas(data ?? []);
      setCargando(false);
    };
    cargar();
  }, []);

  // Cargar paradas cuando cambia la entrega activa
  useEffect(() => {
    if (!entregaActiva) return;
    const cargar = async () => {
      const { data } = await supabase
        .from("mercado_paradas")
        .select("*")
        .eq("entrega_id", entregaActiva.id)
        .order("sector")
        .order("seccion")
        .order("viaje")
        .order("orden_parada");
      setParadas(data ?? []);
    };
    cargar();
  }, [entregaActiva]);

  // ── Guardar entrega ──────────────────────────────────────────────────────────
  const guardarEntrega = async (form) => {
    setGuardando(true);
    try {
      const payload = {
        anio:      Number(form.anio),
        mes:       form.mes,
        numero:    Number(form.numero),
        fecha_ini: form.fecha_ini || null,
        fecha_fin: form.fecha_fin || null,
        status:    form.status,
        notas:     form.notas || null,
      };
      let data, error;
      if (form.id) {
        ({ data, error } = await supabase.from("mercado_entregas")
          .update(payload).eq("id", form.id).select().single());
      } else {
        ({ data, error } = await supabase.from("mercado_entregas")
          .insert(payload).select().single());
      }
      if (error) throw error;
      setEntregas(prev => form.id
        ? prev.map(e => e.id === form.id ? data : e)
        : [data, ...prev]);
      if (entregaActiva?.id === form.id) setEntregaActiva(data);
      setModalEntrega(null);
    } catch (e) {
      alert(e.message || "Error al guardar la entrega");
    } finally {
      setGuardando(false);
    }
  };

  // ── Guardar parada ────────────────────────────────────────────────────────────
  const guardarParada = async (form) => {
    setGuardando(true);
    try {
      const payload = {
        entrega_id:         entregaActiva.id,
        viaje:              Number(form.viaje) || 1,
        camioneta:          form.camioneta || null,
        fecha_viaje:        form.fecha_viaje || null,
        orden_parada:       form.orden_parada !== "" ? Number(form.orden_parada) : 0,
        coordinador:        form.coordinador || null,
        sector:             form.sector !== "" ? Number(form.sector) : null,
        seccion:            form.seccion !== "" ? Number(form.seccion) : null,
        fracciones:         Number(form.fracciones) || 0,
        sm_activas:         Number(form.sm_activas) || 0,
        piezas_por_sm:      Number(form.piezas_por_sm) || 20,
        total_costales:     form.total_costales,
        entregadas:         form.entregadas !== "" && form.entregadas != null
                              ? Number(form.entregadas) : null,
        nombre_responsable: form.nombre_responsable || null,
        telefono:           form.telefono || null,
        ubicacion_url:      form.ubicacion_url || null,
        latitud:            form.latitud !== "" ? Number(form.latitud) : null,
        longitud:           form.longitud !== "" ? Number(form.longitud) : null,
        ubicacion_repetida: Boolean(form.ubicacion_repetida),
        status:             form.status,
        notas:              form.notas || null,
      };
      let data, error;
      if (form.id) {
        ({ data, error } = await supabase.from("mercado_paradas")
          .update(payload).eq("id", form.id).select().single());
      } else {
        ({ data, error } = await supabase.from("mercado_paradas")
          .insert(payload).select().single());
      }
      if (error) throw error;
      setParadas(prev => form.id
        ? prev.map(p => p.id === form.id ? data : p)
        : [...prev, data].sort((a, b) =>
            (a.sector - b.sector) || (a.seccion - b.seccion) || (a.viaje - b.viaje)));
      setModalParada(null);
    } catch (e) {
      alert(e.message || "Error al guardar el punto de entrega");
    } finally {
      setGuardando(false);
    }
  };

  // ── Eliminar parada ────────────────────────────────────────────────────────────
  const eliminarParada = async (id) => {
    if (!window.confirm("¿Eliminar este punto de entrega?")) return;
    const { error } = await supabase.from("mercado_paradas").delete().eq("id", id);
    if (!error) setParadas(prev => prev.filter(p => p.id !== id));
    else alert("Error al eliminar");
  };

  // ── Cambiar estatus inline ─────────────────────────────────────────────────────
  const cambiarStatus = async (parada, nuevoStatus) => {
    setGuardandoId(parada.id);
    const { data, error } = await supabase.from("mercado_paradas")
      .update({ status: nuevoStatus })
      .eq("id", parada.id)
      .select()
      .single();
    if (!error) setParadas(prev => prev.map(p => p.id === parada.id ? data : p));
    setGuardandoId(null);
  };

  // ── Render ─────────────────────────────────────────────────────────────────────
  const TABS = [
    { key: "resumen",    label: "Resumen" },
    { key: "planeacion", label: "Planeación" },
    { key: "rutas",      label: "Rutas" },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-blue-800 text-white px-4 py-4 shadow-md">
        <div className="max-w-6xl mx-auto flex items-center gap-3 flex-wrap">
          {vista === "detalle" && (
            <button
              onClick={() => { setVista("lista"); setEntregaActiva(null); setParadas([]); }}
              className="text-blue-300 hover:text-white font-bold text-sm mr-1">
              ← Entregas
            </button>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300">
              Admin · Programas Sociales
            </p>
            <h1 className="text-lg font-black leading-tight">
              {vista === "detalle"
                ? `Entrega ${entregaActiva?.numero} — ${fmtMes(entregaActiva?.mes ?? "")} ${entregaActiva?.anio}`
                : "Mercado Solidario — Control de Entregas"}
            </h1>
          </div>
          {vista === "detalle" && entregaActiva && (
            <div className="flex items-center gap-2">
              <Badge
                text={entregaActiva.status}
                style={ST_ENTREGA[entregaActiva.status] || "bg-slate-100 text-slate-500 border-slate-200"}
              />
              <Btn sm v="outline"
                onClick={() => setModalEntrega(entregaActiva)}
                className="bg-white/10 border-white/20 text-white hover:bg-white/20">
                Editar ciclo
              </Btn>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {vista === "lista" ? (
          <VistaLista
            entregas={entregas}
            cargando={cargando}
            onSeleccionar={e => { setEntregaActiva(e); setVista("detalle"); setTab("resumen"); }}
            onNueva={() => setModalEntrega("nueva")}
            onEditar={e => setModalEntrega(e)}
          />
        ) : (
          <div className="space-y-4">
            {/* Tabs */}
            <div className="flex gap-1 bg-white border border-slate-200 rounded-xl p-1 w-fit shadow-sm">
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                    tab === t.key
                      ? "bg-blue-800 text-white shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === "resumen" && (
              <TabResumen paradas={paradas} entrega={entregaActiva} onEditar={() => setModalEntrega(entregaActiva)} />
            )}
            {tab === "planeacion" && (
              <TabPlaneacion
                paradas={paradas}
                onAgregar={() => setModalParada("nueva")}
                onEditar={p => setModalParada(p)}
                onEliminar={eliminarParada}
                onCambiarStatus={cambiarStatus}
                guardandoId={guardandoId}
              />
            )}
            {tab === "rutas" && <TabRutas paradas={paradas} />}
          </div>
        )}
      </main>

      {modalEntrega && (
        <ModalEntrega
          inicial={modalEntrega === "nueva" ? null : modalEntrega}
          onSave={guardarEntrega}
          onClose={() => setModalEntrega(null)}
          guardando={guardando}
        />
      )}
      {modalParada && (
        <ModalParada
          inicial={modalParada === "nueva" ? null : modalParada}
          onSave={guardarParada}
          onClose={() => setModalParada(null)}
          guardando={guardando}
        />
      )}
    </div>
  );
}
