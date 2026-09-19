import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import supabase, { supabaseStorage } from '../supabase/client';

const nombreCompleto = (r) =>
  `${r.nombre ?? ''} ${r.a_paterno ?? ''} ${r.a_materno ?? ''}`.trim();

// ── Autocomplete de SM ─────────────────────────────────────────────────────────
const AutocompleteSM = ({ sms, valor, onChange, smSel, onSelect, onLimpiar }) => {
  const [abierto, setAbierto] = useState(false);
  const ref = useRef(null);

  const sugerencias = sms
    .filter((sm) => {
      if (!valor.trim()) return false;
      const q = valor.toLowerCase();
      return (
        nombreCompleto(sm).toLowerCase().includes(q) ||
        String(sm.seccion ?? '').includes(q) ||
        String(sm.ubt ?? '').includes(q)
      );
    })
    .slice(0, 8);

  useEffect(() => {
    const cerrar = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setAbierto(false);
    };
    document.addEventListener('mousedown', cerrar);
    return () => document.removeEventListener('mousedown', cerrar);
  }, []);

  if (smSel) {
    return (
      <div className="flex items-center gap-3 bg-blue-50 border-2 border-blue-300 rounded-xl px-3.5 py-3">
        <div className="w-9 h-9 rounded-full bg-blue-800 flex items-center justify-center text-xs font-black text-white flex-shrink-0">
          {(smSel.nombre?.[0] ?? '') + (smSel.a_paterno?.[0] ?? '')}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold text-blue-900 truncate">{nombreCompleto(smSel)}</p>
          <p className="text-[10px] text-blue-600">
            {smSel.poligono && `Sector ${smSel.poligono} · `}Sección {smSel.seccion} · Fracción {smSel.ubt}
          </p>
        </div>
        <button
          type="button"
          onClick={onLimpiar}
          className="text-blue-400 hover:text-blue-700 font-bold text-xl leading-none px-1"
        >
          ×
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <input
        type="text"
        placeholder="Escribe el nombre de la SM…"
        value={valor}
        onChange={(e) => { onChange(e.target.value); setAbierto(true); }}
        onFocus={() => setAbierto(true)}
        autoComplete="off"
        className="border border-slate-200 rounded-lg px-3 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white w-full"
      />
      {abierto && sugerencias.length > 0 && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden">
          {sugerencias.map((sm) => (
            <button
              key={sm.id}
              type="button"
              onMouseDown={(e) => { e.preventDefault(); onSelect(sm); setAbierto(false); }}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-blue-50 text-left transition-colors border-b border-slate-50 last:border-0"
            >
              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-xs font-black text-blue-700 flex-shrink-0">
                {(sm.nombre?.[0] ?? '') + (sm.a_paterno?.[0] ?? '')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{nombreCompleto(sm)}</p>
                <p className="text-[10px] text-slate-400">
                  {sm.poligono && `Sector ${sm.poligono} · `}Sección {sm.seccion} · Fracción {sm.ubt}
                </p>
              </div>
            </button>
          ))}
        </div>
      )}
      {abierto && valor.trim().length > 1 && sugerencias.length === 0 && (
        <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg px-4 py-3">
          <p className="text-sm text-slate-400">Sin resultados para "{valor}"</p>
        </div>
      )}
    </div>
  );
};

