-- Entremis — la base Supabase de la webapp (20 novembre 2026).
-- À coller dans Supabase > SQL Editor > New query, puis « Run ». On peut le relancer sans danger.
--
-- Comment c'est rangé :
--   members       qui est qui : Marc, Richard, Gianni (équipe) ; plus tard, chaque installateur client (son espace à lui seul).
--   docs          toutes les données partagées, une ligne par document, rangées par « collection »
--                 (leads, tasks, documents, calls, chat, results, avis…), comme dans la maquette.
--   private_docs  ce qui n'appartient qu'à une personne (ses connexions IA, MCP, bots, ses automatisations) :
--                 personne d'autre ne peut le lire, pas même les deux autres associés.
-- Sécurité : chaque table est verrouillée ligne par ligne (Row Level Security). La clé « publishable » de l'app
-- ne donne accès qu'à ce que ces règles autorisent. La clé secrète ne va jamais dans l'app.

-- 1. Les comptes ---------------------------------------------------------------
create table if not exists public.members (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  who        text,                                   -- marc, richard, gianni (pour l'équipe)
  role       text not null default 'team' check (role in ('team', 'client')),
  client_id  text,                                   -- pour un compte client : solaria, thermo…
  created_at timestamptz not null default now()
);
alter table public.members enable row level security;

-- Deux questions que posent les règles : « suis-je de l'équipe ? » et « de quel client suis-je ? »
create or replace function public.is_team() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m where m.user_id = auth.uid() and m.role = 'team');
$$;
create or replace function public.my_client() returns text
  language sql stable security definer set search_path = public as $$
  select m.client_id from public.members m where m.user_id = auth.uid() and m.role = 'client';
$$;

drop policy if exists "membres : soi-même ou l'équipe" on public.members;
create policy "membres : soi-même ou l'équipe" on public.members
  for select to authenticated using (user_id = auth.uid() or public.is_team());
-- Pas de règle d'écriture : les comptes s'ajoutent depuis le tableau de bord (voir la fin de ce fichier).

-- 2. Les données partagées -------------------------------------------------------
create table if not exists public.docs (
  collection text not null,
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  client_id  text,                                   -- la ligne concerne ce client (ses résultats, son avis…)
  updated_at timestamptz not null default now(),
  updated_by uuid default auth.uid(),
  primary key (collection, id)
);
alter table public.docs enable row level security;
create index if not exists docs_client_idx on public.docs (client_id);

-- L'équipe lit et écrit tout. Un client lit seulement ce qui le concerne,
-- et n'écrit que ses résultats de visite, son avis, ses disponibilités, ses parrainages et sa préparation de visite.
-- Ce qui « le concerne » porte son identifiant (client_id) : un lead qu'on lui a donné, le résultat d'une de ses visites…
drop policy if exists "docs : l'équipe lit et écrit tout" on public.docs;
create policy "docs : l'équipe lit et écrit tout" on public.docs
  for all to authenticated using (public.is_team()) with check (public.is_team());

drop policy if exists "docs : un client lit ce qui le concerne" on public.docs;
create policy "docs : un client lit ce qui le concerne" on public.docs
  for select to authenticated using (client_id is not null and client_id = public.my_client());

drop policy if exists "docs : un client ajoute les siens" on public.docs;
create policy "docs : un client ajoute les siens" on public.docs
  for insert to authenticated
  with check (client_id = public.my_client() and (
    collection in ('results', 'avis', 'dispos', 'referrals', 'prep', 'validations')
    -- une contestation de lead : le client l'envoie « ouverte », seule l'équipe la tranche (pas de modification côté client)
    or (collection = 'contests' and data->>'state' = 'ouvert')));

drop policy if exists "docs : un client modifie les siens" on public.docs;
create policy "docs : un client modifie les siens" on public.docs
  for update to authenticated
  using (client_id = public.my_client() and collection in ('results', 'avis', 'dispos', 'referrals', 'prep', 'validations'))
  with check (client_id = public.my_client() and collection in ('results', 'avis', 'dispos', 'referrals', 'prep', 'validations'));

-- Les scripts de visite et les métiers (parcours) : lus par tous les comptes, équipe et clients ; écrits par l'équipe seulement.
create or replace function public.is_member() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.members m where m.user_id = auth.uid());
$$;
drop policy if exists "docs : tout compte lit les scripts et les métiers" on public.docs;
create policy "docs : tout compte lit les scripts et les métiers" on public.docs
  for select to authenticated using (collection in ('scripts', 'sectors') and public.is_member());

