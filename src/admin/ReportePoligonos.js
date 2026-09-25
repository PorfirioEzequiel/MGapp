import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../supabase/client";

const pct = (num, den) => (den ? Math.min((num / den) * 100, 100) : null);
const fmtPct = (num, den) => (den ? `${((num / den) * 100).toFixed(1)}%` : "—");

const Meter = ({ value, total, size = "md" }) => {
  const p = pct(value, total);
  const h = size === "sm" ? "h-1.5" : "h-2.5";
  return (
    <div className="flex items-center gap-2">
      <div className={`flex-1 min-w-[60px] ${h} bg-blue-100 rounded-full overflow-hidden`}>
        <div
          className="h-full bg-blue-500 rounded-full transition-all duration-500"
          style={{ width: `${p ?? 0}%` }}
        />
      </div>
      <span className="text-xs font-semibold text-blue-700 tabular-nums w-10 text-right">
        {p != null ? `${p.toFixed(0)}%` : "—"}
      </span>
    </div>
  );
};

const ReportePoligonos = () => {
  const navigate = useNavigate();
  const [reporte, setReporte] = useState([]);
  const [porSector, setPorSector] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    generarReporte();
  }, []);

  const generarReporte = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data: catalogo, error: err1 } = await supabase
        .from("ubt_catalogo")
        .select("sector, seccion, fraccion");
      if (err1) throw err1;

      const { data: ciudadanos, error: err2 } = await supabase
        .from("ciudadania")
        .select("poligono, seccion, ubt, puesto, status, nombre, a_paterno, a_materno");
      if (err2) throw err2;

      const mapa = {};
      const sectores = {};

      (catalogo || []).forEach((row) => {
        const sector = row.sector;
        const sec = row.seccion;
        const key = `${sector}-${sec}`;
        if (!mapa[key]) {
          mapa[key] = {
            poligono: sector,
            seccion: sec,
            ubtCount: 0,
            seccional: "—",
            smActivas: 0,
            promotores: 0,
            movilizadores: 0,
            _seccionalSet: false,
          };
        }
        mapa[key].ubtCount += 1;

        if (!sectores[sector]) {
          sectores[sector] = { poligono: sector, sp: "—", secciones: new Set(), metaFracciones: 0, smActivas: 0, _spSet: false };
        }
        sectores[sector].secciones.add(sec);
        sectores[sector].metaFracciones += 1;
      });

      (ciudadanos || []).forEach((c) => {
        const key = `${c.poligono}-${c.seccion}`;
        const entry = mapa[key];
        const sectorEntry = sectores[c.poligono];

        if (c.status !== "ACTIVO") return;

        if (entry) {
          if (c.puesto === "SECCIONAL" && !entry._seccionalSet) {
            entry.seccional = `${c.nombre || ""} ${c.a_paterno || ""} ${c.a_materno || ""}`.trim() || "—";
            entry._seccionalSet = true;
          }
          if (c.puesto === "SM") entry.smActivas += 1;
          if (c.puesto === "PROMOTORA-BIENESTAR") entry.promotores += 1;
          if (c.puesto === "MOVILIZADOR") entry.movilizadores += 1;
        }

        if (sectorEntry) {
          if (c.puesto === "SP" && !sectorEntry._spSet) {
            sectorEntry.sp = `${c.nombre || ""} ${c.a_paterno || ""} ${c.a_materno || ""}`.trim() || "—";
            sectorEntry._spSet = true;
          }
          if (c.puesto === "SM") sectorEntry.smActivas += 1;
        }
      });

      const resultado = Object.values(mapa).sort((a, b) => {
        const pa = Number(a.poligono);
        const pb = Number(b.poligono);
        if (!isNaN(pa) && !isNaN(pb)) {
          if (pa !== pb) return pa - pb;
          const sa = Number(a.seccion);
          const sb = Number(b.seccion);
          if (!isNaN(sa) && !isNaN(sb)) return sa - sb;
          return String(a.seccion).localeCompare(String(b.seccion));
        }
        const cmpPol = String(a.poligono).localeCompare(String(b.poligono));
        if (cmpPol !== 0) return cmpPol;
        return String(a.seccion).localeCompare(String(b.seccion));
      });
      setReporte(resultado.map(({ _seccionalSet, ...rest }) => rest));

      const resultadoSectores = Object.values(sectores)
        .map(({ _spSet, secciones, ...rest }) => ({ ...rest, secciones: secciones.size }))
        .sort((a, b) => Number(a.poligono) - Number(b.poligono));
      setPorSector(resultadoSectores);
    } catch (err) {
      console.error("Error generando reporte:", err);
      setError(err.message || String(err));
    } finally {
      setLoading(false);
    }
  };

  const totales = useMemo(() => {
    return porSector.reduce(
      (acc, s) => ({
        secciones: acc.secciones + s.secciones,
        metaFracciones: acc.metaFracciones + s.metaFracciones,
        smActivas: acc.smActivas + s.smActivas,
      }),
      { secciones: 0, metaFracciones: 0, smActivas: 0 }
    );
  }, [porSector]);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-blue-800 text-white px-4 py-5 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="text-blue-200 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
            </svg>
          </button>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-blue-300">Admin</p>
            <h1 className="text-xl font-black tracking-tight">Estadística</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-2xl px-4 py-3 text-sm text-red-700">
            Error: {error}
          </div>
        )}

        {loading ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 text-center text-slate-400 text-sm">
            Cargando reporte...
          </div>
        ) : (
          <>
            {/* Resumen por sector */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  SM activas por sector — contra meta de fracciones del catálogo
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Sector</th>
                      <th className="px-4 py-3 text-left font-semibold">SP</th>
                      <th className="px-4 py-3 text-center font-semibold">Secciones</th>
                      <th className="px-4 py-3 text-center font-semibold">Meta fracciones</th>
                      <th className="px-4 py-3 text-center font-semibold">Núm. SM</th>
                      <th className="px-4 py-3 text-center font-semibold">% SM</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {porSector.map((s) => (
                      <tr key={s.poligono} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-bold text-slate-800">{s.poligono}</td>
                        <td className="px-4 py-3 text-slate-700">{s.sp}</td>
                        <td className="px-4 py-3 text-center text-slate-700">{s.secciones}</td>
                        <td className="px-4 py-3 text-center text-slate-700">{s.metaFracciones}</td>
                        <td className="px-4 py-3 text-center text-slate-700">{s.smActivas}</td>
                        <td className="px-4 py-3 text-center font-semibold text-blue-700">{fmtPct(s.smActivas, s.metaFracciones)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-50 font-bold text-slate-800">
                      <td className="px-4 py-3" colSpan={2}>TOTAL</td>
                      <td className="px-4 py-3 text-center">{totales.secciones}</td>
                      <td className="px-4 py-3 text-center">{totales.metaFracciones}</td>
                      <td className="px-4 py-3 text-center">{totales.smActivas}</td>
                      <td className="px-4 py-3 text-center text-blue-700">{fmtPct(totales.smActivas, totales.metaFracciones)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Detalle por sección */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100">
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">
                  Detalle por sección
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase tracking-wider">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Sector</th>
                      <th className="px-4 py-3 text-left font-semibold">Sección</th>
                      <th className="px-4 py-3 text-left font-semibold">Seccional responsable</th>
                      <th className="px-4 py-3 text-center font-semibold">Fracciones (meta)</th>
                      <th className="px-4 py-3 text-center font-semibold">SM activas</th>
                      <th className="px-4 py-3 text-center font-semibold">% Cobertura</th>
                      <th className="px-4 py-3 text-center font-semibold">Promotores</th>
                      <th className="px-4 py-3 text-center font-semibold">Movilizadores</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {reporte.map((row, i) => (
                      <tr key={i} className="hover:bg-slate-50 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-800">{row.poligono}</td>
                        <td className="px-4 py-3 text-slate-700">{row.seccion}</td>
                        <td className="px-4 py-3 text-slate-700">{row.seccional}</td>
                        <td className="px-4 py-3 text-center text-slate-700">{row.ubtCount}</td>
                        <td className="px-4 py-3 text-center text-slate-700">{row.smActivas}</td>
                        <td className="px-4 py-3 min-w-[140px]">
                          <Meter value={row.smActivas} total={row.ubtCount} size="sm" />
                        </td>
                        <td className="px-4 py-3 text-center text-slate-700">{row.promotores}</td>
                        <td className="px-4 py-3 text-center text-slate-700">{row.movilizadores}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
};

export default ReportePoligonos;
