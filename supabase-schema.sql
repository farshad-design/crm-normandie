-- ============================================
-- CRM Immo Normandie — Schéma SQL complet
-- Coller intégralement dans Supabase > SQL Editor > Run
-- ============================================

-- Extension UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ── TYPES ENUM ──────────────────────────────────────────────────────────────

CREATE TYPE statut_vendeur AS ENUM (
  'detecte', 'contact', 'rdv', 'mandat', 'inactif', 'archive'
);

CREATE TYPE canal_contact AS ENUM ('email', 'sms', 'telephone');

CREATE TYPE statut_mandat AS ENUM ('actif', 'vendu', 'expire', 'annule');

CREATE TYPE statut_rappel AS ENUM ('en_attente', 'envoye', 'annule', 'echec');

-- ── TABLE VENDEURS ───────────────────────────────────────────────────────────

CREATE TABLE vendeurs (
  id              uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  nom             text NOT NULL,
  prenom          text,
  email           text UNIQUE,
  telephone       text,
  statut          statut_vendeur DEFAULT 'detecte',
  score_priorite  integer DEFAULT 50 CHECK (score_priorite BETWEEN 0 AND 100),
  source          text,         -- leboncoin, pap, seloger, manuel
  notes           text,
  nb_contacts     integer DEFAULT 0,
  dernier_contact timestamptz,
  created_at      timestamptz DEFAULT NOW(),
  updated_at      timestamptz DEFAULT NOW()
);

-- ── TABLE BIENS ──────────────────────────────────────────────────────────────

CREATE TABLE biens (
  id               uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  vendeur_id       uuid REFERENCES vendeurs(id) ON DELETE CASCADE,
  adresse          text NOT NULL,
  code_postal      text NOT NULL,
  ville            text,
  latitude         float8,
  longitude        float8,
  prix_demande     integer,
  surface_m2       integer,
  nb_pieces        integer,
  type_bien        text DEFAULT 'maison',  -- maison, appartement, terrain
  url_annonce      text UNIQUE,
  date_publication date,
  photos           text[],                 -- tableau d'URLs photos
  description      text,
  created_at       timestamptz DEFAULT NOW()
);

-- ── TABLE CONTACTS (historique) ──────────────────────────────────────────────

CREATE TABLE contacts (
  id             uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  vendeur_id     uuid REFERENCES vendeurs(id) ON DELETE CASCADE,
  canal          canal_contact NOT NULL,
  type_contact   text,   -- premier_contact, relance_j7, relance_j14, relance_j30, rdv, confirmation
  sujet          text,
  contenu        text,
  reponse        boolean DEFAULT FALSE,
  date_reponse   timestamptz,
  genere_par_ia  boolean DEFAULT TRUE,
  date_envoi     timestamptz DEFAULT NOW()
);

-- ── TABLE MANDATS ────────────────────────────────────────────────────────────

CREATE TABLE mandats (
  id              uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  bien_id         uuid REFERENCES biens(id) ON DELETE CASCADE,
  type_mandat     text DEFAULT 'simple',   -- simple, exclusif
  prix_signe      integer,
  commission_pct  float4 DEFAULT 5.0,
  commission_eur  integer GENERATED ALWAYS AS (
    ROUND(prix_signe * commission_pct / 100)
  ) STORED,
  date_signature  date,
  date_expiration date,
  statut          statut_mandat DEFAULT 'actif',
  notes           text,
  created_at      timestamptz DEFAULT NOW()
);

-- ── TABLE RAPPELS automatiques ───────────────────────────────────────────────

CREATE TABLE rappels (
  id                uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  vendeur_id        uuid REFERENCES vendeurs(id) ON DELETE CASCADE,
  canal             canal_contact,
  type_rappel       text,    -- j7, j14, j30, rdv, custom
  date_envoi_prevu  timestamptz NOT NULL,
  statut            statut_rappel DEFAULT 'en_attente',
  message_ia        text,    -- contenu généré par Claude
  date_envoi_reel   timestamptz,
  erreur            text,
  created_at        timestamptz DEFAULT NOW()
);

