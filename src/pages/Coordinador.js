import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import supabase from '../supabase/client';
import MapComponent from '../map/MapComponent';
import MapTerritorial from '../map/MapTerritorial';
import ToggleStatusButton from './ToggleStatusButton';
import ToggleStatusButtonCP from './ToggleStatusButtonCP';

const fullName = (p) => (p ? `${p.nombre} ${p.a_paterno} ${p.a_materno}`.trim() : null);
const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const mesLabel = (mes) => {
  const [y, m] = mes.split('-');
  return `${MESES[Number(m) - 1]} ${y.slice(2)}`;
};

// Barras de crecimiento acumulado de SM por mes, contra la meta (fracciones del catálogo)
const CrecimientoChart = ({ data, meta }) => {
  if (!data.length) {
    return <p className="text-sm text-slate-400 italic">Aún no hay fechas de ingreso registradas para graficar.</p>;
  }
  const maxVal = Math.max(meta || 0, ...data.map((d) => d.total));
  return (
    <div className="overflow-x-auto">
      <div className="relative flex items-end gap-2 h-40 min-w-max px-1">
        {meta > 0 && (
          <div
            className="absolute left-0 right-0 border-t border-slate-400 flex justify-end pointer-events-none"
            style={{ bottom: `${Math.min((meta / maxVal) * 100, 100)}%` }}
          >
            <span className="text-[10px] text-slate-500 bg-white px-1 -mt-2">Meta: {meta}</span>
          </div>
        )}
        {data.map((d, i) => {
          const h = maxVal ? (d.total / maxVal) * 100 : 0;
          const isLast = i === data.length - 1;
          return (
            <div
              key={d.mes}
              className="flex flex-col items-center justify-end h-full w-7"
              title={`${mesLabel(d.mes)}: ${d.total} SM`}
            >
              {isLast && <span className="text-[10px] font-bold text-blue-700 mb-0.5">{d.total}</span>}
              <div className="w-6 bg-blue-500 rounded-t transition-all duration-500" style={{ height: `${h}%` }} />
              <span className="text-[9px] text-slate-400 mt-1 whitespace-nowrap">{mesLabel(d.mes)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const Coordinador = () => {
  const { state } = useLocation();
  const { user } = state || {};
  const { usuario } = useParams();
  const navigate = useNavigate();
  const [section, setSeccion] = useState({});
  const [error, setError] = useState(null);
  const [error1, setError1] = useState(null);
  const [error2, setError2] = useState(null);
  const [promotores, setPromotores] = useState([]);
  const [seccionales, setSeccionales] = useState([]);
  const [seccionesSector, setSeccionesSector] = useState([]);
  const [fraccionesGeo, setFraccionesGeo] = useState([]);
  const [ciudadanosGeo, setCiudadanosGeo] = useState([]);
  const [metaFracciones, setMetaFracciones] = useState(0);


  const [poligono, setPoligono] = useState('');
  const [seccion, setSection] = useState('');
  const [nombre, setNombre] = useState('');
  const [resultados, setResultados] = useState([]);
  const [opciones, setOpciones] = useState({ secciones: []});
  // const navigate = useNavigate();

  // Cargar datos iniciales para los selectores
  useEffect(() => {
    const cargarOpciones = async () => {
      try {
        const { data, error } = await supabase
          .from('ciudadania') // Reemplaza con el nombre de tu tabla
          .select('seccion').eq('poligono',user.poligono);

        if (error) throw error;

        // Extraer valores únicos para los selectores
        
        const secciones = [...new Set(data.map((item) => item.seccion))];
        
        const puestos1 = [...new Set(data.map((item) => item.puesto))];
        // console.log(puestos1);
        setOpciones({ secciones});
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
      let query = supabase.from('ciudadania').select('*').eq('poligono',user.poligono).eq('puesto',"SM").in('status', ['ACTIVO', 'SOLICITUD DE ALTA']).order('ubt', { ascending: true });

      if (seccion) query = query.eq('seccion', seccion);
      if (nombre) query = query.ilike('nombre', `%${nombre}%`);

      const { data, error } = await query;

      if (error) throw error;

      setResultados(data);
    } catch (err) {
      console.error('Error al filtrar:', err.message);
    }
  };

  const fetchSecciones = async () => {
    try {
      const { data, error } = await supabase
        .from('secciones') // Nombre de la tabla
        .select('*').eq("pologono",user.poligono).single();
        // .eq('seccion', user.seccion); // Consulta todos los campos

      if (error) throw error;

      setSeccion(data); // Actualiza el estado con los datos obtenidos
    } catch (error) {
      console.error("Error",error.message);
      setError(error.message);
    }
  };
  const fetchPromotoras = async () => {
    try {
      const { data, error } = await supabase
        .from('ciudadania') // Nombre de la tabla
        .select('*').eq('poligono',user.poligono).eq('puesto',"SM").eq('status',"ACTIVO");
        // .eq('seccion', user.seccion); // Consulta todos los campos

      if (error1) throw error;

      setPromotores(data); // Actualiza el estado con los datos obtenidos
    } catch (error1) {
      console.error("Error supabase",error1.message);
      setError1(error1.message);
    }
  };

  const fetchSeccionales = async () => {
    try {
      const { data, error } = await supabase
        .from('ciudadania') // Nombre de la tabla
        .select('*').eq('poligono',user.poligono).eq('puesto',"SECCIONAL").eq('status',"ACTIVO");
        // .eq('seccion', user.seccion); // Consulta todos los campos

      if (error2) throw error;

      setSeccionales(data); // Actualiza el estado con los datos obtenidos
    } catch (error2) {
      console.error("Error supabase",error2.message);
      setError2(error2.message);
    }
  };

  // Polígonos de las secciones del sector y sus fracciones, para el mapa dividido por fracciones
  const fetchMapaSector = async () => {
    try {
      const { data: secData, error: secError } = await supabase
        .from('secciones')
        .select('*')
        .eq('pologono', user.poligono);
      if (secError) throw secError;
      setSeccionesSector(secData ?? []);

      const seccionNums = [...new Set((secData ?? []).map((s) => s.seccion))];
      const { data: fracData, error: fracError } = await supabase
        .from('fracciones')
        .select('fraccion, seccion, geometry')
        .in('seccion', seccionNums.length ? seccionNums : [-1]);
      if (fracError) throw fracError;
      setFraccionesGeo(fracData ?? []);

      const { data: geoData, error: geoError } = await supabase
        .from('ciudadania')
        .select('id, nombre, a_paterno, a_materno, latitud, longitud, puesto, ubt, seccion')
        .eq('poligono', user.poligono)
        .eq('status', 'ACTIVO')
        .not('latitud', 'is', null);
      if (geoError) throw geoError;
      setCiudadanosGeo(geoData ?? []);
    } catch (err) {
      console.error('Error cargando mapa del sector:', err.message);
    }
  };

  // Meta: total de fracciones del catálogo (ubt_catalogo) para este sector
  const fetchMeta = async () => {
    try {
      const { count, error } = await supabase
        .from('ubt_catalogo')
        .select('*', { count: 'exact', head: true })
        .eq('poligono', user.poligono);
      if (error) throw error;
      setMetaFracciones(count ?? 0);
    } catch (err) {
      console.error('Error cargando meta de fracciones:', err.message);
    }
  };

  const fraccionesConSM = useMemo(
    () => fraccionesGeo.map((f) => ({ ...f, sm: promotores.find((p) => p.ubt === f.fraccion) ?? null })),
    [fraccionesGeo, promotores]
  );

  // Crecimiento acumulado de SM activas por mes, según su fecha de ingreso
  const crecimientoSM = useMemo(() => {
    const porMes = {};
    promotores.forEach((p) => {
      if (!p.ingreso_estructura) return;
      const d = new Date(p.ingreso_estructura);
      if (isNaN(d)) return;
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      porMes[key] = (porMes[key] ?? 0) + 1;
    });
    let acumulado = 0;
    return Object.keys(porMes).sort().map((mes) => {
      acumulado += porMes[mes];
      return { mes, total: acumulado };
    });
  }, [promotores]);

    useEffect(() => {
    fetchSecciones(); // Llama a la función al montar el componente
    fetchPromotoras();
    fetchSeccionales();
    fetchMapaSector();
    fetchMeta();
  }, []);




  if (error1) {
    return <p>Error d: {error}</p>;
  }

  if (!user) {
    return <p>Error: Usuario no encontrado</p>;
  }
  
  return (
    <div className='mx-auto'>
      {/* <h1>Perfil de {usuario}</h1> */}
      <h1 className="border p-2">Bienvenid@: {user.nombre} {user.a_paterno} {user.a_materno}</h1>
      <p className="border p-2"><strong>Sector:</strong> {user.poligono}</p>
      {/* <p className="border p-2"><strong>Sección:</strong> {user.seccion}</p> */}
      <p className="border p-2"><strong>Puesto:</strong> {user.puesto}</p>
      {/* <p className="border p-2"><strong>Lista nominal:</strong> {section.lista_nominal}</p> */}

      {/* <p className="border p-2"><strong>Seccionales:</strong> {seccionales.length}</p> */}
      <p className="border p-2"><strong>FRACCIONES:</strong> {promotores.length}</p>
      <p className="border p-2"><strong>SM´s:</strong> {promotores.length}</p>

      {/* Crecimiento de SM vs. meta del sector */}
      <div className="border rounded-lg p-3 mt-4 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm uppercase tracking-wide text-slate-500">Crecimiento de SM</h2>
          <span className="text-xs text-slate-500">
            {promotores.length} SM activas / {metaFracciones || '—'} fracciones (meta)
          </span>
        </div>
        {metaFracciones > 0 && (
          <div className="flex items-center gap-2 mb-3">
            <div className="flex-1 h-2.5 bg-blue-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full transition-all duration-500"
                style={{ width: `${Math.min((promotores.length / metaFracciones) * 100, 100)}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-blue-700 tabular-nums w-10 text-right">
              {Math.min((promotores.length / metaFracciones) * 100, 100).toFixed(0)}%
            </span>
          </div>
        )}
        <CrecimientoChart data={crecimientoSM} meta={metaFracciones} />
      </div>

      <button
        onClick={() => navigate(`/coordinador/agregar/${user.usuario}`, {state: { user }})}
        className="bg-pink-500 hover:bg-pink-600 text-white px-4 py-2 rounded mb-6 mt-6 mr-2"
      >
        Agregar Colaborador
      </button>
      <button
        onClick={() => navigate(`/apoyos/${user.usuario}`, {state: { user }})}
        className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded mb-6 mt-6"
      >
        🎁 Apoyos y Programas Sociales
      </button>

      {/* <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">Polígono</th>
            <th className="border p-2">Sección</th>
            <th className="border p-2">Nombre</th>
            <th className="border p-2">Puesto</th>
            <th className="border p-2">Verificar</th>
          </tr>
        </thead>
      {seccionales.length > 0 ? (
          <tbody>
            {seccionales.map((resultado) => (
              <tr key={resultado.id}>
                <td className="border p-2">{resultado.poligono}</td>
                <td className="border p-2">{resultado.seccion}</td>
                <td className="border p-2">{resultado.nombre} {resultado.a_paterno} {resultado.a_materno}</td>
                <td className="border p-2">{resultado.puesto}</td>
                <td className="border p-2">
                <button onClick={() => navigate(`/ciudadano/${resultado.id}`)}
                  className="bg-blue-500 text-white px-4 py-2 rounded">
                    VERIFICAR
                </button>
                <ToggleStatusButtonCP registroId={resultado.id} initialStatus={resultado.status} />
                </td>
              </tr>
            ))}
          </tbody>
        ) : (
          <p>No se encontraron resultados.</p>
        )}
      </table> */}
      <br/>
      <label className='p-2 w-full'>
          Sección:
          <select 
          value={seccion} 
          onChange={(e) => setSection(e.target.value)}
          className="border p-2 w-full">
            <option value="">Todas</option>
            {opciones.secciones.map((sec) => (
              <option key={sec} value={sec}>
                {sec}
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

<div className="p-4">
        <h2>Resultados:</h2>

        <h3>{resultados.length}    </h3>
        <table className="w-full border-collapse border border-gray-300">
        <thead>
          <tr className="bg-gray-200">
            <th className="border p-2">Sector</th>
            <th className="border p-2">Sección</th>
            <th className="border p-2">Fracción</th>
            <th className="border p-2">Nombre</th>
            <th className="border p-2">Puesto</th>
            <th className="border p-2">Estatus</th>
            {/* <th className="border p-2">Eliminar</th> */}
            <th className="border p-2">Verificar</th>
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
                <td className="border p-2">{resultado.puesto}</td>
                <td className="border p-2">{resultado.status}</td>
                
                <td className="border p-2">
                <button onClick={() => navigate(`/ciudadano/${resultado.id}`)}
                  className="bg-blue-500 text-white px-4 py-2 rounded">
                    VERIFICAR
                </button>

                <ToggleStatusButtonCP registroId={resultado.id} initialStatus={resultado.status} />
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





      <p className="border p-2"><strong>SM´s:</strong> {promotores.length}</p>
      



      {/* <MapComponent mapa={section.geometry}/> */}
      <div className="mt-6" style={{ height: '520px' }}>
        <MapTerritorial
          secciones={seccionesSector}
          fraccionesGeo={fraccionesConSM}
          ciudadanos={ciudadanosGeo}
          selectedSeccion={seccion ? Number(seccion) : null}
          onSelectSeccion={(sec) => setSection(String(sec.seccion))}
          spName={fullName(user)}
        />
      </div>
    </div>
  );
};

export default Coordinador;