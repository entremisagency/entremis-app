// Entremis — envoyer un e-mail depuis l'app (devis, facture, relance, bilan), avec le vrai PDF en pièce jointe.
// L'envoi passe par Resend. La clé Resend est un secret Supabase (RESEND_API_KEY) : elle n'est jamais dans l'app.
// Garde-fous (27 nov. 2026) :
//   - seule l'équipe connectée (table members, rôle « team ») peut envoyer ;
//   - on n'écrit qu'à une adresse déjà connue de l'app (un client, un lead, un prospect, une demande du site) :
//     même avec une session volée, la fonction ne sert pas à envoyer des mails à n'importe qui ;
//   - 100 mails par jour au plus pour toute l'équipe (table mails_envoyes, voir schema.sql section 16).
//
// Secrets à ajouter dans Supabase > Edge Functions > Secrets :
//   RESEND_API_KEY  la clé Resend
//   MAIL_FROM       l'expéditeur, sur un domaine vérifié dans Resend, ex. « Entremis <contact@entremis.fr> »
//   APP_ORIGIN      l'adresse de la webapp, ex. « https://entremisagency.github.io »
// À déployer avec « Verify JWT » désactivé : la fonction vérifie elle-même qui l'appelle.
// Pas encore appelée par l'app ni déployée : à essayer en vrai le jour où on la branche.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "https://entremisagency.github.io",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
export const isEmail = (s: string) => /^[^@\s<>"',;]+@[^@\s<>"',;]+\.[^@\s<>"',;]+$/.test(s) && s.length <= 200;
const PAR_JOUR = 100;
const CONNUES = ["clients", "leads", "prospects", "site-requests", "contacts"];

async function equipe(req: Request): Promise<string | null> {
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  if (!jwt) return null;
  const { data: u } = await db.auth.getUser(jwt);
  if (!u || !u.user) return null;
  const { data: m } = await db.from("members").select("role").eq("user_id", u.user.id).maybeSingle();
  return m && m.role === "team" ? u.user.id : null;
}

// L'adresse est-elle déjà dans l'app ? (comparaison exacte, sans tenir compte des majuscules)
async function connue(to: string): Promise<boolean> {
  const motif = to.replace(/[\\%_]/g, c => "\\" + c);
  const { data } = await db.from("docs").select("id").in("collection", CONNUES).ilike("data->>email", motif).limit(1);
  return !!data && data.length > 0;
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "méthode" }, 405);

  // 1. Est-ce bien quelqu'un de l'équipe ?
  const userId = await equipe(req);
  if (!userId) return json({ error: "Réservé à l'équipe Entremis." }, 403);

  // 2. Ce qu'on envoie
  let p: Record<string, unknown>;
  try { p = await req.json(); } catch { return json({ error: "Demande illisible." }, 400); }
  const to = String(p.to ?? "").trim().toLowerCase();
  const subject = String(p.subject ?? "").replace(/[\r\n]+/g, " ").trim().slice(0, 200);
  const text = String(p.text ?? "").slice(0, 20000);
  if (!isEmail(to) || !subject || !text) return json({ error: "Adresse, objet et message sont obligatoires." }, 400);
  if (!(await connue(to))) return json({ error: "Cette adresse n'est dans aucune fiche de l'app. Ajoutez-la d'abord à la fiche du client ou du lead." }, 403);
  const pdf = typeof p.pdfBase64 === "string" && p.pdfBase64.length < 7_000_000 && /^[A-Za-z0-9+/=]+$/.test(p.pdfBase64) ? p.pdfBase64 : "";
  const filename = (String(p.filename ?? "document.pdf").replace(/[^\p{L}\p{N} ._-]/gu, "").slice(0, 100) || "document").replace(/(\.pdf)?$/i, ".pdf");
  const attachments = pdf ? [{ filename, content: pdf }] : undefined;
  const replyTo = typeof p.replyTo === "string" && isEmail(p.replyTo.trim()) ? p.replyTo.trim() : undefined;

  // 3. Le plafond du jour, compté avant l'envoi
  const depuis = new Date(Date.now() - 86400e3).toISOString();
  const { count } = await db.from("mails_envoyes").select("id", { count: "exact", head: true }).gte("at", depuis);
  if ((count || 0) >= PAR_JOUR) return json({ error: `${PAR_JOUR} mails envoyés en 24 h : c'est le plafond. Réessayez demain.` }, 429);

  // 4. Envoi par Resend
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return json({ error: "La clé Resend n'est pas encore réglée." }, 500);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: Deno.env.get("MAIL_FROM") ?? "Entremis <contact@entremis.fr>", to: [to], subject, text, attachments, reply_to: replyTo }),
  });
  const out = await r.json().catch(() => ({}));
  if (!r.ok) { console.error("resend", r.status, out); return json({ error: "Envoi refusé par Resend. Réessayez dans un instant." }, 502); }
  await db.from("mails_envoyes").insert({ user_id: userId, destinataire: to, objet: subject });
  return json({ ok: true, id: out.id });
});
