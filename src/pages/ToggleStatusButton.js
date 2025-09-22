// // import React, { useState } from 'react';
// // import supabase from '../supabase/client';

// // const ToggleStatusButton = ({ registroId, initialStatus }) => {
// //   const [status, setStatus] = useState(initialStatus);
// //   const [loading, setLoading] = useState(false);

// //   const toggleStatus = async () => {
// //     setLoading(true);

// //     // Determina el nuevo status
// //     const nuevoStatus = status === 'ACTIVO' ? 'ELIMINADO' : 'ACTIVO';

// //     try {
// //       // Actualiza el status en Supabase
// //       const { data, error } = await supabase
// //         .from('ciudadania') // Cambia por el nombre de tu tabla
// //         .update({ status: nuevoStatus })
// //         .eq('id', registroId); // Cambia 'id' por el nombre de tu clave primaria

// //       if (error) {
// //         console.error('Error al actualizar el status:', error);
// //       } else {
// //         setStatus(nuevoStatus); // Actualiza el estado local si fue exitoso
// //       }
// //     } catch (error) {
// //       console.error('Error:', error.message);
// //     }

// //     setLoading(false);
// //   };

// //   return (
// //     <button class="text-white bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-4 focus:ring-red-300 font-medium rounded-full text-sm px-5 py-2.5 text-center me-2 mb-2 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-900" 
// //     onClick={toggleStatus} disabled={loading}>
// //       {loading ? 'Cargando...' : `${status === 'ACTIVO' ? 'ELIMINAR' : 'ACTIVAR'}`}
// //     </button>
// //   );
// // };

// // export default ToggleStatusButton;


import React, { useState } from "react";
import supabase from "../supabase/client";

const ToggleStatusButton = ({ registroId, initialStatus }) => {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

    const updateStatus = async (nuevoStatus) => {
    const confirmMsg =
      nuevoStatus === "ACTIVO"
        ? "¿Aprobar alta?"
        : nuevoStatus === "ELIMINADO"
        ? "¿Aprobar baja?"
        : nuevoStatus === "RECHAZADA"
        ? "¿Rechazar solicitud?"
        : null;

    if (confirmMsg && !window.confirm(confirmMsg)) return;

    setLoading(true);
    try {
      const { error } = await supabase
        .from("ciudadania")
        .update({ status: nuevoStatus })
        .eq("id", registroId);

      if (error) {
        alert("Error al actualizar el estado");
        console.error(error);
      } else {
        setStatus(nuevoStatus);
      }
    } catch (error) {
      alert("Error inesperado");
      console.error(error);
    }
    setLoading(false);
  };

  const getNextAction = () => {
    switch (status) {
      case "ACTIVO":
        return { label: "SOLICITAR BAJA", next: "SOLICITAR BAJA" };
      // case "SOLICITAR BAJA":
      //   return { label: "APROBAR BAJA", next: "ELIMINADO" };
      case "SOLICITAR BAJA":
            return (
              <div className="flex gap-2">
                <button
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full"
                  onClick={() => updateStatus("ELIMINADO")}
                  disabled={loading}
                >
                  {loading ? "Cargando..." : "Aprobar Baja"}
                </button>
                <button
                  className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full"
                  onClick={() => updateStatus("RECHAZADA")}
                  disabled={loading}
                >
                  {loading ? "Cargando..." : "Rechazar"}
                </button>
              </div>
            );
      case "ELIMINADO":
        return { label: "SOLICITAR ALTA", next: "SOLICITAR ALTA" };
      case "SOLICITUD DE ALTA":
        return { label: "APROBAR ALTA", next: "ACTIVO" };
      case "RECHAZADA":
        return { label: "ACTIVAR", next: "ACTIVO" };
      default:
        return { label: "DESCONOCIDO", next: null };
    }
  };

  const handleClick = async () => {
    
    const action = getNextAction();
    if (!action.next) return;

    setLoading(true);

    try {
      const { error } = await supabase
        .from("ciudadania")
        .update({ status: action.next })
        .eq("id", registroId);

      if (error) {
        console.error("Error al actualizar el status:", error);
      } else {
        setStatus(action.next);
      }
    } catch (error) {
      console.error("Error:", error.message);
    }

    setLoading(false);
  };

  const action = getNextAction();

  return (
    <button
      className="text-white bg-blue-700 hover:bg-blue-800 focus:outline-none 
                 focus:ring-4 focus:ring-blue-300 font-medium rounded-full 
                 text-sm px-5 py-2.5 text-center me-2 mb-2 
                 dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-900"
      onClick={handleClick}
      disabled={loading || !action.next}
    >
      {loading ? "Cargando..." : action.label}
    </button>
  );
};

