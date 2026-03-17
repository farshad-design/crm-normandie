# CRM Immo Normandie — Guide de déploiement complet

Application CRM immobilier pour la zone Caen 14000 et communes voisines.
Agents IA automatiques (emails + SMS), carte interactive, pipeline mandats.

---

## Stack technique

| Composant       | Service                  | Coût estimé     |
|----------------|--------------------------|-----------------|
| Frontend/API   | Next.js 14 sur Vercel    | Gratuit         |
| Base de données| Supabase (PostgreSQL)    | Gratuit (< 500MB)|
| IA générative  | Claude API (Anthropic)   | ~10–30 €/mois   |
| SMS            | Twilio                   | ~0.07 €/SMS     |
| Email          | Brevo (ex-Sendinblue)    | Gratuit (300/j) |
| Cron agents    | Railway                  | ~5 €/mois       |

**Total estimé : 20–50 €/mois** selon le volume

---

## 1. Prérequis

- Node.js 18+
- Compte Supabase (gratuit) : https://supabase.com
- Compte Anthropic : https://console.anthropic.com
- Compte Twilio : https://twilio.com
- Compte Brevo : https://brevo.com

---

## 2. Installation locale

```bash
# Cloner / décompresser le projet
cd crm-normandie

# Installer les dépendances
npm install

# Copier le fichier d'environnement
cp .env.example .env.local
# ⚠️ Remplir toutes les valeurs dans .env.local

# Lancer en développement
npm run dev
# → http://localhost:3000
```

---

## 3. Configuration Supabase

1. Créer un projet sur https://supabase.com
2. Aller dans **SQL Editor**
3. Copier/coller le contenu de `supabase-schema.sql`
4. Cliquer **Run** — toutes les tables sont créées automatiquement
5. Récupérer les clés dans **Settings > API** :
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`

---

## 4. Configuration Anthropic (Claude)

1. Aller sur https://console.anthropic.com
2. **API Keys > Create Key**
3. Copier la clé dans `ANTHROPIC_API_KEY`

---

## 5. Configuration Twilio (SMS)

1. Créer un compte sur https://twilio.com
2. Aller dans **Console > Phone Numbers > Manage > Buy a number**
   - Choisir un numéro français (+33)
3. Récupérer dans le Dashboard :
   - `TWILIO_ACCOUNT_SID`
   - `TWILIO_AUTH_TOKEN`
   - `TWILIO_PHONE` (votre numéro acheté)

> ⚠️ En compte d'essai Twilio, vous pouvez seulement envoyer à des numéros vérifiés.
> Passer en compte payant pour envoyer à tous.

---

## 6. Configuration Brevo (Email)

1. Créer un compte sur https://brevo.com
2. **SMTP & API > SMTP**
3. Générer un mot de passe SMTP
4. Remplir `SMTP_USER` et `SMTP_PASS`

---

## 7. Déploiement Vercel (frontend + API)

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel

# Ajouter les variables d'environnement
vercel env add ANTHROPIC_API_KEY
vercel env add NEXT_PUBLIC_SUPABASE_URL
# ... (toutes les variables de .env.example)

# Redéployer avec les variables
vercel --prod
```

---

## 8. Déploiement agents cron (Railway)

Les agents automatiques (email + SMS + scoring) tournent en Node.js séparé.

```bash
# Installer Railway CLI
npm i -g @railway/cli

# Login et créer un projet
railway login
railway init

# Déployer le cron
railway up

# Ajouter les variables dans Railway Dashboard
# (mêmes que .env.local)

# Vérifier les logs
railway logs
```

Le fichier `lib/cron.js` tournera en continu et enverra :
- 📧 Emails chaque jour à 9h00
- 📱 SMS chaque jour à 10h30
- 🎯 Rescoring chaque lundi à 8h00

---

## 9. Structure du projet

```
crm-normandie/
├── pages/
│   ├── index.js              # Page principale CRM
│   └── api/
│       ├── vendeurs.js       # CRUD vendeurs
│       ├── biens.js          # CRUD biens + carte
│       └── generer.js        # Génération IA email/SMS
├── components/
│   ├── MapCRM.jsx            # Carte Leaflet interactive
│   ├── VendeursTable.jsx     # Tableau vendeurs filtrable
│   ├── PipelineKanban.jsx    # Kanban pipeline mandats
│   ├── AgentsPanel.jsx       # Interface agents IA
│   └── DashboardStats.jsx    # Métriques tableau de bord
├── lib/
│   ├── supabase.js           # Toutes les fonctions CRUD
│   ├── cron.js               # Orchestrateur cron
│   └── agents/
│       ├── agent-email.js    # Agent emails Claude+Nodemailer
│       ├── agent-sms.js      # Agent SMS Claude+Twilio
│       └── agent-scoring.js  # Scoring priorité vendeurs
├── supabase-schema.sql       # Schéma BDD complet
├── .env.example              # Template variables
└── package.json
```

---

## 10. Utilisation quotidienne

### Ajouter un vendeur manuellement
```
POST /api/vendeurs
{
  "vendeur": { "nom": "Martin", "prenom": "Laurent", "email": "...", "telephone": "..." },
  "bien": { "adresse": "14 rue...", "code_postal": "14000", "prix_demande": 285000, "surface_m2": 95 }
}
```
→ Géocodage automatique, score calculé, rappels J+7/J+14/J+30 planifiés

### Générer un email IA
```
POST /api/generer
{ "canal": "email", "type": "premier_contact", "vendeur": {...}, "bien": {...} }
```

### Lancer les agents manuellement
```bash
npm run agent:email   # Traite tous les emails en attente
npm run agent:sms     # Traite tous les SMS en attente
npm run agent:scan    # Scan nouvelles annonces (PAP.fr)
npm run cron          # Démarre le cron complet
```

---

## 11. Légalité du scraping

⚠️ **Avant de scraper des sites immobiliers :**
- **PAP.fr** : vente particulier à particulier, généralement accepté si robots.txt respecté
- **LeBonCoin** : scraping interdit par CGU — utiliser leur API partenaire ou des leads manuels
- **SeLoger** : scraping interdit — API disponible pour professionnels

**Alternatives légales recommandées :**
- API DVF (Demandes de Valeurs Foncières) : https://dvf.data.gouv.fr (gratuit, données officielles)
- API BANO (adresses) : https://api-adresse.data.gouv.fr
- Saisie manuelle dans le CRM
- Import CSV d'annonces

---

## Support

Généré avec Claude (Anthropic) — Personnalisez selon vos besoins.
