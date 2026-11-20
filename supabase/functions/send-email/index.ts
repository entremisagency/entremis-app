// Entremis — envoyer un e-mail depuis l'app (devis, facture, relance, bilan), avec le vrai PDF en pièce jointe.
// L'envoi passe par Resend. La clé Resend est un secret Supabase (RESEND_API_KEY) : elle n'est jamais dans l'app.
// Seule l'équipe connectée (table members, rôle « team ») peut envoyer.
//
// Secrets à ajouter dans Supabase > Edge Functions > Secrets :
//   RESEND_API_KEY  la clé Resend (une clé neuve, pas celle écrite dans la conversation)
//   MAIL_FROM       l'expéditeur, sur un domaine vérifié dans Resend, ex. « Entremis <contact@entremis.fr> »
//   APP_ORIGIN      l'adresse de la webapp une fois en ligne, ex. « https://app.entremis.fr »
// Non testé : à déployer et essayer une fois l'accès au projet Entremis réglé.
import { withSupabase } from "npm:@supabase/server";

const cors = {
  "Access-Control-Allow-Origin": Deno.env.get("APP_ORIGIN") ?? "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const isEmail = (s: string) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);

const handler = withSupabase({ auth: "user" }, async (req, ctx) => {
  // 1. Est-ce bien quelqu'un de l'équipe ?
  const userId = ctx.userClaims?.sub;
  const { data: me } = await ctx.supabase.from("members").select("role").eq("user_id", userId).maybeSingle();
  if (!me || me.role !== "team") return json({ error: "Réservé à l'équipe Entremis." }, 403);

  // 2. Ce qu'on envoie
  let p: Record<string, unknown>;
  try { p = await req.json(); } catch { return json({ error: "Demande illisible." }, 400); }
  const to = String(p.to ?? "").trim();
  const subject = String(p.subject ?? "").trim().slice(0, 200);
  const text = String(p.text ?? "").slice(0, 20000);
  if (!isEmail(to) || !subject || !text) return json({ error: "Adresse, objet et message sont obligatoires." }, 400);
  const pdf = typeof p.pdfBase64 === "string" && p.pdfBase64.length < 7_000_000 ? p.pdfBase64 : "";
  const attachments = pdf ? [{ filename: String(p.filename ?? "document.pdf").slice(0, 120), content: pdf }] : undefined;
  const replyTo = typeof p.replyTo === "string" && isEmail(p.replyTo) ? p.replyTo : undefined;

  // 3. Envoi par Resend
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) return json({ error: "La clé Resend n'est pas encore réglée." }, 500);
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: Deno.env.get("MAIL_FROM") ?? "Entremis <contact@entremis.fr>", to: [to], subject, text, attachments, reply_to: replyTo }),
  });
  const out = await r.json().catch(() => ({}));
  return r.ok ? json({ ok: true, id: out.id }) : json({ error: out.message ?? "Envoi refusé par Resend." }, 502);
});

Deno.serve((req) => (req.method === "OPTIONS" ? new Response("ok", { headers: cors }) : handler(req)));
