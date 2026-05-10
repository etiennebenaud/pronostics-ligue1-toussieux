// ============================================================
// APP.JS — Logique principale (version propre, sans conflits)
// ============================================================

const APP = {
  db: null, joueurActif: null, joueurs: [],
  estAdmin: false, journeeActive: 1,
  ecouteurs: [], deferredInstall: null,
  saisonAffichee: null,  // null = saison courante
  listeSaisons: [],
  equipesL1: [],  // chargées dynamiquement depuis TheSportsDB
};

// ── Démarrage ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOMContentLoaded déclenché');
  document.documentElement.style.setProperty('--orange', CONFIG.theme.couleurPrimaire);
  document.documentElement.style.setProperty('--bleu',   CONFIG.theme.couleurSecondaire);
  document.documentElement.style.setProperty('--vert',   CONFIG.theme.couleurVert);
  document.querySelector('.app-header h1').textContent        = CONFIG.theme.nomApp;
  // Sous-titre dynamique : met à jour le span #header-saison
  const headerSaisonEl = document.getElementById('header-saison');
  if (headerSaisonEl) headerSaisonEl.textContent = CONFIG.saison;
  document.title = CONFIG.theme.nomApp;

  initFirebase();
  console.log('Après initFirebase - APP.db:', !!APP.db);

  // Restaurer session
  const savedAdmin = localStorage.getItem('pronostics_admin');
  const savedId    = localStorage.getItem('pronostics_joueur_id');
  if (savedAdmin === '1') { APP.estAdmin = true; await demarrerApp(); return; }
  if (savedId) {
    await initJoueurs();
    const j = APP.joueurs.find(j => j.id === savedId);
    if (j) { APP.joueurActif = j; await demarrerApp(); return; }
  }
  // Attacher les listeners du formulaire login
  document.getElementById('login-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    await traiterConnexion(document.getElementById('login-input').value.trim().toUpperCase());
  });
  document.getElementById('login-input')?.addEventListener('input', () => {
    document.getElementById('login-error')?.classList.remove('show');
  });

  afficherLogin();

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault(); APP.deferredInstall = e;
    const b = document.getElementById('install-banner');
    if (b) b.style.display = 'flex';
  });
  document.getElementById('btn-install')?.addEventListener('click', async () => {
    if (!APP.deferredInstall) return;
    APP.deferredInstall.prompt();
    const { outcome } = await APP.deferredInstall.userChoice;
    if (outcome === 'accepted') document.getElementById('install-banner').style.display = 'none';
  });
  document.getElementById('btn-close-install')?.addEventListener('click', () => {
    document.getElementById('install-banner').style.display = 'none';
  });
});

function initFirebase() {
  try {
    // Vérifier si une app Firebase existe déjà
    const existingApp = firebase.apps && firebase.apps.length > 0
      ? firebase.apps[0]
      : firebase.initializeApp(CONFIG.firebase);
    APP.db = firebase.firestore();
    APP.db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
    console.log('Firebase OK - db:', !!APP.db);
  } catch(e) {
    console.error('Firebase init error:', e);
    // Tenter de récupérer l'app existante
    try {
      APP.db = firebase.firestore();
      console.log('Firebase récupéré - db:', !!APP.db);
    } catch(e2) {
      console.error('Firebase récupération impossible:', e2);
    }
  }
}

// ── Login ────────────────────────────────────────────────────
function afficherLogin() {
  console.log('afficherLogin appelé');
  document.getElementById('section-login').style.display = 'flex';
  document.getElementById('section-app').style.display   = 'none';
  setTimeout(() => document.getElementById('login-input')?.focus(), 100);
}


async function traiterConnexion(code) {
  console.log('traiterConnexion:', code, '| APP.db:', !!APP.db);
  if (!code) return;

  // Guard : si Firebase pas initialisé, réessayer
  if (!APP.db) {
    console.warn('APP.db null, réinitialisation Firebase...');
    initFirebase();
    if (!APP.db) {
      showToast('Erreur de connexion Firebase. Rechargez la page.', 'error');
      return;
    }
  }

  if (code === CONFIG.codeAdmin.toUpperCase()) {
    APP.estAdmin = true; APP.joueurActif = null;
    localStorage.setItem('pronostics_admin', '1');
    localStorage.removeItem('pronostics_joueur_id');
    await demarrerApp(); showToast('Mode admin activé 🔧', 'warning'); return;
  }
  await initJoueurs();
  console.log('Joueurs chargés:', APP.joueurs.length, APP.joueurs.map(j=>j.code));
  const joueur = APP.joueurs.find(j => j.code.toUpperCase() === code);
  if (joueur) {
    APP.joueurActif = joueur; APP.estAdmin = false;
    localStorage.setItem('pronostics_joueur_id', joueur.id);
    localStorage.removeItem('pronostics_admin');
    await demarrerApp(); return;
  }
  const err = document.getElementById('login-error');
  if (err) { err.textContent = '❌ Code incorrect.'; err.classList.add('show'); }
  const inp = document.getElementById('login-input');
  if (inp) { inp.value = ''; inp.focus(); }
}

// ── App principale ────────────────────────────────────────────
async function demarrerApp() {
  if (APP.joueurs.length === 0) await initJoueurs();
  document.getElementById('section-login').style.display = 'none';
  document.getElementById('section-app').style.display   = 'block';

  const btnAdmin = document.getElementById('tab-admin-btn');
  if (btnAdmin) {
    if (APP.estAdmin) {
      btnAdmin.removeAttribute('style');
    } else {
      btnAdmin.setAttribute('style', 'display:none !important');
    }
  }

  const banner = document.getElementById('user-banner');
  if (banner) {
    const jo = APP.joueurActif;
    banner.innerHTML = jo
      ? `<div class="user-avatar">${jo.emoji}</div>
         <div class="user-info"><div class="user-name">${jo.nom}</div><div class="user-team">${jo.equipe||''}</div></div>
         <button class="btn-logout" onclick="deconnexion()">Se déconnecter</button>`
      : `<div class="user-avatar">🔧</div>
         <div class="user-info"><div class="user-name">Administrateur</div><div class="user-team">Mode admin</div></div>
         <button class="btn-logout" onclick="deconnexion()">Se déconnecter</button>`;
  }
  APP.journeeActive  = CONFIG.regles.journeeDefaut > 0 ? CONFIG.regles.journeeDefaut : 1;
  APP.saisonAffichee = saisonKey(CONFIG.saison);
  await chargerListeSaisons();
  await initialiserSaison(APP.saisonAffichee);
  // Charger les équipes en arrière-plan (non-bloquant)
  fetchEquipesSaison(saisonApiFormat(CONFIG.saison))
    .then(eq => { if (eq && eq.length > 0) APP.equipesL1 = eq; })
    .catch(() => {}); // silencieux si indispo
  // Détection automatique de la journée courante
  try {
    APP.journeeActive = await detecterJourneeCouranteFirestore();
  } catch(e) {
    APP.journeeActive = CONFIG.regles.journeeDefaut > 0 ? CONFIG.regles.journeeDefaut : 1;
  }
  const jBadge = document.getElementById('header-journee-badge');
  if (jBadge) jBadge.textContent = 'J.' + APP.journeeActive;
  chargerTab('grille');
}

