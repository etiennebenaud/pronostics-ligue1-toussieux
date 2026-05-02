// ============================================================
// JOUEURS.JS — Gestion dynamique des joueurs depuis Firestore
// Ce code s'intègre dans app.js (remplace la liste statique)
// ============================================================

// ── État joueurs (chargés depuis Firestore au démarrage) ──
// APP.joueurs remplace CONFIG.joueurs (liste dynamique)

// ── Initialisation : charger les joueurs depuis Firestore ──
async function initJoueurs() {
  try {
    const snap = await APP.db.collection('config').doc('joueurs').get();

    if (!snap.exists || !snap.data().liste || snap.data().liste.length === 0) {
      // Première fois : créer le joueur initial depuis config.js
      const initial = CONFIG.joueurInitial;
      const liste = [{
        id:     initial.id,
        nom:    initial.nom,
        code:   initial.code.toUpperCase(),
        equipe: initial.equipe,
        emoji:  initial.emoji,
        actif:  true,
        creeLe: Date.now(),
      }];
      await APP.db.collection('config').doc('joueurs').set({ liste });
      APP.joueurs = liste;
    } else {
      APP.joueurs = snap.data().liste.filter(j => j.actif !== false);
    }
  } catch(e) {
    console.error('Erreur chargement joueurs:', e);
    // Fallback : joueur initial local
    APP.joueurs = [CONFIG.joueurInitial];
  }
}

// ── Écouter les changements de joueurs en temps réel ──────
function ecouterJoueurs(callback) {
  return APP.db.collection('config').doc('joueurs').onSnapshot(snap => {
    if (snap.exists && snap.data().liste) {
      APP.joueurs = snap.data().liste.filter(j => j.actif !== false);
      if (callback) callback(APP.joueurs);
    }
  });
}

// ── Sauvegarder la liste complète ────────────────────────
async function sauverJoueurs(liste) {
  await APP.db.collection('config').doc('joueurs').set({ liste });
  APP.joueurs = liste.filter(j => j.actif !== false);
}

// ── Générer un ID unique à partir du nom ─────────────────
function genId(nom) {
  return nom.toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // accents
    .replace(/[^a-z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    + '_' + Date.now().toString(36);
}

// ── Générer un code aléatoire ─────────────────────────────
function genCode(nom) {
  const prefix = nom.slice(0, 4).toUpperCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z]/g, 'X')
    .padEnd(4, 'X');
  const suffix = Math.floor(10 + Math.random() * 90);
  return prefix + suffix;
}

