-- ============================================================================
-- Usuario CAPTURA — acceso exclusivo al formulario "Nuevo Movilizador"
-- Ruta autorizada: /captura  (renderiza src/admin/MoviladoresGestion.js)
-- ============================================================================
-- Credenciales:
--   usuario:    captura@tecamac.com
--   contraseña: Captura2027
--   puesto:     captura
-- ============================================================================

INSERT INTO ciudadania (usuario, password, puesto, status, nombre, a_paterno)
VALUES (
  'captura@tecamac.com',
  'Captura2027',
  'captura',
  'ACTIVO',
  'Captura',
  'Movilizadores'
);

-- Si el usuario ya existía y solo hay que reactivarlo / actualizar contraseña:
-- UPDATE ciudadania
--    SET password = 'Captura2027',
--        puesto   = 'captura',
--        status   = 'ACTIVO'
--  WHERE usuario  = 'captura@tecamac.com';
