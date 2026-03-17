// lib/agents/agent-sms.js
// Agent SMS automatique — Twilio + Claude API
// Usage: node lib/agents/agent-sms.js

const Anthropic = require('@anthropic-ai/sdk');
const twilio = require('twilio');

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

// ── Génération SMS via Claude (max 160 caractères) ────────────────────────────
async function genererSMS(vendeur, bien, type) {
  const contextes = {
    contact:       `premier contact immobilier, propose estimation gratuite`,
    relance_j7:    `relance douce J+7 sans réponse à l'email`,
    relance_j14:   `relance J+14 avec acheteurs qualifiés sur secteur`,
    rappel_rdv:    `rappel du rendez-vous`,
    confirmation:  `confirmation de signature du mandat`
  };

  const prompt = `Tu es un agent immobilier en Normandie.
Écris un SMS de ${contextes[type] || type} pour ${vendeur.prenom || vendeur.nom}.
Bien : ${bien.type_bien || 'maison'} à ${bien.ville || 'Caen'} ${bien.code_postal}.
CONTRAINTES STRICTES :
- Maximum 160 caractères (ABSOLU)
- Pas de guillemets
- Ton professionnel et humain
- Inclure une action claire (rappeler, répondre, etc.)
- Se terminer par "- Farshad, Megagence 07 60 58 56 93"
RÉPONDRE UNIQUEMENT AVEC LE TEXTE DU SMS, rien d'autre.`;

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 100,
    messages: [{ role: 'user', content: prompt }]
  });

  const sms = response.content[0].text.trim();
  // Tronquer à 160 chars par sécurité
  return sms.slice(0, 160);
}

// ── Envoi SMS ─────────────────────────────────────────────────────────────────
async function envoyerSMS(vendeur, bien, type) {
  if (!vendeur.telephone) {
    console.log(`[SMS] Pas de téléphone pour ${vendeur.nom}, skip`);
    return null;
  }

  // Normaliser le numéro français
  let telephone = vendeur.telephone.replace(/\s/g, '');
  if (telephone.startsWith('0')) {
    telephone = '+33' + telephone.slice(1);
  }

  const message = await genererSMS(vendeur, bien, type);

  await twilioClient.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE,
    to: telephone
  });

  console.log(`[SMS ✓] ${type} → ${vendeur.nom} (${telephone})`);
  console.log(`  Message (${message.length} chars): "${message}"`);
  return message;
}

// ── Traitement automatique des rappels SMS en attente ─────────────────────────
async function traiterRappelsSMS() {
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: rappels } = await sb
    .from('rappels')
    .select('*, vendeurs(*, biens(*))')
    .eq('statut', 'en_attente')
    .eq('canal', 'sms')
    .lte('date_envoi_prevu', new Date().toISOString());

  console.log(`[CRON SMS] ${rappels?.length || 0} SMS à traiter`);

  for (const rappel of (rappels || [])) {
    const vendeur = rappel.vendeurs;
    const bien = vendeur?.biens?.[0];
    if (!vendeur || !bien) continue;

    try {
      const message = await envoyerSMS(vendeur, bien, rappel.type_rappel);

      await sb.from('rappels').update({
        statut: 'envoye',
        message_ia: message,
        date_envoi_reel: new Date().toISOString()
      }).eq('id', rappel.id);

      await sb.from('contacts').insert({
        vendeur_id: vendeur.id,
        canal: 'sms',
        type_contact: rappel.type_rappel,
        contenu: message,
        genere_par_ia: true
      });

      // Pause entre SMS (éviter suspension Twilio)
      await new Promise(r => setTimeout(r, 3000));

    } catch (err) {
      console.error(`[SMS ✗] ${vendeur.nom}:`, err.message);
      await sb.from('rappels').update({
        statut: 'echec',
        erreur: err.message
      }).eq('id', rappel.id);
    }
  }
}

module.exports = { genererSMS, envoyerSMS, traiterRappelsSMS };

if (require.main === module) {
  traiterRappelsSMS().then(() => process.exit(0));
}
