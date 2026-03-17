// lib/cron.js
// Orchestrateur des agents automatiques (cron)
// Démarrer avec: node lib/cron.js
// En production: PM2 ecosystem ou Railway Cron

const cron = require('node-cron');

const { traiterRappelsEmail } = require('./agents/agent-email');
const { traiterRappelsSMS }   = require('./agents/agent-sms');
const { rescorerTousLesVendeurs } = require('./agents/agent-scoring');

console.log('🤖 CRM Normandie — Agents automatiques démarrés');

// ── Tous les jours à 9h00 : envoi emails de relance ──────────────────────────
cron.schedule('0 9 * * *', async () => {
  console.log(`[${new Date().toISOString()}] CRON — Traitement emails`);
  try {
    await traiterRappelsEmail();
  } catch (err) {
    console.error('Erreur agent email:', err);
  }
}, { timezone: 'Europe/Paris' });

// ── Tous les jours à 10h30 : envoi SMS de rappel ─────────────────────────────
cron.schedule('30 10 * * *', async () => {
  console.log(`[${new Date().toISOString()}] CRON — Traitement SMS`);
  try {
    await traiterRappelsSMS();
  } catch (err) {
    console.error('Erreur agent SMS:', err);
  }
}, { timezone: 'Europe/Paris' });

// ── Tous les lundis à 8h : rescoring de tous les vendeurs ────────────────────
cron.schedule('0 8 * * 1', async () => {
  console.log(`[${new Date().toISOString()}] CRON — Rescoring vendeurs`);
  try {
    await rescorerTousLesVendeurs();
  } catch (err) {
    console.error('Erreur agent scoring:', err);
  }
}, { timezone: 'Europe/Paris' });

// ── Toutes les heures : vérification rappels urgents ─────────────────────────
cron.schedule('0 * * * *', async () => {
  // Vérification silencieuse (pas de log sauf erreur)
  try {
    await traiterRappelsEmail();
    await traiterRappelsSMS();
  } catch (err) {
    console.error('Erreur vérification horaire:', err);
  }
}, { timezone: 'Europe/Paris' });

console.log('⏰ Planification active :');
console.log('   09:00 quotidien  → Emails de relance');
console.log('   10:30 quotidien  → SMS de rappel');
console.log('   08:00 lundi      → Rescoring vendeurs');
console.log('   :00 chaque heure → Vérification rappels urgents');
