-- ============================================================
-- URGENTE: restaura el acceso de la app (clave anon) a las tablas.
-- Estas tablas tenían RLS activado pero SIN ninguna política, así que
-- con la clave anon correcta (ya no service_role) todas las consultas
-- devuelven 0 filas silenciosamente — de ahí "usuario o contraseña
-- incorrectos" para TODOS los usuarios, no solo uno.
--
-- La app entera funciona con una tabla propia de login (no Supabase Auth),
-- así que no hay forma de restringir por usuario a nivel de fila sin
-- rehacer la autenticación. Por eso el arreglo consistente con el resto
-- del proyecto (y con `secciones`, que nunca tuvo RLS y por eso seguía
-- funcionando) es desactivar RLS en estas tablas, igual que ya estaba
-- `secciones`.
-- ============================================================

alter table ciudadania           disable row level security;
alter table fracciones           disable row level security;
alter table ubt_catalogo         disable row level security;
alter table programas_sociales   disable row level security;
alter table apoyo_entregas       disable row level security;
alter table puestos              disable row level security;
alter table servidores           disable row level security;
alter table reportes_movilizacion disable row level security;
alter table cortes               disable row level security;
alter table evidencias           disable row level security;
