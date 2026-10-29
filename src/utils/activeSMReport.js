import * as XLSX from 'xlsx';
import { readTerritorialRows, territorialReportFilename } from './territorialReport';
import { ACTIVE_SM_REPORT_COLUMNS, buildActiveSMReport } from './buildActiveSMReport';

export async function loadActiveSMReport(client) {
  const [fractions, sms] = await Promise.all([
    readTerritorialRows(() => client.from('ubt_catalogo')
      .select('sector, seccion, fraccion', { count: 'exact' }).order('sector').order('seccion').order('fraccion')),
    readTerritorialRows(() => client.from('ciudadania')
      .select('id, puesto, status, poligono, seccion, ubt', { count: 'exact' })
      .eq('puesto', 'SM').eq('status', 'ACTIVO').order('id')),
  ]);
  return buildActiveSMReport({ fractions, sms });
}

export function createActiveSMReportWorkbook(sheets) {
  const rows = sheets.flatMap(group => group.rows);
  if (!rows.length) throw new Error('No se encontraron fracciones ni SM activas para exportar.');
  const workbook = XLSX.utils.book_new();
  const sheet = XLSX.utils.aoa_to_sheet([ACTIVE_SM_REPORT_COLUMNS, ...rows]);
  sheet['!cols'] = [10, 12, 27, 15, 58].map(wch => ({ wch }));
  sheet['!autofilter'] = { ref: sheet['!ref'] };
  sheet['!rows'] = [{ hpt: 24 }];
  rows.forEach((row, index) => [0, 1, 3].forEach(column => {
    const cell = sheet[XLSX.utils.encode_cell({ r: index + 1, c: column })];
    if (cell?.t === 'n') cell.z = '0';
  }));
  XLSX.utils.book_append_sheet(workbook, sheet, 'SM activas');
  return workbook;
}

export const activeSMReportFilename = date => territorialReportFilename(date).replace('reporte_general_', 'sm_activas_');
