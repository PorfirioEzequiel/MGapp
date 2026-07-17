-- ============================================================
-- MÓDULO: Apoyos / Programas Sociales (Mercadito Solidario, Tinacos, etc.)
-- v2: los beneficiarios viven en `ciudadania` (puesto = 'BENEFICIARIO'),
-- no en una tabla aparte. Solo el catálogo de programas y el control de
-- entregas por periodo quedan en tablas nuevas.
-- Ejecutar en el SQL Editor de Supabase.
-- ============================================================

-- 0. `ciudadania` no tenía PRIMARY KEY (solo UNIQUE en curp y usuario) —
--    por eso falló la v1 al crear una FK contra ciudadania(id). Se agrega
--    de forma segura (no toca datos existentes, solo formaliza lo que la
--    app ya asume: id es único, ej. rutas /ciudadano/:id).
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conrelid = 'ciudadania'::regclass and contype = 'p'
  ) then
    alter table ciudadania add primary key (id);
  end if;
end $$;

-- Si ya habías corrido la v1 de este script, esto limpia lo que haya
-- quedado a medias (apoyo_beneficiarios nunca llegó a tener datos reales,
-- porque la FK fallaba desde el primer intento).
drop table if exists apoyo_entregas cascade;
drop table if exists apoyo_beneficiarios cascade;

-- 1. Catálogo de programas
create table if not exists programas_sociales (
  id           bigint generated always as identity primary key,
  nombre       text not null unique,          -- ej. 'MERCADITO SOLIDARIO', 'TINACOS'
  descripcion  text,
  frecuencia   text not null default 'SEMANAL', -- SEMANAL | UNICA | MENSUAL (solo informativo)
  activo       boolean not null default true,
  created_at   timestamptz not null default now()
);

insert into programas_sociales (nombre, descripcion, frecuencia)
values
  ('MERCADITO SOLIDARIO', 'Costal de verdura semanal', 'SEMANAL'),
  ('TINACOS', 'Entrega de tinaco', 'UNICA')
on conflict (nombre) do nothing;

-- 2. Entregas: una fila por beneficio entregado/programado (cada semana de
--    Mercadito, o el evento único de Tinacos), apuntando directo a ciudadania.
create table if not exists apoyo_entregas (
  id              bigint generated always as identity primary key,
  beneficiario_id bigint not null references ciudadania(id),
  programa_id     bigint not null references programas_sociales(id),
  periodo         text not null,        -- ej. '2026-W28' (semana ISO) o 'UNICA' para entrega única
  cantidad        integer not null default 1,
  status          text not null default 'PENDIENTE', -- PENDIENTE | ENTREGADO | NO ENTREGADO
  foto_evidencia_url text,
  entregado_por   text,                 -- usuario (SP o SM) que marcó la entrega
  fecha_entrega   timestamptz,
  created_at      timestamptz not null default now(),
  unique (beneficiario_id, programa_id, periodo)  -- evita duplicar la entrega de la misma semana/programa
);

create index if not exists apoyo_entregas_programa_periodo_idx on apoyo_entregas (programa_id, periodo);
create index if not exists apoyo_entregas_beneficiario_idx     on apoyo_entregas (beneficiario_id);

-- 3. Bucket de Storage para las fotos de evidencia de entrega
insert into storage.buckets (id, name, public)
values ('evidencias_apoyos', 'evidencias_apoyos', true)
on conflict (id) do nothing;

-- NOTA: los beneficiarios nuevos se dan de alta directamente en `ciudadania`
-- con puesto = 'BENEFICIARIO' (la app valida primero por CURP contra esa
-- misma tabla para no duplicar ni volver a pedir datos si ya existe).
-- El campo `movilizador` guarda el `usuario` del SM que lo registró — es lo
-- que la app usa para filtrar "mis beneficiarios" en la pantalla del SM,
-- ya que ciudadania no tiene una columna dedicada para esa relación.
-- `historial_programas` se va concatenando en texto cada vez que se marca
-- una entrega como ENTREGADO (ej. "MERCADITO SOLIDARIO (2026-W28); ...").

-- NOTA DE SEGURIDAD: igual que el resto de las tablas de este proyecto,
-- apoyo_entregas y programas_sociales quedan sin RLS porque el login no usa
-- Supabase Auth. Misma limitación ya señalada para `ciudadania`.
