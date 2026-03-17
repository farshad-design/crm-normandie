// pages/api/biens.js — API biens immobiliers
import { getBiensCarte } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();

  const { cp } = req.query;
  const codesPostaux = cp ? cp.split(',') : ['14000','14112','14123','14200','14320','14460','14650','14760'];

  try {
    const biens = await getBiensCarte(codesPostaux);
    res.json(biens || []);
  } catch (err) {
    console.error(err);
    res.json([]); // Retourner tableau vide si Supabase pas encore configuré
  }
}
