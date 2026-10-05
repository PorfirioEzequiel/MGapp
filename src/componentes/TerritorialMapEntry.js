import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import TerritorialLoading from './TerritorialLoading';
import './territorialExperience.css';

const ALLOWED_ROLES = new Set(['administrador', 'master']);

const TerritorialMapEntry = ({ children }) => {
  const [entering, setEntering] = useState(true);

  // Keep the existing three-second entrance while the map loads underneath.
  useEffect(() => {
    const timer = setTimeout(() => setEntering(false), 3000);
    return () => clearTimeout(timer);
  }, []);

  let user;
  try {
    user = JSON.parse(sessionStorage.getItem('user') || 'null');
  } catch (_) {
    return <Navigate to="/" replace />;
  }
  if (!ALLOWED_ROLES.has(String(user?.puesto || '').toLowerCase())) return <Navigate to="/" replace />;

  return (
    <div className="territorial-experience">
      {children}
      {entering && <div className="territorial-handoff"><TerritorialLoading entrance label="Abriendo el mapa" detail="Tecámac · Estado de México" /></div>}
    </div>
  );
};

export default TerritorialMapEntry;
