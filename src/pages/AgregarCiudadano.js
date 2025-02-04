import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from '../supabase/client';


export default function AgregarCiudadano() {
  const navigate = useNavigate();
  const [seccion, setSeccion] = useState("");
  // const [seccion, setSeccion] = useState('');
  const [dfed, setDfed] = useState(0);
  const [dloc, setDloc] = useState(0);
  const [poligono, setPoligono] = useState();
  const [municipio, setMunicipio] = useState('');
  const [nmunicipio, setNmunicipio] = useState(82);
  const [secciones, setSecciones] = useState([]);
  const [ubts, setUbts] = useState([]);
  const [ubt, setUbt] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const dependencias = [ "UBT","DIF", "ODAPAS","IMDEPORTE", "AYTTO"];
  const [puestos, setPuestos] = useState([]);
  const [puesto, setPuesto] = useState();
  const [nuevoCiudadano, setNuevoCiudadano] = useState({
    dtto_fed: dfed,
    dtto_loc: dloc,
    municipio: nmunicipio,
    nombre_municipio: municipio,	
    poligono: poligono,
    seccion: "",
    ubt: "",
    area_adscripcion: "",	
    dependencia: "",	
    puesto: "",	
    id_puesto: 0,	
    tipo: "",	
    ingreso_estructura: "",	
    observaciones: "",
    usuario: "",	
    password: "",
    nombre: "",
    a_paterno: "",
    a_materno: "",
    curp: "",
    calle: "",
    n_ext_mz: "",	
    n_int_lt: "",
    n_casa: "",
    c_p: 0,
    col_loc: "",
    telefono_1: "",
    telefono_2: "",
    cuenta_inst: "",
    cuenta_fb: "",
    cuenta_x: "",
    status: "ACTIVO",
  });
  useEffect(() => {
    const cargarPuestos = async () => {
      try {
        const { data, error } = await supabase
          .from('puestos') // Reemplaza con el nombre de tu tabla
          .select('*');

        if (error) throw error;

        // Extraer valores únicos para los selectores
        
        const puestos = data.map((item) => item.puesto);
        
        // console.log(data.filter(id => id.puesto ==puesto));
        setPuestos(puestos );
      } catch (err) {
        console.error('Error al cargar opciones:', err.message);
      }
    };

    cargarPuestos();
  }, []);
  
  // Función para buscar los datos de la sección
  const buscarDatosSeccion = async (seccion) => {
    setLoading(true);
    try {
      // Buscar el polígono y municipio
      const { data: seccionData, error } = await supabase
        .from('ubt_catalogo') // Cambia por el nombre de tu tabla
        .select('*')
        .eq('seccion', seccion)
        .limit(1);

      if (error) throw error;

      if (seccionData && seccionData.length > 0) {
        setPoligono(seccionData[0].poligono);
        // setNuevoCiudadano({ ...nuevoCiudadano, poligono: seccionData[0].poligono })}
        setMunicipio(seccionData[0].nombre_municipio);
        setDfed(seccionData[0].dtto_fed);
        setDloc(seccionData[0].dtto_loc);
        setNmunicipio(seccionData[0].municipio)
        

        // Buscar las UBT correspondientes a la sección
        const { data: ubtData, error: ubtError } = await supabase
          .from('ubt_catalogo') // Cambia por el nombre de tu tabla
          .select('ubt')
          .eq('seccion', seccion);

        if (ubtError) throw ubtError;

        setUbts(ubtData.map((item) => item.ubt));
      } else {
        // setPoligono(0);
        // setDfed(0);
        // setDloc(0);
        // setNmunicipio(0);
        // setMunicipio('');
        // setUbts([]);
      }
    } catch (error) {
      console.error('Error al buscar datos:', error);
    } finally {
      setLoading(false);
    }
  };

  



  

  async function handleAdd() {
    const { error } = await supabase.from('ciudadania').insert([nuevoCiudadano]);

    if (error) console.error("Error agregando ciudadano:", nuevoCiudadano, error);
    else {
      alert("Ciudadano agregado correctamente");
    //   navigate("/");
    }
  }

  


  const handleSubmit = async (e) => {
    e.preventDefault();
    setDfed(dfed);
    try {
      console.log(nuevoCiudadano)
      const { error } = await supabase.from('ciudadania').insert([nuevoCiudadano]);
      if (error) {
        console.error("Error al guardar los datos:", error);
        
        return;
      }

      
    } catch (error) {
      console.error("Error inesperado:", error);
      // setMessage("Ocurrió un error al enviar el reporte.");
    }
  };
  
// Efecto para buscar datos cuando cambia la sección
useEffect(() => {
  if (seccion) {
    buscarDatosSeccion(seccion);
  } else {
    // setPoligono(0);
    // setMunicipio('');
    // setDfed(0);
    // setDloc(0);
    // setNmunicipio(0);
    // setUbts([]);
  }
}, [seccion]);

  return (
    <div className="p-4 mx-auto">
      <h1 className="text-xl font-bold mb-4">Agregar Ciudadano</h1>
      <div className="grid gap-4">

      {/* dtto_fed	dtto_loc	municipio	nombre_municipio	poligono	seccion	ubt	area_adscripcion	dependencia	puesto	id_puesto	tipo	ingreso_estructura	observaciones	
      usuario	password	nombre	a_paterno	a_materno	curp	calle	n_ext_mz	n_int_lt	n_casa	c_p	col_loc	telefono_1	telefono_2	cuenta_inst	cuenta_fb	cuenta_x	status */}
      <form onSubmit={handleSubmit} /*class="py-4 px-6"*/>
        {/* <label>DISTRITO FEDETAL: <input type="number" value={nuevoCiudadano.dtto_fed} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, dtto_fed: e.target.value })} className="border p-2 w-full" required/></label>
        <label>DISTRITO LOCAL: <input type="number" value={nuevoCiudadano.dtto_loc} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, dtto_loc: e.target.value })} className="border p-2 w-full" required/></label>
        <label>N° MUNICIPIO: <input type="number" value={nuevoCiudadano.municipio} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, municipio: e.target.value })} className="border p-2 w-full" required/></label>
        <label>MUNICIPIO: <input type="text" value={nuevoCiudadano.nombre_municipio} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, nombre_municipio: e.target.value })} className="border p-2 w-full" required/></label>
        <label>POLÍGONO: <input type="number" value={nuevoCiudadano.poligono} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, poligono: e.target.value })} className="border p-2 w-full" required/></label> */}
        {/* <label>SECCIÓN: 
          <input type="text" 
                  value={secciones.seccion} 
                  onChange={handleSeccionChange} 
                  className="border p-2 w-full" 
                  required/>
        </label> */}


        <div className="border p-2 w-full" >
      
      <div className="border p-2 w-full" >
        <label htmlFor="seccion">Sección:</label>
        <input
          id="seccion"
          type="text"
          value={seccion}
          onChange={(e) => setSeccion(e.target.value)}
          // value={nuevoCiudadano.seccion} 
          // onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, seccion: e.target.value }) }
          placeholder="Ingresa la sección"
          className="border p-2 w-full" 
          required
        />
      </div>

      {loading && <p>Cargando...</p>}
      
    
        <div className="border p-2 w-full" >
        <p>
            <strong>Distrito Federal:</strong> {dfed}
          </p>
          <p>
            <strong>Distrito Local:</strong> {dloc}
          </p>
          <p>
            <strong>Polígono:</strong> {poligono}
          </p>
          <p>
            <strong>Municipio:</strong> {municipio}
          </p>
        </div>
      
      {ubts.length > 0 && (
        <div>
          <label >UBT:</label>
          <select id="ubt" 
          // onChange={(e) => setUbt(e.target.value)}
          onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, ubt: e.target.value })}
          className="border p-2 w-full" required>
            <option value="">Seleccionar UBT</option>
            {ubts.map((ubt, index) => (
              <option key={index} value={ubt}>
                {ubt}
              </option>
            ))}
          </select>
        </div>
      )}
    </div>
        {/* <label>UBT: <input type="text" value={nuevoCiudadano.ubt} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, ubt: e.target.value })} className="border p-2 w-full" required/></label> */}
        <label>AREA: <input type="text" value={nuevoCiudadano.area_adscripcion} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, area_adscripcion: e.target.value })} className="border p-2 w-full" required/></label>
        <label>DEPENDENCIA: 
          <select id="dependen"
          value={nuevoCiudadano.dependencia} 
          onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, dependencia: e.target.value })} 
          className="border p-2 w-full" required>
            {dependencias.map((dep, index) => (
              <option key={index} value={dep}>
                {dep}
              </option>
            ))}
          </select>
        </label>
        {/* <label>PUESTO: <input type="text" value={nuevoCiudadano.puesto} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, puesto: e.target.value })} className="border p-2 w-full" required/></label>
        <label>ID PUESTO: <input type="number" value={nuevoCiudadano.id_puesto} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, id_puesto: e.target.value })} className="border p-2 w-full" required/></label> */}
        <label>
          Puesto:
          <select 
          value={nuevoCiudadano.puesto} 
          onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, puesto: e.target.value })}
          className="border p-2 w-full">
            <option value="" >Todos</option>
            {puestos.map((pues, index) => (
              <option key={index} value={pues}>
                {pues}
              </option>
            ))}
          </select>
        </label>
        
        
        
        
        <label>TIPO: <input type="text" value={nuevoCiudadano.tipo} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, tipo: e.target.value })} className="border p-2 w-full" required/></label>
        <label>INGRESO A LA ESTRUCTURA: <input type="date" value={nuevoCiudadano.ingreso_estructura} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, ingreso_estructura: e.target.value })} className="border p-2 w-full" required/></label>
        <label>OBSERVACIONES: <input type="text" value={nuevoCiudadano.observaciones} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, observaciones: e.target.value })} className="border p-2 w-full" required/></label>
        <label>Usuario: <input type="text" value={nuevoCiudadano.usuario} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, usuario: e.target.value })} className="border p-2 w-full" required/></label>
        <label>Contraseña: <input type="text" value={nuevoCiudadano.password} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, password: e.target.value })} className="border p-2 w-full" required/></label>
        <label>Nombre: <input type="text" value={nuevoCiudadano.nombre} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, nombre: e.target.value })} className="border p-2 w-full" required/></label>
        <label>Apellido Paterno: <input type="text" value={nuevoCiudadano.a_paterno} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, a_paterno: e.target.value })} className="border p-2 w-full" required/></label>
        <label>Apellido Materno: <input type="text" value={nuevoCiudadano.a_materno} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, a_materno: e.target.value })} className="border p-2 w-full" required/></label>
        <label>CURP: <input type="text" value={nuevoCiudadano.curp} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, curp: e.target.value })} className="border p-2 w-full" required/></label>
        <label>Calle: <input type="text" value={nuevoCiudadano.calle} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, calle: e.target.value })} className="border p-2 w-full" required/></label>
        <label>N° Ext (MZ): <input type="text" value={nuevoCiudadano.n_ext_mz} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, n_ext_mz: e.target.value })} className="border p-2 w-full" required/></label>
        <label>N° Int (LT): <input type="text" value={nuevoCiudadano.n_int_lt} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, n_int_lt: e.target.value })} className="border p-2 w-full" required/></label>
        <label>N° Casa: <input type="text" value={nuevoCiudadano.n_casa} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, n_casa: e.target.value })} className="border p-2 w-full" required/></label>
        <label>Código Postal: <input type="number" value={nuevoCiudadano.c_p} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, c_p: e.target.value })} className="border p-2 w-full" required/></label>
        <label>Teléfono 1: <input type="text" value={nuevoCiudadano.telefono_1} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, telefono_1: e.target.value })} className="border p-2 w-full" required/></label>
        <label>Teléfono 2: <input type="text" value={nuevoCiudadano.telefono_2} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, telefono_2: e.target.value })} className="border p-2 w-full" required/></label>
        <label>INSTAGRAM: <input type="text" value={nuevoCiudadano.cuenta_inst} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, cuenta_inst: e.target.value })} className="border p-2 w-full" required/></label>
        <label>FACEBOOK 1: <input type="text" value={nuevoCiudadano.cuenta_fb} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, cuenta_fb: e.target.value })} className="border p-2 w-full" required/></label>
        <label>X: <input type="text" value={nuevoCiudadano.cuenta_x} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, cuenta_x: e.target.value })} className="border p-2 w-full" required/></label>
        
        
        
        <button /*onClick={handleAdd}*/ type="submit" className="bg-green-500 text-white px-4 py-2 rounded">Guardar</button>
        </form>
        <button onClick={() => navigate("/")} className="bg-gray-500 text-white px-4 py-2 rounded">Cancelar</button>
      </div>
    </div>
  );
}
