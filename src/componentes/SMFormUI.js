import { cloneElement, useEffect, useId, useRef } from 'react';
import { FiCheck, FiGrid, FiMapPin, FiUser, FiX } from 'react-icons/fi';
import './smForm.css';

export function SMField({ label, children, hint }) {
  const id = useId();
  const required = children?.props?.required;
  return (
    <div className="sm-field">
      <label htmlFor={id}>{label}{required && <span aria-hidden="true" className="sm-required"> *</span>}</label>
      {cloneElement(children, { id, ...(hint ? { 'aria-describedby': `${id}-hint` } : {}) })}
      {hint && <span id={`${id}-hint`} className="sm-field-hint">{hint}</span>}
    </div>
  );
}

export function SMSectionTitle({ children, hint }) {
  return <div className="sm-section-heading"><h2>{children}</h2>{hint && <p>{hint}</p>}</div>;
}

export function HomeLocationNote({ citizen }) {
  const located = Boolean(citizen?.latitud && citizen?.longitud);
  return <div className="sm-home-note" role="status">
    <span className={`sm-location-state ${located ? 'is-located' : ''}`}>
      {located ? <FiCheck aria-hidden="true" /> : <FiMapPin aria-hidden="true" />}
      {located ? 'Domicilio marcado' : 'Domicilio por marcar'}
    </span>
    <span>{located ? 'Puedes arrastrar el pin para precisar dónde vive.' : 'Busca una dirección y toca el mapa para colocar el pin.'}</span>
  </div>;
}

// El diálogo presenta el borrador; el guardado sigue en el formulario original.
export function SMSaveConfirmation({ open, onClose, onConfirm, busy, citizen, editing = false }) {
  const dialogRef = useRef(null);
  const titleId = useId();
  const descriptionId = useId();
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    const trigger = document.activeElement;
    dialog.showModal();
    return () => {
      dialog.close();
      if (trigger?.isConnected) trigger.focus();
    };
  }, [open]);
  if (!open) return null;
  const name = [citizen?.nombre, citizen?.a_paterno, citizen?.a_materno].filter(Boolean).join(' ');
  const located = Boolean(citizen?.latitud && citizen?.longitud);
  return <dialog ref={dialogRef} className="sm-save-dialog sm-form-theme" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}>
    <button type="button" className="sm-dialog-close" aria-label="Cerrar confirmación" onClick={onClose} disabled={busy}><FiX /></button>
    <div className="sm-dialog-icon"><FiCheck aria-hidden="true" /></div>
    <p className="sm-eyebrow">Revisión final</p>
    <h2 id={titleId}>{editing ? '¿Guardar estos cambios?' : '¿Enviar la solicitud de alta?'}</h2>
    <p id={descriptionId}>Revisa la asignación de trabajo y el domicilio antes de confirmar.</p>
    <dl className="sm-save-summary">
      <div><dt><FiUser aria-hidden="true" /> Persona</dt><dd>{name || 'Sin nombre capturado'}</dd></div>
      <div><dt><FiGrid aria-hidden="true" /> Dónde trabaja</dt><dd>{citizen?.ubt || 'Sin fracción asignada'}<small>Sector {citizen?.poligono || '—'} · Sección {citizen?.seccion || '—'}</small></dd></div>
      <div><dt><FiMapPin aria-hidden="true" /> Dónde vive</dt><dd>{located ? 'Domicilio marcado en el mapa' : 'Sin pin de domicilio'}
        <small>{[citizen?.calle, citizen?.n_ext_mz, citizen?.col_loc].filter(Boolean).join(', ') || 'Sin dirección capturada'}</small></dd></div>
    </dl>
    <div className="sm-dialog-actions">
      <button type="button" className="sm-button sm-button-secondary" onClick={onClose} disabled={busy} autoFocus>Seguir revisando</button>
      <button type="button" className="sm-button sm-button-primary" onClick={onConfirm} disabled={busy}>
        {busy && <span className="sm-spinner" aria-hidden="true" />}
        {busy ? 'Guardando…' : editing ? 'Confirmar cambios' : 'Confirmar y enviar'}
      </button>
    </div>
  </dialog>;
}
