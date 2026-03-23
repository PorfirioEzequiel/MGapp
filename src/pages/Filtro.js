import React, { useState, useEffect } from 'react';
import supabase from '../supabase/client';
import ToggleStatusButton from './ToggleStatusButton';
import { useNavigate } from 'react-router-dom';

const Filtro = () => {
  const [poligono, setPoligono] = useState('');
  const [seccion, setSeccion] = useState('');
  const [puesto, setPuesto] = useState('');
  const [status, setStatus] = useState('');
  const [nombre, setNombre] = useState('');
  const [resultados, setResultados] = useState([]);
  const [loading, setLoading] = useState(false);
  const [opciones, setOpciones] = useState({ poligonos: [], secciones: [], puestos: [], status: [] });
  const navigate = useNavigate();

  // Cargar datos iniciales para los selectores
  useEffect(() => {
    const cargarOpciones = async () => {
      try {
        const { data, error } = await supabase
          .from('ciudadania')
          .select('poligono, seccion, puesto, status')
          .order('seccion', { ascending: true })
          .order('poligono', { ascending: true });

        if (error) throw error;

        const poligonos = [...new Set(data.map((item) => item.poligono))];
        const secciones = [...new Set(data.map((item) => item.seccion))];
        const puestos = [...new Set(data.map((item) => item.puesto))];
        const status = [...new Set(data.map((item) => item.status))];

        setOpciones({ poligonos, secciones, puestos, status });
      } catch (err) {
        console.error('Error al cargar opciones:', err.message);
      }
    };

    cargarOpciones();
  }, []);

  // Manejar búsqueda en Supabase
  const manejarFiltro = async () => {
    setLoading(true);
    try {
      let query = supabase.from('ciudadania').select('*').order('poligono', { ascending: true });

      if (poligono) query = query.eq('poligono', poligono);
      if (seccion) query = query.eq('seccion', seccion);
      if (puesto) query = query.eq('puesto', puesto);
      if (status) query = query.eq('status', status);

      // Buscar por nombre, curp o apellidos
      if (nombre) {
        query = query.or(
          `nombre.ilike.%${nombre}%,a_paterno.ilike.%${nombre}%,a_materno.ilike.%${nombre}%,curp.ilike.%${nombre}%`
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      setResultados(data);
    } catch (err) {
      console.error('Error al filtrar:', err.message);
    } finally {
      setLoading(false);
    }
  };

  // Limpiar todos los filtros
  const limpiarFiltros = () => {
    setPoligono('');
    setSeccion('');
    setPuesto('');
    setStatus('');
    setNombre('');
    setResultados([]);
  };

  return (
    <div className="p-4">
      <div className="flex flex-wrap gap-2 mb-4">
        <label>
          Sector:
          <select
            value={poligono}
            onChange={(e) => setPoligono(e.target.value)}
            className="border p-2 w-full"
          >
            <option value="">Todos</option>
            {opciones.poligonos.map((poli) => (
              <option key={poli} value={poli}>
                {poli}
              </option>
            ))}
          </select>
        </label>

        <label>
          Sección:
          <select
            value={seccion}
            onChange={(e) => setSeccion(e.target.value)}
            className="border p-2 w-full"
          >
            <option value="">Todas</option>
            {opciones.secciones.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>
        </label>

        <label>
          Puesto:
          <select
            value={puesto}
            onChange={(e) => setPuesto(e.target.value)}
            className="border p-2 w-full"
          >
            <option value="">Todos</option>
            {opciones.puestos.map((pues) => (
              <option key={pues} value={pues}>
                {pues}
              </option>
            ))}
          </select>
        </label>

        <label>
          Estatus:
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            className="border p-2 w-full"
          >
            <option value="">Todos</option>
            {opciones.status.map((statu) => (
              <option key={statu} value={statu}>
                {statu}
              </option>
            ))}
          </select>
        </label>

        <label>
          Buscar (nombre, CURP o apellidos):
          <input
            type="text"
            placeholder="Ej. Juan o ABCD010101..."
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="border p-2 w-full"
          />
        </label>

        <div className="flex items-end gap-2">
          <button
            className="bg-blue-500 text-white px-4 py-2 rounded"
            onClick={manejarFiltro}
            disabled={loading}
          >
            {loading ? 'Buscando...' : 'Buscar'}
          </button>

          <button
            onClick={limpiarFiltros}
            className="bg-gray-400 text-white px-4 py-2 rounded"
            disabled={loading}
          >
            Limpiar
          </button>

          <button
            onClick={() => navigate("/agregar")}
            className="bg-green-500 text-white px-4 py-2 rounded"
          >
            Agregar Ciudadano SM
          </button>
        </div>
      </div>

      <h2 className="text-lg font-semibold mb-2">Resultados:</h2>

      {loading ? (
        <p className="text-center text-gray-500">Cargando resultados...</p>
      ) : (
        <table className="w-full border-collapse border border-gray-300">
          <thead>
            <tr className="bg-gray-200">
              <th className="border p-2">Sector</th>
              <th className="border p-2">Sección</th>
              <th className="border p-2">Fracción</th>
              <th className="border p-2">Nombre</th>
              <th className="border p-2">CURP</th>
              <th className="border p-2">Puesto</th>
              <th className="border p-2">Estatus</th>
              <th className="border p-2">Editar</th>
            </tr>
          </thead>
          {resultados.length > 0 ? (
            <tbody>
              {resultados.map((resultado) => (
                <tr key={resultado.id}>
                  <td className="border p-2">{resultado.poligono}</td>
                  <td className="border p-2">{resultado.seccion}</td>
                  <td className="border p-2">{resultado.ubt}</td>
                  <td className="border p-2">
                    {resultado.nombre} {resultado.a_paterno} {resultado.a_materno}
                  </td>
                  <td className="border p-2">{resultado.curp}</td>
                  <td className="border p-2">{resultado.puesto}</td>
                  <td className="border p-2">
                    <ToggleStatusButton
                      registroId={resultado.id}
                      initialStatus={resultado.status}
                    />
                  </td>
                  <td className="border p-2">
                    <button
                      onClick={() => navigate(`/ciudadano/${resultado.id}`)}
                      className="bg-blue-500 text-white px-4 py-2 rounded"
                    >
                      EDITAR
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          ) : (
            <tbody>
              <tr>
                <td colSpan="8" className="text-center p-4 text-gray-500">
                  No se encontraron resultados.
                </td>
              </tr>
            </tbody>
          )}
        </table>
      )}
    </div>
  );
};

export default Filtro;
