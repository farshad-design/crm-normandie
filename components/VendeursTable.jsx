// components/VendeursTable.jsx
import { useState } from 'react';

const STATUT_COULEURS = {
  detecte: { bg: '#eff6ff', text: '#1d4ed8', label: 'Detecte' },
  contact: { bg: '#f5f3ff', text: '#7c3aed', label: 'Contacte' },
  rdv:     { bg: '#ecfeff', text: '#0891b2', label: 'RDV fait' },
  mandat:  { bg: '#f0fdf4', text: '#16a34a', label: 'Mandat' },
  inactif: { bg: '#fef2f2', text: '#dc2626', label: 'Inactif' },
};

export default function VendeursTable({ vendeurs: vp2, loading, onRefresh }) {
  const vendeurs = Array.isArray(vp2) ? vp2 : [];
  const [recherche, setRecherche] = useState('');
  const [filtreStatut, setFiltreStatut] = useState('');
  const [filtreCP, setFiltreCP] = useState('');
  const [genEmail, setGenEmail] = useState(null);
  const [emailContenu, setEmailContenu] = useState('');

  const filtres = vendeurs.filter(v => {
    const bien = (v.biens && v.biens[0]) || {};
    const texte = (v.nom + ' ' + (v.prenom || '') + ' ' + (bien.adresse || '') + ' ' + (bien.code_postal || '')).toLowerCase();
    if (recherche && !texte.includes(recherche.toLowerCase())) return false;
    if (filtreStatut && v.statut !== filtreStatut) return false;
    if (filtreCP && bien.code_postal !== filtreCP) return false;
    return true;
  });

  const codesPostaux = [...new Set(vendeurs.map(v => v.biens && v.biens[0] && v.biens[0].code_postal).filter(Boolean))].sort();

  const genererEmail = async (vendeur) => {
    setGenEmail(vendeur.id);
    setEmailContenu('');
    try {
      const bien = (vendeur.biens && vendeur.biens[0]) || {};
      const res = await fetch('/api/generer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ canal: 'email', type: 'premier_contact', vendeur, bien })
      });
      const data = await res.json();
      setEmailContenu(data.contenu || 'Erreur generation');
    } catch (e) {
      setEmailContenu('Erreur reseau');
    }
    setGenEmail(null);
  };

  const inputStyle = {
    padding: '8px 12px', fontSize: 13,
    border: '1px solid #d1d5db', borderRadius: 8,
    background: '#f9fafb', color: '#111827'
  };

  return (
    <div>
      <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}>
        <input
          value={recherche}
          onChange={e => setRecherche(e.target.value)}
          placeholder="Rechercher nom, adresse..."
          style={{ ...inputStyle, flex: 1, minWidth: 200 }}
        />
        <select value={filtreStatut} onChange={e => setFiltreStatut(e.target.value)} style={inputStyle}>
          <option value="">Tous statuts</option>
          {Object.entries(STATUT_COULEURS).map(([k, v]) => (
            <option key={k} value={k}>{v.label}</option>
          ))}
        </select>
        <select value={filtreCP} onChange={e => setFiltreCP(e.target.value)} style={inputStyle}>
          <option value="">Tous codes postaux</option>
          {codesPostaux.map(cp => <option key={cp} value={cp}>{cp}</option>)}
        </select>
        <button onClick={onRefresh} style={{ ...inputStyle, cursor: 'pointer' }}>
          Actualiser
        </button>
      </div>

      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            Chargement...
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                {['Vendeur', 'Bien', 'Prix', 'Code postal', 'Score', 'Statut', 'Action'].map(h => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '10px 14px',
                    fontSize: 11, fontWeight: 600, color: '#6b7280',
                    textTransform: 'uppercase', letterSpacing: '0.04em'
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtres.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: 30, textAlign: 'center', color: '#9ca3af' }}>
                    Aucun vendeur — ajoutez-en via Supabase ou l'API
                  </td>
                </tr>
              ) : filtres.map(v => {
                const bien = (v.biens && v.biens[0]) || {};
                const statut = STATUT_COULEURS[v.statut] || STATUT_COULEURS.detecte;
                const score = v.score_priorite || 50;
                return (
                  <tr key={v.id} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{
                          width: 30, height: 30, borderRadius: '50%',
                          background: '#eff6ff', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: 11, fontWeight: 600, color: '#2563eb'
                        }}>
                          {((v.prenom && v.prenom[0]) || (v.nom && v.nom[0]) || '?').toUpperCase()}
                        </div>
                        <div>
                          <div style={{ fontWeight: 500, color: '#111827' }}>{v.prenom} {v.nom}</div>
                          <div style={{ fontSize: 11, color: '#9ca3af' }}>{v.email || v.telephone || '-'}</div>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '11px 14px', color: '#6b7280', fontSize: 12 }}>
                      {bien.type_bien || 'Maison'} {bien.surface_m2 ? bien.surface_m2 + ' m2' : ''}
                    </td>
                    <td style={{ padding: '11px 14px', fontWeight: 600, color: '#111827' }}>
                      {bien.prix_demande ? bien.prix_demande.toLocaleString('fr-FR') + ' EUR' : '-'}
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ background: '#eff6ff', color: '#2563eb', padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 500 }}>
                        {bien.code_postal || '-'}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ fontWeight: 700, fontSize: 14, color: score > 70 ? '#16a34a' : score > 40 ? '#d97706' : '#dc2626' }}>
                        {score}
                      </span>
                      <span style={{ fontSize: 11, color: '#9ca3af' }}>/100</span>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <span style={{ background: statut.bg, color: statut.text, padding: '3px 9px', borderRadius: 10, fontSize: 11, fontWeight: 500 }}>
                        {statut.label}
                      </span>
                    </td>
                    <td style={{ padding: '11px 14px' }}>
                      <button onClick={() => genererEmail(v)} disabled={genEmail === v.id} style={{
                        padding: '5px 12px', fontSize: 11, borderRadius: 6,
                        background: genEmail === v.id ? '#e5e7eb' : '#2563eb',
                        color: genEmail === v.id ? '#9ca3af' : '#fff',
                        border: 'none', cursor: genEmail === v.id ? 'wait' : 'pointer'
                      }}>
                        {genEmail === v.id ? '...' : 'Email IA'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {emailContenu && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 560, width: '90%', maxHeight: '80vh', overflow: 'auto' }}>
            <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 14 }}>Email genere par Claude</div>
            <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 14, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#111827' }}>
              {emailContenu}
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
              <button onClick={() => navigator.clipboard.writeText(emailContenu)} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 13 }}>
                Copier
              </button>
              <button onClick={() => setEmailContenu('')} style={{ flex: 1, padding: '8px 0', borderRadius: 8, border: 'none', background: '#2563eb', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 }}>
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
