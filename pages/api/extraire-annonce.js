// pages/api/extraire-annonce.js
// Coller le texte d'une annonce → Claude extrait toutes les infos automatiquement

import Anthropic from '@anthropic-ai/sdk';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { texte } = req.body;
  if (!texte) return res.status(400).json({ error: 'Texte manquant' });

  const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    const response = await claude.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{
        role: 'user',
        content: `Extrais les informations de cette annonce immobilière française.
Réponds UNIQUEMENT en JSON valide, rien d'autre, sans markdown.
Format exact :
{
  "nom": "nom du vendeur ou vide",
  "prenom": "prénom ou vide",
  "telephone": "numéro au format 06XXXXXXXX ou vide",
  "email": "email ou vide",
  "adresse": "adresse du bien ou vide",
  "code_postal": "code postal 5 chiffres ou vide",
  "ville": "ville ou vide",
  "prix": "prix en chiffres seuls sans espaces ou vide",
  "surface": "surface en m2 chiffres seuls ou vide",
  "pieces": "nombre de pièces chiffres seuls ou vide",
  "type_bien": "maison ou appartement ou terrain",
  "description": "résumé court du bien en 1 phrase"
}

Annonce :
${texte}`
      }]
    });

    const txt = response.content[0].text.trim();
    const data = JSON.parse(txt);
    res.json({ success: true, data });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
