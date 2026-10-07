// import { useEffect, useState } from "react";
// import { useLocation, useNavigate } from "react-router-dom";
// import supabase from '../supabase/client';


// export default function AgregarCiudadanoCP() {
//   const navigate = useNavigate();
//   const { state } = useLocation();
//   const { user } = state || {};
//   // const [id, setId]= useState(1410);
//   const [seccion, setSeccion] = useState("");
//   // const [seccion, setSeccion] = useState('');
//   const [dfed, setDfed] = useState(0);
//   const [dloc, setDloc] = useState(0);
//   const [poligono, setPoligono] = useState();
//   const [municipio, setMunicipio] = useState('');
//   const [nmunicipio, setNmunicipio] = useState(82);
//   const [secciones, setSecciones] = useState([]);
//   const [ubts, setUbts] = useState([]);
//   const [ubt, setUbt] = useState('');
//   const [loading, setLoading] = useState(false);
//   const [error, setError] = useState(null);
//   const dependencias = [ "DIF", "ODAPAS","IMDEPORTE", "AYTTO"];
//   const [puestos, setPuestos] = useState([]);
//   const [puesto, setPuesto] = useState();
//   const [opciones, setOpciones] = useState({ secciones: []});

//   const [nuevoCiudadano, setNuevoCiudadano] = useState({
//     dtto_fed: 0,
//     dtto_loc: 0,
//     municipio: nmunicipio,
//     nombre_municipio: municipio,	
//     poligono: poligono,
//     seccion: "",
//     ubt: "",
//     area_adscripcion: "",	
//     dependencia: "",	
//     puesto: "",	
//     id_puesto: 0,	
//     tipo: "",	
//     ingreso_estructura: "",	
//     observaciones: "",
//     usuario: "",	
//     password: "",
//     nombre: "",
//     a_paterno: "",
//     a_materno: "",
//     curp: "",
//     calle: "",
//     n_ext_mz: "",	
//     n_int_lt: "",
//     n_casa: "",
//     c_p: 0,
//     col_loc: "",
//     telefono_1: "",
//     telefono_2: "",
//     cuenta_inst: "",
//     cuenta_fb: "",
//     cuenta_x: "",
//     status: "SOLICITUD DE ALTA",
//     url_foto_perfil: "",
//     url_foto_ine1: "",
//     url_foto_ine2: "",
//   });



//   // Cargar datos iniciales para los selectores
//   useEffect(() => {
//     const cargarOpciones = async () => {
//       try {
//         const { data, error } = await supabase
//           .from('ciudadania') // Reemplaza con el nombre de tu tabla
//           .select('seccion').eq('poligono',user.poligono);

//         if (error) throw error;

//         // Extraer valores únicos para los selectores
        
//         const secciones = [...new Set(data.map((item) => item.seccion))];
        
//         const puestos1 = [...new Set(data.map((item) => item.puesto))];
//         // console.log(puestos1);
//         setOpciones({ secciones});
//       } catch (err) {
//         console.error('Error al cargar opciones:', err.message);
//       }
//     };

//     cargarOpciones();
//   }, []);

//   useEffect(() => {
//     const cargarPuestos = async () => {
//       try {
//         const { data, error } = await supabase
//           .from('puestos') // Reemplaza con el nombre de tu tabla
//           .select('*');
//         if (error) throw error;
//         // Extraer valores únicos para los selectores
//         const puestos = data.map((item) => item.puesto);
//         // console.log(data.filter(id => id.puesto ==puesto));
//         setPuestos(puestos );
//       } catch (err) {
//         console.error('Error al cargar opciones:', err.message);
//       }
//     };

//     cargarPuestos();
//   }, []);

//   //  setPuestos(["SECCIONAL","SM"]);
//   // Función para buscar los datos de la sección
//   const buscarDatosSeccion = async (seccion) => {
//     setLoading(true);
//     try {
//       // Buscar el polígono y municipio
//       const { data: seccionData, error } = await supabase
//         .from('ubt_catalogo') // Cambia por el nombre de tu tabla
//         .select('*')
//         .eq('seccion', seccion)
//         .limit(1);

//       if (error) throw error;

//       if (seccionData && seccionData.length > 0) {
//         setPoligono(seccionData[0].poligono);
//         // setNuevoCiudadano({ ...nuevoCiudadano, poligono: seccionData[0].poligono })}
//         setMunicipio(seccionData[0].nombre_municipio);
//         setDfed(seccionData[0].dtto_fed);
//         setDloc(seccionData[0].dtto_loc);
//         setNmunicipio(seccionData[0].municipio)

//         setNuevoCiudadano((prev) => ({
//           ...prev,
//           seccion,
//           poligono: seccionData[0].poligono,
//           nombre_municipio: seccionData[0].nombre_municipio,
//           dtto_fed: seccionData[0].dtto_fed,
//           dtto_loc: seccionData[0].dtto_loc,
//           municipio: seccionData[0].municipio
//         }));
//         // Buscar las UBT correspondientes a la sección
//         const { data: ubtData, error: ubtError } = await supabase
//           .from('ubt_catalogo') // Cambia por el nombre de tu tabla
//           .select('ubt')
//           .eq('seccion', seccion);

//         if (ubtError) throw ubtError;

//         setUbts(ubtData.map((item) => item.ubt));
//       } else {
//         setPoligono(0);
//         setDfed(0);
//         setDloc(0);
//         setNmunicipio(0);
//         setMunicipio('');
//         setUbts([]);
//       }
//     } catch (error) {
//       console.error('Error al buscar datos:', error);
//     } finally {
//       setLoading(false);
//     }
//   };


