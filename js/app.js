// ============================================================
// APP.JS — Logique principale (version propre, sans conflits)
// ============================================================

const APP = {
  db: null, joueurActif: null, joueurs: [],
  estAdmin: false, journeeActive: 1,
  ecouteurs: [], deferredInstall: null,
};

// ── Démarrage ────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  document.documentElement.style.setProperty('--orange', CONFIG.theme.couleurPrimaire);
  document.documentElement.style.setProperty('--bleu',   CONFIG.theme.couleurSecondaire);
  document.documentElement.style.setProperty('--vert',   CONFIG.theme.couleurVert);
  document.querySelector('.app-header h1').textContent        = CONFIG.theme.nomApp;
  document.querySelector('.app-header .subtitle').textContent = CONFIG.theme.descriptionApp;
  document.title = CONFIG.theme.nomApp;

  initFirebase();

  // Restaurer session
  const savedAdmin = localStorage.getItem('pronostics_admin');
  const savedId    = localStorage.getItem('pronostics_joueur_id');
  if (savedAdmin === '1') { APP.estAdmin = true; await demarrerApp(); return; }
  if (savedId) {
    await initJoueurs();
    const j = APP.joueurs.find(j => j.id === savedId);
    if (j) { APP.joueurActif = j; await demarrerApp(); return; }
  }
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
    firebase.initializeApp(CONFIG.firebase);
    APP.db = firebase.firestore();
    APP.db.enablePersistence({ synchronizeTabs: true }).catch(() => {});
  } catch(e) { console.error('Firebase:', e); }
}

// ── Login ────────────────────────────────────────────────────
function afficherLogin() {
  document.getElementById('section-login').style.display = 'flex';
  document.getElementById('section-app').style.display   = 'none';
  setTimeout(() => document.getElementById('login-input')?.focus(), 100);
}

document.getElementById('login-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  await traiterConnexion(document.getElementById('login-input').value.trim().toUpperCase());
});
document.getElementById('login-input')?.addEventListener('input', () => {
  document.getElementById('login-error')?.classList.remove('show');
});

async function traiterConnexion(code) {
  if (!code) return;
  if (code === CONFIG.codeAdmin.toUpperCase()) {
    APP.estAdmin = true; APP.joueurActif = null;
    localStorage.setItem('pronostics_admin', '1');
    localStorage.removeItem('pronostics_joueur_id');
    await demarrerApp(); showToast('Mode admin activé 🔧', 'warning'); return;
  }
  await initJoueurs();
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
  if (btnAdmin) btnAdmin.style.display = APP.estAdmin ? 'flex' : 'none';

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
  APP.journeeActive = CONFIG.regles.journeeDefaut > 0 ? CONFIG.regles.journeeDefaut : 1;
  const jBadge = document.getElementById('header-journee-badge');
  if (jBadge) jBadge.textContent = 'J.' + APP.journeeActive;
  const hSaison = document.getElementById('header-saison');
  if (hSaison) hSaison.textContent = CONFIG.saison;
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
                bonus: chargerBonus, profil: chargerProfil, admin: chargerAdmin };
  fns[tabId]?.();
}
document.querySelectorAll('.nav-tab').forEach(tab => tab.addEventListener('click', () => chargerTab(tab.dataset.tab)));

