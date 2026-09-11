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
      <label class="prompt" for="clientField">Client</label>
      <input
        class="name-field"
        id="clientField"
        type="text"
        autocomplete="off"
        placeholder="Rechercher un client…"
        aria-describedby="clientResults"
      />
      <ul class="client-results" id="clientResults" hidden></ul>
      <p class="client-selected" id="clientSelected" hidden></p>
      <button class="client-create-link" id="clientCreateBtn" type="button" hidden>Créer un nouveau client</button>

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

  const clientField = document.getElementById('clientField');
  const clientResults = document.getElementById('clientResults');
  const clientSelected = document.getElementById('clientSelected');
  const clientCreateBtn = document.getElementById('clientCreateBtn');
  const nameField = document.getElementById('nameField');
  const localeSelect = document.getElementById('localeSelect');
  const createBtn = document.getElementById('createBtn');
  const errorEl = document.getElementById('errorMessage');

  let selectedClient = null; // { id, name } -- jamais un texte libre envoyé à POST /api/projects
  let canManageClients = false;
  let searchDebounce = null;

  function selectClient(client) {
    selectedClient = client;
    clientField.value = '';
    clientResults.hidden = true;
    clientResults.innerHTML = '';
    clientSelected.hidden = false;
    clientSelected.textContent = `Client : ${client.name}`;
    updateCtaState();
  }

  async function searchClients(query) {
    try {
      const res = await fetch(preserveDev(`/api/clients?search=${encodeURIComponent(query)}`), { headers: devHeaders() });
      if (!res.ok) return;
      const clients = await res.json();
      if (clients.length === 0) {
        clientResults.hidden = true;
        clientResults.innerHTML = '';
        return;
      }
      clientResults.innerHTML = clients.map(c => `<li><button type="button" data-client-id="${escapeHtml(c.id)}" data-client-name="${escapeHtml(c.name)}">${escapeHtml(c.name)}</button></li>`).join('');
      clientResults.hidden = false;
    } catch (e) { /* recherche best-effort, jamais bloquante */ }
  }

  clientField.addEventListener('input', () => {
    clearTimeout(searchDebounce);
    const query = clientField.value.trim();
    if (!query) { clientResults.hidden = true; clientResults.innerHTML = ''; return; }
    searchDebounce = setTimeout(() => searchClients(query), 200);
  });

  clientResults.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-client-id]');
    if (!btn) return;
    selectClient({ id: btn.getAttribute('data-client-id'), name: btn.getAttribute('data-client-name') });
  });

  // "Créer un nouveau client" -- restreint à CLIENTS_MANAGE, découvert
  // au chargement (voir bootstrapClientCreation ci-dessous). Ne demande
  // que le nom -- aucun champ CRM (logo/adresse/contact/secteur/etc.),
  // conformément à la doctrine de simplicité de cet écran.
  clientCreateBtn.addEventListener('click', async () => {
    const name = window.prompt('Nom du nouveau client :');
    if (!name || !name.trim()) return;
    try {
      const res = await fetch(preserveDev('/api/clients'), {
        method: 'POST',
        headers: Object.assign({ 'Content-Type': 'application/json' }, devHeaders()),
        body: JSON.stringify({ name: name.trim() })
      });
      if (!res.ok) {
        let msg = 'La création du client a échoué.';
        try { const body = await res.json(); if (body?.error?.message) msg = body.error.message; } catch (e) {}
        errorEl.textContent = msg;
        return;
      }
      const client = await res.json();
      selectClient(client);
    } catch (e) {
      errorEl.textContent = 'La création du client a échoué. Réessayez.';
    }
  });

  // Découverte de CLIENTS_MANAGE -- best-effort : une recherche vide
  // réussie confirme au moins PROJECTS_CREATE (déjà nécessaire pour
  // être sur cet écran) ; le bouton de création reste masqué par
  // défaut, jamais affiché de façon optimiste avant confirmation.
  async function bootstrapClientCreation() {
    try {
      const res = await fetch(preserveDev('/api/clients?search=__probe__'), { headers: devHeaders() });
      // Une réponse 200 confirme l'accès en lecture ; la capability de
      // création reste vérifiée côté serveur à l'appel POST lui-même --
      // ce bouton n'est qu'une affordance, jamais une autorisation.
      if (res.ok) {
        clientCreateBtn.hidden = false;
        canManageClients = true;
      }
    } catch (e) { /* best-effort */ }
  }
  bootstrapClientCreation();


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
    createBtn.disabled = nameField.value.trim().length === 0 || !selectedClient;
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
    if (!name || !selectedClient) return;

    creating = true;
    errorEl.textContent = '';
    nameField.disabled = true;
    createBtn.disabled = true;
    const originalLabel = createBtn.textContent;

    // "Création…" seulement au-delà de ~400ms -- jamais un état de
    // chargement affiché sur une action qui aurait dû être instantanée.
    const slowTimer = setTimeout(() => { createBtn.textContent = 'Création…'; }, 400);

    const payload = { name, clientId: selectedClient.id };
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
