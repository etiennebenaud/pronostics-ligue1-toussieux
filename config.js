// ============================================================
// CONFIG.JS — Configuration de l'application
// Seuls les réglages ci-dessous sont à toucher.
// Les joueurs se gèrent depuis l'app (onglet ⚙️ Admin › Joueurs)
// ============================================================

const CONFIG = {

  // ── Saison ──────────────────────────────────────────────
  saison: "2026/2027",
  nbJournees: 38,
  nbMatchsParJournee: 9,

  // ── Votre compte (le premier joueur = vous) ──────────────
  // Les autres se créent depuis l'app, sans limite de nombre.
  joueurInitial: {
    id:     "admin_joueur",
    nom:    "Moi",           // ← Votre prénom
    code:   "MON_CODE",      // ← Votre code secret personnel
    equipe: "Mon équipe",    // ← Votre équipe favorite
    emoji:  "⚽",
  },

  // ── Code administrateur ──────────────────────────────────
  // Différent de votre code joueur — donne accès à la gestion
  codeAdmin: "ADMIN99",      // ← À changer absolument !

  // ── Barème des points ────────────────────────────────────
  bareme: {
    mauvais:  0,   // Mauvais sens (victoire/défaite/nul inversé)
    bonSens:  3,   // Bon sens mais score faux
    exact:    5,   // Score exact
    exact4b:  7,   // Score exact + total ≥ 4 buts
  },

  // ── Gains par journée ────────────────────────────────────
  gains: {
    premier:   6,  // € pour le 1er
    deuxieme:  3,  // € pour le 2ème
    troisieme: 1,  // € pour le 3ème
    mise:      10, // € mise totale par journée
  },

  // ── Bonus fin de saison ──────────────────────────────────
  bonusSaison: {
    top3Ordre:    50,  // Top 3 dans l'ordre exact
    top3Desordre: 25,  // Top 3 dans le désordre
    top2sur3:     15,  // 2 équipes sur 3 dans le top
    champion:     15,  // Champion exact
    flop3Ordre:   25,  // Flop 3 dans l'ordre exact
    flop2sur3:    15,  // 2 relégués sur 3 trouvés
    buteur:       15,  // Meilleur buteur exact
    nbuts:        10,  // Nombre de buts exact du buteur
  },

  // ── Règles ───────────────────────────────────────────────
  regles: {
    delaiAvantMatchMinutes:   60,  // Fermeture saisie X min avant 1er match
    journeeDefaut:             0,  // 0 = auto-détection
    revelerApresSoumission: true,  // Voir les autres dès qu'on a soumis
    bonusSaisonDepuisJournee:  5,  // Bonus dispo à partir de la journée X
  },

  // ── Firebase ─────────────────────────────────────────────
  // Collez ici les valeurs de votre projet Firebase
  firebase: {
    apiKey:            "VOTRE_API_KEY",
    authDomain:        "VOTRE_PROJECT.firebaseapp.com",
    projectId:         "VOTRE_PROJECT_ID",
    storageBucket:     "VOTRE_PROJECT.appspot.com",
    messagingSenderId: "VOTRE_SENDER_ID",
    appId:             "VOTRE_APP_ID",
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
