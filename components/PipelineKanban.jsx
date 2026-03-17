// components/PipelineKanban.jsx
import { useState } from 'react';

const COLONNES = [
  { id: 'detecte', label: 'Biens detectes',  couleur: '#2563eb', bg: '#eff6ff' },
  { id: 'contact', label: 'Contact etabli',  couleur: '#7c3aed', bg: '#f5f3ff' },
  { id: 'rdv',     label: 'RDV effectue',    couleur: '#0891b2', bg: '#ecfeff' },
  { id: 'mandat',  label: 'Mandat signe',    couleur: '#16a34a', bg: '#f0fdf4' },
];

export default function PipelineKanban({ vendeurs: vp, onUpdate }) {
  const vendeurs = Array.isArray(vp) ? vp : [];
  const [loading, setLoading] = useState(null);

  const parStatut = (statut) => vendeurs.filter(v => (v.statut || 'detecte') === statut);

  const changerStatut = async (vendeurId, nouveauStatut) => {
    setLoading(vendeurId);
    try {
      await fetch('/api/vendeurs', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: vendeurId, statut: nouveauStatut })
      });
      if (onUpdate) onUpdate();
    } catch (e) {
      alert('Erreur mise a jour');
    }
    setLoading(null);
  };

  return (
    <div style={{ overflowX: 'auto', paddingBottom: 8 }}>
      <div style={{ display: 'flex', gap: 14, minWidth: 800 }}>
        {COLONNES.map((col, idx) => {
          const items = parStatut(col.id);
          return (
            <div key={col.id} style={{ flex: 1, minWidth: 200 }}>
              <div style={{
                background: col.bg,
                borderRadius: 8,
                padding: '8px 12px',
                marginBottom: 10,
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                border: '1px solid ' + col.couleur + '33'
              }}>
                <span style={{ fontSize: 12, fontWeight: 600, color: col.couleur }}>
                  {col.label}
                </span>
                <span style={{
                  fontSize: 11,
                  background: col.couleur,
                  color: 'white',
                  borderRadius: 10,
                  padding: '1px 8px',
                  fontWeight: 600
                }}>
                  {items.length}
                </span>
              </div>

              {items.map(v => {
                const bien = (v.biens && v.biens[0]) || {};
                return (
                  <div key={v.id} style={{
                    background: '#fff',
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    padding: 12,
                    marginBottom: 8,
                    opacity: loading === v.id ? 0.5 : 1
                  }}>
                    <div style={{ fontWeight: 600, fontSize: 13, color: '#111827', marginBottom: 3 }}>
                      {v.prenom} {v.nom}
                    </div>
                    <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 8 }}>
                      {bien.adresse || 'Adresse inconnue'}
                      <br />
                      {bien.code_postal || ''} {bien.ville || ''}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 10 }}>
                      <span style={{ color: '#6b7280' }}>
                        {bien.surface_m2 ? bien.surface_m2 + ' m2' : '-'}
                      </span>
                      <span style={{ fontWeight: 600, color: '#111827' }}>
                        {bien.prix_demande ? bien.prix_demande.toLocaleString('fr-FR') + ' EUR' : '-'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {idx > 0 && (
                        <button
                          onClick={() => changerStatut(v.id, COLONNES[idx - 1].id)}
                          style={{
                            flex: 1, padding: '5px 0', fontSize: 11, borderRadius: 6,
                            border: '1px solid #d1d5db', background: '#f9fafb',
                            cursor: 'pointer', color: '#374151'
                          }}
                        >
                          Reculer
                        </button>
                      )}
                      {idx < COLONNES.length - 1 && (
                        <button
                          onClick={() => changerStatut(v.id, COLONNES[idx + 1].id)}
                          style={{
                            flex: 1, padding: '5px 0', fontSize: 11, borderRadius: 6,
                            border: 'none', background: col.couleur,
                            cursor: 'pointer', color: 'white', fontWeight: 500
                          }}
                        >
                          Avancer
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}

              {items.length === 0 && (
                <div style={{
                  border: '1px dashed #d1d5db',
                  borderRadius: 8,
                  padding: '20px 12px',
                  textAlign: 'center',
                  fontSize: 12,
                  color: '#9ca3af'
                }}>
                  Aucun vendeur
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
