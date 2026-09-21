// ============================================================
// CONFIG.JS — Configuration de l'application
// ============================================================

const CONFIG = {

  // ── Saison ──────────────────────────────────────────────
  saison: "2026/2027",
  nbJournees: 34,
  nbMatchsParJournee: 9,

  // ── Votre compte (le premier joueur = vous) ──────────────
  joueurInitial: {
    id:     "etienne",
    nom:    "Etienne",
    code:   "170218",
    equipe: "Lyon",
    emoji:  "🦁",
  },

  // ── Code administrateur ──────────────────────────────────
  codeAdmin: "ADMIN99",

  // ── Barème des points ────────────────────────────────────
  bareme: {
    mauvais:  0,
    bonSens:  3,
    exact:    5,
    exact4b:  7,
    bonusJourneeSeuil:  8,   // nb minimum de bons pronos (bon sens OU exact) sur 9 pour le bonus
    bonusJourneePoints: 10,  // points accordés si le seuil est atteint
  },

  // ── Gains par journée ────────────────────────────────────
  gains: {
    premier:   6,
    deuxieme:  3,
    troisieme: 1,
    mise:      10,
  },

  // ── Bonus fin de saison ──────────────────────────────────
  bonusSaison: {
    top3Ordre:    50,
    top3Desordre: 25,
    top2sur3:     15,
    champion:     15,
    flop2Ordre:   25,   // 17e ET 18e trouvés, dans le bon ordre
    flop2Desordre: 15,  // 17e ET 18e trouvés, mais dans le désordre
    buteur:       15,
    nbuts:        10,
  },

  // ── Règles ───────────────────────────────────────────────
  regles: {
    delaiAvantMatchMinutes:   60,   // Fermeture saisie X min avant 1er match
    journeeDefaut:             0,   // 0 = auto-détection
    revelerApresSoumission: true,   // Voir les autres dès qu'on a soumis
    bonusSaisonDepuisJournee:  1,   // Bonus visible dès la journée X (1 = dès le début)
    bonusSaisonAvantJournee:   6,   // Doit être soumis avant le début de cette journée

    // ── Soumissions tardives ─────────────────────────────
    // Points attribués aux joueurs n'ayant JAMAIS soumis après clôture :
    //   "demi_minimum" = moitié du moins bon soumettant
    //   "zero"         = 0 point
    //   "demi_moyenne" = moitié de la moyenne des soumettants
    sansPronostic: "demi_minimum",

    // Pénalité (en pts) si soumission tardive (dans le délai de réouverture)
    // Les matchs déjà joués rapportent 0 pt, cette pénalité s'ajoute en négatif
    penaliteRetard: -5,

    // Délai max (en heures) après la deadline pour autoriser une réouverture
    // Au-delà, plus aucune réouverture possible, même admin
    delaiReouvretureHeures: 24,
  },

  // ── Firebase ─────────────────────────────────────────────
  firebase: {
    apiKey:            "AIzaSyC8C4GIoFmdRQxXTcMv8Dd0j7Y8IHvTP3c",
    authDomain:        "prono-ligue1-toussieux.firebaseapp.com",
    projectId:         "prono-ligue1-toussieux",
    storageBucket:     "prono-ligue1-toussieux.firebasestorage.app",
    messagingSenderId: "193024277227",
    appId:             "1:193024277227:web:789258d8b246b002e65cae",
  },

  // ── Apparence ────────────────────────────────────────────
  theme: {
    couleurPrimaire:   "#E8500A",
    couleurSecondaire: "#1F4E79",
    couleurVert:       "#1A7A3A",
    nomApp:            "Toussi'Pronos",
    descriptionApp:    "Toussi\'Pronos · Ligue 1 2026/2027",
  },

  // ── Messages de fin de journée (configurables dans Admin) ──
  // Un message aléatoire est choisi dans la liste correspondant au rang du
  // joueur, affiché une seule fois par journée à l'ouverture de l'app.
  messagesClassementDefaut: {
    premier: [
      "🏆 Journée en boss ! Tu domines le classement, continue comme ça !",
      "🥇 Premier de la journée, respect total !",
      "👑 Le roi de la journée, c'est toi !",
    ],
    deuxieme: [
      "🥈 Si proche de la victoire ! La prochaine est pour toi ?",
      "😤 Deuxième, à un cheveu du sommet — reviens plus fort !",
    ],
    avantDernier: [
      "😅 Pas passé loin de la dernière place... la prochaine journée te tend les bras pour remonter !",
      "🫣 Avant-dernier, ça sent le sapin... mais rien n'est perdu !",
    ],
    dernier: [
      "🙃 Dernier de la journée... mais premier au classement du courage !",
      "😂 Bon, disons que cette journée restera entre nous.",
      "🐌 Dernière place, mais la meilleure ambiance, promis.",
    ],
    autres: [
      "💪 Continue comme ça, la prochaine journée peut tout changer !",
      "⚽ Milieu de tableau, milieu tranquille — allez, on pousse un peu plus !",
      "🔥 Pas mal du tout, garde ce rythme !",
    ],
  },
};
