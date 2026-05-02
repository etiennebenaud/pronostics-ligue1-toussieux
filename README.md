# ⚽ Pronostics Ligue 1 — Guide d'installation complet

## Ce que vous allez mettre en place

```
Vos fichiers (GitHub Pages)          Base de données (Firebase)
      ↓                                      ↓
index.html  ←──── config.js ────→  Firestore (Google)
css/style.css                       (données en temps réel)
js/app.js                           (gratuit, géré par Google)
```

---

## ÉTAPE 1 — Créer le projet Firebase (10 min)

1. Allez sur **https://console.firebase.google.com**
2. Cliquez **"Créer un projet"**
3. Nom : `pronostics-ligue1` (ou ce que vous voulez)
4. Désactivez Google Analytics (pas nécessaire) → **Créer le projet**
5. Une fois créé, cliquez **"Web"** (icône `</>`) pour ajouter une app web
6. Nom de l'app : `pronostics-app` → **Enregistrer l'app**
7. Copiez le bloc `firebaseConfig` qui apparaît — il ressemble à ça :
   ```javascript
   const firebaseConfig = {
     apiKey: "AIzaSy...",
     authDomain: "pronostics-ligue1.firebaseapp.com",
     projectId: "pronostics-ligue1",
     storageBucket: "pronostics-ligue1.appspot.com",
     messagingSenderId: "123456789",
     appId: "1:123456789:web:abc123"
   };
   ```
8. Cliquez **"Continuer vers la console"**

### Activer Firestore
1. Dans le menu gauche : **Firestore Database**
2. **"Créer une base de données"**
3. Choisissez **"Commencer en mode test"** → **Suivant**
4. Région : **`europe-west1`** (serveurs en Europe) → **Activer**
5. Attendez 1 minute que la base se crée

### Configurer les règles de sécurité
1. Dans Firestore, onglet **"Règles"**
2. Remplacez tout le contenu par celui du fichier `firestore.rules`
3. **Publier**

---

## ÉTAPE 2 — Configurer l'application (5 min)

Ouvrez le fichier **`config.js`** et modifiez :

### Section Firebase
```javascript
firebase: {
  apiKey:            "Collez ici votre apiKey",
  authDomain:        "votre-projet.firebaseapp.com",
  projectId:         "votre-projet-id",
  storageBucket:     "votre-projet.appspot.com",
  messagingSenderId: "votre-sender-id",
  appId:             "votre-app-id",
},
```

### Section Joueurs (optionnel — changez codes et équipes)
```javascript
joueurs: [
  { id: "bertrand", nom: "Bertrand", code: "BERT01", equipe: "Lyon", emoji: "🦁" },
  // ... etc
],
```

### Code admin
```javascript
codeAdmin: "ADMIN99",  // Changez ce code !
```

---

## ÉTAPE 3 — Créer le compte GitHub et publier (15 min)

1. Allez sur **https://github.com** → **Sign up** (gratuit)
2. Créez un compte avec votre email
3. Une fois connecté, cliquez **"New repository"** (bouton vert)
4. Nom du dépôt : `pronostics-ligue1`
5. Visibilité : **Public** (obligatoire pour GitHub Pages gratuit)
6. Cliquez **"Create repository"**

### Uploader les fichiers
7. Sur la page du dépôt vide, cliquez **"uploading an existing file"**
8. Glissez-déposez **tous les fichiers** du dossier `pronostics-app` :
   - `index.html`
   - `config.js`
   - `manifest.json`
   - `css/style.css`
   - `js/app.js`
   - `assets/` (dossier avec les icônes)
9. Cliquez **"Commit changes"**

### Activer GitHub Pages
10. Allez dans **Settings** (onglet en haut)
11. Dans le menu gauche : **Pages**
12. Under "Source" : choisissez **"Deploy from a branch"**
13. Branch : **main** / **/(root)** → **Save**
14. Attendez 2-3 minutes
15. Votre URL apparaît : **`https://votre-nom.github.io/pronostics-ligue1`**

---

## ÉTAPE 4 — Ajouter les icônes (5 min)

