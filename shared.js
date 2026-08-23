(() => {
  'use strict';
  const { t, apply: applyTranslations, locale } = LCCI18N;
  const STORAGE = { game: 'lcc.game.v1', directory: 'lcc.directory.v1', tournament: 'lcc.tournament.v1' };
  const STARTING_SAVINGS = Object.freeze({ 3: 900, 4: 1000, 5: 1100, 6: 1200, 7: 1300, 8: 1400 });
  function uid(prefix = 'id') { return `${prefix}_${globalThis.crypto?.randomUUID?.() || `${Date.now().toString(36)}_${Math.random().toString(36).slice(2)}`}`; }
  function load(key, fallback) { try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; } }
  function save(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function escapeHtml(value) { return String(value ?? '').replace(/[&<>'"]/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]); }
  function normalizeName(value) { return String(value ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('ca').replace(/[^a-z0-9]+/g, ' ').trim().replace(/\s+/g, ' '); }
  function money(value) { return new Intl.NumberFormat(locale(), { style: 'currency', currency: 'EUR', minimumFractionDigits: Number(value) % 1 ? 2 : 0 }).format(Number(value) || 0); }
  function compactNumber(value) { return Math.round((Number(value) + Number.EPSILON) * 100) / 100; }
  function toBase64Url(value) { const bytes = new TextEncoder().encode(value); let binary = ''; bytes.forEach(byte => { binary += String.fromCharCode(byte); }); return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); }
  function fromBase64Url(value) { const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '='); const binary = atob(base64); return new TextDecoder().decode(Uint8Array.from(binary, character => character.charCodeAt(0))); }
  function createResultUrl(payload) { const url = new URL('tournament.html', location.href); url.search = ''; url.hash = `import=${toBase64Url(JSON.stringify(payload))}`; return url.toString(); }
  function parseResultText(text) {
    let payloadText = String(text || '').trim();
    try { const url = new URL(payloadText); const hash = new URLSearchParams(url.hash.replace(/^#/, '')); payloadText = fromBase64Url(hash.get('import') || ''); }
    catch { if (payloadText.startsWith('LCC1:')) payloadText = fromBase64Url(payloadText.slice(5)); }
    const payload = JSON.parse(payloadText);
    if (payload?.p !== 'LCC1' || !Array.isArray(payload.a) || !payload.g) throw new Error(t('Aquest QR no és un resultat compatible.'));
    if (payload.a.length < 3 || payload.a.length > 8) throw new Error(t('El resultat ha de contenir entre 3 i 8 participants.'));
    payload.a.forEach(player => { if (!player.n || !Number.isFinite(Number(player.s)) || !Number.isFinite(Number(player.b))) throw new Error(t('El resultat conté dades incompletes.')); });
    return payload;
  }
  function renderQr(container, text) {
    if (typeof qrcode !== 'function') throw new Error(t('No s’ha pogut carregar el generador QR.'));
    const qr = qrcode(0, 'M'); qr.addData(text); qr.make();
    const canvas = document.createElement('canvas'); const quiet = 4; const modules = qr.getModuleCount(); const scale = Math.max(3, Math.floor(280 / (modules + quiet * 2)));
    canvas.width = canvas.height = (modules + quiet * 2) * scale; const context = canvas.getContext('2d'); context.fillStyle = '#ffffff'; context.fillRect(0, 0, canvas.width, canvas.height); context.fillStyle = '#17201c';
    for (let row = 0; row < modules; row += 1) for (let column = 0; column < modules; column += 1) if (qr.isDark(row, column)) context.fillRect((column + quiet) * scale, (row + quiet) * scale, scale, scale);
    container.replaceChildren(canvas);
  }
  let toastTimer;
  function toast(message, tone = '') { const element = document.querySelector('#toast'); if (!element) return; element.textContent = message; element.className = `toast show ${tone}`; clearTimeout(toastTimer); toastTimer = setTimeout(() => { element.className = 'toast'; }, 3200); }
  function updateDirectory(names) { const current = load(STORAGE.directory, []); const known = new Set(current.map(normalizeName)); names.forEach(name => { if (name && !known.has(normalizeName(name))) { current.push(name.trim()); known.add(normalizeName(name)); } }); save(STORAGE.directory, current.slice(-100)); }
  let installPrompt;
  window.addEventListener('beforeinstallprompt', event => { event.preventDefault(); installPrompt = event; document.querySelectorAll('[data-install]').forEach(button => button.classList.remove('hidden')); });
  document.addEventListener('click', async event => { const button = event.target.closest('[data-install]'); if (!button) return; if (installPrompt) { installPrompt.prompt(); await installPrompt.userChoice; installPrompt = null; button.classList.add('hidden'); } else { toast(t(/iphone|ipad|ipod/i.test(navigator.userAgent) ? 'A iOS: Compartir → Afegeix a la pantalla d’inici.' : 'Obre el menú del navegador i tria “Instal·la l’aplicació”.')); } });
  window.addEventListener('appinstalled', () => document.querySelectorAll('[data-install]').forEach(button => button.classList.add('hidden')));
  if (/iphone|ipad|ipod/i.test(navigator.userAgent) && !navigator.standalone) document.querySelectorAll('[data-install]').forEach(button => button.classList.remove('hidden'));
  document.querySelector('#language-select')?.addEventListener('change', event => LCCI18N.setLanguage(event.target.value));
  applyTranslations();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('./sw.js').catch(() => {});
  globalThis.LCC = Object.freeze({ STORAGE, STARTING_SAVINGS, uid, load, save, escapeHtml, normalizeName, money, compactNumber, createResultUrl, parseResultText, renderQr, toast, updateDirectory, toBase64Url, fromBase64Url, t, applyTranslations });
})();
