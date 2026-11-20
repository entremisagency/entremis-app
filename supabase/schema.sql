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
-- et n'écrit que ses résultats de visite, son avis, ses disponibilités et ses parrainages.
drop policy if exists "docs : l'équipe lit et écrit tout" on public.docs;
create policy "docs : l'équipe lit et écrit tout" on public.docs
  for all to authenticated using (public.is_team()) with check (public.is_team());

drop policy if exists "docs : un client lit ce qui le concerne" on public.docs;
create policy "docs : un client lit ce qui le concerne" on public.docs
  for select to authenticated using (client_id is not null and client_id = public.my_client());

drop policy if exists "docs : un client ajoute les siens" on public.docs;
create policy "docs : un client ajoute les siens" on public.docs
  for insert to authenticated
  with check (client_id = public.my_client() and collection in ('results', 'avis', 'dispos', 'referrals'));

drop policy if exists "docs : un client modifie les siens" on public.docs;
create policy "docs : un client modifie les siens" on public.docs
  for update to authenticated
  using (client_id = public.my_client() and collection in ('results', 'avis', 'dispos', 'referrals'))
  with check (client_id = public.my_client() and collection in ('results', 'avis', 'dispos', 'referrals'));

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

-- 7. Les comptes de l'équipe ------------------------------------------------------------
-- D'abord : Authentication > Users > « Invite user » pour Marc, Richard et Gianni (chacun choisit son mot de passe).
-- Puis, une fois les trois invitations acceptées, remplacer les adresses ci-dessous et lancer ces trois lignes :
-- insert into public.members (user_id, who, role) select id, 'marc',    'team' from auth.users where email = 'ADRESSE_DE_MARC'    on conflict (user_id) do nothing;
-- insert into public.members (user_id, who, role) select id, 'richard', 'team' from auth.users where email = 'ADRESSE_DE_RICHARD' on conflict (user_id) do nothing;
-- insert into public.members (user_id, who, role) select id, 'gianni',  'team' from auth.users where email = 'ADRESSE_DE_GIANNI'  on conflict (user_id) do nothing;
