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
  with check (client_id = public.my_client() and collection in ('results', 'avis', 'dispos', 'referrals', 'prep'));

drop policy if exists "docs : un client modifie les siens" on public.docs;
create policy "docs : un client modifie les siens" on public.docs
  for update to authenticated
  using (client_id = public.my_client() and collection in ('results', 'avis', 'dispos', 'referrals', 'prep'))
  with check (client_id = public.my_client() and collection in ('results', 'avis', 'dispos', 'referrals', 'prep'));

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
