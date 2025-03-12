import { useEffect, useState } from "react";
import MapComponent2 from "../map/MapComponent2";
import supabase from "../supabase/client";
import { useNavigate } from "react-router-dom";

function Territorio(){
    // const [section, setSeccion] = useState([]);
    const [error, setError] = useState(null);
    const [poligono, setPoligono] = useState();
    const [seccion, setSeccion] = useState('');

    const [resultados, setResultados] = useState([]);
    const [opciones, setOpciones] = useState({ poligonos: [], secciones: []});
    const navigate = useNavigate();

    const handlepoligono= async (e)=>{
        try {
            // Construir filtros dinámicos
            const getpoligono = e.target.value;
            setPoligono(getpoligono);
            let query = supabase.from('secciones').select('*').order('pologono', { ascending: true });
      
            if (getpoligono) query = query.eq('pologono', poligono);
            //if (seccion) query = query.eq('seccion', seccion);
      
            const { data, error } = await query;
      
            if (error) throw error;
      
            setResultados(data);
          } catch (err) {
            console.error('Error al filtrar:', err.message);
          }
        };
    
        
    
  
    // Cargar datos iniciales para los selectores
    useEffect(() => {
      const cargarOpciones = async () => {
        try {
          const { data, error } = await supabase
            .from('secciones') // Reemplaza con el nombre de tu tabla
            .select('pologono, seccion').order('pologono', { ascending: true });
  
          if (error) throw error;
  
          // Extraer valores únicos para los selectores
          const poligonos = [...new Set(data.map((item) => item.pologono))];
          const secciones = [...new Set(data.map((item) => item.seccion))];

          setOpciones({ poligonos, secciones });
        } catch (err) {
          console.error('Error al cargar opciones:', err.message);
        }
      };
  
      cargarOpciones();
    }, []);
    
    // Manejar búsqueda en Supabase
    // const manejarFiltro = async () => {
    //   try {
    //     // Construir filtros dinámicos
    //     let query = supabase.from('secciones').select('*').order('pologono', { ascending: true });
  
    //     if (poligono) query = query.eq('pologono', poligono);
    //     if (seccion) query = query.eq('seccion', seccion);
  
    //     const { data, error } = await query;
  
    //     if (error) throw error;
  
    //     setResultados(data);
    //   } catch (err) {
    //     console.error('Error al filtrar:', err.message);
    //   }
    // };

    const fetchSecciones = async () => {
        try {
          const { data, error } = await supabase
            .from('secciones') // Nombre de la tabla
            .select('*');//.eq("pologono",props.mapa);
            // .eq('seccion', user.seccion); // Consulta todos los campos
    
          if (error) throw error;
    
          setSeccion(data); // Actualiza el estado con los datos obtenidos
        } catch (error) {
          console.error("Error",error.message);
          setError(error.message);
        }
      };
    
        useEffect(() => {
        fetchSecciones(); // Llama a la función al montar el componente
    
      }, []);
      // Estado para almacenar los valores seleccionados

     
    return(<>
        {/* <h1>{opciones.poligonos}</h1> */}
        <div className="text-dark"> 
            <select name='poligono' className='form-control' onChange={(e)=>handlepoligono(e)} required>
                <option value="">--Selecciona el Polígono--</option>{
                        // const poligonos = [...new Set(jsonData.map((pol)=>pol.POLIGONO))]
                        opciones.poligonos.map( (getpol)=>(
                          <option value={getpol} key={getpol}>{getpol}</option> 
                        ))

                        }

                    
                        </select> 
                        <h1>{poligono}</h1>   
                        <h1>{resultados.map((secciones)=>(
                            <h2>{secciones.seccion}</h2>
                        ))}</h1>       
                    </div>

        <MapComponent2 mapa={poligono}/></>
    )
};
export default Territorio;