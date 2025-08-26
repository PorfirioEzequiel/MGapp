import React, { useState, useEffect } from 'react';
import supabase from '../supabase/client';
import ToggleStatusButton from './ToggleStatusButton';
import {  useNavigate } from 'react-router-dom';

const Filtro = () => {
  const [poligono, setPoligono] = useState('');
  const [seccion, setSeccion] = useState('');
  const [puesto, setPuesto] = useState('');
  const [status, setStatus] = useState('');
  const [nombre, setNombre] = useState('');
  const [resultados, setResultados] = useState([]);
  const [opciones, setOpciones] = useState({ poligonos: [], secciones: [], puestos: [], status: [] });
  const navigate = useNavigate();

  // Cargar datos iniciales para los selectores
  useEffect(() => {
    const cargarOpciones = async () => {
      try {
        const { data, error } = await supabase
          .from('ciudadania') // Reemplaza con el nombre de tu tabla
          .select('poligono, seccion, puesto, status');

        if (error) throw error;

        // Extraer valores únicos para los selectores
        const poligonos = [...new Set(data.map((item) => item.poligono))];
        const secciones = [...new Set(data.map((item) => item.seccion))];
        const puestos = [...new Set(data.map((item) => item.puesto))];
        const status = [...new Set(data.map((item) => item.status))];
        // const puestos1 = [...new Set(data.map((item) => item.puesto))];
        // console.log(puestos1);
        setOpciones({ poligonos, secciones, puestos, status });
      } catch (err) {
        console.error('Error al cargar opciones:', err.message);
      }
    };

    cargarOpciones();
  }, []);
  
  // Manejar búsqueda en Supabase
  const manejarFiltro = async () => {
    try {
      // Construir filtros dinámicos
      let query = supabase.from('ciudadania').select('*').order('poligono', { ascending: true });

      if (poligono) query = query.eq('poligono', poligono);
      if (seccion) query = query.eq('seccion', seccion);
      if (puesto) query = query.eq('puesto', puesto);
      if (status) query = query.eq('status', status);
      if (nombre) query = query.ilike('nombre', `%${nombre}%`);

      const { data, error } = await query;

      if (error) throw error;

      setResultados(data);
    } catch (err) {
      console.error('Error al filtrar:', err.message);
    }
  };

  return (
    <div>
      
      <div class="flex flex-wrap">
        {/* Selector para Polígono */}
        <label  >
          Polígono:
          <select 
          value={poligono} 
          onChange={(e) => setPoligono(e.target.value)}
          className="border p-2 w-full">
            <option value="">Todos</option>
            {opciones.poligonos.map((poli) => (
              <option key={poli} value={poli}>
                {poli}
              </option>
            ))}
          </select>
        </label>
        {/* Selector para Sección */}
        <label>
          Sección:
          <select 
          value={seccion} 
          onChange={(e) => setSeccion(e.target.value)}
          className="border p-2 w-full">
            <option value="">Todas</option>
            {opciones.secciones.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
              </option>
            ))}
          </select>
        </label>
        {/* Selector para Puesto */}
        <label>
          Puesto:
          <select 
          value={puesto} 
          onChange={(e) => setPuesto(e.target.value)}
          className="border p-2 w-full">
            <option value="">Todos</option>
            {opciones.puestos.map((pues) => (
              <option key={pues} value={pues}>
                {pues}
              </option>
            ))}
          </select>
        </label>
        {/* Selector para Estatus */}
        <label>
          Estatus:
          <select 
          value={status} 
          onChange={(e) => setStatus(e.target.value)}
          className="border p-2 w-full">
            <option value="">Todos</option>
            {opciones.status.map((statu) => (
              <option key={statu} value={statu}>
                {statu}
              </option>
            ))}
          </select>
        </label>


        {/* Input para Nombre */}
        <label>
          Nombre:
          <input
            type="text"
            placeholder="Buscar por nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            className="border p-2 w-full"
          />
        </label>
        <button className="bg-blue-500 text-white mx-auto my-auto px-4 py-2 rounded"
         onClick={manejarFiltro}>Buscar</button>

        <button onClick={() => navigate("/agregar")} className="bg-green-500 text-white mx-auto my-auto px-4 py-2 rounded">
        Agregar Ciudadano
        </button>
      </div>


      <div className="p-4">
        <h2>Resultados:</h2>


        <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">Polígono</th>
            <th className="border p-2">Sección</th>
            <th className="border p-2">UBT</th>
            <th className="border p-2">Nombre</th>
            <th className="border p-2">Puesto</th>
            <th className="border p-2">Eliminar</th>
            <th className="border p-2">Editar</th>
          </tr>
        </thead>
        {resultados.length > 0 ? (
            // <h1>{resultados.length}</h1>
          <tbody>
            {/* <h1>{resultados.length}</h1> */}
            {resultados.map((resultado) => (
              <tr key={resultado.id}>
                {/* {resultado.poligono} - {resultado.seccion} -{resultado.ubt} - {resultado.puesto} - {resultado.nombre}  {resultado.a_paterno}  {resultado.a_materno} */}
                <td className="border p-2">{resultado.poligono}</td>
                <td className="border p-2">{resultado.seccion}</td>
                <td className="border p-2">{resultado.ubt}</td>
                <td className="border p-2">{resultado.nombre} {resultado.a_paterno} {resultado.a_materno}</td>
                {/* <td className="border p-2">{resultado.telefono_1}</td>
                <td className="border p-2">{resultado.usuario}</td>
                <td className="border p-2">{resultado.password}</td> */}
                <td className="border p-2">{resultado.puesto}</td>
                <td className="border p-2">
                <ToggleStatusButton registroId={resultado.id} initialStatus={resultado.status} />
                </td>
                <td className="border p-2">
                <button onClick={() => navigate(`/ciudadano/${resultado.id}`)}
                  className="bg-blue-500 text-white px-4 py-2 rounded">
                    EDITAR
                </button>
                </td>
                {/* {resultado.status} */}
              </tr>
            ))}
          </tbody>
          
        ) : (
          <p>No se encontraron resultados.</p>
        )}
        </table>
      </div>
    </div>
  );
};

export default Filtro;