-- 3. Les données de chacun, invisibles pour les autres ----------------------------
create table if not exists public.private_docs (
  user_id    uuid not null default auth.uid() references auth.users(id) on delete cascade,
  collection text not null,
  id         text not null,
  data       jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, collection, id)
);
alter table public.private_docs enable row level security;
drop policy if exists "privé : seulement soi" on public.private_docs;
create policy "privé : seulement soi" on public.private_docs
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 4. Date de modification tenue à jour toute seule -----------------------------------
create or replace function public.touch() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists docs_touch on public.docs;
create trigger docs_touch before update on public.docs for each row execute function public.touch();
drop trigger if exists private_touch on public.private_docs;
create trigger private_touch before update on public.private_docs for each row execute function public.touch();

-- 5. Temps réel : chacun voit les changements des autres sans recharger la page -----
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'docs') then
    alter publication supabase_realtime add table public.docs;
  end if;
end $$;

-- 6. Les fichiers (devis déposés, photos de profil) : un espace privé, réservé à l'équipe --
insert into storage.buckets (id, name, public) values ('files', 'files', false) on conflict (id) do nothing;
drop policy if exists "fichiers : l'équipe lit" on storage.objects;
create policy "fichiers : l'équipe lit" on storage.objects
  for select to authenticated using (bucket_id = 'files' and public.is_team());
drop policy if exists "fichiers : l'équipe dépose" on storage.objects;
create policy "fichiers : l'équipe dépose" on storage.objects
  for insert to authenticated with check (bucket_id = 'files' and public.is_team());
drop policy if exists "fichiers : l'équipe supprime" on storage.objects;
create policy "fichiers : l'équipe supprime" on storage.objects
  for delete to authenticated using (bucket_id = 'files' and public.is_team());

-- 6 bis. Les accès des clients ----------------------------------------------------------
-- L'équipe les crée depuis l'app (Clients > Accès clients). Ces fonctions tournent dans la base, avec ses droits :
-- la clé secrète ne quitte jamais Supabase. Elles refusent tout compte qui n'est pas de l'équipe.
-- Un client se connecte avec son identifiant (ex. thermo) : l'app en fait thermo@entremisagency.github.io.
-- Le mot de passe provisoire ne sert qu'une fois : à la première connexion, l'app lui en fait choisir un.
create or replace function public.creer_acces_client(p_login text, p_password text, p_client text)
  returns text language plpgsql security definer set search_path = public, extensions, auth as $$
declare
  v_login  text := lower(trim(coalesce(p_login, '')));
  v_client text := lower(trim(coalesce(p_client, '')));
  v_email  text;
  v_id     uuid := gen_random_uuid();
begin
  if not public.is_team() then raise exception 'Réservé à l''équipe Entremis.'; end if;
  if v_login !~ '^[a-z0-9][a-z0-9._-]{1,39}$' then raise exception 'Identifiant : lettres et chiffres, sans espace ni accent.'; end if;
  if v_client !~ '^[a-z0-9][a-z0-9._-]{1,39}$' then raise exception 'Client inconnu.'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'Mot de passe provisoire : 6 caractères au moins.'; end if;
  v_email := v_login || '@entremisagency.github.io';
  if exists (select 1 from auth.users where lower(email) = v_email) then raise exception 'Cet identifiant est déjà pris.'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          crypt(p_password, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text, jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());
  insert into public.members (user_id, who, role, client_id) values (v_id, v_login, 'client', v_client);
  return v_login;
end $$;

-- Remettre un mot de passe provisoire à un client (il en choisira un nouveau à la connexion)
create or replace function public.nouveau_mot_de_passe_client(p_login text, p_password text)
  returns void language plpgsql security definer set search_path = public, extensions, auth as $$
declare v_email text := lower(trim(coalesce(p_login, ''))) || '@entremisagency.github.io';
begin
  if not public.is_team() then raise exception 'Réservé à l''équipe Entremis.'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'Mot de passe provisoire : 6 caractères au moins.'; end if;
  update auth.users set encrypted_password = crypt(p_password, gen_salt('bf')),
         raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'pw_set', updated_at = now()
   where lower(email) = v_email and id in (select user_id from public.members where role = 'client');
  if not found then raise exception 'Accès introuvable.'; end if;
