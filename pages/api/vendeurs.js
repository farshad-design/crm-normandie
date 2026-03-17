// pages/api/vendeurs.js
import { createClient } from '@supabase/supabase-js';

export default async function handler(req, res) {
  // Vérifier les variables d'environnement
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || url.includes('XXXXXX') || !key || key.includes('VOTRE')) {
    return res.status(200).json({
      erreur: 'SUPABASE_NON_CONFIGURE',
      message: 'Les clés Supabase ne sont pas remplies dans .env.local',
      url_recue: url || 'VIDE',
    });
  }

  try {
    const supabase = createClient(url, key);

    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('vendeurs')
        .select('*, biens(*)')
        .order('score_priorite', { ascending: false })
        .limit(100);

      if (error) {
        return res.status(200).json({
          erreur: 'SUPABASE_ERREUR',
          message: error.message,
          details: error
        });
      }

      return res.json(data || []);
    }

    if (req.method === 'PATCH') {
      const { id, statut } = req.body;
      const { error } = await supabase
        .from('vendeurs')
        .update({ statut, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) return res.status(500).json({ error: error.message });
      return res.json({ success: true });
    }

    if (req.method === 'POST') {
      const { vendeur, bien } = req.body;
      const { data: v, error: ve } = await supabase
        .from('vendeurs').insert(vendeur).select().single();
      if (ve) return res.status(500).json({ error: ve.message });
      if (bien) {
        await supabase.from('biens').insert({ ...bien, vendeur_id: v.id });
      }
      return res.status(201).json(v);
    }

    res.status(405).json({ error: 'Méthode non autorisée' });
  } catch (err) {
    return res.status(200).json({
      erreur: 'EXCEPTION',
      message: err.message
    });
  }
}
