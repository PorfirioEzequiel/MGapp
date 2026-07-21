-- ============================================================
-- Check-in de asistencia (escaneo del QR del comprobante) para
-- el módulo de Certificado Médico. Ejecutar en el SQL Editor de Supabase.
-- ============================================================

alter table beneficiarios_certificados
  add column if not exists asistencia_registrada_at timestamptz;
