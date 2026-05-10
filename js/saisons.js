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

  const saisons   = await chargerListeSaisons();
  const courante  = saisonKey(CONFIG.saison);
  const monId     = APP.joueurActif?.id;

  let html = `<div style="padding:16px">`;

  for (const key of saisons) {
    const snap = await APP.db.collection('saisons').doc(key).get();
    const data = snap.exists ? snap.data() : {};
    const cloturee   = data.cloturee   || false;
    const label      = saisonLabel(key);
    const estCour    = key === courante;
    const estAffichee = APP.saisonAffichee === key;

    // ── En-tête de la carte saison ──────────────────────────
    html += `
      <div class="card" style="margin-bottom:20px">
        <div style="display:flex;align-items:center;justify-content:space-between;
                    margin-bottom:14px;flex-wrap:wrap;gap:8px">
          <div>
            <div class="card-title" style="margin-bottom:4px;font-size:16px">
              ${estCour ? '🟢' : '📁'} Saison ${label}
            </div>
            <span class="badge ${cloturee?'badge-bleu':estCour?'badge-vert':'badge-orange'}">
              ${cloturee ? 'Clôturée' : 'En cours'}
            </span>
            ${estAffichee ? '<span class="badge badge-orange" style="margin-left:4px">Affichée</span>' : ''}
          </div>
          <button onclick="basculerSaison('${key}')"
            style="background:${estAffichee?'var(--orange)':'var(--color-background-tertiary)'};
                   color:${estAffichee?'white':'var(--color-text-secondary)'};
                   border:none;border-radius:8px;padding:8px 14px;font-size:12px;
                   font-weight:500;cursor:pointer;transition:all 0.2s">
            ${estAffichee ? '✓ Saison active' : '👁 Voir cette saison'}
          </button>
        </div>`;

    // ── Infos championnat (vainqueur, buteur) ───────────────
    // Chercher dans les bonus la clé "reel" (résultats réels saisis par admin)
    const bonusSnap = await APP.db.collection('saisons').doc(key)
      .collection('bonus').doc('saison').get().catch(() => null);
    const bonusData = bonusSnap?.exists ? bonusSnap.data() : {};
    const reel = bonusData.reel || {};

    if (reel.champion || reel.buteur || reel.nbuts) {
      html += `
        <div style="background:linear-gradient(135deg,#0A1628,#1F4E79);
                    border-radius:10px;padding:12px 14px;margin-bottom:14px;
                    display:flex;flex-wrap:wrap;gap:12px;align-items:center">`;
      if (reel.champion) {
        html += `
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:20px">🏆</span>
            <div>
              <div style="font-size:10px;color:rgba(255,255,255,0.5);
                          text-transform:uppercase;letter-spacing:0.5px">Champion</div>
              <div style="font-size:14px;font-weight:700;color:#FFD700">${reel.champion}</div>
            </div>
          </div>`;
      }
      if (reel.buteur) {
        html += `
          <div style="display:flex;align-items:center;gap:8px">
            <span style="font-size:20px">⚽</span>
            <div>
              <div style="font-size:10px;color:rgba(255,255,255,0.5);
                          text-transform:uppercase;letter-spacing:0.5px">Meilleur buteur</div>
              <div style="font-size:14px;font-weight:700;color:white">
                ${reel.buteur}${reel.nbuts ? ` <span style="color:rgba(255,255,255,0.6);font-size:12px">(${reel.nbuts} buts)</span>` : ''}
              </div>
            </div>
          </div>`;
      }
      html += `</div>`;
    } else if (APP.estAdmin) {
      html += `
        <div style="background:var(--color-background-tertiary);border-radius:8px;
                    padding:8px 12px;margin-bottom:12px;font-size:12px;
                    color:var(--color-text-secondary);display:flex;align-items:center;
                    justify-content:space-between">
          <span>ℹ️ Champion et buteur non renseignés</span>
          <button onclick="ouvrirSaisieInfosChampionnat('${key}')"
            style="background:var(--orange);color:white;border:none;border-radius:6px;
                   padding:4px 10px;font-size:11px;cursor:pointer;font-weight:500">
            ✏️ Renseigner
          </button>
        </div>`;
    }

    // ── Classement joueurs ───────────────────────────────────
    let classement = [];
    if (cloturee && data.palmares) {
      // Saison clôturée → palmarès figé
      classement = data.palmares;
    } else {
      // Saison en cours → calcul live
      classement = await calculerPalmaresFinSaison(key);
    }

    if (classement.length > 0) {
      const monIdx = classement.findIndex(j => j.id === monId);

      html += `<div style="margin-bottom:4px">`;

      // Fonction pour une ligne de classement
      const ligneClassement = (j, rang, isMe = false) => {
        const medals = {1:'🥇',2:'🥈',3:'🥉'};
        const isLast3 = rang > classement.length - 3;
        return `
          <div class="classement-row ${isMe ? 'moi' : ''}"
            style="margin-bottom:4px;${isLast3 && !medals[rang] ? 'opacity:0.7' : ''}">
            <div class="rang-badge ${rang<=3?'rang-'+rang:'rang-other'}"
              style="${isLast3 && !medals[rang] ? 'background:#FFE0E0;color:#C00000' : ''}">
              ${medals[rang] || rang}
            </div>
            <div class="classement-nom">${j.emoji || '⚽'} ${j.nom}</div>
            <div class="classement-pts">${j.pts}<span>pts</span></div>
            <div class="classement-gains">${j.gains}€</div>
          </div>`;
      };

      // Top 3
      html += `<div style="font-size:10px;font-weight:500;color:var(--color-text-secondary);
                           text-transform:uppercase;letter-spacing:0.5px;
                           margin-bottom:6px;margin-top:4px">🏆 Top 3</div>`;
      classement.slice(0, 3).forEach((j, i) => {
        html += ligneClassement(j, i + 1, j.id === monId);
      });

      // Séparateur si plus de 6 joueurs
      if (classement.length > 6) {
        html += `
          <div style="text-align:center;font-size:11px;color:var(--color-text-secondary);
                      padding:4px 0;margin:2px 0">
            · · · ${classement.length - 6} joueur(s) · · ·
          </div>`;
      }

      // Flop 3 (si au moins 4 joueurs)
      if (classement.length >= 4) {
        const flop = classement.slice(-3);
        html += `<div style="font-size:10px;font-weight:500;color:var(--color-text-secondary);
                             text-transform:uppercase;letter-spacing:0.5px;
                             margin-bottom:6px;margin-top:4px">📉 Flop 3</div>`;
        flop.forEach((j, i) => {
          html += ligneClassement(j, classement.length - 2 + i, j.id === monId);
        });
      }

      // Si le joueur connecté est dans le milieu de tableau → afficher sa position
      if (monIdx >= 3 && monIdx < classement.length - 3) {
        html += `
          <div style="border-top:1px dashed var(--color-border-tertiary);
                      padding-top:6px;margin-top:4px">
            <div style="font-size:10px;font-weight:500;color:var(--orange);
                        text-transform:uppercase;letter-spacing:0.5px;margin-bottom:4px">
              Ma position
            </div>
            ${ligneClassement(classement[monIdx], monIdx + 1, true)}
          </div>`;
      }

      html += `</div>`;

    } else {
      html += `<p class="text-sm text-muted" style="padding:8px 0">
        Aucune donnée disponible pour cette saison.</p>`;
    }

    // ── Bouton clôture (admin, saison courante) ─────────────
    if (APP.estAdmin && estCour && !cloturee) {
      html += `
        <hr class="divider">
        <button onclick="confirmerClotureSaison()"
          style="width:100%;padding:10px;background:#C00000;color:white;border:none;
                 border-radius:8px;font-size:13px;font-weight:500;cursor:pointer">
          🏁 Clôturer la saison ${label}
        </button>`;
    }

    html += `</div>`; // fin card
  }

  // ── Créer une saison de test (admin) ─────────────────────
  if (APP.estAdmin) {
    html += `
      <div class="card" style="border:1px dashed var(--color-border-tertiary)">
        <div class="card-title">➕ Créer une saison</div>
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

// ── Saisie admin : champion et buteur ────────────────────────
function ouvrirSaisieInfosChampionnat(saisonKey_) {
  document.getElementById('modal-title').textContent = '🏆 Infos championnat';
  document.getElementById('modal-body').innerHTML = `
    <p class="text-sm text-muted" style="margin-bottom:14px">
      Renseignez les informations réelles du championnat ${saisonLabel(saisonKey_)}.
    </p>
    <label class="profil-label">🏆 Champion</label>
    <input class="profil-input" id="reel-champion" placeholder="Ex: Paris SG" style="margin-bottom:10px">
    <label class="profil-label">⚽ Meilleur buteur</label>
    <input class="profil-input" id="reel-buteur" placeholder="Ex: Mbappé" style="margin-bottom:10px">
    <label class="profil-label">🔢 Nombre de buts</label>
    <input type="number" class="profil-input" id="reel-nbuts"
      placeholder="Ex: 27" min="0" max="60" style="margin-bottom:16px">
    <button class="btn-primary" onclick="sauverInfosChampionnat('${saisonKey_}')">
      💾 Enregistrer
    </button>`;
  ouvrirModal();
}

async function sauverInfosChampionnat(saisonKey_) {
  const champion = document.getElementById('reel-champion')?.value?.trim();
  const buteur   = document.getElementById('reel-buteur')?.value?.trim();
  const nbuts    = document.getElementById('reel-nbuts')?.value;
  if (!champion && !buteur) { showToast('Renseignez au moins un champ', 'warning'); return; }
  try {
    await APP.db.collection('saisons').doc(saisonKey_)
      .collection('bonus').doc('saison')
      .set({ reel: { champion, buteur, nbuts: nbuts ? parseInt(nbuts) : null } }, { merge: true });
    fermerModal();
    showToast('✅ Infos championnat enregistrées !', 'success');
    chargerPalmares();
  } catch(e) { showToast('Erreur', 'error'); }
}


// ── Basculer vers une saison ──────────────────────────────
async function basculerSaison(key) {
  APP.saisonAffichee = key;

  // Charger le statut de clôture depuis Firestore
  try {
    const snap = await APP.db.collection('saisons').doc(key).get();
    APP.saisonEstCloturee = snap.exists ? (snap.data().cloturee === true) : false;
  } catch(e) {
    APP.saisonEstCloturee = false;
  }

  // Mettre à jour le span #header-saison
  const hSaison = document.getElementById('header-saison');
  if (hSaison) hSaison.textContent = saisonLabel(key);

  // Bandeau saison archivée dans le header
  const indicateur = document.getElementById('saison-indicateur');
  if (indicateur) {
    if (!estSaisonCourante()) {
      indicateur.style.display = 'flex';
      const lbl = indicateur.querySelector('.saison-ind-label');
      if (lbl) lbl.textContent = `Consultation saison ${saisonLabel(key)} (archivée)`;
    } else {
      indicateur.style.display = 'none';
      // Restaurer la saison courante dans le header
      const hS = document.getElementById('header-saison');
      if (hS) hS.textContent = CONFIG.saison;
    }
  }

  // Recharger l'onglet actif
  chargerTab('palmares');
  showToast(`Saison ${saisonLabel(key)} ${estSaisonCourante() ? '(en cours)' : '(archivée)'}`, 'default');
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
