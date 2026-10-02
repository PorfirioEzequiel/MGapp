import React from 'react';
import './territorialExperience.css';

export const TerritorialSpinner = () => (
  <span className="territorial-compass" aria-hidden="true">
    <span className="territorial-compass-ring" />
    <svg viewBox="0 0 32 32" fill="none"><path d="m20 10-2 8-8 4 4-8 6-4Z" fill="currentColor" /><circle cx="16" cy="16" r="12" stroke="currentColor" strokeOpacity=".14" /></svg>
  </span>
);

export const TerritorialSkeleton = () => (
  <div className="territorial-skeleton" role="status" aria-label="Cargando información territorial">
    <div className="territorial-skeleton-summary" aria-hidden="true">
      <i />
      <div>{[0, 1, 2, 3].map(i => <span key={i}><b /><i /></span>)}</div>
    </div>
    {[0, 1, 2].map(i => <div key={i} className="territorial-skeleton-row" style={{ animationDelay: `${i * 70}ms` }}><span /><div><i /><i /></div></div>)}
    <span className="sr-only">Cargando información territorial</span>
  </div>
);

export default function TerritorialLoading({ label = 'Cargando territorio', detail = 'Preparando el mapa', entrance = false }) {
  return (
    <div className={`territorial-loading ${entrance ? 'territorial-loading-entrance' : ''}`} role="status" aria-live="polite">
      <div className="territorial-loading-grid" aria-hidden="true" />
      <div className="territorial-loading-content">
        <TerritorialSpinner />
        <p>{label}</p>
        <span>{detail}</span>
        <div className="territorial-loading-track" aria-hidden="true"><i /></div>
      </div>
    </div>
  );
}
