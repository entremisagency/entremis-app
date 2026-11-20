-- Entremis — test des droits de la base (20 novembre 2026).
-- À coller dans Supabase > SQL Editor, puis « Run ». Le tableau qui s'affiche à la fin doit dire « oui » partout.
-- Il crée deux comptes d'essai (un de l'équipe, un client) et quelques lignes d'essai, vérifie qui voit quoi
-- en se mettant à leur place, puis efface tout ce qu'il a créé. On peut le relancer sans danger.

-- 0. On efface un essai précédent
reset role;
delete from public.docs where id like 'essai-%';
delete from auth.users where id in ('00000000-0000-4000-8000-0000000e5501', '00000000-0000-4000-8000-0000000e5502');
delete from auth.users where email = 'essai-acces@entremisagency.github.io';

-- 1. Deux comptes d'essai : un de l'équipe, un client
insert into auth.users (id, email, aud, role) values
  ('00000000-0000-4000-8000-0000000e5501', 'essai-equipe@entremisagency.github.io', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000e5502', 'essai-client@entremisagency.github.io', 'authenticated', 'authenticated');
insert into public.members (user_id, who, role, client_id) values
  ('00000000-0000-4000-8000-0000000e5501', 'essai', 'team', null),
  ('00000000-0000-4000-8000-0000000e5502', null, 'client', 'essai-client');

-- 2. Des lignes d'essai
insert into public.docs (collection, id, data, client_id) values
  ('leads',   'essai-l1', '{"name":"Lead donné au client"}', 'essai-client'),
  ('leads',   'essai-l2', '{"name":"Lead d''un autre client"}', 'essai-autre'),
  ('leads',   'essai-l3', '{"name":"Lead pas encore donné"}', null),
  ('tasks',   'essai-t1', '{"title":"Tâche de l''équipe"}', null),
  ('chat',    'essai-m1', '{"text":"Discussion interne"}', null),
  ('scripts', 'essai-s1', '{"title":"Script de visite"}', null);
insert into public.private_docs (user_id, collection, id, data) values ('00000000-0000-4000-8000-0000000e5502', 'connect', 'essai', '{}');

-- 3. À la place du client d'essai
set role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000e5502","role":"authenticated"}', false);
select set_config('essai.c1', case when exists (select 1 from public.docs where id = 'essai-l1') then 'oui' else 'NON' end, false);
select set_config('essai.c2', case when not exists (select 1 from public.docs where id in ('essai-l2', 'essai-l3')) then 'oui' else 'NON' end, false);
select set_config('essai.c3', case when not exists (select 1 from public.docs where id in ('essai-t1', 'essai-m1')) then 'oui' else 'NON' end, false);
select set_config('essai.c4', case when exists (select 1 from public.docs where id = 'essai-s1') then 'oui' else 'NON' end, false);
do $$ begin
  insert into public.docs (collection, id, data, client_id) values ('results', 'essai-r1', '{"outcome":"signe"}', 'essai-client');
  perform set_config('essai.c5', 'oui', false);
exception when others then perform set_config('essai.c5', 'NON', false); end $$;
do $$ begin
  insert into public.docs (collection, id, data, client_id) values ('leads', 'essai-l4', '{}', 'essai-client');
  perform set_config('essai.c6', 'NON', false);
exception when others then perform set_config('essai.c6', 'oui', false); end $$;
do $$ begin
  insert into public.docs (collection, id, data, client_id) values ('results', 'essai-r2', '{}', 'essai-autre');
  perform set_config('essai.c7', 'NON', false);
exception when others then perform set_config('essai.c7', 'oui', false); end $$;
update public.members set role = 'team' where user_id = '00000000-0000-4000-8000-0000000e5502';
select set_config('essai.c8', case when public.is_team() then 'NON' else 'oui' end, false);
do $$ begin
  perform public.creer_acces_client('essai-pirate', 'provisoire', 'essai-autre');
  perform set_config('essai.c16', 'NON', false);
exception when others then perform set_config('essai.c16', 'oui', false); end $$;

-- 4. À la place du compte d'essai de l'équipe
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000e5501","role":"authenticated"}', false);
select set_config('essai.c9', case when (select count(*) from public.docs where id in ('essai-l1', 'essai-l2', 'essai-l3')) = 3 then 'oui' else 'NON' end, false);
select set_config('essai.c10', case when (select count(*) from public.docs where id in ('essai-t1', 'essai-m1')) = 2 then 'oui' else 'NON' end, false);
do $$ begin
  insert into public.docs (collection, id, data) values ('tasks', 'essai-t2', '{"title":"Nouvelle tâche"}');
  perform set_config('essai.c11', 'oui', false);
exception when others then perform set_config('essai.c11', 'NON', false); end $$;
select set_config('essai.c12', case when exists (select 1 from public.docs where id = 'essai-r1') then 'oui' else 'NON' end, false);
select set_config('essai.c13', case when not exists (select 1 from public.private_docs where id = 'essai') then 'oui' else 'NON' end, false);
do $$ begin
  perform public.creer_acces_client('essai-acces', 'provisoire', 'essai-client2');
  perform set_config('essai.c17', 'oui', false);
exception when others then perform set_config('essai.c17', 'NON : ' || sqlerrm, false); end $$;

-- 5. Quelqu'un qui n'est pas connecté
reset role;
set role anon;
select set_config('request.jwt.claims', '', false);
select set_config('essai.c14', case when not exists (select 1 from public.docs where id like 'essai-%') then 'oui' else 'NON' end, false);

-- 6. Le compte de l'agence (créé dans Authentication > Users)
reset role;
select set_config('essai.c15', case when exists (select 1 from public.members m join auth.users u on u.id = m.user_id where lower(u.email) = lower('ADRESSE_DU_COMPTE_AGENCE') and m.role = 'team') then 'oui' else 'NON' end, false);

select set_config('essai.c18', case when exists (select 1 from auth.users u join public.members m on m.user_id = u.id
  where u.email = 'essai-acces@entremisagency.github.io' and m.role = 'client' and m.client_id = 'essai-client2'
    and u.encrypted_password = extensions.crypt('provisoire', u.encrypted_password)) then 'oui' else 'NON' end, false);
select set_config('essai.c19', case when not exists (select 1 from auth.users where email like 'essai-pirate@%') then 'oui' else 'NON' end, false);

-- 7. On efface l'essai
delete from public.docs where id like 'essai-%';
delete from auth.users where id in ('00000000-0000-4000-8000-0000000e5501', '00000000-0000-4000-8000-0000000e5502');
delete from auth.users where email = 'essai-acces@entremisagency.github.io';

-- 8. Le résultat
select * from (values
  (1,  'Client', 'voit le lead qu''on lui a donné', current_setting('essai.c1', true)),
  (2,  'Client', 'ne voit pas les leads des autres clients', current_setting('essai.c2', true)),
  (3,  'Client', 'ne voit ni les tâches ni les discussions de l''équipe', current_setting('essai.c3', true)),
  (4,  'Client', 'voit les scripts de visite', current_setting('essai.c4', true)),
  (5,  'Client', 'peut noter le résultat d''une de ses visites', current_setting('essai.c5', true)),
  (6,  'Client', 'ne peut pas créer de lead', current_setting('essai.c6', true)),
  (7,  'Client', 'ne peut pas écrire chez un autre client', current_setting('essai.c7', true)),
  (8,  'Client', 'ne peut pas se donner le rôle équipe', current_setting('essai.c8', true)),
  (9,  'Équipe', 'voit tous les leads', current_setting('essai.c9', true)),
  (10, 'Équipe', 'voit les tâches et les discussions', current_setting('essai.c10', true)),
  (11, 'Équipe', 'peut ajouter une tâche', current_setting('essai.c11', true)),
  (12, 'Équipe', 'voit le résultat noté par le client', current_setting('essai.c12', true)),
  (13, 'Équipe', 'ne voit pas les connexions privées d''un autre', current_setting('essai.c13', true)),
  (14, 'Pas connecté', 'ne voit rien', current_setting('essai.c14', true)),
  (15, 'Compte agence', 'activé, rôle équipe', current_setting('essai.c15', true)),
  (16, 'Client', 'ne peut pas créer d''accès', current_setting('essai.c16', true)),
  (17, 'Équipe', 'peut créer l''accès d''un client', current_setting('essai.c17', true)),
  (18, 'Équipe', 'l''accès créé est bien un compte client, avec son mot de passe', current_setting('essai.c18', true)),
  (19, 'Client', 'n''a rien pu créer', current_setting('essai.c19', true))
) as resultat("n°", "compte", "ce qu'on vérifie", "ça marche") order by 1;
