// Utilidades para extraer y validar datos de una CURP mexicana.
// La CURP codifica fecha de nacimiento y sexo en posiciones fijas, así que
// edad/sexo se calculan directamente de la CURP en vez de depender del
// formato (no estandarizado) del contenido del QR de la constancia.

const CURP_REGEX = /[A-Z][AEIOUX][A-Z]{2}\d{2}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])[HM](AS|BC|BS|CC|CL|CM|CS|CH|DF|DG|GT|GR|HG|JC|MC|MN|MS|NT|NL|OC|PL|QO|QR|SP|SL|SR|TC|TS|TL|VZ|YN|ZS|NE)[B-DF-HJ-NP-TV-Z]{3}[A-Z\d]\d/;

// Busca una CURP válida dentro de cualquier texto (por ejemplo, el
// contenido crudo escaneado del QR, sea cual sea su formato).
export function extractCurp(rawText) {
  if (!rawText) return null;
  const match = String(rawText).toUpperCase().replace(/\s+/g, "").match(CURP_REGEX);
  return match ? match[0] : null;
}

// Calcula fecha de nacimiento, sexo y edad a partir de una CURP válida.
// Posiciones (0-indexadas): [4-9] AAMMDD, [10] sexo H/M, [16] diferenciador
// de homoclave (dígito si nació antes del 2000, letra si nació 2000+).
export function parseCurp(curp) {
  if (!curp || curp.length !== 18) return null;

  const yy = curp.substring(4, 6);
  const mm = curp.substring(6, 8);
  const dd = curp.substring(8, 10);
  const sexoChar = curp.charAt(10);
  const diferenciador = curp.charAt(16);

  const esSigloXXI = /[A-Z]/.test(diferenciador);
  const anio = (esSigloXXI ? 2000 : 1900) + Number(yy);
  const mes = Number(mm);
  const dia = Number(dd);

  const fechaNacimiento = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    isNaN(fechaNacimiento.getTime()) ||
    fechaNacimiento.getUTCFullYear() !== anio ||
    fechaNacimiento.getUTCMonth() !== mes - 1 ||
    fechaNacimiento.getUTCDate() !== dia
  ) {
    return null; // fecha inválida, la CURP no pasa el checksum básico de fecha
  }

  const hoy = new Date();
  let edad = hoy.getUTCFullYear() - fechaNacimiento.getUTCFullYear();
  const noHaCumplidoAnios =
    hoy.getUTCMonth() < fechaNacimiento.getUTCMonth() ||
    (hoy.getUTCMonth() === fechaNacimiento.getUTCMonth() && hoy.getUTCDate() < fechaNacimiento.getUTCDate());
  if (noHaCumplidoAnios) edad -= 1;

  return {
    curp,
    fechaNacimiento,
    sexo: sexoChar === "H" ? "HOMBRE" : sexoChar === "M" ? "MUJER" : null,
    edad,
  };
}

// Atajo: de un texto crudo escaneado, regresa
// { curp, edad, sexo, fechaNacimiento, nombre, aPaterno, aMaterno } o null.
// nombre/aPaterno/aMaterno vienen vacíos si el QR no trae ese formato --
// edad y sexo siempre se calculan de la CURP misma, nunca del texto plano.
export function datosDesdeTextoQR(rawText) {
  if (!rawText) return null;
  const texto = String(rawText).trim();

  // Formato con datos en claro separados por "|":
  // CURP|CURP_alt|APELLIDO_PATERNO|APELLIDO_MATERNO|NOMBRE|SEXO|DD/MM/AAAA|ENTIDAD|...
  const partes = texto.split("|").map((p) => p.trim());
  if (partes.length >= 5) {
    const curpCandidata = extractCurp(partes[0]);
    if (curpCandidata && curpCandidata === partes[0].toUpperCase().replace(/\s+/g, "")) {
      const datosCurp = parseCurp(curpCandidata);
      if (datosCurp) {
        return {
          ...datosCurp,
          aPaterno: partes[2] || "",
          aMaterno: partes[3] || "",
          nombre: partes[4] || "",
        };
      }
    }
  }

  // Formato desconocido: solo se busca la CURP en cualquier parte del texto
  const curp = extractCurp(texto);
  if (!curp) return null;
  const datos = parseCurp(curp);
  if (!datos) return null;
  return { ...datos, aPaterno: "", aMaterno: "", nombre: "" };
}
