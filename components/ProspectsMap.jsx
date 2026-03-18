// components/ProspectsMap.jsx
import { useState } from 'react';
import { CODES_POSTAUX, REGIONS } from '../lib/codes-postaux';

export default function ProspectsMap() {
  const [region, setRegion] = useState('normandie');
  const [zones, setZones] = useState(new Set(['14000','14112','14123','14200','14320','14460']));
  const [onglet, setOnglet] = useState('annonce');
  const [annonce, setAnnonce] = useState('');
  const [extractLoading, setExtractLoading] = useState(false);
  const [extracted, setExtracted] = useState(null);
  const [saveLoading, setSaveLoading] = useState(false);
  const [saveResult, setSaveResult] = useState(null);
  const [papLinks, setPapLinks] = useState([]);
  const [cpRecherche, setCpRecherche] = useState('');

  const regionCourante = REGIONS.find(r => r.id === region);
  const zonesRegion = CODES_POSTAUX.filter(z => z.region === region);
  const zonesFiltrees = cpRecherche
    ? CODES_POSTAUX.filter(z => z.cp.includes(cpRecherche) || z.ville.toLowerCase().includes(cpRecherche.toLowerCase()))
    : zonesRegion;

  const toggleZone = (cp) => setZones(prev => { const n = new Set(prev); n.has(cp) ? n.delete(cp) : n.add(cp); return n; });
  const toutSel = () => setZones(new Set(zonesRegion.map(z => z.cp)));
  const toutDesel = () => setZones(new Set());

  // Extraire annonce avec IA
  const extraire = async () => {
    if (!annonce.trim()) return;
    setExtractLoading(true);
    setExtracted(null);
    setSaveResult(null);
    try {
      const r = await fetch('/api/extraire-annonce', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ texte: annonce })
      });
      const d = await r.json();
      if (d.success) setExtracted(d.data);
      else setExtracted({ erreur: d.error });
    } catch(e) { setExtracted({ erreur: e.message }); }
    setExtractLoading(false);
  };

  // Sauvegarder le prospect extrait
  const sauvegarder = async () => {
    if (!extracted || extracted.erreur) return;
    setSaveLoading(true);
    setSaveResult(null);
    try {
      const r = await fetch('/api/vendeurs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          vendeur: { nom: extracted.nom || 'Inconnu', prenom: extracted.prenom || '', email: extracted.email || null, telephone: extracted.telephone || null, source: 'annonce_ia' },
          bien: { adresse: extracted.adresse || '', code_postal: extracted.code_postal || '', ville: extracted.ville || '', prix_demande: extracted.prix ? parseInt(extracted.prix) : null, surface_m2: extracted.surface ? parseInt(extracted.surface) : null, nb_pieces: extracted.pieces ? parseInt(extracted.pieces) : null, type_bien: extracted.type_bien || 'maison' }
        })
      });
      const d = await r.json();
      setSaveResult(d.id ? 'success' : 'error');
      if (d.id) { setAnnonce(''); setExtracted(null); setTimeout(() => window.location.reload(), 2000); }
    } catch(e) { setSaveResult('error'); }
    setSaveLoading(false);
  };

  // Générer liens PAP
  const genPap = () => {
    const links = [...zones].map(cp => {
      const z = CODES_POSTAUX.find(z => z.cp === cp);
      return { cp, ville: z?.ville || cp, maisons: `https://www.pap.fr/annonce/ventes-maisons-${cp}-g`, apparts: `https://www.pap.fr/annonce/ventes-appartements-${cp}-g` };
    });
    setPapLinks(links);
  };

  const btn = (bg, txt, onClick, disabled) => (
    <button onClick={onClick} disabled={disabled} style={{ padding: '8px 16px', borderRadius: 8, border: 'none', fontSize: 13, fontWeight: 500, cursor: disabled ? 'wait' : 'pointer', background: disabled ? '#9ca3af' : bg, color: 'white' }}>{txt}</button>
  );

  const inputStyle = { width: '100%', padding: '8px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: '#f9fafb', color: '#111827', marginBottom: 8 };

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif' }}>

      {/* CARTE FRANCE + ZONES */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: 18, marginBottom: 14 }}>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 14 }}>Sélectionner une région</div>
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>

          {/* Carte France */}
          <div style={{ flex: '0 0 260px' }}>
            <svg viewBox="0 0 260 280" style={{ width: '100%', border: '1px solid #e5e7eb', borderRadius: 8, background: '#f0f9ff' }}>
              {[
                { id: 'hauts', x: 50, y: 10, w: 80, h: 40, label: 'Hauts-de-France' },
                { id: 'grand-est', x: 130, y: 10, w: 80, h: 40, label: 'Grand Est' },
                { id: 'normandie', x: 10, y: 55, w: 90, h: 45, label: 'Normandie' },
                { id: 'idf', x: 100, y: 55, w: 70, h: 45, label: 'Île-de-France' },
                { id: 'bourgogne', x: 170, y: 55, w: 70, h: 45, label: 'Bourgogne' },
                { id: 'bretagne', x: 10, y: 105, w: 80, h: 45, label: 'Bretagne' },
                { id: 'centre', x: 90, y: 105, w: 80, h: 45, label: 'Centre-Val Loire' },
                { id: 'aura', x: 170, y: 105, w: 70, h: 45, label: 'Auvergne-RA' },
                { id: 'pays-loire', x: 10, y: 155, w: 80, h: 40, label: 'Pays de la Loire' },
                { id: 'nouvelle-aquitaine', x: 10, y: 200, w: 90, h: 45, label: 'Nvelle-Aquitaine' },
                { id: 'occitanie', x: 100, y: 200, w: 80, h: 45, label: 'Occitanie' },
                { id: 'paca', x: 180, y: 200, w: 60, h: 45, label: 'PACA' },
              ].map(r => {
                const reg = REGIONS.find(x => x.id === r.id);
                const active = region === r.id;
                return (
                  <g key={r.id} onClick={() => { setRegion(r.id); toutDesel(); }} style={{ cursor: 'pointer' }}>
                    <rect x={r.x} y={r.y} width={r.w} height={r.h} rx="4" fill={active ? (reg?.couleur || '#185FA5') : '#e5e7eb'} stroke="white" strokeWidth="1.5"/>
                    <text x={r.x + r.w/2} y={r.y + r.h/2 + 4} textAnchor="middle" fill={active ? 'white' : '#374151'} fontSize="8" fontWeight={active ? '600' : '400'} style={{ pointerEvents: 'none' }}>{r.label}</text>
                  </g>
                );
              })}
              <rect x="60" y="250" width="140" height="20" rx="4" fill={regionCourante?.couleur || '#185FA5'}/>
              <text x="130" y="263" textAnchor="middle" fill="white" fontSize="9" fontWeight="600">{regionCourante?.nom}</text>
            </svg>
          </div>

          {/* Codes postaux */}
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <input value={cpRecherche} onChange={e => setCpRecherche(e.target.value)} placeholder="Rechercher CP ou ville..." style={{ flex: 1, padding: '6px 10px', fontSize: 12, border: '1px solid #d1d5db', borderRadius: 6, background: '#f9fafb', color: '#111827' }}/>
              <button onClick={toutSel} style={{ padding: '5px 10px', borderRadius: 6, border: 'none', background: regionCourante?.couleur || '#185FA5', color: 'white', fontSize: 11, cursor: 'pointer' }}>Tout</button>
              <button onClick={toutDesel} style={{ padding: '5px 10px', borderRadius: 6, border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: 11, cursor: 'pointer' }}>Aucun</button>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, maxHeight: 180, overflowY: 'auto' }}>
              {zonesFiltrees.map(z => (
                <button key={z.cp} onClick={() => toggleZone(z.cp)} style={{
                  padding: '3px 9px', borderRadius: 14, fontSize: 11, cursor: 'pointer',
                  border: `1px solid ${zones.has(z.cp) ? (regionCourante?.couleur || '#185FA5') : '#d1d5db'}`,
                  background: zones.has(z.cp) ? ((regionCourante?.couleur || '#185FA5') + '18') : '#f9fafb',
                  color: zones.has(z.cp) ? (regionCourante?.couleur || '#185FA5') : '#6b7280',
                  fontWeight: zones.has(z.cp) ? 600 : 400
                }}>
                  {z.cp} {z.ville}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 8, fontSize: 12, color: '#6b7280' }}>
              {zones.size} zone(s) sélectionnée(s) — {CODES_POSTAUX.filter(z => z.region === region).length} disponibles
            </div>
          </div>
        </div>
      </div>

      {/* ONGLETS */}
      <div style={{ display: 'flex', borderBottom: '1px solid #e5e7eb', marginBottom: 14, background: '#fff', borderRadius: '10px 10px 0 0', overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        {[
          { id: 'annonce', label: 'Coller une annonce (IA)' },
          { id: 'pap', label: 'Liens PAP.fr' },
          { id: 'manuel', label: 'Ajout manuel' },
          { id: 'csv', label: 'Import CSV' },
          { id: 'auto', label: 'Auto DVF (gratuit)' },
        ].map(t => (
          <button key={t.id} onClick={() => setOnglet(t.id)} style={{
            flex: 1, padding: '11px 8px', fontSize: 12, border: 'none', cursor: 'pointer',
            background: onglet === t.id ? '#eff6ff' : '#fff',
            color: onglet === t.id ? '#1d4ed8' : '#6b7280',
            fontWeight: onglet === t.id ? 600 : 400,
            borderBottom: onglet === t.id ? '2px solid #2563eb' : '2px solid transparent'
          }}>{t.label}</button>
        ))}
      </div>

      {/* COLLER ANNONCE IA */}
      {onglet === 'annonce' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0 0 10px 10px', padding: 18 }}>
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 12, lineHeight: 1.6 }}>
            Copiez le texte d'une annonce depuis <strong>PAP.fr, LeBonCoin, SeLoger, Bien Ici</strong> ou n'importe quel site → collez ci-dessous → Claude extrait automatiquement toutes les informations.
          </div>
          <textarea value={annonce} onChange={e => setAnnonce(e.target.value)} placeholder="Collez ici le texte complet de l'annonce immobilière...

Exemple :
Vends maison 95m² 4 pièces à Caen 14000
Prix : 285 000 €
Contact : Martin Laurent — 06 12 34 56 78
Belle maison rénovée avec jardin..."
            style={{ ...inputStyle, height: 150, resize: 'vertical', fontFamily: 'system-ui', fontSize: 13, lineHeight: 1.6 }}
          />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 14 }}>
            {btn('#185FA5', extractLoading ? 'Extraction en cours...' : 'Extraire avec IA', extraire, extractLoading || !annonce.trim())}
            {annonce && <button onClick={() => { setAnnonce(''); setExtracted(null); }} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #d1d5db', background: '#fff', cursor: 'pointer', fontSize: 12, color: '#6b7280' }}>Effacer</button>}
          </div>

          {extracted && !extracted.erreur && (
            <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: 16 }}>
              <div style={{ fontWeight: 600, fontSize: 13, color: '#15803d', marginBottom: 12 }}>Informations extraites par Claude :</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 20px', fontSize: 13, marginBottom: 14 }}>
                {[
                  ['Nom', extracted.nom], ['Prénom', extracted.prenom],
                  ['Téléphone', extracted.telephone], ['Email', extracted.email],
                  ['Adresse', extracted.adresse], ['Code postal', extracted.code_postal],
                  ['Ville', extracted.ville], ['Prix', extracted.prix ? parseInt(extracted.prix).toLocaleString('fr-FR') + ' €' : ''],
                  ['Surface', extracted.surface ? extracted.surface + ' m²' : ''], ['Pièces', extracted.pieces],
                  ['Type', extracted.type_bien],
                ].filter(([,v]) => v).map(([k,v]) => (
                  <div key={k} style={{ display: 'flex', gap: 8 }}>
                    <span style={{ color: '#6b7280', minWidth: 80 }}>{k}</span>
                    <span style={{ fontWeight: 500, color: '#111827' }}>{v}</span>
                  </div>
                ))}
              </div>
              {extracted.description && <div style={{ fontSize: 12, color: '#374151', marginBottom: 12, fontStyle: 'italic' }}>{extracted.description}</div>}
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                {btn('#1D9E75', saveLoading ? 'Ajout...' : 'Ajouter au CRM', sauvegarder, saveLoading)}
                {saveResult === 'success' && <span style={{ color: '#16a34a', fontSize: 13 }}>✓ Ajouté ! Rappels J+7/J+14/J+30 planifiés. Rechargement...</span>}
                {saveResult === 'error' && <span style={{ color: '#dc2626', fontSize: 13 }}>Erreur — vérifiez Supabase</span>}
              </div>
            </div>
          )}
          {extracted?.erreur && <div style={{ color: '#dc2626', fontSize: 13 }}>Erreur : {extracted.erreur}</div>}
        </div>
      )}

      {/* PAP LIENS */}
      {onglet === 'pap' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0 0 10px 10px', padding: 18 }}>
          <div style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>
            Générez les liens PAP.fr pour vos zones sélectionnées. Ouvrez chaque lien, copiez les annonces et revenez dans l'onglet "Coller une annonce" pour les ajouter automatiquement.
          </div>
          {btn('#16a34a', 'Générer les liens PAP.fr', genPap, zones.size === 0)}
          {papLinks.length > 0 && (
            <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {papLinks.map((p, i) => (
                <div key={i} style={{ background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
                  <div style={{ fontWeight: 500, fontSize: 13, color: '#111827', marginBottom: 6 }}>{p.ville} ({p.cp})</div>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <a href={p.maisons} target="_blank" rel="noreferrer" style={{ color: '#2563eb', fontSize: 12, textDecoration: 'none', padding: '4px 10px', background: '#eff6ff', borderRadius: 6 }}>Maisons →</a>
                    <a href={p.apparts} target="_blank" rel="noreferrer" style={{ color: '#7c3aed', fontSize: 12, textDecoration: 'none', padding: '4px 10px', background: '#f5f3ff', borderRadius: 6 }}>Appartements →</a>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* AJOUT MANUEL */}
      {onglet === 'manuel' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0 0 10px 10px', padding: 18 }}>
          <AjoutManuel zones={[...zones]} />
        </div>
      )}


      {/* AUTO DVF */}
      {onglet === 'auto' && (
        <AutoDVF zones={[...zones]} />
      )}

      {/* IMPORT CSV */}
      {onglet === 'csv' && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0 0 10px 10px', padding: 18 }}>
          <ImportCSV />
        </div>
      )}
    </div>
  );
}

function AjoutManuel({ zones }) {
  const [f, setF] = useState({ nom:'', prenom:'', telephone:'', email:'', adresse:'', code_postal: zones[0]||'14000', ville:'', prix:'', surface:'', pieces:'', type_bien:'maison', source:'manuel' });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const s = (k,v) => setF(p => ({...p,[k]:v}));
  const inp = { width:'100%', padding:'7px 10px', fontSize:12, border:'1px solid #d1d5db', borderRadius:6, background:'#f9fafb', color:'#111827', marginBottom:8 };

  const ajouter = async () => {
    if (!f.nom) return alert('Le nom est obligatoire');
    setLoading(true); setResult(null);
    try {
      const r = await fetch('/api/vendeurs', { method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ vendeur:{nom:f.nom,prenom:f.prenom,email:f.email||null,telephone:f.telephone||null,source:f.source}, bien:{adresse:f.adresse,code_postal:f.code_postal,ville:f.ville,prix_demande:f.prix?parseInt(f.prix):null,surface_m2:f.surface?parseInt(f.surface):null,nb_pieces:f.pieces?parseInt(f.pieces):null,type_bien:f.type_bien} })
      });
      const d = await r.json();
      setResult(d.id ? 'success' : 'error');
      if (d.id) { setF(p=>({...p,nom:'',prenom:'',telephone:'',email:'',adresse:'',prix:'',surface:'',pieces:''})); setTimeout(()=>window.location.reload(),2000); }
    } catch(e) { setResult('error'); }
    setLoading(false);
  };

  return (
    <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
      <div>
        {[['Nom *','nom','Martin'],['Prénom','prenom','Laurent'],['Téléphone','telephone','06 12 34 56 78'],['Email','email','martin@email.fr']].map(([l,k,ph]) => (
          <div key={k}><div style={{fontSize:11,color:'#6b7280',marginBottom:3}}>{l}</div><input value={f[k]} onChange={e=>s(k,e.target.value)} placeholder={ph} style={inp}/></div>
        ))}
        <div style={{fontSize:11,color:'#6b7280',marginBottom:3}}>Source</div>
        <select value={f.source} onChange={e=>s('source',e.target.value)} style={inp}>
          {['manuel','pap','leboncoin','seloger','bienici','ouestfrance','referral'].map(v=><option key={v} value={v}>{v}</option>)}
        </select>
      </div>
      <div>
        {[['Adresse','adresse','14 rue Saint-Pierre'],['Ville','ville','Caen']].map(([l,k,ph]) => (
          <div key={k}><div style={{fontSize:11,color:'#6b7280',marginBottom:3}}>{l}</div><input value={f[k]} onChange={e=>s(k,e.target.value)} placeholder={ph} style={inp}/></div>
        ))}
        <div style={{fontSize:11,color:'#6b7280',marginBottom:3}}>Code postal</div>
        <select value={f.code_postal} onChange={e=>s('code_postal',e.target.value)} style={inp}>
          {zones.map(cp => { const z=CODES_POSTAUX.find(z=>z.cp===cp); return <option key={cp} value={cp}>{cp} {z?.ville||''}</option>; })}
          <option value="">Autre</option>
        </select>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:6}}>
          {[['Prix €','prix','285000'],['Surface','surface','95'],['Pièces','pieces','4']].map(([l,k,ph])=>(
            <div key={k}><div style={{fontSize:10,color:'#6b7280',marginBottom:3}}>{l}</div><input value={f[k]} onChange={e=>s(k,e.target.value)} placeholder={ph} style={{...inp,marginBottom:0}}/></div>
          ))}
        </div>
        <div style={{marginTop:6}}>
          <div style={{fontSize:11,color:'#6b7280',marginBottom:3}}>Type</div>
          <select value={f.type_bien} onChange={e=>s('type_bien',e.target.value)} style={inp}>
            {['maison','appartement','terrain','immeuble'].map(v=><option key={v} value={v}>{v}</option>)}
          </select>
        </div>
      </div>
      <div style={{gridColumn:'1/-1',display:'flex',gap:10,alignItems:'center'}}>
        <button onClick={ajouter} disabled={loading} style={{padding:'9px 20px',borderRadius:8,border:'none',fontSize:13,fontWeight:500,cursor:loading?'wait':'pointer',background:loading?'#9ca3af':'#185FA5',color:'white'}}>
          {loading?'Ajout...':'Ajouter au CRM'}
        </button>
        {result==='success'&&<span style={{color:'#16a34a',fontSize:13}}>✓ Ajouté ! Rechargement...</span>}
        {result==='error'&&<span style={{color:'#dc2626',fontSize:13}}>Erreur</span>}
      </div>
    </div>
  );
}

