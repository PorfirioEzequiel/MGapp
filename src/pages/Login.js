import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../supabase/client';

const Login = () => {
  const [formData, setFormData] = useState({ usuario: '', contraseña: '' });
  const [error, setError] = useState('');
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    try {
      // Consultar en Supabase
      const { data, error } = await supabase
        .from('ciudadania')
        .select('*')
        .eq('usuario', formData.usuario)
        .eq('password', formData.contraseña)
        .single();

      if (error || !data) {
        setError('Usuario o contraseña incorrectos');
        return;
      }

      // Guardar sesión en sessionStorage
      sessionStorage.setItem('user', JSON.stringify(data));

      // Redirigir según el puesto
      const rutas = {
        administrador: `/menu/${data.usuario}`/*`/admin/${data.usuario}`*/,
        'coordinador de poligono': `/coordinador/${data.usuario}`,
        seccional: `/perfil/${data.usuario}`,
        'promotora-bienestar': `/reporte/${data.usuario}`,
        enlace: `/enlace/${data.usuario}`
      };

      const ruta = rutas[data.puesto.toLowerCase()] || null;
      if (ruta) {
        navigate(ruta, { state: { user: data } });
      } else {
        setError('Puesto desconocido');
      }
    } catch (err) {
      console.error('Error al iniciar sesión:', err);
      setError('Error interno. Inténtalo más tarde.');
    }
  };

  return (
    <div className="max-w-xl mx-auto py-6 px-8 mt-20 bg-white rounded shadow-xl">
      <form onSubmit={handleSubmit}>
        <div className="mb-6">
          <label className="block text-gray-800 font-bold">Usuario:</label>
          <input
            type="text"
            name="usuario"
            className="w-full border border-gray-300 py-2 pl-3 rounded mt-2 outline-none focus:ring-indigo-600"
            value={formData.usuario}
            onChange={handleChange}
            required
          />
        </div>

        <div className="mb-6">
          <label className="block text-gray-800 font-bold">Contraseña:</label>
          <input
            type="password"
            name="contraseña"
            className="w-full border border-gray-300 py-2 pl-3 rounded mt-2 outline-none focus:ring-indigo-600"
            value={formData.contraseña}
            onChange={handleChange}
            required
          />
        </div>

        <button
          type="submit"
          className="text-white bg-blue-700 hover:bg-blue-800 focus:ring-4 focus:outline-none focus:ring-blue-300 font-medium rounded-lg text-sm w-full sm:w-auto px-5 py-2.5 text-center"
        >
          Iniciar sesión
        </button>
      </form>

      {error && <p className="text-red-600 mt-2">{error}</p>}
    </div>
  );
};

export default Login;
