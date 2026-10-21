-- Waiting list for "Drumul spre Unire" (unire.cramba.ro).
-- The public page can only join the list and read the count, through the two functions below;
-- the table itself has RLS on and no policy, so the e-mails cannot be read with the anon key.
--
-- Rollback (export the list first: select * from public.dsu_waitlist):
--   drop function public.dsu_waitlist_join(text, boolean, boolean, jsonb);
--   drop function public.dsu_waitlist_count();
--   drop table public.dsu_waitlist;

create table public.dsu_waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null check (length(email) <= 254 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  consent boolean not null check (consent),
  wants_beta boolean not null default false,
  source text not null default 'landing' check (source in ('landing', 'beta')),
  utm jsonb not null default '{}' check (jsonb_typeof(utm) = 'object' and length(utm::text) <= 500),
  created_at timestamptz not null default now()
);
create unique index dsu_waitlist_email_uq on public.dsu_waitlist (lower(email));
alter table public.dsu_waitlist enable row level security;
comment on table public.dsu_waitlist is 'Drumul spre Unire waiting list. No RLS policy on purpose: access only through dsu_waitlist_join / dsu_waitlist_count (security definer). Consent is mandatory; keep until 12 months after launch.';

-- joins the list and returns the number of people waiting; a repeat e-mail is not an error and gets the same answer,
-- so the form cannot be used to find out who is on the list. A later "beta" click upgrades wants_beta.
create function public.dsu_waitlist_join(p_email text, p_consent boolean, p_beta boolean default false, p_utm jsonb default '{}'::jsonb)
returns integer language plpgsql security definer set search_path = public as $$
declare v_email text := lower(trim(coalesce(p_email, '')));
begin
  if not coalesce(p_consent, false) then raise exception 'consent_required' using errcode = '22023'; end if;
  if length(v_email) > 254 or v_email !~* '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'invalid_email' using errcode = '22023'; end if;
  insert into public.dsu_waitlist (email, consent, wants_beta, source, utm)
  values (v_email, true, coalesce(p_beta, false), case when p_beta then 'beta' else 'landing' end,
          case when jsonb_typeof(p_utm) = 'object' and length(p_utm::text) <= 500 then p_utm else '{}'::jsonb end)
  on conflict ((lower(email))) do update set wants_beta = public.dsu_waitlist.wants_beta or excluded.wants_beta;
  return (select count(*)::int from public.dsu_waitlist);
end $$;

create function public.dsu_waitlist_count() returns integer language sql security definer set search_path = public stable as $$
  select count(*)::int from public.dsu_waitlist
$$;

revoke all on function public.dsu_waitlist_join(text, boolean, boolean, jsonb) from public;
revoke all on function public.dsu_waitlist_count() from public;
grant execute on function public.dsu_waitlist_join(text, boolean, boolean, jsonb) to anon, authenticated;
grant execute on function public.dsu_waitlist_count() to anon, authenticated;
