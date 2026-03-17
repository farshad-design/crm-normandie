// lib/agents/agent-scoring.js
// Calcul du score de priorité vendeur + conseil IA

const Anthropic = require('@anthropic-ai/sdk');

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Calcul score (0-100) basé sur critères objectifs ─────────────────────────
function calculerScoreBase(vendeur, bien) {
  let score = 40; // base

  // 1. Ancienneté annonce (plus vieille = vendeur plus motivé)
  if (bien.date_publication) {
    const joursDepuis = Math.floor(
      (Date.now() - new Date(bien.date_publication).getTime()) / 86400000
    );
    if (joursDepuis > 60) score += 25;
    else if (joursDepuis > 30) score += 18;
    else if (joursDepuis > 14) score += 10;
    else if (joursDepuis > 7)  score += 5;
  }

  // 2. Réactivité aux contacts précédents
  const nbContacts = vendeur.nb_contacts || 0;
  if (nbContacts === 0) score += 8;      // jamais contacté = opportunité
  else if (nbContacts > 4) score -= 15; // trop de contacts sans réponse

  // 3. Temps de silence depuis dernier contact
  if (vendeur.dernier_contact) {
    const joursSilence = Math.floor(
      (Date.now() - new Date(vendeur.dernier_contact).getTime()) / 86400000
    );
    if (joursSilence > 14) score += 10;
    else if (joursSilence < 3) score -= 10;
  }

  // 4. Prix vs marché (estimation simple par m²)
  if (bien.prix_demande && bien.surface_m2) {
    const prixM2 = bien.prix_demande / bien.surface_m2;
    const prixM2Marche = getPrixM2Marche(bien.code_postal);
    const ecart = (prixM2 - prixM2Marche) / prixM2Marche;
    if (ecart > 0.2)  score -= 12; // surévalué +20% : difficile à vendre seul
    if (ecart < -0.1) score += 10; // sous-évalué : urgent pour le vendeur
  }

  // 5. Type de bien
  if (bien.type_bien === 'maison') score += 5;

  return Math.min(100, Math.max(0, score));
}

// Prix m² de référence par code postal Caen 2024
function getPrixM2Marche(codePostal) {
  const prix = {
    '14000': 2800, '14200': 2200, '14112': 2600,
    '14123': 2400, '14320': 2500, '14460': 2100,
    '14650': 2300, '14760': 2500
  };
  return prix[codePostal] || 2500;
}

// ── Conseil IA personnalisé ───────────────────────────────────────────────────
async function genererConseilIA(vendeur, bien, score) {
  const joursAnnonce = bien.date_publication
    ? Math.floor((Date.now() - new Date(bien.date_publication).getTime()) / 86400000)
    : 0;

  const prompt = `Vendeur immobilier en Normandie, zone ${bien.code_postal}.
Score de priorité : ${score}/100.
Annonce depuis : ${joursAnnonce} jours.
Contacts effectués : ${vendeur.nb_contacts || 0}.
Statut actuel : ${vendeur.statut}.
Prix demandé : ${bien.prix_demande ? bien.prix_demande.toLocaleString('fr-FR') + '€' : 'inconnu'}.
Surface : ${bien.surface_m2 ? bien.surface_m2 + 'm²' : 'inconnue'}.

En 2 phrases courtes et concrètes, donne l'action prioritaire recommandée pour obtenir un mandat.
Commence directement par l'action, pas de formule d'introduction.`;

  const response = await claude.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 120,
    messages: [{ role: 'user', content: prompt }]
  });

  return response.content[0].text.trim();
}

// ── Scorer un vendeur complet ─────────────────────────────────────────────────
async function scorerVendeur(vendeur, bien, avecConseil = true) {
  const score = calculerScoreBase(vendeur, bien);
  const priorite = score > 70 ? 'haute' : score > 40 ? 'moyenne' : 'basse';
  const result = { score, priorite };

  if (avecConseil) {
    result.conseil = await genererConseilIA(vendeur, bien, score);
  }

  return result;
}

// ── Rescorer tous les vendeurs actifs (cron hebdomadaire) ─────────────────────
async function rescorerTousLesVendeurs() {
  const { createClient } = require('@supabase/supabase-js');
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: vendeurs } = await sb
    .from('vendeurs')
    .select('*, biens(*)')
    .not('statut', 'in', '("mandat","archive")');

  console.log(`[SCORING] Rescoring ${vendeurs?.length || 0} vendeurs`);

  for (const vendeur of (vendeurs || [])) {
    const bien = vendeur.biens?.[0];
    if (!bien) continue;

    const { score } = await scorerVendeur(vendeur, bien, false);
    await sb.from('vendeurs')
      .update({ score_priorite: score })
      .eq('id', vendeur.id);

    await new Promise(r => setTimeout(r, 500));
  }

  console.log('[SCORING] Terminé');
}

module.exports = { scorerVendeur, calculerScoreBase, rescorerTousLesVendeurs };

if (require.main === module) {
  rescorerTousLesVendeurs().then(() => process.exit(0));
}