export default ToggleStatusButton;


// import React, { useState } from "react";
// import supabase from "../supabase/client";

// const ToggleStatusButton = ({ registroId, initialStatus }) => {
//   const [status, setStatus] = useState(initialStatus);
//   const [loading, setLoading] = useState(false);

//   const updateStatus = async (nuevoStatus) => {
//     const confirmMsg =
//       nuevoStatus === "ACTIVO"
//         ? "¿Aprobar alta?"
//         : nuevoStatus === "ELIMINADO"
//         ? "¿Aprobar baja?"
//         : nuevoStatus === "RECHAZADA"
//         ? "¿Rechazar solicitud?"
//         : null;

//     if (confirmMsg && !window.confirm(confirmMsg)) return;

//     setLoading(true);
//     try {
//       const { error } = await supabase
//         .from("ciudadania")
//         .update({ status: nuevoStatus })
//         .eq("id", registroId);

//       if (error) {
//         alert("Error al actualizar el estado");
//         console.error(error);
//       } else {
//         setStatus(nuevoStatus);
//       }
//     } catch (error) {
//       alert("Error inesperado");
//       console.error(error);
//     }
//     setLoading(false);
//   };

//   // Render según el estado actual

  
//   const renderButtons = () => {
//         switch (status) {
//       case "ACTIVO":
//         return { label: "SOLICITAR BAJA", next: "SOLICITAR BAJA" };
//       case "SOLICITAR BAJA":
//             return (
//               <div className="flex gap-2">
//                 <button
//                   className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full"
//                   onClick={() => updateStatus("ELIMINADO")}
//                   disabled={loading}
//                 >
//                   {loading ? "Cargando..." : "Aprobar Baja"}
//                 </button>
//                 <button
//                   className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full"
//                   onClick={() => updateStatus("RECHAZADA")}
//                   disabled={loading}
//                 >
//                   {loading ? "Cargando..." : "Rechazar"}
//                 </button>
//               </div>
//             );
//       case "ELIMINADO":
//         return { label: "SOLICITAR ALTA", next: "SOLICITAR ALTA" };
//       case "SOLICITUD DE ALTA":
//         return { label: "APROBAR ALTA", next: "ACTIVO" };
//       case "RECHAZADA":
//         return { label: "ACTIVAR", next: "ACTIVO" };
//       default:
//         return { label: "DESCONOCIDO", next: null };
//     }
    

//     if (status === "SOLICITAR ALTA") {
//       return (
//         <div className="flex gap-2">
//           <button
//             className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-full"
//             onClick={() => updateStatus("ACTIVO")}
//             disabled={loading}
//           >
//             {loading ? "Cargando..." : "Aprobar Alta"}
//           </button>
//           <button
//             className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-full"
//             onClick={() => updateStatus("RECHAZADA")}
//             disabled={loading}
//           >
//             {loading ? "Cargando..." : "Rechazar"}
//           </button>
//         </div>
//       );
    
//   }
//     // Estados finales o sin solicitud
//     const colorMap = {
//       ACTIVO: "bg-green-600",
//       ELIMINADO: "bg-gray-600",
//       RECHAZADA: "bg-red-600",
//     };

//     return (
//       <span
//         className={`px-4 py-2 rounded-full text-white ${
//           colorMap[status] || "bg-blue-600"
//         }`}
//       >
//         {status}
//       </span>
//     );
//   };

//   return <>{renderButtons()}</>;
// };

// export default ToggleStatusButton;

