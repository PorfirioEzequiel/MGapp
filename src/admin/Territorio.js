import { useEffect, useState } from "react";
import MapComponent2 from "../map/MapComponent2";
import supabase from "../supabase/client";
import { useNavigate } from "react-router-dom";

function Territorio(){

  // ... (código existente)
  
  const [resumenReportes, setResumenReportes] = useState([]);
  const [filtroSeccion, setFiltroSeccion] = useState('');
  const [filtroPoligono, setFiltroPoligono] = useState('');
  const [isLoadingResumen, setIsLoadingResumen] = useState(false);
  const [error, setError] = useState(null);
  // Función para obtener el resumen de reportes
  const fetchResumenReportes = async () => {
    setIsLoadingResumen(true);
    try {
      const { data, error } = await supabase
        .from('cortes')
        .select('seccion, poligono, twelve, fifteen, eighteen')
        .order('poligono', { ascending: true });

      if (error) throw error;

      // Procesar datos para agrupar por sección y polígono
      const resumen = data.reduce((acc, item) => {
        const key = `${item.seccion}-${item.poligono}`;
        if (!acc[key]) {
          acc[key] = {
            seccion: item.seccion,
            poligono: item.poligono,
            twelve: 0,
            fifteen: 0,
            eighteen: 0,
            total: 0
          };
        }
        
        // Sumar valores (verificando que no sean null)
        if (item.twelve) acc[key].twelve += item.twelve;
        if (item.fifteen) acc[key].fifteen += item.fifteen;
        if (item.eighteen) acc[key].eighteen += item.eighteen;
        
        // Calcular total por fila
        acc[key].total = acc[key].twelve + acc[key].fifteen + acc[key].eighteen;
        
        return acc;
      }, {});

      setResumenReportes(Object.values(resumen));
    } catch (error) {
      console.error("Error obteniendo resumen:", error);
      setError("Error al obtener el resumen de reportes");
    } finally {
      setIsLoadingResumen(false);
    }
  };

  // Llamar la función al montar el componente
  useEffect(() => {
    fetchResumenReportes();
  }, []);

  // Filtrar resultados
  const resumenFiltrado = resumenReportes.filter(item => 
    (filtroSeccion === '' || item.seccion.includes(filtroSeccion)) &&
    (filtroPoligono === '' || item.poligono.includes(filtroPoligono))
  );

  // Calcular totales generales
  const totalesGenerales = resumenFiltrado.reduce(
    (totales, item) => {
      totales.twelve += item.twelve;
      totales.fifteen += item.fifteen;
      totales.eighteen += item.eighteen;
      totales.general += item.total;
      return totales;
    }, 
    { twelve: 0, fifteen: 0, eighteen: 0, general: 0 }
  );

  return (
    <div className='mx-auto'>
      {/* ... (código existente) */}

      {/* Sección del resumen */}
      <div className='my-8 p-4 bg-white rounded-lg shadow'>
        <h2 className="text-xl font-bold mb-4">Resumen de Reportes</h2>
        
        {/* Filtros */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-sm font-medium mb-1">Sección</label>
            <input
              type="text"
              value={filtroSeccion}
              onChange={(e) => setFiltroSeccion(e.target.value)}
              className="w-full border p-2 rounded"
              placeholder="Filtrar por sección"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Polígono</label>
            <input
              type="text"
              value={filtroPoligono}
              onChange={(e) => setFiltroPoligono(e.target.value)}
              className="w-full border p-2 rounded"
              placeholder="Filtrar por polígono"
            />
          </div>
          <div className="flex items-end">
            <button 
              onClick={fetchResumenReportes}
              disabled={isLoadingResumen}
              className="bg-blue-500 text-white px-4 py-2 rounded disabled:opacity-50"
            >
              {isLoadingResumen ? 'Actualizando...' : 'Actualizar Datos'}
            </button>
          </div>
        </div>

        {/* Tabla de resultados */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-100">
                <th className="border p-2 text-left">Sección</th>
                <th className="border p-2 text-left">Polígono</th>
                <th className="border p-2 text-right">12:00 HRS</th>
                <th className="border p-2 text-right">15:00 HRS</th>
                <th className="border p-2 text-right">18:00 HRS</th>
                <th className="border p-2 text-right font-bold">Total</th>
              </tr>
            </thead>
            <tbody>
              {isLoadingResumen ? (
                <tr>
                  <td colSpan="6" className="border p-4 text-center">
                    Cargando datos...
                  </td>
                </tr>
              ) : resumenFiltrado.length > 0 ? (
                resumenFiltrado
                  .sort((a, b) => a.seccion.localeCompare(b.seccion) || a.poligono.localeCompare(b.poligono))
                  .map((item, index) => (
                    <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                      <td className="border p-2">{item.seccion}</td>
                      <td className="border p-2">{item.poligono}</td>
                      <td className="border p-2 text-right">{item.twelve.toLocaleString()}</td>
                      <td className="border p-2 text-right">{item.fifteen.toLocaleString()}</td>
                      <td className="border p-2 text-right">{item.eighteen.toLocaleString()}</td>
                      <td className="border p-2 text-right font-bold">{item.total.toLocaleString()}</td>
                    </tr>
                  ))
              ) : (
                <tr>
                  <td colSpan="6" className="border p-4 text-center">
                    No se encontraron resultados
                  </td>
                </tr>
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-100 font-bold">
                <td className="border p-2" colSpan="2">Total General</td>
                <td className="border p-2 text-right">{totalesGenerales.twelve.toLocaleString()}</td>
                <td className="border p-2 text-right">{totalesGenerales.fifteen.toLocaleString()}</td>
                <td className="border p-2 text-right">{totalesGenerales.eighteen.toLocaleString()}</td>
                <td className="border p-2 text-right">{totalesGenerales.general.toLocaleString()}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ... (resto del código existente) */}
    </div>
  );
};
export default Territorio;