// ── Admin ────────────────────────────────────────────────────
function chargerAdmin() {
  document.getElementById('tab-admin').innerHTML = `
    <div style="padding:16px"><div class="card">
      <div class="card-title">⚙️ Administration</div>
      <button class="btn-primary" onclick="chargerAdminJoueurs()" style="margin-bottom:8px">
        👥 Gérer les joueurs (${APP.joueurs.length} actif${APP.joueurs.length>1?'s':''})
      </button>
      <p class="text-sm text-muted" style="margin-bottom:16px">Ajouter, modifier, retirer. Aucune limite.</p>
      <hr class="divider">
      <button class="btn-primary" onclick="ouvrirAdminJournee()" style="margin-bottom:8px">
        📅 Gérer la Journée ${APP.journeeActive}
      </button>
      <p class="text-sm text-muted" style="margin-bottom:16px">Deadline, scores réels.</p>
      <hr class="divider">
      <div style="background:var(--color-background-tertiary);border-radius:8px;padding:12px;margin-top:8px">
        <p style="font-size:12px;font-weight:500;color:var(--color-text-secondary);margin-bottom:8px">Joueurs actifs :</p>
        <div style="display:flex;flex-wrap:wrap;gap:6px">
          ${APP.joueurs.map(j=>`<span style="background:var(--color-background-secondary);padding:3px 10px;border-radius:12px;font-size:12px">${j.emoji} ${j.nom}</span>`).join('')
            || '<span class="text-sm text-muted">Aucun — cliquez sur Gérer les joueurs</span>'}
        </div>
      </div>
    </div></div>`;
}

