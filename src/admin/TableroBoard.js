import React, { useCallback, useEffect, useMemo, useState } from 'react';
import supabase from '../supabase/client';
import MapTerritorial from '../map/MapTerritorial';

// ── Helpers ──────────────────────────────────────────────────────────────────

const fullName = (p) => p ? `${p.nombre} ${p.a_paterno} ${p.a_materno}`.trim() : null;

const StatCard = ({ label, value, sub, accent }) => (
  <div className={`rounded-lg p-3 flex flex-col gap-0.5 ${accent ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200'}`}>
    <p className={`text-xs font-medium uppercase tracking-wide ${accent ? 'text-blue-100' : 'text-gray-500'}`}>{label}</p>
    <p className={`text-xl font-bold ${accent ? 'text-white' : 'text-gray-800'}`}>{value ?? '—'}</p>
    {sub && <p className={`text-xs ${accent ? 'text-blue-200' : 'text-gray-400'}`}>{sub}</p>}
  </div>
);

const Pill = ({ label, active, color = 'blue', onClick }) => {
  const base = 'px-3 py-1.5 rounded-full text-sm font-medium border transition-all cursor-pointer select-none';
  const styles = {
    blue:   active ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-white text-blue-700 border-blue-300 hover:bg-blue-50',
    green:  active ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' : 'bg-white text-emerald-700 border-emerald-300 hover:bg-emerald-50',
    violet: active ? 'bg-violet-600 text-white border-violet-600 shadow-sm' : 'bg-white text-violet-700 border-violet-300 hover:bg-violet-50',
    pink:   active ? 'bg-pink-600 text-white border-pink-600 shadow-sm' : 'bg-white text-pink-700 border-pink-300 hover:bg-pink-50',
  };
  return <button className={`${base} ${styles[color]}`} onClick={onClick}>{label}</button>;
};

const SectionTitle = ({ children }) => (
  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-2">{children}</p>
);

// ── Component ─────────────────────────────────────────────────────────────────

