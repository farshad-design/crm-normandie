// pages/api/connecteurs/seloger.js
// Connecteur SeLoger Pro — Flux XML
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!process.env.SELOGER_CLIENT_ID) return res.json({ success: false, message: 'SELOGER_CLIENT_ID manquant dans .env.local' });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { codesPostaux = ['14000'] } = req.body;
  let ajoutes = 0;

  try {
    for (const cp of codesPostaux.slice(0, 5)) {
      const url = `https://ws.seloger.com/search.xml?cp=${cp}&idtt=2&idtypebien=1,2&SEARCHpg=1&nb_pieces=1&pxmax=9999999&tri=d_dt_crea&login=${process.env.SELOGER_CLIENT_ID}&pwd=${process.env.SELOGER_CLIENT_SECRET}`;
      const r = await fetch(url, { headers: { 'Accept': 'application/xml' } });
      const xml = await r.text();

      // Parser XML simplifié
      const annonces = [];
      const matches = xml.matchAll(/<annonce>([\s\S]*?)<\/annonce>/g);
      for (const match of matches) {
        const bloc = match[1];
        const get = (tag) => bloc.match(new RegExp(`<${tag}>(.*?)<\/${tag}>`))?.[1] || '';
        annonces.push({
          adresse: get('adresse') || get('ville'),
          cp: get('cp') || cp,
          ville: get('ville'),
          prix: get('prix'),
          surface: get('surface'),
          pieces: get('nbpieces'),
          tel: get('telephones'),
          nom: get('contact'),
          url: get('permaLien'),
        });
      }

      for (const a of annonces) {
        try {
          const { data: v } = await sb.from('vendeurs').insert({
            nom: a.nom || 'Vendeur SeLoger', telephone: a.tel || null,
            statut: 'detecte', score_priorite: 65, source: 'seloger'
          }).select().single();
          if (v) {
            await sb.from('biens').insert({
              vendeur_id: v.id, adresse: a.adresse, code_postal: a.cp, ville: a.ville,
              prix_demande: a.prix ? parseInt(a.prix) : null,
              surface_m2: a.surface ? parseInt(a.surface) : null,
              nb_pieces: a.pieces ? parseInt(a.pieces) : null,
              type_bien: 'maison', url_annonce: a.url || null
            });
            const now = Date.now();
            await sb.from('rappels').insert([
              { vendeur_id: v.id, canal: 'email', type_rappel: 'j7',  statut: 'en_attente', date_envoi_prevu: new Date(now + 7*86400000).toISOString() },
              { vendeur_id: v.id, canal: 'email', type_rappel: 'j14', statut: 'en_attente', date_envoi_prevu: new Date(now + 14*86400000).toISOString() },
              { vendeur_id: v.id, canal: 'email', type_rappel: 'j30', statut: 'en_attente', date_envoi_prevu: new Date(now + 30*86400000).toISOString() },
            ]);
            ajoutes++;
          }
        } catch(e) {}
      }
    }
    res.json({ success: true, ajoutes });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
