import React from 'react';
import { MOBILIZER_SCALE, mobilizerStatus } from '../utils/mobilizerProgress';

const fmt = value => Number(value).toLocaleString('es-MX');

// Shared by the mobile/desktop Inicio cards and the map's sector/section report.
export default function MobilizerProgress({ progress, sector, section, onSelectSection, onViewMap, onRetry }) {
  const { loaded, error, bySection, total } = progress;
  const scope = section ? bySection[Number(section)] : total;
  const pct = scope?.meta > 0 ? scope.pct : null;
  const status = mobilizerStatus(pct);
  const isReport = Boolean(onSelectSection);
  const entries = Object.entries(bySection).sort((a, b) => a[1].pct - b[1].pct || Number(a[0]) - Number(b[0]));

  return (
    <section aria-label={isReport ? 'Reporte de movilizadores' : 'Avance de movilizadores'}
      className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-3 border-b border-slate-100">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 leading-none mb-1">Desdoble movilizadores</p>
            <h2 className="text-sm font-bold text-slate-800">Avance MGS</h2>
          </div>
          <span className="text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap text-white"
            style={{ backgroundColor: error || !loaded ? '#9CA3AF' : status.color }}>
            {error ? 'Sin actualizar' : !loaded ? 'Cargando…' : status.label}
          </span>
        </div>
        <p className="text-xs text-slate-500">Sector {sector}{section ? ` · Sección ${section}` : ''}</p>
      </div>
      <div className="p-4 space-y-3">
        {error ? (
          <div role="alert" className="text-xs text-slate-600 space-y-2">
            <p>No se pudo cargar el avance de movilizadores.</p>
            <button type="button" onClick={onRetry} className="font-bold text-sky-700 underline py-2">Reintentar</button>
          </div>
        ) : !loaded ? (
          <p role="status" className="text-xs text-slate-500">Cargando movilizadores y metas del sector…</p>
        ) : !scope ? (
          <p className="text-xs text-slate-500">Esta sección no pertenece al sector.</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2">
              {[
                ['Registrados', fmt(scope.count)], ['Meta', fmt(scope.meta)],
                ['Pendientes', scope.meta > 0 ? fmt(Math.max(scope.meta - scope.count, 0)) : '—'],
                ['Avance', pct == null ? '—' : `${pct.toFixed(1)}%`],
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl p-3 text-center border border-slate-100 bg-slate-50"
                  style={label === 'Avance' ? { backgroundColor: status.color + '12', borderColor: status.color + '30' } : {}}>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 leading-none mb-1.5">{label}</p>
                  <p className="text-xl font-black tabular-nums text-slate-700" style={label === 'Avance' ? { color: status.color } : {}}>{value}</p>
                </div>
              ))}
            </div>
            {pct != null && (
              <div role="progressbar" aria-label="Avance de movilizadores" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
                className="h-2.5 rounded-full overflow-hidden bg-slate-100">
                <div className="h-full rounded-full transition-all duration-500" style={{ width: `${pct}%`, backgroundColor: status.color }} />
              </div>
            )}
            <p className="text-xs text-slate-500">Meta: 10 movilizadores por fracción del catálogo · solo registros activos.</p>
            {isReport && !section && (
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Por sección · menor a mayor avance</p>
                <div className="space-y-1">
                  {entries.map(([number, entry]) => {
                    const rowStatus = mobilizerStatus(entry.meta > 0 ? entry.pct : null);
                    return (
                      <button type="button" key={number} onClick={() => onSelectSection(number)}
                        className="w-full text-left rounded-xl p-2.5 hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-sky-600">
                        <div className="flex items-center justify-between gap-2 text-xs mb-1">
                          <span className="font-semibold text-slate-700">Sección {number}</span>
                          <span className="tabular-nums text-slate-500">{fmt(entry.count)}/{fmt(entry.meta)}</span>
                          <span className="font-bold tabular-nums" style={{ color: rowStatus.color }}>{entry.meta > 0 ? `${entry.pct.toFixed(0)}%` : 'Sin meta'}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${entry.pct}%`, backgroundColor: rowStatus.color }} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {isReport && (
              <div className="space-y-1.5 border-t border-slate-100 pt-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Escala de avance</p>
                {MOBILIZER_SCALE.map(item => (
                  <div key={item.label} className="flex items-center gap-2 text-xs text-slate-500">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="flex-1">{item.label}</span><span>{item.range}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <div className="flex items-center justify-between gap-2">
          {isReport && section && <button type="button" onClick={() => onSelectSection('')}
            className="text-xs font-bold text-sky-700 py-2">Todo el sector</button>}
          {onViewMap && <button type="button" onClick={onViewMap}
            className="text-xs font-bold text-sky-700 py-2">Ver avance en el mapa</button>}
          {!error && loaded && <button type="button" onClick={onRetry}
            className="text-xs font-semibold text-slate-500 py-2">Actualizar</button>}
        </div>
      </div>
    </section>
  );
}
