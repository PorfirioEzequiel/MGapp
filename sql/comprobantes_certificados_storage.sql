-- ============================================================
-- Bucket público para las imágenes del comprobante (mismo diseño
-- que el PDF) que se suben desde el navegador y se envían por
-- WhatsApp al confirmar el registro de Certificado Médico.
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('comprobantes_certificados', 'comprobantes_certificados', true)
on conflict (id) do nothing;