end $$;

-- Retirer l'accès d'un client (son compte disparaît ; ses données restent dans la base)
create or replace function public.retirer_acces_client(p_login text)
  returns void language plpgsql security definer set search_path = public, auth as $$
declare v_email text := lower(trim(coalesce(p_login, ''))) || '@entremisagency.github.io';
begin
  if not public.is_team() then raise exception 'Réservé à l''équipe Entremis.'; end if;
  delete from auth.users where lower(email) = v_email and id in (select user_id from public.members where role = 'client');
  if not found then raise exception 'Accès introuvable.'; end if;
end $$;

revoke all on function public.creer_acces_client(text, text, text) from public, anon;
revoke all on function public.nouveau_mot_de_passe_client(text, text) from public, anon;
revoke all on function public.retirer_acces_client(text) from public, anon;
grant execute on function public.creer_acces_client(text, text, text) to authenticated;
grant execute on function public.nouveau_mot_de_passe_client(text, text) to authenticated;
grant execute on function public.retirer_acces_client(text) to authenticated;

-- 6 ter. Un compte pour chacun dans l'équipe (Marc, Richard, Gianni), créé depuis l'app (page Accès) ---------
create or replace function public.creer_compte_equipe(p_login text, p_password text, p_who text)
  returns text language plpgsql security definer set search_path = public, extensions, auth as $$
declare
  v_login text := lower(trim(coalesce(p_login, '')));
  v_who   text := lower(trim(coalesce(p_who, '')));
  v_email text;
  v_id    uuid := gen_random_uuid();
begin
  if not public.is_team() then raise exception 'Réservé à l''équipe Entremis.'; end if;
  if v_who not in ('marc', 'richard', 'gianni') then raise exception 'Membre de l''équipe inconnu.'; end if;
  if v_login !~ '^[a-z0-9][a-z0-9._-]{1,39}$' then raise exception 'Identifiant : lettres et chiffres, sans espace ni accent.'; end if;
  if length(coalesce(p_password, '')) < 6 then raise exception 'Mot de passe provisoire : 6 caractères au moins.'; end if;
  v_email := v_login || '@entremisagency.github.io';
  if exists (select 1 from auth.users where lower(email) = v_email) then raise exception 'Cet identifiant est déjà pris.'; end if;
  insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, recovery_token, email_change_token_new, email_change)
  values ('00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
          crypt(p_password, gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '');
  insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  values (gen_random_uuid(), v_id, v_id::text, jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true), 'email', now(), now(), now());
  insert into public.members (user_id, who, role) values (v_id, v_who, 'team');
  return v_login;
end $$;
revoke all on function public.creer_compte_equipe(text, text, text) from public, anon;
grant execute on function public.creer_compte_equipe(text, text, text) to authenticated;

-- 6 quater. Les demandes qui arrivent toutes seules -----------------------------------------
-- nouveau_lead : la page de demande publique (demande.html), ou Make / Zapier branchés sur vos publicités.
-- demande_site : le formulaire « Réserver un appel » du site vitrine (un installateur qui veut travailler avec Entremis).
-- Ouvertes à tous (sans compte), mais bornées : accord obligatoire, téléphone vérifié, pas de doublon sur 30 jours,
-- 300 demandes par jour au plus. Elles n'écrivent que dans les demandes ; elles ne lisent rien.
create table if not exists public.entrees (jour date primary key, n int not null default 0);
alter table public.entrees enable row level security;   -- aucune règle : personne ne la lit depuis l'app

-- France et pays francophones (21/11/2026) : p_pays (FR, BE, CH, LU, MC, CA, XX). Numéros de 8 chiffres au moins (Luxembourg).
-- Doublon : même numéro sur 90 jours (règle de facturation de Gianni) = pas de nouveau lead.
-- p_client (23/11/2026) : le client des formulaires Meta d'où vient le lead (Make ou Zapier). Simple proposition : l'équipe donne le lead.
drop function if exists public.nouveau_lead(text, text, text, text, text, text, text, text, boolean);
drop function if exists public.nouveau_lead(text, text, text, text, text, text, text, text, boolean, text);
-- p_pub (23/11/2026, soir) : le nom de la pub d'où vient le lead (lien de la pub : ?pub={{ad.name}}). Le Studio en tire le coût par accroche.
drop function if exists public.nouveau_lead(text, text, text, text, text, text, text, text, boolean, text, text);
create or replace function public.nouveau_lead(p_nom text, p_telephone text, p_ville text default '', p_projet text default '',
  p_source text default 'Site', p_email text default '', p_message text default '', p_code_postal text default '', p_consentement boolean default false,
  p_pays text default 'FR', p_client text default '', p_pub text default '')
  returns text language plpgsql security definer set search_path = public as $$
