import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { QRCodeSVG } from "qrcode.react";
import supabase from "../supabase/client";
import EscanerQR from "../componentes/EscanerQR";
import codigosPostalesData from "../codigospostales.json";
import { datosDesdeTextoQR } from "../utils/curp";

const HORA_INICIO = 9;
const HORA_FIN = 15; // última cita inicia 14:45
const CUPO_POR_SLOT = 3;
const DIAS_VENTANA = 14;
const FECHA_INICIO_REGISTRO = "2026-07-16"; // jueves 16 de julio
const HORA_INICIO_PRIMER_DIA = "09:30";

const generarFolio = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 6; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return `CM-${s}`;
};

const fechaISO = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const diasHabiles = (dias) => {
  const out = [];
  const hoy = new Date();
  for (let i = 0; i < dias; i++) {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i);
    const dow = d.getDay();
    const iso = fechaISO(d);
    if (dow >= 1 && dow <= 5 && iso >= FECHA_INICIO_REGISTRO) {
      out.push({
        iso,
        label: d.toLocaleDateString("es-MX", { weekday: "short", day: "numeric", month: "short" }),
      });
    }
  }
  return out;
};

// El registro arranca el jueves 16 a las 9:30 (los demás días siguen con horario normal desde las 9:00).
const horariosDelDia = (fechaIso) => {
  const out = [];
  for (let h = HORA_INICIO; h < HORA_FIN; h++) {
    for (let m = 0; m < 60; m += 15) {
      out.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
    }
  }
  if (fechaIso === FECHA_INICIO_REGISTRO) {
    return out.filter((h) => h >= HORA_INICIO_PRIMER_DIA);
  }
  return out;
};

const StepHeader = ({ n, total, titulo }) => (
  <div className="mb-3">
    <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest">Paso {n} de {total}</p>
    <h2 className="text-lg font-bold text-slate-800">{titulo}</h2>
  </div>
);

// Confirmación de datos de una persona ya escaneada (tutor o menor), reutilizada para ambos.
const ConfirmarPersona = ({ datosCurp, form, setForm, onConfirmar, onReescanear, error, edadMinima, edadMaxima, textoRequisito }) => {
  const cumpleEdad =
    (edadMinima == null || datosCurp.edad >= edadMinima) &&
    (edadMaxima == null || datosCurp.edad < edadMaxima);
  const bloqueado = !cumpleEdad ? textoRequisito : datosCurp.bloqueo || null;

  return (
    <div className="border rounded-lg p-3 bg-white shadow-sm">
      <p className="text-sm text-slate-600">CURP detectada: <span className="font-mono font-semibold">{datosCurp.curp}</span></p>
      <p className="text-sm text-slate-600 mb-2">Edad calculada: <strong>{datosCurp.edad} años</strong> · Sexo: {datosCurp.sexo ?? "—"}</p>

      {bloqueado ? (
        <div className="bg-red-50 border border-red-200 rounded p-3 mt-2">
          <p className="text-sm text-red-700 font-semibold">{bloqueado}</p>
          <button type="button" onClick={onReescanear} className="mt-2 text-sm text-blue-600 hover:underline">
            Escanear otra CURP
          </button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-2">
            <input placeholder="Nombre" value={form.nombre} onChange={(e) => setForm({ ...form, nombre: e.target.value.toUpperCase() })} className="border p-2 rounded" />
            <input placeholder="Apellido Paterno" value={form.a_paterno} onChange={(e) => setForm({ ...form, a_paterno: e.target.value.toUpperCase() })} className="border p-2 rounded" />
            <input placeholder="Apellido Materno" value={form.a_materno} onChange={(e) => setForm({ ...form, a_materno: e.target.value.toUpperCase() })} className="border p-2 rounded" />
          </div>
          {error && <p className="text-sm text-red-600 mt-1">{error}</p>}
          <div className="flex gap-2 mt-3">
            <button type="button" onClick={onConfirmar} className="bg-emerald-600 text-white px-4 py-2 rounded text-sm">
              Continuar
            </button>
            <button type="button" onClick={onReescanear} className="text-sm text-slate-500 hover:underline">
              Escanear de nuevo
            </button>
          </div>
        </>
      )}
    </div>
  );
};

