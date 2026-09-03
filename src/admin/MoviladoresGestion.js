import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LiaArrowLeftSolid } from 'react-icons/lia';
import supabase from '../supabase/client';

const CURP_REGEX = /^[A-Z]{1}[AEIOUX]{1}[A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HM]{1}[A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]{1}\d{1}$/;

const emptyRow = () => ({ nombre: '', curp: '', seccion: '' });

export default function MoviladoresGestion() {
  const navigate = useNavigate();
  const [sms, setSms] = useState([]);
  const [selectedSM, setSelectedSM] = useState('');
  const [rows, setRows] = useState(Array.from({ length: 10 }, emptyRow));
  const [rowErrors, setRowErrors] = useState(Array(10).fill({}));
  const [globalError, setGlobalError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    supabase
      .from('ciudadania')
      .select('usuario, nombre, a_paterno, a_materno, seccion')
      .eq('puesto', 'sm')
      .eq('status', 'ACTIVO')
      .order('nombre')
      .then(({ data }) => setSms(data || []));
  }, []);

  const handleChange = (index, field, value) => {
    setRows(prev => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value.toUpperCase() };
      return next;
    });
    if (rowErrors[index]?.[field]) {
      setRowErrors(prev => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: undefined };
        return next;
      });
    }
  };

  const validate = () => {
    const touched = rows.filter(r => r.nombre || r.curp || r.seccion);
    if (!touched.length) {
      setGlobalError('Ingresa al menos un movilizador');
      return false;
    }
    let valid = true;
    const newErrors = rows.map(r => {
      if (!r.nombre && !r.curp && !r.seccion) return {};
      const e = {};
      if (!r.nombre) { e.nombre = 'Requerido'; valid = false; }
      if (!r.curp) { e.curp = 'Requerido'; valid = false; }
      else if (!CURP_REGEX.test(r.curp)) { e.curp = 'CURP inválido'; valid = false; }
      if (!r.seccion) { e.seccion = 'Requerido'; valid = false; }
      return e;
    });
    setRowErrors(newErrors);
    return valid;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setGlobalError(null);
    setSuccess(null);

    if (!selectedSM) {
      setGlobalError('Selecciona la SM responsable');
      return;
    }
    if (!validate()) return;

    setLoading(true);
    try {
      const records = rows
        .filter(r => r.nombre && r.curp && r.seccion)
        .map(r => ({
          nombre: r.nombre,
          curp: r.curp,
          seccion: r.seccion,
          usuario: r.curp,
          puesto: 'MOVILIZADOR',
          movilizador: selectedSM,
          status: 'ACTIVO',
        }));

      const { error } = await supabase.from('ciudadania').insert(records);
      if (error) {
        setGlobalError(
          error.code === '23505'
            ? 'Uno o más CURP ya están registrados'
            : `Error al guardar: ${error.message}`
        );
        return;
      }

      setSuccess(`${records.length} movilizador(es) registrado(s) correctamente`);
      setRows(Array.from({ length: 10 }, emptyRow));
      setSelectedSM('');
      setRowErrors(Array(10).fill({}));
    } catch {
      setGlobalError('Error inesperado al guardar');
    } finally {
      setLoading(false);
    }
  };

  const smLabel = (sm) =>
    [sm.nombre, sm.a_paterno, sm.a_materno].filter(Boolean).join(' ');

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-5 mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-white/70 hover:text-white transition-colors"
        >
          <LiaArrowLeftSolid size={22} />
        </button>
        <div>
          <h1 className="text-white font-bold text-lg leading-tight">
            Movilizadores de Gestión
          </h1>
          <p className="text-blue-200 text-xs mt-0.5">
            Registro de movilizadores por SM
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 pb-12">
        {globalError && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm">
            {globalError}
          </div>
        )}
        {success && (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl mb-4 text-sm font-medium">
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* SM selector */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              SM Responsable
            </label>
            <select
              value={selectedSM}
              onChange={e => setSelectedSM(e.target.value)}
              className="w-full border border-slate-200 rounded-xl py-2.5 px-3 text-sm text-slate-800 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/10 bg-white"
            >
              <option value="">— Seleccionar SM —</option>
              {sms.map(sm => (
                <option key={sm.usuario} value={sm.usuario}>
                  {smLabel(sm)}{sm.seccion ? ` · Sección ${sm.seccion}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Filas de movilizadores */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">
              Movilizadores — máx. 10
            </p>

            {/* Encabezados */}
            <div className="grid grid-cols-12 gap-2 mb-2 px-1">
              <div className="col-span-1" />
              <div className="col-span-5 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Nombre completo
              </div>
              <div className="col-span-4 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                CURP
              </div>
              <div className="col-span-2 text-[10px] font-bold uppercase tracking-widest text-slate-400">
                Sección
              </div>
            </div>

            <div className="space-y-2">
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-1 flex items-center justify-center h-9">
                    <span className="text-xs font-bold text-slate-300">{i + 1}</span>
                  </div>

                  <div className="col-span-5">
                    <input
                      type="text"
                      placeholder="Nombre"
                      value={r.nombre}
                      onChange={e => handleChange(i, 'nombre', e.target.value)}
                      className={`w-full border rounded-lg py-2 px-3 text-sm uppercase placeholder:capitalize placeholder:text-slate-300 focus:outline-none focus:border-blue-400 transition-colors ${
                        rowErrors[i]?.nombre
                          ? 'border-red-300 bg-red-50'
                          : 'border-slate-200'
                      }`}
                    />
                    {rowErrors[i]?.nombre && (
                      <p className="text-red-500 text-[10px] mt-0.5 pl-1">
                        {rowErrors[i].nombre}
                      </p>
                    )}
                  </div>

                  <div className="col-span-4">
                    <input
                      type="text"
                      placeholder="CURP"
                      maxLength={18}
                      value={r.curp}
                      onChange={e => handleChange(i, 'curp', e.target.value)}
                      className={`w-full border rounded-lg py-2 px-3 text-sm uppercase placeholder:capitalize placeholder:text-slate-300 focus:outline-none focus:border-blue-400 transition-colors ${
                        rowErrors[i]?.curp
                          ? 'border-red-300 bg-red-50'
                          : 'border-slate-200'
                      }`}
                    />
                    {rowErrors[i]?.curp && (
                      <p className="text-red-500 text-[10px] mt-0.5 pl-1">
                        {rowErrors[i].curp}
                      </p>
                    )}
                  </div>

                  <div className="col-span-2">
                    <input
                      type="text"
                      placeholder="000"
                      value={r.seccion}
                      onChange={e => handleChange(i, 'seccion', e.target.value)}
                      className={`w-full border rounded-lg py-2 px-3 text-sm placeholder:text-slate-300 focus:outline-none focus:border-blue-400 transition-colors ${
                        rowErrors[i]?.seccion
                          ? 'border-red-300 bg-red-50'
                          : 'border-slate-200'
                      }`}
                    />
                    {rowErrors[i]?.seccion && (
                      <p className="text-red-500 text-[10px] mt-0.5 pl-1">
                        {rowErrors[i].seccion}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Acciones */}
          <div className="flex gap-3">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors disabled:opacity-50"
            >
              {loading ? 'Guardando...' : 'Guardar Movilizadores'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
