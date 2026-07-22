import React, { useState, useEffect } from "react";
import supabase from '../supabase/client';
import { useLocation, useNavigate, useParams } from "react-router-dom";

const STATUS_BADGE = {
  COMPROBADO: 'bg-emerald-100 text-emerald-700 border-emerald-200',
  FUERA_DE_TIEMPO: 'bg-amber-100 text-amber-700 border-amber-200',
  PENDIENTE: 'bg-slate-100 text-slate-500 border-slate-200',
};

const STATUS_LABEL = {
  COMPROBADO: 'Comprobado ✓',
  FUERA_DE_TIEMPO: 'Fuera de tiempo ⏰',
  PENDIENTE: 'Pendiente',
};

const WaterSurveyForm = () => {
  const { state } = useLocation();
  const { user } = state || {};
  const { usuario } = useParams();
  const navigate = useNavigate();

  const [actividades, setActividades] = useState([]);
  const [evidencias, setEvidencias] = useState([]);
  const [uploading, setUploading] = useState({});
  const [loadingActs, setLoadingActs] = useState(true);

  useEffect(() => {
    if (!user) return;
    fetchActividades();
  }, []);

  const fetchActividades = async () => {
    setLoadingActs(true);
    const [actsRes, evsRes] = await Promise.all([
      supabase.from('actividades').select('*').order('created_at', { ascending: false }),
      supabase.from('evidencias_actividades').select('*').eq('ciudadano_id', user.id),
    ]);
    setActividades((actsRes.data ?? []).filter(a => a.puesto === 'SM' || a.puesto?.includes('SM')));
    setEvidencias(evsRes.data ?? []);
    setLoadingActs(false);
  };

  const getEstado = (actividad) => {
    const ev = evidencias.find(e => e.actividad_id === actividad.id);
    if (ev) return { status: ev.status, evidencia: ev };
    if (actividad.fecha_limite && new Date() > new Date(actividad.fecha_limite)) return { status: 'VENCIDO' };
    return { status: 'PENDIENTE' };
  };

  const handleSubirEvidencia = async (e, actividad) => {
    const file = e.target.files[0];
    if (!file || !user) return;
    setUploading(prev => ({ ...prev, [actividad.id]: true }));

    const filePath = `evidencias/${actividad.id}/${user.ubt}-${user.curp}-${Date.now()}`;
    const { error: uploadError } = await supabase.storage
      .from('evidencias_actividades')
      .upload(filePath, file, { upsert: false });

    if (uploadError) {
      alert('Error al subir imagen: ' + uploadError.message);
      setUploading(prev => ({ ...prev, [actividad.id]: false }));
      return;
    }

    const { data: urlData } = supabase.storage.from('evidencias_actividades').getPublicUrl(filePath);

    const vencida = actividad.fecha_limite && new Date() > new Date(actividad.fecha_limite);
    const statusEv = vencida ? 'FUERA_DE_TIEMPO' : 'COMPROBADO';

    const { error: dbError } = await supabase.from('evidencias_actividades').insert({
      actividad_id: actividad.id,
      ciudadano_id: user.id,
      nombre_sm: `${user.nombre} ${user.a_paterno} ${user.a_materno}`,
      poligono: user.poligono,
      seccion: user.seccion,
      ubt: user.ubt,
      url_evidencia: urlData.publicUrl,
      status: statusEv,
    });

    setUploading(prev => ({ ...prev, [actividad.id]: false }));
    if (dbError) { alert('Error al registrar evidencia: ' + dbError.message); return; }
    fetchActividades();
  };

  if (!user) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center">
      <p className="text-slate-500">Sesión no encontrada. Por favor inicia sesión.</p>
    </div>
  );

  const comprobadas = evidencias.filter(e => e.status === 'COMPROBADO').length;
  const fueraTiempo = evidencias.filter(e => e.status === 'FUERA_DE_TIEMPO').length;
  const pendientes = actividades.filter(a => {
    const ev = evidencias.find(e => e.actividad_id === a.id);
    return !ev;
  }).length;

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-6">
        <div className="flex items-center gap-4">
          {user.url_foto_perfil ? (
            <img src={user.url_foto_perfil} alt="foto" className="w-14 h-14 rounded-full object-cover border-2 border-white/30 shadow-md" onError={e => e.target.style.display = 'none'} />
          ) : (
            <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center text-xl font-bold text-white">
              {user.nombre?.[0]}{user.a_paterno?.[0]}
            </div>
          )}
          <div>
            <p className="text-blue-200 text-xs font-medium">Secretaria de Manzana</p>
            <h1 className="text-white font-bold text-lg leading-tight">{user.nombre} {user.a_paterno}</h1>
          </div>
        </div>

        {/* Stats territoriales */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          {[['Sector', user.poligono], ['Sección', user.seccion], ['Fracción', user.ubt]].map(([label, val]) => (
            <div key={label} className="bg-white/10 rounded-xl p-2.5 text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-blue-200">{label}</p>
              <p className="text-sm font-bold text-white mt-0.5">{val || '—'}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-5 space-y-4">
        {/* Apoyos */}
        <button
          onClick={() => navigate(`/apoyos/${usuario}`, { state: { user } })}
          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-3 px-4 rounded-xl font-semibold text-sm transition-colors shadow-sm"
        >
          🎁 Apoyos y Programas Sociales
        </button>

        {/* Resumen de actividades */}
        {actividades.length > 0 && (
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Comprobadas</p>
              <p className="text-xl font-bold text-emerald-600 mt-0.5">{comprobadas}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">F. de Tiempo</p>
              <p className="text-xl font-bold text-amber-500 mt-0.5">{fueraTiempo}</p>
            </div>
            <div className="bg-white rounded-xl border border-slate-100 shadow-sm p-3 text-center">
              <p className="text-[9px] font-bold uppercase tracking-widest text-slate-400">Pendientes</p>
              <p className="text-xl font-bold text-slate-700 mt-0.5">{pendientes}</p>
            </div>
          </div>
        )}

        {/* Lista de actividades */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100">
            <p className="text-sm font-bold text-slate-800">Mis Actividades</p>
            <p className="text-[11px] text-slate-400 mt-0.5">Actividades asignadas a tu puesto</p>
          </div>

          {loadingActs && (
            <div className="text-center py-10">
              <div className="w-6 h-6 border-4 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm text-slate-400">Cargando actividades…</p>
            </div>
          )}

          {!loadingActs && actividades.length === 0 && (
            <div className="text-center py-12 text-slate-300">
              <p className="text-3xl mb-2">📋</p>
              <p className="text-sm font-medium text-slate-400">No hay actividades asignadas aún</p>
            </div>
          )}

          {!loadingActs && actividades.map(act => {
            const { status, evidencia } = getEstado(act);
            const vencida = act.fecha_limite && new Date() > new Date(act.fecha_limite);
            const puedeSubir = status === 'PENDIENTE' || status === 'VENCIDO';

            return (
              <div key={act.id} className="border-b border-slate-50 last:border-0 p-5">
                <div className="flex items-start justify-between gap-3 mb-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-slate-800">{act.nombre}</p>
                    {act.indicacion && <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{act.indicacion}</p>}
                    {act.fecha_limite && (
                      <p className={`text-[10px] font-semibold mt-1 ${vencida ? 'text-red-500' : 'text-slate-400'}`}>
                        {vencida ? '⚠ Venció: ' : '⏱ Límite: '}
                        {new Date(act.fecha_limite).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </p>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border flex-shrink-0 ${STATUS_BADGE[status] || STATUS_BADGE.PENDIENTE}`}>
                    {STATUS_LABEL[status] || (status === 'VENCIDO' ? 'Vencido ⚠' : status)}
                  </span>
                </div>

                {evidencia?.url_evidencia && (
                  <div className="mt-2 mb-3">
                    <img src={evidencia.url_evidencia} alt="Evidencia" className="w-full max-h-40 object-cover rounded-lg border border-slate-100" />
                    <p className="text-[10px] text-slate-400 mt-1">
                      Enviada: {new Date(evidencia.fecha_subida).toLocaleDateString('es-MX', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                )}

                {puedeSubir && (
                  <label className="block mt-2 cursor-pointer">
                    <span className={`inline-block text-xs font-semibold px-4 py-2 rounded-lg transition-colors ${
                      vencida
                        ? 'bg-amber-500 hover:bg-amber-600 text-white'
                        : 'bg-blue-600 hover:bg-blue-700 text-white'
                    } ${uploading[act.id] ? 'opacity-60 pointer-events-none' : ''}`}>
                      {uploading[act.id] ? 'Subiendo…' : vencida ? '⏰ Subir evidencia (fuera de tiempo)' : '📎 Subir evidencia'}
                    </span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={e => handleSubirEvidencia(e, act)}
                      disabled={uploading[act.id]}
                    />
                  </label>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WaterSurveyForm;
