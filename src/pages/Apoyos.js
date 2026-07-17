import React, { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import supabase from "../supabase/client";
import codigosPostalesData from "../codigospostales.json";

// Periodo actual del programa: semana ISO (ej. '2026-W28') para programas
// semanales, o 'UNICA' para programas de entrega única (ej. Tinacos).
const getPeriodo = (frecuencia) => {
  if (frecuencia !== "SEMANAL") return "UNICA";
  const now = new Date();
  const target = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
  const dayNum = target.getUTCDay() || 7;
  target.setUTCDate(target.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(target.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((target - yearStart) / 86400000) + 1) / 7);
  return `${target.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
};

const STATUS_STYLES = {
  ENTREGADO: "bg-emerald-100 text-emerald-700 border-emerald-200",
  PENDIENTE: "bg-amber-100 text-amber-700 border-amber-200",
  "NO ENTREGADO": "bg-red-100 text-red-700 border-red-200",
  SIN_REGISTRO: "bg-slate-100 text-slate-500 border-slate-200",
};

const emptyBeneficiario = {
  curp: "",
  telefono_1: "",
  nombre: "",
  a_paterno: "",
  a_materno: "",
  poligono: "",
  seccion: "",
  ubt: "", // no se pide en el formulario: se hereda del SM que registra
  calle: "",
  n_ext_mz: "",
  n_int_lt: "",
  n_casa: "",
  c_p: "",
  col_loc: "",
};

const EntregaControl = ({ entrega, guardando, foto, setFoto, onEntregar, onNoEntregado, onPendiente }) => (
  <div className="mt-2">
    <p className="text-xs text-slate-500 mb-1">
      Estatus actual:{" "}
      <span className={`font-semibold px-2 py-0.5 rounded-full border text-xs ${STATUS_STYLES[entrega?.status ?? "SIN_REGISTRO"]}`}>
        {entrega?.status ?? "SIN REGISTRO"}
      </span>
    </p>
    {entrega?.foto_evidencia_url && (
      <img src={entrega.foto_evidencia_url} alt="Evidencia de entrega" className="h-24 rounded border mb-2" />
    )}
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="file"
        accept="image/*"
        capture="environment"
        onChange={(e) => setFoto(e.target.files[0] ?? null)}
        className="text-xs"
      />
      <button disabled={guardando} onClick={() => onEntregar(foto)} className="bg-emerald-600 text-white text-xs px-3 py-1.5 rounded disabled:opacity-50">
        ✔ Marcar entregado
      </button>
      <button disabled={guardando} onClick={onNoEntregado} className="bg-red-500 text-white text-xs px-3 py-1.5 rounded disabled:opacity-50">
        ✕ No entregado
      </button>
      {entrega && (
        <button disabled={guardando} onClick={onPendiente} className="bg-amber-500 text-white text-xs px-3 py-1.5 rounded disabled:opacity-50">
          ⏳ Marcar pendiente
        </button>
      )}
    </div>
  </div>
);

const Apoyos = () => {
  const { state } = useLocation();
  const { user } = state || {};
  const navigate = useNavigate();

  const esSP = user?.puesto?.toLowerCase() === "sp";

  const [programas, setProgramas] = useState([]);
  const [programaId, setProgramaId] = useState("");
  const [smsSector, setSmsSector] = useState([]); // solo SP: a qué SM pertenece el beneficiario
  const [smSel, setSmSel] = useState("");

  const [busqueda, setBusqueda] = useState("");
  const [buscando, setBuscando] = useState(false);
  const [beneficiario, setBeneficiario] = useState(null);
  const [mostrarFormNuevo, setMostrarFormNuevo] = useState(false);
  const [nuevoBeneficiario, setNuevoBeneficiario] = useState(emptyBeneficiario);
  const [entregaActual, setEntregaActual] = useState(null);
  const [guardando, setGuardando] = useState(false);
  const [foto, setFoto] = useState(null);

  const [lista, setLista] = useState([]);
  const [cargandoLista, setCargandoLista] = useState(false);
  const [colonias, setColonias] = useState([]);

  const programaSel = programas.find((p) => p.id === Number(programaId)) || null;
  const periodoActual = programaSel ? getPeriodo(programaSel.frecuencia) : null;

  useEffect(() => {
    const cargar = async () => {
      const { data, error } = await supabase
        .from("programas_sociales")
        .select("*")
        .eq("activo", true)
        .order("nombre");
      if (!error) {
        setProgramas(data ?? []);
        if (data?.length) setProgramaId((prev) => prev || String(data[0].id));
      }
    };
    cargar();
  }, []);

  // SMs del sector (solo SP, para saber a nombre de quién queda el beneficiario)
  useEffect(() => {
    if (!esSP || !user?.poligono) return;
    const cargar = async () => {
      const { data, error } = await supabase
        .from("ciudadania")
        .select("id, usuario, nombre, a_paterno, a_materno, seccion, ubt")
        .eq("poligono", user.poligono)
        .eq("puesto", "SM")
        .eq("status", "ACTIVO")
        .order("ubt");
      if (!error) setSmsSector(data ?? []);
    };
    cargar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [esSP, user?.poligono]);

  const cargarLista = async () => {
    if (!user || !programaSel) return;
    setCargandoLista(true);
    try {
      let query = supabase
        .from("ciudadania")
        .select("*")
        .eq("puesto", "BENEFICIARIO")
        .eq("status", "ACTIVO")
        .order("ingreso_estructura", { ascending: false });
      query = esSP ? query.eq("poligono", user.poligono) : query.eq("movilizador", user.usuario);
      const { data: benefs, error } = await query;
      if (error) throw error;

      const ids = (benefs ?? []).map((b) => b.id);
      const entregasMap = {};
      if (ids.length) {
        const { data: entregas } = await supabase
          .from("apoyo_entregas")
          .select("*")
          .eq("programa_id", programaSel.id)
          .eq("periodo", periodoActual)
          .in("beneficiario_id", ids);
        (entregas ?? []).forEach((e) => { entregasMap[e.beneficiario_id] = e; });
      }
      setLista((benefs ?? []).map((b) => ({ ...b, entrega: entregasMap[b.id] ?? null })));
    } catch (err) {
      console.error("Error cargando beneficiarios:", err.message);
    } finally {
      setCargandoLista(false);
    }
  };

  useEffect(() => {
    cargarLista();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId, user?.id]);

  const cargarEntregaDe = async (b) => {
    if (!programaSel) return;
    const { data } = await supabase
      .from("apoyo_entregas")
      .select("*")
      .eq("beneficiario_id", b.id)
      .eq("programa_id", programaSel.id)
      .eq("periodo", periodoActual)
      .maybeSingle();
    setEntregaActual(data ?? null);
  };

  useEffect(() => {
    if (beneficiario) cargarEntregaDe(beneficiario);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programaId]);

  const limpiarBusqueda = () => {
    setBusqueda("");
    setBeneficiario(null);
    setMostrarFormNuevo(false);
    setEntregaActual(null);
    setFoto(null);
    setNuevoBeneficiario(emptyBeneficiario);
    setSmSel("");
    setColonias([]);
  };

  // Valida contra `ciudadania` (misma tabla de siempre) por CURP o teléfono.
  // Si ya existe, se autocompleta y no se vuelve a pedir nada.
  const buscar = async () => {
    const q = busqueda.trim();
    if (!q) return;
    setBuscando(true);
    setBeneficiario(null);
    setMostrarFormNuevo(false);
    setEntregaActual(null);
    try {
      let encontrado = null;
      const { data: porCurp } = await supabase.from("ciudadania").select("*").eq("curp", q.toUpperCase()).limit(1);
      encontrado = porCurp?.[0] ?? null;
      if (!encontrado) {
        const { data: porTel } = await supabase.from("ciudadania").select("*").eq("telefono_1", q).limit(1);
        encontrado = porTel?.[0] ?? null;
      }
      if (encontrado) {
        setBeneficiario(encontrado);
        await cargarEntregaDe(encontrado);
      } else {
        setMostrarFormNuevo(true);
        setColonias([]);
        setNuevoBeneficiario({
          ...emptyBeneficiario,
          curp: /^[A-Z0-9]{18}$/i.test(q) ? q.toUpperCase() : "",
          telefono_1: /^\d{10}$/.test(q) ? q : "",
          poligono: user?.poligono ?? "",
          seccion: esSP ? "" : (user?.seccion ?? ""),
          ubt: esSP ? "" : (user?.ubt ?? ""),
        });
      }
    } catch (err) {
      alert("Error buscando en la base: " + err.message);
    } finally {
      setBuscando(false);
    }
  };

  // Filtra las colonias del JSON de códigos postales según el CP capturado
  const handleCodigoPostalChange = (cp) => {
    setNuevoBeneficiario((p) => ({ ...p, c_p: cp, col_loc: "" }));
    const encontradas = codigosPostalesData
      .filter((loc) => loc.d_codigo.toString() === cp)
      .map((loc) => loc.d_asenta);
    setColonias(encontradas);
  };

  const seleccionarSM = (id) => {
    setSmSel(id);
    const sm = smsSector.find((s) => String(s.id) === id);
    if (sm) {
      setNuevoBeneficiario((p) => ({ ...p, poligono: user.poligono ?? "", seccion: sm.seccion ?? "", ubt: sm.ubt ?? "" }));
    }
  };

  const guardarNuevoBeneficiario = async () => {
    if (!nuevoBeneficiario.nombre.trim()) {
      alert("El nombre es obligatorio.");
      return;
    }
    if (esSP && !smSel) {
      alert("Selecciona a qué SM pertenece este beneficiario.");
      return;
    }
    if (!nuevoBeneficiario.calle.trim() || !nuevoBeneficiario.c_p.trim() || !nuevoBeneficiario.col_loc.trim() || !nuevoBeneficiario.n_ext_mz.trim()) {
      alert("Calle, Código Postal, Colonia y N° Ext son obligatorios (N° Int y N° Casa no).");
      return;
    }
    if (nuevoBeneficiario.telefono_1.trim() && !/^\d{10}$/.test(nuevoBeneficiario.telefono_1.trim())) {
      alert("El teléfono debe tener 10 dígitos.");
      return;
    }
    setGuardando(true);
    try {
      const smResponsable = esSP ? smsSector.find((s) => String(s.id) === smSel) : null;
      const payload = {
        puesto: "BENEFICIARIO",
        status: "ACTIVO",
        nombre: nuevoBeneficiario.nombre.trim().toUpperCase(),
        a_paterno: nuevoBeneficiario.a_paterno.trim().toUpperCase(),
        a_materno: nuevoBeneficiario.a_materno.trim().toUpperCase(),
        curp: nuevoBeneficiario.curp.trim().toUpperCase() || null,
        telefono_1: nuevoBeneficiario.telefono_1.trim() || null,
        poligono: nuevoBeneficiario.poligono || null,
        seccion: nuevoBeneficiario.seccion || null,
        ubt: nuevoBeneficiario.ubt || null, // heredado del SM, nunca se pidió en el formulario
        calle: nuevoBeneficiario.calle.trim().toUpperCase(),
        n_ext_mz: nuevoBeneficiario.n_ext_mz.trim(),
        n_int_lt: nuevoBeneficiario.n_int_lt.trim() || null,
        n_casa: nuevoBeneficiario.n_casa.trim() || null,
        c_p: nuevoBeneficiario.c_p.trim(),
        col_loc: nuevoBeneficiario.col_loc.trim().toUpperCase(),
        movilizador: esSP ? smResponsable?.usuario ?? null : user.usuario,
        ingreso_estructura: new Date().toISOString(),
      };
      const { data, error } = await supabase
        .from("ciudadania")
        .upsert([payload], { onConflict: "curp" })
        .select()
        .single();
      if (error) throw error;
      setBeneficiario(data);
      setMostrarFormNuevo(false);
      setEntregaActual(null);
      cargarLista();
    } catch (err) {
      alert("Error guardando beneficiario: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  const registrarEntrega = async (status, beneficiarioObjetivo, fotoFile) => {
    if (!programaSel || !beneficiarioObjetivo) return;
    setGuardando(true);
    try {
      let fotoUrl = entregaActual?.foto_evidencia_url ?? null;
      if (fotoFile) {
        const filePath = `entregas/${beneficiarioObjetivo.id}-${programaSel.id}-${periodoActual}`;
        const { error: upErr } = await supabase.storage.from("evidencias_apoyos").upload(filePath, fotoFile, { upsert: true });
        if (upErr) throw upErr;
        const { data: urlData } = supabase.storage.from("evidencias_apoyos").getPublicUrl(filePath);
        fotoUrl = urlData.publicUrl;
      }
      const { data, error } = await supabase
        .from("apoyo_entregas")
        .upsert(
          [{
            beneficiario_id: beneficiarioObjetivo.id,
            programa_id: programaSel.id,
            periodo: periodoActual,
            status,
            cantidad: 1,
            foto_evidencia_url: fotoUrl,
            entregado_por: user.usuario,
            fecha_entrega: status === "ENTREGADO" ? new Date().toISOString() : null,
          }],
          { onConflict: "beneficiario_id,programa_id,periodo" }
        )
        .select()
        .single();
      if (error) throw error;
      setEntregaActual(data);
      setFoto(null);

      // Se abona al historial de programas del ciudadano (sin duplicar si ya estaba)
      if (status === "ENTREGADO") {
        const entradaTexto = `${programaSel.nombre} (${periodoActual})`;
        const actual = beneficiarioObjetivo.historial_programas || "";
        if (!actual.includes(entradaTexto)) {
          const nuevoHistorial = actual ? `${actual}; ${entradaTexto}` : entradaTexto;
          await supabase.from("ciudadania").update({ historial_programas: nuevoHistorial }).eq("id", beneficiarioObjetivo.id);
          setBeneficiario((prev) => (prev && prev.id === beneficiarioObjetivo.id ? { ...prev, historial_programas: nuevoHistorial } : prev));
        }
      }

      cargarLista();
    } catch (err) {
      alert("Error registrando entrega: " + err.message);
    } finally {
      setGuardando(false);
    }
  };

  if (!user) return <p className="p-4">Error: usuario no encontrado.</p>;

  return (
    <div className="p-4 max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">Apoyos y Programas Sociales</h1>
        <button onClick={() => navigate(-1)} className="text-sm text-blue-600 hover:underline">← Volver</button>
      </div>

      {/* Selector de programa */}
      <div className="mb-4">
        <label className="block text-sm font-medium mb-1">Programa</label>
        <select
          value={programaId}
          onChange={(e) => { setProgramaId(e.target.value); limpiarBusqueda(); }}
          className="border p-2 w-full rounded"
        >
          {programas.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre} ({p.frecuencia === "SEMANAL" ? "semanal" : "única"})
            </option>
          ))}
        </select>
        {programaSel && (
          <p className="text-xs text-slate-500 mt-1">
            Periodo actual: <strong>{periodoActual}</strong>
            {programaSel.descripcion && ` · ${programaSel.descripcion}`}
          </p>
        )}
      </div>

      {/* Buscador CURP/teléfono contra ciudadania */}
      <div className="border rounded-lg p-3 bg-white shadow-sm mb-6">
        <h2 className="font-semibold text-sm text-slate-600 mb-2">Buscar / agregar beneficiario</h2>
        <div className="flex gap-2">
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && buscar()}
            placeholder="CURP o teléfono a 10 dígitos"
            className="border p-2 flex-1 rounded"
          />
          <button onClick={buscar} disabled={buscando} className="bg-blue-600 text-white px-4 py-2 rounded disabled:opacity-50">
            {buscando ? "Buscando..." : "Buscar"}
          </button>
          {(beneficiario || mostrarFormNuevo) && (
            <button onClick={limpiarBusqueda} className="bg-gray-300 px-3 py-2 rounded">Limpiar</button>
          )}
        </div>

        {beneficiario && (
          <div className="mt-3 border-t pt-3">
            <p className="font-semibold">
              {beneficiario.nombre} {beneficiario.a_paterno} {beneficiario.a_materno}
              {beneficiario.puesto !== "BENEFICIARIO" && (
                <span className="ml-2 text-xs font-normal text-violet-600">({beneficiario.puesto})</span>
              )}
            </p>
            <p className="text-xs text-slate-500">
              CURP: {beneficiario.curp || "—"} · Tel: {beneficiario.telefono_1 || "—"} · Ya está en la base de datos
            </p>
            {beneficiario.historial_programas && (
              <p className="text-xs text-slate-400 mt-1">Historial: {beneficiario.historial_programas}</p>
            )}
            <EntregaControl
              entrega={entregaActual}
              guardando={guardando}
              foto={foto}
              setFoto={setFoto}
              onEntregar={(file) => registrarEntrega("ENTREGADO", beneficiario, file)}
              onNoEntregado={() => registrarEntrega("NO ENTREGADO", beneficiario, null)}
              onPendiente={() => registrarEntrega("PENDIENTE", beneficiario, null)}
            />
          </div>
        )}

        {mostrarFormNuevo && (
          <div className="mt-3 border-t pt-3">
            <p className="text-sm text-emerald-700 font-medium mb-2">No está registrado — dar de alta como beneficiario:</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <input placeholder="Nombre" value={nuevoBeneficiario.nombre} onChange={(e) => setNuevoBeneficiario({ ...nuevoBeneficiario, nombre: e.target.value })} className="border p-2 rounded" />
              <input placeholder="Apellido Paterno" value={nuevoBeneficiario.a_paterno} onChange={(e) => setNuevoBeneficiario({ ...nuevoBeneficiario, a_paterno: e.target.value })} className="border p-2 rounded" />
              <input placeholder="Apellido Materno" value={nuevoBeneficiario.a_materno} onChange={(e) => setNuevoBeneficiario({ ...nuevoBeneficiario, a_materno: e.target.value })} className="border p-2 rounded" />
              <input placeholder="CURP (opcional)" maxLength={18} value={nuevoBeneficiario.curp} onChange={(e) => setNuevoBeneficiario({ ...nuevoBeneficiario, curp: e.target.value.toUpperCase() })} className="border p-2 rounded" />
              <input placeholder="Teléfono" maxLength={10} value={nuevoBeneficiario.telefono_1} onChange={(e) => setNuevoBeneficiario({ ...nuevoBeneficiario, telefono_1: e.target.value })} className="border p-2 rounded" />
              <input placeholder="Sector" value={nuevoBeneficiario.poligono} onChange={(e) => setNuevoBeneficiario({ ...nuevoBeneficiario, poligono: e.target.value })} className="border p-2 rounded" />
              <input placeholder="Sección" value={nuevoBeneficiario.seccion} onChange={(e) => setNuevoBeneficiario({ ...nuevoBeneficiario, seccion: e.target.value })} className="border p-2 rounded" />

              <input placeholder="Calle" value={nuevoBeneficiario.calle} onChange={(e) => setNuevoBeneficiario({ ...nuevoBeneficiario, calle: e.target.value })} className="border p-2 rounded md:col-span-2" />
              <input placeholder="N° Ext" value={nuevoBeneficiario.n_ext_mz} onChange={(e) => setNuevoBeneficiario({ ...nuevoBeneficiario, n_ext_mz: e.target.value })} className="border p-2 rounded" />
              <input placeholder="N° Int (opcional)" value={nuevoBeneficiario.n_int_lt} onChange={(e) => setNuevoBeneficiario({ ...nuevoBeneficiario, n_int_lt: e.target.value })} className="border p-2 rounded" />
              <input placeholder="N° Casa (opcional)" value={nuevoBeneficiario.n_casa} onChange={(e) => setNuevoBeneficiario({ ...nuevoBeneficiario, n_casa: e.target.value })} className="border p-2 rounded" />
              <input placeholder="Código Postal" maxLength={5} value={nuevoBeneficiario.c_p} onChange={(e) => handleCodigoPostalChange(e.target.value)} className="border p-2 rounded" />
              <select value={nuevoBeneficiario.col_loc} onChange={(e) => setNuevoBeneficiario({ ...nuevoBeneficiario, col_loc: e.target.value })} className="border p-2 rounded md:col-span-2">
                <option value="">{colonias.length ? "Selecciona colonia" : "Ingresa el C.P. para ver colonias"}</option>
                {colonias.map((c, i) => (
                  <option key={i} value={c}>{c}</option>
                ))}
              </select>

              {esSP && (
                <select value={smSel} onChange={(e) => seleccionarSM(e.target.value)} className="border p-2 rounded md:col-span-2">
                  <option value="">— Selecciona el SM que lo lleva —</option>
                  {smsSector.map((sm) => (
                    <option key={sm.id} value={sm.id}>
                      {sm.nombre} {sm.a_paterno} {sm.a_materno} (Sección {sm.seccion}, Fracc. {sm.ubt})
                    </option>
                  ))}
                </select>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-1">
              La fracción no se pide: queda asignada a la del SM {esSP ? "que elijas" : "que lo registra (tú)"}.
            </p>
            <button onClick={guardarNuevoBeneficiario} disabled={guardando} className="mt-2 bg-emerald-600 text-white px-4 py-2 rounded disabled:opacity-50">
              {guardando ? "Guardando..." : "Guardar beneficiario"}
            </button>
          </div>
        )}
      </div>

      {/* Lista de beneficiarios de este programa / periodo */}
      <div className="border rounded-lg p-3 bg-white shadow-sm">
        <div className="flex items-center justify-between mb-2">
          <h2 className="font-semibold text-sm text-slate-600">
            {esSP ? "Beneficiarios del sector" : "Mis beneficiarios"} — {programaSel?.nombre}
          </h2>
          <span className="text-xs text-slate-400">{lista.length} registrados</span>
        </div>
        {cargandoLista ? (
          <p className="text-sm text-slate-400">Cargando...</p>
        ) : lista.length === 0 ? (
          <p className="text-sm text-slate-400 italic">Aún no hay beneficiarios registrados.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-slate-50 text-left text-xs text-slate-500 uppercase">
                  <th className="p-2">Nombre</th>
                  <th className="p-2">CURP / Tel</th>
                  <th className="p-2">Estatus ({periodoActual})</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lista.map((b) => (
                  <tr
                    key={b.id}
                    className="hover:bg-slate-50 cursor-pointer"
                    onClick={() => {
                      setBeneficiario(b);
                      setMostrarFormNuevo(false);
                      setEntregaActual(b.entrega);
                      setBusqueda("");
                    }}
                  >
                    <td className="p-2">{b.nombre} {b.a_paterno} {b.a_materno}</td>
                    <td className="p-2 text-xs text-slate-500">{b.curp || b.telefono_1 || "—"}</td>
                    <td className="p-2">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full border ${STATUS_STYLES[b.entrega?.status ?? "SIN_REGISTRO"]}`}>
                        {b.entrega?.status ?? "SIN REGISTRO"}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-slate-400 italic mt-2">
          Esta lista solo muestra beneficiarios dados de alta con puesto "BENEFICIARIO". Un SM o movilizador que
          también reciba este programa no aparece aquí, pero su entrega sí queda registrada — búscalo por CURP o teléfono arriba.
        </p>
      </div>
    </div>
  );
};

export default Apoyos;
