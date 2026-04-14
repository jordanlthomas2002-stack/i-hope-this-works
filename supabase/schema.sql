create extension if not exists pgcrypto;

create table if not exists floors (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null,
  width integer not null default 1400,
  height integer not null default 900,
  sort_order integer not null default 1
);

create table if not exists dining_tables (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  floor_id uuid not null references floors(id) on delete cascade,
  name text not null,
  x integer not null default 60,
  y integer not null default 60,
  width integer not null default 88,
  height integer not null default 88,
  seats integer not null default 4,
  shape text not null default 'round' check (shape in ('round','square','booth','bar')),
  server_name text,
  server_color text,
  status text not null default 'available' check (status in ('available','seated','reserved','dirty','closed')),
  section_name text,
  notes text,
  turn_started_at timestamptz,
  current_covers integer not null default 0,
  max_covers integer not null default 4,
  active_check_total numeric(10,2) not null default 0
);

create table if not exists reservations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  floor_id uuid references floors(id) on delete set null,
  table_id uuid references dining_tables(id) on delete set null,
  guest_name text not null,
  party_size integer not null default 2,
  reservation_time timestamptz not null,
  phone text,
  status text not null default 'booked' check (status in ('booked','seated','completed','cancelled','waitlist')),
  notes text
);

create table if not exists activity_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  message text not null,
  kind text not null default 'general'
);

alter table floors enable row level security;
alter table dining_tables enable row level security;
alter table reservations enable row level security;
alter table activity_log enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where tablename='floors' and policyname='public all floors') then
    create policy "public all floors" on floors for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='dining_tables' and policyname='public all tables') then
    create policy "public all tables" on dining_tables for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='reservations' and policyname='public all reservations') then
    create policy "public all reservations" on reservations for all using (true) with check (true);
  end if;
  if not exists (select 1 from pg_policies where tablename='activity_log' and policyname='public all activity') then
    create policy "public all activity" on activity_log for all using (true) with check (true);
  end if;
end $$;

alter publication supabase_realtime add table floors;
alter publication supabase_realtime add table dining_tables;
alter publication supabase_realtime add table reservations;
alter publication supabase_realtime add table activity_log;

insert into floors (name, width, height, sort_order)
select 'Main Dining Room', 1400, 900, 1
where not exists (select 1 from floors);

insert into floors (name, width, height, sort_order)
select 'Patio', 1200, 780, 2
where not exists (select 1 from floors where name = 'Patio');

with main_floor as (
  select id from floors where name = 'Main Dining Room' limit 1
)
insert into dining_tables (floor_id, name, x, y, width, height, seats, shape, status, current_covers, max_covers, server_name, server_color)
select main_floor.id, 'T1', 80, 80, 90, 90, 4, 'round', 'available', 0, 4, 'Jordan', '#38bdf8' from main_floor
where not exists (select 1 from dining_tables where name='T1');

with main_floor as (
  select id from floors where name = 'Main Dining Room' limit 1
)
insert into dining_tables (floor_id, name, x, y, width, height, seats, shape, status, current_covers, max_covers, server_name, server_color)
select main_floor.id, 'T2', 220, 80, 90, 90, 4, 'square', 'reserved', 0, 4, 'Alex', '#f97316' from main_floor
where not exists (select 1 from dining_tables where name='T2');

with patio_floor as (
  select id from floors where name = 'Patio' limit 1
)
insert into dining_tables (floor_id, name, x, y, width, height, seats, shape, status, current_covers, max_covers, server_name, server_color)
select patio_floor.id, 'P1', 100, 100, 120, 70, 6, 'booth', 'seated', 4, 6, 'Casey', '#22c55e' from patio_floor
where not exists (select 1 from dining_tables where name='P1');

insert into activity_log (message, kind)
select 'Initial restaurant workspace created', 'system'
where not exists (select 1 from activity_log);