declare
  v_tel text := regexp_replace(coalesce(p_telephone, ''), '[^0-9+]', '', 'g');
  v_id  text := 'w' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS') || substr(md5(random()::text), 1, 4);
  v_pays text := upper(left(coalesce(nullif(trim(p_pays), ''), 'FR'), 2));
  v_cp  text := upper(trim(coalesce(p_code_postal, '')));
  v_n   int;
begin
  if not coalesce(p_consentement, false) then raise exception 'Il faut accepter d''être rappelé.'; end if;
  if length(trim(coalesce(p_nom, ''))) < 2 then raise exception 'Écrivez votre nom.'; end if;
  if length(regexp_replace(v_tel, '[^0-9]', '', 'g')) < 8 then raise exception 'Le numéro de téléphone est incomplet.'; end if;
  if exists (select 1 from public.docs where collection = 'leads' and data->>'phone_n' = v_tel and updated_at > now() - interval '90 days') then return 'deja'; end if;
  insert into public.entrees (jour, n) values (current_date, 1) on conflict (jour) do update set n = public.entrees.n + 1 returning n into v_n;
  if v_n > 300 then raise exception 'Trop de demandes aujourd''hui. Réessayez demain.'; end if;
  insert into public.docs (collection, id, data, client_id) values ('leads', v_id, jsonb_build_object(
    'name', left(trim(p_nom), 80), 'phone', left(trim(p_telephone), 20), 'phone_n', v_tel, 'email', left(trim(coalesce(p_email, '')), 120),
    'city', left(trim(coalesce(p_ville, '')), 60), 'zip', left(v_cp, 10), 'country', v_pays,
    'zone', case when v_pays in ('FR', 'MC') then left(v_cp, 2) when v_pays = 'CA' then 'CA-' || left(v_cp, 3) else v_pays || '-' || left(regexp_replace(v_cp, '[^0-9]', '', 'g'), 2) end,
    'trade', left(trim(coalesce(p_projet, '')), 60), 'source', left(coalesce(nullif(trim(p_source), ''), 'Site'), 30), 'note', left(trim(coalesce(p_message, '')), 500),
    'status', 'nouveau', 'consent', true, 'forClient', left(trim(coalesce(p_client, '')), 40), 'ad', left(trim(coalesce(p_pub, '')), 80),
    'at', to_char(now() at time zone 'Europe/Paris', 'YYYY-MM-DD"T"HH24:MI')), null);
  return v_id;
end $$;

create or replace function public.demande_site(p_entreprise text, p_contact text, p_telephone text, p_metier text default '',
  p_zone text default '', p_volume text default '', p_quand text default '', p_email text default '', p_message text default '')
  returns text language plpgsql security definer set search_path = public as $$
declare
  v_tel text := regexp_replace(coalesce(p_telephone, ''), '[^0-9+]', '', 'g');
  v_id  text := 'site' || to_char(clock_timestamp(), 'YYMMDDHH24MISSMS') || substr(md5(random()::text), 1, 4);
  v_n   int;
begin
  if length(trim(coalesce(p_entreprise, ''))) < 2 then raise exception 'Écrivez le nom de l''entreprise.'; end if;
  if length(v_tel) < 10 then raise exception 'Le numéro de téléphone est incomplet.'; end if;
  insert into public.entrees (jour, n) values (current_date, 1) on conflict (jour) do update set n = public.entrees.n + 1 returning n into v_n;
  if v_n > 300 then raise exception 'Trop de demandes aujourd''hui. Réessayez demain.'; end if;
  insert into public.docs (collection, id, data, client_id) values ('site-requests', v_id, jsonb_build_object(
    'name', left(trim(p_entreprise), 80), 'who', left(trim(coalesce(p_contact, '')), 80), 'phone', left(trim(p_telephone), 20), 'email', left(trim(coalesce(p_email, '')), 120),
    'trade', left(trim(coalesce(p_metier, '')), 60), 'zone', left(trim(coalesce(p_zone, '')), 60), 'volume', left(trim(coalesce(p_volume, '')), 60),
    'when', left(trim(coalesce(p_quand, '')), 60), 'message', left(trim(coalesce(p_message, '')), 500), 'source', 'site',
    'at', to_char(now() at time zone 'Europe/Paris', 'YYYY-MM-DD"T"HH24:MI')), null);
  return v_id;
