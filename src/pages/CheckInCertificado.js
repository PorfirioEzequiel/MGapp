import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import supabase from "../supabase/client";
import EscanerQR from "../componentes/EscanerQR";

// Pantalla para el personal en el lugar del evento: escanea el QR del
// comprobante (contiene el folio) y marca la asistencia del tutor/menores.
const CheckInCertificado = () => {
  const navigate = useNavigate();
  const [folioManual, setFolioManual] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [error, setError] = useState("");
  const [registro, setRegistro] = useState(null);
  const [menores, setMenores] = useState([]);
  const [guardando, setGuardando] = useState(false);
  const [confirmado, setConfirmado] = useState(false);

  const buscarFolio = async (folioTexto) => {
    const folio = folioTexto.trim().toUpperCase();
    if (!folio) return;
    setBuscando(true);
    setError("");
    setRegistro(null);
    setMenores([]);
    setConfirmado(false);
    try {
      const { data, error: err } = await supabase
        .from("beneficiarios_certificados")
        .select("*")
        .eq("folio", folio)
        .maybeSingle();
      if (err) throw err;
      if (!data) {
        setError("No se encontró ningún registro con ese folio.");
        return;
      }
      if (data.status === "CANCELADA") {
        setError("Esta cita fue cancelada.");
        return;
      }
      const { data: menoresData } = await supabase
        .from("beneficiarios_certificados_menores")
        .select("*")
        .eq("beneficiario_certificado_id", data.id);
      setRegistro(data);
      setMenores(menoresData ?? []);
    } catch (e) {
      setError("Error al buscar: " + e.message);
    } finally {
      setBuscando(false);
    }
  };

  const registrarAsistencia = async () => {
    if (!registro) return;
    setGuardando(true);
    setError("");
    try {
      const ahora = new Date().toISOString();
      const { error: err } = await supabase
        .from("beneficiarios_certificados")
        .update({ asistencia_registrada_at: ahora })
        .eq("id", registro.id);
      if (err) throw err;
      setRegistro((prev) => ({ ...prev, asistencia_registrada_at: ahora }));
      setConfirmado(true);
    } catch (e) {
      setError("Error al registrar asistencia: " + e.message);
    } finally {
      setGuardando(false);
    }
  };

  const limpiar = () => {
    setRegistro(null);
    setMenores([]);
    setError("");
    setFolioManual("");
    setConfirmado(false);
  };

  return (
    <div className="min-h-screen bg-slate-50 py-6 px-4">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center justify-between mb-5">
          <h1 className="text-xl font-bold text-slate-800">Check-in — Certificado Médico</h1>
          <button onClick={() => navigate("/registro-certificado-medico")} className="text-sm text-blue-600 hover:underline">
            ← Volver al registro
          </button>
        </div>

        {!registro && (
          <div>
            <EscanerQR onScan={buscarFolio} titulo="Escanea el código QR del comprobante" />
            <div className="border rounded-lg p-3 bg-white shadow-sm mt-3">
              <p className="text-xs text-slate-500 mb-1">¿No lee la cámara? Ingresa el folio manualmente:</p>
              <div className="flex gap-2">
                <input
                  placeholder="Folio (ej. CM-AB12CD)"
                  value={folioManual}
                  onChange={(e) => setFolioManual(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === "Enter" && buscarFolio(folioManual)}
                  className="border p-2 rounded flex-1"
                />
                <button
                  type="button"
                  onClick={() => buscarFolio(folioManual)}
                  disabled={buscando}
                  className="bg-blue-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
                >
                  {buscando ? "Buscando..." : "Buscar"}
                </button>
              </div>
            </div>
            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
          </div>
        )}

        {registro && (
          <div className="border rounded-lg p-4 bg-white shadow-sm">
            <p className="text-xs text-slate-400">Folio</p>
            <p className="text-xl font-mono font-bold text-blue-700 tracking-widest mb-3">{registro.folio}</p>

            <div className="text-sm space-y-2">
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Tutor</p>
                <p>{registro.tutor_nombre} {registro.tutor_a_paterno} {registro.tutor_a_materno}</p>
              </div>
              <div>
                <p className="text-xs font-bold uppercase text-slate-400">Cita</p>
                <p>{registro.fecha_cita} a las {String(registro.hora_cita).slice(0, 5)} hrs · {registro.status}</p>
              </div>
              {menores.length > 0 && (
                <div>
                  <p className="text-xs font-bold uppercase text-slate-400">Menores ({menores.length})</p>
                  <ul className="list-disc list-inside">
                    {menores.map((m) => (
                      <li key={m.id}>{m.nombre} {m.a_paterno} {m.a_materno} ({m.edad} años)</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            {registro.asistencia_registrada_at && !confirmado && (
              <p className="text-sm text-amber-600 mt-3">
                Ya se había registrado su asistencia el {new Date(registro.asistencia_registrada_at).toLocaleString("es-MX")}.
              </p>
            )}

            {confirmado ? (
              <p className="text-emerald-600 font-semibold mt-4">✔ Asistencia registrada.</p>
            ) : (
              <button
                type="button"
                onClick={registrarAsistencia}
                disabled={guardando}
                className="mt-4 bg-emerald-600 text-white px-4 py-2 rounded text-sm disabled:opacity-50"
              >
                {guardando ? "Guardando..." : "Registrar asistencia"}
              </button>
            )}

            {error && <p className="text-sm text-red-600 mt-2">{error}</p>}

            <button type="button" onClick={limpiar} className="block mt-3 text-sm text-slate-500 hover:underline">
              Escanear otro comprobante
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default CheckInCertificado;
