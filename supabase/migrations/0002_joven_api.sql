-- 0002 · vínculo con Placeta Joven (banco). NO aplicada. Ejecutar después de 0001.
begin;
alter table public.profiles add column dip text unique, add column joven_iban text unique, add column birth_date date;

-- el cliente no puede tocar dip ni joven_iban (los fija el servidor)
create or replace function public.profiles_guard() returns trigger language plpgsql as $$
begin
  if current_user in ('authenticated','anon') then
    if new.id <> old.id or new.is_admin <> old.is_admin or new.placetaid_sub is distinct from old.placetaid_sub
       or new.played_ms <> old.played_ms or new.created_at <> old.created_at
       or new.dip is distinct from old.dip or new.joven_iban is distinct from old.joven_iban
       or new.birth_date is distinct from old.birth_date then
      raise exception 'FORBIDDEN_FIELD' using errcode = '42501';
    end if;
  end if;
  if new.marketing_opt_in and not old.marketing_opt_in then new.marketing_opt_in_at := now();
  elsif not new.marketing_opt_in then new.marketing_opt_in_at := null; end if;
  new.updated_at := now();
  return new;
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles(id, placetaid_sub, full_name, dip, birth_date)
  values (new.id, new.raw_user_meta_data->>'placetaid_sub', left(coalesce(new.raw_user_meta_data->>'full_name',''), 120),
          nullif(new.raw_user_meta_data->>'dip',''), nullif(new.raw_user_meta_data->>'birth_date','')::date)
  on conflict (id) do nothing;
  return new;
end $$;
commit;
