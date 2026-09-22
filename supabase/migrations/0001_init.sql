-- =========================================================================
-- Experience.com Profile Platform — initial schema, RLS, and triggers
-- =========================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- Roles
-- ---------------------------------------------------------------------
create type app_role as enum ('member', 'support', 'admin');

create table public.user_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role app_role not null default 'member',
  created_at timestamptz not null default now()
);

-- security-definer helpers so RLS policies can check role without recursive
-- RLS lookups on user_roles itself
create function public.current_role() returns app_role
language sql stable security definer set search_path = public as $$
  select coalesce((select role from public.user_roles where user_id = auth.uid()), 'member'::app_role);
$$;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role() = 'admin';
$$;

create function public.is_admin_or_support() returns boolean
language sql stable security definer set search_path = public as $$
  select public.current_role() in ('admin', 'support');
$$;

alter table public.user_roles enable row level security;

create policy "users read own role" on public.user_roles
  for select using (user_id = auth.uid() or public.is_admin());
create policy "admins manage roles" on public.user_roles
  for all using (public.is_admin()) with check (public.is_admin());

-- assign 'member' role automatically on signup
create function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.user_roles (user_id, role) values (new.id, 'member')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------
create type profile_status as enum ('unclaimed', 'claimed', 'pro');

create table public.profiles (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) on delete set null,
  name text not null,
  profession text not null,
  org text not null default '',
  location text not null default '',
  email text,
  phone text,
  status profile_status not null default 'unclaimed',
  fields jsonb not null default '{}'::jsonb,
  completeness int not null default 0,
  created_at timestamptz not null default now(),
  claimed_at timestamptz,
  last_activity_at timestamptz not null default now(),
  search tsvector generated always as (
    setweight(to_tsvector('english', coalesce(name,'')), 'A') ||
    setweight(to_tsvector('english', coalesce(profession,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(org,'')), 'B') ||
    setweight(to_tsvector('english', coalesce(location,'')), 'C')
  ) stored
);

create index profiles_search_idx on public.profiles using gin(search);
create index profiles_owner_idx on public.profiles(owner_id);
create index profiles_status_idx on public.profiles(status);

alter table public.profiles enable row level security;

-- public directory: anyone (incl. anon) can read profiles — this is a public
-- claim/search directory, mirroring the prototype's public search
create policy "profiles are publicly readable" on public.profiles
  for select using (true);

create policy "owners update own profile" on public.profiles
  for update using (owner_id = auth.uid() or public.is_admin())
  with check (owner_id = auth.uid() or public.is_admin());

create policy "admins insert profiles" on public.profiles
  for insert with check (public.is_admin());

create policy "admins delete profiles" on public.profiles
  for delete using (public.is_admin());

-- claiming: a member can attach themselves as owner to an unclaimed profile
-- only via the claim_profile() RPC below (SECURITY DEFINER), not directly,
-- since a raw UPDATE policy allowing owner_id IS NULL -> auth.uid() would
-- also have to gate on OTP verification, which lives outside SQL.
create function public.claim_profile(p_profile_id uuid) returns public.profiles
language plpgsql security definer set search_path = public as $$
declare
  result public.profiles;
  caller_email text := lower(coalesce(auth.jwt()->>'email', ''));
begin
  -- the caller must be signed in as the profile's own email — this is the
  -- authorization boundary: Supabase Auth already verified that email via
  -- OTP before this RPC runs, so matching it here is what stops any signed
  -- in user from claiming someone else's profile.
  update public.profiles
    set owner_id = auth.uid(), status = 'claimed', claimed_at = now(), last_activity_at = now()
    where id = p_profile_id and owner_id is null and lower(email) = caller_email
    returning * into result;
  if result is null then
    raise exception 'Profile not found, already claimed, or does not match your verified email';
  end if;
  insert into public.audit_log(profile_id, event, detail, actor_id)
    values (p_profile_id, 'profile_claimed', 'Claimed via verified OTP', auth.uid());
  insert into public.conversion_events(type, profile_id) values ('claim_completed', p_profile_id);
  return result;
end;
$$;

