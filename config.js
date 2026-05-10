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
    flop3Ordre:   25,
    flop2sur3:    15,
    buteur:       15,
    nbuts:        10,
  },

  // ── Règles ───────────────────────────────────────────────
  regles: {
    delaiAvantMatchMinutes:   60,   // Fermeture saisie X min avant 1er match
    journeeDefaut:             0,   // 0 = auto-détection
    revelerApresSoumission: true,   // Voir les autres dès qu'on a soumis
    bonusSaisonDepuisJournee:  5,   // Bonus dispo à partir de la journée X

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
    nomApp:            "Pronostics L1",
    descriptionApp:    "Toussi'Potes · Ligue 1 2026/2027",
  },
};
