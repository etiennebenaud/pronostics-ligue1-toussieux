// Stockage temporaire des journées chargées (évite le passage JSON dans onclick)
let _journeesChargees = {};
let _saisonChargee = "";

// ============================================================
// CALENDRIER.JS — Scraping TheSportsDB + validation admin
// API gratuite, sans clé, 9 matchs/journée, dates incluses
// ============================================================

const SPORTSDB_LEAGUE = 4334; // Ligue 1

// ── Récupérer les 18 équipes d'une saison depuis J1 ────────
// J1 contient exactement les 18 équipes participantes
async function fetchEquipesSaison(saisonKey) {
  try {
    const matchs = await fetchJourneeAPI(1, saisonKey.replace('-', '/'));
    if (!matchs || matchs.length === 0) return [];
    const equipes = [...new Set([
      ...matchs.map(m => m.domicile),
      ...matchs.map(m => m.exterieur),
    ])].filter(Boolean).sort();
    console.log(`Équipes ${saisonKey}:`, equipes);
    return equipes;
  } catch(e) {
    console.error('fetchEquipesSaison:', e);
    return [];
  }
}

// ── Rafraîchir la liste des équipes (bouton admin) ───────────
async function rafraichirEquipes() {
  const saison = saisonApiFormat(CONFIG.saison);
  const btn = document.getElementById('btn-refresh-equipes');
  if (btn) { btn.textContent = '⏳ Chargement...'; btn.disabled = true; }
  const equipes = await fetchEquipesSaison(saison);
  if (equipes.length > 0) {
    APP.equipesL1 = equipes;
    showToast(`✅ ${equipes.length} équipes chargées pour ${CONFIG.saison}`, 'success');
  } else {
    showToast('Impossible de charger les équipes. Vérifiez la connexion.', 'error');
  }
  if (btn) { btn.textContent = '🔄 Rafraîchir les équipes'; btn.disabled = false; }
  return equipes;
}



// Convertit "2026/2027" → "2026-2027" (format TheSportsDB)
function saisonApiFormat(s) {
  return (s || CONFIG.saison).replace('/', '-');
}

// ── Charger une journée depuis l'API ────────────────────────
async function fetchJourneeAPI(numJournee, saisonLabel, tentative = 1) {
  const saison = saisonApiFormat(saisonLabel || CONFIG.saison);
  const url = `https://www.thesportsdb.com/api/v1/json/3/eventsround.php` +
              `?id=${SPORTSDB_LEAGUE}&r=${numJournee}&s=${saison}`;
  try {
    const resp = await fetch(url);
    if (!resp.ok) {
      if (resp.status === 429 && tentative <= 3) {
        // Rate limit : attendre 2s et réessayer
        console.warn(`Rate limit J${numJournee}, retry ${tentative}/3...`);
        await new Promise(r => setTimeout(r, 2000 * tentative));
        return fetchJourneeAPI(numJournee, saisonLabel, tentative + 1);
      }
      throw new Error(`HTTP ${resp.status}`);
    }
    const data = await resp.json();
    return (data.events || []).map(e => ({
      domicile:  e.strHomeTeam  || '',
      exterieur: e.strAwayTeam  || '',
      date:      formaterDate(e.dateEvent, e.strTime),
      timestamp: e.dateEvent && e.strTime
                   ? new Date(`${e.dateEvent}T${e.strTime}`).getTime()
                   : null,
      scoreReel: (e.intHomeScore !== null && e.intAwayScore !== null &&
                  e.intHomeScore !== '' && e.intAwayScore !== '')
                   ? { dom: parseInt(e.intHomeScore), ext: parseInt(e.intAwayScore) }
                   : null,
      idApi: e.idEvent || null,
    }));
  } catch(e) {
    console.error(`fetchJourneeAPI J${numJournee}:`, e);
    return null;
  }
}