// ── INTERFACE ADMIN : Gestion des joueurs ────────────────
async function chargerAdminJoueurs() {
  const snap = await APP.db.collection('config').doc('joueurs').get();
  const liste = snap.exists ? (snap.data().liste || []) : [];

  const emojis = ['⚽','🦁','🐺','🦊','🐯','🦅','🦋','⚡','🌟','🔥',
                  '💎','🎯','🏆','🎭','🦄','🎸','🚀','🌈','⚓','🎪'];

  const equipesL1 = ['Paris SG','Marseille','Lyon','Monaco','Lille','Lens',
    'Rennes','Nice','Brest','Nantes','Strasbourg','Reims',
    'Le Havre','Lorient','Toulouse','Metz','Auxerre','Angers'];

  document.getElementById('modal-title').textContent = '👥 Gestion des joueurs';
  document.getElementById('modal-body').innerHTML = `

    <p class="text-sm text-muted" style="margin-bottom:14px">
      ${liste.filter(j=>j.actif!==false).length} joueur(s) actif(s) · Pas de limite de nombre
    </p>

    <!-- Liste des joueurs existants -->
    <div id="liste-joueurs">
      ${liste.map((j, idx) => `
        <div class="joueur-row ${j.actif===false?'inactif':''}" id="row-${idx}"
             style="display:flex;align-items:center;gap:8px;padding:8px 0;
                    border-bottom:1px solid var(--color-border-tertiary);
                    opacity:${j.actif===false?'0.4':'1'}">
          <span style="font-size:20px">${j.emoji}</span>
          <div style="flex:1;min-width:0">
            <div style="font-size:13px;font-weight:500;color:var(--color-text-primary)">${j.nom}</div>
            <div style="font-size:11px;color:var(--color-text-secondary)">${j.equipe || ''} · Code : <code style="background:var(--color-background-tertiary);padding:1px 5px;border-radius:3px;font-size:11px">${j.code}</code></div>
          </div>
          <button onclick="editerJoueur(${idx})"
            style="background:var(--color-background-secondary);border:1px solid var(--color-border-tertiary);
                   border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer;color:var(--color-text-secondary)">
            ✏️
          </button>
          ${j.actif!==false
            ? `<button onclick="desactiverJoueur(${idx})"
                style="background:var(--color-background-danger);border:none;
                       border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer;color:var(--color-text-danger)">
                Retirer
               </button>`
            : `<button onclick="reactiverJoueur(${idx})"
                style="background:var(--color-background-success);border:none;
                       border-radius:6px;padding:4px 8px;font-size:12px;cursor:pointer;color:var(--color-text-success)">
                Réactiver
               </button>`
          }
        </div>
      `).join('')}
    </div>

    <!-- Formulaire ajout nouveau joueur -->
    <div style="margin-top:16px;padding-top:16px;border-top:2px solid var(--color-border-tertiary)">
      <p style="font-size:13px;font-weight:500;color:var(--color-text-primary);margin-bottom:12px">
        ➕ Ajouter un joueur
      </p>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div>
          <label class="profil-label">Prénom *</label>
          <input class="profil-input" id="new-nom" placeholder="Ex: Thomas" maxlength="20"
                 oninput="previsualiserCode()">
        </div>
        <div>
          <label class="profil-label">Code secret *</label>
          <input class="profil-input" id="new-code" placeholder="Ex: THOM09"
                 style="text-transform:uppercase;letter-spacing:2px;font-weight:600"
                 maxlength="10">
          <button onclick="regenererCode()"
            style="font-size:11px;color:var(--color-text-info);background:none;border:none;cursor:pointer;margin-top:2px">
            🔄 Générer automatiquement
          </button>
        </div>
        <div>
          <label class="profil-label">Équipe favorite</label>
          <input class="profil-input" id="new-equipe" placeholder="Ex: Olympique Lyonnais"
                 list="equipes-aj">
          <datalist id="equipes-aj">
            ${equipesL1.map(e => `<option value="${e}">`).join('')}
          </datalist>
        </div>
        <div>
          <label class="profil-label">Emoji / avatar</label>
          <div style="display:flex;flex-wrap:wrap;gap:4px;margin-top:4px" id="emoji-picker-admin">
            ${emojis.map(e => `
              <div onclick="selectEmojiAdmin('${e}')" id="emoji-${e}"
                   style="width:32px;height:32px;border-radius:50%;border:2px solid var(--color-border-tertiary);
                          display:flex;align-items:center;justify-content:center;
                          font-size:16px;cursor:pointer;transition:all 0.15s">
                ${e}
              </div>`).join('')}
          </div>
        </div>
      </div>

      <button class="btn-primary" onclick="ajouterJoueur()" style="margin-top:8px">
        ➕ Ajouter ce joueur
      </button>

      <div id="msg-ajout" style="margin-top:8px;font-size:13px;display:none"></div>
    </div>

    <!-- Info partage -->
    <div style="margin-top:16px;background:var(--color-background-info);
                border-radius:8px;padding:12px;font-size:12px;color:var(--color-text-info)">
      <strong>Comment partager avec un nouveau joueur :</strong><br>
      1. Ajoutez-le ici et notez son code<br>
      2. Envoyez-lui le lien de l'app + son code par SMS ou WhatsApp<br>
      3. Il entre son code → il est dans la partie !
    </div>
  `;

  // Sélectionner le 1er emoji par défaut
  selectEmojiAdmin('⚽');
  ouvrirModal();
}

let emojiAdminSelectionne = '⚽';
function selectEmojiAdmin(emoji) {
  emojiAdminSelectionne = emoji;
  document.querySelectorAll('[id^="emoji-"]').forEach(el => {
    const isSelected = el.id === `emoji-${emoji}`;
    el.style.borderColor       = isSelected ? 'var(--color-text-info)' : 'var(--color-border-tertiary)';
    el.style.background        = isSelected ? 'var(--color-background-info)' : 'transparent';
  });
}

function previsualiserCode() {
  const nom = document.getElementById('new-nom')?.value || '';
  const codeInput = document.getElementById('new-code');
  if (codeInput && !codeInput.dataset.modifie) {
    codeInput.value = genCode(nom);
  }
}

function regenererCode() {
  const nom = document.getElementById('new-nom')?.value || 'XXXX';
  const codeInput = document.getElementById('new-code');
  if (codeInput) {
    codeInput.value = genCode(nom);
    codeInput.dataset.modifie = '1';
  }
}

