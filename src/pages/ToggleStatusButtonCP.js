// import React, { useState } from 'react';
// import supabase from '../supabase/client';

// const ToggleStatusButtonCP = ({ registroId, initialStatus }) => {
//   const [status, setStatus] = useState(initialStatus);
//   const [loading, setLoading] = useState(false);

//   const toggleStatus = async () => {
//     setLoading(true);

//     // Determina el nuevo status
//     const nuevoStatus = status === 'ACTIVO' ? 'SOLICITAR BAJA' : 'ACTIVO';

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
//     <button class="text-white my-2 bg-pink-700 hover:bg-pink-800 focus:outline-none focus:ring-4 focus:ring-pink-300 font-medium rounded-full text-sm px-5 py-2.5 text-center me-2 mb-2 dark:bg-pink-600 dark:hover:bg-pink-700 dark:focus:ring-pink-900" 
//     onClick={toggleStatus} disabled={loading}>
//       {loading ? 'Cargando...' : `${status === 'ACTIVO' ? 'SOLICITAR BAJA' : 'SOLICITAR BAJA'}`}
//     </button>
//   );
// };

// export default ToggleStatusButtonCP;
import React, { useState, useEffect } from 'react';
import supabase from '../supabase/client';

const ToggleStatusButtonCP = ({ registroId, initialStatus }) => {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [motivo, setMotivo] = useState('');

  // Cerrar modal con ESC
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') setModalOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  const toggleStatus = () => {
    if (status === 'ACTIVO') {
      setModalOpen(true);
    } else {
      updateStatus('ACTIVO');
    }
  };

  const updateStatus = async (nuevoStatus, motivoBaja = null) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('ciudadania')
        .update({ status: nuevoStatus, motivo_baja: motivoBaja })
        .eq('id', registroId);

      if (error) throw error;

      setStatus(nuevoStatus);
      setModalOpen(false);
      setMotivo('');
    } catch (err) {
      console.error('Error al actualizar status:', err.message);
      alert('No se pudo actualizar el status.');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitModal = () => {
    if (!motivo.trim()) {
      alert('Debes ingresar un motivo.');
      return;
    }
    updateStatus('SOLICITAR BAJA', motivo);
  };

  return (
    <>
      <button
        className={`text-white my-2 font-medium rounded-full text-sm px-5 py-2.5 text-center me-2 mb-2 focus:outline-none focus:ring-4
        ${status === 'ACTIVO'
          ? 'bg-pink-700 hover:bg-pink-800 focus:ring-pink-300 dark:bg-pink-600 dark:hover:bg-pink-700 dark:focus:ring-pink-900'
          : 'bg-gray-700 hover:bg-gray-800 focus:ring-gray-300 dark:bg-gray-600 dark:hover:bg-gray-700 dark:focus:ring-gray-900'}`}
        onClick={toggleStatus}
        disabled={loading}
      >
        {loading ? 'Cargando...' : status === 'ACTIVO' ? 'SOLICITAR BAJA' : 'CANCELAR SOLICITUD'}
      </button>

      {/* Modal */}
      {modalOpen && (
        <div
          className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50 transition-opacity"
          onClick={() => setModalOpen(false)} // Cierra modal al hacer clic fuera
        >
          <div
            className="bg-white rounded shadow-lg w-96 p-6 transform transition-transform scale-100"
            onClick={(e) => e.stopPropagation()} // Evita cerrar modal al hacer clic dentro
          >
            <h2 className="text-lg font-bold mb-4">Motivo de la baja</h2>
            <textarea
              className="border p-2 w-full h-24 mb-4 resize-none"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              placeholder="Escribe el motivo aquí..."
            />
            <div className="flex justify-end space-x-2">
              <button
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded border hover:bg-gray-100"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubmitModal}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                Enviar
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default ToggleStatusButtonCP;
