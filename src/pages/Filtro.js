import React, { useState, useEffect } from 'react';
import supabase from '../supabase/client';
import ToggleStatusButton from './ToggleStatusButton';

const Filtro = () => {
  const [poligono, setPoligono] = useState('');
  const [seccion, setSeccion] = useState('');
  const [puesto, setPuesto] = useState('');
  const [nombre, setNombre] = useState('');
  const [resultados, setResultados] = useState([]);
  const [opciones, setOpciones] = useState({ poligonos: [], secciones: [], puestos: [] });
  

  // Cargar datos iniciales para los selectores
  useEffect(() => {
    const cargarOpciones = async () => {
      try {
        const { data, error } = await supabase
          .from('ciudadania') // Reemplaza con el nombre de tu tabla
          .select('poligono, seccion, puesto');

        if (error) throw error;

        // Extraer valores únicos para los selectores
        const poligonos = [...new Set(data.map((item) => item.poligono))];
        const secciones = [...new Set(data.map((item) => item.seccion))];
        const puestos = [...new Set(data.map((item) => item.puesto))];

        setOpciones({ poligonos, secciones, puestos });
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
      let query = supabase.from('ciudadania').select('*');

      if (poligono) query = query.eq('poligono', poligono);
      if (seccion) query = query.eq('seccion', seccion);
      if (puesto) query = query.eq('puesto', puesto);
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
      
      <div>
        {/* Selector para Polígono */}
        <label>
          Polígono:
          <select value={poligono} onChange={(e) => setPoligono(e.target.value)}>
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
          <select value={seccion} onChange={(e) => setSeccion(e.target.value)}>
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
          <select value={puesto} onChange={(e) => setPuesto(e.target.value)}>
            <option value="">Todos</option>
            {opciones.puestos.map((pues) => (
              <option key={pues} value={pues}>
                {pues}
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
          />
        </label>
        <button onClick={manejarFiltro}>Buscar</button>
      </div>

      <div>
        <h2>Resultados:</h2>
        {resultados.length > 0 ? (
            // <h1>{resultados.length}</h1>
          <ul>
            <h1>{resultados.length}</h1>
            {resultados.map((resultado) => (
              <li key={resultado.id}>
                {resultado.poligono} - {resultado.seccion} - {resultado.puesto} - {resultado.nombre}  {resultado.a_paterno}  {resultado.a_materno}
                <ToggleStatusButton registroId={resultado.id} initialStatus={resultado.status} />
                <button /*onClick={activateLasers}*/>
                    EDITAR
                </button>
                {/* {resultado.status} */}
              </li>
            ))}
          </ul>
        ) : (
          <p>No se encontraron resultados.</p>
        )}
      </div>
    </div>
  );
};

export default Filtro;
