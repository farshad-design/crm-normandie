// pages/api/prospects.js
// Recherche de prospects via APIs légales
// DVF, API Adresse gouv.fr, PAP.fr (lecture publique)

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { source, codePostal } = req.query;

  try {
    if (source === 'dvf') {
      // DVF — données officielles ventes immobilières
      const annee = new Date().getFullYear() - 1;
      const url = `https://api.data.gouv.fr/api/1/datasets/5c4ae55a634f4117716d5656/`;
      const r = await fetch(url);
      const data = await r.json();
      return res.json({ source: 'dvf', message: 'DVF disponible', data });
    }

    if (source === 'adresse') {
      // API Adresse — géocodage gratuit
      const { q } = req.query;
      const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(q)}&limit=10`;
      const r = await fetch(url);
      const data = await r.json();
      return res.json(data);
    }

    if (source === 'pap') {
      // PAP.fr — annonces publiques
      const url = `https://www.pap.fr/annonce/ventes-maisons-${codePostal}-g`;
      return res.json({
        source: 'pap',
        url,
        message: 'Ouvrez cette URL pour voir les annonces PAP',
        note: 'Le scraping automatique nécessite une validation manuelle'
      });
    }

    // Retourner les sources disponibles
    res.json({
      sources: [
        { id: 'dvf', nom: 'DVF (officiel)', gratuit: true, description: 'Demandes de Valeurs Foncières — données officielles' },
        { id: 'pap', nom: 'PAP.fr', gratuit: true, description: 'Particulier à Particulier — consultation manuelle' },
        { id: 'adresse', nom: 'API Adresse', gratuit: true, description: 'Géocodage adresses françaises' },
      ],
      note: 'LeBonCoin, SeLoger, Bien Ici, Ouest-France nécessitent une API partenaire payante'
    });
  } catch(e) {
    res.status(500).json({ error: e.message });
  }
}
