// Entremis — la vérification du numéro par code SMS (le « lead vérifié » de Gianni, 23 nov. 2026).
// La page de demande (demande.html) appelle cette fonction :
//   { action: "send", lead: {...} }    → envoie un code à 6 chiffres par SMS (Brevo), garde la demande en attente 10 minutes
//   { action: "verify", id, code }     → bon code : la demande entre dans Leads, marquée « numéro vérifié »
//   { action: "resend", id }           → renvoie un code (3 fois au plus)
// Sans clé Brevo réglée (secret BREVO_API_KEY), la fonction répond { disabled: true } et la page envoie la demande sans code.
// Le code n'est jamais renvoyé à la page ; on n'en garde que l'empreinte. Une demande ne peut être « vérifiée » que par ici.
// À créer dans Supabase › Edge Functions, nom « sms », « Verify JWT » désactivé ; secret : BREVO_API_KEY (et SMS_SENDER, 11 caractères au plus, par défaut « Entremis »).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const s = (v: unknown, n = 200) => String(v ?? "").trim().slice(0, n);
const sha = async (t: string) => Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(t)))).map(b => b.toString(16).padStart(2, "0")).join("");

// Le numéro au format international, sans « + » (ce qu'attend Brevo)
export function intl(phone: string, pays: string): string {
  const raw = s(phone, 30), d = raw.replace(/\D/g, "");
  if (raw.startsWith("+")) return d;
  if (raw.startsWith("00")) return d.slice(2);
  const P = (pays || "FR").toUpperCase();
  if (P === "CA") return d.length === 10 ? "1" + d : d;
  const cc: Record<string, string> = { FR: "33", MC: "33", BE: "32", CH: "41", LU: "352" };
  if (cc[P] && d.startsWith("0")) return cc[P] + d.slice(1);
  if (cc[P] && P === "LU") return "352" + d;
  return d;
}

async function sendSms(to: string, text: string) {
  const key = Deno.env.get("BREVO_API_KEY")!;
  const r = await fetch("https://api.brevo.com/v3/transactionalSMS/sms", { method: "POST", headers: { "api-key": key, "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ sender: (Deno.env.get("SMS_SENDER") || "Entremis").slice(0, 11), recipient: to, content: text, type: "transactional" }) });
  if (!r.ok) throw new Error("sms " + r.status + " " + (await r.text()).slice(0, 200));
}

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "méthode" }, 405);
  if (!Deno.env.get("BREVO_API_KEY")) return json({ disabled: true });
  let p: any; try { p = await req.json(); } catch { return json({ error: "Demande illisible." }, 400); }
  try {
    if (p.action === "send") {
      const l = p.lead || {}, to = intl(l.p_telephone, l.p_pays);
      if (!l.p_consentement) return json({ error: "Il faut accepter d'être rappelé." }, 400);
      if (s(l.p_nom).length < 2 || to.length < 8 || to.length > 15) return json({ error: "Le numéro de téléphone est incomplet." }, 400);
      const hourAgo = new Date(Date.now() - 3600e3).toISOString(), dayAgo = new Date(Date.now() - 86400e3).toISOString();
      const { count: perPhone } = await db.from("sms_codes").select("id", { count: "exact", head: true }).eq("phone", to).gte("created_at", hourAgo);
      if ((perPhone || 0) >= 3) return json({ error: "Trop de codes demandés pour ce numéro. Réessayez dans une heure." }, 429);
      const { count: perDay } = await db.from("sms_codes").select("id", { count: "exact", head: true }).gte("created_at", dayAgo);
      if ((perDay || 0) >= 300) return json({ error: "Trop de demandes aujourd'hui. Réessayez demain." }, 429);
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0"), id = crypto.randomUUID();
      const lead = { p_nom: s(l.p_nom, 80), p_telephone: s(l.p_telephone, 20), p_ville: s(l.p_ville, 60), p_projet: s(l.p_projet, 60), p_source: s(l.p_source, 30) || "Site",
        p_email: s(l.p_email, 120), p_message: s(l.p_message, 500), p_code_postal: s(l.p_code_postal, 10), p_consentement: true, p_pays: s(l.p_pays, 2) || "FR" };
      await db.from("sms_codes").insert({ id, phone: to, code_hash: await sha(id + code), payload: lead, expires_at: new Date(Date.now() + 600e3).toISOString(), attempts: 0, sends: 1 });
      await sendSms(to, `Entremis : votre code est ${code}. Il confirme votre demande d'étude et reste valable 10 minutes.`);
      return json({ ok: true, id });
    }
    if (p.action === "verify" || p.action === "resend") {
      const { data: row } = await db.from("sms_codes").select("*").eq("id", s(p.id, 40)).maybeSingle();
      if (!row) return json({ error: "Ce code a expiré. Recommencez la demande." }, 400);
      if (p.action === "resend") {
        if (row.sends >= 3) return json({ error: "Trois codes envoyés : réessayez plus tard." }, 429);
        const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, "0");
        await db.from("sms_codes").update({ code_hash: await sha(row.id + code), expires_at: new Date(Date.now() + 600e3).toISOString(), attempts: 0, sends: row.sends + 1 }).eq("id", row.id);
        await sendSms(row.phone, `Entremis : votre nouveau code est ${code}. Valable 10 minutes.`);
        return json({ ok: true });
      }
      if (new Date(row.expires_at) < new Date()) return json({ error: "Ce code a expiré. Demandez-en un nouveau." }, 400);
      if (row.attempts >= 5) return json({ error: "Trop d'essais. Demandez un nouveau code." }, 429);
      if ((await sha(row.id + s(p.code, 6).replace(/\D/g, ""))) !== row.code_hash) {
        await db.from("sms_codes").update({ attempts: row.attempts + 1 }).eq("id", row.id);
        return json({ error: "Ce code n'est pas le bon. Vérifiez le SMS reçu." }, 400);
      }
      // Bon code : la demande entre dans Leads par la même porte que les autres (doublons, limites), puis on la marque vérifiée
      const { data: leadId, error } = await db.rpc("nouveau_lead", row.payload);
      if (error) return json({ error: error.message || "La demande n'a pas pu être enregistrée." }, 400);
      if (leadId && leadId !== "deja") {
        const { data: d } = await db.from("docs").select("data").eq("collection", "leads").eq("id", leadId).maybeSingle();
        if (d) await db.from("docs").update({ data: { ...d.data, verified: true, verifiedAt: new Date().toISOString().slice(0, 16), verifiedBy: "sms" } }).eq("collection", "leads").eq("id", leadId);
      }
      await db.from("sms_codes").delete().eq("id", row.id);
      return json({ ok: true });
    }
    return json({ error: "Action inconnue." }, 400);
  } catch (e) {
    return json({ error: "Le SMS n'a pas pu partir. Réessayez dans un instant.", detail: String((e as Error).message || e).slice(0, 120) }, 502);
  }
});
