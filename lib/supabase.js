// lib/supabase.js
// Toutes les fonctions CRUD pour le CRM Immo Normandie

import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

// Client admin (serveur uniquement, jamais dans le browser)
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// ── VENDEURS ──────────────────────────────────────────────────────────────────

export async function getVendeurs({ statut, codePostal, limit = 100 } = {}) {
  let q = supabase
    .from('vendeurs')
    .select('*, biens(*)')
    .order('score_priorite', { ascending: false })
    .limit(limit);

  if (statut) q = q.eq('statut', statut);
  if (codePostal) q = q.eq('biens.code_postal', codePostal);

  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function getVendeur(id) {
  const { data, error } = await supabase
    .from('vendeurs')
    .select('*, biens(*), contacts(*), rappels(*)')
    .eq('id', id)
    .single();
  if (error) throw error;
  return data;
}

export async function ajouterVendeur(vendeur, bien) {
  // 1. Créer le vendeur
  const { data: v, error: ve } = await supabase
    .from('vendeurs')
    .insert(vendeur)
    .select()
    .single();
  if (ve) throw ve;

  // 2. Géocoder l'adresse si pas de coordonnées
  if (bien.adresse && !bien.latitude) {
    const coords = await geocoderAdresse(bien.adresse + ' ' + bien.code_postal);
    if (coords) { bien.latitude = coords.lat; bien.longitude = coords.lng; }
  }

  // 3. Créer le bien
  const { error: be } = await supabase
    .from('biens')
    .insert({ ...bien, vendeur_id: v.id });
  if (be) throw be;

  // 4. Planifier rappels automatiques J+7, J+14, J+30
  await planifierRappels(v.id);

  return v;
}

export async function updateStatutVendeur(id, statut) {
  const { error } = await supabase
    .from('vendeurs')
    .update({ statut, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function updateScoreVendeur(id, score) {
  const { error } = await supabase
    .from('vendeurs')
    .update({ score_priorite: score })
    .eq('id', id);
  if (error) throw error;
}

// ── BIENS ─────────────────────────────────────────────────────────────────────

export async function getBiensCarte(codesPostaux) {
  const { data, error } = await supabase
    .from('biens')
    .select(`
      id, adresse, code_postal, ville,
      latitude, longitude, prix_demande,
      surface_m2, nb_pieces, type_bien,
      vendeurs (id, nom, prenom, statut, score_priorite, telephone)
    `)
    .in('code_postal', codesPostaux)
    .not('latitude', 'is', null);
  if (error) throw error;
  return data;
}

export async function getBiensZone(latMin, latMax, lngMin, lngMax) {
  const { data, error } = await supabase
    .from('biens')
    .select('*, vendeurs(*)')
    .gte('latitude', latMin)
    .lte('latitude', latMax)
    .gte('longitude', lngMin)
    .lte('longitude', lngMax);
  if (error) throw error;
  return data;
}

// ── CONTACTS (historique) ─────────────────────────────────────────────────────

export async function enregistrerContact(vendeurId, { canal, typeContact, contenu, sujet }) {
  const { error } = await supabase.from('contacts').insert({
    vendeur_id: vendeurId,
    canal,
    type_contact: typeContact,
    sujet,
    contenu,
    genere_par_ia: true,
    date_envoi: new Date().toISOString()
  });
  if (error) throw error;

  // Mettre à jour dernier_contact + nb_contacts du vendeur
  await supabase.from('vendeurs').update({
    dernier_contact: new Date().toISOString(),
    nb_contacts: supabase.rpc('increment', { row_id: vendeurId })
  }).eq('id', vendeurId);
}

// ── RAPPELS automatiques ──────────────────────────────────────────────────────

export async function planifierRappels(vendeurId) {
  const maintenant = Date.now();
  const rappels = [
    { type_rappel: 'j7',  canal: 'email', delaiJours: 7  },
    { type_rappel: 'j14', canal: 'email', delaiJours: 14 },
    { type_rappel: 'j14', canal: 'sms',   delaiJours: 15 },
    { type_rappel: 'j30', canal: 'email', delaiJours: 30 },
  ].map(r => ({
    vendeur_id: vendeurId,
    canal: r.canal,
    type_rappel: r.type_rappel,
    statut: 'en_attente',
    date_envoi_prevu: new Date(maintenant + r.delaiJours * 86400000).toISOString()
  }));

  const { error } = await supabase.from('rappels').insert(rappels);
  if (error) throw error;
}

export async function getRappelsAEnvoyer() {
  const { data, error } = await supabase
    .from('rappels')
    .select('*, vendeurs(*, biens(*))')
    .eq('statut', 'en_attente')
    .lte('date_envoi_prevu', new Date().toISOString())
    .order('date_envoi_prevu');
  if (error) throw error;
  return data;
}

export async function marquerRappelEnvoye(id, messageIA) {
  await supabase.from('rappels').update({
    statut: 'envoye',
    message_ia: messageIA,
    date_envoi_reel: new Date().toISOString()
  }).eq('id', id);
}

// ── MANDATS ───────────────────────────────────────────────────────────────────

export async function creerMandat(bienId, { typeMandat, prixSigne, commissionPct, dateSignature }) {
  const dateExp = new Date(dateSignature);
  dateExp.setFullYear(dateExp.getFullYear() + 1); // 1 an par défaut

  const { data, error } = await supabase.from('mandats').insert({
    bien_id: bienId,
    type_mandat: typeMandat,
    prix_signe: prixSigne,
    commission_pct: commissionPct,
    date_signature: dateSignature,
    date_expiration: dateExp.toISOString().split('T')[0]
  }).select().single();
  if (error) throw error;

  // Mettre à jour statut vendeur
  const { data: bien } = await supabase.from('biens').select('vendeur_id').eq('id', bienId).single();
  if (bien) await updateStatutVendeur(bien.vendeur_id, 'mandat');

  return data;
}

// ── DASHBOARD stats ───────────────────────────────────────────────────────────

export async function getDashboardStats() {
  const { data, error } = await supabase.from('dashboard_stats').select('*').single();
  if (error) throw error;
  return data;
}

// ── GÉOCODAGE adresses françaises ─────────────────────────────────────────────

export async function geocoderAdresse(adresse) {
  try {
    const url = `https://api-adresse.data.gouv.fr/search/?q=${encodeURIComponent(adresse)}&limit=1`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.features?.length > 0) {
      const [lng, lat] = json.features[0].geometry.coordinates;
      return { lat, lng };
    }
  } catch (e) {
    console.error('Geocoding error:', e);
  }
  return null;
}
