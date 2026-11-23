// Entremis — la dépense Meta de chaque pub, récupérée toute seule (23 nov. 2026).
// Pour chaque client dont le compte publicitaire est relié (fiche client › Pub Meta), on lit chez Meta :
//   - la dépense du mois du compte → collection « meta », champ spend[AAAA-MM] ;
//   - chaque pub : nom, dépense depuis le début, leads comptés par Meta, en cours ou arrêtée → collection « ads » (portant le client_id).
// Une pub déjà suivie sous le même nom (créée par « En ligne » dans Vidéos) est mise à jour au lieu d'être recopiée.
// Appelée chaque nuit par la base (pg_cron, code secret de push_config) ou par l'équipe (bouton « Mettre à jour depuis Meta »).
// Le jeton Meta est un secret Supabase : META_TOKEN (utilisateur système du Business Manager d'Entremis, droit ads_read).
// À déployer avec « Verify JWT » désactivé : la fonction vérifie elle-même qui l'appelle.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const URL_ = Deno.env.get("SUPABASE_URL")!, SERVICE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const db = createClient(URL_, SERVICE, { auth: { persistSession: false } });
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "content-type, apikey, authorization, x-client-info, x-entremis-hook", "Access-Control-Allow-Methods": "POST, OPTIONS" };
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { ...cors, "Content-Type": "application/json" } });
const GRAPH = "https://graph.facebook.com/v21.0";
const s = (v: unknown, n = 200) => String(v ?? "").trim().slice(0, n);
const paris = () => new Date().toLocaleString("sv-SE", { timeZone: "Europe/Paris" }).slice(0, 16).replace(" ", "T");
const LEAD_TYPES = ["lead", "onsite_conversion.lead_grouped", "offsite_conversion.fb_pixel_lead", "leadgen_grouped"];

async function allowed(req: Request): Promise<boolean> {
  const hook = req.headers.get("x-entremis-hook");
  if (hook) { const { data } = await db.from("push_config").select("hook_secret").eq("id", 1).maybeSingle(); return !!data && data.hook_secret === hook; }
  const jwt = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, ""); if (!jwt) return false;
  const { data: u } = await db.auth.getUser(jwt); if (!u || !u.user) return false;
  const { data: m } = await db.from("members").select("role").eq("user_id", u.user.id).maybeSingle();
  return !!m && m.role === "team";
}
async function graph(path: string, token: string, params: Record<string, string>) {
  const out: any[] = []; let url = `${GRAPH}/${path}?` + new URLSearchParams({ ...params, access_token: token, limit: "500" }).toString();
  for (let page = 0; url && page < 20; page++) {
    const r = await fetch(url), j = await r.json().catch(() => ({}));
    if (!r.ok || j.error) throw new Error((j.error && j.error.message) || "Meta ne répond pas (" + r.status + ")");
    out.push(...(j.data || [])); url = j.paging && j.paging.next ? j.paging.next : "";
  }
  return out;
}
const leadsIn = (actions: any[] = []) => Math.max(0, ...actions.filter(a => LEAD_TYPES.includes(a.action_type)).map(a => Number(a.value) || 0));

Deno.serve(async req => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "méthode" }, 405);
  const token = Deno.env.get("META_TOKEN"); if (!token) return json({ disabled: true });
  if (!(await allowed(req))) return json({ error: "Refusé." }, 401);
  let only = ""; try { only = s((await req.json()).client, 40); } catch { /* corps vide : tous les clients */ }
  const month = paris().slice(0, 7), now = paris();
  const { data: metas } = await db.from("docs").select("id, data").eq("collection", "meta");
  const { data: adsRows } = await db.from("docs").select("id, data, client_id").eq("collection", "ads");
  const report: any[] = [];
  for (const m of metas || []) {
    const cid = m.id, d = m.data || {}, act = s(d.account).replace(/^act_/i, "").replace(/\D/g, "");
    if (only && cid !== only) continue;
    if (!act || d.access === "refuse") continue;
    try {
      const [monthRow] = await graph(`act_${act}/insights`, token, { fields: "spend", date_preset: "this_month" });
      const perAd = await graph(`act_${act}/insights`, token, { level: "ad", fields: "ad_id,ad_name,spend,actions", date_preset: "maximum" });
      const status = await graph(`act_${act}/ads`, token, { fields: "id,name,effective_status,created_time" });
      const st = Object.fromEntries(status.map((a: any) => [a.id, a]));
      let n = 0;
      for (const a of perAd) {
        const mine = (adsRows || []).filter(r => r.client_id === cid);
        const cur = mine.find(r => r.data && r.data.metaId === a.ad_id) || mine.find(r => r.data && !r.data.metaId && s(r.data.name).toUpperCase() === s(a.ad_name).toUpperCase());
        const id = cur ? cur.id : "meta-" + a.ad_id, base = cur ? cur.data : { id, series: 1, angle: "" };
        const info = st[a.ad_id] || {};
        const next = { ...base, id, client_id: cid, name: s(a.ad_name, 120) || base.name, metaId: a.ad_id, spent: Math.round((Number(a.spend) || 0) * 100) / 100, metaLeads: leadsIn(a.actions),
          state: info.effective_status ? (info.effective_status === "ACTIVE" ? "on" : "off") : (base.state || "on"), start: base.start || s(info.created_time, 10), source: "meta", syncedAt: now };
        const { error } = await db.from("docs").upsert({ collection: "ads", id, data: next, client_id: cid }, { onConflict: "collection,id" });
        if (error) throw error; n++;
      }
      const spend = { ...(d.spend || {}), [month]: Math.round((Number(monthRow && monthRow.spend) || 0) * 100) / 100 };
      await db.from("docs").update({ data: { ...d, spend, syncedAt: now, syncError: "" } }).eq("collection", "meta").eq("id", cid);
      report.push({ client: cid, pubs: n, depense_du_mois: spend[month] });
    } catch (e) {
      await db.from("docs").update({ data: { ...d, syncedAt: now, syncError: s((e as Error).message, 200) } }).eq("collection", "meta").eq("id", cid);
      report.push({ client: cid, erreur: s((e as Error).message, 200) });
    }
  }
  return json({ ok: true, clients: report });
});
