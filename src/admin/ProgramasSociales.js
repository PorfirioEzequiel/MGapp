import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../supabase/client";

const emptyForm = { nombre: "", descripcion: "", frecuencia: "SEMANAL" };

const ProgramasSociales = () => {
  const navigate = useNavigate();
  const [programas, setProgramas] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [guardando, setGuardando] = useState(false);

  const cargar = async () => {
    setLoading(true);
    const { data, error } = await supabase.from("programas_sociales").select("*").order("nombre");
    if (error) console.error("Error cargando programas:", error.message);
    setProgramas(data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    cargar();
  }, []);

  const crearPrograma = async (e) => {
    e.preventDefault();
    if (!form.nombre.trim()) {
      alert("El nombre del programa es obligatorio.");
      return;
    }
    setGuardando(true);
    try {
      const { error } = await supabase.from("programas_sociales").insert([{
        nombre: form.nombre.trim().toUpperCase(),
        descripcion: form.descripcion.trim() || null,
        frecuencia: form.frecuencia,
      }]);
      if (error) throw error;
      setForm(emptyForm);
      cargar();
    } catch (err) {
      alert("Error creando el programa: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const toggleActivo = async (programa) => {
    const { error } = await supabase
      .from("programas_sociales")
      .update({ activo: !programa.activo })
      .eq("id", programa.id);
    if (error) {
      alert("Error actualizando el programa: " + error.message);
      return;
    }
    cargar();
  };

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Apoyos / Programas Sociales</h1>
        <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline">← Volver</button>
      </div>

      <form onSubmit={crearPrograma} className="border rounded-lg p-3 bg-white shadow-sm mb-6 space-y-2">
        <h2 className="font-semibold text-sm text-slate-600 mb-1">Agregar programa</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
          <input
            placeholder="Nombre (ej. TINACOS)"
            value={form.nombre}
            onChange={(e) => setForm({ ...form, nombre: e.target.value })}
            className="border p-2 rounded md:col-span-1"
          />
          <input
            placeholder="Descripción"
            value={form.descripcion}
            onChange={(e) => setForm({ ...form, descripcion: e.target.value })}
            className="border p-2 rounded md:col-span-1"
          />
          <select
            value={form.frecuencia}
            onChange={(e) => setForm({ ...form, frecuencia: e.target.value })}
            className="border p-2 rounded md:col-span-1"
          >
            <option value="SEMANAL">Semanal (ej. Mercadito Solidario)</option>
            <option value="UNICA">Entrega única (ej. Tinacos)</option>
            <option value="MENSUAL">Mensual</option>
          </select>
        </div>
        <button type="submit" disabled={guardando} className="bg-emerald-600 text-white px-4 py-2 rounded disabled:opacity-50">
          {guardando ? "Guardando..." : "Agregar programa"}
        </button>
      </form>

      <div className="border rounded-lg p-3 bg-white shadow-sm">
        <h2 className="font-semibold text-sm text-slate-600 mb-2">Programas existentes</h2>
        {loading ? (
          <p className="text-sm text-slate-400">Cargando...</p>
        ) : programas.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Aún no hay programas registrados.</p>
        ) : (
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                <th className="p-2">Nombre</th>
                <th className="p-2">Descripción</th>
                <th className="p-2">Frecuencia</th>
                <th className="p-2">Estatus</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {programas.map((p) => (
                <tr key={p.id}>
                  <td className="p-2 font-medium">{p.nombre}</td>
                  <td className="p-2 text-slate-500">{p.descripcion || "—"}</td>
                  <td className="p-2">{p.frecuencia}</td>
                  <td className="p-2">
                    <button
                      onClick={() => toggleActivo(p)}
                      className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                        p.activo
                          ? "bg-emerald-100 text-emerald-700 border-emerald-200"
                          : "bg-slate-100 text-slate-500 border-slate-200"
                      }`}
                    >
                      {p.activo ? "ACTIVO" : "INACTIVO"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
};

export default ProgramasSociales;
