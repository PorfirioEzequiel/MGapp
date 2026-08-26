import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import supabase from '../supabase/client';
import MapTerritorial from '../map/MapTerritorial';

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

      {/* Spinner */}
      <div className="relative mb-8">
        {/* Anillo exterior lento */}
        <div className="w-20 h-20 rounded-full border-4 border-slate-700 border-t-blue-500 animate-spin" />
        {/* Anillo interior rápido */}
        <div
          className="absolute inset-2 w-12 h-12 rounded-full border-4 border-slate-800 border-b-blue-300"
          style={{ animation: 'spin 0.7s linear infinite reverse' }}
        />
        {/* Punto central */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-2 h-2 rounded-full bg-blue-400" />
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
          className="h-full bg-blue-500 rounded-full"
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
  const navigate   = useNavigate();
  const [loading,    setLoading]    = useState(true);   // pantalla de carga
  const [secciones,  setSecciones]  = useState([]);
  const [dataReady,  setDataReady]  = useState(false);  // datos de Supabase listos

  // Guard: solo consultores pueden entrar
  useEffect(() => {
    const raw = sessionStorage.getItem('user');
    if (!raw) { navigate('/'); return; }
    const user = JSON.parse(raw);
    if (user.puesto?.toLowerCase() !== 'consultor') { navigate('/'); }
  }, [navigate]);

  // Carga de secciones (sin PII — solo geometría y datos electorales)
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('secciones')
        .select('*');
      if (data) setSecciones(data);
      setDataReady(true);
    };
    load();
  }, []);

  // La pantalla de carga dura mínimo el tiempo de los mensajes (~4 × 0.9s).
  // Una vez que termina Y los datos están listos, mostramos el mapa.
  const [spinnerDone, setSpinnerDone] = useState(false);

  useEffect(() => {
    if (spinnerDone && dataReady) setLoading(false);
  }, [spinnerDone, dataReady]);

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      {/* Mapa territorial (se monta en background para que cargue mientras el spinner corre) */}
      {!loading && (
        <MapTerritorial
          secciones={secciones}
          ciudadanos={[]}
          fraccionesGeo={[]}
          selectedSeccion={null}
          onSelectSeccion={() => {}}
          afiliacionBySec={{}}
          readOnly
        />
      )}

      {/* Pantalla de carga encima */}
      {loading && <LoadingScreen onDone={() => setSpinnerDone(true)} />}
    </div>
  );
};

export default VisorConsultor;