-- ── TABLE ZONES géographiques ────────────────────────────────────────────────

CREATE TABLE zones (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  nom          text NOT NULL,
  code_postal  text NOT NULL UNIQUE,
  geojson      jsonb,           -- polygone GeoJSON pour Leaflet
  active       boolean DEFAULT TRUE,
  nb_biens     integer DEFAULT 0,
  created_at   timestamptz DEFAULT NOW()
);

-- Données initiales zones Normandie / Caen
INSERT INTO zones (nom, code_postal, active) VALUES
  ('Caen Centre',          '14000', true),
  ('Biéville-Beuville',    '14112', true),
  ('IFS',                  '14123', true),
  ('Hérouville-Saint-Clair','14200', true),
  ('Louvigny',             '14320', true),
  ('Colombelles',          '14460', true),
  ('Carpiquet',            '14650', true),
  ('Bretteville-sur-Odon', '14760', true),
  ('Verson',               '14119', true),
  ('Mondeville',           '14120', false);

-- ── INDEX pour performances ──────────────────────────────────────────────────

CREATE INDEX idx_vendeurs_statut        ON vendeurs(statut);
CREATE INDEX idx_vendeurs_score         ON vendeurs(score_priorite DESC);
CREATE INDEX idx_biens_cp               ON biens(code_postal);
CREATE INDEX idx_biens_vendeur          ON biens(vendeur_id);
CREATE INDEX idx_biens_coords           ON biens(latitude, longitude) WHERE latitude IS NOT NULL;
CREATE INDEX idx_contacts_vendeur       ON contacts(vendeur_id);
CREATE INDEX idx_rappels_prevu          ON rappels(date_envoi_prevu) WHERE statut = 'en_attente';
CREATE INDEX idx_rappels_vendeur        ON rappels(vendeur_id);

-- ── TRIGGER updated_at ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_vendeurs_updated
  BEFORE UPDATE ON vendeurs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── VUES utiles ──────────────────────────────────────────────────────────────

-- Vendeurs à relancer aujourd'hui (pour le cron)
CREATE VIEW vendeurs_a_relancer AS
SELECT
  v.*,
  b.adresse,
  b.prix_demande,
  b.surface_m2,
  b.type_bien,
  b.code_postal,
  EXTRACT(day FROM NOW() - v.dernier_contact)::int AS jours_silence,
  COALESCE(
    (SELECT COUNT(*) FROM contacts c WHERE c.vendeur_id = v.id), 0
  ) AS total_contacts
FROM vendeurs v
JOIN biens b ON b.vendeur_id = v.id
WHERE v.statut NOT IN ('mandat', 'archive')
  AND (
    v.dernier_contact IS NULL
    OR NOW() - v.dernier_contact > INTERVAL '7 days'
  )
ORDER BY v.score_priorite DESC;

-- Dashboard stats
CREATE VIEW dashboard_stats AS
SELECT
  (SELECT COUNT(*) FROM vendeurs WHERE statut != 'archive')            AS total_vendeurs,
  (SELECT COUNT(*) FROM vendeurs WHERE statut = 'detecte')             AS nouveaux,
  (SELECT COUNT(*) FROM vendeurs WHERE statut = 'mandat')              AS mandats_signes,
  (SELECT COUNT(*) FROM biens)                                          AS total_biens,
  (SELECT COUNT(*) FROM rappels WHERE statut = 'en_attente')           AS rappels_en_attente,
  (SELECT COUNT(*) FROM contacts WHERE date_envoi > NOW() - INTERVAL '30 days') AS contacts_ce_mois,
  (SELECT COALESCE(SUM(commission_eur),0) FROM mandats WHERE statut = 'actif') AS ca_potentiel;

-- ── ROW LEVEL SECURITY ───────────────────────────────────────────────────────
-- Activer RLS (décommenter après avoir configuré l'auth)
-- ALTER TABLE vendeurs ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE biens    ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE mandats  ENABLE ROW LEVEL SECURITY;
-- ALTER TABLE rappels  ENABLE ROW LEVEL SECURITY;
