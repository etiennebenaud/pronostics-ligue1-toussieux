// ============================================================
// SAISONS.JS — Gestion multi-saisons
// ============================================================

// ── Saison active dans l'app (pas forcément la courante) ──
// APP.saisonAffichee : ex "2026-2027"
// APP.saisonCourante : ex "2026-2027" (depuis config.js)

// Convertit "2026/2027" → "2026-2027" (clé Firestore)
function saisonKey(s) {
  return (s || CONFIG.saison).replace('/', '-');
}

// Convertit "2026-2027" → "2026/2027" (affichage)
function saisonLabel(k) {
  return k.replace('-', '/');
}

// ── Référence Firestore avec préfixe saison ───────────────
function dbSaison(collection, doc) {
  const key = APP.saisonAffichee || saisonKey(CONFIG.saison);
  if (doc) return APP.db.collection('saisons').doc(key).collection(collection).doc(doc);
  return APP.db.collection('saisons').doc(key).collection(collection);
}

// ── Charger la liste de toutes les saisons disponibles ────
async function chargerListeSaisons() {
  try {
    const snap = await APP.db.collection('saisons').get();
    const saisons = [];
    snap.forEach(doc => saisons.push(doc.id));
    // Ajouter la saison courante si pas encore en base
    const courante = saisonKey(CONFIG.saison);
    if (!saisons.includes(courante)) saisons.push(courante);
    // Trier décroissant (plus récent en premier)
    saisons.sort((a, b) => b.localeCompare(a));
    APP.listeSaisons = saisons;
    return saisons;
  } catch(e) {
    console.error('chargerListeSaisons:', e);
    return [saisonKey(CONFIG.saison)];
  }
}

// ── Est-ce que la saison affichée est la courante ? ───────
function estSaisonCourante() {
  return (APP.saisonAffichee || saisonKey(CONFIG.saison)) === saisonKey(CONFIG.saison);
}

// ── Initialiser une nouvelle saison en base ───────────────
async function initialiserSaison(key) {
  await APP.db.collection('saisons').doc(key).set({
    creeLe:  Date.now(),
    label:   saisonLabel(key),
    cloturee: false,
  }, { merge: true });
}

// ── Clôturer la saison courante ───────────────────────────
async function cloturerSaison() {
  const key = saisonKey(CONFIG.saison);

  // Calculer le palmarès final
  const palmares = await calculerPalmaresFinSaison(key);

  // Marquer la saison comme clôturée
  await APP.db.collection('saisons').doc(key).set({
    cloturee:  true,
    clotureeAt: Date.now(),
    palmares,
  }, { merge: true });

  showToast(`✅ Saison ${saisonLabel(key)} clôturée !`, 'success');
  return palmares;
}

// ── Calculer le palmarès d'une saison ─────────────────────
async function calculerPalmaresFinSaison(key) {
  const joueurs = APP.joueurs;
  const totaux  = Object.fromEntries(joueurs.map(jo => [jo.id, { pts: 0, gains: 0, nom: jo.nom, emoji: jo.emoji }]));

  // Charger toutes les journées de la saison
  for (let j = 1; j <= CONFIG.nbJournees; j++) {
    try {
      const snap = await APP.db.collection('saisons').doc(key)
        .collection('journees').doc(`j${j}`).get();
      if (!snap.exists) continue;
      const { matchs = [], soumissions = {} } = snap.data();

      const ptsJ = {};
      joueurs.forEach(jo => {
        ptsJ[jo.id] = matchs.reduce((acc, match, idx) => {
          const p = soumissions[jo.id]?.[idx];
          return acc + (p && match.scoreReel ? calculerPoints(p, match.scoreReel) || 0 : 0);
        }, 0);
        totaux[jo.id].pts += ptsJ[jo.id];
      });

      const sorted = joueurs.slice().sort((a, b) => ptsJ[b.id] - ptsJ[a.id]);
      if (sorted[0] && ptsJ[sorted[0].id] > 0) totaux[sorted[0].id].gains += CONFIG.gains.premier;
      if (sorted[1] && ptsJ[sorted[1].id] > 0) totaux[sorted[1].id].gains += CONFIG.gains.deuxieme;
      if (sorted[2] && ptsJ[sorted[2].id] > 0) totaux[sorted[2].id].gains += CONFIG.gains.troisieme;
    } catch(e) { /* journée vide */ }
  }

  return Object.values(totaux).sort((a, b) => b.pts - a.pts);
}

