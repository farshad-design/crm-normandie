// pages/api/cron/scoring.js
// Appelé automatiquement par Vercel chaque lundi à 7h
// Recalcule le score de priorité de tous les vendeurs

import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Non autorisé' });
    }
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: vendeurs } = await sb
    .from('vendeurs')
    .select('*, biens(*)')
    .not('statut', 'in', '("mandat","archive")');

  let rescore = 0;

  for (const vendeur of (vendeurs || [])) {
    const bien = vendeur.biens?.[0];
    if (!bien) continue;

    let score = 40;

    // Ancienneté annonce
    if (bien.date_publication) {
      const jours = Math.floor((Date.now() - new Date(bien.date_publication).getTime()) / 86400000);
      if (jours > 60) score += 25;
      else if (jours > 30) score += 18;
      else if (jours > 14) score += 10;
      else if (jours > 7) score += 5;
    }

    // Silence depuis dernier contact
    if (vendeur.dernier_contact) {
      const silence = Math.floor((Date.now() - new Date(vendeur.dernier_contact).getTime()) / 86400000);
      if (silence > 14) score += 10;
      else if (silence < 3) score -= 10;
    } else {
      score += 8; // Jamais contacté
    }

    // Nombre de contacts
    if ((vendeur.nb_contacts || 0) > 4) score -= 15;

    score = Math.min(100, Math.max(0, score));

    await sb.from('vendeurs').update({ score_priorite: score }).eq('id', vendeur.id);
    rescore++;
  }

  res.json({ success: true, rescore });
}
