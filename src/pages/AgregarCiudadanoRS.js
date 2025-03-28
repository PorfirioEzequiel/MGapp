import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import supabase from '../supabase/client';


export default function AgregarCiudadanoRS() {
    const { state } = useLocation();
    const { user } = state || {};
  const navigate = useNavigate();
  // const [id, setId]= useState(1410);
  const [seccion, setSeccion] = useState(user.seccion);
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
    dtto_fed: 0,
    dtto_loc: 0,
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
    url_foto_perfil: "",
    url_foto_ine1: "",
    url_foto_ine2: "",
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

        setNuevoCiudadano((prev) => ({
          ...prev,
          seccion,
          poligono: seccionData[0].poligono,
          nombre_municipio: seccionData[0].nombre_municipio,
          dtto_fed: seccionData[0].dtto_fed,
          dtto_loc: seccionData[0].dtto_loc,
          municipio: seccionData[0].municipio,
          puesto: "CIUDADANO"
        }));
        // Buscar las UBT correspondientes a la sección
        const { data: ubtData, error: ubtError } = await supabase
          .from('ubt_catalogo') // Cambia por el nombre de tu tabla
          .select('ubt')
          .eq('seccion', seccion);

        if (ubtError) throw ubtError;

        setUbts(ubtData.map((item) => item.ubt));
      } else {
        setPoligono(0);
        setDfed(0);
        setDloc(0);
        setNmunicipio(0);
        setMunicipio('');
        setUbts([]);
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

  
  
  const CURP_REGEX = /^[A-Z]{1}[AEIOUX]{1}[A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HM]{1}[A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]{1}\d{1}$/;



  const handleSubmit = async (e) => {
    e.preventDefault();
    const curp = nuevoCiudadano.curp.trim().toUpperCase(); // Aseguramos formato correcto
    // setNuevoCiudadano((prev) => ({
    //   ...prev,
    //   usuario: curp
    // }));

    setNuevoCiudadano({ ...nuevoCiudadano, usuario: curp,ingreso_estructura: '2025-03-30' });
    // setNuevoCiudadano({ ...nuevoCiudadano, ingreso_estructura: '2025-03-30' });
    
    if (!CURP_REGEX.test(curp)) {
      console.log("El CURP no es válido:", curp);
      alert("El CURP ingresado no es válido. Verifica que tenga el formato correcto.");
      return;
    }
    try {
      console.log(nuevoCiudadano)
      const { error } = await supabase.from('ciudadania').insert([nuevoCiudadano]);
      if (error) {
        console.error("Error al guardar los datos:", error);
        alert(error.code=== 23505 ? "":"REGISTRO DUPLICADO");
        return;
      }
      alert("Ciudadano agregado correctamente");

    // Limpiar todos los campos
    setNuevoCiudadano({
      dtto_fed: 0,
      dtto_loc: 0,
      municipio: nmunicipio,
      nombre_municipio: '',
      poligono: '',
      seccion: '',
      ubt: '',
      area_adscripcion: '',
      dependencia: '',
      puesto: '',
      id_puesto: 0,
      tipo: '',
      ingreso_estructura: '',
      observaciones: '',
      usuario: '',
      password: '',
      nombre: '',
      a_paterno: '',
      a_materno: '',
      curp: '',
      calle: '',
      n_ext_mz: '',
      n_int_lt: '',
      n_casa: '',
      c_p: 0,
      col_loc: '',
      telefono_1: '',
      telefono_2: '',
      cuenta_inst: '',
      cuenta_fb: '',
      cuenta_x: '',
      status: 'ACTIVO',
      url_foto_perfil: '',
      url_foto_ine1: '',
      url_foto_ine2: '',
    });

      setSeccion('');
      setUbts([]);
      setPoligono('');
      setMunicipio('');
      setDfed(0);
      setDloc(0);
      setNmunicipio('');
      
    } catch (error) {
      console.error("Error inesperado:", error);
      alert("Error al guardar los datos:", error)
      // setMessage("Ocurrió un error al enviar el reporte.");
    }
  };
  
// Efecto para buscar datos cuando cambia la sección
useEffect(() => {
  if (seccion) {
    buscarDatosSeccion(seccion);
  } else {
    setPoligono(0);
    setMunicipio('');
    setDfed(0);
    setDloc(0);
    setNmunicipio(0);
    setUbts([]);
  }
}, [seccion]);
async function handleFileUpload(event, fieldName) {
  const file = event.target.files[0];
  if (!file) return;

  // const filePath = `ciudadanos/${id}/${fieldName}-${file.name}`;
  // const curp = nuevoCiudadano.curp.trim().toUpperCase();
  // const filePath = `ciudadanos/${fieldName}-`+curp;
  // const { data, error } = await supabase.storage.from("fotos_estructura").upload(filePath, file, { upsert: true });

  // if (error) {
  //   console.error("Error subiendo imagen:", error);
  //   return;
  // }

  // const { data: urlData } = supabase.storage.from("fotos_estructura").getPublicUrl(filePath);
  // setNuevoCiudadano((prev) => ({ ...prev, [fieldName]: urlData.publicUrl }));
}

{/* <label>TIPO: <input type="text" value={nuevoCiudadano.tipo} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, tipo: e.target.value })} className="border p-2 w-full" required/></label> */}
        
  return (
    <div className="p-4 mx-auto">
      <h1 className="text-xl font-bold mb-4">Agregar Ciudadano</h1>
      <div className="grid gap-4">

      
      
      <form onSubmit={handleSubmit} /*class="py-4 px-6"*/>
  
        
    <div className="border p-2 w-full" >
      {loading && <p>Cargando...</p>}
        <div className="border p-2 w-full" >
            <p>
                <strong>Sección:</strong> {user.seccion}
            </p>
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
        
        <label>Nombre: <input type="text" value={nuevoCiudadano.nombre} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, nombre: e.target.value.toUpperCase() })} className="border p-2 w-full" required/></label>
        <label>Apellido Paterno: <input type="text" value={nuevoCiudadano.a_paterno} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, a_paterno: e.target.value.toUpperCase() })} className="border p-2 w-full" required/></label>
        
        <label>Apellido Materno: <input type="text" value={nuevoCiudadano.a_materno} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, a_materno: e.target.value.toUpperCase() })} className="border p-2 w-full" required/></label>
        <label>CURP: <input type="text" value={nuevoCiudadano.curp} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, curp: e.target.value.trim().toUpperCase() })} className="border p-2 w-full" required/></label>
        <label>Calle: <input type="text" value={nuevoCiudadano.calle} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, calle: e.target.value.toUpperCase() })} className="border p-2 w-full" required/></label>
        <label>N° Ext (MZ): <input type="text" value={nuevoCiudadano.n_ext_mz} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, n_ext_mz: e.target.value.toUpperCase() })} className="border p-2 w-full" required/></label>
        <label>N° Int (LT): <input type="text" value={nuevoCiudadano.n_int_lt} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, n_int_lt: e.target.value.toUpperCase() })} className="border p-2 w-full" required/></label>
        <label>N° Casa: <input type="text" value={nuevoCiudadano.n_casa} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, n_casa: e.target.value.toUpperCase() })} className="border p-2 w-full" /></label>
        <label>Localidad: <input type="text" value={nuevoCiudadano.col_loc} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, col_loc: e.target.value.toUpperCase() })} className="border p-2 w-full" /></label>
        <label>Código Postal: <input type="number" value={nuevoCiudadano.c_p} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, c_p: e.target.value})} className="border p-2 w-full" required/></label>
        <label>Teléfono 1: <input type="text" value={nuevoCiudadano.telefono_1} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, telefono_1: e.target.value })} className="border p-2 w-full" required/></label>
        {/* <label>Teléfono 2: <input type="text" value={nuevoCiudadano.telefono_2} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, telefono_2: e.target.value })} className="border p-2 w-full" required/></label>
        <label>INSTAGRAM: <input type="text" value={nuevoCiudadano.cuenta_inst} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, cuenta_inst: e.target.value })} className="border p-2 w-full" required/></label>
        <label>FACEBOOK 1: <input type="text" value={nuevoCiudadano.cuenta_fb} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, cuenta_fb: e.target.value })} className="border p-2 w-full" required/></label>
        <label>X: <input type="text" value={nuevoCiudadano.cuenta_x} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, cuenta_x: e.target.value })} className="border p-2 w-full" required/></label>
         */}
        
        
        <button /*onClick={handleAdd}*/ type="submit" className="bg-green-500 text-white px-4 py-2 rounded">Guardar</button>
        </form>
        <button onClick={() => navigate(`/perfil/${user.usuario}`, {state: { user: user }})} className="bg-red-500 text-white px-4 py-2 rounded">Cancelar</button>
      </div>
    </div>
  );
}
