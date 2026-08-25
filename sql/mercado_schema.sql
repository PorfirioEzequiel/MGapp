-- ============================================================
-- TABLA: mercado
-- Historial de entregas del Mercado Solidario
-- ============================================================
-- ANTES de importar el CSV, corregir dos encabezados en Excel:
--   "coordinador " (con espacio) → "coordinador"
--   "ubicación"   (con acento)   → "ubicacion"
-- También reemplazar cualquier "#VALUE!" en la columna restan por vacío.
-- ============================================================

CREATE TABLE IF NOT EXISTS mercado (
  id                   bigint,
  fecha_creacion       text,
  año                  integer,
  mes                  text,
  entrega              integer,
  fecha_entrega        text,
  numero_viaje         integer,
  camioneta_repartidor text,
  coordinador          text,
  sector               integer,
  seccion              integer,
  fracciones           integer,
  sm_activas           integer,
  piezas               integer,
  total                integer,
  entregadas           integer,
  restan               text,       -- puede contener texto de errores Excel
  estatus              text,
  nombre               text,
  telefono             text,
  ubicacion            text,
  latitud              double precision,
  longitud             double precision,
  ubicacion_repetida   text
);

ALTER TABLE mercado DISABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_mercado_entrega ON mercado(entrega);
CREATE INDEX IF NOT EXISTS idx_mercado_sector  ON mercado(sector);
CREATE INDEX IF NOT EXISTS idx_mercado_mes     ON mercado(mes);
CREATE INDEX IF NOT EXISTS idx_mercado_estatus ON mercado(estatus);