const RegistroCertificadoMedico = () => {
  const navigate = useNavigate();
  const [paso, setPaso] = useState("tutor-scan");

  // Tutor
  const [tutorCurpDatos, setTutorCurpDatos] = useState(null);
  const [tutorForm, setTutorForm] = useState({ nombre: "", a_paterno: "", a_materno: "" });
  const [errorTutor, setErrorTutor] = useState("");
  const [errorEscaneo, setErrorEscaneo] = useState("");
  const [textoEscaneadoCrudo, setTextoEscaneadoCrudo] = useState("");
  const [verificandoDuplicado, setVerificandoDuplicado] = useState(false);

  // Contacto: por temas legales solo se pide teléfono, código postal y colonia (nada de domicilio ni sección)
  const [cp, setCp] = useState("");
  const [colonia, setColonia] = useState("");
  const [colonias, setColonias] = useState([]);
  const [telefono, setTelefono] = useState("");
  const [errorTelefono, setErrorTelefono] = useState("");

  // Menores
  const [numMenores, setNumMenores] = useState(1);
  const [menores, setMenores] = useState([]);
  const [menorCurpDatos, setMenorCurpDatos] = useState(null);
  const [menorForm, setMenorForm] = useState({ nombre: "", a_paterno: "", a_materno: "" });
  const [errorMenor, setErrorMenor] = useState("");

  // Cita
  const dias = useMemo(() => diasHabiles(DIAS_VENTANA), []);
  const [fechaCita, setFechaCita] = useState("");
  const horarios = useMemo(() => horariosDelDia(fechaCita), [fechaCita]);
  const [horaCita, setHoraCita] = useState("");
  const [ocupacion, setOcupacion] = useState({});
  const [cargandoOcupacion, setCargandoOcupacion] = useState(false);

  // Encuesta + envío
  const [comoSeEntero, setComoSeEntero] = useState("");
  const [comoSeEnteroOtro, setComoSeEnteroOtro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [errorEnvio, setErrorEnvio] = useState("");
  const [folioFinal, setFolioFinal] = useState(null);

  useEffect(() => {
    if (paso !== "cita") return;
    const cargar = async () => {
      setCargandoOcupacion(true);
      const { data, error } = await supabase
        .from("beneficiarios_certificados")
        .select("fecha_cita, hora_cita")
        .in("fecha_cita", dias.map((d) => d.iso))
        .in("status", ["AGENDADA", "REAGENDADA"]);
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
  }, [paso]);

  // El navegador sugiere el <title> como nombre de archivo al "Guardar como PDF"
  // desde el diálogo de impresión, así que en el comprobante lo cambiamos al
  // nombre del tutor y lo regresamos a como estaba al salir de ese paso.
  useEffect(() => {
    if (paso !== "confirmacion") return;
    const tituloAnterior = document.title;
    const nombreTutor = `${tutorForm.nombre} ${tutorForm.a_paterno} ${tutorForm.a_materno}`.trim();
    document.title = nombreTutor ? `Comprobante ${nombreTutor}` : "Comprobante de registro";
    return () => { document.title = tituloAnterior; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso]);

  // Un CURP ya usado como tutor o como menor en CUALQUIER registro anterior no se puede volver a usar.
  const verificarCurpDuplicado = async (curp) => {
    const [tutorMatch, menorMatch] = await Promise.all([
      supabase.from("beneficiarios_certificados").select("id").eq("tutor_curp", curp).limit(1),
      supabase.from("beneficiarios_certificados_menores").select("id").eq("curp", curp).limit(1),
    ]);
    return (tutorMatch.data?.length ?? 0) > 0 || (menorMatch.data?.length ?? 0) > 0;
  };

  const handleTutorScan = async (rawText) => {
    const datos = datosDesdeTextoQR(rawText);
    if (!datos) {
      setErrorEscaneo("No se pudo leer una CURP válida en ese código. Intenta de nuevo.");
      setTextoEscaneadoCrudo(rawText);
      return;
    }
    setErrorEscaneo("");
    setTextoEscaneadoCrudo("");
    setVerificandoDuplicado(true);
    const duplicado = await verificarCurpDuplicado(datos.curp);
    setVerificandoDuplicado(false);
    const bloqueo = duplicado ? "Esta CURP ya está registrada (como tutor o como menor) en un trámite anterior." : null;
    setTutorCurpDatos({ ...datos, bloqueo });
    if (!bloqueo) {
      setTutorForm({
        nombre: (datos.nombre || "").toUpperCase(),
        a_paterno: (datos.aPaterno || "").toUpperCase(),
        a_materno: (datos.aMaterno || "").toUpperCase(),
      });
    }
  };

  const confirmarTutor = () => {
    if (!tutorForm.nombre.trim()) {
      setErrorTutor("El nombre es obligatorio.");
      return;
    }
    setErrorTutor("");
    setPaso("contacto");
  };

  const handleCodigoPostalChange = (valor) => {
    const limpio = valor.replace(/\D/g, "").slice(0, 5);
    setCp(limpio);
    setColonia("");
    const encontradas = codigosPostalesData.filter((loc) => loc.d_codigo.toString() === limpio).map((loc) => loc.d_asenta);
    setColonias(encontradas);
  };

  const confirmarContacto = () => {
    if (!cp.trim() || !colonia.trim()) {
      alert("Código Postal y Colonia son obligatorios.");
      return;
    }
    if (!/^\d{10}$/.test(telefono.trim())) {
      setErrorTelefono("El teléfono debe tener exactamente 10 dígitos.");
      return;
    }
    setErrorTelefono("");
    setPaso("menores-scan");
  };

  const handleMenorScan = async (rawText) => {
    const datos = datosDesdeTextoQR(rawText);
    if (!datos) {
      setErrorEscaneo("No se pudo leer una CURP válida en ese código. Intenta de nuevo.");
      setTextoEscaneadoCrudo(rawText);
      return;
    }
    setErrorEscaneo("");
    setTextoEscaneadoCrudo("");

    let bloqueo = null;
    if (datos.curp === tutorCurpDatos?.curp) {
      bloqueo = "Esta CURP es la misma que la del tutor.";
    } else if (menores.some((m) => m.curp === datos.curp)) {
      bloqueo = "Esta CURP ya se registró para otro menor en este mismo trámite.";
    } else {
      setVerificandoDuplicado(true);
      const duplicado = await verificarCurpDuplicado(datos.curp);
      setVerificandoDuplicado(false);
      if (duplicado) bloqueo = "Esta CURP ya está registrada (como tutor o como menor) en un trámite anterior.";
    }

    setMenorCurpDatos({ ...datos, bloqueo });
    if (!bloqueo) {
      setMenorForm({
        nombre: (datos.nombre || "").toUpperCase(),
        a_paterno: (datos.aPaterno || "").toUpperCase(),
        a_materno: (datos.aMaterno || "").toUpperCase(),
      });
    }
  };

  const confirmarMenorActual = () => {
    if (!menorForm.nombre.trim()) {
      setErrorMenor("El nombre es obligatorio.");
      return;
    }
    const nuevo = { ...menorForm, curp: menorCurpDatos.curp, edad: menorCurpDatos.edad };
    const listaActualizada = [...menores, nuevo];
    setMenores(listaActualizada);
    setMenorCurpDatos(null);
    setMenorForm({ nombre: "", a_paterno: "", a_materno: "" });
    setErrorMenor("");
    if (listaActualizada.length >= numMenores) {
      setPaso("cita");
    }
  };

  const handleSubmit = async () => {
    if (!fechaCita || !horaCita) {
      alert("Selecciona fecha y horario de la cita.");
      return;
    }
    if (!comoSeEntero) {
      alert("Selecciona cómo te enteraste del beneficio.");
      return;
    }
    if (comoSeEntero === "OTRO" && !comoSeEnteroOtro.trim()) {
      alert("Describe cómo te enteraste.");
      return;
    }
    setEnviando(true);
    setErrorEnvio("");
    try {
      const { count } = await supabase
        .from("beneficiarios_certificados")
        .select("*", { count: "exact", head: true })
        .eq("fecha_cita", fechaCita)
        .eq("hora_cita", horaCita)
        .in("status", ["AGENDADA", "REAGENDADA"]);
      if ((count ?? 0) >= CUPO_POR_SLOT) {
        setErrorEnvio("Ese horario se llenó mientras completabas el registro. Elige otro horario abajo.");
        setEnviando(false);
        return;
      }

      const folio = generarFolio();
      const { data: registro, error } = await supabase
        .from("beneficiarios_certificados")
        .insert([{
          folio,
          tutor_nombre: tutorForm.nombre.trim().toUpperCase(),
          tutor_a_paterno: tutorForm.a_paterno.trim().toUpperCase(),
          tutor_a_materno: tutorForm.a_materno.trim().toUpperCase(),
          tutor_curp: tutorCurpDatos.curp,
          tutor_edad: tutorCurpDatos.edad,
          tutor_sexo: tutorCurpDatos.sexo,
          c_p: cp.trim(),
          col_loc: colonia.trim().toUpperCase(),
          telefono: telefono.trim(),
          numero_menores: numMenores,
          como_se_entero: comoSeEntero,
          como_se_entero_otro: comoSeEntero === "OTRO" ? comoSeEnteroOtro.trim() : null,
          fecha_cita: fechaCita,
          hora_cita: horaCita,
        }])
        .select()
        .single();
      if (error) throw error;

      if (menores.length) {
        const filas = menores.map((m) => ({
          beneficiario_certificado_id: registro.id,
          tutor_curp: tutorCurpDatos.curp,
          tutor_nombre_completo: `${tutorForm.nombre} ${tutorForm.a_paterno} ${tutorForm.a_materno}`.trim(),
          nombre: m.nombre.trim().toUpperCase(),
          a_paterno: m.a_paterno.trim().toUpperCase(),
          a_materno: m.a_materno.trim().toUpperCase(),
          curp: m.curp,
          edad: m.edad,
        }));
        const { error: errMenores } = await supabase.from("beneficiarios_certificados_menores").insert(filas);
        if (errMenores) throw errMenores;
      }

      setFolioFinal(folio);
      setPaso("confirmacion");
    } catch (err) {
      setErrorEnvio("Error al guardar el registro: " + err.message);
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4">
      <div className="max-w-lg mx-auto">
        <div className="text-center mb-5 print:hidden">
          <h1 className="text-xl font-bold text-slate-800">Registro — Certificado Médico</h1>
          <p className="text-sm text-slate-500 mt-1">
            ¿Ya tienes una cita?{" "}
            <button onClick={() => navigate("/registro-certificado-medico/reagendar")} className="text-blue-600 hover:underline">
              Búscala o reagéndala aquí
            </button>
          </p>
        </div>

        {errorEscaneo && (
          <div className="mb-3 text-center">
            <p className="text-sm text-red-600">{errorEscaneo}</p>
            {textoEscaneadoCrudo && (
              <div className="mt-1 text-left bg-slate-100 border border-slate-200 rounded p-2">
                <p className="text-xs text-slate-500 mb-1">Texto que sí leyó la cámara (cópialo y compártelo si el escaneo sigue fallando):</p>
                <p className="text-xs font-mono text-slate-700 break-all select-all">{textoEscaneadoCrudo}</p>
              </div>
            )}
          </div>
        )}

        {paso === "tutor-scan" && (
          <div>
            <StepHeader n={1} total={5} titulo="Escanea la CURP del padre, madre o tutor" />
            {verificandoDuplicado && <p className="text-sm text-slate-400 mb-2">Verificando CURP...</p>}
            {!tutorCurpDatos ? (
              <EscanerQR onScan={handleTutorScan} />
            ) : (
              <ConfirmarPersona
                datosCurp={tutorCurpDatos}
                form={tutorForm}
                setForm={setTutorForm}
                onConfirmar={confirmarTutor}
                onReescanear={() => setTutorCurpDatos(null)}
                error={errorTutor}
                edadMinima={18}
                textoRequisito="El tutor debe ser mayor de edad para registrar este beneficio."
              />
            )}
          </div>
        )}

        {paso === "contacto" && (
          <div>
            <StepHeader n={2} total={5} titulo="Contacto y menores beneficiarios" />
            <div className="border rounded-lg p-3 bg-white shadow-sm space-y-2">
              <input placeholder="Código Postal" maxLength={5} value={cp} onChange={(e) => handleCodigoPostalChange(e.target.value)} className="border p-2 rounded w-full" />
              <select value={colonia} onChange={(e) => setColonia(e.target.value)} className="border p-2 rounded w-full">
                <option value="">{colonias.length ? "Selecciona colonia" : "Ingresa el C.P. para ver colonias"}</option>
                {colonias.map((c, i) => <option key={i} value={c}>{c}</option>)}
              </select>

              <div className="pt-2 border-t">
                <p className="text-xs font-semibold text-slate-500 mb-1">Teléfono de contacto (10 dígitos)</p>
                <input
                  type="tel"
                  maxLength={10}
                  placeholder="10 dígitos"
                  value={telefono}
                  onChange={(e) => setTelefono(e.target.value.replace(/\D/g, ""))}
                  className="border p-2 rounded w-full"
                />
                {errorTelefono && <p className="text-sm text-red-600 mt-1">{errorTelefono}</p>}
              </div>

              <div className="pt-2 border-t">
                <p className="text-xs font-semibold text-slate-500 mb-1">¿Cuántos menores serán beneficiarios?</p>
                <input
                  type="number"
                  min={1}
                  max={10}
                  value={numMenores}
                  onChange={(e) => setNumMenores(Math.max(1, Number(e.target.value) || 1))}
                  className="border p-2 rounded w-full"
                />
              </div>

              <button type="button" onClick={confirmarContacto} className="bg-emerald-600 text-white px-4 py-2 rounded text-sm">
                Continuar
              </button>
            </div>
          </div>
        )}

        {paso === "menores-scan" && (
          <div>
            <StepHeader n={3} total={5} titulo={`Menor ${menores.length + 1} de ${numMenores}: escanea su CURP`} />
            {verificandoDuplicado && <p className="text-sm text-slate-400 mb-2">Verificando CURP...</p>}
            {!menorCurpDatos ? (
              <EscanerQR onScan={handleMenorScan} titulo="Escanea el código QR de la CURP del menor" />
            ) : (
              <ConfirmarPersona
                datosCurp={menorCurpDatos}
                form={menorForm}
                setForm={setMenorForm}
                onConfirmar={confirmarMenorActual}
                onReescanear={() => setMenorCurpDatos(null)}
                error={errorMenor}
                edadMaxima={15}
                textoRequisito="Este beneficio es solo para menores de 15 años. Esta CURP no cumple el requisito."
              />
            )}
            {menores.length > 0 && (
              <p className="text-xs text-slate-400 mt-2">Ya registrados: {menores.map((m) => m.nombre).join(", ")}</p>
            )}
          </div>
        )}

        {paso === "cita" && (
          <div>
            <StepHeader n={4} total={5} titulo="Agenda tu cita" />
            <div className="border rounded-lg p-3 bg-white shadow-sm">
              <p className="text-xs text-slate-500 mb-2">
                Lunes a viernes, 9:00 a 15:00 (el jueves 16 de julio arranca a las 9:30) · Cupo de {CUPO_POR_SLOT} personas por horario
              </p>
              <div className="flex flex-wrap gap-1.5 mb-3">
                {dias.map((d) => (
                  <button
                    key={d.iso}
                    type="button"
                    onClick={() => { setFechaCita(d.iso); setHoraCita(""); }}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border ${
                      fechaCita === d.iso ? "bg-blue-600 text-white border-blue-600" : "bg-white text-slate-600 border-slate-200 hover:bg-slate-50"
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>

              {fechaCita && (
                cargandoOcupacion ? (
                  <p className="text-sm text-slate-400">Cargando horarios...</p>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {horarios.map((h) => {
                      const ocupados = ocupacion[`${fechaCita}_${h}`] ?? 0;
                      const lleno = ocupados >= CUPO_POR_SLOT;
                      return (
                        <button
                          key={h}
                          type="button"
                          disabled={lleno}
                          onClick={() => setHoraCita(h)}
                          className={`px-2 py-1.5 rounded-lg text-xs font-medium border ${
                            lleno
                              ? "bg-slate-100 text-slate-300 border-slate-100 cursor-not-allowed"
                              : horaCita === h
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

              <button
                type="button"
                disabled={!fechaCita || !horaCita}
                onClick={() => setPaso("encuesta")}
                className="mt-3 bg-emerald-600 text-white px-4 py-2 rounded text-sm disabled:opacity-40"
              >
                Continuar
              </button>
            </div>
          </div>
        )}

        {paso === "encuesta" && (
          <div>
            <StepHeader n={5} total={5} titulo="Última pregunta" />
            <div className="border rounded-lg p-3 bg-white shadow-sm">
              <p className="text-sm font-medium text-slate-700 mb-2">¿Cómo te enteraste de este beneficio?</p>
              <div className="space-y-1.5">
                {[
                  { v: "REDES_SOCIALES", l: "Redes sociales" },
                  { v: "SM_INVITO", l: "Una SM me invitó" },
                  { v: "OTRO", l: "Otro" },
                ].map((op) => (
                  <label key={op.v} className="flex items-center gap-2 text-sm">
                    <input type="radio" name="como_se_entero" checked={comoSeEntero === op.v} onChange={() => setComoSeEntero(op.v)} />
                    {op.l}
                  </label>
                ))}
              </div>
              {comoSeEntero === "OTRO" && (
                <input
                  placeholder="¿Cómo?"
                  value={comoSeEnteroOtro}
                  onChange={(e) => setComoSeEnteroOtro(e.target.value.toUpperCase())}
                  className="border p-2 rounded w-full mt-2"
                />
              )}
              {errorEnvio && <p className="text-sm text-red-600 mt-2">{errorEnvio}</p>}
              <button
                type="button"
                disabled={enviando}
                onClick={handleSubmit}
                className="mt-3 bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
              >
                {enviando ? "Guardando..." : "Confirmar registro"}
              </button>
            </div>
          </div>
        )}

        {paso === "confirmacion" && (
          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <div className="text-center mb-4">
              <p className="text-emerald-600 text-3xl mb-2">✔</p>
              <h2 className="text-lg font-bold text-slate-800 mb-1">¡Registro confirmado!</h2>
              <p className="text-xs text-slate-400">Folio</p>
              <p className="text-2xl font-mono font-bold text-blue-700 tracking-widest">{folioFinal}</p>
              {folioFinal && (
                <div className="flex justify-center mt-3">
                  <QRCodeSVG value={folioFinal} size={140} />
                </div>
              )}
            </div>

            <div className="border-t pt-3 space-y-3 text-sm text-left">
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Cita</p>
                <p>{fechaCita} a las {horaCita} hrs</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Tutor</p>
                <p>{tutorForm.nombre} {tutorForm.a_paterno} {tutorForm.a_materno}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Menores ({menores.length})</p>
                <ul className="list-disc list-inside">
                  {menores.map((m, i) => (
                    <li key={i}>
                      {m.nombre} {m.a_paterno} {m.a_materno} ({m.edad} años)
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            <div className="flex gap-3 mt-4 print:hidden">
              <button type="button" onClick={() => window.print()} className="bg-blue-600 text-white px-4 py-2 rounded text-sm">
                🖨 Imprimir comprobante
              </button>
              <button
                type="button"
                onClick={() => { window.location.href = "/registro-certificado-medico"; }}
                className="text-sm text-slate-500 hover:underline"
              >
                Registrar otro
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RegistroCertificadoMedico;
