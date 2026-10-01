import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import TerritorialLoading from './TerritorialLoading';
import './territorialExperience.css';

const TERRITORIAL_PIN = '2105';
const ALLOWED_ROLES = new Set(['administrador', 'master']);

const TerritorialPinGate = ({ children }) => {
  const navigate = useNavigate();
  const [pin, setPin] = useState('');
  const [error, setError] = useState(false);
  const [focused, setFocused] = useState(false);
  const [unlocked, setUnlocked] = useState(false);
  const [entering, setEntering] = useState(false);

  // Keep the entrance visible for three seconds while the map loads underneath.
  useEffect(() => {
    if (!entering) return undefined;
    const timer = setTimeout(() => setEntering(false), 3000);
    return () => clearTimeout(timer);
  }, [entering]);

  let user;
  try {
    user = JSON.parse(sessionStorage.getItem('user') || 'null');
  } catch (_) {
    return <Navigate to="/" replace />;
  }
  if (!ALLOWED_ROLES.has(String(user?.puesto || '').toLowerCase())) return <Navigate to="/" replace />;

  if (unlocked) return (
    <div className="territorial-experience">
      {children}
      {entering && <div className="territorial-handoff"><TerritorialLoading entrance label="Abriendo el mapa" detail="Tecámac · Estado de México" /></div>}
    </div>
  );

  const handleSubmit = (event) => {
    event.preventDefault();
    if (pin === TERRITORIAL_PIN) {
      setEntering(true);
      setUnlocked(true);
      return;
    }
    setPin('');
    setError(true);
  };

  return (
    <main className="territorial-access">
      <div className="territorial-access-grid" aria-hidden="true" />
      <div className="territorial-access-brand"><span>SM</span><p>SISTEMA DE MONITOREO</p></div>
      <section className="territorial-access-card" aria-labelledby="territorial-title">
        <div className="territorial-map-art" aria-hidden="true">
          <svg viewBox="0 0 360 120" fill="none">
            <path d="m-20 82 65-34 48 19 51-43 70 23 51-36 115 35M-10 104l66-29 49 16 55-42 51 21 61-34 98 32M-10 31l67 15 35-36 54 8 69-23M41 130l21-54-17-28 12-36m69 124 18-58 0-54m87 104-20-58 3-23m68 84-10-95" stroke="currentColor" strokeWidth="1" />
            <path d="m105 91 55-42 51 21 61-34" stroke="#AA8958" strokeWidth="2" strokeDasharray="4 5" />
            <circle cx="160" cy="49" r="18" fill="#7B1528" fillOpacity=".07" /><circle cx="160" cy="49" r="8" fill="#7B1528" /><circle cx="160" cy="49" r="3" fill="white" />
            <circle cx="272" cy="36" r="4" fill="#AA8958" />
          </svg>
          <span>TECÁMAC / EDOMEX</span>
        </div>
        <div className="territorial-access-body">
          <span className="territorial-eyebrow">ACCESO TERRITORIAL</span>
          <h1 id="territorial-title">Ingresa el PIN para ver el <em>mapa territorial</em></h1>
          <p className="territorial-access-hint">Cuatro dígitos para continuar.</p>
          <form onSubmit={handleSubmit}>
            <label htmlFor="territorial-pin" className="sr-only">PIN de acceso</label>
            <div className={`territorial-pin ${error ? 'has-error' : ''} ${focused ? 'is-focused' : ''}`}>
              <div className="territorial-pin-slots" aria-hidden="true">
                {[0, 1, 2, 3].map(i => <span key={i} className={`${pin[i] ? 'is-filled' : ''} ${focused && i === Math.min(pin.length, 3) ? 'is-current' : ''}`}>{pin[i] ? <i /> : <b />}</span>)}
              </div>
              <input id="territorial-pin" type="password" inputMode="numeric" autoComplete="off" maxLength={4} value={pin}
                onChange={event => { setPin(event.target.value.replace(/\D/g, '').slice(0, 4)); setError(false); }}
                onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
                aria-invalid={error} aria-describedby={error ? 'territorial-pin-error' : undefined} autoFocus />
            </div>
            <div className="territorial-pin-feedback">{error && <p id="territorial-pin-error" role="alert">PIN incorrecto. Inténtalo de nuevo.</p>}</div>
            <button type="submit" className="territorial-enter" disabled={pin.length !== 4}>Entrar al mapa <span aria-hidden="true">↗</span></button>
          </form>
          <button type="button" className="territorial-back" onClick={() => navigate(`/menu/${encodeURIComponent(user.usuario)}`, { replace: true })}><span aria-hidden="true">←</span> Volver al menú</button>
        </div>
      </section>
      <p className="territorial-access-footer">TECÁMAC · ESTADO DE MÉXICO</p>
    </main>
  );
};

export default TerritorialPinGate;