async function ajouterJoueur() {
  const nom    = document.getElementById('new-nom')?.value?.trim();
  const code   = document.getElementById('new-code')?.value?.trim().toUpperCase();
  const equipe = document.getElementById('new-equipe')?.value?.trim() || '';
  const msgEl  = document.getElementById('msg-ajout');

  // Validation
  if (!nom || nom.length < 2) {
    afficherMsgAjout('⚠️ Entrez un prénom (2 caractères minimum)', 'warning');
    return;
  }
  if (!code || code.length < 4) {
    afficherMsgAjout('⚠️ Le code doit faire au moins 4 caractères', 'warning');
    return;
  }

  // Vérifier unicité du code
  const snap = await APP.db.collection('config').doc('joueurs').get();
  const liste = snap.exists ? (snap.data().liste || []) : [];
  const codeExiste = liste.some(j => j.code.toUpperCase() === code && j.actif !== false);
  if (codeExiste) {
    afficherMsgAjout('❌ Ce code est déjà utilisé par un autre joueur', 'error');
    return;
  }
  if (code.toUpperCase() === CONFIG.codeAdmin.toUpperCase()) {
    afficherMsgAjout('❌ Ce code est réservé à l\'administrateur', 'error');
    return;
  }

  // Ajouter
  const nouveau = {
    id:     genId(nom),
    nom,
    code,
    equipe,
    emoji:  emojiAdminSelectionne,
    actif:  true,
    creeLe: Date.now(),
  };
  liste.push(nouveau);

  try {
    await sauverJoueurs(liste);
    afficherMsgAjout(`✅ ${nom} ajouté ! Code : ${code}`, 'success');
    // Reset formulaire
    document.getElementById('new-nom').value    = '';
    document.getElementById('new-code').value   = '';
    document.getElementById('new-equipe').value = '';
    delete document.getElementById('new-code').dataset.modifie;
    selectEmojiAdmin('⚽');
    // Recharger la liste
    await chargerAdminJoueurs();
  } catch(e) {
    afficherMsgAjout('❌ Erreur lors de l\'ajout. Réessayez.', 'error');
    console.error(e);
  }
}

function afficherMsgAjout(msg, type) {
  const el = document.getElementById('msg-ajout');
  if (!el) return;
  const couleurs = {
    success: { bg: 'var(--color-background-success)', color: 'var(--color-text-success)' },
    warning: { bg: 'var(--color-background-warning)', color: 'var(--color-text-warning)' },
    error:   { bg: 'var(--color-background-danger)',  color: 'var(--color-text-danger)' },
  };
  const c = couleurs[type] || couleurs.warning;
  el.style.display    = 'block';
  el.style.background = c.bg;
  el.style.color      = c.color;
  el.style.padding    = '8px 12px';
  el.style.borderRadius = '8px';
  el.style.fontWeight = '500';
  el.textContent      = msg;
}

async function desactiverJoueur(idx) {
  const snap = await APP.db.collection('config').doc('joueurs').get();
  const liste = snap.data().liste;
  const nom = liste[idx].nom;
  if (!confirm(`Retirer ${nom} de la partie ?\nSes pronostics passés restent conservés.`)) return;
  liste[idx].actif = false;
  await sauverJoueurs(liste);
  showToast(`${nom} retiré de la partie`, 'warning');
  chargerAdminJoueurs();
}

async function reactiverJoueur(idx) {
  const snap = await APP.db.collection('config').doc('joueurs').get();
  const liste = snap.data().liste;
  liste[idx].actif = true;
  await sauverJoueurs(liste);
  showToast(`${liste[idx].nom} réactivé !`, 'success');
  chargerAdminJoueurs();
}

// Édition inline d'un joueur existant
async function editerJoueur(idx) {
  const snap = await APP.db.collection('config').doc('joueurs').get();
  const liste = snap.data().liste;
  const j = liste[idx];

  const nouveauNom    = prompt(`Nouveau prénom pour ${j.nom} :`, j.nom);
  if (!nouveauNom) return;
  const nouveauCode   = prompt(`Nouveau code pour ${j.nom} :`, j.code);
  if (!nouveauCode) return;
  const nouvelleEquipe = prompt(`Équipe favorite :`, j.equipe || '');

  liste[idx] = { ...j, nom: nouveauNom.trim(), code: nouveauCode.trim().toUpperCase(), equipe: nouvelleEquipe || '' };
  await sauverJoueurs(liste);
  showToast(`${nouveauNom} mis à jour !`, 'success');

  // Si c'est le joueur connecté, mettre à jour la session
  if (APP.joueurActif && APP.joueurActif.id === j.id) {
    APP.joueurActif = liste[idx];
  }
  chargerAdminJoueurs();
}