function ImportCSV() {
  const [csv, setCsv] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const exemple = `nom,prenom,telephone,email,adresse,code_postal,ville,prix,surface,pieces,type_bien\nMartin,Laurent,0612345678,martin@email.fr,14 rue Saint-Pierre,14000,Caen,285000,95,4,maison\nDubois,Bernard,0623456789,bernard@email.fr,7 chemin des Charmes,14112,Bieville,340000,120,5,maison`;

  const importer = async () => {
    if (!csv.trim()) return;
    setLoading(true); setResult(null);
    try {
      const lignes = csv.trim().split('\n');
      const headers = lignes[0].toLowerCase().split(',').map(h=>h.trim());
      const vendeurs = lignes.slice(1).map(ligne=>{
        const vals = ligne.split(',').map(v=>v.trim().replace(/"/g,''));
        const o = {};
        headers.forEach((h,i)=>o[h]=vals[i]||'');
        return { nom:o.nom||o.name||'', prenom:o.prenom||o.firstname||'', email:o.email||'', telephone:o.telephone||o.tel||o.phone||'', adresse:o.adresse||o.address||'', code_postal:o.code_postal||o.cp||'', ville:o.ville||o.city||'', prix:o.prix||o.price||'', surface:o.surface||'', pieces:o.pieces||o.rooms||'', type_bien:o.type_bien||o.type||'maison', source:'import_csv', url:o.url||'' };
      }).filter(v=>v.nom);
      const r = await fetch('/api/import-csv',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({vendeurs})});
      const d = await r.json();
      setResult(d);
      if (d.ajoutes > 0) setTimeout(()=>window.location.reload(),2000);
    } catch(e) { setResult({error:e.message}); }
    setLoading(false);
  };

  return (
    <div>
      <div style={{fontSize:13,color:'#374151',marginBottom:10,lineHeight:1.6}}>
        Importez vos prospects depuis Excel. Colonnes : <code>nom, prenom, telephone, email, adresse, code_postal, ville, prix, surface, pieces, type_bien</code>
      </div>
      <div style={{display:'flex',gap:8,marginBottom:8}}>
        <button onClick={()=>setCsv(exemple)} style={{padding:'5px 12px',borderRadius:6,border:'1px solid #d1d5db',background:'#f9fafb',cursor:'pointer',fontSize:11,color:'#374151'}}>Exemple</button>
        <button onClick={()=>setCsv('')} style={{padding:'5px 12px',borderRadius:6,border:'1px solid #d1d5db',background:'#f9fafb',cursor:'pointer',fontSize:11,color:'#374151'}}>Effacer</button>
      </div>
      <textarea value={csv} onChange={e=>setCsv(e.target.value)} placeholder="Collez votre CSV ici..." style={{width:'100%',padding:'8px 10px',fontSize:11,border:'1px solid #d1d5db',borderRadius:6,background:'#f9fafb',color:'#111827',height:140,resize:'vertical',fontFamily:'monospace',marginBottom:10}}/>
      <div style={{display:'flex',gap:10,alignItems:'center'}}>
        <button onClick={importer} disabled={loading||!csv.trim()} style={{padding:'8px 16px',borderRadius:8,border:'none',fontSize:13,fontWeight:500,cursor:loading?'wait':'pointer',background:loading||!csv.trim()?'#9ca3af':'#1D9E75',color:'white'}}>
          {loading?'Import...':'Importer dans le CRM'}
        </button>
        {result && !result.error && <span style={{color:'#16a34a',fontSize:13}}>✓ {result.ajoutes} vendeurs ajoutés{result.erreurs>0?` (${result.erreurs} erreurs)`:''} — rechargement...</span>}
        {result?.error && <span style={{color:'#dc2626',fontSize:13}}>Erreur : {result.error}</span>}
      </div>
    </div>
  );
}

// Export du composant AutoProspects séparé
export function AutoProspects({ zones }) {
  return null; // Intégré dans ProspectsMap
}

function AutoDVF({ zones }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  const lancer = async () => {
    if (!zones.length) return alert('Sélectionnez au moins un code postal');
    setLoading(true);
    setResult(null);
    try {
      const r = await fetch('/api/auto-prospects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ codesPostaux: zones.slice(0, 5) })
      });
      const d = await r.json();
      setResult(d);
      if (d.ajoutes > 0) setTimeout(() => window.location.reload(), 3000);
    } catch(e) { setResult({ error: e.message }); }
    setLoading(false);
  };

  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '0 0 10px 10px', padding: 18 }}>
      <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 10 }}>Détection automatique — DVF Officiel</div>
      <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 8, padding: 14, marginBottom: 14, fontSize: 13, lineHeight: 1.7 }}>
        <strong style={{ color: '#1d4ed8' }}>Source : data.gouv.fr (100% gratuit et légal)</strong><br/>
        Les Demandes de Valeurs Foncières (DVF) contiennent toutes les ventes immobilières officielles en France.<br/>
        Le système va chercher les ventes récentes dans vos zones sélectionnées et les ajouter automatiquement dans votre CRM.<br/>
        <span style={{ color: '#6b7280', fontSize: 12 }}>⚠️ DVF anonymise les vendeurs — les noms et téléphones ne sont pas disponibles. Utilisez les adresses pour prospecter.</span>
      </div>
      <div style={{ marginBottom: 14 }}>
        <div style={{ fontSize: 13, color: '#374151', marginBottom: 8 }}>
          Zones sélectionnées : {zones.slice(0,5).join(', ')}{zones.length > 5 ? ` +${zones.length-5} autres (max 5 à la fois)` : ''}
        </div>
      </div>
      <button onClick={lancer} disabled={loading} style={{
        padding: '10px 24px', borderRadius: 8, border: 'none', fontSize: 14,
        fontWeight: 500, cursor: loading ? 'wait' : 'pointer',
        background: loading ? '#9ca3af' : '#185FA5', color: 'white'
      }}>
        {loading ? 'Recherche en cours... (30s)' : 'Lancer la détection automatique'}
      </button>
      {result && !result.error && (
        <div style={{ marginTop: 14, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 8, padding: 14 }}>
          <div style={{ fontWeight: 600, color: '#15803d', fontSize: 14, marginBottom: 6 }}>
            {result.ajoutes > 0 ? `✓ ${result.ajoutes} prospects ajoutés au CRM !` : 'Aucun prospect trouvé'}
          </div>
          <div style={{ fontSize: 13, color: '#374151' }}>{result.message}</div>
          {result.ajoutes > 0 && <div style={{ fontSize: 12, color: '#6b7280', marginTop: 6 }}>Rechargement dans 3 secondes...</div>}
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 8, lineHeight: 1.6 }}>
            <strong>Prochaine étape :</strong> Allez dans "Vendeurs" → trouvez les biens DVF → recherchez les propriétaires sur PAP.fr ou LeBonCoin avec l'adresse → ajoutez leur téléphone manuellement.
          </div>
        </div>
      )}
      {result?.error && <div style={{ marginTop: 10, color: '#dc2626', fontSize: 13 }}>Erreur : {result.error}</div>}
    </div>
  );
}
