import React, { useState, useEffect } from "react";
import supabase from "../supabase/client";
import MapComponent2 from "../map/MapComponent2";

const TableroBoard = () => {
  const [distritos, setDistritos] = useState([]);
  const [poligonos, setPoligonos] = useState([]);
  const [secciones, setSecciones] = useState([]);
  const [ubts, setUbts] = useState([]);

  const [selectedDistrito, setSelectedDistrito] = useState(null);
  const [selectedPoligono, setSelectedPoligono] = useState(null);
  const [selectedSeccion, setSelectedSeccion] = useState(null);
  const [ficha, setFicha] = useState(null);

  const [cp, setCp] = useState(null);
  const [rs, setRs] = useState(null);

  const [error, setError] = useState(null);
  const [promotores, setPromotores] = useState([]);
  const [ciudadanos, setCiudadanos] = useState([]);
  const [ciudadanosInv, setCiudadanosInv] = useState([]);
  const [filteredCiudadanos, setFilteredCiudadanos] = useState([]);

  useEffect(() => {
    fetchDistritos();
  }, []);

  const fetchDistritos = async () => {
    const { data } = await supabase
      .from("ubt_catalogo")
      .select("dtto_fed")
      .order("dtto_fed", { ascending: true });
    setDistritos([...new Set(data.map(d => d.dtto_fed))]);
  };

  const fetchPoligonos = async (distrito) => {
    const { data } = await supabase
      .from("ubt_catalogo")
      .select("sector")
      .eq("dtto_fed", distrito);
    setPoligonos([...new Set(data.map(d => d.sector))]);
  };

  const fetchSecciones = async (sector) => {
    const { data } = await supabase
      .from("ubt_catalogo")
      .select("seccion")
      .eq("dtto_fed", selectedDistrito)
      .eq("sector", sector);
    setSecciones([...new Set(data.map(d => d.seccion))]);
  };

  const fetchUbts = async (seccion) => {
    const { data } = await supabase
      .from("ubt_catalogo")
      .select("fraccion")
      .eq("dtto_fed", selectedDistrito)
      .eq("sector", selectedPoligono)
      .eq("seccion", seccion);
    setUbts(data.map(d => d.fraccion));
  };

  const fetchFicha = async (fraccion) => {
    const { data } = await supabase
      .from("ubt_catalogo")
      .select("*")
      .eq("fraccion", fraccion)
      .single();
    setFicha(data);
  };

  const fetchCp = async (poligono) => {
  const { data, error } = await supabase
    .from("ciudadania")
    .select("nombre, a_paterno, a_materno") // solo los campos necesarios
    .eq("puesto", "SP")
    .eq("poligono", poligono)
    .eq("status", "ACTIVO")
    .maybeSingle(); // evita error si no hay registro
  if (!error) setCp(data);
};

const fetchRs = async (seccion) => {
  const { data, error } = await supabase
    .from("ciudadania")
    .select("nombre, a_paterno, a_materno") // solo los campos necesarios
    .eq("puesto", "SECCIONAL")
    .eq("seccion", seccion)
    .eq("status", "ACTIVO")
    .maybeSingle();
  if (!error) setRs(data);
  };

    const fetchPromotoras = async (seccion) => {
    try {
      const { data, error } = await supabase
        .from('ciudadania')
        .select('*')
        .eq("seccion", seccion)
        .eq("puesto", "SM")
        .eq("status", "ACTIVO")
        .order('ubt', { ascending: true });

      if (error) throw error;
      setPromotores(data);
    } catch (error) {
      console.error("Error", error.message);
      setError(error.message);
    }
  };

  const fetchCiudadanos = async (seccion) => {
    try {
      const { data, error } = await supabase
        .from('ciudadania')
        .select('*')
        .eq("seccion", seccion)
        .or('puesto.eq.MOVILIZADOR,puesto.eq.MOVILIZADOR')
        .order('puesto', { ascending: false })
        .order('ubt', { ascending: true });

      if (error) throw error;
      setCiudadanos(data);
      setFilteredCiudadanos(data);
    } catch (error) {
      console.error("Error", error.message);
      setError(error.message);
    }
  };

  const fetchCiudadanosIn = async (seccion) => {
    try {
      const { data, error } = await supabase
        .from('ciudadania')
        .select('*')
        .eq("seccion", seccion)
        .or('puesto.eq.INVITADO,puesto.eq.INVITADO')
        .order('puesto', { ascending: false })
        .order('ubt', { ascending: true });

      if (error) throw error;
      setCiudadanosInv(data);
      // setFilteredCiudadanos(data);
    } catch (error) {
      console.error("Error", error.message);
      setError(error.message);
    }
  };

  useEffect(() => {
  if (selectedSeccion) {
    fetchCiudadanos(selectedSeccion);
    fetchPromotoras(selectedSeccion);
    fetchCiudadanosIn(selectedSeccion);
  }
}, [selectedSeccion]);

  return (
    <div className="p-4 space-y-4 ">
      <h1 className="text-xl font-bold">Tablero Territorial {selectedPoligono}</h1>
      <div className="grid grid-cols-2 grid-rows-2 gap-1 bg-gray-200 p-1 rounded-lg shadow-md">
      
      <div className="rounded-lg p-6 row-span-2 flex flex-col">
      {/* Distritos */}
      <div>
        <h2 className="font-semibold">Distritos</h2>
        <div className="flex flex-wrap gap-2">
          {distritos.map(d => (
            <button key={d}
              className="px-3 py-1 bg-blue-500 text-white rounded"
              onClick={() => {
                setSelectedDistrito(d);
                setFicha(null);
                fetchPoligonos(d);
                setPoligonos([]); setSecciones([]); setUbts([]);
              }}>
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Polígonos */}
      {selectedDistrito && (
        <div>
          <h2 className="font-semibold">Sectores</h2>
          <div className="flex flex-wrap gap-2">
            {poligonos.map(p => (
              <button key={p}
                className="px-3 py-1 bg-green-500 text-white rounded"
                onClick={() => {
                  setSelectedPoligono(p);
                  setFicha(null);
                  fetchSecciones(p);
                  fetchCp(p);
                  setSecciones([]); setUbts([]);
                  
                }}>
                {p}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Secciones */}
      {selectedPoligono && (
        <div>
          <h1 className="font-semibold">
            Coordinador@ de Sector: {cp ? `${cp.nombre} ${cp.a_paterno} ${cp.a_materno}` : "—"}
          </h1>
          {/* <MapComponent2 key={selectedPoligono} mapa={selectedPoligono}/> */}
          <h2 className="font-semibold">Secciones</h2>
          <div className="flex flex-wrap gap-2">
            {secciones.map(s => (
              <button key={s}
                className="px-3 py-1 bg-pink-500 text-white rounded"
                onClick={() => {
                  setSelectedSeccion(s);
                  setFicha(null);
                  fetchUbts(s);
                  fetchRs(s); 
                  setUbts([]);
                }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
      
      
      {/* UBT */}
      {selectedSeccion && (
        <>
        <div >
          <h1 className="font-semibold">
            Responsable de Sección: {rs ? `${rs.nombre} ${rs.a_paterno} ${rs.a_materno}` : "—"}
          </h1>
          <h2 className="font-semibold">Fracción</h2>
        </div>
      
      <table className="w-auto border-collapse border border-gray-300 mt-4">
      <thead>
        <tr>
          <th>Fracción</th>
          <th>SM</th>
        </tr>
      </thead>
      <tbody>
        {ubts.map(u => (
          <tr key={u}>
            <td>
              <button
                className="px-3 py-1 bg-purple-500 text-white rounded"
                onClick={() => fetchFicha(u)}
              >
                {u}
              </button>
            </td>
            <td>
              {promotores.find(p => p.ubt === u) 
                ? `${promotores.find(p => p.ubt === u).nombre} ${promotores.find(p => p.ubt === u).a_paterno} ${promotores.find(p => p.ubt === u).a_materno}`
                : "—"}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
    </>
      
          )
      }
</div>

<div className="rounded-lg p-6 flex flex-col"><MapComponent2 key={selectedPoligono} mapa={selectedPoligono}/></div>
      {/* Ficha */}
      <div className="rounded-lg p-6 flex flex-col">
      {ficha && (
        <div className="p-4 border rounded bg-gray-100 mt-4">
          <h3 className="text-lg font-bold">Fracción: {ficha.fraccion}</h3>
          <p><b>SM:</b> {promotores.find(p => p.ubt === ficha.fraccion)
                ? `${promotores.find(p => p.ubt === ficha.fraccion).nombre} ${promotores.find(p => p.ubt === ficha.fraccion).a_paterno} ${promotores.find(p => p.ubt === ficha.fraccion).a_materno}`
                : "—"}</p>
        </div>
      )}</div>
      </div>
    </div>
  );
};

export default TableroBoard;
