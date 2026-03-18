// pages/index.js
import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import Head from 'next/head';

const MapCRM = dynamic(() => import('../components/MapCRM'), { ssr: false });
const PipelineKanban = dynamic(() => import('../components/PipelineKanban'), { ssr: false });
const ProspectsMap = dynamic(() => import('../components/ProspectsMap'), { ssr: false });
const SyncPanel = dynamic(() => import('../components/SyncPanel'), { ssr: false });

import VendeursTable from '../components/VendeursTable';
import AgentsPanel from '../components/AgentsPanel';
import DashboardStats from '../components/DashboardStats';

const TABS = [
  { id: 'dashboard', label: 'Tableau de bord' },
  { id: 'sync',      label: '🔄 Sync Auto' },
  { id: 'prospects', label: 'Trouver prospects' },
  { id: 'carte',     label: 'Carte & Zones' },
  { id: 'vendeurs',  label: 'Vendeurs' },
  { id: 'pipeline',  label: 'Pipeline Mandats' },
  { id: 'agents',    label: 'Agents IA' },
];

export default function Home() {
  const [tab, setTab] = useState('dashboard');
  const [vendeurs, setVendeurs] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/vendeurs')
      .then(r => r.json())
      .then(data => { setVendeurs(Array.isArray(data) ? data : []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const refreshVendeurs = () => {
    fetch('/api/vendeurs').then(r => r.json()).then(data => setVendeurs(Array.isArray(data) ? data : []));
  };

  return (
    <>
      <Head>
        <title>CRM Immo Normandie — Megagence</title>
        <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
      </Head>
      <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
        <aside style={{ width: 220, background: '#fff', borderRight: '1px solid #e5e7eb', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #e5e7eb' }}>
            <div style={{ fontWeight: 600, fontSize: 14 }}>ImmoNormandie CRM</div>
            <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>Farshad — Megagence</div>
          </div>
          <nav style={{ padding: '8px 0', flex: 1 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                display: 'block', width: '100%', textAlign: 'left',
                padding: '9px 16px', fontSize: 13, border: 'none', cursor: 'pointer',
                background: tab === t.id ? '#eff6ff' : 'transparent',
                color: tab === t.id ? '#1d4ed8' : '#374151',
                fontWeight: tab === t.id ? 600 : 400,
                borderLeft: tab === t.id ? '3px solid #2563eb' : '3px solid transparent'
              }}>{t.label}</button>
            ))}
          </nav>
          <div style={{ padding: 12, borderTop: '1px solid #e5e7eb', fontSize: 11, color: '#6b7280' }}>
            <div>Agents IA : <span style={{ color: '#16a34a', fontWeight: 600 }}>actifs</span></div>
            <div style={{ marginTop: 4 }}>{vendeurs.length} vendeurs</div>
          </div>
        </aside>
        <main style={{ flex: 1, overflow: 'auto', background: '#f9fafb' }}>
          <header style={{ background: '#fff', borderBottom: '1px solid #e5e7eb', padding: '0 20px', height: 52, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h1 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>
              {TABS.find(t => t.id === tab)?.label}
            </h1>
            <button onClick={() => setTab('prospects')} style={{ padding: '7px 14px', fontSize: 12, borderRadius: 6, background: '#2563eb', color: '#fff', border: 'none', cursor: 'pointer' }}>
              + Nouveau vendeur
            </button>
          </header>
          <div style={{ padding: 20 }}>
            {tab === 'dashboard' && <DashboardStats vendeurs={vendeurs} loading={loading} />}
            {tab === 'sync'      && <SyncPanel />}
            {tab === 'prospects' && <ProspectsMap />}
            {tab === 'carte'     && <MapCRM vendeurs={vendeurs} />}
            {tab === 'vendeurs'  && <VendeursTable vendeurs={vendeurs} loading={loading} onRefresh={refreshVendeurs} />}
            {tab === 'pipeline'  && <PipelineKanban vendeurs={vendeurs} onUpdate={refreshVendeurs} />}
            {tab === 'agents'    && <AgentsPanel vendeurs={vendeurs} />}
          </div>
        </main>
      </div>
    </>
  );
}
