// pages/api/cron/emails.js
// Appelé automatiquement par Vercel tous les jours à 8h
// Envoie les emails de relance J+7, J+14, J+30

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';
import nodemailer from 'nodemailer';

export default async function handler(req, res) {
  // Sécurité — seulement Vercel Cron peut appeler cette route
  if (req.headers.authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    // En dev on autorise quand même pour tester
    if (process.env.NODE_ENV === 'production') {
      return res.status(401).json({ error: 'Non autorisé' });
    }
  }

  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
    port: parseInt(process.env.SMTP_PORT || '587'),
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });

  const AGENT = {
    nom:       process.env.AGENT_NOM       || 'Farshad Sahraei',
    email:     process.env.AGENT_EMAIL     || 'farshad.sahraei@megagence.com',
    telephone: process.env.AGENT_TELEPHONE || '07 60 58 56 93',
    agence:    process.env.AGENT_AGENCE    || 'Megagence Normandie'
  };

  const SIGNATURE = `
Cordialement,
${AGENT.nom}
Conseiller Immobilier — ${AGENT.agence}
📱 ${AGENT.telephone}
📧 ${AGENT.email}`;

  const TYPES = {
    j7:  (v, b) => `Tu es ${AGENT.nom} chez ${AGENT.agence}. Email de relance douce J+7 pour ${v.prenom} ${v.nom} qui vend sa maison à ${b.code_postal} ${b.ville}. Sans réponse depuis 7 jours. Propose estimation gratuite, mentionne acheteurs actifs. 100 mots max. Commence par "Bonjour ${v.prenom}," et termine par : ${SIGNATURE}`,
    j14: (v, b) => `Tu es ${AGENT.nom} chez ${AGENT.agence}. Email relance J+14 pour ${v.prenom} ${v.nom}, bien à ${b.code_postal}. Crée urgence douce : acheteurs qualifiés, marché favorable. 100 mots max. Commence par "Bonjour ${v.prenom}," et termine par : ${SIGNATURE}`,
    j30: (v, b) => `Tu es ${AGENT.nom} chez ${AGENT.agence}. Dernier email pour ${v.prenom} ${v.nom}. Ton sincère, clôture dossier mais porte ouverte. 80 mots max. Commence par "Bonjour ${v.prenom}," et termine par : ${SIGNATURE}`
  };

  // Récupérer les rappels email en attente
  const { data: rappels } = await sb
    .from('rappels')
    .select('*, vendeurs(*, biens(*))')
    .eq('statut', 'en_attente')
    .eq('canal', 'email')
    .lte('date_envoi_prevu', new Date().toISOString());

  let envoyes = 0;
  let erreurs = 0;

  for (const rappel of (rappels || [])) {
    const vendeur = rappel.vendeurs;
    const bien = vendeur?.biens?.[0];
    if (!vendeur?.email || !bien) continue;

    try {
      // Générer le contenu avec Claude
      const promptFn = TYPES[rappel.type_rappel];
      if (!promptFn) continue;

      const response = await claude.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        messages: [{ role: 'user', content: promptFn(vendeur, bien) }]
      });
      const corps = response.content[0].text.trim();

      // Envoyer l'email
      await transporter.sendMail({
        from: `"${AGENT.nom} — ${AGENT.agence}" <${AGENT.email}>`,
        to: vendeur.email,
        subject: `Votre bien à ${bien.ville || 'Caen'} — ${AGENT.agence}`,
        text: corps,
        html: corps.replace(/\n/g, '<br>')
      });

      // Marquer comme envoyé
      await sb.from('rappels').update({
        statut: 'envoye',
        message_ia: corps,
        date_envoi_reel: new Date().toISOString()
      }).eq('id', rappel.id);

      // Enregistrer dans l'historique
      await sb.from('contacts').insert({
        vendeur_id: vendeur.id,
        canal: 'email',
        type_contact: rappel.type_rappel,
        contenu: corps,
        genere_par_ia: true
      });

      await sb.from('vendeurs').update({
        dernier_contact: new Date().toISOString()
      }).eq('id', vendeur.id);

      envoyes++;
      // Pause anti-spam
      await new Promise(r => setTimeout(r, 2000));

    } catch (err) {
      console.error(`Erreur email ${vendeur.nom}:`, err.message);
      await sb.from('rappels').update({
        statut: 'echec',
        erreur: err.message
      }).eq('id', rappel.id);
      erreurs++;
    }
  }

  console.log(`[CRON EMAILS] ${envoyes} envoyés, ${erreurs} erreurs`);
  res.json({ success: true, envoyes, erreurs, total: rappels?.length || 0 });
}