Pour que l'app soit installable, vous avez besoin de 2 icônes :
- `assets/icon-192.png` (192×192 pixels)
- `assets/icon-512.png` (512×512 pixels)

Option rapide : utilisez un emoji ⚽ converti en PNG sur **https://favicon.io/emoji-favicons/** (icône soccer ball)

---

## ÉTAPE 5 — Tester et partager

1. Ouvrez l'URL sur votre téléphone : `https://votre-nom.github.io/pronostics-ligue1`
2. Testez avec le code `BERT01` (Bertrand)
3. Testez avec `ADMIN99` pour le mode admin
4. Partagez l'URL aux autres joueurs par SMS ou WhatsApp
5. Sur iPhone : Safari → icône Partager → **"Sur l'écran d'accueil"**
   Sur Android : Chrome → menu → **"Ajouter à l'écran d'accueil"**

---

## Utilisation semaine par semaine

### L'organisateur (admin) chaque semaine :
1. Ouvrez l'app avec le code `ADMIN99`
2. Onglet **Grille** → bouton **⚙️ Admin** → **Définir la deadline** (1h avant le 1er match)
3. Mettez à jour les équipes et dates dans la base Firestore directement
   *(ou attendez le calendrier auto quand il sera disponible)*
4. Après les matchs → onglet **Résultats** → saisissez les scores réels

### Les joueurs chaque semaine :
1. Ouvrez l'app, entrez votre code
2. Onglet **Grille** → saisissez vos 9 pronostics
3. Cliquez **✅ Soumettre mes pronostics**
4. Les pronostics des autres soumis apparaissent automatiquement
5. Après les matchs → onglet **Résultats** pour voir les points

---

## Mettre à jour l'application

**Modifier `config.js`** (changer un code, un nom, un barème) :
1. Sur GitHub, ouvrez `config.js`
2. Cliquez l'icône crayon ✏️
3. Modifiez → **"Commit changes"**
4. Les joueurs voient la mise à jour en re-ouvrant l'URL (automatique)

**Corriger un bug dans `js/app.js`** :
1. Même procédure — modifier sur GitHub → commit
2. Déploiement automatique en 1-2 minutes

**Les données Firebase ne sont jamais perdues** lors d'une mise à jour du code.

---

## Structure des fichiers

```
pronostics-ligue1/
├── index.html          ← Page principale (ne pas modifier souvent)
├── config.js           ← ⭐ TOUT ce qui est configurable (modifier ici)
├── manifest.json       ← Config PWA (icônes, nom d'app)
├── firestore.rules     ← Règles de sécurité Firebase (déjà appliquées)
├── css/
│   └── style.css       ← Styles visuels (couleurs, mise en page)
├── js/
│   └── app.js          ← Logique de l'application
└── assets/
    ├── icon-192.png    ← Icône app 192px
    └── icon-512.png    ← Icône app 512px
```

---

## En cas de problème

**"L'app ne se charge pas"**
→ Vérifiez que les clés Firebase dans `config.js` sont correctes
→ Ouvrez la console du navigateur (F12) et regardez les erreurs en rouge

**"Le code ne fonctionne pas"**
→ Vérifiez dans `config.js` que les codes correspondent exactement (majuscules)

**"Les données ne se sauvegardent pas"**
→ Vérifiez les règles Firestore (Étape 1 / configurer les règles)

**Modifier les équipes de la saison prochaine**
→ Changez uniquement `config.js` : `saison: "2027/2028"` et les codes si besoin

---

## Codes par défaut (à communiquer aux joueurs)

| Joueur     | Code    |
|------------|---------|
| Bertrand   | BERT01  |
| Chi-Paul   | CHIP02  |
| Etienne    | ETIE03  |
| Fabien     | FABI04  |
| Guillaume  | GUIL05  |
| Nicolas    | NICO06  |
| Rémy       | REMY07  |
| Stéphane   | STEP08  |
| Thomas     | THOM09  |
| Victorien  | VICT10  |
| **Admin**  | **ADMIN99** |

⚠️ **Changez ces codes avant de partager l'app !** (dans `config.js`)
