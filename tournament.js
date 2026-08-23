(() => {
  'use strict';
  const { STORAGE, uid, load, save, escapeHtml, normalizeName, money, compactNumber, parseResultText, toast, updateDirectory, t, ensurePersistentStorage } = LCC;
  const $ = selector => document.querySelector(selector);
  const scannerDialog = $('#scanner-dialog');
  const importDialog = $('#import-dialog');
  const video = $('#scanner-video');
  const canvas = $('#scanner-canvas');
  const DEFAULT_SETTINGS = { name: 'Torneig de La Cuenta', rounds: 3, tables: 2, drops: 0, created: false, createdRounds: 0 };
  let state = load(STORAGE.tournament, { version: 1, settings: DEFAULT_SETTINGS, participants: [], games: [] });
  state.settings = { ...DEFAULT_SETTINGS, ...(state.settings || {}) };
  state.games.forEach((game, index) => { game.tournamentRound ||= 1; game.tournamentTable ||= index + 1; });
  if (state.games.length) { state.settings.created = true; state.settings.createdRounds = Math.max(state.settings.createdRounds || 1, ...state.games.map(game => game.tournamentRound)); state.settings.tables = Math.max(state.settings.tables || 1, ...state.games.map(game => game.tournamentTable)); }
  let viewedRound = Math.max(1, state.settings.createdRounds || 1);
  let storageIsPersistent = false;
  let pendingResult = null;
  let mediaStream = null;
  let scanFrame = null;

  function persist() { save(STORAGE.tournament, state); }

  function aggregate() {
    return state.participants.map(participant => {
      const appearances = state.games.flatMap(game => game.players.filter(player => player.participantId === participant.id).map(player => ({ ...player, gameId: game.id, tournamentRound: game.tournamentRound })));
      const keepCount = Math.max(1, state.settings.rounds - state.settings.drops);
      const ordered = [...appearances].sort((a, b) => b.balance - a.balance || a.tournamentRound - b.tournamentRound);
      const counted = ordered.slice(0, keepCount); const discarded = ordered.slice(keepCount);
      const totalBalance = compactNumber(counted.reduce((sum, player) => sum + player.balance, 0));
      const totalStart = compactNumber(counted.reduce((sum, player) => sum + player.start, 0));
      return { ...participant, games: appearances.length, counted: counted.length, discarded: discarded.length, discardedGameIds: new Set(discarded.map(player => player.gameId)), wins: appearances.filter(player => player.rank === 1).length, totalBalance, averageRetention: totalStart ? (totalBalance / totalStart) * 100 : 0 };
    }).sort((a, b) => b.totalBalance - a.totalBalance || a.name.localeCompare(b.name, LCCI18N.locale()));
  }

  function render() {
    renderSettings();
    $('#metric-players').textContent = state.participants.length;
    $('#metric-games').textContent = state.games.length;
    $('#metric-tables').textContent = state.settings.created ? state.settings.tables : 0;
    renderRoundControl(); renderLeaderboard(); renderGames(); renderPeople();
  }

  function renderSettings() {
    $('#tournament-name').value = state.settings.name;
    $('#tournament-rounds').value = state.settings.rounds;
    $('#tournament-tables').value = state.settings.tables;
    $('#tournament-drops').value = state.settings.drops;
    $('#tournament-drops').max = Math.max(0, state.settings.rounds - 1);
    const counted = Math.max(1, state.settings.rounds - state.settings.drops);
    $('#format-summary').textContent = t('{rounds} rondes · {tables} taules per ronda · compten els {counted} millors resultats.', { rounds: state.settings.rounds, tables: state.settings.tables, counted });
    $('#create-tournament').textContent = t(state.settings.created ? 'Actualitza el torneig' : 'Crea torneig');
    $('#round-control').classList.toggle('hidden', !state.settings.created);
  }

  function renderRoundControl() {
    if (!state.settings.created) return;
    viewedRound = Math.min(Math.max(1, viewedRound), state.settings.createdRounds);
    $('#round-control-title').textContent = `${t('Ronda de torneig')} ${viewedRound}`;
    $('#round-tabs').innerHTML = Array.from({ length: state.settings.createdRounds }, (_, index) => `<button type="button" data-view-round="${index + 1}" class="${viewedRound === index + 1 ? 'active' : ''}" aria-label="${t('Mostra la ronda')} ${index + 1}">${index + 1}</button>`).join('');
    $('#round-tabs').querySelectorAll('button').forEach(button => button.addEventListener('click', () => { viewedRound = Number(button.dataset.viewRound); renderRoundControl(); }));
    const roundGames = state.games.filter(game => game.tournamentRound === viewedRound);
    $('#table-slots').innerHTML = Array.from({ length: state.settings.tables }, (_, index) => {
      const tableNumber = index + 1; const game = roundGames.find(item => item.tournamentTable === tableNumber);
      return game ? `<article class="table-slot filled"><span>${t('Taula')} ${tableNumber}</span><div><strong>${escapeHtml(game.table)}</strong><small>${game.players.length} ${t('participants')} · ${game.rounds} ${t('rondes internes')}</small></div><em>${t('Resultat rebut')}</em></article>` : `<article class="table-slot"><span>${t('Taula')} ${tableNumber}</span><div><strong>${t('Pendent de QR')}</strong><small>${t('Assigna aquesta taula en escanejar.')}</small></div></article>`;
    }).join('');
    const complete = roundGames.length >= state.settings.tables;
    $('#round-status').textContent = `${roundGames.length}/${state.settings.tables} ${t('taules amb resultat')}${storageIsPersistent ? ` · ${t('emmagatzematge persistent actiu')}` : ''}`;
    const nextButton = $('#next-tournament-round'); nextButton.disabled = !complete || state.settings.createdRounds >= state.settings.rounds;
    nextButton.classList.toggle('hidden', state.settings.createdRounds >= state.settings.rounds);
  }

  function renderLeaderboard() {
    const rows = aggregate(); const container = $('#leaderboard');
    if (!rows.length) { container.innerHTML = `<div class="empty-state">${t('La classificació apareixerà després d’incorporar el primer QR.')}</div>`; return; }
    let previousBalance = null; let displayedRank = 0;
    container.innerHTML = `<table><thead><tr><th>${t('Pos.')}</th><th>${t('Participant')}</th><th>${t('Partides')}</th><th>${t('Compten')}</th><th>${t('Descarts')}</th><th>${t('Diners computables')}</th></tr></thead><tbody>${rows.map((person, index) => { if (person.totalBalance !== previousBalance) displayedRank = index + 1; previousBalance = person.totalBalance; return `<tr><td><span class="position">${displayedRank}</span></td><td><strong>${escapeHtml(person.name)}</strong></td><td>${person.games}</td><td>${person.counted}</td><td>${person.discarded}</td><td><b>${money(person.totalBalance)}</b></td></tr>`; }).join('')}</tbody></table>`;
  }

  function renderGames() {
    const container = $('#games-list');
    if (!state.games.length) { container.className = 'games-list empty-state'; container.textContent = t('Encara no hi ha cap resultat. Escaneja el QR d’una taula.'); return; }
    container.className = 'games-list';
    const metrics = new Map(aggregate().map(person => [person.id, person]));
    container.innerHTML = [...state.games].reverse().map(game => `<article class="game-record"><div class="game-record-head"><div><span>${t('Ronda de torneig')} ${game.tournamentRound} · ${t('Taula')} ${game.tournamentTable} · ${new Date(game.endedAt).toLocaleDateString(LCCI18N.locale(), { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span><h3>${escapeHtml(game.table)}</h3><small>${game.rounds} ${t('rondes internes')} · ${game.players.length} ${t('participants')}</small></div><button class="icon-button remove-game" data-game-id="${game.id}" type="button" aria-label="${t('Elimina aquest resultat')}">×</button></div><div class="game-results">${[...game.players].sort((a, b) => a.rank - b.rank).map(player => { const person = state.participants.find(item => item.id === player.participantId); const discarded = metrics.get(player.participantId)?.discardedGameIds.has(game.id); return `<span class="${discarded ? 'discarded' : ''}"><em>${player.rank}</em><b>${escapeHtml(person?.name || t('Participant eliminat'))}${discarded ? `<small class="discard-badge">${t('descartat')}</small>` : ''}</b><strong>${money(player.balance)}</strong></span>`; }).join('')}</div></article>`).join('');
    container.querySelectorAll('.remove-game').forEach(button => button.addEventListener('click', () => removeGame(button.dataset.gameId)));
  }

  function renderPeople() {
    const container = $('#people-list');
    if (!state.participants.length) { container.className = 'people-list empty-state'; container.textContent = t('No hi ha participants.'); $('#merge-panel').classList.add('hidden'); return; }
    container.className = 'people-list';
    const metrics = new Map(aggregate().map(person => [person.id, person]));
    container.innerHTML = state.participants.map(person => `<label class="person-row"><span class="avatar">${escapeHtml(person.name.slice(0, 2).toUpperCase())}</span><span><input data-person-id="${person.id}" value="${escapeHtml(person.name)}" maxlength="32" aria-label="${t('Nom del participant')}"><small>${metrics.get(person.id)?.games || 0} ${t('partides')}${person.aliases?.length ? ` · ${t('també')} ${person.aliases.map(escapeHtml).join(', ')}` : ''}</small></span></label>`).join('');
    container.querySelectorAll('input').forEach(input => input.addEventListener('change', () => renamePerson(input.dataset.personId, input.value)));
    $('#merge-panel').classList.toggle('hidden', state.participants.length < 2);
    const options = state.participants.map(person => `<option value="${person.id}">${escapeHtml(person.name)}</option>`).join('');
    $('#merge-keep').innerHTML = options; $('#merge-remove').innerHTML = options; if (state.participants[1]) $('#merge-remove').value = state.participants[1].id;
  }

  async function startScanner() {
    if (!state.settings.created) { toast(t('Crea primer el torneig i les seves taules.'), 'error'); return; }
    if (!navigator.mediaDevices?.getUserMedia) { toast(t('Aquest navegador no permet accedir a la càmera. Prova “Llegeix una imatge”.'), 'error'); return; }
    scannerDialog.showModal ? scannerDialog.showModal() : scannerDialog.setAttribute('open', '');
    $('#scanner-status').textContent = t('Dona permís a la càmera i enquadra el QR.');
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      video.srcObject = mediaStream; await video.play(); $('#scanner-status').textContent = t('Buscant el codi…'); scanFrame = requestAnimationFrame(scanVideoFrame);
    } catch { $('#scanner-status').textContent = t('No s’ha pogut obrir la càmera. Revisa el permís o llegeix una imatge.'); }
  }

  function scanVideoFrame() {
    if (!mediaStream || scannerDialog.open === false) return;
    if (video.readyState >= video.HAVE_CURRENT_DATA && video.videoWidth) {
      const context = canvas.getContext('2d', { willReadFrequently: true }); canvas.width = video.videoWidth; canvas.height = video.videoHeight; context.drawImage(video, 0, 0);
      const image = context.getImageData(0, 0, canvas.width, canvas.height); const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
      if (code?.data) { stopScanner(); handleResultText(code.data); return; }
    }
    scanFrame = requestAnimationFrame(scanVideoFrame);
  }

  function stopScanner() {
    if (scanFrame) cancelAnimationFrame(scanFrame); scanFrame = null;
    mediaStream?.getTracks().forEach(track => track.stop()); mediaStream = null; video.srcObject = null;
    if (scannerDialog.open) scannerDialog.close();
  }

  async function scanImage(file) {
    if (!file) return;
    try {
      let bitmap;
      let release = () => {};
      if ('createImageBitmap' in globalThis) bitmap = await createImageBitmap(file);
      else {
        const objectUrl = URL.createObjectURL(file);
        bitmap = await new Promise((resolve, reject) => { const image = new Image(); image.onload = () => resolve(image); image.onerror = reject; image.src = objectUrl; });
        release = () => URL.revokeObjectURL(objectUrl);
      }
      const context = canvas.getContext('2d', { willReadFrequently: true }); canvas.width = bitmap.width; canvas.height = bitmap.height; context.drawImage(bitmap, 0, 0); bitmap.close?.(); release();
      const image = context.getImageData(0, 0, canvas.width, canvas.height); const code = jsQR(image.data, image.width, image.height, { inversionAttempts: 'attemptBoth' });
      if (!code?.data) throw new Error(t('No s’ha trobat cap QR llegible a la imatge.')); handleResultText(code.data);
    } catch (error) { toast(error.message || t('No s’ha pogut llegir la imatge.'), 'error'); }
    $('#qr-image').value = '';
  }

  function levenshtein(a, b) {
    const matrix = Array.from({ length: b.length + 1 }, (_, row) => [row]); for (let column = 0; column <= a.length; column += 1) matrix[0][column] = column;
    for (let row = 1; row <= b.length; row += 1) for (let column = 1; column <= a.length; column += 1) matrix[row][column] = b[row - 1] === a[column - 1] ? matrix[row - 1][column - 1] : Math.min(matrix[row - 1][column - 1], matrix[row][column - 1], matrix[row - 1][column]) + 1;
    return matrix[b.length][a.length];
  }

  function candidatesFor(name) {
    const normalized = normalizeName(name); return state.participants.map(person => ({ ...person, distance: levenshtein(normalized, normalizeName(person.name)), exact: normalized === normalizeName(person.name) || (person.aliases || []).some(alias => normalizeName(alias) === normalized) })).filter(person => person.exact || person.distance <= Math.max(1, Math.floor(normalized.length * .25))).sort((a, b) => Number(b.exact) - Number(a.exact) || a.distance - b.distance);
  }

  function uniquePersonName(sourceName, reservedNames = []) {
    const base = String(sourceName || '').trim() || t('Participant');
    const used = new Set([...state.participants.map(person => person.name), ...reservedNames].map(normalizeName));
    if (!used.has(normalizeName(base))) return base;
    let suffix = 2;
    while (used.has(normalizeName(`${base} ${suffix}`))) suffix += 1;
    return `${base} ${suffix}`;
  }

  function hasResultInRound(participantId, round) {
    return state.games.some(game => game.tournamentRound === round && game.players.some(player => player.participantId === participantId));
  }

  function handleResultText(text) {
    try {
      if (!state.settings.created) { toast(t('Crea primer el torneig i les seves taules.'), 'error'); return; }
      const result = parseResultText(text);
      if (state.games.some(game => game.sourceId === result.g)) { toast(t('Aquesta partida ja havia estat incorporada.'), 'error'); return; }
      pendingResult = result; openImportReview();
    } catch (error) { toast(error.message || t('QR no reconegut.'), 'error'); }
  }

  function openImportReview() {
    $('#import-title').textContent = pendingResult.t || t('Resultat escanejat');
    $('#import-summary').innerHTML = `<span><b>${pendingResult.a.length}</b> ${t('participants')}</span><span><b>${pendingResult.r || 0}</b> ${t('rondes')}</span><span><b>${new Date(pendingResult.e).toLocaleDateString(LCCI18N.locale())}</b> ${t('finalitzada')}</span>`;
    $('#import-round').innerHTML = Array.from({ length: state.settings.createdRounds }, (_, index) => `<option value="${index + 1}" ${index + 1 === viewedRound ? 'selected' : ''}>${t('Ronda')} ${index + 1}</option>`).join('');
    updateImportTables();
    renderIdentityChoices();
    importDialog.showModal ? importDialog.showModal() : importDialog.setAttribute('open', '');
  }

  function renderIdentityChoices() {
    if (!pendingResult) return;
    const round = Number($('#import-round').value || viewedRound);
    const reservedNames = [];
    const reservedParticipantIds = new Set();
    $('#identity-list').innerHTML = pendingResult.a.map((incoming, index) => {
      const candidates = candidatesFor(incoming.n).map(candidate => ({ ...candidate, unavailable: hasResultInRound(candidate.id, round) || reservedParticipantIds.has(candidate.id) }));
      const availableExact = candidates.filter(candidate => candidate.exact && !candidate.unavailable);
      const needsChoice = availableExact.length > 1;
      const selectedId = availableExact.length === 1 ? availableExact[0].id : '__new__';
      if (selectedId !== '__new__') reservedParticipantIds.add(selectedId);
      const newName = uniquePersonName(incoming.n, reservedNames); reservedNames.push(newName);
      const choice = needsChoice ? `<option value="__choose__" selected disabled>${t('Tria entre persones amb el mateix nom')}</option>` : '';
      return `<article class="identity-row"><div><span class="avatar">${escapeHtml(incoming.n.slice(0, 2).toUpperCase())}</span><span><b>${escapeHtml(incoming.n)}</b><small>${money(incoming.b)} · ${t('posició')} ${incoming.k}</small></span></div><label><span>${t('Identitat al torneig')}</span><select name="identity-${index}" data-index="${index}" data-new-name="${escapeHtml(newName)}">${choice}<option value="__new__" ${!needsChoice && selectedId === '__new__' ? 'selected' : ''}>${t('Persona nova')}: ${escapeHtml(newName)}</option>${candidates.map(candidate => `<option value="${candidate.id}" ${!needsChoice && candidate.id === selectedId ? 'selected' : ''} ${candidate.unavailable ? 'disabled' : ''}>${t(candidate.exact ? 'Coincidència' : 'Potser')}: ${escapeHtml(candidate.name)}${candidate.unavailable ? ` — ${t('Ja té resultat en aquesta ronda')}` : ''}</option>`).join('')}</select></label></article>`;
    }).join('');
  }

  function updateImportTables() {
    const round = Number($('#import-round').value || viewedRound);
    const occupied = new Set(state.games.filter(game => game.tournamentRound === round).map(game => game.tournamentTable));
    const available = Array.from({ length: state.settings.tables }, (_, index) => index + 1).filter(table => !occupied.has(table));
    $('#import-table').innerHTML = available.length ? available.map(table => `<option value="${table}">${t('Taula')} ${table}</option>`).join('') : `<option value="">${t('Cap taula pendent')}</option>`;
  }

  function importPending(event) {
    event.preventDefault(); if (!pendingResult) return;
    if ([...event.currentTarget.querySelectorAll('.identity-row select')].some(select => select.value === '__choose__')) { toast(t('Confirma la identitat de tots els noms abans d’incorporar el resultat.'), 'error'); return; }
    const participantsBeforeImport = JSON.parse(JSON.stringify(state.participants));
    const mapped = pendingResult.a.map((incoming, index) => {
      const select = event.currentTarget.elements[`identity-${index}`]; const selected = select.value; let participantId = selected;
      if (selected === '__new__') { const name = uniquePersonName(select.dataset.newName || incoming.n); const person = { id: uid('person'), name, aliases: normalizeName(name) === normalizeName(incoming.n) ? [] : [incoming.n.trim()] }; state.participants.push(person); participantId = person.id; }
      else { const person = state.participants.find(item => item.id === selected); if (person && normalizeName(person.name) !== normalizeName(incoming.n) && !(person.aliases || []).includes(incoming.n)) person.aliases = [...(person.aliases || []), incoming.n]; }
      return { participantId, sourceName: incoming.n, start: Number(incoming.s), paid: Number(incoming.d ?? incoming.s - incoming.b), balance: Number(incoming.b), rank: Number(incoming.k), ...(incoming.c !== undefined && incoming.c !== null && Number.isFinite(Number(incoming.c)) ? { cashOnHand: Number(incoming.c) } : {}) };
    });
    if (new Set(mapped.map(player => player.participantId)).size !== mapped.length) { state.participants = participantsBeforeImport; toast(t('Dos noms de la mateixa taula no poden correspondre a una sola persona.'), 'error'); return; }
    const tournamentRound = Number($('#import-round').value);
    const tournamentTable = Number($('#import-table').value);
    if (!tournamentTable) { state.participants = participantsBeforeImport; toast(t('Aquesta ronda no té cap taula pendent.'), 'error'); return; }
    const repeated = mapped.filter(player => state.games.some(game => game.tournamentRound === tournamentRound && game.players.some(existing => existing.participantId === player.participantId)));
    if (repeated.length) { const names = repeated.map(player => state.participants.find(person => person.id === player.participantId)?.name || player.sourceName); state.participants = participantsBeforeImport; toast(t('{players} ja té resultat a la ronda {round}.', { players: names.join(', '), round: tournamentRound }), 'error'); return; }
    state.games.push({ id: uid('result'), sourceId: pendingResult.g, table: pendingResult.t || t('Taula sense número'), endedAt: pendingResult.e || new Date().toISOString(), rounds: Number(pendingResult.r) || 0, tournamentRound, tournamentTable, players: mapped });
    updateDirectory(pendingResult.a.map(player => player.n)); persist(); importDialog.close(); pendingResult = null; render(); toast(t('Resultat incorporat al torneig.'));
  }

  function removeGame(id) {
    if (!confirm(t('Vols eliminar aquest resultat del torneig?'))) return;
    state.games = state.games.filter(game => game.id !== id);
    const used = new Set(state.games.flatMap(game => game.players.map(player => player.participantId))); state.participants = state.participants.filter(person => used.has(person.id));
    persist(); render(); toast(t('Resultat eliminat.'));
  }

  function renamePerson(id, newName) {
    const name = newName.trim(); const person = state.participants.find(item => item.id === id);
    if (!name || !person) { render(); return; }
    if (state.participants.some(item => item.id !== id && normalizeName(item.name) === normalizeName(name))) { toast(t('Aquest nom ja correspon a un altre participant. Pots fusionar-los.'), 'error'); render(); return; }
    if (normalizeName(person.name) !== normalizeName(name)) person.aliases = [...new Set([...(person.aliases || []), person.name])];
    person.name = name; updateDirectory([name]); persist(); render(); toast(t('Nom actualitzat.'));
  }

  function mergePeople() {
    const keepId = $('#merge-keep').value; const removeId = $('#merge-remove').value;
    if (keepId === removeId) { toast(t('Selecciona dues persones diferents.'), 'error'); return; }
    const keep = state.participants.find(person => person.id === keepId); const remove = state.participants.find(person => person.id === removeId); if (!keep || !remove) return;
    const conflictingRound = Array.from({ length: state.settings.createdRounds }, (_, index) => index + 1).find(round => state.games.some(game => game.tournamentRound === round && game.players.some(player => player.participantId === keepId)) && state.games.some(game => game.tournamentRound === round && game.players.some(player => player.participantId === removeId)));
    if (conflictingRound) { toast(t('No es poden fusionar: tots dos tenen resultat a la ronda {round}.', { round: conflictingRound }), 'error'); return; }
    if (!confirm(t('Vols fusionar “{remove}” dins de “{keep}”?', { remove: remove.name, keep: keep.name }))) return;
    keep.aliases = [...new Set([...(keep.aliases || []), remove.name, ...(remove.aliases || [])])];
    state.games.forEach(game => game.players.forEach(player => { if (player.participantId === removeId) player.participantId = keepId; })); state.participants = state.participants.filter(person => person.id !== removeId);
    persist(); render(); toast(t('Participants fusionats.'));
  }

  function exportState() {
    const blob = new Blob([JSON.stringify({ product: 'LaCuentaCounter', exportedAt: new Date().toISOString(), ...state }, null, 2)], { type: 'application/json' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `la-cuenta-torneig-${new Date().toISOString().slice(0, 10)}.json`; link.click(); URL.revokeObjectURL(link.href);
  }

  async function importState(file) {
    try { const data = JSON.parse(await file.text()); if (!Array.isArray(data.participants) || !Array.isArray(data.games)) throw new Error(); if (state.games.length && !confirm(t('La còpia substituirà el torneig actual. Vols continuar?'))) return; state = { version: 1, settings: { ...DEFAULT_SETTINGS, ...(data.settings || {}) }, participants: data.participants, games: data.games }; state.games.forEach((game, index) => { game.tournamentRound ||= 1; game.tournamentTable ||= index + 1; }); viewedRound = Math.max(1, state.settings.createdRounds || 1); persist(); render(); toast(t('Còpia restaurada.')); }
    catch { toast(t('El fitxer no és una còpia vàlida del torneig.'), 'error'); }
    $('#import-tournament').value = '';
  }

  $('#open-scanner').addEventListener('click', startScanner);
  $('#close-scanner').addEventListener('click', stopScanner);
  scannerDialog.addEventListener('close', stopScanner);
  $('#qr-image').addEventListener('change', event => scanImage(event.target.files[0]));
  $('#cancel-import').addEventListener('click', () => { importDialog.close(); pendingResult = null; });
  $('#identity-form').addEventListener('submit', importPending);
  $('#merge-people').addEventListener('click', mergePeople);
  $('#export-tournament').addEventListener('click', exportState);
  $('#import-tournament').addEventListener('change', event => importState(event.target.files[0]));
  async function updateSettings() {
    const highestRound = Math.max(1, state.settings.createdRounds || 1, ...state.games.map(game => game.tournamentRound || 1));
    const highestTable = Math.max(1, ...state.games.map(game => game.tournamentTable || 1));
    const rounds = Math.max(highestRound, Math.min(20, Math.floor(Number($('#tournament-rounds').value) || 1)));
    const tables = Math.max(highestTable, Math.min(50, Math.floor(Number($('#tournament-tables').value) || 1)));
    const drops = Math.max(0, Math.min(rounds - 1, Math.floor(Number($('#tournament-drops').value) || 0)));
    const wasCreated = state.settings.created;
    state.settings = { name: $('#tournament-name').value.trim() || t('Torneig de La Cuenta'), rounds, tables, drops, created: true, createdRounds: wasCreated ? Math.max(1, state.settings.createdRounds) : 1 };
    storageIsPersistent = await ensurePersistentStorage(); persist(); render(); toast(t(wasCreated ? 'Configuració actualitzada.' : 'Torneig creat. Escaneja els resultats de la primera ronda.'));
  }
  $('#create-tournament').addEventListener('click', updateSettings);
  $('#next-tournament-round').addEventListener('click', () => { if (state.settings.createdRounds >= state.settings.rounds) return; const complete = state.games.filter(game => game.tournamentRound === state.settings.createdRounds).length >= state.settings.tables; if (!complete) { toast(t('Completa totes les taules abans de crear la ronda següent.'), 'error'); return; } state.settings.createdRounds += 1; viewedRound = state.settings.createdRounds; persist(); render(); toast(t('Ronda nova creada.')); });
  $('#import-round').addEventListener('change', () => { updateImportTables(); renderIdentityChoices(); });
  $('#clear-tournament').addEventListener('click', () => { if (confirm(t('Vols esborrar totes les partides i participants d’aquest torneig?'))) { state = { version: 1, settings: DEFAULT_SETTINGS, participants: [], games: [] }; persist(); render(); toast(t('Torneig esborrat.')); } });

  window.addEventListener('lcc:languagechange', render);
  if (state.settings.created) ensurePersistentStorage().then(result => { storageIsPersistent = result; renderRoundControl(); });
  render();
  const importHash = new URLSearchParams(location.hash.replace(/^#/, '')).get('import');
  if (importHash) { try { handleResultText(location.href); history.replaceState(null, '', location.pathname + location.search); } catch {} }
})();