// ── ONGLET PALMARÈS ───────────────────────────────────────
async function chargerPalmares() {
  const container = document.getElementById('tab-palmares');
  container.innerHTML = `<div style="padding:16px"><div class="loading"><div class="spinner"></div>Chargement...</div></div>`;

  const saisons = await chargerListeSaisons();
  const courante = saisonKey(CONFIG.saison);

  let html = `<div style="padding:16px">`;

  for (const key of saisons) {
    const snap = await APP.db.collection('saisons').doc(key).get();
    const data = snap.exists ? snap.data() : {};
    const cloturee = data.cloturee || false;
    const label    = saisonLabel(key);
    const estCourante = key === courante;

    html += `
      <div class="card" style="margin-bottom:16px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div>
            <div class="card-title" style="margin-bottom:2px">
              ${estCourante ? '🟢' : '📁'} Saison ${label}
            </div>
            <span class="badge ${cloturee ? 'badge-bleu' : estCourante ? 'badge-vert' : 'badge-orange'}">
              ${cloturee ? 'Clôturée' : estCourante ? 'En cours' : 'En cours'}
            </span>
          </div>
          <button onclick="basculerSaison('${key}')"
            style="background:${APP.saisonAffichee===key?'var(--orange)':'var(--color-background-tertiary)'};
                   color:${APP.saisonAffichee===key?'white':'var(--color-text-secondary)'};
                   border:none;border-radius:8px;padding:6px 12px;font-size:12px;
                   font-weight:500;cursor:pointer">
            ${APP.saisonAffichee === key ? '✓ Affichée' : 'Voir'}
          </button>
        </div>`;

    // Palmarès final si clôturée, sinon classement live
    if (cloturee && data.palmares) {
      html += `<div style="margin-top:4px">`;
      data.palmares.slice(0, 3).forEach((j, i) => {
        const medals = ['🥇','🥈','🥉'];
        html += `
          <div class="classement-row" style="opacity:0.85">
            <div class="rang-badge rang-${i+1}">${medals[i]}</div>
            <div class="classement-nom">${j.emoji} ${j.nom}</div>
            <div class="classement-pts">${j.pts}<span>pts</span></div>
            <div class="classement-gains">${j.gains}€</div>
          </div>`;
      });
      if (data.clotureeAt) {
        html += `<p class="text-sm text-muted" style="margin-top:8px;text-align:right">
          Clôturée le ${new Date(data.clotureeAt).toLocaleDateString('fr-FR')}</p>`;
      }
      html += `</div>`;
    } else {
      html += `<p class="text-sm text-muted">Saison en cours — classement disponible dans l'onglet 🏆</p>`;
    }

    html += `</div>`;
  }

  // Bouton créer une saison test (admin)
  if (APP.estAdmin) {
    html += `
      <div class="card" style="border: 1px dashed var(--color-border-tertiary)">
        <div class="card-title">➕ Créer une saison</div>
        <p class="text-sm text-muted" style="margin-bottom:10px">
          Pour ajouter une saison de test ou une nouvelle saison.
        </p>
        <input class="profil-input" id="input-nouvelle-saison"
          placeholder="Ex: 2025/2026" style="margin-bottom:8px">
        <button class="btn-primary" onclick="creerNouvelleSaison()">
          Créer cette saison
        </button>
      </div>`;
  }

  html += `</div>`;
  container.innerHTML = html;
}

// ── Basculer vers une saison ──────────────────────────────
function basculerSaison(key) {
  APP.saisonAffichee = key;
  // Mettre à jour le badge J.X dans le header
  const badge = document.getElementById('header-saison-badge');
  if (badge) badge.textContent = saisonLabel(key);
  // Afficher un indicateur si saison archivée
  const indicateur = document.getElementById('saison-indicateur');
  if (indicateur) {
    if (!estSaisonCourante()) {
      indicateur.style.display = 'flex';
      indicateur.querySelector('.saison-ind-label').textContent =
        `📁 Saison archivée : ${saisonLabel(key)}`;
    } else {
      indicateur.style.display = 'none';
    }
  }
  // Recharger l'onglet actif
  chargerTab('palmares');
  showToast(`Affichage : saison ${saisonLabel(key)}`, 'default');
}

// ── Créer une nouvelle saison (admin) ─────────────────────
async function creerNouvelleSaison() {
  const val = document.getElementById('input-nouvelle-saison')?.value?.trim();
  if (!val || !val.includes('/')) {
    showToast('Format invalide. Ex: 2025/2026', 'error');
    return;
  }
  const key = saisonKey(val);
  try {
    await initialiserSaison(key);
    APP.listeSaisons = APP.listeSaisons || [];
    if (!APP.listeSaisons.includes(key)) APP.listeSaisons.push(key);
    showToast(`✅ Saison ${val} créée !`, 'success');
    chargerPalmares();
  } catch(e) {
    showToast('Erreur création saison', 'error');
  }
}

// ── Admin : clôturer la saison courante ───────────────────
async function confirmerClotureSaison() {
  const label = CONFIG.saison;
  if (!confirm(`Clôturer définitivement la saison ${label} ?\n\n` +
               `Le palmarès final sera calculé et figé.\n` +
               `La saison passera en mode lecture seule pour tous.`)) return;

  try {
    showToast('Calcul du palmarès...', 'default');
    await cloturerSaison();
    fermerModal();
    chargerPalmares();
  } catch(e) {
    console.error(e);
    showToast('Erreur lors de la clôture', 'error');
  }
}
