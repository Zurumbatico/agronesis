create extension if not exists pgcrypto;

create sequence if not exists public.agricultores_codigo_seq;
create sequence if not exists public.productos_codigo_seq;

create or replace function public.generate_agricultor_codigo()
returns text
language plpgsql
as $$
begin
  return 'AGRI-' || lpad(nextval('public.agricultores_codigo_seq')::text, 6, '0');
end;
$$;

create or replace function public.set_agricultor_codigo()
returns trigger
language plpgsql
as $$
begin
  -- El código siempre se define en backend para evitar inconsistencias del frontend.
  new.codigo := public.generate_agricultor_codigo();
  return new;
end;
$$;

create or replace function public.protect_agricultor_codigo()
returns trigger
language plpgsql
as $$
begin
  new.codigo := old.codigo;
  return new;
end;
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.generate_producto_codigo()
returns text
language plpgsql
as $$
begin
  return 'PROD-' || lpad(nextval('public.productos_codigo_seq')::text, 6, '0');
end;
$$;

create or replace function public.set_producto_codigo()
returns trigger
language plpgsql
as $$
begin
  -- El codigo siempre se define en backend para evitar inconsistencias del frontend.
  new.codigo := public.generate_producto_codigo();
  return new;
end;
$$;

create or replace function public.protect_producto_codigo()
returns trigger
language plpgsql
as $$
begin
  new.codigo := old.codigo;
  return new;
end;
$$;

create table if not exists public.agricultores (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  codigo text not null unique default public.generate_agricultor_codigo(),
  nombre text not null,
  apellido text not null,
  dni text null,
  telefono text null,
  numero_cuenta text null,
  fecha_alta date not null default current_date,
  ubicacion text null,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo'))
);

do $$
begin
  alter table public.agricultores add column if not exists numero_cuenta text null;
  alter table public.agricultores add column if not exists fecha_alta date not null default current_date;

  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'agricultores' and column_name = 'direccion'
  ) then
    alter table public.agricultores add column if not exists ubicacion text;
    update public.agricultores
      set ubicacion = coalesce(nullif(ubicacion, ''), nullif(direccion, ''), nullif(sector, ''));
    alter table public.agricultores drop column if exists direccion;
    alter table public.agricultores drop column if exists sector;
  end if;
end;
$$;

create table if not exists public.productos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  codigo text not null unique default public.generate_producto_codigo(),
  nombre text not null,
  variedad text not null default 'snow_peas' check (variedad in ('snow_peas', 'sugar')),
  calidad text not null default 'cat1' check (calidad in ('cat1', 'cat2')),
  tipo_produccion text not null default 'convencional' check (tipo_produccion in ('organico', 'convencional'))
);

alter table public.productos
  add column if not exists variedad text not null default 'snow_peas';
alter table public.productos
  add column if not exists calidad text not null default 'cat1';
alter table public.productos
  add column if not exists tipo_produccion text not null default 'convencional';
alter table public.productos
  drop column if exists estado;

do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'productos' and column_name = 'tipo'
  ) then
    update public.productos
      set variedad = case
        when tipo in ('holantao', 'snow_peas') then 'snow_peas'
        else 'sugar'
      end
    where variedad is null or variedad not in ('snow_peas', 'sugar');
  end if;
end;
$$;

alter table public.productos alter column codigo set default public.generate_producto_codigo();

create table if not exists public.agricultor_producto_hectareas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  agricultor_id uuid not null references public.agricultores(id) on delete cascade,
  producto_id uuid not null references public.productos(id) on delete restrict,
  hectareas numeric(12,2) not null check (hectareas > 0),
  constraint uq_agricultor_producto_hectareas unique (agricultor_id, producto_id)
);

create or replace function public.replace_agricultor_hectareas(
  p_agricultor_id uuid,
  p_created_by uuid,
  p_items jsonb
)
returns void
language plpgsql
as $$
begin
  delete from public.agricultor_producto_hectareas
  where agricultor_id = p_agricultor_id;

  if p_items is null
    or jsonb_typeof(p_items) <> 'array'
    or jsonb_array_length(p_items) = 0 then
    return;
  end if;

  insert into public.agricultor_producto_hectareas (
    created_by,
    agricultor_id,
    producto_id,
    hectareas
  )
  select
    p_created_by,
    p_agricultor_id,
    producto_id,
    max(hectareas)
  from (
    select
      nullif(item ->> 'producto_id', '')::uuid as producto_id,
      (item ->> 'hectareas')::numeric(12,2) as hectareas
    from jsonb_array_elements(p_items) as item
  ) payload
  where producto_id is not null
    and hectareas is not null
    and hectareas > 0
  group by producto_id;
