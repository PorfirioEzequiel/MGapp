// import React, { useState } from 'react';
// import supabase from '../supabase/client';

// const ToggleStatusButton = ({ registroId, initialStatus }) => {
//   const [status, setStatus] = useState(initialStatus);
//   const [loading, setLoading] = useState(false);

//   const toggleStatus = async () => {
//     setLoading(true);

//     // Determina el nuevo status
//     const nuevoStatus = status === 'ACTIVO' ? 'ELIMINADO' : 'ACTIVO';

//     try {
//       // Actualiza el status en Supabase
//       const { data, error } = await supabase
//         .from('ciudadania') // Cambia por el nombre de tu tabla
//         .update({ status: nuevoStatus })
//         .eq('id', registroId); // Cambia 'id' por el nombre de tu clave primaria

//       if (error) {
//         console.error('Error al actualizar el status:', error);
//       } else {
//         setStatus(nuevoStatus); // Actualiza el estado local si fue exitoso
//       }
//     } catch (error) {
//       console.error('Error:', error.message);
//     }

//     setLoading(false);
//   };

//   return (
//     <button class="text-white bg-red-700 hover:bg-red-800 focus:outline-none focus:ring-4 focus:ring-red-300 font-medium rounded-full text-sm px-5 py-2.5 text-center me-2 mb-2 dark:bg-red-600 dark:hover:bg-red-700 dark:focus:ring-red-900" 
//     onClick={toggleStatus} disabled={loading}>
//       {loading ? 'Cargando...' : `${status === 'ACTIVO' ? 'ELIMINAR' : 'ACTIVAR'}`}
//     </button>
//   );
// };

// export default ToggleStatusButton;


import React, { useState } from 'react';
import supabase from '../supabase/client';

const ToggleStatusButton = ({ registroId, initialStatus }) => {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

  const getNextAction = () => {
    switch (status) {
      case "ACTIVO":
        return { label: "Solicitar Baja", next: "SOLICITAR BAJA" };
      case "SOLICITAR BAJA":
        return { label: "Aprobar Baja", next: "ELIMINADO" };
      case "ELIMINADO":
        return { label: "Solicitar Alta", next: "SOLICITAR ALTA" };
      case "SOLICITAR ALTA":
        return { label: "Aprobar Alta", next: "ACTIVO" };
      case "RECHAZADA":
        return { label: "Activar", next: "ACTIVO" };
      default:
        return { label: "Desconocido", next: null };
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
