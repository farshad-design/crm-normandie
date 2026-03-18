// pages/api/import-csv.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { vendeurs } = req.body;
  if (!Array.isArray(vendeurs)) return res.status(400).json({ error: 'Format invalide' });

  let ajoutes = 0, erreurs = 0;
  for (const v of vendeurs) {
    try {
      const { data: vendeur, error: ve } = await sb.from('vendeurs').insert({
        nom: v.nom || '',
        prenom: v.prenom || '',
        email: v.email || null,
        telephone: v.telephone || null,
        statut: 'detecte',
        score_priorite: 50,
        source: v.source || 'import_csv'
      }).select().single();
      if (ve) { erreurs++; continue; }
      if (v.adresse || v.code_postal) {
        // Geocoder l'adresse
        let lat = null, lng = null;
        if (v.adresse && v.code_postal) {
          try {
            const geo = await fetch(`https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(v.adresse + ' ' + v.code_postal)}&limit=1`);
            const geoData = await geo.json();
            if (geoData.features?.length > 0) {
              [lng, lat] = geoData.features[0].geometry.coordinates;
            }
          } catch(e) {}
        }
        await sb.from('biens').insert({
          vendeur_id: vendeur.id,
          adresse: v.adresse || null,
          code_postal: v.code_postal || null,
          ville: v.ville || null,
          prix_demande: v.prix ? parseInt(v.prix) : null,
          surface_m2: v.surface ? parseInt(v.surface) : null,
          nb_pieces: v.pieces ? parseInt(v.pieces) : null,
          type_bien: v.type_bien || 'maison',
          latitude: lat,
          longitude: lng,
          url_annonce: v.url || null
        });
      }
      // Planifier rappels automatiques
      const now = Date.now();
      await sb.from('rappels').insert([
        { vendeur_id: vendeur.id, canal: 'email', type_rappel: 'j7',  statut: 'en_attente', date_envoi_prevu: new Date(now + 7*86400000).toISOString() },
        { vendeur_id: vendeur.id, canal: 'email', type_rappel: 'j14', statut: 'en_attente', date_envoi_prevu: new Date(now + 14*86400000).toISOString() },
        { vendeur_id: vendeur.id, canal: 'sms',   type_rappel: 'j14', statut: 'en_attente', date_envoi_prevu: new Date(now + 15*86400000).toISOString() },
        { vendeur_id: vendeur.id, canal: 'email', type_rappel: 'j30', statut: 'en_attente', date_envoi_prevu: new Date(now + 30*86400000).toISOString() },
      ]);
      ajoutes++;
    } catch(e) { erreurs++; }
  }
  res.json({ success: true, ajoutes, erreurs });
}
