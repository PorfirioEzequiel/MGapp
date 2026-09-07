import React, { useEffect, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import TableroBoard from '../admin/TableroBoard';

const MENSAJES = [
  'Accediendo al visor territorial…',
  'Cargando datos electorales…',
  'Preparando secciones de Tecámac…',
  'Iniciando visor…',
];

// Circumference for r=24: 2π×24 ≈ 150.8 — arc = 25% = 37.7, gap = 113.1
const SPINNER_KEYFRAMES = `
  @keyframes ls-spin   { to { transform: rotate(360deg); } }
  @keyframes ls-float-a { 0%,100% { transform: translateY(0)   translateX(0);    }  50% { transform: translateY(-28px) translateX(14px);  } }
  @keyframes ls-float-b { 0%,100% { transform: translateY(0)   translateX(0);    }  50% { transform: translateY(-18px) translateX(-22px); } }
  @keyframes ls-float-c { 0%,100% { transform: translateY(0)   translateX(0);    }  50% { transform: translateY(22px)  translateX(16px);  } }
  @keyframes ls-float-d { 0%,100% { transform: translateY(0)   translateX(0);    }  50% { transform: translateY(-12px) translateX(-10px); } }
  @keyframes ls-exit    { to { opacity: 0; transform: scale(1.012); } }
`;

const LoadingScreen = ({ onDone }) => {
  const [msgIdx,   setMsgIdx]   = useState(0);
  const [fade,     setFade]     = useState(true);
  const [exiting,  setExiting]  = useState(false);

  useEffect(() => {
    let i = 0;
    const interval = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        i += 1;
        if (i >= MENSAJES.length) {
          clearInterval(interval);
          setExiting(true);
          setTimeout(onDone, 580);
          return;
        }
        setMsgIdx(i);
        setFade(true);
      }, 300);
    }, 900);
    return () => clearInterval(interval);
  }, [onDone]);

  const pct = ((msgIdx + 1) / MENSAJES.length) * 100;

  return (
    <>
      <style>{SPINNER_KEYFRAMES}</style>
      <div style={{
        position: 'fixed', inset: 0, zIndex: 50,
        background: '#0f172a',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        animation: exiting ? 'ls-exit 0.55s cubic-bezier(0.4,0,1,1) forwards' : 'none',
      }}>

        {/* ── Dot grid texture ── */}
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04, pointerEvents: 'none' }}>
          <defs>
            <pattern id="ls-dots" width="36" height="36" patternUnits="userSpaceOnUse">
              <circle cx="18" cy="18" r="0.9" fill="white" />
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#ls-dots)" />
        </svg>

        {/* ── Parallax depth circles (4 layers, 4 speeds) ── */}
        <div style={{
          position: 'absolute', top: '7%', left: '4%',
          width: 340, height: 340, borderRadius: '50%',
          border: '1px solid rgba(155,30,50,0.09)',
          animation: 'ls-float-a 15s ease-in-out infinite',
          willChange: 'transform', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', right: '7%',
          width: 190, height: 190, borderRadius: '50%',
          background: 'rgba(155,30,50,0.04)',
          animation: 'ls-float-b 10s ease-in-out infinite',
          willChange: 'transform', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '52%', left: '13%',
          width: 88, height: 88, borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.04)',
          animation: 'ls-float-c 6.5s ease-in-out infinite',
          willChange: 'transform', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '18%', right: '16%',
          width: 44, height: 44, borderRadius: '50%',
          background: 'rgba(155,30,50,0.08)',
          animation: 'ls-float-d 4s ease-in-out infinite',
          willChange: 'transform', pointerEvents: 'none',
        }} />

        {/* ── Brand mark ── */}
        <div style={{ marginBottom: 44, textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: 58, height: 58, borderRadius: 15,
            background: '#7B1528', marginBottom: 16,
            boxShadow: '0 0 0 1px rgba(155,30,50,0.28), 0 10px 36px rgba(123,21,40,0.45)',
          }}>
            <span style={{ color: '#fff', fontWeight: 900, fontSize: 19, letterSpacing: '0.13em', fontFamily: 'system-ui' }}>SM</span>
          </div>
          <div style={{ color: '#f1f5f9', fontWeight: 700, fontSize: 17, letterSpacing: '-0.01em', fontFamily: 'system-ui', marginBottom: 3 }}>
            Sistema de Monitoreo
          </div>
          <div style={{ color: 'rgba(148,163,184,0.65)', fontSize: 11, fontWeight: 600, letterSpacing: '0.26em', textTransform: 'uppercase', fontFamily: 'system-ui' }}>
            Tecámac · Estado de México
          </div>
        </div>

        {/* ── Single SVG arc spinner ── */}
        <div style={{ position: 'relative', marginBottom: 34, zIndex: 1 }}>
          <svg
            width="58" height="58" viewBox="0 0 58 58"
            style={{ display: 'block', animation: 'ls-spin 1.25s linear infinite' }}
          >
            {/* Track */}
            <circle cx="29" cy="29" r="24" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="2.5" />
            {/* Arc — 25% of circumference (2π×24≈150.8 → 37.7 arc, 113.1 gap) */}
            <circle
              cx="29" cy="29" r="24"
              fill="none"
              stroke="#9B1E32"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeDasharray="37.7 113.1"
              transform="rotate(-90 29 29)"
            />
          </svg>
        </div>

        {/* ── Status message ── */}
        <p style={{
          fontSize: 13, fontWeight: 500, fontFamily: 'system-ui',
          color: 'rgba(203,213,225,0.8)', letterSpacing: '0.01em',
          opacity: fade ? 1 : 0, transition: 'opacity 0.3s ease',
          minHeight: 20, marginBottom: 20, position: 'relative', zIndex: 1,
        }}>
          {MENSAJES[msgIdx]}
        </p>

        {/* ── Progress bar ── */}
        <div style={{
          width: 152, height: 1.5,
          background: 'rgba(255,255,255,0.07)', borderRadius: 99, overflow: 'hidden',
          position: 'relative', zIndex: 1,
        }}>
          <div style={{
            height: '100%', background: '#9B1E32', borderRadius: 99,
            width: `${pct}%`,
            transition: 'width 0.7s cubic-bezier(0.4,0,0.2,1)',
            boxShadow: '0 0 8px rgba(155,30,50,0.55)',
          }} />
        </div>

      </div>
    </>
  );
};

// ── Visor Consultor ───────────────────────────────────────────────────────────
const VisorConsultor = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const raw = sessionStorage.getItem('user');
    if (!raw) { navigate('/'); return; }
    const user = JSON.parse(raw);
    if (user.puesto?.toLowerCase() !== 'consultor') { navigate('/'); }
  }, [navigate]);

  const handleDone = useCallback(() => setLoading(false), []);

  return (
    <div className="w-screen h-screen overflow-hidden relative">
      <TableroBoard readOnly />
      {loading && <LoadingScreen onDone={handleDone} />}
    </div>
  );
};

export default VisorConsultor;
