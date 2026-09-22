import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { LiaArrowLeftSolid } from 'react-icons/lia';
import supabase from '../supabase/client';

const CURP_REGEX = /^[A-Z]{1}[AEIOUX]{1}[A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HM]{1}[A-Z]{2}[B-DF-HJ-NP-TV-Z]{3}[A-Z0-9]{1}\d{1}$/;

const BADGE_COLORS = [
  'bg-blue-100 text-blue-700',
  'bg-violet-100 text-violet-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
];

function badgeColor(str = '') {
  let hash = 0;
  for (const c of str) hash = (hash * 31 + c.charCodeAt(0)) & 0xffff;
  return BADGE_COLORS[hash % BADGE_COLORS.length];
}

function initials(sm) {
  return ((sm.nombre?.[0] ?? '') + (sm.a_paterno?.[0] ?? '')).toUpperCase();
}

function smFullName(sm) {
  return [sm.nombre, sm.a_paterno, sm.a_materno].filter(Boolean).join(' ');
}

function smMeta(sm) {
  return [
    sm.seccion ? `Sección ${sm.seccion}` : null,
    sm.poligono ? `Sector ${sm.poligono}` : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

// ── Field wrapper ──────────────────────────────────────────────────────────
function Field({ label, error, required, children, className = '' }) {
  return (
    <div className={className}>
      <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && (
        <p className="text-red-500 text-xs mt-1 pl-0.5">{error.message}</p>
      )}
    </div>
  );
}

// ── Input class helper ─────────────────────────────────────────────────────
const cx = (hasError) =>
  `w-full border rounded-xl py-2.5 px-3 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/10 transition-colors placeholder:text-slate-300 ${
    hasError
      ? 'border-red-300 bg-red-50 text-red-900'
      : 'border-slate-200 bg-white text-slate-800'
  }`;

// ── SM Searcher component ──────────────────────────────────────────────────
function SMSearcher({ sms, selected, onSelect, error }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const boxRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    function handler(e) {
      if (boxRef.current && !boxRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sms.slice(0, 20);
    return sms
      .filter((sm) => {
        const name = smFullName(sm).toLowerCase();
        return (
          name.includes(q) ||
          String(sm.seccion ?? '').includes(q) ||
          String(sm.poligono ?? '').toLowerCase().includes(q)
        );
      })
      .slice(0, 20);
  }, [sms, query]);

  const handleSelect = (sm) => {
    onSelect(sm);
    setQuery('');
    setOpen(false);
  };

  const handleClear = () => {
    onSelect(null);
    setQuery('');
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  return (
    <div ref={boxRef} className="relative">
      {selected ? (
        /* ── Selected chip ── */
        <div
          className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border ${
            error ? 'border-red-300 bg-red-50' : 'border-blue-200 bg-blue-50'
          }`}
        >
          <div
            className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${badgeColor(
              selected.usuario
            )}`}
          >
            {initials(selected)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-slate-800 truncate">
              {smFullName(selected)}
            </p>
            <p className="text-xs text-slate-400">{smMeta(selected)}</p>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="text-slate-400 hover:text-slate-700 transition-colors p-1 cursor-pointer"
            aria-label="Cambiar SM"
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <line x1="2" y1="2" x2="12" y2="12" />
              <line x1="12" y1="2" x2="2" y2="12" />
            </svg>
          </button>
        </div>
      ) : (
        /* ── Search input ── */
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none"
            width="15"
            height="15"
            viewBox="0 0 15 15"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
          >
            <circle cx="6.5" cy="6.5" r="4.5" />
            <line x1="10.5" y1="10.5" x2="13.5" y2="13.5" />
          </svg>
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            placeholder="Buscar por nombre, sección o sector…"
            autoComplete="off"
            className={`${
              error
                ? 'border-red-300 bg-red-50 text-red-900'
                : 'border-slate-200 bg-white text-slate-800'
            } w-full border rounded-xl py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-400/10 transition-colors placeholder:text-slate-300`}
          />
        </div>
      )}

      {/* ── Dropdown ── */}
      {open && !selected && (
        <div className="absolute z-50 top-full left-0 right-0 mt-1 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden max-h-60 overflow-y-auto">
          {filtered.length > 0 ? (
            filtered.map((sm) => (
              <button
                key={sm.usuario}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(sm)}
                className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-blue-50 active:bg-blue-100 transition-colors border-b border-slate-50 last:border-0 cursor-pointer"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${badgeColor(
                    sm.usuario
                  )}`}
                >
                  {initials(sm)}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {smFullName(sm)}
                  </p>
                  {smMeta(sm) && (
                    <p className="text-xs text-slate-400">{smMeta(sm)}</p>
                  )}
                </div>
              </button>
            ))
          ) : (
            <div className="px-4 py-5 text-center text-sm text-slate-400">
              Sin resultados para{' '}
              <span className="font-medium text-slate-600">"{query}"</span>
            </div>
          )}
        </div>
      )}

      {error && (
        <p className="text-red-500 text-xs mt-1 pl-0.5">{error}</p>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────
export default function MoviladoresGestion() {
  const navigate = useNavigate();
  const [sms, setSms] = useState([]);
  const [selectedSM, setSelectedSM] = useState(null);
  const [smError, setSmError] = useState(null);
  const [serverError, setServerError] = useState(null);
  const [success, setSuccess] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm();

  const [cpLoading, setCpLoading] = useState(false);
  const [cpColonias, setCpColonias] = useState([]);
  const [cpInfo, setCpInfo] = useState(null);
  const [cpError, setCpError] = useState(null);

  // ── CP lookup ──────────────────────────────────────────────────────────────
  const cpValue = watch('c_p');

  useEffect(() => {
    const cp = (cpValue || '').replace(/\D/g, '');
    if (cp.length !== 5) {
      setCpColonias([]);
      setCpInfo(null);
      setCpError(null);
      setValue('col_loc', '', { shouldValidate: false });
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setCpLoading(true);
      setCpError(null);
      try {
        const res = await fetch(
          `https://api.copomex.com/query/info_cp/${cp}?token=pruebas`
        );
        const json = await res.json();
        if (cancelled) return;

        if (json.error || !Array.isArray(json.response) || !json.response.length) {
          setCpError('Código postal no encontrado');
          setCpColonias([]);
          setCpInfo(null);
          return;
        }

        const colonias = [...new Set(json.response.map(r => r.d_asenta))];
        const municipio = json.response[0].D_mnpio || '';
        const estado = json.response[0].d_estado || '';
        const isEdoMex =
          estado.toLowerCase().includes('méxico') ||
          estado.toLowerCase().includes('estado de mexico');

        setCpColonias(colonias);
        setCpInfo({ municipio, estado, warn: !isEdoMex });
        setValue('col_loc', colonias.length === 1 ? colonias[0] : '', {
          shouldValidate: false,
        });
      } catch {
        if (!cancelled) setCpError('Error de red al consultar el C.P.');
      } finally {
        if (!cancelled) setCpLoading(false);
      }
    }, 500);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [cpValue, setValue]);

  // ── SM loader ──────────────────────────────────────────────────────────────
  useEffect(() => {
    // ilike = case-insensitive match, catches 'sm', 'SM', 'Sm'
    supabase
      .from('ciudadania')
      .select('usuario, nombre, a_paterno, a_materno, seccion, poligono')
      .ilike('puesto', 'sm')
      .eq('status', 'ACTIVO')
      .order('nombre')
      .then(({ data }) => setSms(data || []));
  }, []);

  const onSubmit = async (data) => {
    if (!selectedSM) {
      setSmError('Selecciona la SM responsable');
      return;
    }
    setSmError(null);
    setServerError(null);
    setSuccess(null);

    const record = {
      nombre: data.nombre.toUpperCase(),
      a_paterno: data.a_paterno.toUpperCase(),
      a_materno: data.a_materno.toUpperCase(),
      curp: data.curp.toUpperCase(),
      telefono_1: data.telefono_1,
      calle: data.calle.toUpperCase(),
      col_loc: data.col_loc.toUpperCase(),
      c_p: data.c_p,
      n_ext_mz: data.n_ext_mz.toUpperCase(),
      n_int_lt: data.n_int_lt ? data.n_int_lt.toUpperCase() : '',
      usuario: data.curp.toUpperCase(),
      puesto: 'MOVILIZADOR',
      movilizador: selectedSM.usuario,
      status: 'ACTIVO',
    };

    const { error } = await supabase.from('ciudadania').insert([record]);

    if (error) {
      setServerError(
        error.code === '23505'
          ? 'La CURP ingresada ya está registrada en el sistema'
          : `Error al guardar: ${error.message}`
      );
      return;
    }

    setSuccess(`${record.nombre} ${record.a_paterno} registrado correctamente`);
    const smToKeep = selectedSM;
    reset();
    setSelectedSM(smToKeep);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-5 mb-6 flex items-center gap-3">
        <button
          onClick={() => navigate(-1)}
          className="text-white/70 hover:text-white transition-colors cursor-pointer"
          aria-label="Regresar"
        >
          <LiaArrowLeftSolid size={22} />
        </button>
        <div>
          <h1 className="text-white font-bold text-lg leading-tight">
            Nuevo Movilizador
          </h1>
          <p className="text-blue-200 text-xs mt-0.5">
            Registro de movilizador de gestión
          </p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pb-12">
        {serverError && (
          <div
            role="alert"
            className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl mb-4 text-sm"
          >
            {serverError}
          </div>
        )}
        {success && (
          <div
            role="status"
            className="bg-emerald-50 border border-emerald-200 text-emerald-700 px-4 py-3 rounded-xl mb-4 text-sm font-medium"
          >
            {success}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
          {/* ── Asignación ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">
              Asignación
            </p>
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                SM Responsable
                <span className="text-red-400 ml-0.5">*</span>
              </label>
              <SMSearcher
                sms={sms}
                selected={selectedSM}
                onSelect={setSelectedSM}
                error={smError}
              />
            </div>
          </div>

          {/* ── Datos personales ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">
              Datos personales
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Nombre(s)" error={errors.nombre} required>
                <input
                  {...register('nombre', { required: 'Campo requerido' })}
                  type="text"
                  placeholder="JUAN PABLO"
                  autoComplete="given-name"
                  className={`${cx(errors.nombre)} uppercase`}
                />
              </Field>
              <Field label="Apellido Paterno" error={errors.a_paterno} required>
                <input
                  {...register('a_paterno', { required: 'Campo requerido' })}
                  type="text"
                  placeholder="GARCÍA"
                  autoComplete="family-name"
                  className={`${cx(errors.a_paterno)} uppercase`}
                />
              </Field>
              <Field label="Apellido Materno" error={errors.a_materno} required>
                <input
                  {...register('a_materno', { required: 'Campo requerido' })}
                  type="text"
                  placeholder="LÓPEZ"
                  className={`${cx(errors.a_materno)} uppercase`}
                />
              </Field>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
              <div className="sm:col-span-2">
                <Field label="CURP" error={errors.curp} required>
                  <input
                    {...register('curp', {
                      required: 'Campo requerido',
                      setValueAs: v => (v || '').toUpperCase().trim(),
                      pattern: {
                        value: CURP_REGEX,
                        message: 'CURP inválida — verifica el formato',
                      },
                    })}
                    type="text"
                    maxLength={18}
                    placeholder="GALO800101HMCRZN09"
                    autoComplete="off"
                    className={`${cx(errors.curp)} uppercase tracking-wider`}
                  />
                </Field>
              </div>
              <Field label="Teléfono" error={errors.telefono_1} required>
                <input
                  {...register('telefono_1', {
                    required: 'Campo requerido',
                    pattern: {
                      value: /^\d{10}$/,
                      message: '10 dígitos requeridos',
                    },
                  })}
                  type="tel"
                  maxLength={10}
                  placeholder="5512345678"
                  autoComplete="tel"
                  className={cx(errors.telefono_1)}
                />
              </Field>
            </div>
          </div>

          {/* ── Domicilio ── */}
          <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-4">
              Domicilio
            </p>

            <div className="space-y-4">
              {/* C.P. primero — dispara la búsqueda */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                  Código Postal<span className="text-red-400 ml-0.5">*</span>
                </label>
                <div className="relative w-36">
                  <input
                    {...register('c_p', {
                      required: 'Requerido',
                      pattern: { value: /^\d{5}$/, message: '5 dígitos' },
                    })}
                    type="text"
                    maxLength={5}
                    placeholder="55000"
                    autoComplete="postal-code"
                    className={`${cx(errors.c_p)} pr-8`}
                  />
                  {cpLoading && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <svg className="animate-spin w-4 h-4 text-blue-400"
                        viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10"
                          stroke="currentColor" strokeWidth="3" />
                        <path className="opacity-75" fill="currentColor"
                          d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
                      </svg>
                    </div>
                  )}
                  {!cpLoading && cpInfo && (
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                      <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="6" fill="#10b981" />
                        <polyline points="4,7 6.5,9.5 10,5"
                          stroke="white" strokeWidth="1.8"
                          strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* Error de campo */}
                {errors.c_p && (
                  <p className="text-red-500 text-xs mt-1 pl-0.5">{errors.c_p.message}</p>
                )}

                {/* Info tag — municipio + estado */}
                {cpInfo && !cpError && (
                  <div className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border ${
                    cpInfo.warn
                      ? 'bg-amber-50 border-amber-200 text-amber-700'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-700'
                  }`}>
                    {cpInfo.warn ? (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
                        <path d="M6 1L11 10H1L6 1z" />
                        <rect x="5.4" y="4.5" width="1.2" height="3" rx="0.5" fill="white"/>
                        <circle cx="6" cy="8.5" r="0.6" fill="white"/>
                      </svg>
                    ) : (
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
                        <polyline points="3.5,6 5.5,8 8.5,4"
                          stroke="currentColor" strokeWidth="1.2"
                          strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    )}
                    <span>{cpInfo.municipio}, {cpInfo.estado}</span>
                    {cpInfo.warn && (
                      <span className="text-amber-600 font-normal">· fuera de Tecámac</span>
                    )}
                  </div>
                )}

                {/* Error de API */}
                {cpError && (
                  <p className="text-red-500 text-xs mt-1.5 pl-0.5">{cpError}</p>
                )}
              </div>

              {/* Colonia — select si la API respondió, input libre si no */}
              <div className="grid grid-cols-12 gap-3">
                <div className="col-span-12 sm:col-span-7">
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">
                    Colonia<span className="text-red-400 ml-0.5">*</span>
                  </label>

                  {cpColonias.length > 0 ? (
                    <select
                      {...register('col_loc', { required: 'Selecciona una colonia' })}
                      className={cx(errors.col_loc)}
                    >
                      <option value="">— Selecciona colonia —</option>
                      {cpColonias.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      {...register('col_loc', { required: 'Campo requerido' })}
                      type="text"
                      placeholder="CENTRO"
                      autoComplete="address-level3"
                      className={`${cx(errors.col_loc)} uppercase`}
                    />
                  )}

                  {errors.col_loc && (
                    <p className="text-red-500 text-xs mt-1 pl-0.5">{errors.col_loc.message}</p>
                  )}
                </div>

                <div className="col-span-6 sm:col-span-3">
                  <Field label="N° Ext" error={errors.n_ext_mz} required>
                    <input
                      {...register('n_ext_mz', { required: 'Requerido' })}
                      type="text"
                      placeholder="12"
                      className={`${cx(errors.n_ext_mz)} uppercase`}
                    />
                  </Field>
                </div>
                <div className="col-span-6 sm:col-span-2">
                  <Field label="N° Int" error={errors.n_int_lt}>
                    <input
                      {...register('n_int_lt')}
                      type="text"
                      placeholder="A2"
                      className={`${cx(false)} uppercase`}
                    />
                  </Field>
                </div>
              </div>

              {/* Calle */}
              <Field label="Calle" error={errors.calle} required>
                <input
                  {...register('calle', { required: 'Campo requerido' })}
                  type="text"
                  placeholder="AV. PRINCIPAL"
                  autoComplete="street-address"
                  className={`${cx(errors.calle)} uppercase`}
                />
              </Field>
            </div>
          </div>

          {/* ── Acciones ── */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={() => navigate(-1)}
              className="flex-1 py-3 rounded-xl border border-slate-200 text-slate-600 text-sm font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-[2] py-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {isSubmitting ? 'Guardando…' : 'Registrar Movilizador'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
