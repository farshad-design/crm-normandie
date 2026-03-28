// lib/agents/agent-email.js
const Anthropic = require('@anthropic-ai/sdk');
const nodemailer = require('nodemailer');

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

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

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp-relay.brevo.com',
  port: parseInt(process.env.SMTP_PORT || '587'),
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

const PROMPTS = {
  premier_contact: (v, b) => `
Tu es ${AGENT.nom}, conseiller immobilier chez ${AGENT.agence} en Normandie.
Ecris un email de premier contact pour ${v.prenom || v.nom} ${v.nom}
qui vend ${b.type_bien || 'sa maison'} au ${b.adresse}, ${b.code_postal} ${b.ville || 'Caen'}
(prix demande : ${b.prix_demande ? b.prix_demande.toLocaleString('fr-FR') + ' EUR' : 'non precise'}).
Objectif : decrocher un rendez-vous pour une estimation gratuite.
130 mots maximum. Commence par "Bonjour ${v.prenom || v.nom},"
Termine par cette signature : ${SIGNATURE}`,

  relance_j7: (v, b) => `
Tu es ${AGENT.nom} chez ${AGENT.agence}.
Email relance J+7 pour ${v.prenom || v.nom} ${v.nom}, bien a ${b.code_postal} ${b.ville || 'Caen'}.
100 mots max. Commence par "Bonjour ${v.prenom || v.nom},"
Termine par : ${SIGNATURE}`,

  relance_j14: (v, b) => `
Tu es ${AGENT.nom} chez ${AGENT.agence}.
Email relance J+14 pour ${v.prenom || v.nom} ${v.nom}, bien a ${b.code_postal}.
Cree urgence douce. 100 mots max. Commence par "Bonjour ${v.prenom || v.nom},"
Termine par : ${SIGNATURE}`,

  relance_j30: (v, b) => `
Tu es ${AGENT.nom} chez ${AGENT.agence}.
Email final J+30 pour ${v.prenom || v.nom} ${v.nom}.
Ton sincere. 80 mots max. Commence par "Bonjour ${v.prenom || v.nom},"
Termine par : ${SIGNATURE}`
};

const SUJETS = {
  premier_contact: (b) => `Votre bien au ${b.code_postal} - Estimation gratuite`,
  relance_j7:      (b) => `Suite a notre echange - ${b.ville || 'Caen'}`,
  relance_j14:     (b) => `Acheteurs disponibles sur ${b.code_postal}`,
  relance_j30:     (b) => `Fermeture de dossier - ${b.adresse}`
};

async function genererEmail(vendeur, bien, typeRelance) {
  const promptFn = PROMPTS[typeRelance];
  if (!promptFn) throw new Error('Type inconnu : ' + typeRelance);
  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    messages: [{ role: 'user', content: promptFn(vendeur, bien) }]
  });
  return response.content[0].text.trim();
}

async function envoyerEmail(vendeur, bien, typeRelance) {
  if (!vendeur.email) return null;
  const corps = await genererEmail(vendeur, bien, typeRelance);
  const sujet = SUJETS[typeRelance]?.(bien) || 'Votre bien immobilier en Normandie';
  await transporter.sendMail({
    from: '"' + AGENT.nom + ' - ' + AGENT.agence + '" <' + AGENT.email + '>',
    to: vendeur.email,
    subject: sujet,
    text: corps,
    html: corps.replace(/\n/g, '<br>')
  });
  console.log('[EMAIL OK] ' + typeRelance + ' -> ' + vendeur.nom);
  return corps;
}

async function traiterRappelsEmail() {
  const { createClient } = require('@supabase/supabase-js');
  
  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  if (!supabaseUrl) throw new Error('SUPABASE_URL manquant');
  if (!supabaseKey) throw new Error('SUPABASE_SERVICE_KEY manquant');
  
  const sb = createClient(supabaseUrl, supabaseKey);
  
  const { data: rappels, error } = await sb
    .from('rappels')
    .select('*, vendeurs(*, biens(*))')
    .eq('statut', 'en_attente')
    .eq('canal', 'email')
    .lte('date_envoi_prevu', new Date().toISOString());

  if (error) throw new Error('Supabase error: ' + error.message);
  
  console.log('[CRON] ' + (rappels?.length || 0) + ' emails a traiter');

  for (const rappel of (rappels || [])) {
    const vendeur = rappel.vendeurs;
    const bien = vendeur?.biens?.[0];
    if (!vendeur || !bien) continue;
    try {
      // ✅ CORRECTION : appel à envoyerEmail et récupération du message
      const message = await envoyerEmail(vendeur, bien, rappel.type_rappel);

      if (message) {
        await sb.from('rappels').update({
          statut: 'envoye',
          message_ia: message,
          date_envoi_reel: new Date().toISOString()
        }).eq('id', rappel.id);
        await sb.from('contacts').insert({
          vendeur_id: vendeur.id,
          canal: 'email',
          type_contact: rappel.type_rappel,
          contenu: message,
          genere_par_ia: true
        });
        await sb.from('vendeurs').update({
          dernier_contact: new Date().toISOString()
        }).eq('id', vendeur.id);
      }
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error('[EMAIL ERREUR] ' + vendeur.nom + ': ' + err.message);
      await sb.from('rappels').update({
        statut: 'echec',
        erreur: err.message
      }).eq('id', rappel.id);
    }
  }
  
  console.log('[CRON] Termine');
}

module.exports = { genererEmail, envoyerEmail, traiterRappelsEmail };

if (require.main === module) {
  traiterRappelsEmail()
    .then(() => process.exit(0))
    .catch(err => { console.error(err.message); process.exit(1); });
}
