import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom'; // Para redirigir
import supabase from '../supabase/client';


const Login = () => {
  const [formData, setFormData] = useState({ usuario: '', contraseña: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      // Consulta a la base de datos
      const { data, error } = await supabase
        .from('ciudadania') // Tabla en Supabase
        .select('*')
        .eq('usuario', formData.usuario)
        .eq('password', formData.contraseña)
        .single();

      if (error || !data) {
        setError('Usuario o contraseña incorrectos');
        return;
      }

      // Redirigir al perfil del usuario
      switch (data.puesto.toLowerCase()) {
        case 'administrador':
          navigate(`/admin/${data.usuario}`, { state: { user: data } });
          break;
        case 'coordinador de poligono':
          navigate(`/coordinador/${data.usuario}`, { state: { user: data } });
          break;
        case 'seccional':
          navigate(`/perfil/${data.usuario}`, { state: { user: data } });
          break;
        case 'promotora-bienestar':
          navigate(`/reporte/${data.usuario}`, { state: { user: data } });
        break;
        
        default:
          setError('Puesto desconocido');
      }
      // navigate(`/perfil/${data.usuario}`, { state: { user: data } });
    } catch (err) {
      console.error('Error al iniciar sesión:', err.message);
      setError('Error interno. Inténtalo más tarde.');
    }
  };

  return (
    <div class="max-w-xl mx-auto py-6 px-8 h-80 mt-20 bg-white justify-center rounded shadow-xl">
      
      
      <form onSubmit={handleSubmit}>
        <div class="mb-6">
        <label
        class="block text-gray-800 font-bold"
        >
          Usuario:
        </label>
          <input
            type="text"
            name="usuario"
            class="w-full border border-gray-300 py-2 pl-3 rounded mt-2 outline-none focus:ring-indigo-600 :ring-indigo-600"
            value={formData.usuario}
            onChange={handleChange}
            required
          />
        </div>

        <div mb-6>
        <label 
        class="block text-gray-800 font-bold" >
          Contraseña:
        </label>
          <input
            type="password"
            name="contraseña"
            class="w-full border border-gray-300 py-2 pl-3 rounded mt-2 outline-none focus:ring-indigo-600 :ring-indigo-600"
            value={formData.contraseña}
            onChange={handleChange}
            required
          />
          </div>
        
        <button type="submit" class="text-white m-3 bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center dark:bg-blue-600 dark:hover:bg-blue-700 dark:focus:ring-blue-800">Iniciar sesión</button>
      </form>
      {error && <p style={{ color: 'red' }}>{error}</p>}
    </div>
  );
};

export default Login;