end;
$$;

create table if not exists public.personal_campo (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  codigo text not null unique,
  nombre text not null,
  apellido text not null,
  dni text null,
  telefono text null,
  numero_cuenta text null,
  fecha_alta date not null default current_date,
  tipo text not null check (tipo in ('clasificador', 'cosechador', 'empacador', 'supervisor')),
  tarifa_destajo numeric(12,2) not null default 0,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo'))
);

alter table public.personal_campo add column if not exists numero_cuenta text null;
alter table public.personal_campo add column if not exists fecha_alta date not null default current_date;

create table if not exists public.centros_acopio (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  codigo text not null unique,
  nombre text not null,
  ubicacion text null,
  responsable text null,
  estado text not null default 'activo' check (estado in ('activo', 'inactivo'))
);

create table if not exists public.lotes (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  codigo text not null unique,
  agricultor_id uuid not null references public.agricultores(id) on delete restrict,
  producto_id uuid not null references public.productos(id) on delete restrict,
  centro_acopio_id uuid not null references public.centros_acopio(id) on delete restrict,
  fecha_ingreso date not null,
  peso_bruto_kg numeric(12,2) not null,
  num_cubetas integer not null default 0,
  observaciones text null,
  estado text not null default 'ingresado' check (estado in ('ingresado', 'en_clasificacion', 'clasificado', 'en_despacho', 'despachado', 'liquidado'))
);

create table if not exists public.clasificaciones (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  lote_id uuid not null references public.lotes(id) on delete cascade,
  personal_id uuid not null references public.personal_campo(id) on delete restrict,
  categoria text not null check (categoria in ('primera', 'segunda', 'descarte')),
  peso_kg numeric(12,2) not null,
  num_cajas integer not null default 0,
  fecha_clasificacion date not null,
  observaciones text null
);

create table if not exists public.despachos (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  lote_id uuid not null references public.lotes(id) on delete cascade,
  fecha_despacho date not null,
  destino text not null check (destino in ('exportacion', 'mercado_local', 'planta_proceso')),
  transportista text null,
  placa_vehiculo text null,
  num_cajas_despachadas integer not null default 0,
  peso_neto_kg numeric(12,2) not null,
  precio_venta_kg numeric(12,2) not null,
  observaciones text null
);

create table if not exists public.liquidaciones_agri (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  codigo text not null unique,
  agricultor_id uuid not null references public.agricultores(id) on delete restrict,
  fecha_inicio date not null,
  fecha_fin date not null,
  total_kg numeric(12,2) not null default 0,
  total_monto numeric(12,2) not null default 0,
  estado text not null default 'borrador' check (estado in ('borrador', 'confirmada', 'pagada')),
  observaciones text null
);

create table if not exists public.liquidacion_agri_detalle (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  liquidacion_id uuid not null references public.liquidaciones_agri(id) on delete cascade,
  lote_id uuid not null references public.lotes(id) on delete restrict,
  categoria text not null check (categoria in ('primera', 'segunda', 'descarte')),
  peso_kg numeric(12,2) not null,
  precio_kg numeric(12,2) not null,
  subtotal numeric(12,2) not null
);

create table if not exists public.actividades_personal (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  personal_id uuid not null references public.personal_campo(id) on delete restrict,
  lote_id uuid not null references public.lotes(id) on delete restrict,
  tipo_actividad text not null check (tipo_actividad in ('clasificacion', 'cosecha', 'empaque', 'carga')),
  fecha date not null,
  cantidad_unidades integer not null default 0,
  tarifa_unitaria numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  observaciones text null
);

create table if not exists public.liquidaciones_personal (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  codigo text not null unique,
  personal_id uuid not null references public.personal_campo(id) on delete restrict,
  quincena text not null,
  total_unidades integer not null default 0,
  total_monto numeric(12,2) not null default 0,
  estado text not null default 'borrador' check (estado in ('borrador', 'confirmada', 'pagada')),
  observaciones text null
);

