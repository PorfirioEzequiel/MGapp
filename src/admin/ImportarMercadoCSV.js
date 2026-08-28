import React, { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabaseStorage as supabaseAdmin } from "../supabase/client";

// ── CSV parser — maneja campos con comas dentro de comillas ───────────────────
const parseCSV = (text) => {
  const lines = text.split(/\r?\n/);
  const parseRow = (line) => {
    const fields = [];
    let cur = "", inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
        else inQ = !inQ;
      } else if (c === "," && !inQ) { fields.push(cur); cur = ""; }
      else cur += c;
    }
    fields.push(cur);
    return fields;
  };
  const nonEmpty = lines.filter((l) => l.trim());
  if (nonEmpty.length < 2) return { headers: [], rows: [] };
  const headers = parseRow(nonEmpty[0]).map((h) => h.trim());
  const rows = nonEmpty.slice(1).map((line) => {
    const vals = parseRow(line);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (vals[i] ?? "").trim(); });
    return obj;
  });
  return { headers, rows };
};

// ── Fecha DD/MM/YYYY → YYYY-MM-DD ────────────────────────────────────────────
const toISODate = (s) => {
  if (!s) return null;
  const p = s.split("/");
  if (p.length === 3 && p[2].length === 4) {
    return `${p[2]}-${p[1].padStart(2, "0")}-${p[0].padStart(2, "0")}`;
  }
  return s || null;
};

// ── Mapeo CSV → columna DB y tipo ─────────────────────────────────────────────
// CSV puede tener espacios o acentos en los encabezados; se busca por trim+lowercase
const COL_SPEC = [
  // [csv_key_normalizado, db_col, tipo]
  ["año",                "año",                 "int"],
  ["mes",                "mes",                 "str"],
  ["entrega",            "entrega",             "int"],
  ["fecha_entrega",      "fecha_entrega",       "date"],
  ["numero_viaje",       "numero_viaje",        "int"],
  ["camioneta_repartidor","camioneta_repartidor","str"],
  ["coordinador",        "coordinador",         "str"],
  ["sector",             "sector",              "int"],
  ["seccion",            "seccion",             "int"],
  ["fracciones",         "fracciones",          "int"],
  ["sm_activas",         "sm_activas",          "int"],
  ["piezas",             "piezas",              "int"],
  ["total",              "total",               "int"],
  ["entregadas",         "entregadas",          "int"],
  ["restan",             "restan",              "int"],
  ["estatus",            "estatus",             "str"],
  ["nombre",             "nombre",              "str"],
  ["telefono",           "telefono",            "str"],
  ["ubicación",          "ubicacion",           "str"],
  ["ubicacion",          "ubicacion",           "str"],
  ["latitud",            "latitud",             "float"],
  ["longitud",           "longitud",            "float"],
  ["ubicacion_repetida", "ubicacion_repetida",  "bool"],
];

// Construye mapa: clave normalizada CSV → [dbCol, tipo]
const normKey = (k) =>
  k.trim().toLowerCase()
    .replace(/á/g,"a").replace(/é/g,"e").replace(/í/g,"i")
    .replace(/ó/g,"o").replace(/ú/g,"u").replace(/ñ/g,"n");

const NORM_MAP = new Map(COL_SPEC.map(([csvK, dbCol, tipo]) => [normKey(csvK), [dbCol, tipo]]));

const transformRow = (raw) => {
  const row = {};
  for (const [rawKey, rawVal] of Object.entries(raw)) {
    const nk = normKey(rawKey);
    if (nk === "id" || nk === "fecha_creacion") continue; // auto en DB
    const spec = NORM_MAP.get(nk);
    if (!spec) continue;
    const [dbCol, tipo] = spec;
    const v = (rawVal ?? "").trim();

    if (v === "" || v === "-" || v === "null") {
      row[dbCol] = null;
      continue;
    }
    if (tipo === "int") {
      const n = parseInt(v, 10);
      row[dbCol] = isNaN(n) ? null : n;
    } else if (tipo === "float") {
      const n = parseFloat(v);
      row[dbCol] = isNaN(n) ? null : n;
    } else if (tipo === "bool") {
      row[dbCol] = v.toUpperCase() === "SI" || v === "true" || v === "1";
    } else if (tipo === "date") {
      row[dbCol] = toISODate(v);
    } else {
      row[dbCol] = v;
    }
  }
  return row;
};

// ── Columnas de preview ───────────────────────────────────────────────────────
const PREVIEW_COLS = ["entrega","sector","seccion","coordinador","sm_activas","piezas","total","estatus","ubicacion_repetida","latitud"];

