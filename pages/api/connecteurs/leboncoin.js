// pages/api/connecteurs/leboncoin.js
// Connecteur LeBonCoin Pro API
import { createClient } from '@supabase/supabase-js';

async function getToken() {
  const r = await fetch('https://api.leboncoin.fr/api/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: process.env.LEBONCOIN_CLIENT_ID,
      client_secret: process.env.LEBONCOIN_CLIENT_SECRET,
    })
  });
  return (await r.json()).access_token;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!process.env.LEBONCOIN_CLIENT_ID) return res.json({ success: false, message: 'LEBONCOIN_CLIENT_ID manquant dans .env.local' });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { codesPostaux = ['14000'] } = req.body;
  let ajoutes = 0;

  try {
    const token = await getToken();
    for (const cp of codesPostaux.slice(0, 5)) {
      const r = await fetch('https://api.leboncoin.fr/finder/search', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json', 'api_key': process.env.LEBONCOIN_CLIENT_ID },
        body: JSON.stringify({
          filters: { category: { id: '9' }, enums: { ad_type: ['offer'] }, location: { zipcode: cp } },
          sort_by: 'time', sort_order: 'desc', limit: 20
        })
      });
      const data = await r.json();
      for (const ad of (data.ads || [])) {
        try {
          const attrs = {};
          (ad.attributes || []).forEach(a => attrs[a.key] = a.value);
          const { data: v } = await sb.from('vendeurs').insert({
            nom: ad.owner?.name || 'Vendeur', telephone: ad.phone || null,
            statut: 'detecte', score_priorite: 65, source: 'leboncoin'
          }).select().single();
          if (v) {
            await sb.from('biens').insert({
              vendeur_id: v.id, adresse: ad.location?.address || '',
              code_postal: ad.location?.zipcode || cp, ville: ad.location?.city || '',
              prix_demande: ad.price?.[0] || null,
              surface_m2: attrs.square ? parseInt(attrs.square) : null,
              type_bien: 'maison', url_annonce: `https://www.leboncoin.fr/ad/${ad.list_id}`,
              latitude: ad.location?.lat || null, longitude: ad.location?.lng || null,
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