end $$;
revoke all on function public.nouveau_lead(text, text, text, text, text, text, text, text, boolean, text, text, text) from public;
revoke all on function public.demande_site(text, text, text, text, text, text, text, text, text) from public;
grant execute on function public.nouveau_lead(text, text, text, text, text, text, text, text, boolean, text, text, text) to anon, authenticated, service_role;
grant execute on function public.demande_site(text, text, text, text, text, text, text, text, text) to anon, authenticated;

-- 7. Les comptes de l'équipe ------------------------------------------------------------
-- On se connecte avec son prénom (marc, richard, gianni) : l'app en fait l'adresse prenom@entremisagency.github.io,
-- qui ne reçoit aucun e-mail. D'abord : Authentication > Users > Add user > « Create new user » avec ces trois adresses,
-- un mot de passe provisoire (6 caractères au moins) et « Auto Confirm User » coché. Ensuite seulement, lancer ces trois lignes :
-- insert into public.members (user_id, who, role) select id, 'marc',    'team' from auth.users where email = 'marc@entremisagency.github.io'    on conflict (user_id) do nothing;
-- insert into public.members (user_id, who, role) select id, 'richard', 'team' from auth.users where email = 'richard@entremisagency.github.io' on conflict (user_id) do nothing;
-- insert into public.members (user_id, who, role) select id, 'gianni',  'team' from auth.users where email = 'gianni@entremisagency.github.io'  on conflict (user_id) do nothing;
-- À la première connexion, l'app demande à chacun de choisir son propre mot de passe (le provisoire ne sert qu'une fois).
--
-- Mot de passe oublié (pas encore essayé) : remettre un mot de passe provisoire, que la personne remplacera à la connexion.
-- Remplacer PROVISOIRE et l'adresse, puis lancer :
-- update auth.users set encrypted_password = extensions.crypt('PROVISOIRE', extensions.gen_salt('bf')), raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) - 'pw_set' where email = 'richard@entremisagency.github.io';
--
-- Plus tard, un compte client (il ne verra que l'espace de son entreprise, et la base ne lui enverra que ses propres données) :
-- insert into public.members (user_id, who, role, client_id) select id, null, 'client', 'IDENTIFIANT_DU_CLIENT' from auth.users where email = 'identifiant@entremisagency.github.io' on conflict (user_id) do nothing;

-- ===== 9. Notifications sur téléphone (fonction « push », voir supabase/functions/push) =====
-- 1. Les téléphones abonnés (chacun ne voit et ne gère que les siens)
create table if not exists public.push_subs (
  endpoint text primary key,
  user_id uuid not null references auth.users(id) on delete cascade default auth.uid(),
  sub jsonb not null,
  created_at timestamptz not null default now()
);
alter table public.push_subs enable row level security;
drop policy if exists "push : les siens" on public.push_subs;
create policy "push : les siens" on public.push_subs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- 2. Les clés d'envoi et le code secret du déclencheur : aucune règle = personne ne les lit, sauf le service « push »
create table if not exists public.push_config (
  id int primary key default 1 check (id = 1),
  public_key text, private_key text,
  hook_secret text not null default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', '')
);
alter table public.push_config enable row level security;
insert into public.push_config (id) values (1) on conflict (id) do nothing;

-- 3. À chaque événement utile, la base prévient le service « push » (qui choisit qui alerter)
create extension if not exists pg_net;
create or replace function public.push_hook() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_secret text; o jsonb := case when tg_op = 'UPDATE' then old.data else '{}'::jsonb end;
begin
  if new.collection not in ('leads', 'site-requests', 'contests', 'rdv', 'results', 'chat', 'tasks') then return new; end if;
  if tg_op = 'UPDATE' and not (
       (new.collection = 'leads' and coalesce(new.data->>'to', '') <> coalesce(o->>'to', '') and coalesce(new.data->>'to', '') <> '')
    or (new.collection = 'contests' and coalesce(new.data->>'state', '') <> coalesce(o->>'state', ''))) then return new; end if;
  select hook_secret into v_secret from public.push_config where id = 1;
  perform net.http_post(
    url := 'https://cnhxrhyugghigkozfpde.supabase.co/functions/v1/push',
    body := jsonb_build_object('op', tg_op, 'collection', new.collection, 'id', new.id, 'client_id', new.client_id,
                               'data', new.data, 'old', o, 'actor', auth.uid()),
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-entremis-hook', v_secret));
  return new;
exception when others then return new;   -- une alerte ratée ne bloque jamais l'enregistrement
end $$;
drop trigger if exists docs_push on public.docs;
create trigger docs_push after insert or update on public.docs for each row execute function public.push_hook();

-- ===== 10. Brancher son propre Claude (fonction « mcp », voir supabase/functions/mcp) =====
create table if not exists public.mcp_keys (
  hash text primary key,
  user_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  label text,
  created_at timestamptz not null default now(),
  last_used timestamptz
);
alter table public.mcp_keys enable row level security;
drop policy if exists "mcp : voir les siennes" on public.mcp_keys;
create policy "mcp : voir les siennes" on public.mcp_keys for select to authenticated using (user_id = auth.uid());
drop policy if exists "mcp : créer (équipe)" on public.mcp_keys;
create policy "mcp : créer (équipe)" on public.mcp_keys for insert to authenticated with check (user_id = auth.uid() and public.is_team());
drop policy if exists "mcp : retirer les siennes" on public.mcp_keys;
create policy "mcp : retirer les siennes" on public.mcp_keys for delete to authenticated using (user_id = auth.uid());

-- ===== 11. Vérification du numéro par code SMS (fonction « sms », voir supabase/functions/sms) =====
-- Les demandes en attente de leur code (10 minutes). Aucune règle : seule la fonction « sms » y touche.
create table if not exists public.sms_codes (
  id uuid primary key,
  phone text not null,
  code_hash text not null,
  payload jsonb not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  sends int not null default 1,
  created_at timestamptz not null default now()
);
alter table public.sms_codes enable row level security;
create index if not exists sms_codes_phone on public.sms_codes (phone, created_at);

-- ===== 12. Signature en ligne des documents (sign.js) =====
-- Le client signe un document qui lui est destiné et pas encore signé ; la base note son nom, sa signature et l'heure du serveur.
create or replace function public.signer_document(p_id text, p_nom text, p_signature text)
  returns text language plpgsql security definer set search_path = public as $$
declare r public.docs%rowtype;
begin
  select * into r from public.docs where collection = 'signatures' and id = p_id;
  if not found then raise exception 'Document introuvable.'; end if;
  if r.client_id is null or r.client_id is distinct from public.my_client() then raise exception 'Ce document ne vous est pas destiné.'; end if;
  if coalesce(r.data->>'status', '') <> 'a-signer' then raise exception 'Ce document est déjà signé.'; end if;
  if length(trim(coalesce(p_nom, ''))) < 2 then raise exception 'Écrivez votre prénom et votre nom.'; end if;
  if p_signature is null or left(p_signature, 22) <> 'data:image/png;base64,' or length(p_signature) > 300000 then raise exception 'Signature illisible. Recommencez.'; end if;
  update public.docs set data = r.data || jsonb_build_object('status', 'signe', 'signerName', left(trim(p_nom), 80), 'signature', p_signature,
      'signedAt', to_char(now() at time zone 'Europe/Paris', 'YYYY-MM-DD"T"HH24:MI:SS'), 'signedBy', auth.uid()::text)
    where collection = 'signatures' and id = p_id;
  return 'ok';
end $$;
revoke all on function public.signer_document(text, text, text) from public;
grant execute on function public.signer_document(text, text, text) to authenticated;

-- ===== 13. Protection des données : corbeille 30 jours, garde-fou des suppressions en masse, sauvegarde de nuit 14 jours =====

-- ===== 1. La corbeille =====
create table if not exists public.docs_corbeille (
  n bigserial primary key,
  collection text not null,
  id text not null,
  data jsonb,
  client_id text,
  deleted_at timestamptz not null default now(),
  deleted_by uuid
);
alter table public.docs_corbeille enable row level security;
drop policy if exists "corbeille : l'équipe lit" on public.docs_corbeille;
create policy "corbeille : l'équipe lit" on public.docs_corbeille for select to authenticated using (public.is_team());
create index if not exists docs_corbeille_quand on public.docs_corbeille (deleted_at);

create or replace function public.docs_vers_corbeille() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.docs_corbeille (collection, id, data, client_id, deleted_by) values (old.collection, old.id, old.data, old.client_id, auth.uid());
  return old;
end $$;
drop trigger if exists docs_corbeille on public.docs;
create trigger docs_corbeille after delete on public.docs for each row execute function public.docs_vers_corbeille();

-- ===== 2. Le garde-fou contre les suppressions en masse =====
create or replace function public.docs_garde_fou() returns trigger
language plpgsql set search_path = public as $$
declare v_n int;
begin
  select count(*) into v_n from anciennes;
  if v_n > 50 and coalesce(current_setting('entremis.vidage', true), '') <> 'oui' then
    raise exception 'Garde-fou Entremis : % lignes allaient être supprimées d''un coup. Rien n''a été supprimé. (Pour un vidage voulu : set local entremis.vidage = ''oui''; avant le delete.)', v_n;
  end if;
  return null;
end $$;
drop trigger if exists docs_garde_fou on public.docs;
create trigger docs_garde_fou after delete on public.docs referencing old table as anciennes for each statement execute function public.docs_garde_fou();

-- ===== 3. La sauvegarde de chaque nuit (gardée 14 jours) =====
create table if not exists public.docs_sauvegardes (
  jour date primary key,
  lignes int not null,
  contenu jsonb not null,
  faite_le timestamptz not null default now()
);
alter table public.docs_sauvegardes enable row level security;   -- aucune règle : lue seulement depuis le SQL Editor

create or replace function public.sauvegarde_du_jour() returns int
language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  insert into public.docs_sauvegardes (jour, lignes, contenu)
    select current_date, count(*), coalesce(jsonb_agg(jsonb_build_object('collection', collection, 'id', id, 'data', data, 'client_id', client_id)), '[]'::jsonb) from public.docs
  on conflict (jour) do update set lignes = excluded.lignes, contenu = excluded.contenu, faite_le = now();
  delete from public.docs_sauvegardes where jour < current_date - 14;
  delete from public.docs_corbeille where deleted_at < now() - interval '30 days';
  select lignes into v_n from public.docs_sauvegardes where jour = current_date;
  return v_n;
end $$;
revoke all on function public.sauvegarde_du_jour() from public, anon, authenticated;

-- Chaque nuit à 3 h (heure UTC, soit 4 h à Paris l'hiver) grâce à pg_cron, inclus dans Supabase
do $$ begin
  create extension if not exists pg_cron with schema pg_catalog;
exception when others then raise notice 'pg_cron : à activer dans Database › Extensions, puis relancer ce bloc.';
end $$;
do $$ begin
  perform cron.unschedule('entremis-sauvegarde') where exists (select 1 from cron.job where jobname = 'entremis-sauvegarde');
  perform cron.schedule('entremis-sauvegarde', '0 3 * * *', 'select public.sauvegarde_du_jour()');
exception when others then raise notice 'Sauvegarde de nuit pas programmée : %', sqlerrm;
end $$;

-- ===== 14. La dépense Meta, chaque nuit (fonction « meta-sync », jeton dans le secret META_TOKEN) =====
-- 3 h 30 UTC = 4 h 30 à Paris l'hiver. Appel signé avec le code secret de push_config, comme les notifications.
select cron.unschedule('entremis-meta') where exists (select 1 from cron.job where jobname = 'entremis-meta');
select cron.schedule('entremis-meta', '30 3 * * *', $job$
  select net.http_post(
    url := 'https://cnhxrhyugghigkozfpde.supabase.co/functions/v1/meta-sync',
    body := '{}'::jsonb,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-entremis-hook', (select hook_secret from public.push_config where id = 1)));
$job$);

-- ===== 15. Sécurité renforcée (27 nov. 2026, audit des 14 failles des applis « vibe codées ») =====
-- À coller seul dans une NOUVELLE requête du SQL Editor. On peut le relancer sans danger.

-- 1. Ce qu'écrit un client ou un visiteur est nettoyé par la base : < > et " deviennent ‹ › et '.
--    Un texte ne peut donc jamais devenir du code dans les pages de l'équipe (attaque du « script dans le pseudo »).
--    L'équipe n'est pas touchée. Les signatures non plus (la base les écrit elle-même, voir signer_document).
create or replace function public.texte_sur(j jsonb) returns jsonb
language plpgsql immutable set search_path = public as $$
declare cible text := chr(8249) || chr(8250) || chr(39);
begin
  case jsonb_typeof(j)
    when 'string' then return to_jsonb(translate(j #>> '{}', '<>"', cible));
    when 'object' then return coalesce((select jsonb_object_agg(translate(k, '<>"', cible), public.texte_sur(v)) from jsonb_each(j) as e(k, v)), '{}'::jsonb);
    when 'array'  then return coalesce((select jsonb_agg(public.texte_sur(v) order by n) from jsonb_array_elements(j) with ordinality as e(v, n)), '[]'::jsonb);
    else return j;
  end case;
end $$;
revoke all on function public.texte_sur(jsonb) from public, anon;
grant execute on function public.texte_sur(jsonb) to authenticated, service_role;

create or replace function public.docs_nettoie() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_team() or new.collection = 'signatures' then return new; end if;
  new.data := public.texte_sur(new.data);
  return new;
end $$;
drop trigger if exists docs_nettoie on public.docs;
create trigger docs_nettoie before insert or update on public.docs for each row execute function public.docs_nettoie();

-- 2. Un client n'écrit que sous un identifiant propre (lettres, chiffres, - _ . :), son avis et ses disponibilités
--    sous son propre nom, et une contestation seulement sur un lead qui lui a été donné : il ne peut pas se faire
--    passer pour un autre client ni bloquer la contestation d'un autre.
create or replace function public.lead_du_client(p_id text) returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.docs l where l.collection = 'leads' and l.id = p_id and l.client_id is not null and l.client_id = public.my_client());
$$;
drop policy if exists "docs : un client ajoute les siens" on public.docs;
create policy "docs : un client ajoute les siens" on public.docs
  for insert to authenticated
  with check (client_id = public.my_client() and id ~ '^[A-Za-z0-9_.:-]{1,80}$'
    and (collection not in ('avis', 'dispos') or id = public.my_client())
    and (collection in ('results', 'avis', 'dispos', 'referrals', 'prep', 'validations')
      or (collection = 'contests' and data->>'state' = 'ouvert' and public.lead_du_client(id))));
drop policy if exists "docs : un client modifie les siens" on public.docs;
create policy "docs : un client modifie les siens" on public.docs
  for update to authenticated
  using (client_id = public.my_client() and collection in ('results', 'avis', 'dispos', 'referrals', 'prep', 'validations'))
  with check (client_id = public.my_client() and id ~ '^[A-Za-z0-9_.:-]{1,80}$'
    and (collection not in ('avis', 'dispos') or id = public.my_client())
    and collection in ('results', 'avis', 'dispos', 'referrals', 'prep', 'validations'));

-- 3. Un compte qui n'est ni de l'équipe ni un client (créé en douce) n'écrit plus rien nulle part
do $$ declare p text; begin
  for p in select policyname from pg_policies where schemaname = 'public' and tablename = 'private_docs' loop
    execute format('drop policy %I on public.private_docs', p);
  end loop;
end $$;
create policy "prive : seulement soi (membres)" on public.private_docs
  for all to authenticated using (user_id = auth.uid() and public.is_member()) with check (user_id = auth.uid() and public.is_member());
drop policy if exists "push : les siens" on public.push_subs;
create policy "push : les siens" on public.push_subs for all to authenticated
  using (user_id = auth.uid() and public.is_member()) with check (user_id = auth.uid() and public.is_member());

-- 4. Les fichiers : 15 Mo au plus, et seulement des PDF, des images et des documents de bureau (pas de page web ni de programme)
update storage.buckets set file_size_limit = 15728640,
  allowed_mime_types = array['application/pdf', 'image/png', 'image/jpeg', 'image/webp', 'image/heic', 'image/gif',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/msword', 'application/vnd.ms-excel', 'text/csv']
  where id = 'files';

-- 5. Le code SMS : l'essai est compté avant de comparer, en une seule opération (5 essais au plus, même lancés en même temps).
--    Seule la fonction « sms » s'en sert.
create or replace function public.sms_essai(p_id uuid) returns text
language sql security definer set search_path = public as $$
  update public.sms_codes set attempts = attempts + 1
   where id = p_id and attempts < 5 and expires_at > now()
  returning code_hash;
$$;
revoke all on function public.sms_essai(uuid) from public, anon, authenticated;
grant execute on function public.sms_essai(uuid) to service_role;