// ── Componente ────────────────────────────────────────────────────────────────
const SQL_HINT = `-- Ejecuta esto UNA VEZ en Supabase → SQL Editor:
ALTER TABLE mercado ADD COLUMN IF NOT EXISTS seccion INT;
ALTER TABLE mercado ADD COLUMN IF NOT EXISTS restan INT;
ALTER TABLE mercado ADD COLUMN IF NOT EXISTS telefono TEXT;
ALTER TABLE mercado ADD COLUMN IF NOT EXISTS ubicacion TEXT;
ALTER TABLE mercado ADD COLUMN IF NOT EXISTS latitud DOUBLE PRECISION;
ALTER TABLE mercado ADD COLUMN IF NOT EXISTS longitud DOUBLE PRECISION;
ALTER TABLE mercado ADD COLUMN IF NOT EXISTS ubicacion_repetida BOOLEAN DEFAULT FALSE;`;

export default function ImportarMercadoCSV() {
  const navigate = useNavigate();
  const inputRef = useRef(null);

  const [fileName, setFileName]   = useState("");
  const [parsed,   setParsed]     = useState(null);  // { headers, rows (raw) }
  const [preview,  setPreview]    = useState([]);
  const [issues,   setIssues]     = useState([]);
  const [mode,     setMode]       = useState("replace"); // 'append' | 'replace'
  const [importing,setImporting]  = useState(false);
  const [progress, setProgress]   = useState(0);
  const [result,   setResult]     = useState(null);
  const [sqlOpen,  setSqlOpen]    = useState(false);

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setResult(null);
    setProgress(0);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const { headers, rows } = parseCSV(ev.target.result);
      if (!rows.length) { alert("El archivo está vacío o tiene formato incorrecto."); return; }
      setParsed({ headers, rows });

      // Detectar situaciones a transformar
      const found = [];
      const siNo = rows.filter((r) => r["ubicacion_repetida"] === "SI" || r["ubicacion_repetida"] === "NO").length;
      if (siNo > 0) found.push(`${siNo} filas con "SI/NO" en ubicacion_repetida → se convierten a booleano (true/false)`);
      const noLatLng = rows.filter((r) => !r["latitud"] || !r["longitud"]).length;
      if (noLatLng > 0) found.push(`${noLatLng} filas sin coordenadas → latitud/longitud se guardarán como nulo`);
      const fechas = rows.filter((r) => r["fecha_entrega"]?.includes("/")).length;
      if (fechas > 0) found.push(`${fechas} fechas en formato DD/MM/YYYY → se convierten a YYYY-MM-DD`);
      const sinEstatus = rows.filter((r) => !r["estatus"]).length;
      if (sinEstatus > 0) found.push(`${sinEstatus} filas sin estatus → se guardarán como nulo`);
      setIssues(found);

      setPreview(rows.slice(0, 5).map(transformRow));
    };
    reader.readAsText(file, "UTF-8");
  };

  const handleImport = async () => {
    if (!parsed?.rows.length) return;
    setImporting(true);
    setProgress(0);
    setResult(null);

    const rows = parsed.rows.map(transformRow);

    // Modo "replace": borrar registros del mismo año+mes+entrega antes de insertar
    if (mode === "replace") {
      const groups = [...new Set(rows.map((r) => `${r["año"]}_${r["mes"]}_${r["entrega"]}`))];
      for (const g of groups) {
        const [anio, mes, entrega] = g.split("_");
        await supabaseAdmin
          .from("mercado")
          .delete()
          .eq("año", parseInt(anio, 10))
          .eq("mes", mes)
          .eq("entrega", parseInt(entrega, 10));
      }
    }

    // Insertar en batches
    const BATCH = 50;
    let inserted = 0;
    const errors = [];
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH);
      const { error } = await supabaseAdmin.from("mercado").insert(batch);
      if (error) {
        errors.push({ batch: Math.floor(i / BATCH) + 1, message: error.message });
      } else {
        inserted += batch.length;
      }
      setProgress(Math.min(100, Math.round(((i + BATCH) / rows.length) * 100)));
    }

    setImporting(false);
    setResult({ inserted, errors, total: rows.length });
  };

  return (
    <div className="min-h-screen bg-slate-100">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-5 shadow-md">
        <div className="max-w-3xl mx-auto flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 flex items-center justify-center rounded-full bg-white/20 hover:bg-white/30 text-white transition-all duration-150 shrink-0"
          >←</button>
          <div>
            <h1 className="text-white font-bold text-lg leading-none">Importar Mercado Solidario</h1>
            <p className="text-blue-200 text-xs mt-0.5">Carga masiva desde CSV (OneDrive / Excel)</p>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-3">
        {/* SQL hint */}
        <div className="bg-amber-50 border border-amber-200 rounded-2xl overflow-hidden">
          <button
            onClick={() => setSqlOpen((o) => !o)}
            className="w-full flex items-center justify-between px-4 py-3 text-left"
          >
            <span className="text-xs font-bold text-amber-800">⚠ SQL a ejecutar en Supabase (una sola vez)</span>
            <span className="text-amber-600 text-xs">{sqlOpen ? "▲ Ocultar" : "▼ Ver"}</span>
          </button>
          {sqlOpen && (
            <div className="px-4 pb-4">
              <pre className="text-xs font-mono bg-amber-100 rounded-xl p-3 whitespace-pre-wrap text-amber-900 overflow-x-auto">
                {SQL_HINT}
              </pre>
              <p className="text-xs text-amber-700 mt-2">
                Abre <strong>Supabase → SQL Editor</strong>, pega el código y ejecútalo. Solo es necesario la primera vez.
              </p>
            </div>
          )}
        </div>

        {/* File picker */}
        <div
          className="bg-white rounded-2xl shadow-sm p-8 text-center border-2 border-dashed border-slate-200 cursor-pointer hover:border-blue-300 transition-all duration-150"
          onClick={() => inputRef.current?.click()}
        >
          <input ref={inputRef} type="file" accept=".csv" className="hidden" onChange={handleFile} />
          <p className="text-4xl mb-3 select-none">📂</p>
          <p className="text-sm font-bold text-slate-700">{fileName || "Seleccionar archivo CSV"}</p>
          <p className="text-xs text-slate-400 mt-1">mercado.csv exportado desde OneDrive / Excel</p>
        </div>

        {/* Issues / conversiones automáticas */}
        {issues.length > 0 && (
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4 space-y-1.5">
            <p className="text-xs font-bold text-blue-700 uppercase tracking-wider mb-2">Conversiones automáticas detectadas</p>
            {issues.map((iss, i) => (
              <p key={i} className="text-xs text-blue-700 flex items-start gap-1.5">
                <span className="text-emerald-500 shrink-0 mt-0.5">✓</span>
                {iss}
              </p>
            ))}
          </div>
        )}

        {/* Opciones de importación */}
        {parsed && (
          <div className="bg-white rounded-2xl shadow-sm p-4 space-y-3">
            <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Modo de importación</p>
            <div className="flex gap-3 flex-wrap">
              {[
                { val: "replace", label: "Reemplazar entrega", desc: "Borra los registros del mismo año+mes+entrega antes de insertar (recomendado)" },
                { val: "append",  label: "Agregar sin borrar",  desc: "Inserta sin borrar nada (puede crear duplicados)" },
              ].map((opt) => (
                <button
                  key={opt.val}
                  onClick={() => setMode(opt.val)}
                  className={`flex-1 min-w-[180px] text-left border-2 rounded-xl px-4 py-3 transition-all duration-150 ${
                    mode === opt.val
                      ? "border-blue-500 bg-blue-50"
                      : "border-slate-200 hover:border-blue-200"
                  }`}
                >
                  <p className={`text-sm font-bold ${mode === opt.val ? "text-blue-700" : "text-slate-700"}`}>{opt.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">{opt.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Preview */}
        {preview.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex items-center justify-between">
              <p className="text-xs font-bold uppercase tracking-widest text-slate-500">Vista previa — 5 primeras filas</p>
              <span className="text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">
                {parsed.rows.length} registros totales
              </span>
            </div>
            <div className="overflow-x-auto">
              <table className="text-xs w-full min-w-max">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 text-left">
                    {PREVIEW_COLS.map((h) => (
                      <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {preview.map((row, i) => (
                    <tr key={i} className="hover:bg-slate-50">
                      {PREVIEW_COLS.map((col) => (
                        <td key={col} className="px-3 py-1.5 text-slate-700 font-mono whitespace-nowrap">
                          {row[col] === null || row[col] === undefined
                            ? <span className="text-slate-300">—</span>
                            : String(row[col])}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Barra de progreso */}
        {importing && (
          <div className="bg-white rounded-2xl shadow-sm p-4">
            <p className="text-xs text-slate-500 mb-2">Importando registros...</p>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 mt-1.5 text-right">{progress}%</p>
          </div>
        )}

        {/* Resultado */}
        {result && (
          <div className={`rounded-2xl p-4 ${result.errors.length === 0 ? "bg-emerald-50 border border-emerald-200" : "bg-amber-50 border border-amber-200"}`}>
            <p className={`font-bold text-sm ${result.errors.length === 0 ? "text-emerald-700" : "text-amber-700"}`}>
              {result.errors.length === 0 ? "✓ Importación completada" : "⚠ Importación con errores"}
            </p>
            <p className="text-xs text-slate-600 mt-1">
              {result.inserted} de {result.total} registros insertados correctamente.
            </p>
            {result.errors.map((e, i) => (
              <div key={i} className="mt-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-xs text-red-700 font-semibold">Batch {e.batch}:</p>
                <p className="text-xs text-red-600 font-mono mt-0.5">{e.message}</p>
              </div>
            ))}
            {result.errors.length === 0 && (
              <button
                onClick={() => navigate(-1)}
                className="mt-3 text-xs text-emerald-700 underline"
              >
                ← Volver al reporte
              </button>
            )}
          </div>
        )}

        {/* Botón importar */}
        {parsed && !importing && !result && (
          <div className="flex justify-end pb-6">
            <button
              onClick={handleImport}
              className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white font-bold px-6 py-3 rounded-2xl shadow-sm transition-all duration-150 cursor-pointer"
            >
              Importar {parsed.rows.length} registros →
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
