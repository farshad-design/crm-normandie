// pages/api/cron/sms.js
// Appelé automatiquement par Vercel tous les jours à 9h
// Envoie les SMS de rappel automatiques

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Non autorisé' });
    }
  }

  // Twilio non configuré — retourner un message clair
  if (!process.env.TWILIO_ACCOUNT_SID || process.env.TWILIO_ACCOUNT_SID === 'ACxxx') {
    return res.json({ success: false, message: 'Twilio non configuré' });
  }

  const twilio = require('twilio')(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const AGENT = {
    nom:       process.env.AGENT_NOM       || 'Farshad',
    telephone: process.env.AGENT_TELEPHONE || '07 60 58 56 93',
    agence:    process.env.AGENT_AGENCE    || 'Megagence'
  };

  const { data: rappels } = await sb
    .from('rappels')
    .select('*, vendeurs(*, biens(*))')
    .eq('statut', 'en_attente')
    .eq('canal', 'sms')
    .lte('date_envoi_prevu', new Date().toISOString());

  let envoyes = 0;

  for (const rappel of (rappels || [])) {
    const vendeur = rappel.vendeurs;
    const bien = vendeur?.biens?.[0];
    if (!vendeur?.telephone || !bien) continue;

    try {
      const response = await claude.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 80,
        messages: [{
          role: 'user',
          content: `SMS de relance pour ${vendeur.prenom} qui vend à ${bien.code_postal}. De la part de ${AGENT.nom} (${AGENT.agence}). Max 160 caractères. Professionnel. Inclure le numéro ${AGENT.telephone}. Juste le texte SMS.`
        }]
      });

      const message = response.content[0].text.trim().slice(0, 160);
      let tel = vendeur.telephone.replace(/\s/g, '');
      if (tel.startsWith('0')) tel = '+33' + tel.slice(1);

      await twilio.messages.create({
        body: message,
        from: process.env.TWILIO_PHONE,
        to: tel
      });

      await sb.from('rappels').update({
        statut: 'envoye',
        message_ia: message,
        date_envoi_reel: new Date().toISOString()
      }).eq('id', rappel.id);

      envoyes++;
      await new Promise(r => setTimeout(r, 3000));

    } catch (err) {
      await sb.from('rappels').update({
        statut: 'echec',
        erreur: err.message
      }).eq('id', rappel.id);
    }
  }

  res.json({ success: true, envoyes, total: rappels?.length || 0 });
}
