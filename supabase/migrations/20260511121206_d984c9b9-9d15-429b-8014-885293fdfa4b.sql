
-- Enums
create type public.app_role as enum ('admin');
create type public.task_status as enum ('todo','in_progress','done');
create type public.task_priority as enum ('low','normal','high');
create type public.customer_status as enum ('lead','active','completed','follow_up');

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  avatar_url text,
  created_at timestamptz not null default now()
);

-- User roles
create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  unique (user_id, role)
);

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;

-- Customers
create table public.customers (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  company text,
  email text,
  phone text,
  status customer_status not null default 'lead',
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Customer notes (timeline)
create table public.customer_notes (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers(id) on delete cascade,
  content text not null,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  status task_status not null default 'todo',
  priority task_priority not null default 'normal',
  deadline timestamptz,
  customer_id uuid references public.customers(id) on delete set null,
  assignee_id uuid references auth.users(id),
  tags text[] not null default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Appointments
create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  start_at timestamptz not null,
  end_at timestamptz not null,
  color text not null default '#3b82f6',
  customer_id uuid references public.customers(id) on delete set null,
  participants uuid[] not null default '{}',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Files
create table public.files (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  storage_path text not null,
  size bigint,
  mime_type text,
  customer_id uuid references public.customers(id) on delete set null,
  task_id uuid references public.tasks(id) on delete set null,
  appointment_id uuid references public.appointments(id) on delete set null,
  uploaded_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);

-- Notifications
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

-- updated_at trigger
create or replace function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

create trigger trg_customers_updated before update on public.customers for each row execute function public.set_updated_at();
create trigger trg_tasks_updated before update on public.tasks for each row execute function public.set_updated_at();
create trigger trg_appointments_updated before update on public.appointments for each row execute function public.set_updated_at();

-- Auto-create profile + admin role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  insert into public.user_roles (user_id, role) values (new.id, 'admin');
  return new;
end; $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- RLS
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.customers enable row level security;
alter table public.customer_notes enable row level security;
alter table public.tasks enable row level security;
alter table public.appointments enable row level security;
alter table public.files enable row level security;
alter table public.notifications enable row level security;

-- All authenticated users (admins) can do everything on shared data
create policy "auth read profiles" on public.profiles for select to authenticated using (true);
create policy "user update own profile" on public.profiles for update to authenticated using (auth.uid()=id);

create policy "auth read roles" on public.user_roles for select to authenticated using (true);

create policy "auth all customers" on public.customers for all to authenticated using (true) with check (true);
create policy "auth all customer_notes" on public.customer_notes for all to authenticated using (true) with check (true);
create policy "auth all tasks" on public.tasks for all to authenticated using (true) with check (true);
create policy "auth all appointments" on public.appointments for all to authenticated using (true) with check (true);
create policy "auth all files" on public.files for all to authenticated using (true) with check (true);

create policy "user own notifications select" on public.notifications for select to authenticated using (user_id=auth.uid());
create policy "user own notifications update" on public.notifications for update to authenticated using (user_id=auth.uid());
create policy "auth insert notifications" on public.notifications for insert to authenticated with check (true);
create policy "user own notifications delete" on public.notifications for delete to authenticated using (user_id=auth.uid());

-- Realtime
alter table public.tasks replica identity full;
alter table public.customers replica identity full;
alter table public.appointments replica identity full;
alter table public.notifications replica identity full;
alter publication supabase_realtime add table public.tasks, public.customers, public.appointments, public.notifications, public.customer_notes, public.files;

-- Storage bucket
insert into storage.buckets (id, name, public) values ('files','files', false);

create policy "auth read files bucket" on storage.objects for select to authenticated using (bucket_id='files');
create policy "auth upload files bucket" on storage.objects for insert to authenticated with check (bucket_id='files');
create policy "auth update files bucket" on storage.objects for update to authenticated using (bucket_id='files');
create policy "auth delete files bucket" on storage.objects for delete to authenticated using (bucket_id='files');

-- Indexes
create index on public.tasks (status);
create index on public.tasks (deadline);
create index on public.tasks (customer_id);
create index on public.appointments (start_at);
create index on public.appointments (customer_id);
create index on public.files (customer_id);
create index on public.files (task_id);
create index on public.notifications (user_id, read);
