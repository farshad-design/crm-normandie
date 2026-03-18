// pages/api/connecteurs/bienici.js
// Connecteur Bien Ici Pro API
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  if (!process.env.BIENICI_API_KEY) return res.json({ success: false, message: 'BIENICI_API_KEY manquant dans .env.local' });

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { codesPostaux = ['14000'] } = req.body;
  let ajoutes = 0;

  try {
    for (const cp of codesPostaux.slice(0, 5)) {
      const r = await fetch(`https://www.bienici.com/realEstateAds.json?filters={"postalCode":"${cp}","transactionType":"buy","propertyType":["house","flat"],"size":20}`, {
        headers: { 'Authorization': `Bearer ${process.env.BIENICI_API_KEY}`, 'Content-Type': 'application/json' }
      });
      const data = await r.json();

      for (const ad of (data.realEstateAds || [])) {
        try {
          const { data: v } = await sb.from('vendeurs').insert({
            nom: ad.contactName || 'Vendeur Bien Ici',
            telephone: ad.phoneToDisplay || null,
            statut: 'detecte', score_priorite: 65, source: 'bienici'
          }).select().single();
          if (v) {
            await sb.from('biens').insert({
              vendeur_id: v.id,
              adresse: ad.address?.label || '',
              code_postal: ad.postalCode || cp,
              ville: ad.city || '',
              prix_demande: ad.price || null,
              surface_m2: ad.surfaceArea || null,
              nb_pieces: ad.roomsQuantity || null,
              type_bien: ad.propertyType === 'house' ? 'maison' : 'appartement',
              url_annonce: `https://www.bienici.com/annonce/${ad.id}`,
              latitude: ad.blurInfo?.position?.lat || null,
              longitude: ad.blurInfo?.position?.lng || null,
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
