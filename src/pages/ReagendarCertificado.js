import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../supabase/client";

const HORA_INICIO = 9;
const HORA_FIN = 15;
const CUPO_POR_SLOT = 3;
const DIAS_VENTANA = 14;
const FECHA_INICIO_REGISTRO = "2026-07-16"; // jueves 16 de julio
const HORA_INICIO_PRIMER_DIA = "09:30";

const fechaISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const diasHabiles = (dias) => {
  const out = [];
  const hoy = new Date();
  for (let i = 0; i < dias; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i);
    const dow = d.getDay();
    const iso = fechaISO(d);
    if (dow >= 1 && dow <= 5 && iso >= FECHA_INICIO_REGISTRO) {
      out.push({ iso, label: d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" }) });
    }
  }
  return out;
};

const horariosDelDia = (fechaIso) => {
  const out = [];
  for (let h = HORA_INICIO; h < HORA_FIN; h++) {
    for (let m = 0; m < 60; m += 15) out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
  if (fechaIso === FECHA_INICIO_REGISTRO) return out.filter((h) => h >= HORA_INICIO_PRIMER_DIA);
  return out;
};

const ReagendarCertificado = () => {
  const navigate = useNavigate();
  const dias = useMemo(() => diasHabiles(DIAS_VENTANA), []);

  const [folio, setFolio] = useState("");
  const [curp, setCurp] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [errorBusqueda, setErrorBusqueda] = useState("");
  const [registro, setRegistro] = useState(null);

  const [fechaNueva, setFechaNueva] = useState("");
  const [horaNueva, setHoraNueva] = useState("");
  const horarios = useMemo(() => horariosDelDia(fechaNueva), [fechaNueva]);
  const [ocupacion, setOcupacion] = useState({});
  const [cargandoOcupacion, setCargandoOcupacion] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState("");

  const buscar = async () => {
    if (!folio.trim() || !curp.trim()) {
      setErrorBusqueda("Ingresa el folio y la CURP del tutor con la que te registraste.");
      return;
    }
    setBuscando(true);
    setErrorBusqueda("");
    setRegistro(null);
    try {
      const { data, error } = await supabase
        .from("beneficiarios_certificados")
        .select("*")
        .eq("folio", folio.trim().toUpperCase())
        .eq("tutor_curp", curp.trim().toUpperCase())
        .maybeSingle();
      if (error) throw error;
      if (!data) {
        setErrorBusqueda("No se encontró ninguna cita con ese folio y CURP.");
        return;
      }
      if (data.status === "CANCELADA") {
        setErrorBusqueda("Esta cita fue cancelada.");
        return;
      }
      setRegistro(data);
      setFechaNueva(data.fecha_cita);
      setHoraNueva(String(data.hora_cita).slice(0, 5));
    } catch (err) {
      setErrorBusqueda("Error al buscar: " + err.message);
    } finally {
      setBuscando(false);
    }
  };

  useEffect(() => {
    if (!registro) return;
    const cargar = async () => {
      setCargandoOcupacion(true);
      const { data, error } = await supabase
        .from("beneficiarios_certificados")
        .select("fecha_cita, hora_cita")
        .in("fecha_cita", dias.map((d) => d.iso))
        .in("status", ["AGENDADA", "REAGENDADA"])
        .neq("id", registro.id);
      if (!error) {
        const conteo = {};
        (data ?? []).forEach((r) => {
          const key = `${r.fecha_cita}_${String(r.hora_cita).slice(0, 5)}`;
          conteo[key] = (conteo[key] ?? 0) + 1;
        });
        setOcupacion(conteo);
      }
      setCargandoOcupacion(false);
    };
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [registro]);

  const guardarNuevaCita = async () => {
    if (!fechaNueva || !horaNueva) {
      alert("Selecciona fecha y horario.");
      return;
    }
    setGuardando(true);
    setErrorGuardar("");
    try {
      const { count } = await supabase
        .from("beneficiarios_certificados")
        .select("*", { count: "exact", head: true })
        .eq("fecha_cita", fechaNueva)
        .eq("hora_cita", horaNueva)
        .in("status", ["AGENDADA", "REAGENDADA"])
        .neq("id", registro.id);
      if ((count ?? 0) >= CUPO_POR_SLOT) {
        setErrorGuardar("Ese horario se llenó. Elige otro.");
        setGuardando(false);
        return;
      }
      const { error } = await supabase
        .from("beneficiarios_certificados")
        .update({ fecha_cita: fechaNueva, hora_cita: horaNueva, status: "REAGENDADA" })
        .eq("id", registro.id);
      if (error) throw error;
      setConfirmado(true);
    } catch (err) {
      setErrorGuardar("Error al reagendar: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-slate-800">Buscar / reagendar cita</h1>
          <button onClick={() => navigate("/registro-certificado-medico")} className="text-sm text-blue-600 hover:underline">
            ← Volver al registro
          </button>
        </div>

        {!registro && (
          <div className="border rounded-lg p-3 bg-white shadow-sm">
            <input placeholder="Folio (ej. CM-AB12CD)" value={folio} onChange={(e) => setFolio(e.target.value.toUpperCase())} className="border p-2 rounded w-full mb-2" />
            <input placeholder="CURP del tutor" maxLength={18} value={curp} onChange={(e) => setCurp(e.target.value.toUpperCase())} className="border p-2 rounded w-full mb-2" />
            {errorBusqueda && <p className="text-sm text-red-600 mb-2">{errorBusqueda}</p>}
            <button onClick={buscar} disabled={buscando} className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50">
              {buscando ? "Buscando..." : "Buscar mi cita"}
            </button>
          </div>
        )}

        {registro && !confirmado && (
          <div className="border rounded-lg p-3 bg-white shadow-sm">
            <p className="text-sm text-slate-600 mb-1">
              Tutor: <strong>{registro.tutor_nombre} {registro.tutor_a_paterno} {registro.tutor_a_materno}</strong>
            </p>
            <p className="text-sm text-slate-600 mb-3">
              Cita actual: <strong>{registro.fecha_cita}</strong> a las <strong>{String(registro.hora_cita).slice(0, 5)}</strong> hrs
            </p>

            <p className="text-xs text-slate-500 mb-2">Elige nueva fecha y horario:</p>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {dias.map((d) => (
                <button
                  key={d.iso}
                  type="button"
                  onClick={() => { setFechaNueva(d.iso); setHoraNueva(""); }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                    fechaNueva === d.iso ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>

            {fechaNueva && (
              cargandoOcupacion ? (
                <p className="text-sm text-slate-400">Cargando horarios...</p>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5 mb-3">
                  {horarios.map((h) => {
                    const ocupados = ocupacion[`${fechaNueva}_${h}`] ?? 0;
                    const lleno = ocupados >= CUPO_POR_SLOT;
                    return (
                      <button
                        key={h}
                        type="button"
                        disabled={lleno}
                        onClick={() => setHoraNueva(h)}
                        className={`px-2 py-1.5 rounded-lg text-xs font-medium border ${
                          lleno
                            ? "bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed"
                            : horaNueva === h
                              ? "bg-emerald-600 text-white border-emerald-600"
                              : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                        }`}
                      >
                        {h} {lleno ? "· lleno" : `· ${CUPO_POR_SLOT - ocupados} lib.`}
                      </button>
                    );
                  })}
                </div>
              )
            )}

            {errorGuardar && <p className="text-sm text-red-600 mb-2">{errorGuardar}</p>}
            <button
              onClick={guardarNuevaCita}
              disabled={guardando || !fechaNueva || !horaNueva}
              className="bg-emerald-600 text-white px-4 py-2 rounded text-sm disabled:opacity-40"
            >
              {guardando ? "Guardando..." : "Confirmar nuevo horario"}
            </button>
          </div>
        )}

        {confirmado && (
          <div className="border rounded-lg p-4 bg-white shadow-sm text-center">
            <p className="text-emerald-600 text-3xl mb-2">✔</p>
            <h2 className="text-lg font-bold text-slate-800 mb-1">¡Cita reagendada!</h2>
            <p className="text-sm text-slate-600">
              Nueva cita: <strong>{fechaNueva}</strong> a las <strong>{horaNueva}</strong> hrs.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ReagendarCertificado;
