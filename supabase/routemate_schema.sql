-- RouteMate Day 18 schema for the shared 100-day Supabase sandbox.
-- Run this in the Supabase SQL editor for project byvkbrctizkhaoitxlkx.

create extension if not exists "pgcrypto";

create table if not exists public.routemate_user_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  google_maps_api_key_encrypted text,
  google_maps_key_last4 text,
  google_maps_connected boolean not null default false,
  google_maps_validated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.routemate_routes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  route_date date not null default current_date,
  travel_mode text not null default 'driving' check (travel_mode in ('driving', 'walking')),
  departure_time timestamptz,
  stop_duration_minutes integer not null default 20,
  start_address text not null,
  start_place_id text,
  end_address text,
  end_place_id text,
  original_distance_meters integer,
  original_duration_seconds integer,
  original_polyline text,
  optimized_distance_meters integer,
  optimized_duration_seconds integer,
  original_workday_duration_seconds integer,
  optimized_workday_duration_seconds integer,
  estimated_fuel_savings_cents integer,
  optimized_polyline text,
  google_maps_url text,
  status text not null default 'draft' check (status in ('draft', 'optimized')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.routemate_route_stops (
  id uuid primary key default gen_random_uuid(),
  route_id uuid not null references public.routemate_routes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  address text not null,
  place_id text,
  notes text,
  service_window_start time,
  service_window_end time,
  original_order integer not null,
  optimized_order integer,
  manual_order integer,
  status text not null default 'pending' check (status in ('pending', 'completed', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists routemate_routes_user_date_idx
  on public.routemate_routes(user_id, route_date desc);

create index if not exists routemate_route_stops_route_order_idx
  on public.routemate_route_stops(route_id, manual_order);

alter table public.routemate_routes
  add column if not exists departure_time timestamptz,
  add column if not exists stop_duration_minutes integer not null default 20,
  add column if not exists original_workday_duration_seconds integer,
  add column if not exists optimized_workday_duration_seconds integer,
  add column if not exists original_polyline text,
  add column if not exists optimized_polyline text;

alter table public.routemate_user_settings enable row level security;
alter table public.routemate_routes enable row level security;
alter table public.routemate_route_stops enable row level security;

drop policy if exists "RouteMate settings are user owned" on public.routemate_user_settings;
create policy "RouteMate settings are user owned"
  on public.routemate_user_settings
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "RouteMate routes are user owned" on public.routemate_routes;
create policy "RouteMate routes are user owned"
  on public.routemate_routes
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "RouteMate stops are user owned" on public.routemate_route_stops;
create policy "RouteMate stops are user owned"
  on public.routemate_route_stops
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
