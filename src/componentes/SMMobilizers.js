import React, { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FiArrowUpRight, FiUsers, FiX } from 'react-icons/fi';
import { mobilizerStatus } from '../utils/mobilizerProgress';
import './smMobilizers.css';

function MobilizerList({ id, sm, smName, rows, onClose, triggerRef }) {
  const dialogRef = useRef(null);
  const startedOutside = useRef(false);
  useEffect(() => {
    const dialog = dialogRef.current;
    const trigger = triggerRef.current;
    const body = document.body;
    const previous = { overflow: body.style.overflow, paddingRight: body.style.paddingRight };
    const scrollbar = window.innerWidth - document.documentElement.clientWidth;
    if (scrollbar > 0) body.style.paddingRight = `${parseFloat(getComputedStyle(body).paddingRight || '0') + scrollbar}px`;
    body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      body.style.overflow = previous.overflow;
      body.style.paddingRight = previous.paddingRight;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, [triggerRef]);

  const isOutside = event => {
    if (event.target !== event.currentTarget) return false;
    const rect = event.currentTarget.getBoundingClientRect();
    return event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom;
  };
  return createPortal(
    <dialog ref={dialogRef} id={id} className="sm-mobilizers-dialog sm-mobilizers-theme" aria-modal="true"
      aria-labelledby={`${id}-title`} aria-describedby={`${id}-owner`}
      onCancel={event => { event.preventDefault(); onClose(); }}
      onPointerDown={event => { startedOutside.current = isOutside(event); }}
      onClick={event => { if (startedOutside.current && isOutside(event)) onClose(); }}>
      <header className="sm-mobilizers-dialog-header">
        <div>
          <h2 id={`${id}-title`}>MOVILIZADORES</h2>
          <p id={`${id}-owner`}>Asignados a <strong>{smName}</strong></p>
          <p className="sm-mobilizers-territory">
            {sm.seccion ? `Sección ${sm.seccion}` : 'Sin sección asignada'}{sm.ubt ? ` · ${sm.ubt}` : ''}
          </p>
        </div>
        <button type="button" className="sm-mobilizers-close" aria-label="Cerrar lista de movilizadores" onClick={onClose} autoFocus>
          <FiX aria-hidden="true" />
        </button>
      </header>
      <div className="sm-mobilizers-list-heading">
        <span>Nombre completo</span>
        <span>{rows.length} {rows.length === 1 ? 'registro' : 'registros'}</span>
      </div>
      <div className="sm-mobilizers-list-scroll" tabIndex={0} role="region" aria-label="Listado de movilizadores">
        {rows.length ? <ol className="sm-mobilizers-list">
          {rows.map((row, index) => <li key={row.id ?? index}>
            <span className="sm-mobilizers-list-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <span>{row.name}</span>
          </li>)}
        </ol> : <div className="sm-mobilizers-empty">
          <FiUsers aria-hidden="true" />
          <p>Aún no hay movilizadores activos asignados a esta SM.</p>
        </div>}
      </div>
      <footer className="sm-mobilizers-dialog-footer">Solo registros activos asignados a esta SM.</footer>
    </dialog>, document.body,
  );
}

export default function SMMobilizers({ sm, progress, onRetry }) {
  const [open, setOpen] = useState(false);
  const dialogId = useId();
  const triggerRef = useRef(null);
  const rows = progress.bySM?.[sm.usuario] || [];
  const count = rows.length;
  const pct = Math.min(count / 10 * 100, 100);
  const status = mobilizerStatus(pct);
  const smName = [sm.nombre, sm.a_paterno, sm.a_materno].filter(Boolean).join(' ') || 'SM sin nombre';
  if (!progress.loaded) return <div className="sm-mobilizers-card sm-mobilizers-theme" role="status">
    <p className="sm-mobilizers-label">MOVILIZADORES</p><p className="sm-mobilizers-feedback">Cargando listado…</p>
  </div>;
  if (progress.error) return <div className="sm-mobilizers-card sm-mobilizers-theme" role="alert">
    <p className="sm-mobilizers-label">MOVILIZADORES</p><p className="sm-mobilizers-feedback">No se pudo cargar el listado.</p>
    <button type="button" onClick={onRetry} className="sm-mobilizers-link">Reintentar</button>
  </div>;
  return (
    <section aria-label={`Movilizadores de ${smName}`} className="sm-mobilizers-card sm-mobilizers-theme">
      <p className="sm-mobilizers-label">MOVILIZADORES</p>
      <div className="sm-mobilizers-summary">
        <p className="sm-mobilizers-count"><strong>{count}</strong> de 10</p>
        <button ref={triggerRef} type="button" className="sm-mobilizers-link" aria-haspopup="dialog" aria-expanded={open}
          aria-controls={open ? dialogId : undefined} aria-label={`Ver listado de movilizadores de ${smName}`}
          onClick={() => setOpen(true)}>Ver listado <FiArrowUpRight aria-hidden="true" /></button>
      </div>
      <div role="progressbar" aria-label={`Avance de movilizadores de ${smName}`} aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}
        aria-valuetext={`${count} de 10 movilizadores`} className="sm-mobilizers-progress">
        <div style={{ width: `${pct}%`, backgroundColor: status.color }} />
      </div>
      {open && <MobilizerList id={dialogId} sm={sm} smName={smName} rows={rows} onClose={() => setOpen(false)} triggerRef={triggerRef} />}
    </section>
  );
}
