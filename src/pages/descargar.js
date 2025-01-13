import supabase from '../supabase/client';
import Papa from 'papaparse';
import React from 'react';

const descargar = () => {
const fetchAndDownloadTableData = async (tableName) => {
  try {
    const { data, error } = await supabase.from(tableName).select('*');

    if (error) {
      console.error('Error al descargar los datos:', error);
      return;
    }

    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });

    // Crear un enlace para descargar el archivo
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.setAttribute('download', `${tableName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    console.log('Archivo CSV descargado correctamente.');
  } catch (error) {
    console.error('Error inesperado:', error);
  }
};

// Ejemplo de uso


useEffect(() => {
    fetchAndDownloadTableData('reporte-agua');
  }, []);
};
export default descargar;