// ── Componente principal ───────────────────────────────────────────────────────
const SubirEvidenciaActividad = () => {
  const { actividadId } = useParams();
  const [actividad, setActividad] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [sms, setSms] = useState([]);
  const [smQuery, setSmQuery] = useState('');
  const [smSel, setSmSel] = useState(null);
  const [foto, setFoto] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      const { data: actData } = await supabase
        .from('actividades')
        .select('*')
        .eq('id', actividadId)
        .single();
      setActividad(actData);

      const puesto = actData?.puesto ?? 'SM';
      const { data: smsData } = await supabaseStorage
        .from('ciudadania')
        .select('id, nombre, a_paterno, a_materno, poligono, seccion, ubt')
        .eq('puesto', puesto)
        .eq('status', 'ACTIVO')
        .order('a_paterno', { ascending: true });
      setSms(smsData ?? []);

      setCargando(false);
    };
    fetchData();
  }, [actividadId]);

  const handleFoto = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFoto(file);
    setFotoPreview(URL.createObjectURL(file));
  };

  const handleEnviar = async (e) => {
    e.preventDefault();
    if (!smSel) { setErrorMsg('Por favor selecciona tu nombre de la lista.'); return; }
    if (!foto) { setErrorMsg('Por favor selecciona una foto de evidencia.'); return; }
    setErrorMsg('');
    setEnviando(true);

    const filePath = `evidencias/${actividadId}/${smSel.id}-${Date.now()}`;

    const { error: uploadError } = await supabaseStorage.storage
      .from('evidencias_actividades')
      .upload(filePath, foto, { upsert: false });

    if (uploadError) {
      setErrorMsg('Error al subir imagen. Intenta de nuevo.');
      setEnviando(false);
      return;
    }

    const { data: urlData } = supabaseStorage.storage
      .from('evidencias_actividades')
      .getPublicUrl(filePath);

    const vencida = actividad.fecha_limite && new Date() > new Date(actividad.fecha_limite);

    const { error: dbError } = await supabaseStorage
      .from('evidencias_actividades')
      .insert({
        actividad_id: actividad.id,
        ciudadano_id: smSel.id,
        nombre_sm: nombreCompleto(smSel),
        poligono: smSel.poligono ?? null,
        seccion: smSel.seccion ?? null,
        ubt: smSel.ubt ?? null,
        url_evidencia: urlData.publicUrl,
        status: vencida ? 'FUERA_DE_TIEMPO' : 'COMPROBADO',
      });

    setEnviando(false);
    if (dbError) { setErrorMsg('Error al registrar. Intenta de nuevo.'); return; }
    setExito(true);
  };

  if (cargando) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <div className="w-8 h-8 border-4 border-blue-400 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!actividad) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
      <div className="text-center">
        <p className="text-4xl mb-3">❌</p>
        <p className="text-slate-600 font-semibold">Actividad no encontrada</p>
        <p className="text-slate-400 text-sm mt-1">El enlace puede ser incorrecto o haber expirado.</p>
      </div>
    </div>
  );

  if (exito) {
    const fueraDeT = actividad.fecha_limite && new Date() > new Date(actividad.fecha_limite);
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center px-6">
        <div className="text-center max-w-xs">
          <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <span className="text-3xl">✓</span>
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">Evidencia enviada</h2>
          <p className="text-slate-500 text-sm">Tu evidencia fotográfica fue registrada correctamente para:</p>
          <p className="text-slate-700 font-semibold text-sm mt-1">{actividad.nombre}</p>
          {fueraDeT && (
            <p className="mt-3 text-amber-600 text-xs font-semibold bg-amber-50 px-3 py-2 rounded-lg">
              ⏰ Registrada fuera del tiempo límite
            </p>
          )}
        </div>
      </div>
    );
  }

  const vencida = actividad.fecha_limite && new Date() > new Date(actividad.fecha_limite);

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-6">
        <p className="text-blue-200 text-xs font-medium mb-1">Evidencia fotográfica</p>
        <h1 className="text-white font-bold text-xl leading-tight">{actividad.nombre}</h1>
        {actividad.indicacion && (
          <p className="text-blue-100 text-sm mt-2 leading-relaxed">{actividad.indicacion}</p>
        )}
        {actividad.fecha_limite && (
          <div className={`mt-3 inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-full ${
            vencida ? 'bg-red-500/20 text-red-200' : 'bg-blue-500/20 text-blue-100'
          }`}>
            {vencida ? '⚠ Vencida: ' : '⏱ Límite: '}
            {new Date(actividad.fecha_limite).toLocaleDateString('es-MX', {
              day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
            })}
          </div>
        )}
      </div>

      <div className="max-w-md mx-auto px-4 py-6">
        <form onSubmit={handleEnviar} className="space-y-4">

          {/* Nombre SM */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              Tu nombre
            </label>
            <AutocompleteSM
              sms={sms}
              valor={smQuery}
              onChange={setSmQuery}
              smSel={smSel}
              onSelect={(sm) => { setSmSel(sm); setSmQuery(''); }}
              onLimpiar={() => { setSmSel(null); setSmQuery(''); }}
            />
          </div>

          {/* Foto */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-3">
              Foto de evidencia
            </p>

            {fotoPreview ? (
              <div>
                <div className="relative">
                  <img
                    src={fotoPreview}
                    alt="vista previa"
                    className="w-full rounded-xl object-cover max-h-72 border border-slate-100"
                  />
                  <button
                    type="button"
                    onClick={() => { setFoto(null); setFotoPreview(null); }}
                    className="absolute top-2 right-2 bg-white/95 backdrop-blur-sm rounded-full w-8 h-8 flex items-center justify-center text-slate-600 hover:text-red-500 shadow-md border border-slate-100 font-bold text-sm"
                  >
                    ✕
                  </button>
                </div>
                {foto?.name && (
                  <p className="text-[11px] text-slate-400 mt-2 text-center truncate px-1">{foto.name}</p>
                )}
                {/* Cambiar foto */}
                <div className="flex gap-2 mt-3">
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-blue-200 bg-blue-50 hover:bg-blue-100 active:scale-[0.98] transition-all">
                      <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                      </svg>
                      <span className="text-xs font-bold text-blue-700">Nueva foto</span>
                    </div>
                    <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFoto} />
                  </label>
                  <label className="flex-1 cursor-pointer">
                    <div className="flex items-center justify-center gap-2 py-2.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 active:scale-[0.98] transition-all">
                      <svg className="w-4 h-4 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5z" />
                      </svg>
                      <span className="text-xs font-bold text-slate-600">Cambiar</span>
                    </div>
                    <input type="file" accept="image/*" className="hidden" onChange={handleFoto} />
                  </label>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5">
                {/* Botón: Tomar foto con cámara */}
                <label className="block cursor-pointer">
                  <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-blue-200 bg-blue-50 hover:border-blue-400 hover:bg-blue-100 active:scale-[0.98] transition-all select-none"
                    style={{ WebkitTapHighlightColor: 'transparent' }}>
                    <div className="w-12 h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm">
                      <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-blue-900">Tomar foto</p>
                      <p className="text-xs text-blue-600 mt-0.5">Abre la cámara del dispositivo</p>
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleFoto}
                  />
                </label>

                {/* Botón: Elegir de galería */}
                <label className="block cursor-pointer">
                  <div className="flex items-center gap-4 p-4 rounded-xl border-2 border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 active:scale-[0.98] transition-all select-none"
                    style={{ WebkitTapHighlightColor: 'transparent' }}>
                    <div className="w-12 h-12 bg-slate-100 rounded-xl flex items-center justify-center flex-shrink-0">
                      <svg className="w-6 h-6 text-slate-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909m-18 3.75h16.5a1.5 1.5 0 001.5-1.5V6a1.5 1.5 0 00-1.5-1.5H3.75A1.5 1.5 0 002.25 6v12a1.5 1.5 0 001.5 1.5zm10.5-11.25h.008v.008h-.008V8.25zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-800">Elegir de galería</p>
                      <p className="text-xs text-slate-500 mt-0.5">Selecciona una foto guardada</p>
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFoto}
                  />
                </label>
              </div>
            )}
          </div>

          {errorMsg && (
            <p className="text-sm text-red-500 font-medium text-center bg-red-50 rounded-xl px-4 py-3">{errorMsg}</p>
          )}

          <button
            type="submit"
            disabled={enviando || !foto || !smSel}
            className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold text-base py-3.5 rounded-xl transition-colors shadow-sm"
          >
            {enviando ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin inline-block" />
                Enviando…
              </span>
            ) : 'Enviar evidencia'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SubirEvidenciaActividad;
