// Entremis — les notifications sur le téléphone, même quand l'app est fermée (21 nov. 2026).
// Deux usages :
//   GET  …/functions/v1/push          → la clé publique (VAPID) que le téléphone utilise pour s'abonner. Créée au premier appel.
//   POST …/functions/v1/push          → appelé par la base (déclencheur « docs_push » de schema.sql) à chaque événement utile.
//                                       Il porte un code secret (table push_config, jamais lisible par l'app) : sans lui, refus.
// Rien à régler à la main : la clé privée et le code secret vivent dans la table push_config, lue seulement ici (clé service).
// À créer dans Supabase › Edge Functions, nom « push », avec « Verify JWT » désactivé (l'app n'envoie pas de jeton ici).
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info", "Access-Control-Allow-Methods": "GET, POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });

type Cfg = { public_key: string | null; private_key: string | null; hook_secret: string };
async function config(): Promise<Cfg> {
  const { data, error } = await db.from("push_config").select("public_key, private_key, hook_secret").eq("id", 1).single();
  if (error || !data) throw new Error("push_config manquante : lancez le SQL des notifications.");
  if (!data.public_key || !data.private_key) {
    const k = webpush.generateVAPIDKeys();
    await db.from("push_config").update({ public_key: k.publicKey, private_key: k.privateKey }).eq("id", 1);
    return { ...data, public_key: k.publicKey, private_key: k.privateKey };
  }
  return data as Cfg;
}

type Ev = { op: string; collection: string; id: string; client_id: string | null; data: Record<string, any>; old: Record<string, any> | null; actor: string | null };
type Msg = { to: "team" | { client: string } | { who: string }; title: string; body: string; href: string };
const s = (v: unknown) => String(v ?? "").trim();
const join = (...a: unknown[]) => a.map(s).filter(Boolean).join(", ");

// Qui prévenir, et avec quel texte
function messages(e: Ev): Msg[] {
  const d = e.data || {}, o = e.old || {}, ins = e.op === "INSERT";
  switch (e.collection) {
    case "leads": {
      const out: Msg[] = [];
      if (ins && !d.to) out.push({ to: "team", title: "Nouveau lead", body: join(d.name, d.trade, d.city), href: "#leads" });
      if (d.to && d.to !== o.to) out.push({ to: { client: s(d.to) }, title: "Nouveau lead pour vous", body: join(d.name, d.trade, d.city), href: "#facturation" });
      return out;
    }
    case "site-requests": return ins ? [{ to: "team", title: "Demande du site", body: join(d.name, d.who), href: "#pipeline" }] : [];
    case "contests":
      if (ins) return [{ to: "team", title: "Lead contesté", body: s(d.why).slice(0, 120) || "Un client conteste un lead.", href: "#leads" }];
      if (d.state !== o.state && e.client_id) return [{ to: { client: e.client_id }, title: d.state === "accepte" ? "Contestation acceptée" : "Contestation refusée", body: d.state === "accepte" ? "Ce lead ne vous sera pas facturé." : "Ce lead reste facturé. Écrivez-nous si besoin.", href: "#facturation" }];
      return [];
    case "rdv": return ins && e.client_id ? [{ to: { client: e.client_id }, title: "Nouveau rendez-vous", body: join(d.name, [s(d.date).split("-").reverse().join("/"), s(d.start)].filter(Boolean).join(" à ")), href: "#rdv-" + e.id }] : [];
    case "results": return ins ? [{ to: "team", title: "Résultat de visite", body: "Un client a noté le résultat d'un rendez-vous.", href: "#rendez-vous" }] : [];
    case "chat": return ins ? [{ to: "team", title: "Discussion", body: s(d.text).slice(0, 140), href: "#discussions" }] : [];
    case "tasks": return ins && d.who ? [{ to: { who: s(d.who) }, title: "Nouvelle tâche", body: s(d.title).slice(0, 140), href: "#taches" }] : [];
  }
  return [];
}

async function recipients(to: Msg["to"]): Promise<string[]> {
  let q = db.from("members").select("user_id");
  if (to === "team") q = q.eq("role", "team");
  else if ("client" in to) q = q.eq("role", "client").eq("client_id", to.client);
  else q = q.eq("role", "team").eq("who", to.who);
  const { data } = await q;
  return (data || []).map((r: any) => r.user_id);
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  try {
    const cfg = await config();
    if (req.method === "GET") return json({ key: cfg.public_key });
    if (req.method !== "POST") return json({ error: "méthode" }, 405);
    if (req.headers.get("x-entremis-hook") !== cfg.hook_secret) return json({ error: "refusé" }, 401);
    const e = await req.json() as Ev;
    const vapidDetails = { subject: Deno.env.get("PUSH_CONTACT") ?? "https://entremisagency.github.io", publicKey: cfg.public_key!, privateKey: cfg.private_key! };
    let sent = 0;
    for (const m of messages(e)) {
      const users = (await recipients(m.to)).filter(u => u !== e.actor);   // pas d'alerte pour ce qu'on vient de faire soi-même
      if (!users.length) continue;
      const { data: subs } = await db.from("push_subs").select("endpoint, sub").in("user_id", users);
      const payload = JSON.stringify({ title: m.title, body: m.body, href: m.href, tag: e.collection + ":" + e.id });
      await Promise.all((subs || []).map(async (r: any) => {
        // Chiffrement et signature par web-push, envoi par fetch (le module https de Node marche mal ici)
        try {
          const q = webpush.generateRequestDetails(r.sub, payload, { TTL: 86400, urgency: "high", vapidDetails });
          const res = await fetch(q.endpoint, { method: "POST", headers: q.headers as Record<string, string>, body: q.body as unknown as BodyInit });
          if (res.ok) sent++;
          else if (res.status === 404 || res.status === 410) await db.from("push_subs").delete().eq("endpoint", r.endpoint);   // téléphone désabonné
        } catch (_) { /* un téléphone injoignable ne bloque pas les autres */ }
      }));
    }
    return json({ ok: true, sent });
  } catch (err) {
    return json({ error: String((err as Error).message || err) }, 500);
  }
});