//   async function handleAdd() {
//     const { error } = await supabase.from('ciudadania').insert([nuevoCiudadano]);

//     if (error) console.error("Error agregando ciudadano:", nuevoCiudadano, error);
//     else {
//       alert("Ciudadano agregado correctamente");
//       navigate(-1);
//     }
//   }

  
  
//   const CURP_REGEX = /^[A-Z]{1}[AEIOU]{1}[A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HM]{1}[A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]{1}\d{1}$/;



//   const handleSubmit = async (e) => {
//     e.preventDefault();
//     const curp = nuevoCiudadano.curp.trim().toUpperCase(); // Aseguramos formato correcto

//     if (!CURP_REGEX.test(curp)) {
//       console.log("El CURP no es válido:", curp);
//       alert("El CURP ingresado no es válido. Verifica que tenga el formato correcto.");
//       return;
//     }

//     if (nuevoCiudadano.puesto === "SM") {
//       nuevoCiudadano.usuario = curp;
//       nuevoCiudadano.password = curp
//     }
//     try {
//       console.log(nuevoCiudadano)
//       const { error } = await supabase.from('ciudadania').insert([nuevoCiudadano]);
//       if (error) {
//         console.error("Error al guardar los datos:", error);
//         alert("Error al guardar los datos:", error)
//         return;
//       }
//       alert("Ciudadano agregado correctamente");
//       navigate(-1);
//     // Limpiar todos los campos
//     setNuevoCiudadano({
//       dtto_fed: 0,
//       dtto_loc: 0,
//       municipio: nmunicipio,
//       nombre_municipio: '',
//       poligono: '',
//       seccion: '',
//       ubt: '',
//       area_adscripcion: '',
//       dependencia: '',
//       puesto: '',
//       id_puesto: 0,
//       tipo: '',
//       ingreso_estructura: '',
//       observaciones: '',
//       usuario: '',
//       password: '',
//       nombre: '',
//       a_paterno: '',
//       a_materno: '',
//       curp: '',
//       calle: '',
//       n_ext_mz: '',
//       n_int_lt: '',
//       n_casa: '',
//       c_p: 0,
//       col_loc: '',
//       telefono_1: '',
//       telefono_2: '',
//       cuenta_inst: '',
//       cuenta_fb: '',
//       cuenta_x: '',
//       status: '',
//       url_foto_perfil: '',
//       url_foto_ine1: '',
//       url_foto_ine2: '',
//     });

//       setSeccion('');
//       setUbts([]);
//       setPoligono('');
//       setMunicipio('');
//       setDfed(0);
//       setDloc(0);
//       setNmunicipio('');
      
//     } catch (error) {
//       console.error("Error inesperado:", error);
//       // setMessage("Ocurrió un error al enviar el reporte.");
//     }
//   };
  
// // Efecto para buscar datos cuando cambia la sección
// useEffect(() => {
//   if (seccion) {
//     buscarDatosSeccion(seccion);
//   } else {
//     setPoligono(0);
//     setMunicipio('');
//     setDfed(0);
//     setDloc(0);
//     setNmunicipio(0);
//     setUbts([]);
//   }
// }, [seccion]);
// async function handleFileUpload(event, fieldName) {
//   const file = event.target.files[0];
//   if (!file) return;

//   // const filePath = `ciudadanos/${id}/${fieldName}-${file.name}`;
//   const curp = nuevoCiudadano.curp.trim().toUpperCase();
//   const filePath = `ciudadanos/${fieldName}-`+curp;
//   const { data, error } = await supabase.storage.from("fotos_estructura").upload(filePath, file, { upsert: true });

//   if (error) {
//     console.error("Error subiendo imagen:", error);
//     return;
//   }

//   const { data: urlData } = supabase.storage.from("fotos_estructura").getPublicUrl(filePath);
//   setNuevoCiudadano((prev) => ({ ...prev, [fieldName]: urlData.publicUrl }));
// }

// {/* <label>TIPO: <input type="text" value={nuevoCiudadano.tipo} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, tipo: e.target.value })} className="border p-2 w-full" required/></label> */}
        
//   return (
//     <div className="p-4 mx-auto">
//       <h1 className="text-xl font-bold mb-4">Agregar Colaborador</h1>
//   <div className="grid gap-4">

      
//       <form onSubmit={handleSubmit} /*class="py-4 px-6"*/>
         
        
//     <div className="border p-2 w-full" >
//     <div className="flex flex-wrap justify md:justify-start mb-4">
//         <div>
//           <img src={nuevoCiudadano.url_foto_perfil} alt="Perfil" className="w-auto h-64 object-cover rounded-lg m-auto" />
//           <input type="file" onChange={(e) => handleFileUpload(e, "url_foto_perfil")} class="block w-full text-sm text-gray-500
//         file:me-4 file:py-2 file:px-4
//         file:rounded-lg file:border-0
//         file:text-sm file:font-semibold
//         file:bg-blue-600 file:text-white
//         hover:file:bg-blue-700
//         file:disabled:opacity-50 file:disabled:pointer-events-none
//         dark:text-neutral-500
//         dark:file:bg-blue-500
//         dark:hover:file:bg-blue-400 mt-6"
//         required/>
//         </div>
//         <div className="mx-16"></div>
//         <div>
//           <img src={nuevoCiudadano.url_foto_ine1} alt="INE Frente" className="w-auto h-64 object-cover rounded-lg m-auto" />
//           <input type="file" onChange={(e) => handleFileUpload(e, "url_foto_ine1")} class="block w-full text-sm text-gray-500
//         file:me-4 file:py-2 file:px-4
//         file:rounded-lg file:border-0
//         file:text-sm file:font-semibold
//         file:bg-blue-600 file:text-white
//         hover:file:bg-blue-700
//         file:disabled:opacity-50 file:disabled:pointer-events-none
//         dark:text-neutral-500
//         dark:file:bg-blue-500
//         dark:hover:file:bg-blue-400 mt-6" 
//         required/>
       
       
//         </div>
//         <div className="mx-16"></div>
//         <div>
//           <img src={nuevoCiudadano.url_foto_ine2} alt="INE Reverso" className="w-auto h-64 object-cover rounded-lg m-auto" />
//           <input type="file" onChange={(e) => handleFileUpload(e, "url_foto_ine2")} class="block w-full text-sm text-gray-500
//         file:me-4 file:py-2 file:px-4
//         file:rounded-lg file:border-0
//         file:text-sm file:font-semibold
//         file:bg-blue-600 file:text-white
//         hover:file:bg-blue-700
//         file:disabled:opacity-50 file:disabled:pointer-events-none
//         dark:text-neutral-500
//         dark:file:bg-blue-500
//         dark:hover:file:bg-blue-400 mt-6"
//         required />
//         </div>
//       </div>
//       <div className="border p-2 w-full" >
        
        
        


