import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../supabase/client';
import MapTerritorial from '../map/MapTerritorial';
import MapaEstadoMexico from '../map/MapaEstadoMexico';
import AFILIACION from '../data/afiliacion.json';

const fullName = (p) => p ? `${p.nombre} ${p.a_paterno} ${p.a_materno}`.trim() : null;
const fmt      = (n)  => n != null ? Number(n).toLocaleString('es-MX') : null;
const pct      = (a, b) => b ? `${((a / b) * 100).toFixed(1)}%` : null;

// ── Colores de partidos ───────────────────────────────────────────────────────
const PARTY_FILL = {
  MORENA: '#6B0B20',
  PRI:    '#F04E5A',
  PAN:    '#1460A8',
  PRD:    '#E8B200',
  PT:     '#F07030',
  PVEM:   '#22C55E',
  MC:     '#F59E0B',
};

// ── Candidatos Ayuntamiento 2021 ──────────────────────────────────────────────
const CANDIDATOS_2021 = {
  MORENA: { nombre: 'Mariela Gutiérrez Escalante',    partido: 'MORENA · PT · NAEM', resultado: 'GANADORA' },
  PRI:    { nombre: 'José Israel Ovando Becerra',     partido: 'PRI',                resultado: '2° lugar' },
  PAN:    { nombre: 'Sergio Octavio Germán Olivares', partido: 'PAN',                resultado: '3° lugar' },
  PT:     { nombre: 'Coalición PT · MORENA · NAEM',  partido: 'PT',                 resultado: '' },
  MC:     { nombre: 'Fabián Alfredo Varela Vergara',  partido: 'MC',                 resultado: '' },
  PVEM:   { nombre: 'Candidato PVEM',                 partido: 'PVEM',               resultado: '' },
  PRD:    { nombre: 'Candidato PRD',                  partido: 'PRD',                resultado: '' },
};

// ── Candidatos Ayuntamiento 2024 ──────────────────────────────────────────────
const CANDIDATOS_2024 = {
  ROSI:  { nombre: 'Rosa Yolanda Wong', partido: 'Rosa Yolanda Wong', resultado: 'GANADORA', fill: '#6B0B20', stroke: '#360008' },
  AARON: { nombre: 'Aaron Urbina',  partido: 'Aaron Urbina', resultado: '2° lugar', fill: '#1460A8', stroke: '#093E78' },
  MC:    { nombre: 'Candidato MC',  partido: 'MC',           resultado: '',         fill: '#F59E0B', stroke: '#B45309' },
  PT:    { nombre: 'Candidato PT',  partido: 'PT',           resultado: '',         fill: '#F07030', stroke: '#B84810' },
  PVEM:  { nombre: 'Candidato PVEM',partido: 'PVEM',         resultado: '',         fill: '#22C55E', stroke: '#15803D' },
};

// ── Candidatos Senaduría 2024 ─────────────────────────────────────────────────
const CANDIDATOS_SENADO = {
  MARIELA: { nombre: 'Mariela Gutiérrez Escalante', partido: 'MORENA Coalición', resultado: 'GANADORA', fill: '#6B0B20', stroke: '#360008' },
  FUERZA:  { nombre: 'Fuerza x México',             partido: 'PAN · PRI · PRD',  resultado: '2° lugar', fill: '#1460A8', stroke: '#093E78' },
  MC:      { nombre: 'Candidato MC',                partido: 'MC',               resultado: '',         fill: '#F59E0B', stroke: '#B45309' },
};

// ── Candidatos Diputación Local 2024 (Dist 33 y 22 · Tecámac) ────────────────
const CANDIDATOS_DIP = {
  MORENA: { nombre: 'Samuel Hernández Cruz', partido: 'MORENA · PT · PVEM', resultado: 'GANADOR', fill: '#6B0B20', stroke: '#360008' },
  PRI:    { nombre: 'Lilia Urbina / Eduardo Bernal', partido: 'PRI · PAN · PRD · NAEM', resultado: '2° lugar', fill: '#1460A8', stroke: '#093E78' },
  MC:     { nombre: 'Saúl Nayan / Noelia Hdz.',     partido: 'MC',                resultado: '',         fill: '#F59E0B', stroke: '#B45309' },
};

// ── Alias de secciones históricas (fallback) ──────────────────────────────────
const SECTION_ALIASES = {
  7011: 4213, 7012: 4213, 7013: 4213,
  7014: 4213, 7015: 4213, 7016: 4213, 7017: 4213,
  7018: 4228, 7019: 4228, 7020: 4228,
  7021: 4228, 7022: 4228, 7023: 4228, 7024: 4228,
  6857: 4251, 6858: 4251, 6859: 4251, 6860: 4251, 6861: 4251,
  6862: 4251, 6863: 4251, 6864: 4251, 6865: 4251, 6866: 4251, 6867: 4251,
};

// ── UI primitives ─────────────────────────────────────────────────────────────

const StatCard = ({ label, value, sub, accent, wide }) => (
  <div className={`rounded-xl p-3 flex flex-col gap-1 ${wide ? 'col-span-2' : ''} ${
    accent
      ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-md shadow-blue-200/50'
      : 'bg-white border border-slate-100 shadow-sm'
  }`}>
    <p className={`text-[9px] font-bold uppercase tracking-[0.12em] leading-none ${accent ? 'text-blue-200' : 'text-slate-400'}`}>{label}</p>
    <p className={`text-2xl font-bold tabular-nums leading-none ${accent ? 'text-white' : 'text-slate-900'}`}>{value ?? '—'}</p>
    {sub && <p className={`text-[10px] leading-none ${accent ? 'text-blue-300' : 'text-slate-400'}`}>{sub}</p>}
  </div>
);

const DataRow = ({ label, value, highlight }) => value != null ? (
  <div className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
    <span className="text-[10px] text-slate-400 font-medium">{label}</span>
    <span className={`text-[11px] font-bold tabular-nums ${highlight ? 'text-blue-600' : 'text-slate-700'}`}>{value}</span>
  </div>
) : null;

const GenderBar = ({ total, hombres, mujeres, noBinario, label }) => {
  if (!total || (!hombres && !mujeres)) return null;
  return (
    <div className="mt-1.5 pt-2 border-t border-slate-100">
      {label && <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">{label}</p>}
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden flex gap-px">
        {hombres && <div className="h-full bg-blue-400 transition-all" style={{ width: pct(hombres, total) }} />}
        {mujeres && <div className="h-full bg-rose-400 transition-all" style={{ width: pct(mujeres, total) }} />}
        {noBinario > 0 && <div className="h-full bg-violet-400 transition-all" style={{ width: pct(noBinario, total) }} />}
      </div>
      <div className="flex justify-between mt-1 flex-wrap gap-1">
        {hombres && <span className="text-[9px] text-slate-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-blue-400 inline-block" />♂ {fmt(hombres)} <span className="text-slate-300">({pct(hombres, total)})</span></span>}
        {mujeres && <span className="text-[9px] text-slate-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-rose-400 inline-block" />♀ {fmt(mujeres)} <span className="text-slate-300">({pct(mujeres, total)})</span></span>}
        {noBinario > 0 && <span className="text-[9px] text-slate-500 flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-sm bg-violet-400 inline-block" />⚧ {fmt(noBinario)} <span className="text-slate-300">({pct(noBinario, total)})</span></span>}
      </div>
    </div>
  );
};

const InitialAvatar = ({ name, colorClass = 'bg-slate-100 text-slate-500' }) => {
  const initials = name ? name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() : '?';
  return (
    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0 ${colorClass}`}>
      {initials}
    </div>
  );
};

const ResponsableRow = ({ role, name, roleColor, avatarColor }) => (
  <div className="flex items-center gap-2 py-1">
    <InitialAvatar name={name} colorClass={avatarColor} />
    <div className="min-w-0 flex-1">
      <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-0.5">{role}</p>
      <p className="text-[11px] font-semibold text-slate-700 truncate leading-snug">
        {name || <span className="text-slate-300 font-normal">Sin asignar</span>}
      </p>
    </div>
    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded-full flex-shrink-0 ${roleColor}`}>{role}</span>
  </div>
);

const CoverageBar = ({ label, value, total, colorClass = 'bg-emerald-500' }) => {
  if (!total) return null;
  const p = Math.min((value / total) * 100, 100);
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{label}</span>
        <span className="text-[10px] font-bold text-slate-600 tabular-nums">{value}<span className="text-slate-300 font-normal">/{total}</span></span>
      </div>
      <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
        <div className={`h-full ${colorClass} rounded-full transition-all duration-500`} style={{ width: `${p}%` }} />
      </div>
    </div>
  );
};