// Formate "2026-08-14" + "20:00:00" → "Ven 14/08 20h00"
function formaterDate(dateStr, timeStr) {
  if (!dateStr) return '';
  try {
    const d = new Date(`${dateStr}T${timeStr || '00:00:00'}`);
    const jours = ['Dim','Lun','Mar','Mer','Jeu','Ven','Sam'];
    const j = jours[d.getDay()];
    const dd = String(d.getDate()).padStart(2,'0');
    const mm = String(d.getMonth()+1).padStart(2,'0');
    const hh = String(d.getHours()).padStart(2,'0');
    const mn = String(d.getMinutes()).padStart(2,'0');
    return `${j} ${dd}/${mm} ${hh}h${mn}`;
  } catch(e) { return dateStr; }
}

// ══════════════════════════════════════════════════════════
// INTERFACE ADMIN : Chargement et validation du calendrier
// ══════════════════════════════════════════════════════════
async function ouvrirCalendrierAdmin() {
  document.getElementById('modal-title').textContent = '📅 Chargement du calendrier';
  document.getElementById('modal-body').innerHTML = `
    <div id="cal-body">
      <p class="text-sm text-muted" style="margin-bottom:14px">
        Charge le calendrier depuis <strong>TheSportsDB</strong> (gratuit, sans clé).<br>
        Vous pouvez valider journée par journée ou tout valider d'un coup.
      </p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px">
        <div>
          <label class="profil-label">Saison</label>
          <input class="profil-input" id="cal-saison"
            value="${CONFIG.saison}" placeholder="Ex: 2025/2026">
        </div>
        <div>
          <label class="profil-label">Journées (ex: 1-38 ou 37-38)</label>
          <input class="profil-input" id="cal-range"
            value="1-34" placeholder="Ex: 1-38">
        </div>
      </div>

      <button class="btn-primary" onclick="lancerChargementCalendrier()" id="btn-charger">
        🔄 Charger depuis TheSportsDB
      </button>

      <div id="cal-progress" style="display:none;margin-top:12px">
        <div style="background:var(--color-background-tertiary);border-radius:8px;
                    height:6px;overflow:hidden;margin-bottom:8px">
          <div id="cal-progress-bar"
               style="background:var(--orange);height:100%;width:0%;transition:width 0.3s"></div>
        </div>
        <p class="text-sm text-muted text-center" id="cal-progress-label">Chargement...</p>
      </div>

      <div id="cal-resultats" style="margin-top:12px"></div>
    </div>`;
  ouvrirModal();
}

async function lancerChargementCalendrier() {
  const saisonInput = document.getElementById('cal-saison')?.value?.trim();
  const rangeInput  = document.getElementById('cal-range')?.value?.trim();
  const btnCharger  = document.getElementById('btn-charger');
  if (!saisonInput || !rangeInput) return;

  // Parser la plage "1-38" ou "37-38"
  const [debut, fin] = rangeInput.split('-').map(Number);
  if (isNaN(debut) || isNaN(fin) || debut < 1 || fin > 38 || debut > fin) {
    showToast('Plage invalide. Ex: 1-38 ou 37-38', 'error'); return;
  }

  btnCharger.disabled = true;
  btnCharger.textContent = '⏳ Chargement...';
  const progressDiv = document.getElementById('cal-progress');
  const progressBar = document.getElementById('cal-progress-bar');
  const progressLabel = document.getElementById('cal-progress-label');
  progressDiv.style.display = 'block';

  const total = fin - debut + 1;
  const journeesChargees = {};
  let ok = 0, vides = 0;

  for (let j = debut; j <= fin; j++) {
    progressLabel.textContent = `Chargement J${j}... (${j-debut}/${total})`;
    progressBar.style.width = `${Math.round((j-debut)/total*100)}%`;

    const matchs = await fetchJourneeAPI(j, saisonInput);
    if (matchs && matchs.length > 0) {
      journeesChargees[j] = matchs;
      ok++;
    } else if (matchs === null) {
      // Erreur réseau
      vides++;
    } else {
      // Journée vide = fin de saison atteinte (ex: L1 s'arrête à J34)
      vides++;
      // Si plusieurs journées vides consécutives → arrêt automatique
      if (vides >= 3 && ok > 0) {
        progressLabel.textContent =
          `ℹ️ Arrêt à J${j-1} — fin de saison détectée (${ok} journées chargées)`;
        break;
      }
    }
    // Pause anti-rate-limit
    await new Promise(r => setTimeout(r, 600)); // délai anti-rate-limit
  }

  progressBar.style.width = '100%';
  if (vides > 0 && ok > 0) {
    progressLabel.textContent =
      `✅ ${ok} journée(s) chargées — ${vides} non trouvée(s) (fin de saison ou matchs non programmés)`;
  } else {
    progressLabel.textContent = `✅ ${ok} journée(s) chargée(s)`;
  }
  btnCharger.disabled = false;
  btnCharger.textContent = '🔄 Recharger';

  // Afficher le tableau de validation
  _journeesChargees = journeesChargees;
  _saisonChargee = saisonInput;
  afficherValidationCalendrier(journeesChargees, saisonInput);
}