//       </div>
//     </div>
//       <div>

//       {loading && <p>Cargando...</p>}
      
    
//       <label>
//           Sección:
//           <select 
//           value={seccion} 
//           onChange={(e) => setSeccion(e.target.value)}
//           className="border p-2 w-full">
//             <option value="">Todas</option>
//             {opciones.secciones.map((sec) => (
//               <option key={sec} value={sec}>
//                 {sec}
//               </option>
//             ))}
//           </select>
//         </label>
//       {ubts.length > 0 && (
//         <div>
//           <label >UBT:</label>
//           <select id="ubt" 
//           // onChange={(e) => setUbt(e.target.value)}
//           onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, ubt: e.target.value })}
//           className="border p-2 w-full" required>
//             <option value="">Seleccionar UBT</option>
//             {ubts.map((ubt, index) => (
//               <option key={index} value={ubt}>
//                 {ubt}
//               </option>
//             ))}
//           </select>
//         </div>
//       )}
//     </div>
//         {/* <label>UBT: <input type="text" value={nuevoCiudadano.ubt} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, ubt: e.target.value })} className="border p-2 w-full" required/></label> */}
        
//        {/* Selector de Puesto */}
//         <div>
//           <label className="block text-sm font-medium">PUESTO</label>
//           <select
//             value={nuevoCiudadano.puesto}
//             onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, puesto: e.target.value })}
//             className="w-full border rounded-lg p-2"
//             required
//           >
//             <option value="">Selecciona un puesto</option>
//             <option value="SM">SM</option>
//             <option value="SECCIONAL">SECCIONAL</option>
//           </select>
//         </div>

//         {/* Usuario y contraseña solo si es SECCIONAL */}
//         {nuevoCiudadano.puesto === "SECCIONAL" && (
//           <>
//             <div>
//               <label className="block text-sm font-medium">Usuario</label>
//               <input
//                 type="text"
//                 value={nuevoCiudadano.usuario}
//                 onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, usuario: e.target.value.trim()})}
//                 className="w-full border rounded-lg p-2"
//                 required={puesto === "SECCIONAL"}
//               />
//             </div>


//             <div>
//               <label className="block text-sm font-medium">Contraseña</label>
//               <input
//                 type="password"
//                 value={nuevoCiudadano.password} 
//                 onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, password: e.target.value.trim() })}
//                 className="w-full border rounded-lg p-2"
//                 required={puesto === "SECCIONAL"}
//               />
//             </div>
//           <label>DEPENDENCIA: 
//           <select id="dependen"
//           value={nuevoCiudadano.dependencia} 
//           onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, dependencia: e.target.value })} 
//           className="border p-2 w-full" required>
//             <option>Selecionar</option>
//             {dependencias.map((dep, index) => (
//               <option key={index} value={dep}>
//                 {dep}
//               </option>
//             ))}
//           </select>
//           </label>
//           <label>AREA: <input type="text" value={nuevoCiudadano.area_adscripcion} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, area_adscripcion: e.target.value.toUpperCase() })} className="border p-2 w-full" required/></label>
        
//          </>
//         )}

        
        
//         {/* <label>
//           Puesto:
//           <select 
//           value={nuevoCiudadano.puesto} 
//           // onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, puesto: e.target.value })}
//           onChange={(e) => {
//             const selectedPuesto = e.target.value;
//             const puestoData = puestos.find((p) => p.puesto === selectedPuesto);
//             // puestos.filter(pues => p)
//             // const puestoDataId = puestos.find((p.id_puesto) => p.puesto === selectedPuesto);
//             setNuevoCiudadano((prev) => ({
//               ...prev,
//               puesto: selectedPuesto,
//               id_puesto: puestoData ? puestoData.id_puesto : 0,
//             }));
//           }}
//           className="border p-2 w-full" required>
//             <option value="" >Todos</option>
//             {puestos.map((pues, index) => (
//               <option key={index} value={pues}>
//                 {pues}
//               </option>
//             ))}
//           </select>
//         </label> */}
        
        
//         {/* <label>PUESTO: <input type="text" value={nuevoCiudadano.puesto} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, puesto: e.target.value })} className="border p-2 w-full" required/></label>
//         <label>ID PUESTO: <input type="number" value={nuevoCiudadano.id_puesto} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, id_puesto: e.target.value })} className="border p-2 w-full" required/></label> */}
        
        
        
        
        