function deconnexion() {
  APP.ecouteurs.forEach(fn => fn()); APP.ecouteurs = [];
  APP.joueurActif = null; APP.estAdmin = false; APP.joueurs = [];
  localStorage.removeItem('pronostics_joueur_id');
  localStorage.removeItem('pronostics_admin');
  afficherLogin();
}

// ── Navigation ────────────────────────────────────────────────
function chargerTab(tabId) {
  document.querySelectorAll('.nav-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tabId));
  document.querySelectorAll('.tab-content').forEach(s => s.classList.toggle('active', s.id === 'tab-' + tabId));
  APP.ecouteurs.forEach(fn => fn()); APP.ecouteurs = [];
  const fns = { grille: chargerGrille, resultats: chargerResultats, classement: chargerClassement,
                bonus: chargerBonus, profil: chargerProfil, admin: chargerAdmin, palmares: chargerPalmares };
  fns[tabId]?.();
}
document.querySelectorAll('.nav-tab').forEach(tab => tab.addEventListener('click', () => chargerTab(tab.dataset.tab)));

// ── Admin ────────────────────────────────────────────────────
function chargerAdmin() {
  // Construire les options de la liste déroulante journées
  const nbJ = CONFIG.nbJournees;
  const optionsJournees = Array.from({length: nbJ}, (_, i) => {
    const j = i + 1;
    const isCourante = j === APP.journeeActive;
    return `<option value="${j}" ${isCourante ? 'selected' : ''}>
      Journée ${j}${isCourante ? ' (courante)' : ''}
    </option>`;
  }).join('');

  document.getElementById('tab-admin').innerHTML = `
    <div style="padding:16px">

      <!-- ── Journée ── -->
      <div class="card" style="margin-bottom:12px">
        <div class="card-title" style="margin-bottom:12px">📅 Gestion d'une journée</div>

        <label class="profil-label">Sélectionner la journée</label>
        <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px">
          <select id="admin-select-journee"
            onchange="adminMettreAJourBoutonJournee()"
            style="flex:1;padding:10px 12px;border:2px solid var(--color-border-primary);
                   border-radius:10px;font-size:14px;font-weight:500;
                   background:var(--color-background-primary);
                   color:var(--color-text-primary);outline:none;cursor:pointer">
            ${optionsJournees}
          </select>
          <button onclick="adminNaviguerVersJournee()"
            style="background:var(--bleu-l);color:var(--bleu);border:none;
                   border-radius:8px;padding:10px 12px;font-size:12px;
                   font-weight:500;cursor:pointer;white-space:nowrap">
            🎯 Aller à cette journée
          </button>
        </div>

        <button class="btn-primary" id="btn-gerer-journee"
          onclick="adminOuvrirJourneeSelectionnee()"
          style="width:100%;margin-bottom:4px">
          ✏️ Gérer la Journée ${APP.journeeActive}
        </button>
        <p class="text-sm text-muted">
          Saisir / modifier les matchs, dates, scores et deadline.
        </p>
      </div>

      <!-- ── Calendrier ── -->
      <div class="card" style="margin-bottom:12px">
        <div class="card-title" style="margin-bottom:8px">🔄 Calendrier &amp; équipes</div>
        <button class="btn-primary" onclick="ouvrirCalendrierAdmin()" style="width:100%;margin-bottom:8px">
          📡 Charger depuis TheSportsDB
        </button>
        <p class="text-sm text-muted" style="margin-bottom:10px">Charge les matchs et scores pour une plage de journées.</p>
        <div style="background:var(--color-background-secondary);border-radius:var(--border-radius-md);
                    padding:10px 12px;display:flex;align-items:center;justify-content:space-between;gap:8px">
          <div>
            <p style="font-size:12px;font-weight:500;color:var(--color-text-primary);margin:0 0 2px">
              Équipes ${CONFIG.saison}
            </p>
            <p style="font-size:11px;color:var(--color-text-secondary);margin:0">
              ${APP.equipesL1.length > 0
                ? APP.equipesL1.slice(0,3).join(', ') + (APP.equipesL1.length > 3 ? ` +${APP.equipesL1.length-3}` : '')
                : 'Non chargées'}
            </p>
          </div>
          <button id="btn-refresh-equipes" onclick="rafraichirEquipes().then(()=>chargerAdmin())"
            style="background:var(--bleu-l);color:var(--bleu);border:none;
                   border-radius:var(--border-radius-md);padding:7px 10px;
                   font-size:11px;font-weight:500;cursor:pointer;white-space:nowrap;flex-shrink:0">
            🔄 Rafraîchir
          </button>
        </div>
      </div>

      <!-- ── Joueurs ── -->
      <div class="card" style="margin-bottom:12px">
        <div class="card-title" style="margin-bottom:8px">👥 Joueurs</div>
        <button class="btn-primary" onclick="chargerAdminJoueurs()" style="width:100%;margin-bottom:4px">
          👥 Gérer les joueurs (${APP.joueurs.length} actif${APP.joueurs.length>1?'s':''})
        </button>
        <p class="text-sm text-muted">Ajouter, modifier ou retirer des participants.</p>
      </div>

      <!-- ── Saison ── -->
      <div class="card">
        <div class="card-title" style="margin-bottom:8px">🏁 Saison</div>
        <button onclick="confirmerClotureSaison()"
          style="width:100%;padding:12px;background:#C00000;color:white;border:none;
                 border-radius:10px;font-size:14px;font-weight:500;cursor:pointer">
          🏁 Clôturer la saison ${CONFIG.saison}
        </button>
        <p class="text-sm text-muted" style="margin-top:4px">
          Archive la saison et calcule le palmarès final.
        </p>
      </div>

    </div>`;
}

// Met à jour le texte du bouton quand on change la sélection
function adminMettreAJourBoutonJournee() {
  const sel = document.getElementById('admin-select-journee');
  const btn = document.getElementById('btn-gerer-journee');
  if (sel && btn) {
    btn.textContent = `✏️ Gérer la Journée ${sel.value}`;
  }
}

// Navigue vers la journée sélectionnée dans la Grille
function adminNaviguerVersJournee() {
  const sel = document.getElementById('admin-select-journee');
  if (!sel) return;
  APP.journeeActive = parseInt(sel.value);
  const badge = document.getElementById('header-journee-badge');
  if (badge) badge.textContent = `J.${APP.journeeActive}`;
  chargerTab('grille');
}

// Ouvre le gestionnaire pour la journée sélectionnée dans la liste
function adminOuvrirJourneeSelectionnee() {
  const sel = document.getElementById('admin-select-journee');
  const j   = sel ? parseInt(sel.value) : APP.journeeActive;
  APP.journeeActive = j;
  ouvrirAdminJournee();
}


// ── Grille ────────────────────────────────────────────────────
function chargerGrille() {
  document.getElementById('tab-grille').innerHTML = `
    <div style="padding:16px">
      <div class="journee-nav">
        <button onclick="changerJournee(-1)" ${APP.journeeActive<=1?'disabled':''}>‹</button>
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px">
          <select id="select-journee"
            onchange="allerJournee(parseInt(this.value))"
            style="background:transparent;border:none;color:white;font-size:14px;
                   font-weight:700;text-align:center;cursor:pointer;outline:none;
                   appearance:none;-webkit-appearance:none;padding:0 4px;
                   max-width:160px">
            ${Array.from({length: CONFIG.nbJournees}, (_, i) => i + 1)
              .map(j => `<option value="${j}" ${j === APP.journeeActive ? 'selected' : ''}
                style="background:#1F4E79;color:white">Journée ${j}</option>`).join('')}
          </select>
          <div class="journee-deadline" id="deadline-label">Chargement...</div>
        </div>
        <button onclick="changerJournee(1)" ${APP.journeeActive>=CONFIG.nbJournees?'disabled':''}>›</button>
      </div>
      <div class="statut-bar" id="statut-bar"></div>
      <div id="grille-matchs"><div class="loading"><div class="spinner"></div>Chargement...</div></div>
      <div id="btn-soumettre-container"></div>
    </div>`;
  const unsub = dbSaison('journees', `j${APP.journeeActive}`)
    .onSnapshot(snap => renderGrille(APP.journeeActive, snap.exists ? snap.data() : {}));
  APP.ecouteurs.push(unsub);
}

function allerJournee(j) {
  if (j >= 1 && j <= CONFIG.nbJournees && j !== APP.journeeActive) {
    APP.journeeActive = j;
    const badge = document.getElementById('header-journee-badge');
    if (badge) badge.textContent = 'J.' + j;
    chargerTab('grille');
  }
}

function changerJournee(d) {
  const n = APP.journeeActive + d;
  if (n >= 1 && n <= CONFIG.nbJournees) { APP.journeeActive = n; chargerTab('grille'); }
}

function renderGrille(j, data) {
  const matchs = data.matchs || genererMatchsVides();
  const soumissions = data.soumissions || {};
  const deadline = data.deadline || null;
  const now = Date.now();
  let saisieOuverte = true, deadlineLabel = 'Saisie ouverte';
  if (deadline) {
    const diff = deadline - now;
    if (diff <= 0) { saisieOuverte = false; deadlineLabel = '⛔ Saisie fermée'; }
    else if (diff < 3600000) deadlineLabel = `⏰ Fermeture dans ${Math.floor(diff/60000)} min`;
    else deadlineLabel = `⏰ Fermeture dans ${Math.floor(diff/3600000)}h`;
  }
  const dl = document.getElementById('deadline-label');
  if (dl) dl.textContent = deadlineLabel;

  const sb = document.getElementById('statut-bar');
  if (sb) sb.innerHTML = APP.joueurs.map(jo => {
    const s = !!soumissions[jo.id];
    return `<div class="statut-joueur ${s?'soumis':''}"><div class="statut-dot"></div>${jo.emoji} ${jo.nom.split(' ')[0]}${s?' ✓':''}</div>`;
  }).join('');

  const monId = APP.joueurActif?.id;
  const jaiSoumis  = monId ? !!soumissions[monId] : false;
  const peutVoir   = APP.estAdmin || jaiSoumis;
  const saisonRO   = !estSaisonCourante(); // lecture seule si saison archivée

  const mc = document.getElementById('grille-matchs');
  if (!mc) return;
  mc.innerHTML = matchs.map((match, idx) => {
    const sr = match.scoreReel || null;
    const pts = (prono, reel) => reel ? calculerPoints(prono, reel) : null;
    const locked = jaiSoumis || !saisieOuverte || saisonRO;
    const monProno = soumissions[monId]?.[idx] || { dom:'', ext:'' };
    const mesPoints = monId && sr ? calculerPoints(monProno, sr) : null;

    const inputs = monId ? `
      <div class="score-inputs">
        <input type="number" min="0" max="20" class="score-input ${locked?'locked':''}"
          id="sc-${idx}-dom" value="${monProno.dom!==''?monProno.dom:''}"
          ${locked?'readonly':''} onchange="sauverPronoTemp(${idx})" placeholder="—">
        <span class="score-separator">-</span>
        <input type="number" min="0" max="20" class="score-input ${locked?'locked':''}"
          id="sc-${idx}-ext" value="${monProno.ext!==''?monProno.ext:''}"
          ${locked?'readonly':''} onchange="sauverPronoTemp(${idx})" placeholder="—">
        ${mesPoints!==null?`<div class="points-badge points-${mesPoints}">${mesPoints}</div>`:''}
      </div>` : '';

    const autres = peutVoir && APP.joueurs.length > 1 ? `
      <div class="mt-8" style="display:flex;flex-wrap:wrap;gap:4px">
        ${APP.joueurs.filter(jo=>jo.id!==monId).map(jo=>{
          const p = soumissions[jo.id]?.[idx];
          const pj = p && sr ? calculerPoints(p, sr) : null;
          if (!soumissions[jo.id]) return `<span class="badge" style="opacity:0.3">${jo.emoji}</span>`;
          if (!p) return `<span class="badge badge-bleu">${jo.emoji} —</span>`;
          const cls = pj===7?'badge-or':pj===5?'badge-vert':pj===3?'badge-bleu':'';
          return `<span class="badge ${cls}">${jo.emoji} ${p.dom}-${p.ext}${pj!==null?` (${pj})`:''}</span>`;
        }).join('')}
      </div>` : '';

    return `<div class="match-row">
      <div class="match-date">${match.date||`Match ${idx+1}`}</div>
      <div class="match-teams">
        <span class="team-name">${match.domicile||`Éq.${idx+1}D`}</span>
        ${sr?`<div class="score-reel"><strong>${sr.dom}</strong><span class="sep"> - </span><strong>${sr.ext}</strong></div>`:'<span class="vs-badge">VS</span>'}
        <span class="team-name ext">${match.exterieur||`Éq.${idx+1}E`}</span>
      </div>${inputs}${autres}</div>`;
  }).join('');

  const bc = document.getElementById('btn-soumettre-container');
  if (!bc) return;
  if (APP.estAdmin) {
    bc.innerHTML = `<button class="btn-primary mt-8" onclick="ouvrirAdminJournee()">⚙️ Admin — Gérer cette journée</button>`;
  } else if (!monId) {
    bc.innerHTML = '';
  } else if (jaiSoumis) {
    bc.innerHTML = `<button class="btn-soumettre locked" disabled>✅ Pronostics soumis et verrouillés</button>`;
  } else if (!saisieOuverte) {
    bc.innerHTML = `<button class="btn-soumettre" disabled>⛔ Saisie fermée</button>`;
  } else {
    bc.innerHTML = `<button class="btn-soumettre" onclick="soumettre(${j})">✅ Soumettre mes pronostics</button>
      <p class="text-sm text-center mt-8">Une fois soumis, vous verrez les pronostics des autres joueurs ayant déjà joué.</p>`;
  }
}

const pronoTemp = {};
function sauverPronoTemp(idx) {
  const d = document.getElementById(`sc-${idx}-dom`)?.value;
  const e = document.getElementById(`sc-${idx}-ext`)?.value;
  pronoTemp[idx] = { dom: d!==''?parseInt(d):'', ext: e!==''?parseInt(e):'' };
}

async function soumettre(j) {
  if (!APP.joueurActif) return;
  const pronostics = {};
  let complets = 0;
  for (let i = 0; i < CONFIG.nbMatchsParJournee; i++) {
    const d = document.getElementById(`sc-${i}-dom`)?.value;
    const e = document.getElementById(`sc-${i}-ext`)?.value;
    pronostics[i] = { dom: d!==''?parseInt(d):'', ext: e!==''?parseInt(e):'' };
    if (d!=='' && e!=='') complets++;
  }
  if (complets < CONFIG.nbMatchsParJournee && !confirm(`${CONFIG.nbMatchsParJournee-complets} match(s) sans pronostic. Soumettre quand même ?`)) return;
  if (!confirm(`Confirmer pour la Journée ${j} ?\n⚠️ Non modifiable ensuite.`)) return;
  try {
    await dbSaison('journees', `j${j}`).set({
      [`soumissions.${APP.joueurActif.id}`]: pronostics,
      [`statuts.${APP.joueurActif.id}`]: { soumisAt: Date.now(), complets },
    }, { merge: true });
    showToast(`✅ ${APP.joueurActif.nom} — pronostics soumis !`, 'success');
  } catch(e) { console.error(e); showToast('Erreur soumission. Réessayez.', 'error'); }
}

function calculerPoints(prono, reel) {
  const pd=parseInt(prono.dom), pe=parseInt(prono.ext), rd=parseInt(reel.dom), re=parseInt(reel.ext);
  if ([pd,pe,rd,re].some(isNaN)) return null;
  if (pd===rd && pe===re) return (rd+re>=4) ? CONFIG.bareme.exact4b : CONFIG.bareme.exact;
  return Math.sign(pd-pe)===Math.sign(rd-re) ? CONFIG.bareme.bonSens : CONFIG.bareme.mauvais;
}

// ── Résultats ─────────────────────────────────────────────────
function chargerResultats() {
  document.getElementById('tab-resultats').innerHTML = `
    <div style="padding:16px">
      <div class="journee-nav">
        <button onclick="changerJourneeR(-1)" ${APP.journeeActive<=1?'disabled':''}>‹</button>
        <div class="journee-label">Journée <span id="num-j-r">${APP.journeeActive}</span></div>
        <button onclick="changerJourneeR(1)" ${APP.journeeActive>=CONFIG.nbJournees?'disabled':''}>›</button>
      </div>
      <div id="resultats-content"><div class="loading"><div class="spinner"></div></div></div>
    </div>`;
  const unsub = dbSaison('journees', `j${APP.journeeActive}`)
    .onSnapshot(snap => renderResultats(APP.journeeActive, snap.exists ? snap.data() : {}));
  APP.ecouteurs.push(unsub);
}
function changerJourneeR(d) {
  const n = APP.journeeActive + d;
  if (n>=1 && n<=CONFIG.nbJournees) { APP.journeeActive=n; chargerTab('resultats'); }
}

function renderResultats(j, data) {
  const matchs      = data.matchs      || genererMatchsVides();
  const soumissions = data.soumissions || {};
  const deadline    = data.deadline    || null;

  // Une journée est "fermée" si sa deadline est passée OU si tous ses scores sont entrés
  const now           = Date.now();
  const deadlinePassee = deadline && deadline < now;
  const tousScores     = matchs.length > 0 && matchs.every(m => m.scoreReel !== null);
  const journeeFermee  = deadlinePassee || tousScores;

  // En saison archivée : jamais de points ni gains
  const afficherPtsGains = estSaisonCourante() && journeeFermee;

  // Admin peut saisir les scores seulement si journée PAS encore fermée
  // (ou si saison courante et scores manquants)
  const adminPeutSaisir = APP.estAdmin && estSaisonCourante();

  const el = document.getElementById('num-j-r');
  if (el) el.textContent = j;

  const totaux = Object.fromEntries(APP.joueurs.map(jo => [jo.id, 0]));

  let html = `<div class="resultats-table"><table><thead><tr>
    <th class="match-col">Match</th>
    <th>Score</th>
    ${APP.joueurs.map(jo => `<th title="${jo.nom}">${jo.emoji}</th>`).join('')}
  </tr></thead><tbody>`;

  matchs.forEach((match, idx) => {
    const sr = match.scoreReel || null;
    const bgRow = idx % 2 === 0 ? '' : 'style="background:var(--color-background-secondary)"';

    // Cellule score
    let scoreHtml;
    if (sr) {
      if (adminPeutSaisir) {
        // Admin + saison courante : inputs éditables
        scoreHtml = `
          <input type="number"
            style="width:26px;border:1px solid var(--vert);border-radius:4px;
                   text-align:center;font-size:12px;font-weight:700;color:var(--vert)"
            value="${sr.dom}" onchange="saisirScore(${j},${idx},'dom',this.value)" min="0" max="20">
          <span style="font-weight:700;color:var(--gris)">-</span>
          <input type="number"
            style="width:26px;border:1px solid var(--vert);border-radius:4px;
                   text-align:center;font-size:12px;font-weight:700;color:var(--vert)"
            value="${sr.ext}" onchange="saisirScore(${j},${idx},'ext',this.value)" min="0" max="20">`;
      } else {
        // Journée fermée OU saison archivée : score grisé, non éditable
        scoreHtml = `
          <span style="font-size:13px;font-weight:700;
                       color:${journeeFermee ? 'var(--gris)' : 'var(--vert)'};
                       background:${journeeFermee ? 'var(--gris-l)' : 'var(--vert-l)'};
                       padding:2px 7px;border-radius:6px">
            ${sr.dom} - ${sr.ext}
          </span>`;
      }
    } else if (adminPeutSaisir) {
      // Pas encore de score + admin saison courante : inputs vides
      scoreHtml = `
        <input type="number"
          style="width:26px;border:1px solid #ddd;border-radius:4px;
                 text-align:center;font-size:12px"
          value="" onchange="saisirScore(${j},${idx},'dom',this.value)" min="0" max="20" placeholder="—">
        <span style="color:var(--gris)">-</span>
        <input type="number"
          style="width:26px;border:1px solid #ddd;border-radius:4px;
                 text-align:center;font-size:12px"
          value="" onchange="saisirScore(${j},${idx},'ext',this.value)" min="0" max="20" placeholder="—">`;
    } else {
      scoreHtml = '<span style="color:var(--gris-l);font-size:13px">—</span>';
    }

    html += `<tr ${bgRow}>
      <td class="match-col" style="font-size:11px">
        ${match.domicile||'?'} - ${match.exterieur||'?'}
      </td>
      <td class="score-cell" style="white-space:nowrap">${scoreHtml}</td>`;

    // Colonnes pronostics par joueur
    APP.joueurs.forEach(jo => {
      const p   = soumissions[jo.id]?.[idx];
      const pts = (p && sr && afficherPtsGains) ? calculerPoints(p, sr) : null;
      if (pts !== null) totaux[jo.id] += pts;

      const vis = APP.estAdmin
        || APP.joueurActif?.id === jo.id
        || (APP.joueurActif && soumissions[APP.joueurActif.id] && soumissions[jo.id]);

      if (!vis) {
        html += `<td class="hidden-cell">?</td>`;
      } else if (!p) {
        html += `<td style="color:var(--gris-l)">—</td>`;
      } else if (!sr) {
        // Score pas encore entré : afficher le prono sans couleur
        html += `<td class="prono-cell" style="color:var(--gris)">${p.dom}-${p.ext}</td>`;
      } else if (!afficherPtsGains) {
        // Saison archivée ou journée ouverte : prono visible mais grisé, sans points
        html += `<td class="prono-cell" style="color:var(--gris)">${p.dom}-${p.ext}</td>`;
      } else {
        // Saison courante + journée fermée : couleur selon les points
        const cls = pts === 7 ? 'pts-7' : pts === 5 ? 'pts-5' : pts === 3 ? 'pts-3' : 'pts-0';
        html += `<td class="prono-cell ${cls}">
          ${p.dom}-${p.ext}<br><small>${pts}pt</small>
        </td>`;
      }
    });

    html += '</tr>';
  });

  // Ligne totaux (seulement si points affichés)
  if (afficherPtsGains) {
    html += `<tr style="background:var(--color-background-secondary);font-weight:500">
      <td colspan="2" style="text-align:right;padding-right:8px;font-size:12px">Total</td>
      ${APP.joueurs.map(jo =>
        `<td style="font-size:13px;color:var(--orange);font-weight:700">${totaux[jo.id] || '—'}</td>`
      ).join('')}
    </tr>`;
  }

  html += '</tbody></table></div>';

  // Podium (seulement si points affichés)
  if (afficherPtsGains) {
    const classJ = APP.joueurs
      .filter(jo => totaux[jo.id] > 0)
      .sort((a, b) => totaux[b.id] - totaux[a.id]);

    if (classJ.length > 0) {
      html += `<div class="card mt-12">
        <div class="card-title">🏆 Podium Journée ${j}</div>
        ${classJ.slice(0, 3).map((jo, i) => {
          const gain = [CONFIG.gains.premier, CONFIG.gains.deuxieme, CONFIG.gains.troisieme][i] || 0;
          return `<div class="classement-row">
            <div class="rang-badge rang-${i+1}">${['🥇','🥈','🥉'][i]}</div>
            <div class="classement-nom">${jo.emoji} ${jo.nom}</div>
            <div class="classement-pts">${totaux[jo.id]}<span>pts</span></div>
            <div class="classement-gains">+${gain}€</div>
          </div>`;
        }).join('')}
      </div>`;
    }
  } else if (journeeFermee) {
    // Journée fermée mais pas de points (saison archivée ou pas de scores)
    html += `<div class="card mt-12" style="background:var(--gris-l);border:none">
      <p class="text-sm text-muted text-center" style="padding:4px 0">
        📁 Journée archivée — scores en lecture seule
      </p>
    </div>`;
  }

  const rc = document.getElementById('resultats-content');
  if (rc) rc.innerHTML = html;
}

async function saisirScore(j,idx,cote,val) {
  if(!APP.estAdmin) return;
  try {
    const ref=dbSaison('journees', `j${j}`);
    const snap=await ref.get();
    const matchs=snap.exists?(snap.data().matchs||genererMatchsVides()):genererMatchsVides();
    if(!matchs[idx].scoreReel) matchs[idx].scoreReel={};
    matchs[idx].scoreReel[cote]=val!==''?parseInt(val):'';
    await ref.set({matchs},{merge:true});
  } catch(e) { showToast('Erreur sauvegarde score','error'); }
}

// ── Classement ────────────────────────────────────────────────
function chargerClassement() {
  document.getElementById('tab-classement').innerHTML=`<div style="padding:16px"><div class="loading"><div class="spinner"></div>Calcul...</div></div>`;
  Promise.all(Array.from({length:CONFIG.nbJournees},(_,i)=>
    dbSaison('journees', `j${i+1}`).get()
  )).then(snaps=>{
    const totaux=Object.fromEntries(APP.joueurs.map(jo=>[jo.id,{pts:0,gains:0}]));
    snaps.forEach(snap=>{
      if(!snap.exists) return;
      const {matchs=[],soumissions={}}=snap.data();
      const ptsJ=Object.fromEntries(APP.joueurs.map(jo=>[jo.id,
        matchs.reduce((acc,match,idx)=>{
          const p=soumissions[jo.id]?.[idx];
          return acc+(p&&match.scoreReel?calculerPoints(p,match.scoreReel)||0:0);
        },0)]));
      const sorted=APP.joueurs.slice().sort((a,b)=>ptsJ[b.id]-ptsJ[a.id]);
      APP.joueurs.forEach(jo=>totaux[jo.id].pts+=ptsJ[jo.id]);
      if(sorted[0]&&ptsJ[sorted[0].id]>0) totaux[sorted[0].id].gains+=CONFIG.gains.premier;
      if(sorted[1]&&ptsJ[sorted[1].id]>0) totaux[sorted[1].id].gains+=CONFIG.gains.deuxieme;
      if(sorted[2]&&ptsJ[sorted[2].id]>0) totaux[sorted[2].id].gains+=CONFIG.gains.troisieme;
    });
    const sorted=APP.joueurs.slice().sort((a,b)=>totaux[b.id].pts-totaux[a.id].pts);
    const monId=APP.joueurActif?.id;
    let html=`<div style="padding:16px"><div class="card"><div class="card-title">🏆 Classement — ${CONFIG.saison}</div>`;
    sorted.forEach((jo,i)=>{
      const r=i+1;
      html+=`<div class="classement-row ${jo.id===monId?'moi':''}">
        <div class="rang-badge ${r<=3?`rang-${r}`:'rang-other'}">${r<=3?['🥇','🥈','🥉'][i]:r}</div>
        <div class="classement-nom">${jo.emoji} ${jo.nom}</div>
        <div class="classement-pts">${totaux[jo.id].pts}<span>pts</span></div>
        <div class="classement-gains">${totaux[jo.id].gains}€</div></div>`;
    });
    html+='</div></div>';
    document.getElementById('tab-classement').innerHTML=html;
  }).catch(e=>{ console.error(e); document.getElementById('tab-classement').innerHTML='<div class="empty-state"><div class="icon">⚠️</div><p>Erreur</p></div>'; });
}

// ── Bonus ─────────────────────────────────────────────────────
function chargerBonus() {
  const monId=APP.joueurActif?.id;
  if(APP.journeeActive<CONFIG.regles.bonusSaisonDepuisJournee&&!APP.estAdmin) {
    document.getElementById('tab-bonus').innerHTML=`<div style="padding:16px"><div class="empty-state"><div class="icon">🔒</div><p>Disponible à partir de la Journée ${CONFIG.regles.bonusSaisonDepuisJournee}.</p></div></div>`; return;
  }
  const unsub=dbSaison('bonus', 'saison').onSnapshot(snap=>renderBonus(snap.exists?snap.data():{},monId));
  APP.ecouteurs.push(unsub);
}

function renderBonus(data,monId) {
  const container = document.getElementById('tab-bonus');
  if (!container) return;

  const mb  = monId ? (data[monId] || {}) : {};
  const js  = !!data[monId + '_soumis'];
  const ro  = (js && !APP.estAdmin) ? 'readonly' : '';

  // Liste équipes dynamique ou fallback statique
  const eq = (APP.equipesL1 && APP.equipesL1.length > 0)
    ? APP.equipesL1
    : ['Angers','Auxerre','Brest','Le Havre','Lens','Lille','Lorient',
       'Lyon','Marseille','Metz','Monaco','Montpellier','Nantes','Nice',
       'Paris FC','Paris SG','Rennes','Reims','Strasbourg','Toulouse'].sort();

  const datalist = '<datalist id="eq-bonus-list">' +
    eq.map(e => '<option value="' + e + '">').join('') + '</datalist>';

  // En-tête de section coloré
  function secHdr(icon, titre, pts, bg, color) {
    return '<div style="display:flex;align-items:center;gap:8px;padding:8px 12px;' +
           'border-radius:var(--border-radius-md);margin-bottom:10px;background:' + bg + '">' +
           '<span style="font-size:16px">' + icon + '</span>' +
           '<span style="font-size:13px;font-weight:500;color:' + color + '">' + titre + '</span>' +
           '<span style="margin-left:auto;font-size:11px;font-weight:500;' +
           'background:var(--color-background-primary);color:' + color + ';' +
           'padding:2px 8px;border-radius:20px">' + pts + '</span></div>';
  }

  // Champ de saisie
  function inpF(id, label, placeholder, type) {
    type = type || 'text';
    var val = mb[id.replace('b-', '')] || '';
    return '<div style="display:flex;flex-direction:column;gap:2px">' +
           '<span style="font-size:11px;color:var(--color-text-secondary)">' + label + '</span>' +
           '<input list="eq-bonus-list" id="' + id + '" type="' + type + '" class="bonus-input"' +
           ' value="' + val + '" placeholder="' + placeholder + '" ' + ro + '></div>';
  }

  // Message statut
  var statusMsg;
  if (js) {
    statusMsg = '<div style="background:var(--color-background-success);border-radius:8px;' +
                'padding:8px 12px;font-size:12px;color:var(--color-text-success);' +
                'margin-bottom:14px;display:flex;align-items:center;gap:6px">' +
                '&#10003; Vos pronostics sont soumis et verrouilles.</div>';
  } else {
    statusMsg = '<p style="font-size:12px;color:var(--color-text-secondary);' +
                'margin-bottom:14px;line-height:1.5">Disponible a partir de la Journee ' +
                CONFIG.regles.bonusSaisonDepuisJournee +
                ' - Soumis une seule fois, non modifiable</p>';
  }

  // Bouton soumettre
  var btnSoumettre = (!js && monId)
    ? '<button class="btn-soumettre" onclick="soumettreBonus()" style="margin-top:4px">' +
      '&#10003; Soumettre mes pronostics de fin de saison</button>'
    : '';

  // Construire le HTML
  var html = '<div style="padding:16px">' + datalist + statusMsg;

  // TOP 3
  html += '<div style="margin-bottom:16px">';
  html += secHdr("&#127942;", "Podium - Top 3", "jusqu'a 50 pts",
                 "var(--color-background-warning)", "var(--color-text-warning)");
  html += '<div style="display:grid;grid-template-columns:28px 1fr;gap:8px;' +
          'align-items:center;margin-bottom:8px">';
  html += '<div style="width:28px;height:28px;border-radius:50%;background:#FFD700;' +
          'color:#7B5C00;display:flex;align-items:center;justify-content:center;' +
          'font-size:16px;flex-shrink:0">&#129351;</div>';
  html += inpF('b-champion', 'Champion - 1er', 'Equipe gagnante du titre');
  html += '</div>';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-left:36px">';
  html += inpF('b-top2', '&#129352; 2eme', 'Equipe');
  html += inpF('b-top3', '&#129353; 3eme', 'Equipe');
  html += '</div></div>';

  // FLOP 3
  html += '<div style="margin-bottom:16px">';
  html += secHdr("&#128308;", "Relegation - Flop 3", "jusqu'a 25 pts",
                 "var(--color-background-danger)", "var(--color-text-danger)");
  html += '<div style="display:flex;flex-direction:column;gap:8px">';
  html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">';
  html += inpF('b-flop1', 'Relegue 1', 'Equipe');
  html += inpF('b-flop2', 'Relegue 2', 'Equipe');
  html += '</div>';
  html += '<div style="max-width:calc(50% - 4px)">';
  html += inpF('b-flop3', 'Relegue 3', 'Equipe');
  html += '</div></div></div>';

  // BUTEUR
  html += '<div style="margin-bottom:16px">';
  html += secHdr("&#9917;", "Meilleur buteur", "jusqu'a 25 pts",
                 "var(--color-background-info)", "var(--color-text-info)");
  html += '<div style="display:grid;grid-template-columns:1fr 80px;gap:8px;align-items:end">';
  html += '<div style="display:flex;flex-direction:column;gap:2px">';
  html += '<span style="font-size:11px;color:var(--color-text-secondary)">Nom du joueur</span>';
  html += '<input id="b-buteur" class="bonus-input" value="' + (mb.buteur || '') + '"' +
          ' placeholder="Ex: Mbappe" ' + ro + ' style="font-size:13px"></div>';
  html += '<div style="display:flex;flex-direction:column;gap:2px">';
  html += '<span style="font-size:11px;color:var(--color-text-secondary)">Buts</span>';
  html += '<input id="b-nbuts" type="number" class="bonus-input" value="' + (mb.nbuts || '') + '"' +
          ' placeholder="22" min="0" max="60" ' + ro + ' style="font-size:13px;text-align:center"></div>';
  html += '</div></div>';

  html += btnSoumettre + '</div>';
  container.innerHTML = html;
}


async function soumettreBonus() {
  if(!APP.joueurActif||!confirm('Soumettre ? Non modifiable ensuite.')) return;
  try {
    await dbSaison('bonus', 'saison').set({
      [APP.joueurActif.id]: {
        champion:document.getElementById('b-champion').value, top2:document.getElementById('b-top2').value,
        top3:document.getElementById('b-top3').value, flop1:document.getElementById('b-flop1').value,
        flop2:document.getElementById('b-flop2').value, flop3:document.getElementById('b-flop3').value,
        buteur:document.getElementById('b-buteur').value, nbuts:document.getElementById('b-nbuts').value,
      },
      [`${APP.joueurActif.id}_soumis`]:true,
    },{merge:true});
    showToast('✅ Pronostics fin de saison soumis !','success');
  } catch(e) { showToast('Erreur','error'); }
}

// ── Profil ─────────────────────────────────────────────────────
function chargerProfil() {
  const jo=APP.joueurActif;
  if(!jo&&!APP.estAdmin) { document.getElementById('tab-profil').innerHTML='<div style="padding:16px"><div class="empty-state"><p>Connectez-vous.</p></div></div>'; return; }
  if(APP.estAdmin&&!jo) { document.getElementById('tab-profil').innerHTML='<div style="padding:16px"><div class="empty-state"><div class="icon">🔧</div><p>Profil réservé aux joueurs.</p></div></div>'; return; }
  const emojis=['⚽','🦁','🐺','🦊','🐯','🦅','🦋','⚡','🌟','🔥','💎','🎯','🏆','🎭','🦄','🎸','🚀','🌈','⚓','🎪'];
  APP.db.collection('profils').doc(jo.id).get().then(snap=>{
    const p=snap.exists?snap.data():{emoji:jo.emoji,equipe:jo.equipe};
    document.getElementById('tab-profil').innerHTML=`<div style="padding:16px"><div class="card">
      <div class="card-title">👤 Mon Profil</div>
      <div style="text-align:center;margin-bottom:16px">
        <div style="font-size:56px" id="preview-emoji">${p.emoji||jo.emoji}</div>
        <div style="font-size:18px;font-weight:500">${jo.nom}</div></div>
      <label class="profil-label">Avatar</label>
      <div class="profil-avatar-picker">${emojis.map(e=>`<div class="avatar-option ${e===(p.emoji||jo.emoji)?'selected':''}" onclick="selEmoji('${e}')">${e}</div>`).join('')}</div>
      <div class="mt-12"><label class="profil-label">Équipe préférée</label>
        <input class="profil-input" id="input-equipe" value="${p.equipe||jo.equipe||''}" placeholder="Ex: Olympique Lyonnais"></div>
      <div class="mt-12"><label class="profil-label">Ma devise</label>
        <input class="profil-input" id="input-devise" value="${p.devise||''}" placeholder="Ex: Toujours premier !"></div>
      <button class="btn-primary mt-16" onclick="sauverProfil()">💾 Sauvegarder</button>
    </div></div>`;
  });
}

let emojiSelectionne=null;
function selEmoji(e) {
  emojiSelectionne=e;
  document.getElementById('preview-emoji').textContent=e;
  document.querySelectorAll('.avatar-option').forEach(el=>el.classList.toggle('selected',el.textContent.trim()===e));
}

async function sauverProfil() {
  if(!APP.joueurActif) return;
  const p={emoji:emojiSelectionne||APP.joueurActif.emoji,equipe:document.getElementById('input-equipe').value,devise:document.getElementById('input-devise').value,updatedAt:Date.now()};
  try {
    await APP.db.collection('profils').doc(APP.joueurActif.id).set(p,{merge:true});
    APP.joueurActif.emoji=p.emoji; APP.joueurActif.equipe=p.equipe;
    document.querySelector('.user-avatar').textContent=p.emoji;
    document.querySelector('.user-team').textContent=p.equipe;
    showToast('✅ Profil sauvegardé !','success');
  } catch(e) { showToast('Erreur','error'); }
}

// ── Admin journée ─────────────────────────────────────────────
async function ouvrirAdminJournee() {
  const j = APP.journeeActive;
  document.getElementById('modal-title').textContent = `📅 Admin — Journée ${j}`;
  document.getElementById('modal-body').innerHTML =
    `<div class="loading"><div class="spinner"></div>Chargement...</div>`;
  ouvrirModal();

  // Charger les données existantes de la journée
  let matchsActuels = [];
  let deadlineActuelle = '';
  try {
    const snap = await dbSaison('journees', `j${j}`).get();
    if (snap.exists) {
      matchsActuels   = snap.data().matchs   || [];
      const dl        = snap.data().deadline || null;
      if (dl) {
        const d = new Date(dl);
        deadlineActuelle = d.toISOString().slice(0,16);
      }
    }
  } catch(e) { console.error(e); }

  // Compléter avec des matchs vides si moins de 9
  while (matchsActuels.length < CONFIG.nbMatchsParJournee) {
    matchsActuels.push({ domicile:'', exterieur:'', date:'', timestamp:null, scoreReel:null });
  }

  // Utiliser les équipes dynamiques si disponibles, sinon fallback statique
  const equipesL1 = (APP.equipesL1 && APP.equipesL1.length > 0)
    ? APP.equipesL1
    : ['Angers','Auxerre','Brest','Le Havre','Lens','Lille',
       'Lorient','Lyon','Marseille','Metz','Monaco','Montpellier',
       'Nantes','Nice','Paris FC','Paris SG','Rennes','Reims',
       'Strasbourg','Toulouse'].sort();

  const datalistHtml = `<datalist id="eq-admin-list">${equipesL1.map(e => `<option value="${e}">`).join('')}</datalist>`;

  const matchsHtml = matchsActuels.map((m, idx) => `
    <div style="background:var(--color-background-secondary);border-radius:8px;
                padding:10px;margin-bottom:8px;border:1px solid var(--color-border-tertiary)">
      <div style="display:flex;align-items:center;gap:4px;margin-bottom:8px">
        <span style="font-size:11px;font-weight:500;color:var(--color-text-secondary);
                     min-width:20px">M${idx+1}</span>
        <input list="eq-admin-list" class="profil-input" id="m${idx}-dom"
          value="${m.domicile||''}" placeholder="Domicile"
          style="flex:1;font-size:13px;padding:7px 10px">
        <span style="font-weight:700;color:var(--gris);padding:0 4px">vs</span>
        <input list="eq-admin-list" class="profil-input" id="m${idx}-ext"
          value="${m.exterieur||''}" placeholder="Extérieur"
          style="flex:1;font-size:13px;padding:7px 10px">
      </div>
      <div style="display:flex;gap:8px;align-items:center">
        <input type="datetime-local" class="profil-input" id="m${idx}-date"
          value="${m.timestamp ? new Date(m.timestamp).toISOString().slice(0,16) : ''}"
          style="flex:1;font-size:12px;padding:6px 8px">
        <span style="font-size:11px;color:var(--gris);white-space:nowrap">Score :</span>
        <input type="number" id="m${idx}-sdom" min="0" max="20"
          value="${m.scoreReel?.dom ?? ''}" placeholder="—"
          style="width:36px;border:1px solid var(--color-border-tertiary);border-radius:6px;
                 text-align:center;font-size:13px;font-weight:700;padding:5px 2px">
        <span style="font-weight:700;color:var(--gris)">-</span>
        <input type="number" id="m${idx}-sext" min="0" max="20"
          value="${m.scoreReel?.ext ?? ''}" placeholder="—"
          style="width:36px;border:1px solid var(--color-border-tertiary);border-radius:6px;
                 text-align:center;font-size:13px;font-weight:700;padding:5px 2px">
      </div>
    </div>`).join('');

  document.getElementById('modal-body').innerHTML = `
    ${datalistHtml}
    <div style="margin-bottom:12px">
      <label class="profil-label">⏰ Deadline de saisie des pronostics</label>
      <input type="datetime-local" class="profil-input" id="admin-deadline"
        value="${deadlineActuelle}" style="margin-bottom:4px">
      <p class="text-sm text-muted">= 1h avant le 1er match (auto si vous remplissez les dates)</p>
    </div>
    <hr class="divider">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:8px">
      <label class="profil-label" style="margin:0">⚽ Les 9 matchs</label>
      <button onclick="chargerDepuisAPI(${j}, this)"
        style="font-size:11px;background:var(--bleu-l);color:var(--bleu);
               border:none;border-radius:6px;padding:5px 10px;cursor:pointer;font-weight:500">
        🔄 Recharger depuis API
      </button>
    </div>
    ${matchsHtml}
    <button class="btn-primary" onclick="validerJourneeManuelle(${j})" style="margin-top:4px">
      ✅ Enregistrer la journée ${j}
    </button>
    <hr class="divider">
    <button class="btn-danger" onclick="resetJournee(${j})">
      🗑️ Réinitialiser la journée ${j}
    </button>
    <p class="text-sm text-muted text-center mt-8">Efface tous les pronostics.</p>`;
}

// Recharger une journée depuis l'API et remplir les champs
async function chargerDepuisAPI(j) {
  const saisonInput = CONFIG.saison;
  const btn = event.target;
  btn.textContent = '⏳ Chargement...';
  btn.disabled = true;

  const matchs = await fetchJourneeAPI(j, saisonInput);
  if (!matchs || matchs.length === 0) {
    showToast(`Journée ${j} non trouvée sur TheSportsDB`, 'error');
    btn.textContent = '🔄 Recharger depuis API';
    btn.disabled = false;
    return;
  }

  matchs.forEach((m, idx) => {
    const dom  = document.getElementById(`m${idx}-dom`);
    const ext  = document.getElementById(`m${idx}-ext`);
    const date = document.getElementById(`m${idx}-date`);
    const sdom = document.getElementById(`m${idx}-sdom`);
    const sext = document.getElementById(`m${idx}-sext`);
    if (dom)  dom.value  = m.domicile  || '';
    if (ext)  ext.value  = m.exterieur || '';
    if (date && m.timestamp) date.value = new Date(m.timestamp).toISOString().slice(0,16);
    if (sdom && m.scoreReel?.dom !== undefined) sdom.value = m.scoreReel.dom ?? '';
    if (sext && m.scoreReel?.ext !== undefined) sext.value = m.scoreReel.ext ?? '';
  });

  // Auto-remplir deadline = 1h avant le 1er match
  const premierTs = matchs.find(m => m.timestamp)?.timestamp;
  if (premierTs) {
    const dl = document.getElementById('admin-deadline');
    if (dl) dl.value = new Date(premierTs - 3600000).toISOString().slice(0,16);
  }

  btn.textContent = '✅ Rechargé';
  showToast(`Journée ${j} chargée depuis TheSportsDB`, 'success');
}

// Valider la journée saisie manuellement
async function validerJourneeManuelle(j) {
  const matchs = [];
  let premierTs = null;

  for (let idx = 0; idx < CONFIG.nbMatchsParJournee; idx++) {
    const dom  = document.getElementById(`m${idx}-dom`)?.value?.trim()  || '';
    const ext  = document.getElementById(`m${idx}-ext`)?.value?.trim()  || '';
    const dateV = document.getElementById(`m${idx}-date`)?.value        || '';
    const sdom = document.getElementById(`m${idx}-sdom`)?.value;
    const sext = document.getElementById(`m${idx}-sext`)?.value;

    const ts = dateV ? new Date(dateV).getTime() : null;
    if (ts && !premierTs) premierTs = ts;

    const scoreReel = (sdom !== '' && sext !== '' && sdom !== undefined && sext !== undefined)
      ? { dom: parseInt(sdom), ext: parseInt(sext) }
      : null;

    matchs.push({
      domicile:  dom,
      exterieur: ext,
      date:      dateV ? formaterDate(dateV.slice(0,10), dateV.slice(11) + ':00') : '',
      timestamp: ts,
      scoreReel,
      idApi: null,
    });
  }

  // Deadline : champ manuel OU 1h avant le 1er match
  const dlInput = document.getElementById('admin-deadline')?.value;
  const deadline = dlInput
    ? new Date(dlInput).getTime()
    : premierTs ? premierTs - (CONFIG.regles.delaiAvantMatchMinutes * 60000) : null;

  try {
    const ref = dbSaison('journees', `j${j}`);
    const snap = await ref.get();
    const soumissions = snap.exists ? (snap.data().soumissions || {}) : {};
    const statuts     = snap.exists ? (snap.data().statuts     || {}) : {};

    await ref.set({ matchs, deadline, soumissions, statuts, valideAt: Date.now(), valideAdmin: true });

    fermerModal();
    showToast(`✅ Journée ${j} enregistrée !`, 'success');

    // Mettre à jour la détection de journée courante
    APP.journeeActive = await detecterJourneeCouranteFirestore().catch(() => APP.journeeActive);
    const badge = document.getElementById('header-journee-badge');
    if (badge) badge.textContent = `J.${APP.journeeActive}`;

    chargerTab('grille');
  } catch(e) {
    console.error(e);
    showToast('Erreur enregistrement', 'error');
  }
}

async function saisirDeadline(j) {
  const val=document.getElementById('admin-deadline')?.value;
  if(!val) return;
  try { await dbSaison('journees', `j${j}`).set({deadline:new Date(val).getTime()},{merge:true}); fermerModal(); showToast(`⏰ Deadline J${j} enregistrée`,'success'); }
  catch(e) { showToast('Erreur','error'); }
}

async function resetJournee(j) {
  if(!confirm(`Réinitialiser la journée ${j} ?\nTous les pronostics seront effacés.`)) return;
  try { await dbSaison('journees', `j${j}`).set({soumissions:{},statuts:{}},{merge:true}); fermerModal(); showToast(`✅ Journée ${j} réinitialisée`,'warning'); chargerTab('grille'); }
  catch(e) { showToast('Erreur reset','error'); }
}

// ── Modal ────────────────────────────────────────────────────
function ouvrirModal() { document.getElementById('modal-overlay').classList.add('show'); }
function fermerModal()  { document.getElementById('modal-overlay').classList.remove('show'); }
document.getElementById('modal-overlay')?.addEventListener('click', e => {
  if(e.target===document.getElementById('modal-overlay')) fermerModal();
});

// ── Toast ────────────────────────────────────────────────────
let toastTimer=null;
function showToast(msg,type='default') {
  const el=document.getElementById('toast'); if(!el) return;
  el.textContent=msg; el.className=`toast ${type} show`;
  if(toastTimer) clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),3000);
}

// ── Utilitaires ──────────────────────────────────────────────
function genererMatchsVides() {
  return Array.from({length:CONFIG.nbMatchsParJournee},(_,i)=>({domicile:`Équipe ${i+1} D`,exterieur:`Équipe ${i+1} E`,date:'',scoreReel:null}));
}
