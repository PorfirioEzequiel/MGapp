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
      const { data, error } = await supabase
        .from('ciudadania')
        .select('*')
        .eq('usuario', formData.usuario)
        .eq('password', formData.contraseña)
        .eq('status', 'ACTIVO')
        .maybeSingle();

      if (error || !data) {
        setError('Usuario o contraseña incorrectos');
        return;
      }

      sessionStorage.setItem('user', JSON.stringify(data));

      const rutas = {
        administrador: `/menu/${data.usuario}`,
        'sp': `/coordinador/${data.usuario}`,
        seccional: `/perfil/${data.usuario}`,
        'sm': `/reporte/${data.usuario}`,
        enlace: `/enlace/${data.usuario}`,
        consultor: '/visor',
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
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4">
      <div className="w-full max-w-sm">

        {/* Marca */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-[#7B1528] mb-4 shadow-lg" style={{ boxShadow: '0 8px 24px rgba(123,21,40,0.25)' }}>
            <span className="text-white font-black text-xl tracking-widest">SM</span>
          </div>
          <h1 className="text-slate-900 font-bold text-lg tracking-tight">Sistema de Monitoreo</h1>
          <p className="text-slate-400 text-sm mt-0.5">Tecámac · Estado de México</p>
        </div>

        {/* Tarjeta */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Usuario</label>
              <input
                type="text"
                name="usuario"
                className="w-full border border-slate-200 py-2.5 px-3.5 rounded-xl text-sm text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-[#7B1528] focus:ring-2 focus:ring-[#7B1528]/10"
                placeholder="tu.usuario"
                value={formData.usuario}
                onChange={handleChange}
                required
              />
            </div>

            <div>
              <label className="block text-sm font-semibold text-slate-700 mb-1.5">Contraseña</label>
              <input
                type="password"
                name="contraseña"
                className="w-full border border-slate-200 py-2.5 px-3.5 rounded-xl text-sm text-slate-900 outline-none transition-all placeholder:text-slate-300 focus:border-[#7B1528] focus:ring-2 focus:ring-[#7B1528]/10"
                placeholder="••••••••"
                value={formData.contraseña}
                onChange={handleChange}
                required
              />
            </div>

            {error && (
              <div className="flex items-start gap-2.5 p-3 bg-red-50 border border-red-100 rounded-xl">
                <svg className="w-4 h-4 text-red-400 flex-shrink-0 mt-px" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-600 leading-snug">{error}</p>
              </div>
            )}

            <button
              type="submit"
              className="w-full text-white font-semibold py-2.5 rounded-xl text-sm transition-colors mt-1"
              style={{ backgroundColor: '#7B1528' }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#6B0B20'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#7B1528'}
            >
              Iniciar sesión
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-slate-100 space-y-1.5">
            <button
              type="button"
              onClick={() => navigate('/registro-apoyos')}
              className="block w-full text-xs text-slate-500 hover:text-slate-800 font-medium text-center py-2 hover:bg-slate-50 rounded-lg transition-colors"
            >
              Registro de Apoyos — Tinaco · Calentador Solar · Mercado Solidario
            </button>
            <button
              type="button"
              onClick={() => navigate('/registro-certificado-medico/checkin')}
              className="block w-full text-xs text-emerald-600 hover:text-emerald-800 font-medium text-center py-2 hover:bg-emerald-50 rounded-lg transition-colors"
            >
              Check-in Certificado Médico (personal de evento)
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};

export default Login;
