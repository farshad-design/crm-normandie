// pages/api/connecteurs/sync-all.js
// Lance tous les connecteurs en même temps

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { codesPostaux = ['14000'] } = req.body;
  const base = `${req.headers['x-forwarded-proto'] || 'http'}://${req.headers.host}`;

  const resultats = {};
  const connecteurs = [
    { nom: 'leboncoin', actif: !!process.env.LEBONCOIN_CLIENT_ID },
    { nom: 'seloger',   actif: !!process.env.SELOGER_CLIENT_ID },
    { nom: 'bienici',   actif: !!process.env.BIENICI_API_KEY },
  ];

  for (const c of connecteurs) {
    if (!c.actif) { resultats[c.nom] = { skipped: true, message: 'Clé API non configurée' }; continue; }
    try {
      const r = await fetch(`${base}/api/connecteurs/${c.nom}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codesPostaux })
      });
      resultats[c.nom] = await r.json();
    } catch(e) { resultats[c.nom] = { error: e.message }; }
  }

  const totalAjoutes = Object.values(resultats).reduce((s, r) => s + (r.ajoutes || 0), 0);
  res.json({ success: true, totalAjoutes, resultats });
}