create table if not exists public.movimientos_cubetas (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id) on delete restrict,
  agricultor_id uuid not null references public.agricultores(id) on delete restrict,
  lote_id uuid null references public.lotes(id) on delete set null,
  tipo text not null check (tipo in ('entrega', 'devolucion')),
  cantidad integer not null default 0,
  fecha date not null,
  observaciones text null
);

create index if not exists idx_agricultores_codigo on public.agricultores(codigo);
create index if not exists idx_productos_codigo on public.productos(codigo);
create index if not exists idx_agricultor_producto_hectareas_agricultor_id on public.agricultor_producto_hectareas(agricultor_id);
create index if not exists idx_agricultor_producto_hectareas_producto_id on public.agricultor_producto_hectareas(producto_id);
create index if not exists idx_personal_campo_codigo on public.personal_campo(codigo);
create index if not exists idx_centros_acopio_codigo on public.centros_acopio(codigo);
create index if not exists idx_lotes_codigo on public.lotes(codigo);
create index if not exists idx_lotes_agricultor_id on public.lotes(agricultor_id);
create index if not exists idx_lotes_producto_id on public.lotes(producto_id);
create index if not exists idx_lotes_centro_acopio_id on public.lotes(centro_acopio_id);
create index if not exists idx_clasificaciones_lote_id on public.clasificaciones(lote_id);
create index if not exists idx_clasificaciones_personal_id on public.clasificaciones(personal_id);
create index if not exists idx_despachos_lote_id on public.despachos(lote_id);
create index if not exists idx_liquidaciones_agri_agricultor_id on public.liquidaciones_agri(agricultor_id);
create index if not exists idx_liquidacion_agri_detalle_liquidacion_id on public.liquidacion_agri_detalle(liquidacion_id);
create index if not exists idx_actividades_personal_personal_id on public.actividades_personal(personal_id);
create index if not exists idx_actividades_personal_lote_id on public.actividades_personal(lote_id);
create index if not exists idx_liquidaciones_personal_personal_id on public.liquidaciones_personal(personal_id);
create index if not exists idx_movimientos_cubetas_agricultor_id on public.movimientos_cubetas(agricultor_id);

drop trigger if exists trg_agricultores_updated_at on public.agricultores;
create trigger trg_agricultores_updated_at before update on public.agricultores for each row execute function public.set_updated_at();

drop trigger if exists trg_agricultores_protect_codigo on public.agricultores;
create trigger trg_agricultores_protect_codigo before update on public.agricultores for each row execute function public.protect_agricultor_codigo();

drop trigger if exists trg_agricultores_codigo on public.agricultores;
create trigger trg_agricultores_codigo before insert on public.agricultores for each row execute function public.set_agricultor_codigo();

alter table public.agricultores alter column codigo set default public.generate_agricultor_codigo();

drop trigger if exists trg_productos_updated_at on public.productos;
create trigger trg_productos_updated_at before update on public.productos for each row execute function public.set_updated_at();

drop trigger if exists trg_productos_protect_codigo on public.productos;
create trigger trg_productos_protect_codigo before update on public.productos for each row execute function public.protect_producto_codigo();

drop trigger if exists trg_productos_codigo on public.productos;
create trigger trg_productos_codigo before insert on public.productos for each row execute function public.set_producto_codigo();

do $$
declare
  v_max bigint;
begin
  select coalesce(max(substring(codigo from '^AGRI-(\d+)$')::bigint), 0)
  into v_max
  from public.agricultores;

  if v_max = 0 then
    perform setval('public.agricultores_codigo_seq', 1, false);
  else
    perform setval('public.agricultores_codigo_seq', v_max, true);
  end if;
end;
$$;

drop trigger if exists trg_productos_updated_at on public.productos;
create trigger trg_productos_updated_at before update on public.productos for each row execute function public.set_updated_at();

drop trigger if exists trg_agricultor_producto_hectareas_updated_at on public.agricultor_producto_hectareas;
create trigger trg_agricultor_producto_hectareas_updated_at before update on public.agricultor_producto_hectareas for each row execute function public.set_updated_at();

drop trigger if exists trg_personal_campo_updated_at on public.personal_campo;
create trigger trg_personal_campo_updated_at before update on public.personal_campo for each row execute function public.set_updated_at();