// ── Grille ────────────────────────────────────────────────────
function chargerGrille() {
  document.getElementById('tab-grille').innerHTML = `
    <div style="padding:16px">
      <div class="journee-nav">
        <button onclick="changerJournee(-1)" ${APP.journeeActive<=1?'disabled':''}>‹</button>
        <div><div class="journee-label">Journée <span id="num-journee">${APP.journeeActive}</span></div>
          <div class="journee-deadline" id="deadline-label">Chargement...</div></div>
        <button onclick="changerJournee(1)" ${APP.journeeActive>=CONFIG.nbJournees?'disabled':''}>›</button>
      </div>
      <div class="statut-bar" id="statut-bar"></div>
      <div id="grille-matchs"><div class="loading"><div class="spinner"></div>Chargement...</div></div>
      <div id="btn-soumettre-container"></div>
    </div>`;
  const unsub = APP.db.collection('journees').doc(`j${APP.journeeActive}`)
    .onSnapshot(snap => renderGrille(APP.journeeActive, snap.exists ? snap.data() : {}));
  APP.ecouteurs.push(unsub);
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
  const jaiSoumis = monId ? !!soumissions[monId] : false;
  const peutVoir  = APP.estAdmin || jaiSoumis;

  const mc = document.getElementById('grille-matchs');
  if (!mc) return;
  mc.innerHTML = matchs.map((match, idx) => {
    const sr = match.scoreReel || null;
    const pts = (prono, reel) => reel ? calculerPoints(prono, reel) : null;
    const locked = jaiSoumis || !saisieOuverte;
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
    await APP.db.collection('journees').doc(`j${j}`).set({
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
  const unsub = APP.db.collection('journees').doc(`j${APP.journeeActive}`)
    .onSnapshot(snap => renderResultats(APP.journeeActive, snap.exists ? snap.data() : {}));
  APP.ecouteurs.push(unsub);
}
function changerJourneeR(d) {
  const n = APP.journeeActive + d;
  if (n>=1 && n<=CONFIG.nbJournees) { APP.journeeActive=n; chargerTab('resultats'); }
}

function renderResultats(j, data) {
  const matchs=data.matchs||genererMatchsVides(), soumissions=data.soumissions||{};
  const el=document.getElementById('num-j-r'); if(el) el.textContent=j;
  const totaux=Object.fromEntries(APP.joueurs.map(jo=>[jo.id,0]));
  let html=`<div class="resultats-table"><table><thead><tr>
    <th class="match-col">Match</th><th>Score</th>
    ${APP.joueurs.map(jo=>`<th>${jo.emoji}</th>`).join('')}
  </tr></thead><tbody>`;
  matchs.forEach((match,idx)=>{
    const sr=match.scoreReel||null;
    html+=`<tr><td class="match-col">${(match.domicile||'?').slice(0,8)} - ${(match.exterieur||'?').slice(0,8)}</td>
      <td class="score-cell">${APP.estAdmin
        ?`<input type="number" style="width:28px;border:1px solid #ccc;border-radius:4px;text-align:center;font-size:12px"
           value="${sr?.dom??''}" onchange="saisirScore(${j},${idx},'dom',this.value)" min="0" max="20"> -
          <input type="number" style="width:28px;border:1px solid #ccc;border-radius:4px;text-align:center;font-size:12px"
           value="${sr?.ext??''}" onchange="saisirScore(${j},${idx},'ext',this.value)" min="0" max="20">`
        : sr?`<strong>${sr.dom}-${sr.ext}</strong>`:'<span style="color:#ccc">—</span>'}</td>`;
    APP.joueurs.forEach(jo=>{
      const p=soumissions[jo.id]?.[idx], pts=(p&&sr)?calculerPoints(p,sr):null;
      if(pts!==null) totaux[jo.id]+=pts;
      const vis=APP.estAdmin||APP.joueurActif?.id===jo.id||(APP.joueurActif&&soumissions[APP.joueurActif.id]&&soumissions[jo.id]);
      if(!vis) html+=`<td class="hidden-cell">?</td>`;
      else if(!p) html+=`<td>—</td>`;
      else html+=`<td class="prono-cell ${pts!==null?`pts-${pts}`:''}">
        ${p.dom}-${p.ext}${pts!==null?`<br><small>${pts}pt</small>`:''}</td>`;
    });
    html+='</tr>';
  });
  html+=`<tr style="background:var(--color-background-secondary);font-weight:500">
    <td colspan="2" style="text-align:right;padding-right:8px;font-size:12px">Total</td>
    ${APP.joueurs.map(jo=>`<td style="font-size:13px;color:var(--orange);font-weight:700">${totaux[jo.id]||'—'}</td>`).join('')}
  </tr></tbody></table></div>`;
  const classJ=APP.joueurs.filter(jo=>totaux[jo.id]>0).sort((a,b)=>totaux[b.id]-totaux[a.id]);
  if(classJ.length>0) {
    html+=`<div class="card mt-12"><div class="card-title">🏆 Podium Journée ${j}</div>
      ${classJ.slice(0,3).map((jo,i)=>{
        const gain=[CONFIG.gains.premier,CONFIG.gains.deuxieme,CONFIG.gains.troisieme][i]||0;
        return `<div class="classement-row"><div class="rang-badge rang-${i+1}">${['🥇','🥈','🥉'][i]}</div>
          <div class="classement-nom">${jo.emoji} ${jo.nom}</div>
          <div class="classement-pts">${totaux[jo.id]}<span>pts</span></div>
          <div class="classement-gains">+${gain}€</div></div>`;
      }).join('')}</div>`;
  }
  const rc=document.getElementById('resultats-content'); if(rc) rc.innerHTML=html;
}

async function saisirScore(j,idx,cote,val) {
  if(!APP.estAdmin) return;
  try {
    const ref=APP.db.collection('journees').doc(`j${j}`);
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
    APP.db.collection('journees').doc(`j${i+1}`).get()
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
  const unsub=APP.db.collection('bonus').doc('saison').onSnapshot(snap=>renderBonus(snap.exists?snap.data():{},monId));
  APP.ecouteurs.push(unsub);
}

function renderBonus(data,monId) {
  const mb=monId?(data[monId]||{}):{};
  const js=!!data[`${monId}_soumis`];
  const ro=(js&&!APP.estAdmin)?'readonly':'';
  const eq=['Paris SG','Marseille','Lyon','Monaco','Lille','Lens','Rennes','Nice','Brest','Nantes','Strasbourg','Reims','Le Havre','Lorient','Toulouse','Metz','Auxerre','Angers'];
  document.getElementById('tab-bonus').innerHTML=`<div style="padding:16px">
    <datalist id="eq-list">${eq.map(e=>`<option value="${e}">`).join('')}</datalist>
    <div class="card"><div class="card-title">🎯 Pronostics Fin de Saison</div>
    <p class="text-sm text-muted" style="margin-bottom:12px">${js?'✅ Soumis et verrouillés.':'Saisissez vos pronostics.'}</p>
    <div class="bonus-grid">
      <div class="bonus-input-group"><label class="profil-label">🏆 Champion</label><input list="eq-list" class="bonus-input" id="b-champion" value="${mb.champion||''}" placeholder="Équipe" ${ro}></div>
      <div></div>
      <div class="bonus-input-group"><label class="profil-label">🥇 2ème</label><input list="eq-list" class="bonus-input" id="b-top2" value="${mb.top2||''}" placeholder="Équipe" ${ro}></div>
      <div class="bonus-input-group"><label class="profil-label">🥈 3ème</label><input list="eq-list" class="bonus-input" id="b-top3" value="${mb.top3||''}" placeholder="Équipe" ${ro}></div>
      <div class="bonus-input-group"><label class="profil-label">📉 Relégué 1</label><input list="eq-list" class="bonus-input" id="b-flop1" value="${mb.flop1||''}" placeholder="Équipe" ${ro}></div>
      <div class="bonus-input-group"><label class="profil-label">📉 Relégué 2</label><input list="eq-list" class="bonus-input" id="b-flop2" value="${mb.flop2||''}" placeholder="Équipe" ${ro}></div>
      <div class="bonus-input-group"><label class="profil-label">📉 Relégué 3</label><input list="eq-list" class="bonus-input" id="b-flop3" value="${mb.flop3||''}" placeholder="Équipe" ${ro}></div>
      <div class="bonus-input-group"><label class="profil-label">⚽ Meilleur buteur</label><input class="bonus-input" id="b-buteur" value="${mb.buteur||''}" placeholder="Nom" ${ro}></div>
      <div class="bonus-input-group"><label class="profil-label">🔢 Nombre de buts</label><input type="number" class="bonus-input" id="b-nbuts" value="${mb.nbuts||''}" placeholder="Ex: 22" min="0" max="50" ${ro}></div>
    </div>
    ${!js&&monId?`<button class="btn-soumettre" onclick="soumettreBonus()">✅ Soumettre</button>`:''}</div></div>`;
}

async function soumettreBonus() {
  if(!APP.joueurActif||!confirm('Soumettre ? Non modifiable ensuite.')) return;
  try {
    await APP.db.collection('bonus').doc('saison').set({
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
function ouvrirAdminJournee() {
  const j=APP.journeeActive;
  document.getElementById('modal-title').textContent=`📅 Admin — Journée ${j}`;
  document.getElementById('modal-body').innerHTML=`
    <p class="text-sm text-muted" style="margin-bottom:12px">Gestion de la journée ${j}.</p>
    <label class="profil-label">Deadline de saisie</label>
    <input type="datetime-local" class="profil-input" id="admin-deadline" style="margin-bottom:8px">
    <button class="btn-primary" onclick="saisirDeadline(${j})">⏰ Enregistrer</button>
    <hr class="divider">
    <button class="btn-danger" onclick="resetJournee(${j})">🗑️ Réinitialiser la journée ${j}</button>
    <p class="text-sm text-muted text-center mt-8">Efface tous les pronostics.</p>`;
  ouvrirModal();
}

async function saisirDeadline(j) {
  const val=document.getElementById('admin-deadline')?.value;
  if(!val) return;
  try { await APP.db.collection('journees').doc(`j${j}`).set({deadline:new Date(val).getTime()},{merge:true}); fermerModal(); showToast(`⏰ Deadline J${j} enregistrée`,'success'); }
  catch(e) { showToast('Erreur','error'); }
}

async function resetJournee(j) {
  if(!confirm(`Réinitialiser la journée ${j} ?\nTous les pronostics seront effacés.`)) return;
  try { await APP.db.collection('journees').doc(`j${j}`).set({soumissions:{},statuts:{}},{merge:true}); fermerModal(); showToast(`✅ Journée ${j} réinitialisée`,'warning'); chargerTab('grille'); }
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
