// pages/api/auto-prospects.js
// Détection automatique gratuite via API DVF + API Adresse (données officielles)

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { codesPostaux } = req.body;
  if (!codesPostaux?.length) return res.status(400).json({ error: 'Codes postaux manquants' });

  const { createClient } = await import('@supabase/supabase-js');
  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  const prospects = [];

  for (const cp of codesPostaux.slice(0, 5)) {
    try {
      // API DVF — ventes récentes officielles
      const dept = cp.slice(0, 2);
      const url = `https://api.dvf.etalab.gouv.fr/geoapi/mutations/?code_postal=${cp}&nature_mutation=Vente&type_local=Maison&page_size=20`;
      const r = await fetch(url);
      if (!r.ok) continue;
      const data = await r.json();

      for (const vente of (data.results || data.features || [])) {
        const props = vente.properties || vente;
        if (!props.l_adresse && !props.adresse_numero) continue;

        // Construire l'adresse
        const adresse = [
          props.l_adresse || `${props.adresse_numero || ''} ${props.adresse_nom_voie || ''}`.trim(),
          props.l_codinsee ? '' : cp
        ].filter(Boolean).join(', ');

        const prix = props.valeur_fonciere || props.prix;
        const surface = props.surface_reelle_bati || props.surface;

        if (adresse && prix) {
          prospects.push({
            adresse: adresse.trim(),
            code_postal: cp,
            ville: props.l_commune || props.nom_commune || '',
            prix_demande: parseInt(prix),
            surface_m2: surface ? parseInt(surface) : null,
            type_bien: 'maison',
            source: 'dvf_officiel',
            date_mutation: props.date_mutation,
            latitude: vente.geometry?.coordinates?.[1] || null,
            longitude: vente.geometry?.coordinates?.[0] || null,
          });
        }
      }
    } catch(e) {
      console.error(`DVF erreur ${cp}:`, e.message);
    }
  }

  // Ajouter dans Supabase comme biens détectés (sans vendeur nominatif — DVF anonymise)
  let ajoutes = 0;
  for (const p of prospects.slice(0, 50)) {
    try {
      // Créer vendeur anonyme "Propriétaire DVF"
      const { data: v } = await sb.from('vendeurs').insert({
        nom: 'Propriétaire',
        prenom: 'DVF',
        statut: 'detecte',
        score_priorite: 60,
        source: 'dvf_officiel',
        notes: `Vente enregistrée le ${p.date_mutation || 'récemment'} — données DVF officielles`
      }).select().single();

      if (v) {
        await sb.from('biens').insert({
          vendeur_id: v.id,
          adresse: p.adresse,
          code_postal: p.code_postal,
          ville: p.ville,
          prix_demande: p.prix_demande,
          surface_m2: p.surface_m2,
          type_bien: p.type_bien,
          latitude: p.latitude,
          longitude: p.longitude,
        });
        ajoutes++;
      }
    } catch(e) {}
  }

  res.json({
    success: true,
    trouves: prospects.length,
    ajoutes,
    message: `${prospects.length} ventes DVF trouvées, ${ajoutes} ajoutées au CRM`,
    note: 'DVF anonymise les vendeurs — les noms/téléphones ne sont pas disponibles gratuitement'
  });
}
