import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import TableroBoard from '../admin/TableroBoard';

// Mensajes que rotan durante la carga
const MENSAJES = [
  'Accediendo al visor territorial…',
  'Cargando datos electorales…',
  'Preparando secciones de Tecámac…',
  'Listo. Iniciando visor…',
];

// ── Pantalla de carga ─────────────────────────────────────────────────────────
const LoadingScreen = ({ onDone }) => {
  const [msgIdx, setMsgIdx] = useState(0);
  const [fade, setFade]     = useState(true);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        i += 1;
        if (i >= MENSAJES.length) {
          clearInterval(interval);
          setTimeout(onDone, 400);
          return;
        }
        setMsgIdx(i);
        setFade(true);
      }, 300);
    }, 900);
    return () => clearInterval(interval);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-slate-900">
      {/* Logo / marca */}
      <div className="mb-10 text-center">
        <div className="text-4xl font-black tracking-widest text-white mb-1">SM</div>
        <div className="text-xs font-semibold tracking-[0.3em] text-slate-400 uppercase">
          Sistema de Monitoreo · Tecámac
        </div>
      </div>

      {/* Spinner doble anillo */}
      <div className="relative mb-8">
        <div className="w-20 h-20 rounded-full border-4 border-slate-700 border-t-[#9B1E32] animate-spin" />
        <div
          className="absolute inset-2 w-12 h-12 rounded-full border-4 border-slate-800 border-b-[#C04060]"
          style={{ animation: 'spin 0.7s linear infinite reverse' }}
        />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-[#9B1E32]" />
        </div>
      </div>

      {/* Mensaje rotativo */}
      <p
        className="text-sm font-medium text-slate-300 transition-opacity duration-300 h-5"
        style={{ opacity: fade ? 1 : 0 }}
      >
        {MENSAJES[msgIdx]}
      </p>

      {/* Barra de progreso */}
      <div className="mt-6 w-56 h-0.5 bg-slate-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-[#9B1E32] rounded-full"
          style={{
            width: `${((msgIdx + 1) / MENSAJES.length) * 100}%`,
            transition: 'width 0.6s ease',
          }}
        />
      </div>
    </div>
  );
};

// ── Visor Consultor ───────────────────────────────────────────────────────────
const VisorConsultor = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  // Guard: solo consultores
  useEffect(() => {
    const raw = sessionStorage.getItem('user');
    if (!raw) { navigate('/'); return; }
    const user = JSON.parse(raw);
    if (user.puesto?.toLowerCase() !== 'consultor') { navigate('/'); }
  }, [navigate]);

  const handleDone = useCallback(() => setLoading(false), []);

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      {/* TableroBoard completo con readOnly — panel izquierdo visible, sin botones export */}
      <TableroBoard readOnly />

      {/* Pantalla de carga encima mientras anima */}
      {loading && <LoadingScreen onDone={handleDone} />}
    </div>
  );
};

export default VisorConsultor;