drop trigger if exists trg_centros_acopio_updated_at on public.centros_acopio;
create trigger trg_centros_acopio_updated_at before update on public.centros_acopio for each row execute function public.set_updated_at();

drop trigger if exists trg_lotes_updated_at on public.lotes;
create trigger trg_lotes_updated_at before update on public.lotes for each row execute function public.set_updated_at();

drop trigger if exists trg_clasificaciones_updated_at on public.clasificaciones;
create trigger trg_clasificaciones_updated_at before update on public.clasificaciones for each row execute function public.set_updated_at();

drop trigger if exists trg_despachos_updated_at on public.despachos;
create trigger trg_despachos_updated_at before update on public.despachos for each row execute function public.set_updated_at();

drop trigger if exists trg_liquidaciones_agri_updated_at on public.liquidaciones_agri;
create trigger trg_liquidaciones_agri_updated_at before update on public.liquidaciones_agri for each row execute function public.set_updated_at();

drop trigger if exists trg_liquidacion_agri_detalle_updated_at on public.liquidacion_agri_detalle;
create trigger trg_liquidacion_agri_detalle_updated_at before update on public.liquidacion_agri_detalle for each row execute function public.set_updated_at();

drop trigger if exists trg_actividades_personal_updated_at on public.actividades_personal;
create trigger trg_actividades_personal_updated_at before update on public.actividades_personal for each row execute function public.set_updated_at();

drop trigger if exists trg_liquidaciones_personal_updated_at on public.liquidaciones_personal;
create trigger trg_liquidaciones_personal_updated_at before update on public.liquidaciones_personal for each row execute function public.set_updated_at();

drop trigger if exists trg_movimientos_cubetas_updated_at on public.movimientos_cubetas;
create trigger trg_movimientos_cubetas_updated_at before update on public.movimientos_cubetas for each row execute function public.set_updated_at();

alter table public.agricultores enable row level security;
alter table public.productos enable row level security;
alter table public.agricultor_producto_hectareas enable row level security;
alter table public.personal_campo enable row level security;
alter table public.centros_acopio enable row level security;
alter table public.lotes enable row level security;
alter table public.clasificaciones enable row level security;
alter table public.despachos enable row level security;
alter table public.liquidaciones_agri enable row level security;
alter table public.liquidacion_agri_detalle enable row level security;
alter table public.actividades_personal enable row level security;
alter table public.liquidaciones_personal enable row level security;
alter table public.movimientos_cubetas enable row level security;

drop policy if exists agricultores_authenticated_all on public.agricultores;
create policy agricultores_authenticated_all on public.agricultores for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists productos_authenticated_all on public.productos;
create policy productos_authenticated_all on public.productos for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists agricultor_producto_hectareas_authenticated_all on public.agricultor_producto_hectareas;
create policy agricultor_producto_hectareas_authenticated_all on public.agricultor_producto_hectareas for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists personal_campo_authenticated_all on public.personal_campo;
create policy personal_campo_authenticated_all on public.personal_campo for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists centros_acopio_authenticated_all on public.centros_acopio;
create policy centros_acopio_authenticated_all on public.centros_acopio for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists lotes_authenticated_all on public.lotes;
create policy lotes_authenticated_all on public.lotes for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists clasificaciones_authenticated_all on public.clasificaciones;
create policy clasificaciones_authenticated_all on public.clasificaciones for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists despachos_authenticated_all on public.despachos;
create policy despachos_authenticated_all on public.despachos for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists liquidaciones_agri_authenticated_all on public.liquidaciones_agri;
create policy liquidaciones_agri_authenticated_all on public.liquidaciones_agri for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists liquidacion_agri_detalle_authenticated_all on public.liquidacion_agri_detalle;
create policy liquidacion_agri_detalle_authenticated_all on public.liquidacion_agri_detalle for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists actividades_personal_authenticated_all on public.actividades_personal;
create policy actividades_personal_authenticated_all on public.actividades_personal for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists liquidaciones_personal_authenticated_all on public.liquidaciones_personal;
create policy liquidaciones_personal_authenticated_all on public.liquidaciones_personal for all to authenticated using (true) with check (auth.uid() is not null);

drop policy if exists movimientos_cubetas_authenticated_all on public.movimientos_cubetas;
create policy movimientos_cubetas_authenticated_all on public.movimientos_cubetas for all to authenticated using (true) with check (auth.uid() is not null);