// components/AgentsPanel.jsx
import { useState } from 'react';

export default function AgentsPanel({ vendeurs: vp3 }) {
  const vendeurs = Array.isArray(vp3) ? vp3 : [];
  const [emailInput, setEmailInput] = useState({ nom: 'Martin Laurent', adresse: '14 rue de la Paix, 14000 Caen', prix: '285000', type: 'premier_contact' });
  const [smsInput, setSmsInput] = useState({ prenom: 'Bernard', ville: 'Caen', cp: '14000', type: 'contact' });
  const [emailResult, setEmailResult] = useState('');
  const [smsResult, setSmsResult] = useState('');
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [loadingSMS, setLoadingSMS] = useState(false);
  const [log] = useState([
    { time: '09:42', tag: 'EMAIL', msg: 'Relance J+7 — Martin L. (14000)' },
    { time: '09:15', tag: 'SMS',   msg: 'Rappel RDV — Dubois B. (14112)' },
    { time: '08:50', tag: 'SCAN',  msg: '3 nouvelles annonces — PAP 14460' },
    { time: '08:30', tag: 'SCORE', msg: '8 vendeurs re-scores automatiquement' },
    { time: '07:00', tag: 'EMAIL', msg: 'Campagne matinale — 12 emails envoyes' },
  ]);

  const genEmail = async () => {
    setLoadingEmail(true);
    setEmailResult('');
    try {
      const res = await fetch('/api/generer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canal: 'email',
          type: emailInput.type,
          vendeur: { nom: emailInput.nom, prenom: emailInput.nom.split(' ')[0] },
          bien: { adresse: emailInput.adresse, prix_demande: parseInt(emailInput.prix), code_postal: '14000', ville: 'Caen' }
        })
      });
      const d = await res.json();
      setEmailResult(d.contenu || d.error || 'Erreur');
    } catch (e) {
      setEmailResult('Erreur reseau — verifiez ANTHROPIC_API_KEY dans .env.local');
    }
    setLoadingEmail(false);
  };

  const genSMS = async () => {
    setLoadingSMS(true);
    setSmsResult('');
    try {
      const res = await fetch('/api/generer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          canal: 'sms',
          type: smsInput.type,
          vendeur: { prenom: smsInput.prenom, nom: '' },
          bien: { ville: smsInput.ville, code_postal: smsInput.cp, type_bien: 'maison' }
        })
      });
      const d = await res.json();
      setSmsResult(d.contenu || d.error || 'Erreur');
    } catch (e) {
      setSmsResult('Erreur reseau');
    }
    setLoadingSMS(false);
  };

  const tagColor = { EMAIL: '#2563eb', SMS: '#16a34a', SCAN: '#d97706', SCORE: '#7c3aed' };

  const inputStyle = {
    width: '100%', padding: '7px 10px', fontSize: 12,
    border: '1px solid #d1d5db', borderRadius: 6,
    background: '#f9fafb', color: '#111827'
  };

  const labelStyle = { fontSize: 11, color: '#6b7280', marginBottom: 4, display: 'block' };

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>

        {/* Agent Email */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 18 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Agent Email IA</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>Genere des emails personnalises via Claude</div>

          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Nom vendeur</label>
            <input value={emailInput.nom} onChange={e => setEmailInput(p => ({ ...p, nom: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Adresse bien</label>
            <input value={emailInput.adresse} onChange={e => setEmailInput(p => ({ ...p, adresse: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Prix (euros)</label>
            <input value={emailInput.prix} onChange={e => setEmailInput(p => ({ ...p, prix: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Type email</label>
            <select value={emailInput.type} onChange={e => setEmailInput(p => ({ ...p, type: e.target.value }))} style={inputStyle}>
              <option value="premier_contact">Premier contact</option>
              <option value="relance_j7">Relance J+7</option>
              <option value="relance_j14">Relance J+14</option>
              <option value="relance_j30">Derniere chance J+30</option>
            </select>
          </div>

          <button onClick={genEmail} disabled={loadingEmail} style={{
            width: '100%', padding: '9px 0', borderRadius: 8, border: 'none',
            background: loadingEmail ? '#e5e7eb' : '#2563eb',
            color: loadingEmail ? '#9ca3af' : '#fff',
            fontSize: 13, fontWeight: 500, cursor: loadingEmail ? 'wait' : 'pointer'
          }}>
            {loadingEmail ? 'Generation en cours...' : "Generer l'email IA"}
          </button>

          {emailResult && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 6, display: 'flex', justifyContent: 'space-between' }}>
                <span>Email genere</span>
                <button onClick={() => navigator.clipboard.writeText(emailResult)} style={{ fontSize: 11, border: 'none', background: 'none', cursor: 'pointer', color: '#2563eb' }}>Copier</button>
              </div>
              <div style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12, fontSize: 12, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: '#111827', maxHeight: 200, overflowY: 'auto' }}>
                {emailResult}
              </div>
            </div>
          )}
        </div>

        {/* Agent SMS */}
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 18 }}>
          <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 4 }}>Agent SMS IA</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 14 }}>SMS court et percutant — max 160 caracteres</div>

          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Prenom vendeur</label>
            <input value={smsInput.prenom} onChange={e => setSmsInput(p => ({ ...p, prenom: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Ville</label>
            <input value={smsInput.ville} onChange={e => setSmsInput(p => ({ ...p, ville: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 10 }}>
            <label style={labelStyle}>Code postal</label>
            <input value={smsInput.cp} onChange={e => setSmsInput(p => ({ ...p, cp: e.target.value }))} style={inputStyle} />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={labelStyle}>Type SMS</label>
            <select value={smsInput.type} onChange={e => setSmsInput(p => ({ ...p, type: e.target.value }))} style={inputStyle}>
              <option value="contact">Premier contact</option>
              <option value="relance_j7">Relance J+7</option>
              <option value="rappel_rdv">Rappel RDV</option>
              <option value="confirmation">Confirmation mandat</option>
            </select>
          </div>

          <button onClick={genSMS} disabled={loadingSMS} style={{
            width: '100%', padding: '9px 0', borderRadius: 8, border: 'none',
            background: loadingSMS ? '#e5e7eb' : '#16a34a',
            color: loadingSMS ? '#9ca3af' : '#fff',
            fontSize: 13, fontWeight: 500, cursor: loadingSMS ? 'wait' : 'pointer'
          }}>
            {loadingSMS ? 'Generation...' : 'Generer le SMS IA'}
          </button>

          {smsResult && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                <span>SMS genere ({smsResult.length}/160 caracteres)</span>
                <button onClick={() => navigator.clipboard.writeText(smsResult)} style={{ fontSize: 11, border: 'none', background: 'none', cursor: 'pointer', color: '#16a34a' }}>Copier</button>
              </div>
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 12, fontSize: 13, lineHeight: 1.7, color: '#111827' }}>
                {smsResult}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Journal */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 18 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          Journal des agents
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#16a34a', display: 'inline-block' }}></span>
          <span style={{ fontSize: 12, fontWeight: 400, color: '#6b7280' }}>Actifs</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {log.map((l, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, fontSize: 12, alignItems: 'center' }}>
              <span style={{ color: '#9ca3af', minWidth: 38, fontFamily: 'monospace' }}>{l.time}</span>
              <span style={{
                background: (tagColor[l.tag] || '#6b7280') + '20',
                color: tagColor[l.tag] || '#6b7280',
                padding: '1px 8px', borderRadius: 8, fontSize: 10, fontWeight: 600, minWidth: 46, textAlign: 'center'
              }}>{l.tag}</span>
              <span style={{ color: '#374151' }}>{l.msg}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
