import React, { useEffect, useState } from "react";
import supabase from "../supabase/client";
import * as XLSX from "xlsx";

const ExcelDownloader = () => {
  const [data, setData] = useState([]);
  const [poligono, setPoligono] = useState("");
  const [seccion, setSeccion] = useState("");
  const [puesto, setPuesto] = useState("");
  const [estatus, setEstatus] = useState("");
  const [loading, setLoading] = useState(false);

  // 👉 Carga inicial para mostrar datos
  

  const fetchData = async () => {
    setLoading(true);
    let query = supabase.from("ciudadania").select("*"); //Ajusta el nombre de tu tabla

    if (poligono) query.eq("poligono", poligono);
    if (seccion) query.eq("seccion", seccion);
    if (puesto) query.eq("puesto", puesto);
    if (estatus) query.eq("status", estatus);

    const { data, error } = await query;
    if (error) console.error("Error cargando datos:", error);
    else setData(data || []);
    setLoading(false);
  };
   useEffect(() => {
    fetchData();
  }, []);
  
  const exportToExcel = () => {
    if (!data.length) {
      alert("No hay datos para exportar");
      return;
    }

    // 🔑 Convertir datos en hoja Excel
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte");

    // 📁 Descargar archivo
    XLSX.writeFile(workbook, `Reporte_${Date.now()}.xlsx`);
  };

  return (
    <div className="p-4 bg-white shadow rounded">
      <h2 className="text-xl font-bold mb-3">Descargar Reporte Excel</h2>

      {/* FILTROS */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <input
          className="border p-2"
          placeholder="Filtrar por Polígono"
          value={poligono}
          onChange={(e) => setPoligono(e.target.value)}
        />
        <input
          className="border p-2"
          placeholder="Filtrar por Sección"
          value={seccion}
          onChange={(e) => setSeccion(e.target.value)}
        />
        <select
          className="border p-2"
          value={puesto}
          onChange={(e) => setPuesto(e.target.value)}
        >
          <option value="">Puesto</option>
          <option value="PROMOTORA-BIENESTA">PROMOTORA DEL BIENESTAR</option>
          <option value="SECCIONAL">SECCIONAL</option>
          <option value="MOVILIZADOR">MOVILIZADOR</option>
        </select>
        <select
          className="border p-2"
          value={estatus}
          onChange={(e) => setEstatus(e.target.value)}
        >
          <option value="">Estatus</option>
          <option value="ACTIVO">ACTIVO</option>
          <option value="SOLICITUD DE ALTA">SOLICITUD DE ALTA</option>
          <option value="SOLICITUD DE BAJA">SOLICITUD DE BAJA</option>
          <option value="ELIMINADO">ELIMINADO</option>
        </select>
      </div>

      {/* BOTONES */}
      <div className="flex gap-3">
        <button
          onClick={fetchData}
          className="bg-blue-600 text-white px-4 py-2 rounded"
          disabled={loading}
        >
          {loading ? "Cargando..." : "Aplicar Filtros"}
        </button>

        <button
          onClick={exportToExcel}
          className="bg-green-600 text-white px-4 py-2 rounded"
        >
          Descargar Excel
        </button>
      </div>
    </div>
  );
};

export default ExcelDownloader;
