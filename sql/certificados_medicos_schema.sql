-- ============================================================
-- MÓDULO: Registro público (sin login) para el beneficio de
-- Certificado Médico. No toca ninguna tabla existente.
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- 0. PRIMERO lo más urgente: acceso de la clave anon a estas tablas.
--    Va al principio, sin depender de que el resto del script no falle antes.
--
--    IMPORTANTE: en vez de solo desactivar RLS (que se puede volver a activar
--    sin querer con el botón "Enable RLS" que Supabase muestra en el Table
--    Editor para cualquier tabla sin RLS -- esto es probablemente lo que pasó
--    la vez pasada), aquí dejamos RLS ACTIVADO pero con una política explícita
--    que permite todo a la clave anon. Así Supabase deja de mostrar ese aviso
--    para estas tablas, y aunque alguien vuelva a tocar el interruptor de RLS,
--    la política sigue permitiendo el acceso.
do $$
begin
  if to_regclass('public.beneficiarios_certificados') is not null then
    execute 'alter table beneficiarios_certificados enable row level security';
    execute 'drop policy if exists "anon_acceso_total" on beneficiarios_certificados';
    execute 'create policy "anon_acceso_total" on beneficiarios_certificados for all to anon using (true) with check (true)';
  end if;
  if to_regclass('public.beneficiarios_certificados_menores') is not null then
    execute 'alter table beneficiarios_certificados_menores enable row level security';
    execute 'drop policy if exists "anon_acceso_total" on beneficiarios_certificados_menores';
    execute 'create policy "anon_acceso_total" on beneficiarios_certificados_menores for all to anon using (true) with check (true)';
  end if;
end $$;

create table if not exists beneficiarios_certificados (
  id               bigint generated always as identity primary key,
  folio            text not null unique,     -- código corto que el tutor guarda para reagendar

  tutor_nombre     text not null,
  tutor_a_paterno  text,
  tutor_a_materno  text,
  tutor_curp       text not null,
  tutor_edad       integer,                  -- calculada de la CURP al momento del registro
  tutor_sexo       text,

  -- Por temas legales NO se pide domicilio (calle/n_ext/n_int/n_casa) ni
  -- sección electoral: solo código postal, colonia y teléfono.
  c_p              text not null,
  col_loc          text not null,
  telefono         text not null,

  numero_menores   integer not null default 0,
  como_se_entero      text not null,          -- REDES_SOCIALES | SM_INVITO | OTRO
  como_se_entero_otro text,

  fecha_cita       date not null,
  hora_cita        time not null,
  status           text not null default 'AGENDADA', -- AGENDADA | REAGENDADA | CANCELADA | ATENDIDA

  created_at       timestamptz not null default now()
);

-- Si ya habías corrido una versión anterior con domicilio/sección obligatorios,
-- esto los vuelve opcionales (ya no se piden en el formulario, pero las columnas
-- pueden quedarse en la tabla con datos viejos sin romper nada nuevo):
alter table beneficiarios_certificados alter column calle drop not null;
alter table beneficiarios_certificados alter column n_ext_mz drop not null;

create index if not exists beneficiarios_certificados_cita_idx
  on beneficiarios_certificados (fecha_cita, hora_cita);
create index if not exists beneficiarios_certificados_folio_idx
  on beneficiarios_certificados (folio);

create table if not exists beneficiarios_certificados_menores (
  id                            bigint generated always as identity primary key,
  beneficiario_certificado_id   bigint not null references beneficiarios_certificados(id) on delete cascade,
  tutor_curp                    text,         -- vínculo directo con el tutor, además de la FK de arriba
  tutor_nombre_completo         text,
  nombre                        text not null,
  a_paterno                     text,
  a_materno                     text,
  curp                          text,
  edad                          integer,      -- calculada de la CURP al momento del registro
  created_at                    timestamptz not null default now()
);

-- Por si ya habías corrido una versión anterior de este script sin estas columnas:
alter table beneficiarios_certificados_menores add column if not exists tutor_curp text;
alter table beneficiarios_certificados_menores add column if not exists tutor_nombre_completo text;

create index if not exists beneficiarios_certificados_menores_padre_idx
  on beneficiarios_certificados_menores (beneficiario_certificado_id);
create index if not exists beneficiarios_certificados_menores_tutor_idx
  on beneficiarios_certificados_menores (tutor_curp);

-- Repetido al final por si acaso: garantiza la política incluso si esta es
-- la primera vez que se crean las tablas en esta misma corrida (arriba, el
-- bloque 0 se salta a sí mismo si la tabla todavía no existía).
alter table beneficiarios_certificados enable row level security;
drop policy if exists "anon_acceso_total" on beneficiarios_certificados;
create policy "anon_acceso_total" on beneficiarios_certificados for all to anon using (true) with check (true);

alter table beneficiarios_certificados_menores enable row level security;
drop policy if exists "anon_acceso_total" on beneficiarios_certificados_menores;
create policy "anon_acceso_total" on beneficiarios_certificados_menores for all to anon using (true) with check (true);
