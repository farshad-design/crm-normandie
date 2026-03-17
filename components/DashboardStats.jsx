// components/DashboardStats.jsx

const STATUTS = ['detecte', 'contact', 'rdv', 'mandat', 'inactif'];

export default function DashboardStats({ vendeurs: vendeursProp, loading }) {
  const vendeurs = Array.isArray(vendeursProp) ? vendeursProp : [];
  const total = vendeurs.length;
  const parStatut = (s) => vendeurs.filter(v => (v.statut || 'detecte') === s).length;
  const mandats = parStatut('mandat');
  const aRelancer = vendeurs.filter(v => {
    if (!v.dernier_contact) return true;
    const jours = (Date.now() - new Date(v.dernier_contact).getTime()) / 86400000;
    return jours > 7 && v.statut !== 'mandat' && v.statut !== 'archive';
  }).length;
  const scoreHaut = vendeurs.filter(v => (v.score_priorite || 50) > 70).length;

  const metrics = [
    { label: 'Vendeurs actifs',   value: loading ? '...' : total,     sub: 'dans le CRM' },
    { label: 'Mandats signés',    value: loading ? '...' : mandats,   sub: `taux ${total ? Math.round(mandats/total*100) : 0}%` },
    { label: 'À relancer',        value: loading ? '...' : aRelancer, sub: 'sans contact +7j' },
    { label: 'Score élevé (>70)', value: loading ? '...' : scoreHaut, sub: 'priorité haute' },
  ];

  const recentVendeurs = [...vendeurs]
    .sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0))
    .slice(0, 5);

  const couleurStatut = {
    detecte: { bg: '#eff6ff', text: '#1d4ed8', label: 'Détecté' },
    contact: { bg: '#f5f3ff', text: '#7c3aed', label: 'Contacté' },
    rdv:     { bg: '#ecfeff', text: '#0891b2', label: 'RDV' },
    mandat:  { bg: '#f0fdf4', text: '#16a34a', label: 'Mandat' },
    inactif: { bg: '#fef2f2', text: '#dc2626', label: 'Inactif' },
  };

  return (
    <div>
      {/* Métriques */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 20 }}>
        {metrics.map(m => (
          <div key={m.label} style={{
            background: '#f3f4f6', borderRadius: 10, padding: '16px 18px'
          }}>
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 6 }}>{m.label}</div>
            <div style={{ fontSize: 28, fontWeight: 600, color: '#111827' }}>{m.value}</div>
            <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* Pipeline résumé + derniers vendeurs */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>

        {/* Pipeline */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 18 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Pipeline mandats</div>
          {STATUTS.map(s => {
            const n = parStatut(s);
            const pct = total ? Math.round(n / total * 100) : 0;
            const c = couleurStatut[s] || { bg: '#f3f4f6', text: '#6b7280', label: s };
            return (
              <div key={s} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 4 }}>
                  <span style={{ color: '#374151' }}>{c.label}</span>
                  <span style={{ fontWeight: 500, color: '#111827' }}>{n}</span>
                </div>
                <div style={{ height: 6, background: '#f3f4f6', borderRadius: 3, overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: pct + '%', background: c.text, borderRadius: 3, transition: 'width 0.5s' }} />
                </div>
              </div>
            );
          })}
        </div>

        {/* Derniers vendeurs */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 18 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Derniers vendeurs ajoutés</div>
          {loading ? (
            <div style={{ color: '#9ca3af', fontSize: 13 }}>Chargement...</div>
          ) : recentVendeurs.length === 0 ? (
            <div style={{ color: '#9ca3af', fontSize: 13, lineHeight: 1.6 }}>
              Aucun vendeur — connectez Supabase<br/>dans <strong>.env.local</strong>
            </div>
          ) : recentVendeurs.map(v => {
            const bien = v.biens?.[0] || {};
            const s = couleurStatut[v.statut] || couleurStatut.detecte;
            return (
              <div key={v.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 0', borderBottom: '1px solid #f3f4f6'
              }}>
                <div style={{
                  width: 32, height: 32, borderRadius: '50%', background: '#eff6ff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 600, color: '#2563eb', flexShrink: 0
                }}>
                  {(v.prenom?.[0] || v.nom?.[0] || '?').toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: '#111827' }}>{v.prenom} {v.nom}</div>
                  <div style={{ fontSize: 11, color: '#9ca3af', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {bien.adresse || bien.code_postal || '—'}
                  </div>
                </div>
                <span style={{
                  background: s.bg, color: s.text,
                  padding: '2px 8px', borderRadius: 10, fontSize: 10, fontWeight: 600, flexShrink: 0
                }}>{s.label}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
