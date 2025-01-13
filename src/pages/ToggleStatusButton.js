import React, { useState } from 'react';
import supabase from '../supabase/client';

const ToggleStatusButton = ({ registroId, initialStatus }) => {
  const [status, setStatus] = useState(initialStatus);
  const [loading, setLoading] = useState(false);

  const toggleStatus = async () => {
    setLoading(true);

    // Determina el nuevo status
    const nuevoStatus = status === 'ACTIVO' ? 'ELIMINADO' : 'ACTIVO';

    try {
      // Actualiza el status en Supabase
      const { data, error } = await supabase
        .from('ciudadania') // Cambia por el nombre de tu tabla
        .update({ status: nuevoStatus })
        .eq('id', registroId); // Cambia 'id' por el nombre de tu clave primaria

      if (error) {
        console.error('Error al actualizar el status:', error);
      } else {
        setStatus(nuevoStatus); // Actualiza el estado local si fue exitoso
      }
    } catch (error) {
      console.error('Error:', error.message);
    }

    setLoading(false);
  };

  return (
    <button onClick={toggleStatus} disabled={loading}>
      {loading ? 'Cargando...' : `${status === 'ACTIVO' ? 'ELIMINAR' : 'ACTIVAR'}`}
    </button>
  );
};

export default ToggleStatusButton;
