// pages/api/webhook-email.js
// Reçoit les emails Google Alerts forwarded
// Extrait automatiquement les annonces et les ajoute au CRM

import Anthropic from '@anthropic-ai/sdk';
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { sujet, corps, expediteur } = req.body;
  if (!corps) return res.status(400).json({ error: 'Corps email manquant' });

  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  try {
    // Claude extrait toutes les annonces de l'email Google Alert
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      messages: [{
        role: 'user',
        content: `Cet email contient des annonces immobilières (Google Alert ou newsletter).
Extrais TOUTES les annonces trouvées.
Réponds UNIQUEMENT en JSON valide, tableau d'objets, sans markdown :
[
  {
    "adresse": "adresse complète ou vide",
    "code_postal": "5 chiffres ou vide",
    "ville": "ville ou vide",
    "prix": "nombre seul ou vide",
    "surface": "nombre seul ou vide",
    "pieces": "nombre seul ou vide",
    "type_bien": "maison ou appartement",
    "telephone": "numéro ou vide",
    "nom": "nom vendeur ou vide",
    "url": "lien annonce ou vide",
    "description": "résumé 1 phrase"
  }
]

Email :
${corps.slice(0, 4000)}`
      }]
    });

    const txt = response.content[0].text.trim();
    const annonces = JSON.parse(txt);

    let ajoutes = 0;
    for (const a of annonces) {
      if (!a.adresse && !a.code_postal) continue;
      try {
        const { data: v } = await sb.from('vendeurs').insert({
          nom: a.nom || 'Vendeur',
          prenom: '',
          telephone: a.telephone || null,
          statut: 'detecte',
          score_priorite: 55,
          source: 'google_alert',
          notes: a.description || ''
        }).select().single();

        if (v) {
          await sb.from('biens').insert({
            vendeur_id: v.id,
            adresse: a.adresse || '',
            code_postal: a.code_postal || '',
            ville: a.ville || '',
            prix_demande: a.prix ? parseInt(a.prix) : null,
            surface_m2: a.surface ? parseInt(a.surface) : null,
            nb_pieces: a.pieces ? parseInt(a.pieces) : null,
            type_bien: a.type_bien || 'maison',
            url_annonce: a.url || null
          });

          // Planifier rappels automatiques
          const now = Date.now();
          await sb.from('rappels').insert([
            { vendeur_id: v.id, canal: 'email', type_rappel: 'j7',  statut: 'en_attente', date_envoi_prevu: new Date(now + 7*86400000).toISOString() },
            { vendeur_id: v.id, canal: 'email', type_rappel: 'j14', statut: 'en_attente', date_envoi_prevu: new Date(now + 14*86400000).toISOString() },
            { vendeur_id: v.id, canal: 'sms',   type_rappel: 'j14', statut: 'en_attente', date_envoi_prevu: new Date(now + 15*86400000).toISOString() },
            { vendeur_id: v.id, canal: 'email', type_rappel: 'j30', statut: 'en_attente', date_envoi_prevu: new Date(now + 30*86400000).toISOString() },
          ]);
          ajoutes++;
        }
      } catch(e) { console.error(e.message); }
    }

    res.json({ success: true, annonces_trouvees: annonces.length, ajoutes });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