const AfilCard = ({ afiliados, credenciales }) => {
  if (!afiliados) return null;
  const p = Math.min((credenciales / afiliados) * 100, 100);
  return (
    <div>
      <div className="grid grid-cols-2 gap-1 mb-2">
        <div className="bg-teal-50 rounded-lg p-2 text-center">
          <p className="text-[9px] font-bold uppercase tracking-widest text-teal-400 leading-none mb-1">Afiliados</p>
          <p className="text-xl font-bold tabular-nums text-teal-700">{fmt(afiliados)}</p>
        </div>
        <div className="bg-teal-50 rounded-lg p-2 text-center">
          <p className="text-[9px] font-bold uppercase tracking-widest text-teal-400 leading-none mb-1">Credenciales</p>
          <p className="text-xl font-bold tabular-nums text-teal-700">{fmt(credenciales)}</p>
        </div>
      </div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Entrega</span>
        <span className="text-[10px] font-bold text-teal-700">{pct(credenciales, afiliados)}</span>
      </div>
      <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
        <div className="h-full bg-teal-500 rounded-full transition-all duration-500" style={{ width: `${p}%` }} />
      </div>
    </div>
  );
};

const AfilTable = ({ rows }) => {
  if (!rows.length) return null;
  return (
    <div className="rounded-lg border border-slate-100 overflow-hidden mt-2">
      <div className="bg-slate-50 px-2.5 py-1.5 grid grid-cols-4 text-[9px] font-bold uppercase tracking-widest text-slate-400 border-b border-slate-100">
        <span>Nivel</span><span className="text-right">Afil.</span><span className="text-right">Cred.</span><span className="text-right">%</span>
      </div>
      <div className="divide-y divide-slate-50 max-h-44 overflow-y-auto">
        {rows.map((r, i) => (
          <div key={i} className="grid grid-cols-4 px-2.5 py-1.5 text-[11px]">
            <span className="font-semibold text-slate-600 truncate">{r.label}</span>
            <span className="text-right tabular-nums text-slate-500">{fmt(r.afiliados)}</span>
            <span className="text-right tabular-nums font-bold text-teal-600">{fmt(r.credenciales)}</span>
            <span className="text-right tabular-nums text-teal-500">{pct(r.credenciales, r.afiliados)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

const Pill = ({ label, active, color = 'blue', onClick }) => {
  const base = 'px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer select-none';
  const styles = {
    blue:   active ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-blue-600 border-blue-200 hover:bg-blue-50 hover:border-blue-300',
    green:  active ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50',
    violet: active ? 'bg-violet-600 text-white border-violet-600 shadow-sm' : 'bg-white text-violet-600 border-violet-200 hover:bg-violet-50',
  };
  return <button className={`${base} ${styles[color]}`} onClick={onClick}>{label}</button>;
};

const SectionTitle = ({ children, accent }) => (
  <div className="flex items-center gap-1.5 mb-2">
    <div className={`w-0.5 h-3.5 rounded-full flex-shrink-0 ${accent ?? 'bg-blue-500'}`} />
    <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400">{children}</p>
  </div>
);

const EmptyGuide = ({ children }) => (
  <div className="rounded-xl border border-dashed border-slate-200 p-3.5 text-center">
    <p className="text-xs text-slate-400 leading-relaxed">{children}</p>
  </div>
);

// ── Component ─────────────────────────────────────────────────────────────────

const TableroBoard = () => {
  const navigate = useNavigate();

  const [mapScope, setMapScope] = useState('tecamac'); // 'tecamac' | 'edomex'
  const [allSecciones,  setAllSecciones]  = useState([]);
  const [loadingMap,    setLoadingMap]    = useState(true);
  const [selectedDistrito, setSelectedDistrito] = useState(null);
  const [selectedSector,   setSelectedSector]   = useState(null);
  const [selectedSeccion,  setSelectedSeccion]  = useState(null);
  const [sp,            setSp]           = useState(null);
  const [seccional,     setSeccional]    = useState(null);
  const [promotores,    setPromotores]   = useState([]);
  const [fracciones,    setFracciones]   = useState([]);
  const [regCount,      setRegCount]     = useState(null);
  const [ciudadanosGeo, setCiudadanosGeo] = useState([]);
  const [loadingInfo,   setLoadingInfo]  = useState(false);
  const [selectedSM,    setSelectedSM]   = useState(null);
  const [focusCoords,   setFocusCoords]  = useState(null);
  const [electoralMode, setElectoralMode] = useState(null);
  const [electoralData, setElectoralData] = useState({});
  const [electoralDataIEEM, setElectoralDataIEEM] = useState({});
  const [electoralData2024,     setElectoralData2024]     = useState({});
  const [electoralData2024IEEM, setElectoralData2024IEEM] = useState({});
  const [electoralDataSenado,   setElectoralDataSenado]   = useState({});
  const [electoralDataDip2024,  setElectoralDataDip2024]  = useState({});
  const [panelFade,     setPanelFade]     = useState(true);
  const prevElectoralMode = useRef(null);

  useEffect(() => {
    const fetchAll = async () => {
      setLoadingMap(true);
      const { data } = await supabase.from('secciones').select('*');
      setAllSecciones(data ?? []);
      setLoadingMap(false);
    };
    fetchAll();
  }, []);

  useEffect(() => {
    fetch('/electoral_2021.json')
      .then(r => r.json())
      .then(rows => {
        const m = {};
        rows.forEach(row => { m[row.seccion] = row; });
        setElectoralData(m);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/electoral_2021_ieem.json')
      .then(r => r.json())
      .then(rows => {
        const m = {};
        rows.forEach(row => { m[row.seccion] = row; });
        setElectoralDataIEEM(m);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/electoral_2024.json')
      .then(r => r.json())
      .then(rows => {
        const m = {};
        rows.forEach(row => { m[row.seccion] = row; });
        setElectoralData2024(m);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/electoral_2024_ieem.json')
      .then(r => r.json())
      .then(rows => {
        const m = {};
        rows.forEach(row => { m[row.seccion] = row; });
        setElectoralData2024IEEM(m);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/electoral_senado_2024.json')
      .then(r => r.json())
      .then(rows => {
        const m = {};
        rows.forEach(row => { m[row.seccion] = row; });
        setElectoralDataSenado(m);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetch('/dip_2024.json')
      .then(r => r.json())
      .then(rows => {
        const m = {};
        rows.forEach(row => { m[row.seccion] = row; });
        setElectoralDataDip2024(m);
      })
      .catch(() => {});
  }, []);

  // Fade transition when electoral mode changes
  useEffect(() => {
    if (prevElectoralMode.current !== electoralMode) {
      setPanelFade(false);
      const t = setTimeout(() => { prevElectoralMode.current = electoralMode; setPanelFade(true); }, 220);
      return () => clearTimeout(t);
    }
  }, [electoralMode]);

  // ── Afiliación (local JSON) ───────────────────────────────────────────────
  const afiliacionBySec = useMemo(() => {
    const m = {};
    AFILIACION.forEach(r => { m[r.seccion] = r; });
    return m;
  }, []);

  // ── Derivados ─────────────────────────────────────────────────────────────
  const distritos = useMemo(() =>
    [...new Set(allSecciones.map(s => s.distrito_federal))].filter(Boolean).sort((a, b) => a - b),
  [allSecciones]);

  const sectores = useMemo(() => {
    const base = selectedDistrito
      ? allSecciones.filter(s => s.distrito_federal === selectedDistrito)
      : allSecciones;
    return [...new Set(base.map(s => s.pologono))].filter(Boolean).sort((a, b) => a - b);
  }, [allSecciones, selectedDistrito]);

  const seccionesDeNivel = useMemo(() => {
    let base = allSecciones;
    if (selectedDistrito) base = base.filter(s => s.distrito_federal === selectedDistrito);
    if (selectedSector)   base = base.filter(s => s.pologono === selectedSector);
    return [...new Set(base.map(s => s.seccion))].filter(Boolean).sort((a, b) => a - b);
  }, [allSecciones, selectedDistrito, selectedSector]);

  const mapSecciones = useMemo(() => {
    if (selectedSeccion != null) return allSecciones.filter(s => s.seccion === selectedSeccion);
    if (selectedSector  != null) return allSecciones.filter(s => s.pologono === selectedSector);
    if (selectedDistrito != null) return allSecciones.filter(s => s.distrito_federal === selectedDistrito);
    return allSecciones;
  }, [allSecciones, selectedDistrito, selectedSector, selectedSeccion]);

  const mapStats = useMemo(() => {
    const total = mapSecciones.reduce((s, x) => s + (Number(x.lista_nominal) || 0), 0);
    return { secciones: mapSecciones.length, listaNominal: total };
  }, [mapSecciones]);

  // ── Totales dinámicos de afiliación ──────────────────────────────────────
  const afiliacionStats = useMemo(() => {
    if (selectedSeccion != null) {
      const row = afiliacionBySec[selectedSeccion];
      return row ? { mode: 'seccion', seccion: row } : null;
    }

    const viewSecs = selectedSector
      ? allSecciones.filter(s => s.pologono === selectedSector)
      : selectedDistrito
        ? allSecciones.filter(s => s.distrito_federal === selectedDistrito)
        : allSecciones;

    const bySector   = {};
    const byDistrito = {};
    let totalAf = 0, totalCred = 0;

    viewSecs.forEach(s => {
      const af = afiliacionBySec[s.seccion];
      if (!af) return;
      const spKey = String(af.sp);
      const dKey  = String(s.distrito_federal ?? '');
      totalAf   += af.afiliados;
      totalCred += af.credenciales_entregadas;
      if (!bySector[spKey])   bySector[spKey]   = { afiliados: 0, credenciales: 0 };
      if (!byDistrito[dKey])  byDistrito[dKey]  = { afiliados: 0, credenciales: 0 };
      bySector[spKey].afiliados    += af.afiliados;
      bySector[spKey].credenciales += af.credenciales_entregadas;
      byDistrito[dKey].afiliados   += af.afiliados;
      byDistrito[dKey].credenciales += af.credenciales_entregadas;
    });

    return {
      mode: selectedSector ? 'sector' : selectedDistrito ? 'distrito' : 'municipio',
      total: { afiliados: totalAf, credenciales: totalCred },
      bySector,
      byDistrito,
    };
  }, [selectedSeccion, selectedSector, selectedDistrito, allSecciones, afiliacionBySec]);

  // ── Estadísticas electorales filtradas ───────────────────────────────────
  const electoralStats = useMemo(() => {
    const isIEEM      = electoralMode === 'ayu_2021_ieem';
    const is2024      = electoralMode === 'ayu_2024';
    const is2024IEEM  = electoralMode === 'ayu_2024_ieem';
    const isSenado    = electoralMode === 'senado_2024';
    const isDip2024   = electoralMode === 'dip_2024';
    const isDip       = isDip2024;
    const dataSource  = isIEEM ? electoralDataIEEM
                      : is2024 ? electoralData2024
                      : is2024IEEM ? electoralData2024IEEM
                      : isSenado ? electoralDataSenado
                      : isDip2024 ? electoralDataDip2024
                      : electoralData;
    if (!electoralMode || !Object.keys(dataSource).length) return null;

    const totals = {};
    let grandTotal = 0;
    let secciones = 0;
    const secGanadas = {};
    const counted = new Set();
    let morena_solo_total = 0, pt_solo_total = 0, naem_solo_total = 0;
    let rosi_vs_aaron_total = 0, mg_vs_fuerza_total = 0;
    let votos_nulos_total = 0;

    for (const s of mapSecciones) {
      const canonical = dataSource[s.seccion] !== undefined
        ? s.seccion
        : (SECTION_ALIASES[s.seccion] ?? s.seccion);
      if (counted.has(canonical)) continue;
      const d = dataSource[canonical];
      if (!d) continue;
      if ((is2024 || is2024IEEM || isSenado) && dataSource[s.seccion] === undefined && dataSource[canonical] === undefined) continue;
      counted.add(canonical);
      secciones++;

      if (is2024IEEM || is2024) {
        const { ganador, rosi = 0, aaron = 0, mc = 0, pt = 0, pvem = 0, rosi_vs_aaron = 0 } = d;
        secGanadas[ganador] = (secGanadas[ganador] || 0) + 1;
        const votes = { ROSI: rosi, AARON: aaron };
        if (mc   > 0) votes.MC   = mc;
        if (pt   > 0) votes.PT   = pt;
        if (pvem > 0) votes.PVEM = pvem;
        for (const [p, v] of Object.entries(votes)) {
          if (v > 0) { totals[p] = (totals[p] || 0) + v; grandTotal += v; }
        }
        rosi_vs_aaron_total += rosi_vs_aaron;
      } else if (isSenado) {
        const { ganador, morena_coalicion = 0, fuerza_x_mexico = 0, senado_mc = 0, mg_vs_fuerza = 0, votos_nulos = 0 } = d;
        secGanadas[ganador] = (secGanadas[ganador] || 0) + 1;
        const votes = { MARIELA: morena_coalicion, FUERZA: fuerza_x_mexico };
        if (senado_mc > 0) votes.MC = senado_mc;
        for (const [p, v] of Object.entries(votes)) {
          if (v > 0) { totals[p] = (totals[p] || 0) + v; grandTotal += v; }
        }
        mg_vs_fuerza_total += mg_vs_fuerza;
        votos_nulos_total  += votos_nulos;
      } else if (isDip) {
        const { ganador, morena = 0, pri = 0, mc = 0 } = d;
        secGanadas[ganador] = (secGanadas[ganador] || 0) + 1;
        const votes = {};
        if (morena > 0) votes.MORENA = morena;
        if (pri    > 0) votes.PRI    = pri;
        if (mc     > 0) votes.MC     = mc;
        for (const [p, v] of Object.entries(votes)) {
          if (v > 0) { totals[p] = (totals[p] || 0) + v; grandTotal += v; }
        }
      } else {
        const { ganador_partido, morena_coalicion = 0, morena = 0, pri = 0, pan = 0, pvem = 0, mc = 0, prd = 0, pt = 0, naem = 0 } = d;
        secGanadas[ganador_partido] = (secGanadas[ganador_partido] || 0) + 1;
        const morenaVotes = isIEEM ? morena_coalicion : morena;
        const votes = { MORENA: morenaVotes, PRI: pri, PAN: pan, PVEM: pvem, MC: mc, PRD: prd };
        if (!isIEEM && pt > 0) votes.PT = pt;
        for (const [p, v] of Object.entries(votes)) {
          if (v > 0) { totals[p] = (totals[p] || 0) + v; grandTotal += v; }
        }
        if (isIEEM) {
          morena_solo_total += morena;
          pt_solo_total     += pt;
          naem_solo_total   += naem;
        }
      }
    }

    if (!secciones) return null;

    const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1]);
    const winner = sorted[0]?.[0];
    const marginVotos = winner ? (totals[winner] - (sorted[1]?.[1] ?? 0)) : 0;
    const marginPct   = grandTotal ? ((marginVotos / grandTotal) * 100).toFixed(1) : '0';

    return { totals, grandTotal, winner, secGanadas, secciones, sorted, marginVotos, marginPct,
             isIEEM, is2024, is2024IEEM, isSenado, isDip, isDip2024,
             morena_solo_total, pt_solo_total, naem_solo_total,
             rosi_vs_aaron_total, mg_vs_fuerza_total, votos_nulos_total };
  }, [electoralData, electoralDataIEEM, electoralData2024, electoralData2024IEEM, electoralDataSenado,
      electoralDataDip2024, electoralMode, mapSecciones]);

  // ── Fetch sector ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedSector) { setSp(null); setCiudadanosGeo([]); return; }
    const run = async () => {
      const [spRes, geoRes] = await Promise.all([
        supabase.from('ciudadania').select('nombre, a_paterno, a_materno')
          .eq('puesto', 'SP').eq('poligono', selectedSector).eq('status', 'ACTIVO').maybeSingle(),
        supabase.from('ciudadania').select('id, nombre, a_paterno, a_materno, latitud, longitud, puesto, ubt, seccion')
          .eq('poligono', selectedSector).eq('status', 'ACTIVO').not('latitud', 'is', null),
      ]);
      setSp(spRes.data ?? null);
      setCiudadanosGeo(geoRes.data ?? []);
    };
    run();
  }, [selectedSector]);

  // ── Fetch sección ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!selectedSeccion) {
      setSeccional(null); setPromotores([]); setFracciones([]); setRegCount(null);
      setSelectedSM(null); setFocusCoords(null);
      return;
    }
    const run = async () => {
      setLoadingInfo(true);
      const [rsRes, smRes, fracRes, regRes, geoRes, fracGeoRes] = await Promise.all([
        supabase.from('ciudadania').select('nombre, a_paterno, a_materno')
          .eq('puesto', 'SECCIONAL').eq('seccion', selectedSeccion).eq('status', 'ACTIVO').maybeSingle(),
        supabase.from('ciudadania').select('nombre, a_paterno, a_materno, ubt, telefono_1, latitud, longitud')
          .eq('puesto', 'SM').eq('seccion', selectedSeccion).eq('status', 'ACTIVO').order('ubt', { ascending: true }),
        supabase.from('ubt_catalogo').select('fraccion').eq('seccion', selectedSeccion).order('fraccion', { ascending: true }),
        supabase.from('ciudadania').select('id', { count: 'exact', head: true })
          .eq('seccion', selectedSeccion).eq('status', 'ACTIVO'),
        supabase.from('ciudadania').select('id, nombre, a_paterno, a_materno, latitud, longitud, puesto, ubt, seccion')
          .eq('seccion', selectedSeccion).eq('status', 'ACTIVO').not('latitud', 'is', null),
        supabase.from('fracciones').select('fraccion, seccion, geometry').eq('seccion', selectedSeccion),
      ]);
      setSeccional(rsRes.data ?? null);
      setPromotores(smRes.data ?? []);
      setRegCount(regRes.count ?? 0);
      setCiudadanosGeo(geoRes.data ?? []);
      const fraccionList = fracRes.data?.map(f => f.fraccion) ?? [];
      const geoByFrac = {};
      (fracGeoRes.data ?? []).forEach(f => { geoByFrac[String(f.fraccion)] = f.geometry; });
      setFracciones(fraccionList.map(frac => ({
        fraccion: frac, seccion: selectedSeccion, geometry: geoByFrac[String(frac)] ?? null,
      })));
      setLoadingInfo(false);
    };
    run();
  }, [selectedSeccion]);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const selectDistrito      = useCallback((d) => { setSelectedDistrito(p => p === d ? null : d); setSelectedSector(null); setSelectedSeccion(null); }, []);
  const selectSector        = useCallback((s) => { setSelectedSector(p => p === s ? null : s);   setSelectedSeccion(null); }, []);
  const selectSeccion       = useCallback((s) => { setSelectedSeccion(p => p === s ? null : s); }, []);
  const selectSeccionFromMap = useCallback((sec) => {
    setSelectedDistrito(sec.distrito_federal);
    setSelectedSector(sec.pologono);
    setSelectedSeccion(sec.seccion);
    setSelectedSM(null); setFocusCoords(null);
  }, []);
  const goBack = useCallback(() => {
    if (selectedSeccion  != null) { setSelectedSeccion(null);  setSelectedSM(null); setFocusCoords(null); }
    else if (selectedSector   != null) { setSelectedSector(null);   setSelectedSeccion(null); }
    else if (selectedDistrito != null) { setSelectedDistrito(null); setSelectedSector(null); setSelectedSeccion(null); }
    else navigate(-1);
  }, [selectedSeccion, selectedSector, selectedDistrito, navigate]);

  const handleSelectSM = useCallback((sm) => {
    if (!sm) return;
    setSelectedSM(prev => {
      if (prev?.ubt === sm.ubt) { setFocusCoords(null); return null; }
      const lat = Number(sm.latitud), lng = Number(sm.longitud);
      if (sm.latitud && sm.longitud && !isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0)
        setFocusCoords({ lat, lng, name: fullName(sm), ubt: sm.ubt });
      else setFocusCoords(null);
      return sm;
    });
  }, []);

  const fraccionesWithSM = useMemo(() =>
    fracciones.map(f => ({ ...f, sm: promotores.find(p => p.ubt === f.fraccion) ?? null })),
  [fracciones, promotores]);


  const crumbs = useMemo(() => {
    const list = [{ label: 'Municipio', onClick: () => { setSelectedDistrito(null); setSelectedSector(null); setSelectedSeccion(null); } }];
    if (selectedDistrito) list.push({ label: `Dto. ${selectedDistrito}`, onClick: () => { setSelectedSector(null); setSelectedSeccion(null); } });
    if (selectedSector)   list.push({ label: `Sector ${selectedSector}`, onClick: () => setSelectedSeccion(null) });
    if (selectedSeccion)  list.push({ label: `Sección ${selectedSeccion}`, onClick: null });
    return list;
  }, [selectedDistrito, selectedSector, selectedSeccion]);

  const currentLevel = selectedSeccion != null ? 3 : selectedSector != null ? 2 : selectedDistrito != null ? 1 : 0;

  const printContext = useMemo(() => {
    const listaNominal = mapSecciones.reduce((s, x) => s + (Number(x.lista_nominal) || 0), 0);
    const ubicados = ciudadanosGeo.filter(c => c.latitud && c.longitud).length;
    const bc = ['Municipio'];
    if (selectedDistrito) bc.push(`Dto. ${selectedDistrito}`);
    if (selectedSector)   bc.push(`Sector ${selectedSector}`);
    if (selectedSeccion)  bc.push(`Sección ${selectedSeccion}`);
    let afiliados = 0, credenciales = 0;
    if (afiliacionStats?.mode === 'seccion' && afiliacionStats.seccion) {
      afiliados   = afiliacionStats.seccion.afiliados ?? 0;
      credenciales = afiliacionStats.seccion.credenciales_entregadas ?? 0;
    } else if (afiliacionStats?.total) {
      afiliados   = afiliacionStats.total.afiliados ?? 0;
      credenciales = afiliacionStats.total.credenciales ?? 0;
    }
    return {
      breadcrumb: bc.join(' › '),
      level: ['Municipio', 'Distrito Federal', 'Sector', 'Sección'][currentLevel],
      levelValue: selectedSeccion != null ? `Sección ${selectedSeccion}` :
                  selectedSector   != null ? `Sector ${selectedSector}` :
                  selectedDistrito != null ? `Distrito ${selectedDistrito}` : null,
      listaNominal,
      secciones:   mapSecciones.length,
      ubicados:    ubicados || null,
      sp:          fullName(sp),
      seccional:   selectedSeccion != null ? fullName(seccional) : null,
      promotores:  selectedSeccion != null && promotores.length ? promotores.length : null,
      fracciones:  selectedSeccion != null && fracciones.length ? fracciones.length : null,
      afiliados:   afiliados   || null,
      credenciales: credenciales || null,
    };
  }, [currentLevel, selectedSeccion, selectedSector, selectedDistrito, mapSecciones, ciudadanosGeo, afiliacionStats, sp, seccional, promotores, fracciones]);

  // ── Electoral panel ───────────────────────────────────────────────────────
  const renderElectoralPanel = () => {
    const scopeLabel = selectedSeccion != null ? `Sección ${selectedSeccion}` :
                       selectedSector   != null ? `Sector ${selectedSector}` :
                       selectedDistrito != null ? `Distrito Federal ${selectedDistrito}` :
                       'Municipio completo';

    if (!electoralStats) return (
      <div className="space-y-2">
        <div className="rounded-xl border border-dashed border-slate-200 p-4 text-center">
          <p className="text-xs text-slate-400">Cargando datos electorales…</p>
        </div>
      </div>
    );

    const { totals, grandTotal, winner, secGanadas, secciones, sorted, marginVotos, marginPct,
            isIEEM, is2024, is2024IEEM, isSenado, isDip, isDip2024,
            morena_solo_total, pt_solo_total, naem_solo_total,
            rosi_vs_aaron_total, mg_vs_fuerza_total, votos_nulos_total } = electoralStats;
    const is2024Any    = is2024 || is2024IEEM;
    const candTable    = isSenado ? CANDIDATOS_SENADO : isDip ? CANDIDATOS_DIP : is2024Any ? CANDIDATOS_2024 : CANDIDATOS_2021;
    const winnerCand   = candTable[winner];
    const winnerColor  = isSenado  ? (CANDIDATOS_SENADO[winner]?.fill ?? '#6B7280')
                       : isDip     ? (CANDIDATOS_DIP[winner]?.fill    ?? '#6B7280')
                       : is2024Any ? (CANDIDATOS_2024[winner]?.fill   ?? '#6B7280')
                       : (PARTY_FILL[winner] ?? '#6B7280');
    const totalSec     = Object.values(secGanadas).reduce((s, n) => s + n, 0);

    return (
      <div className="space-y-2.5">

        {/* Cabecera del proceso */}
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
          <div className="flex items-start justify-between gap-2">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 leading-none mb-1">Proceso electoral</p>
              <p className="text-xs font-bold text-slate-800 leading-snug">
                {isDip2024 ? 'Diputación Local 2024 - Interno · Tecámac'
                 : isSenado ? 'Senaduría 2024 · Tecámac'
                 : is2024Any ? 'Ayuntamiento Tecámac · 2024'
                 : 'Ayuntamiento Tecámac · 2021'}
              </p>
            </div>
            <span className={`text-[9px] font-bold px-2 py-1 rounded-full whitespace-nowrap flex-shrink-0 text-white ${
              isDip ? 'bg-slate-700' : is2024IEEM ? 'bg-emerald-700' : is2024 ? 'bg-blue-700' : isSenado ? 'bg-rose-900' : isIEEM ? 'bg-emerald-700' : 'bg-slate-700'
            }`}>
              {isDip2024 ? 'Interno' : is2024IEEM ? 'IEEM oficial' : is2024 ? 'Rosi Wong' : isSenado ? 'Senaduría 2024' : isIEEM ? 'IEEM oficial' : 'Datos internos'}
            </span>
          </div>
          <p className="text-[10px] text-slate-500 mt-1.5 flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block" />
            {scopeLabel} · {secciones} secciones
          </p>
        </div>

        {/* Ganador */}
        <div className="rounded-xl p-3 border-2 border-opacity-30" style={{
          backgroundColor: winnerColor + '15',
          borderColor: winnerColor + '50',
        }}>
          <div className="flex items-start gap-2.5">
            <div className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold text-white flex-shrink-0"
              style={{ backgroundColor: winnerColor }}>
              {winnerCand?.nombre?.split(' ').slice(0,2).map(w => w[0]).join('') ?? winner[0]}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded text-white" style={{ backgroundColor: winnerColor }}>
                  🏆 {winnerCand?.resultado ?? 'GANADOR'}
                </span>
              </div>
              <p className="text-xs font-bold text-slate-900 leading-snug">{winnerCand?.nombre ?? winner}</p>
              <p className="text-[10px] text-slate-500 mt-0.5 leading-snug">{winnerCand?.partido ?? winner}</p>
            </div>
          </div>
          <div className="mt-2.5 pt-2 border-t border-slate-200 grid grid-cols-3 gap-2">
            <div className="text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-0.5">Votos</p>
              <p className="text-base font-bold tabular-nums leading-none" style={{ color: winnerColor }}>{fmt(totals[winner])}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-0.5">Porcentaje</p>
              <p className="text-base font-bold tabular-nums leading-none" style={{ color: winnerColor }}>{pct(totals[winner], grandTotal)}</p>
            </div>
            <div className="text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none mb-0.5">Ventaja</p>
              <p className="text-base font-bold tabular-nums leading-none text-slate-700">+{marginPct}%</p>
            </div>
          </div>
        </div>

        {/* Comparativa Rosi vs Aaron (2024 interno y IEEM) */}
        {is2024Any && (
          <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
            <SectionTitle>Rosa Yolanda Wong vs Aaron Urbina</SectionTitle>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1">
                <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: CANDIDATOS_2024.ROSI.fill }}>Rosa Yolanda Wong</p>
                <p className="text-base font-bold tabular-nums" style={{ color: CANDIDATOS_2024.ROSI.fill }}>{fmt(totals['ROSI'])}</p>
                <p className="text-[10px] text-slate-400">{pct(totals['ROSI'], grandTotal)}</p>
              </div>
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <span className="text-sm font-black tabular-nums text-slate-700">
                  {rosi_vs_aaron_total >= 0 ? '+' : ''}{fmt(rosi_vs_aaron_total)}
                </span>
                <span className="text-[9px] text-slate-400 uppercase tracking-wider">diferencia</span>
              </div>
              <div className="flex-1 text-right">
                <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: CANDIDATOS_2024.AARON.fill }}>Aaron Urbina</p>
                <p className="text-base font-bold tabular-nums" style={{ color: CANDIDATOS_2024.AARON.fill }}>{fmt(totals['AARON'])}</p>
                <p className="text-[10px] text-slate-400">{pct(totals['AARON'], grandTotal)}</p>
              </div>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
              <div className="h-full rounded-l-full transition-all duration-700"
                style={{ width: pct(totals['ROSI'], grandTotal), backgroundColor: CANDIDATOS_2024.ROSI.fill }} />
              <div className="h-full rounded-r-full transition-all duration-700"
                style={{ width: pct(totals['AARON'], grandTotal), backgroundColor: CANDIDATOS_2024.AARON.fill }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px]" style={{ color: CANDIDATOS_2024.ROSI.fill }}>{pct(totals['ROSI'], grandTotal)} Rosi</span>
              <span className="text-[9px]" style={{ color: CANDIDATOS_2024.AARON.fill }}>Aaron {pct(totals['AARON'], grandTotal)}</span>
            </div>
          </div>
        )}

        {/* Comparativa MG vs Fuerza (solo senado_2024) */}
        {isSenado && (
          <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
            <SectionTitle>Mariela Gutiérrez vs Fuerza x México</SectionTitle>
            <div className="flex items-center gap-2 mb-2">
              <div className="flex-1">
                <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: CANDIDATOS_SENADO.MARIELA.fill }}>Mariela G.</p>
                <p className="text-base font-bold tabular-nums" style={{ color: CANDIDATOS_SENADO.MARIELA.fill }}>{fmt(totals['MARIELA'])}</p>
                <p className="text-[10px] text-slate-400">{pct(totals['MARIELA'], grandTotal)}</p>
              </div>
              <div className="flex flex-col items-center gap-1 flex-shrink-0">
                <span className="text-sm font-black tabular-nums text-slate-700">
                  {mg_vs_fuerza_total >= 0 ? '+' : ''}{fmt(mg_vs_fuerza_total)}
                </span>
                <span className="text-[9px] text-slate-400 uppercase tracking-wider">diferencia</span>
              </div>
              <div className="flex-1 text-right">
                <p className="text-[9px] font-bold uppercase tracking-widest mb-0.5" style={{ color: CANDIDATOS_SENADO.FUERZA.fill }}>Fuerza x Méx.</p>
                <p className="text-base font-bold tabular-nums" style={{ color: CANDIDATOS_SENADO.FUERZA.fill }}>{fmt(totals['FUERZA'])}</p>
                <p className="text-[10px] text-slate-400">{pct(totals['FUERZA'], grandTotal)}</p>
              </div>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden flex">
              <div className="h-full rounded-l-full transition-all duration-700"
                style={{ width: pct(totals['MARIELA'], grandTotal), backgroundColor: CANDIDATOS_SENADO.MARIELA.fill }} />
              <div className="h-full rounded-r-full transition-all duration-700"
                style={{ width: pct(totals['FUERZA'], grandTotal), backgroundColor: CANDIDATOS_SENADO.FUERZA.fill }} />
            </div>
            <div className="flex justify-between mt-1">
              <span className="text-[9px]" style={{ color: CANDIDATOS_SENADO.MARIELA.fill }}>{pct(totals['MARIELA'], grandTotal)} Mariela</span>
              <span className="text-[9px]" style={{ color: CANDIDATOS_SENADO.FUERZA.fill }}>Fuerza {pct(totals['FUERZA'], grandTotal)}</span>
            </div>
            {votos_nulos_total > 0 && (
              <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
                <span className="text-[9px] text-slate-400 uppercase tracking-widest">Votos nulos</span>
                <span className="text-[11px] font-bold tabular-nums text-slate-500">{fmt(votos_nulos_total)}</span>
              </div>
            )}
          </div>
        )}

        {/* Distribución de votos */}
        <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
          <SectionTitle>Distribución de votos</SectionTitle>
          <div className="space-y-2">
            {sorted.filter(([, v]) => v > 0).map(([party, votes]) => {
              const cand = candTable[party];
              const fill = isSenado ? (CANDIDATOS_SENADO[party]?.fill ?? '#6B7280') : isDip ? (CANDIDATOS_DIP[party]?.fill ?? '#6B7280') : is2024Any ? (CANDIDATOS_2024[party]?.fill ?? '#6B7280') : (PARTY_FILL[party] ?? '#6B7280');
              return (
                <div key={party}>
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5 min-w-0 flex-1">
                      <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: fill }} />
                      <span className="text-[11px] font-bold text-slate-700 flex-shrink-0">{cand?.nombre ?? party}</span>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                      <span className="text-[10px] text-slate-400 tabular-nums">{pct(votes, grandTotal)}</span>
                      <span className="text-[11px] font-bold tabular-nums text-slate-700 w-14 text-right">{fmt(votes)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: pct(votes, grandTotal), backgroundColor: fill }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
            <span className="text-[9px] text-slate-400 uppercase tracking-widest">Total votos</span>
            <span className="text-[11px] font-bold tabular-nums text-slate-700">{fmt(grandTotal)}</span>
          </div>
        </div>

        {/* Desglose coalición MORENA (solo IEEM) */}
        {isIEEM && (
          <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
            <SectionTitle>Coalición MORENA · PT · NAEM</SectionTitle>
            <p className="text-[9px] text-slate-400 mb-2 leading-relaxed">
              "Juntos Haremos Historia en el Estado de México" — votos por partido dentro de la candidatura común.
            </p>
            <div className="space-y-1.5">
              {[
                { label: 'MORENA', value: morena_solo_total, color: PARTY_FILL.MORENA },
                { label: 'PT', value: pt_solo_total, color: PARTY_FILL.PT },
                { label: 'NAEM', value: naem_solo_total, color: '#F97316' },
              ].filter(r => r.value > 0).map(r => (
                <div key={r.label}>
                  <div className="flex items-center justify-between mb-0.5">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: r.color }} />
                      <span className="text-[11px] font-bold text-slate-700">{r.label}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-slate-400 tabular-nums">{pct(r.value, totals['MORENA'])}</span>
                      <span className="text-[11px] font-bold tabular-nums text-slate-700 w-14 text-right">{fmt(r.value)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all duration-700"
                      style={{ width: pct(r.value, totals['MORENA']), backgroundColor: r.color }} />
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex justify-between items-center">
              <span className="text-[9px] text-slate-400 uppercase tracking-widest">Total coalición</span>
              <span className="text-[11px] font-bold tabular-nums text-slate-700">{fmt(totals['MORENA'])}</span>
            </div>
          </div>
        )}

        {/* Secciones ganadas */}
        <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
          <SectionTitle>Mapa político · Secciones ganadas</SectionTitle>
          <div className="space-y-1.5">
            {Object.entries(secGanadas).sort((a, b) => b[1] - a[1]).map(([party, count]) => {
              const fill = isSenado ? (CANDIDATOS_SENADO[party]?.fill ?? '#6B7280') : isDip ? (CANDIDATOS_DIP[party]?.fill ?? '#6B7280') : is2024Any ? (CANDIDATOS_2024[party]?.fill ?? '#6B7280') : (PARTY_FILL[party] ?? '#6B7280');
              const label = isSenado ? (CANDIDATOS_SENADO[party]?.nombre ?? party) : isDip ? (CANDIDATOS_DIP[party]?.nombre ?? party) : is2024Any ? (CANDIDATOS_2024[party]?.nombre ?? party) : party;
              return (
                <div key={party} className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-sm flex-shrink-0" style={{ backgroundColor: fill }} />
                  <span className="text-[11px] font-semibold text-slate-600 flex-1 truncate">{label}</span>
                  <div className="w-16 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(count / totalSec) * 100}%`, backgroundColor: fill }} />
                  </div>
                  <span className="text-[11px] font-bold tabular-nums text-slate-700 w-6 text-right">{count}</span>
                  <span className="text-[9px] text-slate-400 w-10 text-right">{pct(count, totalSec)}</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Candidatos */}
        <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
          <SectionTitle>{isSenado ? 'Candidatos · Senaduría 2024' : isDip ? 'Candidatos · Diputación Local 2024' : `Candidatos · Ayuntamiento ${is2024Any ? '2024' : '2021'}`}</SectionTitle>
          <div className="divide-y divide-slate-50">
            {sorted.filter(([, v]) => v > 0).map(([party, votes]) => {
                const cand = candTable[party];
                const fill = isSenado ? (CANDIDATOS_SENADO[party]?.fill ?? '#6B7280') : isDip ? (CANDIDATOS_DIP[party]?.fill ?? '#6B7280') : is2024Any ? (CANDIDATOS_2024[party]?.fill ?? '#6B7280') : (PARTY_FILL[party] ?? '#6B7280');
                if (!cand) return null;
                return (
                  <div key={party} className="flex items-center gap-2.5 py-2 first:pt-0 last:pb-0">
                    <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white flex-shrink-0"
                      style={{ backgroundColor: fill }}>
                      {cand.nombre.split(' ').slice(0, 2).map(w => w[0]).join('')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-semibold text-slate-800 leading-tight truncate">{cand.nombre}</p>
                      <p className="text-[9px] text-slate-400 leading-none mt-0.5">{cand.partido}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      {cand.resultado && (
                        <p className="text-[9px] font-bold" style={{ color: fill }}>{cand.resultado}</p>
                      )}
                      <p className="text-[10px] tabular-nums text-slate-500">{fmt(votes)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

        {/* Nota metodológica */}
        <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2">
          <p className="text-[9px] text-slate-400 leading-relaxed">
            {isSenado
              ? <><strong className="text-slate-500">Fuente:</strong> PREP / Actas de cómputo IEEM · Senaduría · Estado de México 2024. Filtrado al municipio de Tecámac (82), 197 secciones. Secciones 7011–7017 y 7018–7024 agrupadas en secciones históricas 4213 y 4228 respectivamente.</>
              : is2024IEEM
                ? <><strong className="text-slate-500">Fuente:</strong> Cómputo oficial IEEM · Municipio 82 (Tecámac) · Ayuntamiento 2024. Coalición PAN·PRI·PRD·NAEM (Aaron Urbina) sumada en todas sus combinaciones por sección. Secciones 7011–7017 y 7018–7024 agrupadas en secciones históricas 4213 y 4228 respectivamente.</>
              : is2024
                ? <><strong className="text-slate-500">Fuente:</strong> Base de datos interna · Ayuntamiento Tecámac 2024. Secciones 7011–7017 y 7018–7024 agrupadas en secciones históricas 4213 y 4228 respectivamente.</>
                : isIEEM
                  ? <><strong className="text-slate-500">Fuente:</strong> Cómputo oficial IEEM · Municipio 82 (Tecámac) · 2021. MORENA incluye votos de la candidatura común (MORENA + PT + NAEM). Secciones fraccionadas (7011–7017 → 4213, 7018–7024 → 4228, 6857–6867 → 4251) agrupadas en su sección histórica.</>
                  : <><strong className="text-slate-500">Fuente:</strong> Base de datos interna · Ayuntamiento Tecámac 2021. Secciones fraccionadas (7011–7017 → 4213, 7018–7024 → 4228, 6857–6867 → 4251) agrupadas en su sección histórica de origen.</>
            }
          </p>
        </div>
      </div>
    );
  };

  // ── Info panel ────────────────────────────────────────────────────────────
  const renderInfoPanel = () => {
    if (loadingInfo) return (
      <div className="space-y-2">
        {[1,2,3].map(i => <div key={i} className="h-10 bg-slate-100 rounded-xl animate-pulse" />)}
      </div>
    );

    // SECCIÓN
    if (selectedSeccion != null) {
      const secData    = allSecciones.find(s => s.seccion === selectedSeccion);
      const padronTotal = secData?.padron ?? secData?.padron_electoral;
      const smConUbic  = promotores.filter(p => p.latitud && Number(p.latitud) !== 0).length;
      const fracConSM  = fracciones.filter(f => promotores.some(p => p.ubt === f.fraccion)).length;
      const afSec      = afiliacionStats?.seccion;

      return (
        <div className="space-y-2.5">
          {secData?.nombre_distrito_federal && (
            <div className="bg-blue-50 border border-blue-100 rounded-xl px-3 py-2">
              <p className="text-[9px] font-bold uppercase tracking-widest text-blue-400 mb-0.5">Distrito Federal</p>
              <p className="text-xs font-semibold text-blue-800 leading-snug">{secData.nombre_distrito_federal}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-1.5">
            <StatCard label="Lista Nominal" value={fmt(secData?.lista_nominal)} accent />
            <StatCard label="Padrón" value={fmt(padronTotal)} sub="electoral" />
            <StatCard label="Fracciones" value={fracciones.length} />
            <StatCard label="SMs" value={promotores.length} sub="activos" />
          </div>

          {/* Cobertura + Afiliación */}
          <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm space-y-2">
            {fracciones.length > 0 && (
              <>
                <SectionTitle>Cobertura territorial</SectionTitle>
                <CoverageBar label="Fracciones con SM" value={fracConSM} total={fracciones.length} colorClass="bg-blue-500" />
                <CoverageBar label="SMs con ubicación" value={smConUbic} total={promotores.length} colorClass="bg-emerald-500" />
                {regCount != null && <CoverageBar label="Ciudadanos reg." value={regCount} total={Number(secData?.lista_nominal) || regCount} colorClass="bg-violet-400" />}
              </>
            )}
            {afSec && (
              <div className={fracciones.length > 0 ? 'pt-2 mt-1 border-t border-slate-100' : ''}>
                <SectionTitle accent="bg-teal-500">Actividad · Afiliación</SectionTitle>
                <AfilCard afiliados={afSec.afiliados} credenciales={afSec.credenciales_entregadas} />
              </div>
            )}
          </div>

          {/* Géneros */}
          {(secData?.hombres || secData?.mujeres) && (
            <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
              <SectionTitle>Lista nominal por género</SectionTitle>
              <DataRow label="Total" value={fmt(secData.lista_nominal)} highlight />
              <GenderBar total={secData.lista_nominal} hombres={secData.hombres} mujeres={secData.mujeres} />
            </div>
          )}

          {/* Responsables */}
          <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
            <SectionTitle>Responsables</SectionTitle>
            <div className="divide-y divide-slate-50">
              <ResponsableRow role="SP" name={fullName(sp)} roleColor="bg-violet-100 text-violet-700" avatarColor="bg-violet-100 text-violet-600" />
              <ResponsableRow role="RS" name={fullName(seccional)} roleColor="bg-pink-100 text-pink-700" avatarColor="bg-pink-100 text-pink-600" />
            </div>
          </div>

          {/* Fracciones */}
          {fracciones.length > 0 ? (
            <div>
              <SectionTitle>Fracciones y promotores SM</SectionTitle>
              <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 border-b border-slate-100">
                    <tr>
                      <th className="text-left px-2.5 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">Fracc.</th>
                      <th className="text-left px-2.5 py-2 text-[9px] font-bold uppercase tracking-widest text-slate-400">Promotora SM</th>
                      <th className="px-2.5 py-2 w-6"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {fracciones.map(f => {
                      const sm         = promotores.find(p => p.ubt === f.fraccion);
                      const isSelected = selectedSM?.ubt === f.fraccion;
                      const hasCoords  = sm?.latitud && Number(sm.latitud) !== 0 && !isNaN(Number(sm.latitud));
                      const dot        = sm ? (hasCoords ? 'bg-emerald-400' : 'bg-blue-400') : 'bg-slate-200';
                      return (
                        <tr
                          key={f.fraccion}
                          onClick={() => sm && handleSelectSM(sm)}
                          className={`transition-colors ${sm ? 'cursor-pointer' : ''} ${isSelected ? 'bg-blue-50 ring-1 ring-inset ring-blue-200' : 'hover:bg-slate-50'}`}
                        >
                          <td className={`px-2.5 py-2 font-bold text-[11px] ${isSelected ? 'text-blue-700' : 'text-slate-600'}`}>
                            <div className="flex items-center gap-1.5">
                              <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${dot}`} />
                              {f.fraccion}
                            </div>
                          </td>
                          <td className={`px-2.5 py-2 text-[11px] ${isSelected ? 'text-blue-600 font-semibold' : 'text-slate-600'}`}>
                            {fullName(sm) || <span className="text-slate-300 italic text-[10px]">Sin asignar</span>}
                          </td>
                          <td className="px-2.5 py-2 text-center text-xs">
                            {sm && (hasCoords ? '📍' : <span className="text-amber-400 font-bold">!</span>)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex gap-3 mt-1.5 px-1">
                <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />Con ubicación</span>
                <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-blue-400" />Sin ubicación</span>
                <span className="flex items-center gap-1 text-[9px] text-slate-400"><span className="w-1.5 h-1.5 rounded-full bg-slate-200" />Sin SM</span>
              </div>
              {selectedSM && (
                <div className={`mt-2.5 rounded-xl border p-3 ${focusCoords ? 'bg-emerald-50 border-emerald-200' : 'bg-amber-50 border-amber-200'}`}>
                  <div className="flex items-start justify-between gap-2 mb-1.5">
                    <div className="flex items-center gap-2">
                      <InitialAvatar name={fullName(selectedSM)} colorClass={focusCoords ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'} />
                      <div>
                        <p className="text-xs font-bold text-slate-800 leading-tight">{fullName(selectedSM)}</p>
                        <p className="text-[10px] text-slate-500 mt-0.5">Fracción <strong>{selectedSM.ubt}</strong></p>
                      </div>
                    </div>
                    <button onClick={() => { setSelectedSM(null); setFocusCoords(null); }} className="text-slate-400 hover:text-slate-600 text-lg leading-none flex-shrink-0">×</button>
                  </div>
                  {selectedSM.telefono_1 && (
                    <a href={`tel:${selectedSM.telefono_1}`} className="block text-[11px] text-slate-600 mb-1.5 hover:text-blue-600 transition-colors">📞 {selectedSM.telefono_1}</a>
                  )}
                  <div className={`flex items-center gap-1 text-[11px] font-semibold ${focusCoords ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {focusCoords ? <>📍 Ubicación marcada en el mapa</> : <>⚠ Sin coordenadas registradas</>}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <EmptyGuide>No hay fracciones registradas para esta sección.</EmptyGuide>
          )}
        </div>
      );
    }

    // SECTOR
    if (selectedSector != null) {
      const secData      = allSecciones.filter(s => s.pologono === selectedSector);
      const listaNominal = secData.reduce((s, x) => s + (Number(x.lista_nominal) || 0), 0);
      const af           = afiliacionStats;
      const afKey        = String(selectedSector);
      const afSect       = af?.bySector?.[afKey];
      const secRows      = secData
        .map(s => ({ sec: s.seccion, ...afiliacionBySec[s.seccion] }))
        .filter(r => r.afiliados != null)
        .sort((a, b) => a.sec - b.sec)
        .map(r => ({ label: `Sec. ${r.sec}`, afiliados: r.afiliados, credenciales: r.credenciales_entregadas }));

      return (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-1.5">
            <StatCard label="Lista Nominal" value={fmt(listaNominal)} accent wide />
            <StatCard label="Secciones" value={secData.length} sub="en este sector" />
            <StatCard label="Ubicados" value={ciudadanosGeo.length || '—'} sub="con coordenadas" />
          </div>
          {afSect && (
            <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
              <SectionTitle accent="bg-teal-500">Actividad · Afiliación Sector {selectedSector}</SectionTitle>
              <AfilCard afiliados={afSect.afiliados} credenciales={afSect.credenciales} />
              <AfilTable rows={secRows} />
            </div>
          )}
          <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
            <SectionTitle>Coordinador de Sector</SectionTitle>
            <ResponsableRow role="SP" name={fullName(sp)} roleColor="bg-violet-100 text-violet-700" avatarColor="bg-violet-100 text-violet-600" />
          </div>
          <EmptyGuide>Selecciona una sección del mapa o del navegador para ver el detalle.</EmptyGuide>
        </div>
      );
    }

    // DISTRITO
    if (selectedDistrito != null) {
      const secData      = allSecciones.filter(s => s.distrito_federal === selectedDistrito);
      const listaNominal = secData.reduce((s, x) => s + (Number(x.lista_nominal) || 0), 0);
      const af           = afiliacionStats;
      const dKey         = String(selectedDistrito);
      const afDist       = af?.byDistrito?.[dKey];
      const sectoresEnDist = [...new Set(secData.map(s => s.pologono))].sort((a,b) => a-b);
      const sectRows = sectoresEnDist
        .map(s => af?.bySector?.[String(s)] ? { label: `Sector ${s}`, ...af.bySector[String(s)] } : null)
        .filter(Boolean);

      return (
        <div className="space-y-2.5">
          <div className="grid grid-cols-2 gap-1.5">
            <StatCard label="Lista Nominal" value={fmt(listaNominal)} accent wide />
            <StatCard label="Secciones" value={secData.length} />
            <StatCard label="Sectores" value={sectores.length} />
          </div>
          {afDist && (
            <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
              <SectionTitle accent="bg-teal-500">Actividad · Afiliación Dto. {selectedDistrito}</SectionTitle>
              <AfilCard afiliados={afDist.afiliados} credenciales={afDist.credenciales} />
              <AfilTable rows={sectRows} />
            </div>
          )}
          <EmptyGuide>Selecciona un sector para ver sus secciones y coordinadores.</EmptyGuide>
        </div>
      );
    }

    // MUNICIPIO
    const totalNominal  = allSecciones.reduce((s, x) => s + (Number(x.lista_nominal) || 0), 0);
    const totalSectores = [...new Set(allSecciones.map(s => s.pologono))].length;
    const af            = afiliacionStats;
    const afTotal       = af?.total;
    const sectorRows    = Object.entries(af?.bySector ?? {})
      .sort((a,b) => Number(a[0]) - Number(b[0]))
      .map(([k, v]) => ({ label: `S-${k}`, ...v }));

    return (
      <div className="space-y-2.5">
        <div className="grid grid-cols-2 gap-1.5">
          <StatCard label="Lista Nominal" value={fmt(totalNominal)} accent wide />
          <StatCard label="Secciones" value={allSecciones.length} sub="en el municipio" />
          <StatCard label="Distritos" value={distritos.length} />
          <StatCard label="Sectores" value={totalSectores} />
        </div>
        {afTotal?.afiliados > 0 && (
          <div className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm">
            <SectionTitle accent="bg-teal-500">Actividad · Afiliación Municipal</SectionTitle>
            <AfilCard afiliados={afTotal.afiliados} credenciales={afTotal.credenciales} />
            <AfilTable rows={sectorRows} />
          </div>
        )}
        <EmptyGuide>Selecciona un distrito federal para comenzar el análisis territorial.</EmptyGuide>
      </div>
    );
  };

  const levelLabel = ['Vista general del municipio', `Distrito Federal ${selectedDistrito ?? ''}`, `Sector ${selectedSector ?? ''}`, `Sección ${selectedSeccion ?? ''}`][currentLevel];

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      <header className="bg-white border-b border-slate-100 shadow-sm">
        <div className="px-4 md:px-6 h-14 flex items-center gap-3">
          <button onClick={goBack} className="flex items-center justify-center w-8 h-8 rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 hover:text-slate-700 hover:border-slate-300 transition-all flex-shrink-0" title="Volver">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M9 11L5 7L9 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold tracking-tight text-slate-900 whitespace-nowrap">Tablero Territorial</h1>
              <span className="hidden sm:block text-slate-200 text-xs">·</span>
              <span className="hidden sm:block text-xs text-slate-400 truncate">{levelLabel}</span>
            </div>
            <nav className="flex items-center gap-1 mt-0.5">
              {crumbs.map((c, i) => (
                <React.Fragment key={i}>
                  {i > 0 && <span className="text-slate-200 text-[10px]">›</span>}
                  {c.onClick
                    ? <button onClick={c.onClick} className="text-[11px] text-blue-500 hover:text-blue-700 font-medium transition-colors">{c.label}</button>
                    : <span className="text-[11px] text-slate-600 font-bold">{c.label}</span>
                  }
                </React.Fragment>
              ))}
            </nav>
          </div>

          <div className="hidden sm:flex items-center gap-0.5 bg-slate-100 rounded-lg p-0.5 flex-shrink-0">
            <button
              onClick={() => setMapScope('tecamac')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
                mapScope === 'tecamac' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Tablero Territorial Tecámac
            </button>
            <button
              onClick={() => setMapScope('edomex')}
              className={`px-3 py-1.5 rounded-md text-xs font-semibold whitespace-nowrap transition-all ${
                mapScope === 'edomex' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              Mapa Territorial Estado de México
            </button>
          </div>

          {!loadingMap && mapScope === 'tecamac' && (
            <div className="flex items-center gap-4 ml-auto flex-shrink-0">
              <div className="hidden md:flex items-center gap-4">
                <div className="text-right">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none">Secciones</p>
                  <p className="text-base font-bold tabular-nums text-slate-800 leading-none mt-0.5">{mapStats.secciones}</p>
                </div>
                <div className="w-px h-6 bg-slate-100" />
                <div className="text-right">
                  <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none">Lista nominal</p>
                  <p className="text-base font-bold tabular-nums text-blue-600 leading-none mt-0.5">{fmt(mapStats.listaNominal)}</p>
                </div>
                {ciudadanosGeo.length > 0 && <>
                  <div className="w-px h-6 bg-slate-100" />
                  <div className="text-right">
                    <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400 leading-none">Ubicados</p>
                    <p className="text-base font-bold tabular-nums text-emerald-600 leading-none mt-0.5">{ciudadanosGeo.filter(c => c.latitud && c.longitud).length}</p>
                  </div>
                </>}
              </div>
              <div className={`hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wide border ${
                currentLevel === 3 ? 'bg-violet-50 text-violet-600 border-violet-200' :
                currentLevel === 2 ? 'bg-emerald-50 text-emerald-600 border-emerald-200' :
                currentLevel === 1 ? 'bg-blue-50 text-blue-600 border-blue-200' :
                'bg-slate-50 text-slate-500 border-slate-200'
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${currentLevel === 3 ? 'bg-violet-400' : currentLevel === 2 ? 'bg-emerald-400' : currentLevel === 1 ? 'bg-blue-400' : 'bg-slate-300'}`} />
                {['Municipio','Distrito','Sector','Sección'][currentLevel]}
              </div>
            </div>
          )}
        </div>
      </header>

      {mapScope === 'edomex' ? (
        <MapaEstadoMexico />
      ) : (
      <div className="flex flex-col lg:flex-row" style={{ height: 'calc(100vh - 56px)' }}>
        <aside className="w-full lg:w-72 xl:w-80 flex-shrink-0 bg-white border-b lg:border-b-0 lg:border-r border-slate-100 overflow-y-auto">
          <div className="px-4 pt-4 pb-3 border-b border-slate-50">
            <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-slate-400 mb-3">Nivel de análisis</p>
            <div className="flex items-center gap-0">
              {['Municipio','Distrito','Sector','Sección'].map((lbl, i) => (
                <React.Fragment key={i}>
                  <button
                    onClick={() => {
                      if (i === 0) { setSelectedDistrito(null); setSelectedSector(null); setSelectedSeccion(null); }
                      if (i === 1 && selectedDistrito) { setSelectedSector(null); setSelectedSeccion(null); }
                      if (i === 2 && selectedSector) setSelectedSeccion(null);
                    }}
                    disabled={i > currentLevel}
                    className={`flex flex-col items-center gap-1 px-1 transition-all ${i > currentLevel ? 'opacity-25 cursor-default' : 'cursor-pointer'}`}
                  >
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                      i === currentLevel ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' :
                      i < currentLevel ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'
                    }`}>
                      {i < currentLevel ? '✓' : i + 1}
                    </div>
                    <span className={`text-[9px] font-semibold whitespace-nowrap ${i === currentLevel ? 'text-blue-600' : i < currentLevel ? 'text-slate-500' : 'text-slate-300'}`}>{lbl}</span>
                  </button>
                  {i < 3 && <div className={`flex-1 h-px mt-[-14px] mb-4 transition-all ${i < currentLevel ? 'bg-blue-200' : 'bg-slate-100'}`} />}
                </React.Fragment>
              ))}
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div>
              <SectionTitle accent="bg-blue-500">Distrito Federal</SectionTitle>
              {loadingMap
                ? <div className="flex flex-wrap gap-2">{[1,2,3].map(i => <div key={i} className="h-7 w-16 bg-slate-100 rounded-lg animate-pulse" />)}</div>
                : <div className="flex flex-wrap gap-1.5">{distritos.map(d => <Pill key={d} label={`Dto. ${d}`} active={selectedDistrito === d} color="blue" onClick={() => selectDistrito(d)} />)}</div>
              }
            </div>
            {selectedDistrito && (
              <div>
                <SectionTitle accent="bg-emerald-500">Sectores</SectionTitle>
                <div className="flex flex-wrap gap-1.5">
                  {sectores.map(s => <Pill key={s} label={`Sector ${s}`} active={selectedSector === s} color="green" onClick={() => selectSector(s)} />)}
                </div>
              </div>
            )}
            {selectedSector && (
              <div>
                <SectionTitle accent="bg-violet-500">Secciones</SectionTitle>
                <div className="flex flex-wrap gap-1.5">
                  {seccionesDeNivel.map(s => <Pill key={s} label={`${s}`} active={selectedSeccion === s} color="violet" onClick={() => selectSeccion(s)} />)}
                </div>
              </div>
            )}
            {!loadingMap && (
              <div className="pt-3 border-t border-slate-100">
                {/* Header dinámico */}
                <div className="flex items-center justify-between mb-2 gap-2">
                  <SectionTitle accent={
                    electoralMode === 'dip_2024'      ? 'bg-slate-700' :
                    electoralMode === 'ayu_2024'      ? 'bg-blue-700' :
                    electoralMode === 'ayu_2024_ieem' ? 'bg-emerald-700' :
                    electoralMode === 'senado_2024'   ? 'bg-rose-900' :
                    electoralMode === 'ayu_2021_ieem' ? 'bg-emerald-700' :
                    electoralMode ? 'bg-red-800' :
                    currentLevel === 3 ? 'bg-violet-500' : currentLevel === 2 ? 'bg-emerald-500' :
                    currentLevel === 1 ? 'bg-blue-500' : 'bg-slate-400'
                  }>
                    {electoralMode === 'dip_2024'
                      ? 'Diputación Local 2024 · Interno'
                      : electoralMode === 'senado_2024'
                          ? 'Electoral 2024 · Senaduría'
                          : electoralMode === 'ayu_2024_ieem'
                            ? 'Electoral 2024 · IEEM oficial'
                            : electoralMode === 'ayu_2024'
                              ? 'Electoral 2024 · Rosi Wong'
                              : electoralMode === 'ayu_2021_ieem'
                                ? 'Electoral 2021 · IEEM oficial'
                                : electoralMode
                                  ? 'Análisis electoral · Ayuntamiento 2021'
                                  : (currentLevel === 3 ? `Sección ${selectedSeccion}` : currentLevel === 2 ? `Sector ${selectedSector}` : currentLevel === 1 ? `Distrito ${selectedDistrito}` : 'Vista general')
                    }
                  </SectionTitle>
                  {electoralMode && (
                    <button
                      onClick={() => setElectoralMode(null)}
                      className="text-[9px] text-slate-400 hover:text-slate-600 flex-shrink-0 underline"
                    >
                      Ver territorial
                    </button>
                  )}
                </div>

                {/* Panel con efecto fade + slide al cambiar de modo */}
                <div style={{
                  opacity:   panelFade ? 1 : 0,
                  transform: panelFade ? 'translateY(0)' : 'translateY(6px)',
                  transition: 'opacity 0.25s ease, transform 0.25s ease',
                }}>
                  {electoralMode ? renderElectoralPanel() : renderInfoPanel()}
                </div>
              </div>
            )}
          </div>
        </aside>

        <main className="flex-1 min-w-0 relative">
          {loadingMap ? (
            <div className="flex flex-col items-center justify-center h-full bg-slate-100 gap-3">
              <div className="w-8 h-8 border-2 border-blue-300 border-t-blue-600 rounded-full animate-spin" />
              <p className="text-slate-400 text-sm font-medium">Cargando datos territoriales…</p>
            </div>
          ) : (
            <div className="h-full">
              <MapTerritorial
                secciones={mapSecciones}
                ciudadanos={ciudadanosGeo}
                fraccionesGeo={fraccionesWithSM}
                selectedSeccion={selectedSeccion}
                onSelectSeccion={selectSeccionFromMap}
                seccionalName={fullName(seccional)}
                spName={fullName(sp)}
                focusCoords={focusCoords}
                onClearFocus={() => { setSelectedSM(null); setFocusCoords(null); }}
                afiliacionBySec={afiliacionBySec}
                printContext={printContext}
                electoralModeExternal={electoralMode}
                onElectoralModeChange={setElectoralMode}
              />
            </div>
          )}
        </main>
      </div>
      )}
    </div>
  );
};

export default TableroBoard;
