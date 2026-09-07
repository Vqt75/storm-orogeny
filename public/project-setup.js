/* Storm — Project Creation V2.
   Doctrine : "Creation creates the container. Studio builds the
   project." Une seule décision métier : le nom. Aucune description,
   aucun logo, aucune couleur, aucun module, aucune invitation,
   aucune publication -- tout cela appartient à Studio ou à Control.
*/
(function () {
  'use strict';

  const LOCALES = [
    { code: 'fr', label: 'Français' },
    { code: 'en', label: 'English' },
    { code: 'it', label: 'Italiano' },
    { code: 'es', label: 'Español' },
    { code: 'nl', label: 'Nederlands' },
    { code: 'de', label: 'Deutsch' }
  ];
  const KNOWN_CODES = new Set(LOCALES.map(l => l.code));
  const FALLBACK_LOCALE = 'fr';

  function devHeaders() {
    const d = new URLSearchParams(location.search).get('devUser');
    return d ? { 'X-Storm-Dev-User': d } : {};
  }
  function preserveDev(url) {
    const d = new URLSearchParams(location.search).get('devUser');
    return d ? url + (url.includes('?') ? '&' : '?') + 'devUser=' + encodeURIComponent(d) : url;
  }
  function escapeHtml(v) {
    return String(v ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
  }

  // Meilleur repli réellement disponible côté client, sans inventer de
  // préférence organisationnelle qui n'existe pas dans le modèle
  // actuel (voir audit) -- même logique que le repli serveur
  // (Accept-Language), ici via navigator.language.
  function deriveInitialLocale() {
    const raw = (navigator.language || navigator.userLanguage || '').toLowerCase();
    const base = raw.split('-')[0];
    return KNOWN_CODES.has(base) ? base : FALLBACK_LOCALE;
  }

  function isPrimarilyTouch() {
    return window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;
  }

  const root = document.createElement('div');
  root.innerHTML = `
    <div class="top-left">
      <a class="back-link" id="backLink" href="${escapeHtml(preserveDev('/'))}">Retour</a>
    </div>
    <div class="top-right">
      <label class="visually-hidden" for="localeSelect">Langue par défaut du contenu</label>
      <div class="locale-control">
        <select id="localeSelect" aria-label="Langue par défaut du contenu">
          ${LOCALES.map(l => `<option value="${l.code}">Contenu · ${escapeHtml(l.label)}</option>`).join('')}
        </select>
      </div>
    </div>
    <main>
      <label class="prompt" for="nameField">Comment s'appelle votre projet ?</label>
      <input
        class="name-field"
        id="nameField"
        type="text"
        autocomplete="off"
        placeholder="Projet Quatro"
        aria-describedby="errorMessage"
      />
      <p class="error-message" id="errorMessage" role="alert"></p>
    </main>
    <div class="dock">
      <button class="cta" id="createBtn" type="button" disabled>Créer le projet</button>
    </div>
  `;
  document.body.appendChild(root);

  const nameField = document.getElementById('nameField');
  const localeSelect = document.getElementById('localeSelect');
  const createBtn = document.getElementById('createBtn');
  const errorEl = document.getElementById('errorMessage');

  const initialLocale = deriveInitialLocale();
  localeSelect.value = initialLocale;
  let localeTouched = false;
  function updateLocaleAccessibleLabel() {
    const current = LOCALES.find(l => l.code === localeSelect.value);
    localeSelect.setAttribute('aria-label', `Langue par défaut du contenu : ${current ? current.label : ''}`);
  }
  updateLocaleAccessibleLabel();
  localeSelect.addEventListener('change', () => { localeTouched = true; updateLocaleAccessibleLabel(); });

  function updateCtaState() {
    createBtn.disabled = nameField.value.trim().length === 0;
  }
  nameField.addEventListener('input', updateCtaState);
  updateCtaState();

  // Autofocus desktop uniquement, après la fin de la transition
  // d'entrée -- jamais pendant, jamais sur mobile (le clavier ne doit
  // jamais s'ouvrir tout seul, seulement au tap explicite).
  if (!isPrimarilyTouch()) {
    setTimeout(() => nameField.focus(), 60);
  }

  nameField.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (!createBtn.disabled) attemptCreate();
    }
    // Échap ne navigue jamais -- le retour explicite reste le seul
    // mécanisme de navigation, comme demandé.
  });

  createBtn.addEventListener('click', attemptCreate);

  let creating = false;
  async function attemptCreate() {
    if (creating) return;
    const name = nameField.value.trim();
    if (!name) return;

    creating = true;
    errorEl.textContent = '';
    nameField.disabled = true;
    createBtn.disabled = true;
    const originalLabel = createBtn.textContent;

    // "Création…" seulement au-delà de ~400ms -- jamais un état de
    // chargement affiché sur une action qui aurait dû être instantanée.
    const slowTimer = setTimeout(() => { createBtn.textContent = 'Création…'; }, 400);

    const payload = { name };
    if (localeTouched) payload.contentLocale = localeSelect.value;

    let projectId = null;
    try {
      const res = await fetch('/api/projects', {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, devHeaders()),
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        let msg = 'La création de votre projet a échoué. Réessayez.';
        try { const body = await res.json(); if (body && body.error && body.error.message) msg = body.error.message; } catch (e) {}
        throw new Error(msg);
      }
      const json = await res.json();
      projectId = json.id;
    } catch (err) {
      clearTimeout(slowTimer);
      creating = false;
      nameField.disabled = false;
      createBtn.disabled = false;
      createBtn.textContent = originalLabel;
      errorEl.textContent = err.message || 'La création de votre projet a échoué. Réessayez.';
      nameField.focus();
      return;
    }

    clearTimeout(slowTimer);
    // Succès : bascule directe vers Studio, aucun écran intermédiaire
    // "Projet créé", aucune confirmation.
    location.assign(preserveDev(`/projects/${encodeURIComponent(projectId)}/studio?justCreated=1`));
  }
})();