//         {/* <label>TIPO: <input type="text" value={nuevoCiudadano.tipo} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, tipo: e.target.value })} className="border p-2 w-full" required/></label> */}
//         <label>INGRESO A LA ESTRUCTURA: <input type="date" value={nuevoCiudadano.ingreso_estructura} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, ingreso_estructura: e.target.value })} className="border p-2 w-full" required/></label>
//         <label>OBSERVACIONES: <input type="text" value={nuevoCiudadano.observaciones} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, observaciones: e.target.value.toUpperCase() })} className="border p-2 w-full" required/></label>
//         {/* <label>Usuario: <input type="text" value={nuevoCiudadano.usuario} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, usuario: e.target.value.trim()})} className="border p-2 w-full" required/></label>
//         <label>Contraseña: <input type="text" value={nuevoCiudadano.password} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, password: e.target.value.trim() })} className="border p-2 w-full" required/></label> */}
        
        
//         <label>Nombre: <input type="text" value={nuevoCiudadano.nombre} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, nombre: e.target.value.toUpperCase() })} className="border p-2 w-full" required/></label>
//         <label>Apellido Paterno: <input type="text" value={nuevoCiudadano.a_paterno} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, a_paterno: e.target.value.toUpperCase() })} className="border p-2 w-full" required/></label>
//         <label>Apellido Materno: <input type="text" value={nuevoCiudadano.a_materno} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, a_materno: e.target.value.toUpperCase() })} className="border p-2 w-full" required/></label>
//         <label>CURP: <input type="text" value={nuevoCiudadano.curp} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, curp: e.target.value.trim().toUpperCase() })} className="border p-2 w-full" required/></label>
//         <label>Calle: <input type="text" value={nuevoCiudadano.calle} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, calle: e.target.value.toUpperCase() })} className="border p-2 w-full" required/></label>
//         <label>N° Ext (MZ): <input type="text" value={nuevoCiudadano.n_ext_mz} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, n_ext_mz: e.target.value.toUpperCase() })} className="border p-2 w-full" required/></label>
//         <label>N° Int (LT): <input type="text" value={nuevoCiudadano.n_int_lt} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, n_int_lt: e.target.value.toUpperCase() })} className="border p-2 w-full" required/></label>
//         <label>N° Casa: <input type="text" value={nuevoCiudadano.n_casa} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, n_casa: e.target.value.toUpperCase() })} className="border p-2 w-full" required/></label>
//         <label>Código Postal: <input type="number" value={nuevoCiudadano.c_p} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, c_p: e.target.value})} className="border p-2 w-full" required/></label>
//         <label>Colonia: <input type="text" value={nuevoCiudadano.col_loc} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, col_loc: e.target.value})} className="border p-2 w-full" required/></label>
//         <label>Teléfono 1: <input type="text" value={nuevoCiudadano.telefono_1} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, telefono_1: e.target.value })} className="border p-2 w-full" required/></label>
//         <label>Teléfono 2: <input type="text" value={nuevoCiudadano.telefono_2} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, telefono_2: e.target.value })} className="border p-2 w-full" required/></label>
//         <label>INSTAGRAM: <input type="text" value={nuevoCiudadano.cuenta_inst} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, cuenta_inst: e.target.value })} className="border p-2 w-full" required/></label>
//         <label>FACEBOOK 1: <input type="text" value={nuevoCiudadano.cuenta_fb} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, cuenta_fb: e.target.value })} className="border p-2 w-full" required/></label>
//         <label>X: <input type="text" value={nuevoCiudadano.cuenta_x} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, cuenta_x: e.target.value })} className="border p-2 w-full" required/></label>
        
        
        
//         <button /*onClick={handleAdd}*/ type="submit" className="bg-green-500 text-white px-4 py-2 rounded">Guardar</button>
//         </form>
//         <button onClick={() => navigate("/")} className="bg-gray-500 text-white px-4 py-2 rounded">Cancelar</button>
//       </div>
//     </div>
//   );
// }
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import supabase, { supabaseStorage } from "../supabase/client";
import MapTerritorial from "../map/MapTerritorial";
import { changedCitizenFields, validateSmAssignment, SM_ASSIGNMENT_FIELDS } from "../utils/smAssignment";
import { SMField as Field, SMSectionTitle, HomeLocationNote, SMSaveConfirmation } from '../componentes/SMFormUI';
import { FiArrowLeft, FiGrid, FiMapPin, FiUpload, FiSave } from 'react-icons/fi';

const fieldClass = 'sm-control';

const fotoLabels = {
  url_foto_perfil: "Foto de perfil",
  url_foto_ine1:   "INE frente",
  url_foto_ine2:   "INE reverso",
};

