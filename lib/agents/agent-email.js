// lib/agents/agent-email.js
const Anthropic = require('@anthropic-ai/sdk');
const nodemailer = require('nodemailer');

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Coordonnées agent
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
Écris un email de premier contact pour ${v.prenom || v.nom} ${v.nom}
qui vend ${b.type_bien || 'sa maison'} au ${b.adresse}, ${b.code_postal} ${b.ville || 'Caen'}
(prix demandé : ${b.prix_demande ? b.prix_demande.toLocaleString('fr-FR') + ' €' : 'non précisé'},
surface : ${b.surface_m2 ? b.surface_m2 + ' m²' : 'non précisée'}).
Objectif : décrocher un rendez-vous pour une estimation gratuite.
Ton : professionnel, chaleureux, pas de pression. 130 mots maximum.
Commence par "Bonjour ${v.prenom || v.nom},"
Termine OBLIGATOIREMENT par cette signature exacte :
${SIGNATURE}`,

  relance_j7: (v, b) => `
Tu es ${AGENT.nom}, conseiller immobilier chez ${AGENT.agence}.
Email de relance douce J+7 pour ${v.prenom || v.nom} ${v.nom},
vendeur d'un bien à ${b.code_postal} ${b.ville || 'Caen'}.
Rappelle ton contact précédent, propose une estimation gratuite,
mentionne des acheteurs actifs sur le secteur ${b.code_postal}.
Ton : bienveillant, patient. 100 mots maximum.
Commence par "Bonjour ${v.prenom || v.nom},"
Termine OBLIGATOIREMENT par cette signature exacte :
${SIGNATURE}`,

  relance_j14: (v, b) => `
Tu es ${AGENT.nom}, conseiller immobilier chez ${AGENT.agence}.
Email de relance J+14 pour ${v.prenom || v.nom} ${v.nom}, bien à ${b.ville || 'Caen'} ${b.code_postal}.
Crée une légère urgence : acheteurs pré-qualifiés, marché favorable.
Propose un créneau de 20 minutes sans engagement.
100 mots maximum. Commence par "Bonjour ${v.prenom || v.nom},"
Termine OBLIGATOIREMENT par cette signature exacte :
${SIGNATURE}`,

  relance_j30: (v, b) => `
Tu es ${AGENT.nom}, conseiller immobilier chez ${AGENT.agence}.
Email final J+30 pour ${v.prenom || v.nom} ${v.nom}, bien à ${b.code_postal}.
Ton sincère et respectueux. Informe que tu vas clôturer le dossier
mais que la porte reste ouverte.
80 mots maximum. Commence par "Bonjour ${v.prenom || v.nom},"
Termine OBLIGATOIREMENT par cette signature exacte :
${SIGNATURE}`,

  confirmation_rdv: (v, rdv) => `
Tu es ${AGENT.nom}, conseiller immobilier chez ${AGENT.agence}.
Email de confirmation de rendez-vous pour ${v.prenom || v.nom} ${v.nom}.
RDV prévu le ${rdv ? rdv.date : 'prochainement'}.
Rappelle ce qui sera fait : estimation, présentation des services.
80 mots max. Professionnel et rassurant.
Termine OBLIGATOIREMENT par cette signature exacte :
${SIGNATURE}`
};

const SUJETS = {
  premier_contact: (b) => `Votre bien au ${b.code_postal} — Estimation gratuite`,
  relance_j7:      (b) => `Suite à notre échange — ${b.ville || 'Caen'} ${b.code_postal}`,
  relance_j14:     (b) => `Acheteurs disponibles sur ${b.code_postal}`,
  relance_j30:     (b) => `Fermeture de dossier — ${b.adresse}`,
  confirmation_rdv: ()  => `Confirmation de votre rendez-vous`
};

async function genererEmail(vendeur, bien, typeRelance, optData = {}) {
  const promptFn = PROMPTS[typeRelance];
  if (!promptFn) throw new Error(`Type inconnu : ${typeRelance}`);
  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 600,
    messages: [{ role: 'user', content: promptFn(vendeur, bien, optData) }]
  });
  return response.content[0].text.trim();
}

async function envoyerEmail(vendeur, bien, typeRelance, optData = {}) {
  if (!vendeur.email) return null;
  const corps = await genererEmail(vendeur, bien, typeRelance, optData);
  const sujet = SUJETS[typeRelance]?.(bien) || 'Votre bien immobilier en Normandie';
  await transporter.sendMail({
    from: `"${AGENT.nom} — ${AGENT.agence}" <${AGENT.email}>`,
    to: vendeur.email,
    subject: sujet,
    text: corps,
    html: corps.replace(/\n/g, '<br>')
  });
  console.log(`[EMAIL ✓] ${typeRelance} → ${vendeur.nom}`);
  return corps;
}

async function traiterRappelsEmail() {
  const { createClient } = require('@supabase/supabase-js');
 const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
  const { data: rappels } = await sb
    .from('rappels').select('*, vendeurs(*, biens(*))')
    .eq('statut', 'en_attente').eq('canal', 'email')
    .lte('date_envoi_prevu', new Date().toISOString());
  for (const rappel of (rappels || [])) {
    const vendeur = rappel.vendeurs;
    const bien = vendeur?.biens?.[0];
    if (!vendeur || !bien) continue;
    try {
      const message = await envoyerEmail(vendeur, bien, rappel.type_rappel);
      await sb.from('rappels').update({ statut: 'envoye', message_ia: message, date_envoi_reel: new Date().toISOString() }).eq('id', rappel.id);
      await sb.from('contacts').insert({ vendeur_id: vendeur.id, canal: 'email', type_contact: rappel.type_rappel, contenu: message, genere_par_ia: true });
      await sb.from('vendeurs').update({ dernier_contact: new Date().toISOString() }).eq('id', vendeur.id);
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      await sb.from('rappels').update({ statut: 'echec', erreur: err.message }).eq('id', rappel.id);
    }
  }
}

module.exports = { genererEmail, envoyerEmail, traiterRappelsEmail };
if (require.main === module) { traiterRappelsEmail().then(() => process.exit(0)); }
