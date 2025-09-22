import React, { useEffect, useState } from "react";
import supabase from "../supabase/client";

const ReportePoligonos = () => {
  const [reporte, setReporte] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    generarReporte();
  }, []);

const generarReporte = async () => {
  setLoading(true);
  try {
    const { data: catalogo, error: err1 } = await supabase
      .from("ubt_catalogo")
      .select("poligono, seccion, ubt");
    if (err1) throw err1;

    const { data: ciudadanos, error: err2 } = await supabase
      .from("ciudadania")
      .select("poligono, seccion, ubt, puesto, status, nombre, a_paterno, a_materno");
    if (err2) throw err2;

    const mapa = {}; // key: `${pol}-${sec}`

    // contar UBTs por sección
    (catalogo || []).forEach(row => {
      const pol = row.poligono;
      const sec = row.seccion;
      const key = `${pol}-${sec}`;
      if (!mapa[key]) {
        mapa[key] = {
          poligono: pol,
          seccion: sec,
          ubtCount: 0,
          seccional: "—",
          promotores: 0,
          movilizadores: 0,
          _seccionalSet: false, // flag interno
        };
      }
      mapa[key].ubtCount += 1;
    });

    // contar ciudadanos activos por puesto y asignar seccional (primer activo)
    (ciudadanos || []).forEach(c => {
      const key = `${c.poligono}-${c.seccion}`;
      const entry = mapa[key];
      if (!entry) return;

      if (c.status === "ACTIVO") {
        if (c.puesto === "SECCIONAL" && !entry._seccionalSet) {
          entry.seccional = `${c.nombre || ""} ${c.a_paterno || ""} ${c.a_materno || ""}`.trim() || "—";
          entry._seccionalSet = true;
        }
        if (c.puesto === "PROMOTORA-BIENESTAR") entry.promotores += 1;
        if (c.puesto === "MOVILIZADOR") entry.movilizadores += 1;
      }
    });

    // pasar a array y ordenar por polígono (numérico si es posible) y después por sección
    const resultado = Object.values(mapa).sort((a, b) => {
      const pa = Number(a.poligono);
      const pb = Number(b.poligono);

      // si ambos son números válidos, hacer resta (rápido y correcto)
      if (!isNaN(pa) && !isNaN(pb)) {
        if (pa !== pb) return pa - pb;
        const sa = Number(a.seccion);
        const sb = Number(b.seccion);
        if (!isNaN(sa) && !isNaN(sb)) return sa - sb;
        return String(a.seccion).localeCompare(String(b.seccion));
      }

      // fallback a comparación de strings
      const cmpPol = String(a.poligono).localeCompare(String(b.poligono));
      if (cmpPol !== 0) return cmpPol;
      return String(a.seccion).localeCompare(String(b.seccion));
    });

    // limpiar flags internas antes de setear
    const clean = resultado.map(r => {
      const { _seccionalSet, ...rest } = r;
      return rest;
    });

    setReporte(clean);
  } catch (err) {
    console.error("Error generando reporte:", err);
    setError(err.message || String(err));
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="p-4">
      <h1 className="font-bold text-xl mb-4">Reporte por Polígono / Sección</h1>
      {loading ? (
        <p>Cargando reporte...</p>
      ) : (
        <table className="table-auto border-collapse border border-gray-300 w-full">
          <thead className="bg-gray-200">
            <tr>
              <th className="border p-2">Polígono</th>
              <th className="border p-2">Sección</th>
              <th className="border p-2">Seccional Responsable</th>
              <th className="border p-2"># UBT</th>
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
                <td className="border p-2 text-center">{row.promotores}</td>
                <td className="border p-2 text-center">{row.movilizadores}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
};

export default ReportePoligonos;
