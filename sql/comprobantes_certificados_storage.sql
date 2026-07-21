-- ============================================================
-- Bucket público para las imágenes del comprobante (mismo diseño
-- que el PDF) que se suben desde el navegador y se envían por
-- WhatsApp al confirmar el registro de Certificado Médico.
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

insert into storage.buckets (id, name, public)
values ('comprobantes_certificados', 'comprobantes_certificados', true)
on conflict (id) do nothing;

-- RLS de storage.objects está activado a nivel proyecto y por default no deja
-- pasar nada: sin esto, el registro público (rol anon) no puede subir la
-- imagen del comprobante y el envío automático por WhatsApp falla en
-- silencio (el error solo queda en la consola del navegador).
drop policy if exists "anon_insert_comprobantes_certificados" on storage.objects;
create policy "anon_insert_comprobantes_certificados"
  on storage.objects for insert to anon
  with check (bucket_id = 'comprobantes_certificados');

drop policy if exists "anon_select_comprobantes_certificados" on storage.objects;
create policy "anon_select_comprobantes_certificados"
  on storage.objects for select to anon
  using (bucket_id = 'comprobantes_certificados');

drop policy if exists "anon_update_comprobantes_certificados" on storage.objects;
create policy "anon_update_comprobantes_certificados"
  on storage.objects for update to anon
  using (bucket_id = 'comprobantes_certificados')
  with check (bucket_id = 'comprobantes_certificados');
