import React, { useEffect, useMemo, useState } from "react";
import supabase from "../supabase/client";

const pct = (num, den) => (den ? Math.min((num / den) * 100, 100) : null);
const fmtPct = (num, den) => (den ? `${((num / den) * 100).toFixed(1)}%` : "—");

// Meter: barra de una sola razón contra una meta (mismo tono, pista más clara)
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
      // ubt_catalogo: el sector se llama "sector" (no "poligono") y la fracción se llama "fraccion" (no "ubt")
      const { data: catalogo, error: err1 } = await supabase
        .from("ubt_catalogo")
        .select("sector, seccion, fraccion");
      if (err1) throw err1;

      const { data: ciudadanos, error: err2 } = await supabase
        .from("ciudadania")
        .select("poligono, seccion, ubt, puesto, status, nombre, a_paterno, a_materno");
      if (err2) throw err2;

      const mapa = {}; // detalle por sección, key: `${sector}-${sec}`
      const sectores = {}; // resumen por sector, key: sector

      // meta (fracciones) por sección y por sector, según el catálogo
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

      // ciudadanos activos por puesto: seccional/SM por sección, SP/SM por sector
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

      // detalle por sección, ordenado por sector y luego sección
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

      // resumen por sector, ordenado por número de sector
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
    <div className="p-4">
      <h1 className="font-bold text-xl mb-4">Reporte por Sector / Sección</h1>

      {error && <p className="text-red-600 mb-4">Error: {error}</p>}

      {loading ? (
        <p>Cargando reporte...</p>
      ) : (
        <>
          {/* Resumen por sector, formato tabla */}
          <h2 className="font-semibold text-sm uppercase tracking-wide text-slate-500 mb-2">
            SM activas por sector (contra meta de fracciones del catálogo)
          </h2>
          <div className="overflow-x-auto mb-8">
            <table className="table-auto border-collapse border border-gray-300 w-full">
              <thead className="bg-gray-200">
                <tr>
                  <th className="border p-2">SECTOR</th>
                  <th className="border p-2">SP</th>
                  <th className="border p-2">SECCIONES</th>
                  <th className="border p-2">META FRACCIONES</th>
                  <th className="border p-2">NUMERO DE SM</th>
                  <th className="border p-2">% SM</th>
                </tr>
              </thead>
              <tbody>
                {porSector.map((s) => (
                  <tr key={s.poligono} className="hover:bg-gray-50">
                    <td className="border p-2 text-center font-semibold">{s.poligono}</td>
                    <td className="border p-2">{s.sp}</td>
                    <td className="border p-2 text-center">{s.secciones}</td>
                    <td className="border p-2 text-center">{s.metaFracciones}</td>
                    <td className="border p-2 text-center">{s.smActivas}</td>
                    <td className="border p-2 text-center font-semibold">{fmtPct(s.smActivas, s.metaFracciones)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-gray-100 font-bold">
                  <td className="border p-2" colSpan={2}>TOTAL</td>
                  <td className="border p-2 text-center">{totales.secciones}</td>
                  <td className="border p-2 text-center">{totales.metaFracciones}</td>
                  <td className="border p-2 text-center">{totales.smActivas}</td>
                  <td className="border p-2 text-center">{fmtPct(totales.smActivas, totales.metaFracciones)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Detalle por sección */}
          <h2 className="font-semibold text-sm uppercase tracking-wide text-slate-500 mb-2">
            Detalle por sección
          </h2>
          <div className="overflow-x-auto">
            <table className="table-auto border-collapse border border-gray-300 w-full">
              <thead className="bg-gray-200">
                <tr>
                  <th className="border p-2">Sector</th>
                  <th className="border p-2">Sección</th>
                  <th className="border p-2">Seccional Responsable</th>
                  <th className="border p-2"># Fracciones (meta)</th>
                  <th className="border p-2"># SM Activas</th>
                  <th className="border p-2">% Cobertura</th>
                  <th className="border p-2"># Promotores Bienestar</th>
                  <th className="border p-2"># Movilizadores</th>
                </tr>
              </thead>
              <tbody>
                {reporte.map((row, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="border p-2">{row.poligono}</td>
                    <td className="border p-2">{row.seccion}</td>
                    <td className="border p-2">{row.seccional}</td>
                    <td className="border p-2 text-center">{row.ubtCount}</td>
                    <td className="border p-2 text-center">{row.smActivas}</td>
                    <td className="border p-2 min-w-[120px]">
                      <Meter value={row.smActivas} total={row.ubtCount} size="sm" />
                    </td>
                    <td className="border p-2 text-center">{row.promotores}</td>
                    <td className="border p-2 text-center">{row.movilizadores}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default ReportePoligonos;
