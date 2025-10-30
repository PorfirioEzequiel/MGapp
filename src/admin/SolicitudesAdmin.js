import React, { useEffect, useState } from "react";
import supabase from "../supabase/client";

const SolicitudesAdmin = () => {
  const [tipo, setTipo] = useState("ALTA"); // ALTA o BAJA
  const [solicitudes, setSolicitudes] = useState([]);
  const [selected, setSelected] = useState(null); // solicitud para el modal
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchSolicitudes();
  }, [tipo]);

  const fetchSolicitudes = async () => {
    setLoading(true);
    setError(null);
    try {
      const { data, error } = await supabase
        .from("ciudadania")
        .select("*")
        .eq("status", tipo === "ALTA" ? "SOLICITUD DE ALTA" : "SOLICITAR BAJA")
        .order("ingreso_estructura", { ascending: false });
      if (error) throw error;
      setSolicitudes(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDecision = async (id, decision) => {
    // decision: "ACTIVO" | "RECHAZADA" | "ELIMINADO"
    const nuevoStatus =
      decision === "APROBAR"
        ? (tipo === "ALTA" ? "ACTIVO" : "ELIMINADO")
        : "RECHAZADA";

    const { error } = await supabase
      .from("ciudadania")
      .update({ status: nuevoStatus })
      .eq("id", id);

    if (!error) {
      setSolicitudes((prev) => prev.filter((s) => s.id !== id));
      setSelected(null);
    } else {
      alert("Error: " + error.message);
    }
  };

  return (
    <div className="p-4">
      <h1 className="text-xl font-bold mb-4">Gestión de Solicitudes</h1>

      {/* Botones de filtro */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setTipo("ALTA")}
          className={`px-4 py-2 rounded ${tipo === "ALTA" ? "bg-green-600 text-white" : "bg-gray-300"}`}
        >
          Solicitudes de Alta
        </button>
        <button
          onClick={() => setTipo("BAJA")}
          className={`px-4 py-2 rounded ${tipo === "BAJA" ? "bg-red-600 text-white" : "bg-gray-300"}`}
        >
          Solicitudes de Baja
        </button>
      </div>

      {loading && <p>Cargando...</p>}
      {error && <p className="text-red-500">Error: {error}</p>}

      {/* Tabla de solicitudes */}
      <table className="w-full border-collapse border border-gray-300 text-sm">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">Nombre</th>
            <th className="border p-2">Puesto</th>
            <th className="border p-2">Polígono</th>
            <th className="border p-2">Sección</th>
            <th className="border p-2">UBT</th>
            <th className="border p-2">Acción</th>
          </tr>
        </thead>
        <tbody>
          {solicitudes.map((s) => (
            <tr key={s.id}>
              <td className="border p-2">{`${s.nombre} ${s.a_paterno} ${s.a_materno}`}</td>
              <td className="border p-2">{s.puesto}</td>
              <td className="border p-2">{s.poligono}</td>
              <td className="border p-2">{s.seccion}</td>
              <td className="border p-2">{s.ubt}</td>
              <td className="border p-2 text-center">
                <button
                  className="px-2 py-1 bg-blue-500 text-white rounded"
                  onClick={() => setSelected(s)}
                >
                  Ver
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Modal de detalles */}
      {selected && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded w-[90%] max-w-lg">
            <h2 className="text-lg font-bold mb-2">Datos de la Solicitud</h2>
            <img
              src={selected.url_foto_perfil || "/placeholder.jpg"}
              alt="Foto"
              className="w-32 h-32 object-cover border mb-2"
            />
            <img
              src={selected.url_foto_ine1 || "/placeholder.jpg"}
              alt="Foto"
              className="w-32 h-32 object-cover border mb-2"
            />
            <img
              src={selected.url_foto_ine2 || "/placeholder.jpg"}
              alt="Foto"
              className="w-32 h-32 object-cover border mb-2"
            />
            <p><b>Nombre:</b> {selected.nombre} {selected.a_paterno} {selected.a_materno}</p>
            <p><b>Mótivo de baja:</b> {selected.motivo_baja} </p>
            <p><b>CURP:</b> {selected.curp}</p>
            <p><b>Dirección:</b> {selected.calle} {selected.n_ext_mz} {selected.n_int_lt} {selected.n_casa} {selected.c_p} {selected.col_loc}</p>
            <p><b>Teléfono:</b> {selected.telefono_1}</p>
            <p><b>Observaciones:</b> {selected.observaciones}</p>
            <p><b>Puesto:</b> {selected.puesto}</p>
            <p><b>Polígono:</b> {selected.poligono}</p>
            <p><b>Sección:</b> {selected.seccion}</p>
            <p><b>UBT:</b> {selected.ubt}</p>

            <div className="flex justify-between mt-4">
              <button
                onClick={() => handleDecision(selected.id, "APROBAR")}
                className="px-4 py-2 bg-green-600 text-white rounded"
              >
                Aprobar
              </button>
              <button
                onClick={() => handleDecision(selected.id, "RECHAZAR")}
                className="px-4 py-2 bg-red-600 text-white rounded"
              >
                Rechazar
              </button>
              <button
                onClick={() => setSelected(null)}
                className="px-4 py-2 bg-gray-400 text-white rounded"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SolicitudesAdmin;
