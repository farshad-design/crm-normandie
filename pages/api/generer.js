// pages/api/generer.js — Génération email/SMS via Claude
import Anthropic from '@anthropic-ai/sdk';

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { type, vendeur, bien, canal } = req.body;

  try {
    if (canal === 'email') {
      const { genererEmail } = await import('../../lib/agents/agent-email');
      const email = await genererEmail(vendeur, bien, type);
      return res.json({ contenu: email });
    }

    if (canal === 'sms') {
      const { genererSMS } = await import('../../lib/agents/agent-sms');
      const sms = await genererSMS(vendeur, bien, type);
      return res.json({ contenu: sms, longueur: sms.length });
    }

    if (canal === 'scoring') {
      const { scorerVendeur } = await import('../../lib/agents/agent-scoring');
      const result = await scorerVendeur(vendeur, bien);
      return res.json(result);
    }

    res.status(400).json({ error: 'Canal inconnu' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
}
