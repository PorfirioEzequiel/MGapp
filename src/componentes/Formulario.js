import React, { useState } from "react";
import localidadesData from "../codigospostales.json";

const Formulario = () => {
  const [codigoPostal, setCodigoPostal] = useState("");
  const [localidades, setLocalidades] = useState([]);

  const handleCodigoPostalChange = (e) => {
    const inputCodigoPostal = e.target.value;
    setCodigoPostal(inputCodigoPostal);

    // Filtrar las localidades según el código postal
    const localidadesFiltradas = localidadesData.filter(
      (localidad) => localidad.d_codigo.toString() === inputCodigoPostal
    );

    // Extraer solo los nombres de las localidades
    const nombresLocalidades = localidadesFiltradas.map(
      (localidad) => localidad.d_asenta
    );

    setLocalidades(nombresLocalidades);
  };

  return (
    <div>
      <form>
        <div>
          <label>Código Postal:</label>
          <input
            type="text"
            value={codigoPostal}
            onChange={handleCodigoPostalChange}
            placeholder="Ingrese el código postal"
          />
        </div>
        <div>
          <label>Localidad:</label>
          <select>
            {localidades.length > 0 ? (
              localidades.map((localidad, index) => (
                <option key={index} value={localidad}>
                  {localidad}
                </option>
              ))
            ) : (
              <option value="">Seleccione una localidad</option>
            )}
          </select>
        </div>
      </form>
    </div>
  );
};

export default Formulario;