const TableroBoard = () => {
  // Datos base
  const [allSecciones, setAllSecciones]   = useState([]);
  const [loadingMap, setLoadingMap]        = useState(true);

  // Selección de nivel
  const [selectedDistrito, setSelectedDistrito] = useState(null);
  const [selectedSector,   setSelectedSector]   = useState(null);
  const [selectedSeccion,  setSelectedSeccion]  = useState(null);

  // Datos del nivel actual
  const [sp,          setSp]          = useState(null);
  const [seccional,   setSeccional]   = useState(null);
  const [promotores,  setPromotores]  = useState([]);
  const [fracciones,  setFracciones]  = useState([]);
  const [regCount,    setRegCount]    = useState(null);
  const [loadingInfo, setLoadingInfo] = useState(false);

  // ── Fetch inicial: todas las secciones ───────────────────────────────────
  useEffect(() => {
    const fetchAll = async () => {
      setLoadingMap(true);
      const { data } = await supabase
        .from('secciones')
        .select('id, seccion, pologono, distrito_federal, lista_nominal, geometry');
      setAllSecciones(data ?? []);
      setLoadingMap(false);
    };
    fetchAll();
  }, []);

  // ── Derivados: jerarquía desde allSecciones ───────────────────────────────
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

  // Secciones que se muestran en el mapa según el nivel activo
  const mapSecciones = useMemo(() => {
    if (selectedSeccion != null)
      return allSecciones.filter(s => s.seccion === selectedSeccion);
    if (selectedSector != null)
      return allSecciones.filter(s => s.pologono === selectedSector);
    if (selectedDistrito != null)
      return allSecciones.filter(s => s.distrito_federal === selectedDistrito);
    return allSecciones;
  }, [allSecciones, selectedDistrito, selectedSector, selectedSeccion]);

  // Stats globales del nivel mostrado en mapa
  const mapStats = useMemo(() => {
    const total = mapSecciones.reduce((s, x) => s + (Number(x.lista_nominal) || 0), 0);
    return { secciones: mapSecciones.length, listaNominal: total };
  }, [mapSecciones]);

  // ── Fetch al seleccionar sector ───────────────────────────────────────────
  useEffect(() => {
    if (!selectedSector) { setSp(null); return; }
    const fetch = async () => {
      const { data } = await supabase
        .from('ciudadania')
        .select('nombre, a_paterno, a_materno')
        .eq('puesto', 'SP')
        .eq('poligono', selectedSector)
        .eq('status', 'ACTIVO')
        .maybeSingle();
      setSp(data);
    };
    fetch();
  }, [selectedSector]);

  // ── Fetch al seleccionar sección ──────────────────────────────────────────
  useEffect(() => {
    if (!selectedSeccion) {
      setSeccional(null); setPromotores([]); setFracciones([]); setRegCount(null);
      return;
    }
    const fetchSeccion = async () => {
      setLoadingInfo(true);
      const [rsRes, smRes, fracRes, regRes] = await Promise.all([
        supabase.from('ciudadania')
          .select('nombre, a_paterno, a_materno')
          .eq('puesto', 'SECCIONAL').eq('seccion', selectedSeccion).eq('status', 'ACTIVO').maybeSingle(),
        supabase.from('ciudadania')
          .select('nombre, a_paterno, a_materno, ubt, telefono')
          .eq('puesto', 'SM').eq('seccion', selectedSeccion).eq('status', 'ACTIVO')
          .order('ubt', { ascending: true }),
        supabase.from('ubt_catalogo')
          .select('fraccion')
          .eq('seccion', selectedSeccion)
          .order('fraccion', { ascending: true }),
        supabase.from('ciudadania')
          .select('id', { count: 'exact', head: true })
          .eq('seccion', selectedSeccion).eq('status', 'ACTIVO'),
      ]);
      setSeccional(rsRes.data ?? null);
      setPromotores(smRes.data ?? []);
      setFracciones(fracRes.data?.map(f => f.fraccion) ?? []);
      setRegCount(regRes.count ?? 0);
      setLoadingInfo(false);
    };
    fetchSeccion();
  }, [selectedSeccion]);

  // ── Handlers de selección con reset en cascada ───────────────────────────
  const selectDistrito = useCallback((d) => {
    setSelectedDistrito(prev => prev === d ? null : d);
    setSelectedSector(null);
    setSelectedSeccion(null);
  }, []);

  const selectSector = useCallback((s) => {
    setSelectedSector(prev => prev === s ? null : s);
    setSelectedSeccion(null);
  }, []);

  const selectSeccion = useCallback((s) => {
    setSelectedSeccion(prev => prev === s ? null : s);
  }, []);

  const selectSeccionFromMap = useCallback((sec) => {
    setSelectedDistrito(sec.distrito_federal);
    setSelectedSector(sec.pologono);
    setSelectedSeccion(sec.seccion);
  }, []);

  // ── Breadcrumb ────────────────────────────────────────────────────────────
  const crumbs = useMemo(() => {
    const list = [{ label: 'Municipio', onClick: () => { setSelectedDistrito(null); setSelectedSector(null); setSelectedSeccion(null); } }];
    if (selectedDistrito) list.push({ label: `Distrito ${selectedDistrito}`, onClick: () => { setSelectedSector(null); setSelectedSeccion(null); } });
    if (selectedSector)   list.push({ label: `Sector ${selectedSector}`, onClick: () => setSelectedSeccion(null) });
    if (selectedSeccion)  list.push({ label: `Sección ${selectedSeccion}`, onClick: null });
    return list;
  }, [selectedDistrito, selectedSector, selectedSeccion]);

  // ── Info panel del nivel actual ───────────────────────────────────────────
  const renderInfoPanel = () => {
    if (selectedSeccion != null) {
      const secData = allSecciones.find(s => s.seccion === selectedSeccion);
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Lista Nominal" value={secData?.lista_nominal ? Number(secData.lista_nominal).toLocaleString() : '—'} accent />
            <StatCard label="Registrados" value={regCount != null ? regCount.toLocaleString() : '…'} sub="ciudadanos activos" />
            <StatCard label="Fracciones" value={fracciones.length} sub="en esta sección" />
            <StatCard label="Promotores SM" value={promotores.length} sub="activos asignados" />
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-3 space-y-1">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-2">Responsables</p>
            <div className="flex items-start gap-2">
              <span className="text-xs bg-violet-100 text-violet-700 rounded px-2 py-0.5 font-medium mt-0.5">SP</span>
              <p className="text-sm text-gray-700">{fullName(sp) || 'Sin asignar'}</p>
            </div>
            <div className="flex items-start gap-2">
              <span className="text-xs bg-pink-100 text-pink-700 rounded px-2 py-0.5 font-medium mt-0.5">RS</span>
              <p className="text-sm text-gray-700">{fullName(seccional) || 'Sin asignar'}</p>
            </div>
          </div>

          {fracciones.length > 0 && (
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-2">Fracciones y promotores</p>
              <div className="overflow-auto rounded-lg border border-gray-200">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs">
                    <tr>
                      <th className="text-left px-3 py-2">Fracción</th>
                      <th className="text-left px-3 py-2">Promotor SM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {fracciones.map(f => {
                      const sm = promotores.find(p => p.ubt === f);
                      return (
                        <tr key={f} className="hover:bg-gray-50">
                          <td className="px-3 py-2 font-medium text-gray-700">{f}</td>
                          <td className="px-3 py-2 text-gray-600">{fullName(sm) || <span className="text-gray-300">—</span>}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      );
    }

    if (selectedSector != null) {
      const secData = allSecciones.filter(s => s.pologono === selectedSector);
      const listaNominal = secData.reduce((s, x) => s + (Number(x.lista_nominal) || 0), 0);
      return (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Lista Nominal" value={listaNominal.toLocaleString()} accent />
            <StatCard label="Secciones" value={secData.length} sub="en este sector" />
          </div>
          <div className="bg-white border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold mb-2">Coordinador de Sector</p>
            <div className="flex items-center gap-2">
              <span className="text-xs bg-violet-100 text-violet-700 rounded px-2 py-0.5 font-medium">SP</span>
              <p className="text-sm text-gray-700">{fullName(sp) || 'Sin asignar'}</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 text-center">Selecciona una sección para ver detalle</p>
        </div>
      );
    }

    if (selectedDistrito != null) {
      const secData = allSecciones.filter(s => s.distrito_federal === selectedDistrito);
      const listaNominal = secData.reduce((s, x) => s + (Number(x.lista_nominal) || 0), 0);
      return (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Lista Nominal" value={listaNominal.toLocaleString()} accent />
            <StatCard label="Secciones" value={secData.length} />
            <StatCard label="Sectores" value={sectores.length} />
          </div>
          <p className="text-xs text-gray-400 text-center">Selecciona un sector para ver detalle</p>
        </div>
      );
    }

    // Municipio completo
    const totalNominal = allSecciones.reduce((s, x) => s + (Number(x.lista_nominal) || 0), 0);
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Lista Nominal Total" value={totalNominal.toLocaleString()} accent />
          <StatCard label="Secciones" value={allSecciones.length} sub="en el municipio" />
          <StatCard label="Distritos" value={distritos.length} />
          <StatCard label="Sectores" value={[...new Set(allSecciones.map(s => s.pologono))].length} />
        </div>
        <p className="text-xs text-gray-400 text-center">Selecciona un distrito para comenzar</p>
      </div>
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">

      {/* Header */}
      <div className="mb-5">
        <h1 className="text-2xl font-bold text-gray-800">Tablero Territorial</h1>
        {/* Breadcrumb */}
        <nav className="flex items-center gap-1.5 mt-1 flex-wrap">
          {crumbs.map((c, i) => (
            <React.Fragment key={i}>
              {i > 0 && <span className="text-gray-300 text-sm">/</span>}
              {c.onClick ? (
                <button
                  onClick={c.onClick}
                  className="text-sm text-blue-600 hover:text-blue-800 hover:underline font-medium"
                >
                  {c.label}
                </button>
              ) : (
                <span className="text-sm text-gray-600 font-semibold">{c.label}</span>
              )}
            </React.Fragment>
          ))}
        </nav>
      </div>

      <div className="flex flex-col lg:flex-row gap-5">

        {/* ── Panel izquierdo: filtros ──────────────────────────────────── */}
        <aside className="w-full lg:w-72 xl:w-80 flex-shrink-0 space-y-4">

          {/* Distritos */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <SectionTitle>Distrito Federal</SectionTitle>
            {loadingMap ? (
              <p className="text-xs text-gray-400">Cargando...</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {distritos.map(d => (
                  <Pill
                    key={d}
                    label={`Dto. ${d}`}
                    active={selectedDistrito === d}
                    color="blue"
                    onClick={() => selectDistrito(d)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Sectores */}
          {selectedDistrito && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <SectionTitle>Sectores</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {sectores.map(s => (
                  <Pill
                    key={s}
                    label={`Sector ${s}`}
                    active={selectedSector === s}
                    color="green"
                    onClick={() => selectSector(s)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Secciones */}
          {selectedSector && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <SectionTitle>Secciones</SectionTitle>
              <div className="flex flex-wrap gap-2">
                {seccionesDeNivel.map(s => (
                  <Pill
                    key={s}
                    label={`${s}`}
                    active={selectedSeccion === s}
                    color="violet"
                    onClick={() => selectSeccion(s)}
                  />
                ))}
              </div>
            </div>
          )}
        </aside>

        {/* ── Panel derecho: mapa + info ────────────────────────────────── */}
        <div className="flex-1 min-w-0 space-y-4">

          {/* Mapa */}
          {loadingMap ? (
            <div className="flex items-center justify-center h-64 bg-white rounded-xl border border-gray-200">
              <p className="text-gray-400 text-sm">Cargando datos territoriales...</p>
            </div>
          ) : (
            <MapTerritorial
              secciones={mapSecciones}
              selectedSeccion={selectedSeccion}
              onSelectSeccion={selectSeccionFromMap}
            />
          )}

          {/* Estadísticas del nivel actual */}
          {!loadingMap && (
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-3">
                <p className="font-semibold text-gray-700 text-sm">
                  {selectedSeccion != null ? `Detalle — Sección ${selectedSeccion}` :
                   selectedSector   != null ? `Sector ${selectedSector}` :
                   selectedDistrito != null ? `Distrito ${selectedDistrito}` :
                   'Municipio completo'}
                </p>
                <span className="text-xs text-gray-400">
                  {mapStats.secciones} sección{mapStats.secciones !== 1 ? 'es' : ''} visibles
                </span>
              </div>
              {loadingInfo ? (
                <p className="text-xs text-gray-400">Cargando información...</p>
              ) : (
                renderInfoPanel()
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default TableroBoard;
