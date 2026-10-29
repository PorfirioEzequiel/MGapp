import React, { useRef, useState } from 'react';
import { FiDownload, FiLoader } from 'react-icons/fi';
import * as XLSX from 'xlsx';
import { supabaseStorage as supabaseAdmin } from '../supabase/client';
import { loadActiveSMReport, createActiveSMReportWorkbook, activeSMReportFilename } from '../utils/activeSMReport';

export default function ActiveSMReportButton({ onError }) {
  const [loading, setLoading] = useState(false);
  const pending = useRef(false);
  const download = async () => {
    if (pending.current) return;
    pending.current = true;
    setLoading(true);
    onError(null);
    try {
      // Read a fresh snapshot on every download, independently of map filters
      // and of the credential services in MongoDB.
      const sheets = await loadActiveSMReport(supabaseAdmin);
      XLSX.writeFile(createActiveSMReportWorkbook(sheets), activeSMReportFilename());
    } catch (error) {
      onError(`No se pudo exportar SM activas. ${error.message || 'Intenta de nuevo.'}`);
    } finally {
      pending.current = false;
      setLoading(false);
    }
  };
  return (
    <button type="button" onClick={download} disabled={loading} aria-busy={loading}
      title="Descargar todas las fracciones y SM activas en una sola hoja, con columna Sector para filtrar"
      className="flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg border text-[11px] font-semibold whitespace-nowrap transition-colors disabled:opacity-40 disabled:cursor-wait">
      {loading ? <FiLoader aria-hidden="true" className="motion-safe:animate-spin" /> : <FiDownload aria-hidden="true" />}
      {loading ? 'Preparando Excel…' : 'SM activas por sector'}
    </button>
  );
}
