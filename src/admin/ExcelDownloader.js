import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../supabase/client";
import * as XLSX from "xlsx";

const ExcelDownloader = () => {
  const navigate = useNavigate();
  const [data, setData] = useState([]);
  const [catalogo, setCatalogo] = useState([]); // [{ sector, seccion }]
  const [sector, setSector] = useState("");
  const [seccion, setSeccion] = useState("");
  const [puesto, setPuesto] = useState("");
  const [estatus, setEstatus] = useState("");
  const [loading, setLoading] = useState(false);

  // Cargar catálogo de sectores/secciones una sola vez
  useEffect(() => {
    supabase
      .from("ubt_catalogo")
      .select("sector, seccion")
      .then(({ data }) => setCatalogo(data ?? []));
  }, []);

  // Sectores únicos ordenados
  const sectores = useMemo(() => {
    const unicos = [...new Set(catalogo.map((r) => r.sector))];
    return unicos.sort((a, b) => Number(a) - Number(b) || String(a).localeCompare(String(b)));
  }, [catalogo]);

  // Secciones del sector seleccionado
  const secciones = useMemo(() => {
    if (!sector) return [];
    const unicas = [...new Set(catalogo.filter((r) => r.sector === sector).map((r) => r.seccion))];
    return unicas.sort((a, b) => Number(a) - Number(b) || String(a).localeCompare(String(b)));
  }, [catalogo, sector]);

  // Al cambiar sector, resetear sección
  const handleSectorChange = (val) => {
    setSector(val);
    setSeccion("");
  };

  const fetchData = async () => {
    setLoading(true);
    let query = supabase.from("ciudadania").select("*");

    if (sector)  query = query.eq("poligono", sector);
    if (seccion) query = query.eq("seccion", seccion);
    if (puesto)  query = query.eq("puesto", puesto);
    if (estatus) query = query.eq("status", estatus);

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
    const worksheet = XLSX.utils.json_to_sheet(data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Reporte");
    XLSX.writeFile(workbook, `Reporte_${Date.now()}.xlsx`);
  };

  const selectClass =
    "w-full px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-800 bg-white focus:outline-none focus:border-blue-400";

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
            <h1 className="text-xl font-black tracking-tight">Estructura</h1>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-6 space-y-4">
        {/* Filtros */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-4">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3">Filtros</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Sector
              </label>
              <select
                className={selectClass}
                value={sector}
                onChange={(e) => handleSectorChange(e.target.value)}
              >
                <option value="">Todos</option>
                {sectores.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Sección
              </label>
              <select
                className={selectClass}
                value={seccion}
                onChange={(e) => setSeccion(e.target.value)}
                disabled={!sector}
              >
                <option value="">Todas</option>
                {secciones.map((s) => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Puesto
              </label>
              <select
                className={selectClass}
                value={puesto}
                onChange={(e) => setPuesto(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="PROMOTORA-BIENESTAR">PROMOTORA DEL BIENESTAR</option>
                <option value="SECCIONAL">SECCIONAL</option>
                <option value="MOVILIZADOR">MOVILIZADOR</option>
              </select>
            </div>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">
                Estatus
              </label>
              <select
                className={selectClass}
                value={estatus}
                onChange={(e) => setEstatus(e.target.value)}
              >
                <option value="">Todos</option>
                <option value="ACTIVO">ACTIVO</option>
                <option value="SOLICITUD DE ALTA">SOLICITUD DE ALTA</option>
                <option value="SOLICITUD DE BAJA">SOLICITUD DE BAJA</option>
                <option value="ELIMINADO">ELIMINADO</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 mt-4">
            <button
              onClick={fetchData}
              disabled={loading}
              className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? "Cargando..." : "Aplicar filtros"}
            </button>
            <button
              onClick={exportToExcel}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors"
            >
              Descargar Excel
            </button>
          </div>
        </div>

        {/* Contador */}
        {!loading && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-slate-500">Registros encontrados</span>
            <span className="text-lg font-black text-slate-800">{data.length.toLocaleString("es-MX")}</span>
          </div>
        )}
      </main>
    </div>
  );
};

export default ExcelDownloader;
