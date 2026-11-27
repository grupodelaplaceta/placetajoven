-- 0004 · Elegibilidad Placeta Joven: 16 años cumplidos y hasta el 31 de diciembre del año en que se cumplen 31.
-- Sin fecha de nacimiento verificada tampoco es elegible. NO aplicada. Ejecutar tras 0003.
begin;

create function public.is_joven_eligible(p_uid uuid default auth.uid()) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select birth_date is not null
                      and (birth_date + interval '16 years')::date <= current_date
                      and current_date <= make_date(extract(year from birth_date)::int + 31, 12, 31)
                   from public.profiles where id = p_uid), false)
$$;
grant execute on function public.is_joven_eligible(uuid) to authenticated;

-- require_plan() lo usan canjear, cobrar recompensas y jugar: ahora exige elegibilidad ADEMÁS de plan.
create or replace function public.require_plan() returns void
language plpgsql stable security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if not public.is_joven_eligible(auth.uid()) then raise exception 'NOT_ELIGIBLE' using errcode = 'P0001'; end if;
  if not public.has_active_plan(auth.uid()) then raise exception 'PLAN_REQUIRED' using errcode = 'P0001'; end if;
end $$;

-- tampoco se puede activar un plan sin ser elegible
create or replace function public.demo_activate_plan(p_plan text) returns timestamptz
language plpgsql security definer set search_path = public as $$
declare v_exp timestamptz;
begin
  if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode = '28000'; end if;
  if not public.is_joven_eligible(auth.uid()) then raise exception 'NOT_ELIGIBLE' using errcode = 'P0001'; end if;
  if public.setting('demo_mode') <> 'true' then raise exception 'DEMO_DISABLED' using errcode = 'P0001'; end if;
  if p_plan not in ('mensual','anual') then raise exception 'BAD_PLAN' using errcode = 'P0001'; end if;
  v_exp := case when p_plan = 'mensual' then now() + interval '1 month' else now() + interval '1 year' end;
  insert into public.user_plans(user_id, plan, expires_at, source) values (auth.uid(), p_plan, v_exp, 'demo');
  return v_exp;
end $$;
commit;