function afficherValidationCalendrier(journees, saisonInput) {
  const container = document.getElementById('cal-resultats');
  const keys = Object.keys(journees).map(Number).sort((a,b)=>a-b);

  if (keys.length === 0) {
    container.innerHTML = `<div class="empty-state">
      <div class="icon">⚠️</div>
      <p>Aucune journée trouvée pour cette saison.<br>
      Vérifiez le format de la saison (ex: 2025-2026 → entrez 2025/2026).</p>
    </div>`;
    return;
  }

  // Bouton "Valider tout"
  let html = `
    <hr class="divider">
    <div style="display:flex;align-items:center;justify-content:space-between;
                margin-bottom:12px;flex-wrap:wrap;gap:8px">
      <p style="font-size:13px;font-weight:500;color:var(--color-text-primary)">
        ${keys.length} journée(s) prête(s) à valider
      </p>
      <button class="btn-primary"
        onclick="validerToutesJournees(${JSON.stringify(journees).replace(/"/g,'&quot;')}, '${saisonInput}')"
        style="font-size:13px;padding:8px 16px">
        ✅ Valider toutes les journées
      </button>
    </div>`;

  // Afficher chaque journée
  keys.forEach(j => {
    const matchs = journees[j];
    const deadline = matchs[0]?.timestamp
      ? new Date(matchs[0].timestamp - 3600000).toISOString().slice(0,16)
      : '';

    html += `
      <div class="card" style="margin-bottom:10px" id="card-j${j}">
        <div style="display:flex;align-items:center;justify-content:space-between;
                    margin-bottom:8px;flex-wrap:wrap;gap:6px">
          <div class="card-title" style="margin:0">Journée ${j}</div>
          <div style="display:flex;align-items:center;gap:6px;flex-wrap:wrap">
            <span class="text-sm text-muted">${matchs.length} matchs</span>
            <button onclick="validerJournee(${j}, ${JSON.stringify(matchs).replace(/"/g,'&quot;')}, '${saisonInput}')"
              class="btn-primary" style="font-size:11px;padding:5px 10px">
              ✅ Valider J${j}
            </button>
          </div>
        </div>
        <table style="width:100%;font-size:11px;border-collapse:collapse">
          <thead>
            <tr style="background:var(--color-background-secondary)">
              <th style="padding:4px 6px;text-align:left">Date</th>
              <th style="padding:4px 6px;text-align:right">Domicile</th>
              <th style="padding:4px 6px;text-align:center">Score</th>
              <th style="padding:4px 6px;text-align:left">Extérieur</th>
            </tr>
          </thead>
          <tbody>
            ${matchs.map((m, idx) => `
              <tr style="border-top:1px solid var(--color-border-tertiary)">
                <td style="padding:4px 6px;color:var(--color-text-secondary);white-space:nowrap">${m.date}</td>
                <td style="padding:4px 6px;text-align:right;font-weight:500">${m.domicile}</td>
                <td style="padding:4px 6px;text-align:center;font-weight:700;color:var(--vert)">
                  ${m.scoreReel ? `${m.scoreReel.dom}-${m.scoreReel.ext}` : '<span style="color:#ccc">—</span>'}
                </td>
                <td style="padding:4px 6px;font-weight:500">${m.exterieur}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`;
  });

  container.innerHTML = html;
}

// ── Valider UNE journée → enregistrer en Firestore ──────────
async function validerJournee(numJ, matchs, saisonInput) {
  const btn = document.querySelector(`#card-j${numJ} button`);
  if (btn) { btn.disabled = true; btn.textContent = '⏳...'; }

  try {
    const saisonKey_ = saisonInput.replace('/', '-');
    const ref = APP.db.collection('saisons').doc(saisonKey_)
                   .collection('journees').doc(`j${numJ}`);

    // Calculer la deadline = 1h avant le 1er match
    const premierMatch = matchs.find(m => m.timestamp);
    const deadline = premierMatch
      ? premierMatch.timestamp - (CONFIG.regles.delaiAvantMatchMinutes * 60000)
      : null;

    // Conserver les soumissions existantes (ne pas écraser)
    const existing = await ref.get();
    const soumissions = existing.exists ? (existing.data().soumissions || {}) : {};
    const statuts     = existing.exists ? (existing.data().statuts || {}) : {};

    await ref.set({
      matchs,
      deadline,
      soumissions,
      statuts,
      valideAt: Date.now(),
      valideAdmin: true,
    });

    // Aussi initialiser la saison si pas encore faite
    await APP.db.collection('saisons').doc(saisonKey_).set({
      label: saisonInput, creeLe: Date.now(), cloturee: false,
    }, { merge: true });

    if (btn) {
      btn.textContent = '✅ Validée';
      btn.style.background = 'var(--vert)';
    }
    showToast(`✅ Journée ${numJ} enregistrée !`, 'success');
  } catch(e) {
    console.error(e);
    if (btn) { btn.disabled = false; btn.textContent = `✅ Valider J${numJ}`; }
    showToast(`Erreur J${numJ}`, 'error');
  }
}

// ── Valider TOUTES les journées d'un coup ────────────────────
async function validerToutesJournees(journees, saisonInput) {
  if (!confirm(`Valider les ${Object.keys(journees).length} journées pour la saison ${saisonInput} ?\nLes matchs et deadlines seront enregistrés.`)) return;

  const keys = Object.keys(journees).map(Number).sort((a,b)=>a-b);
  let done = 0;

  for (const j of keys) {
    await validerJournee(j, journees[j], saisonInput);
    done++;
    showToast(`${done}/${keys.length} journées validées...`, 'default');
    await new Promise(r => setTimeout(r, 200));
  }

  showToast(`✅ Toutes les journées ont été enregistrées !`, 'success');

  // Mettre à jour la détection de journée courante
  APP.journeeActive = await detecterJourneeCouranteFirestore();
  const badge = document.getElementById('header-journee-badge');
  if (badge) badge.textContent = `J.${APP.journeeActive}`;
}

// ── Détection auto de la journée courante (depuis Firestore) ─
async function detecterJourneeCouranteFirestore() {
  const now = Date.now();
  let journeeTrouvee = 1;

  for (let j = 1; j <= CONFIG.nbJournees; j++) {
    try {
      const snap = await dbSaison('journees', `j${j}`).get();
      if (!snap.exists) continue;
      const { deadline, matchs = [] } = snap.data();

      if (deadline && deadline > now) {
        // Cette journée n'est pas encore fermée → c'est la courante
        journeeTrouvee = j;
        break;
      }
      // Si tous les scores sont rentrés → passer à la suivante
      const tousScores = matchs.every(m => m.scoreReel !== null);
      if (!tousScores) {
        journeeTrouvee = j;
        break;
      }
      journeeTrouvee = j; // au moins celle-ci est passée
    } catch(e) { break; }
  }
  return journeeTrouvee;
}

// ── Wrappers utilisant le stockage global (évite JSON dans onclick) ──
async function validerToutesJourneesStockees() {
  await validerToutesJournees(_journeesChargees, _saisonChargee);
}

async function validerJourneeStockee(numJ) {
  const matchs = _journeesChargees[numJ];
  if (!matchs) { showToast('Journée non trouvée en mémoire', 'error'); return; }
  await validerJournee(numJ, matchs, _saisonChargee);
}