export default function AgregarCiudadanoCP() {
  const navigate = useNavigate();
  const { state } = useLocation();
  const [user] = useState(() => {
    try { return state?.user || JSON.parse(sessionStorage.getItem('user')); }
    catch { return null; }
  });

  // ================= ESTADOS PRINCIPALES =================
  const [step, setStep] = useState(1); // ✅ Paso 1: Validar CURP | Paso 2: Datos + Fotos
  const [loading, setLoading] = useState(false);
  const [catalogo, setCatalogo] = useState([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [catalogError, setCatalogError] = useState('');
  const [existingCitizen, setExistingCitizen] = useState(null);
  const [validatedCurp, setValidatedCurp] = useState('');
  const [uploading, setUploading] = useState({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [seccionGeoAlta, setSeccionGeoAlta] = useState(null);
  const [fraccionesAlta, setFraccionesAlta] = useState([]);
  const [nuevoCiudadano, setNuevoCiudadano] = useState({
    curp: "",
    nombre: "",
    a_paterno: "",
    a_materno: "",
    calle: "",
    n_ext_mz: "",
    n_int_lt: "",
    n_casa: "",
    c_p: "",
    col_loc: "",
    latitud: null,
    longitud: null,
    telefono_1: "",
    telefono_2: "",
    cuenta_inst: "",
    cuenta_fb: "",
    cuenta_x: "",
    seccion: "",
    ubt: "",
    poligono: "",
    municipio: "",
    dtto_fed: 0,
    dtto_loc: 0,
    puesto: "SM",
    usuario: "",
    password: "",
    dependencia: "",
    area_adscripcion: "",
    ingreso_estructura: new Date().toISOString(),
    observaciones: "",
    status: "SOLICITUD DE ALTA",
    url_foto_perfil: "",
    url_foto_ine1: "",
    url_foto_ine2: "",
  });

  // ================= VALIDACIÓN CURP =================
  const CURP_REGEX =
    /^[A-Z]{1}[AEIOU]{1}[A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HM]{1}[A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]{1}\d{1}$/;

  // const validarCurp = async () => {
  //   const curp = nuevoCiudadano.curp.trim().toUpperCase();
  //   if (!CURP_REGEX.test(curp)) {
  //     alert("El CURP ingresado no es válido.");
  //     return;
  //   }

  //   setLoading(true);
  //   try {
  //     // ✅ Buscar si ya existe en Supabase
  //     const { data, error } = await supabase
  //       .from("ciudadania")
  //       .select("*")
  //       .eq("poligono", user?.poligono || "")
  //       .eq("curp", curp)
  //       .single();

  //     if (error && error.code !== "PGRST116") throw error;

  //     if (data) {
  //       // ✅ CURP EXISTE: Autocompletar datos
  //       alert("CURP encontrado, los datos serán autocompletados.");
  //       setNuevoCiudadano((prev) => ({ ...prev, ...data }));
  //     } else {
  //       alert("CURP válido, ingresa los datos del ciudadano.");
  //     }

  //     // ✅ Pasar al siguiente paso
  //     setStep(2);
  //   } catch (err) {
  //     console.error("Error al validar CURP:", err);
  //     alert("Error al validar CURP.");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

  const validarCurp = async () => {
  const curp = nuevoCiudadano.curp.trim().toUpperCase();
  if (loading) return;
  if (user?.puesto?.toUpperCase() !== 'SP' || !user?.poligono) {
    alert('No se encontró el sector del SP. Ingresa de nuevo desde tu panel.');
    return;
  }
  if (!CURP_REGEX.test(curp)) {
    alert("El CURP ingresado no es válido.");
    return;
  }

  setLoading(true);
  try {
    // Buscar globalmente evita sobrescribir por CURP un registro de otro sector.
    const { data, error } = await supabase
      .from("ciudadania")
      .select("*")
      .eq("curp", curp)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      const role = data.puesto?.toUpperCase();
      if (!['SM', 'BENEFICIARIO'].includes(role) ||
          (data.poligono != null && data.poligono !== '' && String(data.poligono) !== String(user.poligono))) {
        alert('Este CURP ya tiene otro cargo o pertenece a otro sector. Solicita su revisión al administrador.');
        return;
      }
      // Consultar no cambia el estatus ni guarda nada. Una SM activa se edita en su ficha.
      if (role === 'SM' && data.status === 'ACTIVO') {
        navigate(`/ciudadano/${data.id}`);
        return;
      }
      alert("CURP encontrado, los datos serán autocompletados.");
      setNuevoCiudadano((prev) => ({ ...prev, ...data, curp, puesto: 'SM' }));
    } else {
      alert("CURP válido, ingresa los datos del ciudadano.");
      setNuevoCiudadano(prev => ({ ...prev, curp }));
    }
    setExistingCitizen(data || null);
    setValidatedCurp(curp);
    // ✅ Pasar al siguiente paso
    setStep(2);
  } catch (err) {
    console.error("Error al validar CURP:", err);
    alert("Error al validar CURP.");
  } finally {
    setLoading(false);
  }
};


  // ================= CARGAR SECCIONES (sector del coordinador) =================
  useEffect(() => {
    if (step !== 2) return;
    let cancelled = false;
    const pol = user?.poligono;
    if (!pol) return;
    setCatalogLoading(true);
    setCatalogError('');
    supabase.from("ubt_catalogo").select("*").eq("sector", pol).limit(10000)
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error || !data?.length) throw new Error('Catálogo no disponible');
        setCatalogo(data);
      }).catch(() => {
        if (!cancelled) setCatalogError('No se pudo cargar el catálogo de asignaciones. Vuelve a entrar al formulario antes de guardar.');
      }).finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => { cancelled = true; };
  }, [step, user?.poligono]);

  const secciones = [...new Set(catalogo.map(row => row.seccion).filter(Boolean))].sort((a, b) => a - b);
  const ubts = [...new Set(catalogo.filter(row => String(row.seccion) === String(nuevoCiudadano.seccion))
    .map(row => row.fraccion).filter(Boolean))].sort();

  // ================= CAMBIO DE SECCIÓN =================
  const handleSeccionChange = (sec) => {
    const info = catalogo.find(row => String(row.seccion) === String(sec));
    setNuevoCiudadano(prev => ({
      ...prev, seccion: sec, ubt: '',
      poligono: info?.sector ?? '', municipio: info?.municipio ?? '',
      nombre_municipio: info?.nombre_municipio ?? '',
      dtto_fed: info?.dtto_fed ?? '', dtto_loc: info?.dtto_loc ?? '',
    }));
  };

  // ================= GEOMETRÍA DE LA SECCIÓN SELECCIONADA =================
  useEffect(() => {
    let cancelled = false;
    setSeccionGeoAlta(null);
    setFraccionesAlta([]);
    if (!nuevoCiudadano.seccion) return;
    const seccionNum = Number(nuevoCiudadano.seccion);
    Promise.all([
      supabase.from("secciones").select("*").eq("seccion", seccionNum).maybeSingle(),
      supabase.from("fracciones").select("fraccion, seccion, geometry").eq("seccion", seccionNum),
    ]).then(([secRes, fracRes]) => {
      if (cancelled) return;
      setSeccionGeoAlta(secRes.data ?? null);
      setFraccionesAlta(fracRes.data ?? []);
    }).catch(() => { /* La geometría no determina la asignación ni el domicilio. */ });
    return () => { cancelled = true; };
  }, [nuevoCiudadano.seccion]);

  // ================= UBICACIÓN =================
  const handleObtenerUbicacion = () => {
    if (!navigator.geolocation) {
      alert("Geolocalización no disponible en este dispositivo.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setNuevoCiudadano((p) => ({
          ...p,
          latitud: position.coords.latitude,
          longitud: position.coords.longitude,
        }));
      },
      (error) => alert("Error al obtener ubicación: " + error.message)
    );
  };

  // ================= CARGAR IMÁGENES =================
  async function handleFileUpload(event, fieldName) {
    const input = event.target;
    const file = input.files[0];
    if (!file || loading || uploading[fieldName]) return;
    const curp = nuevoCiudadano.curp.trim().toUpperCase();
    if (!curp) return alert("Ingresa el CURP antes de subir fotos.");
    const filePath = `ciudadanos/${fieldName}-${curp}`;
    setUploading(prev => ({ ...prev, [fieldName]: true }));
    try {
      const { error } = await supabaseStorage.storage
        .from("fotos_estructura")
        .upload(filePath, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabaseStorage.storage.from("fotos_estructura").getPublicUrl(filePath);
      setNuevoCiudadano((p) => ({ ...p, [fieldName]: `${urlData.publicUrl}?t=${Date.now()}` }));
    } catch (error) {
      input.value = '';
      alert('Error subiendo imagen: ' + error.message);
    } finally {
      setUploading(prev => ({ ...prev, [fieldName]: false }));
    }
  }

  // ================= GUARDAR REGISTRO =================
  // const handleSubmit = async (e) => {
  //   e.preventDefault();
  //   setLoading(true);
  //   try {
  //     if (nuevoCiudadano.puesto === "SM") {
  //       nuevoCiudadano.usuario = nuevoCiudadano.curp;
  //       nuevoCiudadano.password = nuevoCiudadano.curp;
  //     }
  //     const { error } = await supabase
  //       .from("ciudadania")
  //       .upsert([nuevoCiudadano], { onConflict: "curp" });
  //     if (error) throw error;
  //     alert("Ciudadano guardado correctamente.");
  //     navigate(-1);
  //   } catch (err) {
  //     console.error("Error al guardar:", err);
  //     alert("Error al guardar los datos.");
  //   } finally {
  //     setLoading(false);
  //   }
  // };

const handleSubmit = async (e, confirmed = false) => {
  e?.preventDefault();
  if (loading || Object.values(uploading).some(Boolean)) return;
  if (!validatedCurp || nuevoCiudadano.curp !== validatedCurp) {
    alert('Valida nuevamente el CURP antes de guardar.');
    return;
  }
  const validationError = catalogLoading ? 'Espera a que cargue el catálogo de asignaciones.'
    : catalogError || validateSmAssignment(nuevoCiudadano, catalogo, user?.poligono);
  if (validationError) { alert(validationError); return; }
  if (['url_foto_perfil', 'url_foto_ine1', 'url_foto_ine2'].some(field => !nuevoCiudadano[field])) {
    alert('Espera a que las tres fotografías se carguen correctamente antes de enviar el registro.');
    return;
  }
  if (!confirmed) { setConfirmOpen(true); return; }
  setLoading(true);
  try {
    // Limpiar parámetros de cache-busting de las URLs antes de guardar
    const cleanPhoto = field => {
      const url = nuevoCiudadano[field];
      if (existingCitizen && url === existingCitizen[field]) return url;
      return url ? url.split('?')[0] : url || null;
    };

    const dataToSave = {
      ...nuevoCiudadano,
      puesto: 'SM',
      status: "SOLICITUD DE ALTA",
      usuario: existingCitizen?.usuario || validatedCurp,
      password: existingCitizen?.password || validatedCurp,
      // URLs limpias para persistencia confiable en DB
      url_foto_perfil: cleanPhoto('url_foto_perfil'),
      url_foto_ine1:   cleanPhoto('url_foto_ine1'),
      url_foto_ine2:   cleanPhoto('url_foto_ine2'),
    };

    // Un alta inserta; una conversión solo actualiza el registro validado por ID.
    const { id, ...dataSinId } = dataToSave;
    let query;
    if (existingCitizen) {
      const changes = changedCitizenFields(existingCitizen, dataSinId);
      if (!Object.keys(changes).length) { alert('No hay cambios para guardar.'); return; }
      query = supabaseStorage.from('ciudadania').update(changes)
        .eq('id', existingCitizen.id).eq('curp', validatedCurp).eq('puesto', existingCitizen.puesto);
      // No sobrescribir una asignación o activación hecha después de validar el CURP.
      [...SM_ASSIGNMENT_FIELDS, 'status'].forEach(field => {
        query = existingCitizen[field] == null ? query.is(field, null) : query.eq(field, existingCitizen[field]);
      });
    } else {
      query = supabaseStorage.from('ciudadania').insert([dataSinId]);
    }
    const { data, error } = await query.select('id').maybeSingle();
    if (error) throw error;
    if (!data) throw new Error('El registro cambió. Vuelve a validar el CURP antes de guardar.');

    alert("Ciudadano guardado correctamente con estatus 'SOLICITUD DE ALTA'.");
    navigate(-1);
  } catch (err) {
    console.error("Error al guardar:", err);
    alert("Error al guardar los datos: " + err.message);
  } finally {
    setLoading(false);
    setConfirmOpen(false);
  }
};



  // ==================== RENDER ====================
  return (
    <div className="sm-form-theme sm-form-page">
      {/* Header */}
      <header className="sm-form-header">
        <div className="sm-form-header-inner">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="sm-back"
            aria-label="Regresar al panel"
          >
            <FiArrowLeft aria-hidden="true" />
          </button>
          <div>
            <p className="sm-eyebrow">Estructura territorial · Sector {user?.poligono || '—'}</p>
            <h1>Alta de SM</h1>
          </div>
        </div>
      </header>

      <main className="sm-form-main">
        <div className="sm-step-track" aria-label="Etapas del registro">
          <span aria-current={step === 1 ? 'step' : undefined}><b>01</b> Validar CURP</span>
          <span aria-current={step === 2 ? 'step' : undefined}><b>02</b> Completar registro</span>
        </div>

        {/* ── PASO 1: CURP ── */}
        {step === 1 && (
          <div className="sm-form-card sm-curp-card">
            <SMSectionTitle hint="Primero revisaremos si la persona ya tiene un registro para recuperar sus datos.">Comienza con su CURP</SMSectionTitle>
            <Field label="CURP" hint="18 caracteres. Ten a la mano sus datos y fotografías.">
              <input
                type="text"
                value={nuevoCiudadano.curp}
                onChange={(e) =>
                  setNuevoCiudadano({ ...nuevoCiudadano, curp: e.target.value.trim().toUpperCase() })
                }
                className={`${fieldClass} sm-control-curp`}
                placeholder="Ingresa el CURP"
                maxLength={18}
              />
            </Field>
            <button
              onClick={validarCurp}
              disabled={loading}
              className="sm-button sm-button-primary"
            >
              {loading && <span className="sm-spinner" aria-hidden="true" />}{loading ? "Validando..." : "Validar CURP"}
            </button>
          </div>
        )}

        {/* ── PASO 2: FORMULARIO COMPLETO ── */}
        {step === 2 && (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="sm-form-intro">
              <div><h2>Completa el registro</h2><p>Asigna su fracción de trabajo y ubica su domicilio.</p></div>
              <p><span className="sm-required">*</span> Campos obligatorios</p>
            </div>

            {/* Fotos */}
            <div className="sm-form-card">
              <SMSectionTitle hint="Agrega imágenes claras de la persona y ambos lados de su INE.">Fotografías</SMSectionTitle>
              <div className="sm-photo-grid">
                {["url_foto_perfil", "url_foto_ine1", "url_foto_ine2"].map((f) => (
                  <div key={f} className="sm-photo-slot">
                    <p>{fotoLabels[f]}</p>
                    {nuevoCiudadano[f] ? <img
                      src={nuevoCiudadano[f]}
                      alt={fotoLabels[f]}
                      className="sm-photo-preview"
                    /> : <div className="sm-photo-preview"><span className="sm-photo-placeholder"><FiUpload aria-hidden="true" />Sin imagen</span></div>}
                    <input
                      type="file"
                      aria-label={fotoLabels[f]}
                      disabled={loading || uploading[f]}
                      onChange={(e) => handleFileUpload(e, f)}
                      className="sm-file-input"
                      required={!nuevoCiudadano[f]}
                    />
                  </div>
                ))}
              </div>
            </div>

            {/* Territorio */}
            <div className="sm-form-card space-y-4">
              <SMSectionTitle>Dónde trabaja</SMSectionTitle>
              <div className="sm-assignment-note"><FiGrid aria-hidden="true" /><p>La <strong>Fracción (UBT)</strong> es su asignación de trabajo. Puede ser distinta al lugar donde vive.</p></div>
              {catalogLoading && <p role="status" className="text-xs text-slate-500">Cargando asignaciones…</p>}
              {catalogError && <p role="alert" className="text-xs text-amber-700">{catalogError}</p>}
              <div className="sm-form-grid">
              <Field label="Sección">
                <select
                  value={nuevoCiudadano.seccion}
                  onChange={(e) => handleSeccionChange(e.target.value)}
                  className={fieldClass}
                  disabled={catalogLoading || Boolean(catalogError) || loading}
                  required
                >
                  <option value="">Seleccionar</option>
                  {secciones.map((sec) => <option key={sec} value={sec}>{sec}</option>)}
                </select>
              </Field>
                <Field label="Fracción (UBT)">
                  <select
                    value={nuevoCiudadano.ubt}
                    onChange={(e) => setNuevoCiudadano((p) => ({ ...p, ubt: e.target.value }))}
                    className={fieldClass}
                    disabled={!nuevoCiudadano.seccion || catalogLoading || Boolean(catalogError) || loading}
                    required
                  >
                    <option value="">Seleccionar</option>
                    {ubts.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </Field>
              </div>
              <Field label="Puesto">
                <p className="text-sm font-semibold text-[#7b1528]">SM</p>
              </Field>
            </div>

            {/* Datos personales */}
            <div className="sm-form-card space-y-4">
              <SMSectionTitle>Datos personales</SMSectionTitle>
              <Field label="Nombre">
                <input type="text" value={nuevoCiudadano.nombre} onChange={(e) => setNuevoCiudadano((p) => ({ ...p, nombre: e.target.value.toUpperCase() }))} className={fieldClass} required />
              </Field>
              <div className="sm-form-grid">
                <Field label="Apellido paterno">
                  <input type="text" value={nuevoCiudadano.a_paterno} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, a_paterno: e.target.value.toUpperCase() })} className={fieldClass} required />
                </Field>
                <Field label="Apellido materno">
                  <input type="text" value={nuevoCiudadano.a_materno} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, a_materno: e.target.value.toUpperCase() })} className={fieldClass} required />
                </Field>
              </div>
              <Field label="CURP" hint="CURP validada al iniciar el registro.">
                <input type="text" value={nuevoCiudadano.curp} readOnly className={`${fieldClass} bg-slate-50`} required />
              </Field>
            </div>

            {/* Domicilio */}
            <div className="sm-form-card space-y-4">
              <SMSectionTitle hint="Captura la dirección donde vive la persona.">Dónde vive</SMSectionTitle>
              <Field label="Calle">
                <input type="text" value={nuevoCiudadano.calle} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, calle: e.target.value.toUpperCase() })} className={fieldClass} required />
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="N° Ext (MZ)">
                  <input type="text" value={nuevoCiudadano.n_ext_mz} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, n_ext_mz: e.target.value.toUpperCase() })} className={fieldClass} required />
                </Field>
                <Field label="N° Int (LT)">
                  <input type="text" value={nuevoCiudadano.n_int_lt} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, n_int_lt: e.target.value.toUpperCase() })} className={fieldClass} />
                </Field>
                <Field label="N° Casa">
                  <input type="text" value={nuevoCiudadano.n_casa} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, n_casa: e.target.value.toUpperCase() })} className={fieldClass} />
                </Field>
              </div>
              <div className="sm-form-grid">
                <Field label="Código postal">
                  <input type="number" value={nuevoCiudadano.c_p} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, c_p: e.target.value })} className={fieldClass} required />
                </Field>
                <Field label="Colonia">
                  <input type="text" value={nuevoCiudadano.col_loc} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, col_loc: e.target.value })} className={fieldClass} required />
                </Field>
              </div>
            </div>

            {/* Mapa */}
            <div className="sm-form-card">
              <SMSectionTitle hint="Aquí marcas dónde vive la SM. Puede vivir fuera de la fracción donde trabaja.">Domicilio en el mapa</SMSectionTitle>
              <HomeLocationNote citizen={nuevoCiudadano} />
              <div className="sm-location-map">
                <MapTerritorial
                  locationOnly
                  secciones={seccionGeoAlta ? [seccionGeoAlta] : []}
                  fraccionesGeo={fraccionesAlta}
                  selectedSeccion={seccionGeoAlta?.seccion}
                  editableLocation={
                    nuevoCiudadano.latitud && nuevoCiudadano.longitud
                      ? { lat: Number(nuevoCiudadano.latitud), lng: Number(nuevoCiudadano.longitud) }
                      : null
                  }
                  onEditableLocationChange={(lat, lng) =>
                    setNuevoCiudadano((p) => ({ ...p, latitud: lat, longitud: lng }))
                  }
                />
              </div>
              <div className="sm-location-actions"><button
                type="button"
                onClick={handleObtenerUbicacion}
                className="sm-button sm-button-secondary"
              >
                <FiMapPin aria-hidden="true" /> Usar mi ubicación actual
              </button>
              <p>Úsala si estás en el domicilio de la SM. Si estás en la oficina, busca su dirección en el mapa.</p></div>
            </div>

            {/* Contacto */}
            <div className="sm-form-card space-y-4">
              <SMSectionTitle>Contacto y redes sociales</SMSectionTitle>
              <div className="sm-form-grid">
                <Field label="Teléfono 1">
                  <input type="text" value={nuevoCiudadano.telefono_1} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, telefono_1: e.target.value })} className={fieldClass} required />
                </Field>
                <Field label="Teléfono 2">
                  <input type="text" value={nuevoCiudadano.telefono_2} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, telefono_2: e.target.value })} className={fieldClass} />
                </Field>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Instagram">
                  <input type="text" value={nuevoCiudadano.cuenta_inst} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, cuenta_inst: e.target.value })} className={fieldClass} />
                </Field>
                <Field label="Facebook">
                  <input type="text" value={nuevoCiudadano.cuenta_fb} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, cuenta_fb: e.target.value })} className={fieldClass} />
                </Field>
                <Field label="X">
                  <input type="text" value={nuevoCiudadano.cuenta_x} onChange={(e) => setNuevoCiudadano({ ...nuevoCiudadano, cuenta_x: e.target.value })} className={fieldClass} />
                </Field>
              </div>
            </div>

            {/* Guardar */}
            <div className="sm-form-savebar">
            <p><strong>Revisa antes de enviar</strong>Confirmarás los datos en el siguiente paso.</p>
            <button
              type="submit"
              disabled={loading || catalogLoading || Boolean(catalogError) || Object.values(uploading).some(Boolean)}
              className="sm-button sm-button-primary"
            >
              {loading ? <span className="sm-spinner" aria-hidden="true" /> : <FiSave aria-hidden="true" />}{loading ? "Guardando..." : "Guardar solicitud de alta"}
            </button>
            </div>
          </form>
        )}
      </main>
      <SMSaveConfirmation open={confirmOpen} onClose={() => setConfirmOpen(false)}
        onConfirm={() => handleSubmit(null, true)} busy={loading} citizen={nuevoCiudadano} />
    </div>
  );
}
