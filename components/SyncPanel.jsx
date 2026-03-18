// components/SyncPanel.jsx
// Panneau de synchronisation automatique
import { useState } from 'react';
import { CODES_POSTAUX } from '../lib/codes-postaux';

const CONNECTEURS = [
  { id: 'leboncoin', nom: 'LeBonCoin Pro', envVar: 'LEBONCOIN_CLIENT_ID', couleur: '#f97316', description: 'Annonces particuliers + pros' },
  { id: 'seloger',   nom: 'SeLoger Pro',   envVar: 'SELOGER_CLIENT_ID',   couleur: '#2563eb', description: 'Flux XML annonces' },
  { id: 'bienici',   nom: 'Bien Ici Pro',  envVar: 'BIENICI_API_KEY',      couleur: '#7c3aed', description: 'API annonces immobilières' },
];

export default function SyncPanel() {
  const [zones, setZones] = useState(['14000','14112','14123','14200']);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [cpInput, setCpInput] = useState('');

  const ajouterZone = () => {
    if (cpInput && !zones.includes(cpInput)) {
      setZones(p => [...p, cpInput]);
      setCpInput('');
    }
  };

  const syncAll = async () => {
    setLoading(true); setResult(null);
    try {
      const r = await fetch('/api/connecteurs/sync-all', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codesPostaux: zones })
      });
      const d = await r.json();
      setResult(d);
      if (d.totalAjoutes > 0) setTimeout(() => window.location.reload(), 3000);
    } catch(e) { setResult({ error: e.message }); }
    setLoading(false);
  };

  const syncOne = async (id) => {
    setLoading(true); setResult(null);
    try {
      const r = await fetch(`/api/connecteurs/${id}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codesPostaux: zones })
      });
      const d = await r.json();
      setResult({ resultats: { [id]: d }, totalAjoutes: d.ajoutes || 0 });
      if (d.ajoutes > 0) setTimeout(() => window.location.reload(), 3000);
    } catch(e) { setResult({ error: e.message }); }
    setLoading(false);
  };

  return (
    <div style={{ fontFamily: 'system-ui' }}>

      {/* CONFIG RAPIDE */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 18, marginBottom: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Synchronisation automatique</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 1.6 }}>
          Connectez vos comptes pro pour importer automatiquement toutes les nouvelles annonces dans votre CRM.
        </div>

        {/* Statut connecteurs */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 16 }}>
          {CONNECTEURS.map(c => (
            <div key={c.id} style={{ border: `2px solid ${c.couleur}22`, borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: c.couleur, marginBottom: 4 }}>{c.nom}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>{c.description}</div>
              <div style={{ fontSize: 11, marginBottom: 8 }}>
                <span style={{ background: '#fef2f2', color: '#dc2626', padding: '2px 8px', borderRadius: 10 }}>
                  Clé requise : {c.envVar}
                </span>
              </div>
              <button onClick={() => syncOne(c.id)} disabled={loading} style={{
                width: '100%', padding: '6px 0', borderRadius: 6, border: 'none',
                background: loading ? '#e5e7eb' : c.couleur, color: 'white',
                fontSize: 11, fontWeight: 500, cursor: loading ? 'wait' : 'pointer'
              }}>
                {loading ? '...' : 'Synchroniser'}
              </button>
            </div>
          ))}
        </div>

        {/* Zones */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 8 }}>Zones à synchroniser</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
            {zones.map(cp => {
              const z = CODES_POSTAUX.find(z => z.cp === cp);
              return (
                <span key={cp} style={{ padding: '3px 10px', borderRadius: 14, fontSize: 11, background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', gap: 4 }}>
                  {cp} {z?.ville || ''}
                  <button onClick={() => setZones(p => p.filter(z => z !== cp))} style={{ border: 'none', background: 'none', cursor: 'pointer', color: '#93c5fd', fontSize: 13, padding: 0 }}>×</button>
                </span>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input value={cpInput} onChange={e => setCpInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && ajouterZone()} placeholder="Ajouter un CP (ex: 14000)" style={{ flex: 1, padding: '7px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: '#f9fafb', color: '#111827' }}/>
            <button onClick={ajouterZone} style={{ padding: '7px 14px', borderRadius: 6, border: 'none', background: '#185FA5', color: 'white', fontSize: 12, cursor: 'pointer' }}>+</button>
          </div>
        </div>

        {/* Bouton sync tout */}
        <button onClick={syncAll} disabled={loading} style={{
          width: '100%', padding: '12px 0', borderRadius: 8, border: 'none',
          fontSize: 14, fontWeight: 600, cursor: loading ? 'wait' : 'pointer',
          background: loading ? '#9ca3af' : '#185FA5', color: 'white'
        }}>
          {loading ? 'Synchronisation en cours...' : 'Synchroniser TOUT (LeBonCoin + SeLoger + Bien Ici)'}
        </button>

        {result && (
          <div style={{ marginTop: 12, background: result.error ? '#fef2f2' : '#f0fdf4', border: `1px solid ${result.error ? '#fecaca' : '#bbf7d0'}`, borderRadius: 8, padding: 14 }}>
            {result.error ? (
              <div style={{ color: '#dc2626', fontSize: 13 }}>Erreur : {result.error}</div>
            ) : (
              <div>
                <div style={{ fontWeight: 600, color: '#15803d', fontSize: 14, marginBottom: 8 }}>
                  {result.totalAjoutes > 0 ? `✓ ${result.totalAjoutes} prospects ajoutés !` : 'Synchronisation terminée'}
                </div>
                {Object.entries(result.resultats || {}).map(([nom, r]) => (
                  <div key={nom} style={{ fontSize: 12, color: '#374151', marginBottom: 4 }}>
                    <strong>{nom}</strong> : {r.skipped ? '⚠️ Clé non configurée' : r.error ? `❌ ${r.error}` : `✓ ${r.ajoutes || 0} ajoutés`}
                  </div>
                ))}
                {result.totalAjoutes > 0 && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>Rechargement dans 3 secondes...</div>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* GUIDE CONFIG */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 18, marginBottom: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Configuration des clés API</div>
        <div style={{ fontSize: 13, color: '#374151', marginBottom: 12, lineHeight: 1.7 }}>
          Ajoutez ces variables dans votre fichier <code style={{ background: '#f3f4f6', padding: '1px 6px', borderRadius: 4 }}>.env.local</code> et sur <strong>Vercel → Settings → Environment Variables</strong> :
        </div>
        <div style={{ background: '#1e293b', borderRadius: 8, padding: 14, fontFamily: 'monospace', fontSize: 12, lineHeight: 2, color: '#e2e8f0', marginBottom: 12 }}>
          <span style={{ color: '#94a3b8' }}># LeBonCoin Pro</span><br/>
          <span style={{ color: '#7dd3fc' }}>LEBONCOIN_CLIENT_ID</span>=<span style={{ color: '#86efac' }}>votre_client_id</span><br/>
          <span style={{ color: '#7dd3fc' }}>LEBONCOIN_CLIENT_SECRET</span>=<span style={{ color: '#86efac' }}>votre_client_secret</span><br/>
          <br/>
          <span style={{ color: '#94a3b8' }}># SeLoger Pro</span><br/>
          <span style={{ color: '#7dd3fc' }}>SELOGER_CLIENT_ID</span>=<span style={{ color: '#86efac' }}>votre_login_api</span><br/>
          <span style={{ color: '#7dd3fc' }}>SELOGER_CLIENT_SECRET</span>=<span style={{ color: '#86efac' }}>votre_password_api</span><br/>
          <br/>
          <span style={{ color: '#94a3b8' }}># Bien Ici Pro</span><br/>
          <span style={{ color: '#7dd3fc' }}>BIENICI_API_KEY</span>=<span style={{ color: '#86efac' }}>votre_api_key</span>
        </div>
        <div style={{ fontSize: 12, color: '#6b7280', lineHeight: 1.7 }}>
          Une fois ajoutées → <code>vercel --prod</code> → revenez ici et cliquez "Synchroniser TOUT"
        </div>
      </div>

      {/* GOOGLE ALERTS */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 18 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Google Alerts — Détection automatique gratuite</div>
        <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 14, lineHeight: 1.7 }}>
          Google Alerts surveille PAP.fr et d'autres sites en continu. Chaque nouvelle annonce vous est envoyée par email automatiquement.
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 14 }}>
          {[
            { label: 'Maisons Caen', url: 'https://www.google.com/alerts#1:1', query: 'maison vendre Caen 14000 site:pap.fr' },
            { label: 'Maisons Normandie', url: 'https://www.google.com/alerts#1:1', query: 'maison vendre 14000 OR 14112 OR 14123 site:pap.fr OR site:leboncoin.fr' },
            { label: 'Appartements Caen', url: 'https://www.google.com/alerts#1:1', query: 'appartement vendre Caen 14000 site:pap.fr' },
          ].map((a, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 10 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 13, color: '#111827', marginBottom: 2 }}>{a.label}</div>
                <code style={{ fontSize: 11, color: '#6b7280' }}>{a.query}</code>
              </div>
              <a href={`https://www.google.com/alerts?q=${encodeURIComponent(a.query)}`} target="_blank" rel="noreferrer" style={{ padding: '6px 12px', borderRadius: 6, background: '#4285f4', color: 'white', fontSize: 11, fontWeight: 500, textDecoration: 'none', whiteSpace: 'nowrap' }}>
                Créer l'alerte →
              </a>
            </div>
          ))}
        </div>
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 12, fontSize: 12, color: '#1e40af', lineHeight: 1.7 }}>
          <strong>Comment utiliser :</strong><br/>
          1. Cliquez "Créer l'alerte" → connectez-vous avec votre Gmail<br/>
          2. Choisissez fréquence : <strong>"Au fur et à mesure"</strong><br/>
          3. Email de réception : <strong>farshad.sahraei@megagence.com</strong><br/>
          4. Quand vous recevez un email Google Alert → copiez son contenu → onglet "Coller une annonce (IA)" → ajout automatique !
        </div>
      </div>
    </div>
  );
}