-- ---------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------
create table public.audit_log (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete cascade,
  event text not null,
  detail text,
  actor_id uuid references auth.users(id),
  ts timestamptz not null default now()
);
alter table public.audit_log enable row level security;
create policy "read own profile audit" on public.audit_log
  for select using (
    public.is_admin_or_support() or
    exists (select 1 from public.profiles p where p.id = profile_id and p.owner_id = auth.uid())
  );
create policy "system inserts audit" on public.audit_log
  for insert with check (true);

-- Claim verification uses Supabase Auth's built-in email OTP
-- (signInWithOtp) against the profile's email address, rather than a
-- custom code table — Auth already handles delivery, rate limits, and
-- expiry. claim_profile() below runs once that sign-in succeeds.

-- ---------------------------------------------------------------------
-- AI conversations (Coach + Copilot)
-- ---------------------------------------------------------------------
create table public.ai_conversations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null default 'coach' check (kind in ('coach','copilot')),
  messages jsonb not null default '[]'::jsonb,
  status text not null default 'active' check (status in ('active','completed','abandoned')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.ai_conversations enable row level security;
create policy "owner reads own ai conversations" on public.ai_conversations
  for select using (
    public.is_admin_or_support() or
    exists (select 1 from public.profiles p where p.id = profile_id and p.owner_id = auth.uid())
  );
create policy "owner writes own ai conversations" on public.ai_conversations
  for insert with check (
    exists (select 1 from public.profiles p where p.id = profile_id and p.owner_id = auth.uid())
  );
create policy "owner updates own ai conversations" on public.ai_conversations
  for update using (
    exists (select 1 from public.profiles p where p.id = profile_id and p.owner_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- Support conversations (live-agent workflow) + messages
-- ---------------------------------------------------------------------
create table public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references public.profiles(id) on delete set null,
  requester_id uuid references auth.users(id),
  subject text not null,
  status text not null default 'open' check (status in ('open','pending','resolved','closed')),
  channel text not null default 'ai' check (channel in ('ai','human')),
  assigned_to uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.support_conversations enable row level security;
create policy "participants read support conversations" on public.support_conversations
  for select using (
    public.is_admin_or_support() or requester_id = auth.uid()
  );
create policy "members create support conversations" on public.support_conversations
  for insert with check (requester_id = auth.uid());
create policy "staff and requester update support conversations" on public.support_conversations
  for update using (public.is_admin_or_support() or requester_id = auth.uid());

create table public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  sender_type text not null check (sender_type in ('member','agent','ai')),
  sender_id uuid references auth.users(id),
  body text not null,
  created_at timestamptz not null default now()
);
alter table public.support_messages enable row level security;
create policy "participants read support messages" on public.support_messages
  for select using (
    public.is_admin_or_support() or
    exists (select 1 from public.support_conversations c where c.id = conversation_id and c.requester_id = auth.uid())
  );
create policy "participants write support messages" on public.support_messages
  for insert with check (
    public.is_admin_or_support() or
    exists (select 1 from public.support_conversations c where c.id = conversation_id and c.requester_id = auth.uid())
  );

-- ---------------------------------------------------------------------
-- Campaigns (admin-authored email campaigns) + sends
-- ---------------------------------------------------------------------
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  segment text not null,
  subject text not null,
  body text not null,
  html_body text not null default '',
  status text not null default 'draft' check (status in ('draft','scheduled','sending','sent','paused')),
  created_by uuid references auth.users(id),
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.campaigns enable row level security;
create policy "staff manage campaigns" on public.campaigns
  for all using (public.is_admin_or_support()) with check (public.is_admin_or_support());

create table public.campaign_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  profile_id uuid references public.profiles(id) on delete set null,
  status text not null default 'queued' check (status in ('queued','sent','opened','clicked','bounced','failed')),
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.campaign_sends enable row level security;
create policy "staff read campaign sends" on public.campaign_sends
  for select using (public.is_admin_or_support());
create policy "system writes campaign sends" on public.campaign_sends
  for insert with check (public.is_admin_or_support());
create policy "system updates campaign sends" on public.campaign_sends
  for update using (public.is_admin_or_support());

-- ---------------------------------------------------------------------
-- Notifications (per user)
-- ---------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  text text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);
alter table public.notifications enable row level security;
create policy "users read own notifications" on public.notifications
  for select using (user_id = auth.uid() or public.is_admin());
create policy "users update own notifications" on public.notifications
  for update using (user_id = auth.uid());
create policy "system inserts notifications" on public.notifications
  for insert with check (true);

-- ---------------------------------------------------------------------
-- Conversion events (funnel analytics)
-- ---------------------------------------------------------------------
create table public.conversion_events (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  profile_id uuid references public.profiles(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  ts timestamptz not null default now()
);
alter table public.conversion_events enable row level security;
create policy "staff read conversion events" on public.conversion_events
  for select using (public.is_admin_or_support());
create policy "system inserts conversion events" on public.conversion_events
  for insert with check (true);

-- ---------------------------------------------------------------------
-- Subscriptions (Pro plan)
-- ---------------------------------------------------------------------
create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade unique,
  plan text not null default 'pro',
  status text not null default 'active' check (status in ('active','past_due','canceled')),
  current_period_end timestamptz,
  provider text not null default 'stripe',
  provider_customer_id text,
  provider_subscription_id text,
  created_at timestamptz not null default now()
);
alter table public.subscriptions enable row level security;
create policy "owner reads own subscription" on public.subscriptions
  for select using (
    public.is_admin_or_support() or
    exists (select 1 from public.profiles p where p.id = profile_id and p.owner_id = auth.uid())
  );
create policy "staff manage subscriptions" on public.subscriptions
  for all using (public.is_admin_or_support()) with check (public.is_admin_or_support());

-- ---------------------------------------------------------------------
-- Triggers: keep completeness + last_activity_at in sync, updated_at bumps
-- ---------------------------------------------------------------------
create function public.compute_completeness(p_fields jsonb, p_name text, p_profession text, p_org text, p_location text, p_email text, p_phone text)
returns int language plpgsql immutable as $$
declare
  total int := 0;
  earned int := 0;
  weights jsonb := '{"profession":5,"name":5,"email":5,"phone":5,"serviceArea":6,"city":5,"photo":8,"licence":8,"businessHours":5,"yearStarted":6,"worksAt":6,"skills":10,"services":10,"headline":8,"summary":9}'::jsonb;
  k text; w int;
begin
  for k, w in select * from jsonb_each_text(weights) loop
    total := total + w::int;
    earned := earned + case
      when k = 'name' and p_name is not null and length(trim(p_name)) > 0 then w::int
      when k = 'profession' and p_profession is not null and length(trim(p_profession)) > 0 then w::int
      when k = 'worksAt' and p_org is not null and length(trim(p_org)) > 0 then w::int
      when k = 'city' and p_location is not null and length(trim(p_location)) > 0 then w::int
      when k = 'email' and p_email is not null and length(trim(p_email)) > 0 then w::int
      when k = 'phone' and p_phone is not null and length(trim(p_phone)) > 0 then w::int
      when k in ('skills','services','licence') and jsonb_typeof(p_fields->k) = 'array' and jsonb_array_length(p_fields->k) > 0 then w::int
      when k = 'photo' and (p_fields->>'photo')::boolean is true then w::int
      when k not in ('name','profession','worksAt','city','email','phone','skills','services','licence','photo')
        and p_fields ? k and length(trim(coalesce(p_fields->>k,''))) > 0 then w::int
      else 0
    end;
  end loop;
  return round((earned::numeric/total::numeric)*100);
end;
$$;

create function public.profiles_before_write() returns trigger
language plpgsql as $$
begin
  new.completeness := public.compute_completeness(new.fields, new.name, new.profession, new.org, new.location, new.email, new.phone);
  new.last_activity_at := now();
  return new;
end;
$$;

create trigger profiles_before_write_trg
  before insert or update on public.profiles
  for each row execute function public.profiles_before_write();

create function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger ai_conversations_touch before update on public.ai_conversations
  for each row execute function public.touch_updated_at();
create trigger support_conversations_touch before update on public.support_conversations
  for each row execute function public.touch_updated_at();
create trigger campaigns_touch before update on public.campaigns
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------
-- Realtime: publish the tables the UI needs live updates for
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.support_messages;
alter publication supabase_realtime add table public.support_conversations;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.ai_conversations;
