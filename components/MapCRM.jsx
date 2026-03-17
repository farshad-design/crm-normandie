// components/MapCRM.jsx — Carte interactive Leaflet.js
import { useEffect, useState, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMapEvents, Polygon } from 'react-leaflet';
import L from 'leaflet';

// Fix icônes Leaflet avec Next.js
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Codes postaux zone Normandie / Caen
const ZONES_CP = ['14000','14112','14119','14120','14123','14200','14320','14460','14650','14760'];

// Centre Caen
const CENTER = [49.1829, -0.3707];
const ZOOM = 12;

// Couleurs par statut
const COULEURS_STATUT = {
  detecte:   '#2563eb',
  contact:   '#7c3aed',
  rdv:       '#0891b2',
  mandat:    '#16a34a',
  inactif:   '#dc2626',
  archive:   '#9ca3af',
};

const LABELS_STATUT = {
  detecte:  'Bien détecté',
  contact:  'Contact établi',
  rdv:      'RDV effectué',
  mandat:   'Mandat signé',
  inactif:  'Inactif',
  archive:  'Archivé',
};

// Créer une icône div personnalisée
function creerIcone(statut, score) {
  const couleur = COULEURS_STATUT[statut] || '#6b7280';
  const initiale = statut.charAt(0).toUpperCase();
  return L.divIcon({
    className: '',
    html: `
      <div style="
        width:34px;height:34px;border-radius:50%;
        background:${couleur};border:2px solid white;
        display:flex;align-items:center;justify-content:center;
        color:white;font-size:13px;font-weight:600;
        box-shadow:0 2px 8px rgba(0,0,0,0.25);
        cursor:pointer;position:relative;
      ">
        ${initiale}
        ${score > 70 ? `<div style="
          position:absolute;top:-4px;right:-4px;
          width:10px;height:10px;border-radius:50%;
          background:#fbbf24;border:1px solid white;
        "></div>` : ''}
      </div>
    `,
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

// Composant sélection de zone par dessin
function ZoneDessin({ actif, onZoneComplete }) {
  const [points, setPoints] = useState([]);

  useMapEvents({
    click(e) {
      if (!actif) return;
      const newPoints = [...points, [e.latlng.lat, e.latlng.lng]];
      setPoints(newPoints);
      if (newPoints.length >= 3) {
        onZoneComplete(newPoints);
      }
    }
  });

  if (points.length < 2) return null;
  return (
    <Polygon
      positions={points}
      pathOptions={{ color: '#2563eb', fillOpacity: 0.1, dashArray: '5,5' }}
    />
  );
}

export default function MapCRM({ vendeurs = [], onVendeurSelect }) {
  const [biens, setBiens] = useState([]);
  const [filtres, setFiltres] = useState(new Set(Object.keys(COULEURS_STATUT)));
  const [modeDessin, setModeDessin] = useState(false);
  const [zonePolygone, setZonePolygone] = useState(null);
  const [biensZone, setBiensZone] = useState([]);
  const [generatingEmail, setGeneratingEmail] = useState(null);

  // Charger les biens avec coordonnées GPS
  useEffect(() => {
    fetch(`/api/biens?cp=${ZONES_CP.join(',')}`)
      .then(r => r.json())
      .then(data => setBiens(data || []))
      .catch(() => {});
  }, []);

  // Filtrer biens par statut et par zone dessinée
  const biensAffiches = biens.filter(b => {
    const statut = b.vendeurs?.statut || 'detecte';
    if (!filtres.has(statut)) return false;
    if (zonePolygone) return pointDansPolygone([b.latitude, b.longitude], zonePolygone);
    return true;
  });

  // Vérifier si un point est dans un polygone
  function pointDansPolygone(point, polygone) {
    const [lat, lng] = point;
    let inside = false;
    for (let i = 0, j = polygone.length - 1; i < polygone.length; j = i++) {
      const [lati, lngi] = polygone[i];
      const [latj, lngj] = polygone[j];
      if (((lngi > lng) !== (lngj > lng)) &&
          (lat < (latj - lati) * (lng - lngi) / (lngj - lngi) + lati)) {
        inside = !inside;
      }
    }
    return inside;
  }

  const toggleFiltre = (statut) => {
    setFiltres(prev => {
      const next = new Set(prev);
      next.has(statut) ? next.delete(statut) : next.add(statut);
      return next;
    });
  };

  // Générer email IA pour un vendeur
  const genererEmail = async (vendeur, bien) => {
    setGeneratingEmail(vendeur.id);
    try {
      const res = await fetch('/api/generer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'premier_contact', vendeur, bien, canal: 'email' })
      });
      const { contenu } = await res.json();
      alert(`Email généré pour ${vendeur.prenom || vendeur.nom} :\n\n${contenu}`);
    } catch (e) {
      alert('Erreur génération email');
    }
    setGeneratingEmail(null);
  };

  return (
    <div>
      {/* Barre de contrôles */}
      <div style={{
        background: '#fff', border: '1px solid #e5e7eb',
        borderRadius: 10, padding: '12px 16px', marginBottom: 12,
        display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center'
      }}>
        <span style={{ fontSize: 12, color: '#6b7280', marginRight: 4 }}>Statuts :</span>
        {Object.entries(COULEURS_STATUT).map(([statut, couleur]) => (
          <button key={statut} onClick={() => toggleFiltre(statut)} style={{
            padding: '4px 10px', borderRadius: 20, fontSize: 11, cursor: 'pointer',
            border: `1px solid ${filtres.has(statut) ? couleur : '#d1d5db'}`,
            background: filtres.has(statut) ? couleur + '20' : '#f9fafb',
            color: filtres.has(statut) ? couleur : '#9ca3af',
            fontWeight: filtres.has(statut) ? 600 : 400
          }}>
            {LABELS_STATUT[statut]}
          </button>
        ))}
        <button onClick={() => { setModeDessin(!modeDessin); setZonePolygone(null); }} style={{
          marginLeft: 'auto', padding: '6px 12px', borderRadius: 6, fontSize: 12,
          background: modeDessin ? '#2563eb' : '#f3f4f6',
          color: modeDessin ? '#fff' : '#374151',
          border: `1px solid ${modeDessin ? '#2563eb' : '#d1d5db'}`,
          cursor: 'pointer'
        }}>
          {modeDessin ? '✏️ Dessiner zone (cliquer 3+ points)' : 'Sélectionner une zone'}
        </button>
        {zonePolygone && (
          <button onClick={() => setZonePolygone(null)} style={{
            padding: '6px 12px', borderRadius: 6, fontSize: 12,
            background: '#fef2f2', color: '#dc2626',
            border: '1px solid #fecaca', cursor: 'pointer'
          }}>
            Effacer zone ({biensZone.length} biens)
          </button>
        )}
      </div>

      {/* Carte Leaflet */}
      <div style={{ borderRadius: 10, overflow: 'hidden', border: '1px solid #e5e7eb' }}>
        <MapContainer
          center={CENTER}
          zoom={ZOOM}
          style={{ height: 500, width: '100%' }}
          scrollWheelZoom={true}
        >
          {/* Fond de carte OpenStreetMap France */}
          <TileLayer
            url="https://{s}.tile.openstreetmap.fr/osmfr/{z}/{x}/{y}.png"
            attribution='&copy; <a href="https://www.openstreetmap.org">OpenStreetMap</a> France'
            maxZoom={19}
          />

          {/* Zone dessinée */}
          {zonePolygone && (
            <Polygon
              positions={zonePolygone}
              pathOptions={{ color: '#2563eb', fillOpacity: 0.08 }}
            />
          )}

          {/* Marqueurs des biens */}
          {biensAffiches.map(bien => {
            const vendeur = bien.vendeurs || {};
            const statut = vendeur.statut || 'detecte';
            const score = vendeur.score_priorite || 50;

            return (
              <Marker
                key={bien.id}
                position={[bien.latitude, bien.longitude]}
                icon={creerIcone(statut, score)}
              >
                <Popup maxWidth={260}>
                  <div style={{ fontFamily: 'system-ui, sans-serif', fontSize: 13 }}>
                    <div style={{ fontWeight: 600, marginBottom: 4 }}>
                      {bien.type_bien || 'Bien'} — {bien.ville || ''} {bien.code_postal}
                    </div>
                    <div style={{ color: '#6b7280', marginBottom: 8, fontSize: 12 }}>
                      {bien.adresse}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px', fontSize: 12, marginBottom: 10 }}>
                      <span style={{ color: '#6b7280' }}>Prix</span>
                      <span style={{ fontWeight: 500 }}>
                        {bien.prix_demande ? bien.prix_demande.toLocaleString('fr-FR') + ' €' : '—'}
                      </span>
                      <span style={{ color: '#6b7280' }}>Surface</span>
                      <span style={{ fontWeight: 500 }}>{bien.surface_m2 ? bien.surface_m2 + ' m²' : '—'}</span>
                      <span style={{ color: '#6b7280' }}>Vendeur</span>
                      <span style={{ fontWeight: 500 }}>{vendeur.prenom || ''} {vendeur.nom || '—'}</span>
                      <span style={{ color: '#6b7280' }}>Score</span>
                      <span style={{
                        fontWeight: 600,
                        color: score > 70 ? '#16a34a' : score > 40 ? '#d97706' : '#dc2626'
                      }}>
                        {score}/100
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button
                        onClick={() => genererEmail(vendeur, bien)}
                        disabled={generatingEmail === vendeur.id}
                        style={{
                          flex: 1, padding: '6px 0', fontSize: 11, borderRadius: 6,
                          background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer'
                        }}
                      >
                        {generatingEmail === vendeur.id ? '...' : 'Email IA'}
                      </button>
                      <button
                        onClick={() => onVendeurSelect && onVendeurSelect(vendeur)}
                        style={{
                          flex: 1, padding: '6px 0', fontSize: 11, borderRadius: 6,
                          background: '#f3f4f6', color: '#374151',
                          border: '1px solid #d1d5db', cursor: 'pointer'
                        }}
                      >
                        Fiche CRM
                      </button>
                    </div>
                  </div>
                </Popup>
              </Marker>
            );
          })}

          {/* Outil dessin de zone */}
          <ZoneDessin
            actif={modeDessin}
            onZoneComplete={(pts) => {
              setZonePolygone(pts);
              setModeDessin(false);
              const dans = biens.filter(b =>
                b.latitude && b.longitude &&
                pointDansPolygone([b.latitude, b.longitude], pts)
              );
              setBiensZone(dans);
            }}
          />
        </MapContainer>
      </div>

      {/* Légende */}
      <div style={{
        marginTop: 10, display: 'flex', gap: 16, flexWrap: 'wrap',
        fontSize: 12, color: '#6b7280'
      }}>
        {Object.entries(COULEURS_STATUT).slice(0, 5).map(([statut, couleur]) => (
          <span key={statut} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 10, height: 10, borderRadius: '50%', background: couleur, display: 'inline-block' }}/>
            {LABELS_STATUT[statut]}
          </span>
        ))}
        <span style={{ marginLeft: 'auto', color: '#2563eb', fontWeight: 500 }}>
          {biensAffiches.length} biens affichés
        </span>
      </div>
    </div>
  );
}
