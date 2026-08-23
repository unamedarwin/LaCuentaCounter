(() => {
  'use strict';
  const { STORAGE, STARTING_SAVINGS, uid, load, save, escapeHtml, normalizeName, money, compactNumber, createResultUrl, renderQr, toast, updateDirectory, t } = LCC;
  const $ = selector => document.querySelector(selector);
  const setupView = $('#setup-view');
  const gameView = $('#game-view');
  const inputs = $('#player-inputs');
  const addButton = $('#add-player');
  const startButton = $('#start-game');
  const resumeButton = $('#resume-game');
  const finishDialog = $('#finish-dialog');
  let game = null;
  let resultUrl = '';

  function addPlayer(name = '') {
    if (inputs.children.length >= 8) return;
    const row = document.createElement('div');
    row.className = 'player-row';
    row.innerHTML = `<label>${t('Participant')} ${inputs.children.length + 1}</label><input type="text" maxlength="32" list="known-players" autocomplete="off" value="${escapeHtml(name)}" placeholder="${t('Nom')}"><button class="remove-player" type="button" aria-label="${t('Elimina aquest participant')}">×</button>`;
    row.querySelector('.remove-player').addEventListener('click', () => { if (inputs.children.length > 3) { row.remove(); refreshSetup(); } });
    inputs.append(row);
    refreshSetup();
  }

  function refreshSetup() {
    [...inputs.children].forEach((row, index) => row.querySelector('label').textContent = `${t('Participant')} ${index + 1}`);
    const count = inputs.children.length;
    $('#player-count').textContent = count;
    $('#starting-limit').textContent = money(STARTING_SAVINGS[count]);
    addButton.disabled = count >= 8;
    [...inputs.querySelectorAll('.remove-player')].forEach(button => button.disabled = count <= 3);
  }

  function startGame() {
    const names = [...inputs.querySelectorAll('input')].map(input => input.value.trim());
    if (names.some(name => !name)) { inputs.querySelector('input:placeholder-shown')?.focus(); toast(t('Escriu el nom de tots els participants.'), 'error'); return; }
    if (new Set(names.map(normalizeName)).size !== names.length) { toast(t('Els noms han de ser diferents dins de la mateixa taula.'), 'error'); return; }
    if (load(STORAGE.game, null) && !confirm(t('La partida en curs se substituirà. Vols continuar?'))) return;
    const limit = STARTING_SAVINGS[names.length];
    game = { version: 1, id: uid('game'), table: $('#table-name').value.trim() || t('Taula sense número'), createdAt: new Date().toISOString(), limit, round: 1, players: names.map((name, index) => ({ id: `p${index + 1}`, name, paid: 0, handBonus: 0 })), rounds: [], cashOnHand: {} };
    updateDirectory(names); persistGame(); showGame();
  }

  function showGame() {
    setupView.classList.add('hidden'); gameView.classList.remove('hidden');
    $('#game-table-name').textContent = game.table;
    renderGame();
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  function showSetup() {
    gameView.classList.add('hidden'); setupView.classList.remove('hidden');
    resumeButton.classList.toggle('hidden', !load(STORAGE.game, null));
    scrollTo({ top: 0, behavior: 'smooth' });
  }

  function persistGame() { save(STORAGE.game, game); }

  function renderGame() {
    $('#round-number').textContent = game.round;
    $('#undo-round').disabled = !game.rounds.length;
    $('#scoreboard').innerHTML = game.players.map(player => {
      const remaining = compactNumber(game.limit - player.paid);
      const used = Math.min(100, (player.paid / game.limit) * 100);
      const status = remaining <= 0 ? 'broke' : used >= 75 ? 'danger' : '';
      return `<article class="score-card ${status}"><div class="score-top"><span>${escapeHtml(player.name)}</span><em>${t('Mà')} ${5 + player.handBonus}/10</em></div><strong>${money(remaining)}</strong><small>${t('de')} ${money(game.limit)}</small><div class="meter"><i style="width:${used}%"></i></div></article>`;
    }).join('');
    const options = game.players.map(player => `<option value="${player.id}">${escapeHtml(player.name)}</option>`).join('');
    const currentRequester = $('#requester').value;
    $('#requester').innerHTML = options; if (currentRequester) $('#requester').value = currentRequester;
    renderDependentOptions(); renderHistory(); calculateAllocation();
  }

  function renderDependentOptions() {
    const requesterId = $('#requester').value || game.players[0].id;
    const partner = $('#half-partner');
    const oldPartner = partner.value;
    partner.innerHTML = game.players.filter(player => player.id !== requesterId).map(player => `<option value="${player.id}">${escapeHtml(player.name)}</option>`).join('');
    if ([...partner.options].some(option => option.value === oldPartner)) partner.value = oldPartner;
    $('#share-players').innerHTML = game.players.map(player => `<label><input type="checkbox" value="${player.id}" ${player.id === requesterId || player.paid < game.limit ? 'checked' : ''}><span>${escapeHtml(player.name)}</span></label>`).join('');
    $('#manual-players').innerHTML = game.players.map(player => `<label class="field"><span>${escapeHtml(player.name)}</span><div class="money-input"><input data-player-id="${player.id}" type="number" min="0" step="0.01" inputmode="decimal" value="0"><b>€</b></div></label>`).join('');
    $('#share-players').addEventListener('change', calculateAllocation, { once: true });
    $('#manual-players').addEventListener('input', calculateAllocation, { once: true });
  }

  function selectedMethod() { return $('input[name="payment-method"]:checked').value; }

  function distribute(total, ids) {
    if (!ids.length) return {};
    const cents = Math.round(total * 100); const base = Math.floor(cents / ids.length); let remainder = cents - base * ids.length;
    return Object.fromEntries(ids.map(id => [id, (base + (remainder-- > 0 ? 1 : 0)) / 100]));
  }

  function getAllocation() {
    const bill = Math.max(0, Number($('#bill-total').value) || 0);
    const tip = $('#tip-enabled').checked ? Math.max(0, Number($('#tip-value').value) || 0) : 0;
    const total = compactNumber(bill + tip); const requesterId = $('#requester').value; const method = selectedMethod(); let charges = {};
    if (method === 'single') charges = { [requesterId]: total };
    if (method === 'halves') charges = distribute(total, [requesterId, $('#half-partner').value].filter(Boolean));
    if (method === 'shares') charges = distribute(total, [...document.querySelectorAll('#share-players input:checked')].map(input => input.value));
    if (method === 'manual') { charges = Object.fromEntries([...document.querySelectorAll('#manual-players input')].map(input => [input.dataset.playerId, Math.max(0, compactNumber(Number(input.value) || 0))])); }
    const allocated = compactNumber(Object.values(charges).reduce((sum, value) => sum + value, 0));
    return { bill, tip, total, requesterId, method, charges, allocated };
  }

  function calculateAllocation() {
    if (!game) return;
    const allocation = getAllocation();
    $('#final-total').textContent = money(allocation.total);
    const preview = $('#allocation-preview');
    const entries = game.players.filter(player => allocation.charges[player.id] > 0);
    preview.innerHTML = entries.length ? entries.map(player => `<span><b>${escapeHtml(player.name)}</b>${money(allocation.charges[player.id])}</span>`).join('') : `<span>${t('Selecciona com es reparteix el compte.')}</span>`;
    const warning = $('#round-warning'); const problems = [];
    if (allocation.method === 'shares' && !entries.length) problems.push(t('A patxes necessita almenys una persona seleccionada.'));
    if (allocation.method === 'manual' && Math.abs(allocation.allocated - allocation.total) > 0.009) problems.push(t('El repartiment manual suma {allocated} i ha de sumar {total}.', { allocated: money(allocation.allocated), total: money(allocation.total) }));
    const exhausted = entries.filter(player => game.limit - player.paid - allocation.charges[player.id] <= 0);
    if (exhausted.length) problems.push(t('{players} arribarà o superarà el topall i la partida haurà acabat.', { players: exhausted.map(player => player.name).join(', ') }));
    const requester = game.players.find(player => player.id === allocation.requesterId);
    if ($('#hand-increase').checked && requester?.handBonus >= 5) problems.push(t('{player} ja té el màxim de 10 cartes a la mà.', { player: requester.name }));
    warning.innerHTML = problems.map(escapeHtml).join('<br>'); warning.classList.toggle('hidden', !problems.length);
    return { allocation, invalid: !allocation.total || (allocation.method === 'shares' && !entries.length) || (allocation.method === 'manual' && Math.abs(allocation.allocated - allocation.total) > 0.009) };
  }

  function methodName(method) { return t(({ single: 'Una persona', halves: 'A mitges', shares: 'A patxes', manual: 'Manual' })[method]); }

  function recordRound(event) {
    event.preventDefault(); const calculation = calculateAllocation(); if (calculation.invalid) { toast(t('Revisa el repartiment abans de registrar la ronda.'), 'error'); return; }
    const { allocation } = calculation;
    game.players.forEach(player => { player.paid = compactNumber(player.paid + (allocation.charges[player.id] || 0)); });
    const requester = game.players.find(player => player.id === allocation.requesterId);
    const handIncrease = $('#hand-increase').checked && requester.handBonus < 5;
    if (handIncrease) requester.handBonus += 1;
    game.rounds.push({ number: game.round, createdAt: new Date().toISOString(), ...allocation, handIncrease });
    game.round += 1; persistGame();
    $('#round-form').reset(); $('#tip-value').value = 20; updateMethodUi(); renderGame();
    toast(t('Ronda registrada.'));
    if (game.players.some(player => player.paid >= game.limit)) finishGame(true);
  }

  function renderHistory() {
    const container = $('#round-history');
    if (!game.rounds.length) { container.className = 'empty-state'; container.textContent = t('Encara no s’ha registrat cap ronda.'); return; }
    container.className = 'round-list';
    container.innerHTML = [...game.rounds].reverse().map(round => {
      const charges = game.players.filter(player => round.charges[player.id] > 0).map(player => `${escapeHtml(player.name)} · ${money(round.charges[player.id])}`).join('</span><span>');
      return `<article><div><em>R${round.number}</em><span><b>${methodName(round.method)}</b><small>${round.tip ? `${t('Compte')} ${money(round.bill)} + ${t('propina')} ${money(round.tip)}` : money(round.total)}</small></span></div><div class="round-charges"><span>${charges}</span></div></article>`;
    }).join('');
  }

  function undoRound() {
    const round = game.rounds.pop(); if (!round) return;
    game.players.forEach(player => { player.paid = compactNumber(Math.max(0, player.paid - (round.charges[player.id] || 0))); });
    if (round.handIncrease) game.players.find(player => player.id === round.requesterId).handBonus = Math.max(0, game.players.find(player => player.id === round.requesterId).handBonus - 1);
    game.round = Math.max(1, game.round - 1); persistGame(); renderGame(); toast(t('S’ha desfet l’última ronda.'));
  }

  function resultPayload() {
    game.cashOnHand ||= {};
    const groups = new Map();
    game.players.forEach(player => { const balance = compactNumber(game.limit - player.paid); if (!groups.has(balance)) groups.set(balance, []); groups.get(balance).push({ player, balance, cash: game.cashOnHand[player.id] ?? null }); });
    const ordered = [...groups.entries()].sort((a, b) => b[0] - a[0]); const ranked = []; let offset = 0;
    ordered.forEach(([, members]) => {
      const completeCash = members.length > 1 && members.every(member => member.cash !== null && Number.isFinite(Number(member.cash)));
      if (completeCash) members.sort((a, b) => Number(b.cash) - Number(a.cash));
      let previousCash = null; let localRank = 0;
      members.forEach((member, index) => { if (!completeCash || index === 0 || Number(member.cash) !== previousCash) localRank = completeCash ? offset + index + 1 : offset + 1; previousCash = Number(member.cash); ranked.push({ ...member, rank: localRank }); });
      offset += members.length;
    });
    const ranks = new Map(ranked.map(item => [item.player.id, item.rank]));
    return { p: 'LCC1', v: 1, g: game.id, t: game.table, e: new Date().toISOString(), r: game.rounds.length, a: game.players.map(player => { const cash = game.cashOnHand[player.id]; return { n: player.name, s: game.limit, d: compactNumber(player.paid), b: compactNumber(game.limit - player.paid), k: ranks.get(player.id), ...(Number.isFinite(Number(cash)) ? { c: Number(cash) } : {}) }; }) };
  }

  function renderFinish() {
    const payload = resultPayload(); resultUrl = createResultUrl(payload);
    $('#final-ranking').innerHTML = [...payload.a].sort((a, b) => a.k - b.k || b.b - a.b).map(player => `<article class="rank-${player.k === 1 ? 'winner' : 'row'}"><em>${player.k}</em><span><b>${escapeHtml(player.n)}</b><small>${t('Ha pagat')} ${money(player.d)}${Number.isFinite(player.c) ? ` · ${t('porta')} ${money(player.c)}` : ''}</small></span><strong>${money(player.b)}</strong></article>`).join('');
    const balances = new Map(); game.players.forEach(player => { const balance = compactNumber(game.limit - player.paid); if (!balances.has(balance)) balances.set(balance, []); balances.get(balance).push(player); });
    const tied = [...balances.values()].filter(group => group.length > 1).flat();
    $('#tie-break-panel').classList.toggle('hidden', !tied.length);
    $('#tie-break-inputs').innerHTML = tied.map(player => `<label class="field"><span>${escapeHtml(player.name)}</span><div class="money-input"><input data-cash-player="${player.id}" type="number" min="0" step="0.01" inputmode="decimal" value="${game.cashOnHand?.[player.id] ?? ''}" placeholder="0"><b>€</b></div></label>`).join('');
    $('#share-result').dataset.resultUrl = resultUrl;
    renderQr($('#result-qr'), resultUrl);
  }

  function finishGame(automatic = false) {
    if (!game.rounds.length) { toast(t('Registra almenys una ronda abans de finalitzar.'), 'error'); return; }
    renderFinish();
    if (automatic) toast(t('Algú ha arribat o superat el topall. La partida ha acabat.'));
    finishDialog.showModal ? finishDialog.showModal() : finishDialog.setAttribute('open', '');
  }

  async function shareResult() {
    try {
      if (navigator.share) await navigator.share({ title: `${t('Resultat')} ${game.table} · La Cuenta`, text: t('Resultat final de la partida'), url: resultUrl });
      else { await navigator.clipboard.writeText(resultUrl); toast(t('Enllaç copiat.')); }
    } catch (error) { if (error.name !== 'AbortError') toast(t('No s’ha pogut compartir. Mantén premut el QR per mostrar-lo.'), 'error'); }
  }

  function newGame() {
    finishDialog.close(); localStorage.removeItem(STORAGE.game); game = null;
    inputs.replaceChildren(); const directory = load(STORAGE.directory, []); for (let index = 0; index < 3; index += 1) addPlayer(directory[index] || '');
    showSetup();
  }

  function updateMethodUi() {
    const method = selectedMethod();
    $('#halves-options').classList.toggle('hidden', method !== 'halves');
    $('#shares-options').classList.toggle('hidden', method !== 'shares');
    $('#manual-options').classList.toggle('hidden', method !== 'manual');
    $('#tip-value-wrap').classList.toggle('hidden', !$('#tip-enabled').checked);
    calculateAllocation();
  }

  addButton.addEventListener('click', () => addPlayer());
  startButton.addEventListener('click', startGame);
  resumeButton.addEventListener('click', () => { game = load(STORAGE.game, null); if (game) showGame(); });
  $('#round-form').addEventListener('submit', recordRound);
  $('#round-form').addEventListener('input', event => { if (event.target.name === 'payment-method' || event.target.id === 'tip-enabled') updateMethodUi(); else calculateAllocation(); });
  $('#round-form').addEventListener('change', event => { if (event.target.id === 'requester') renderDependentOptions(); updateMethodUi(); });
  $('#undo-round').addEventListener('click', undoRound);
  $('#finish-game').addEventListener('click', () => finishGame(false));
  $('#share-result').addEventListener('click', shareResult);
  $('#edit-finished').addEventListener('click', () => finishDialog.close());
  $('#new-game').addEventListener('click', newGame);
  $('#apply-tie-break').addEventListener('click', () => { game.cashOnHand ||= {}; document.querySelectorAll('[data-cash-player]').forEach(input => { if (input.value === '') delete game.cashOnHand[input.dataset.cashPlayer]; else game.cashOnHand[input.dataset.cashPlayer] = Math.max(0, Number(input.value)); }); persistGame(); renderFinish(); toast(t('Desempat aplicat.')); });
  window.addEventListener('lcc:languagechange', () => { refreshSetup(); if (game) { renderGame(); if (finishDialog.open) renderFinish(); } });

  const directory = load(STORAGE.directory, []);
  $('#known-players').innerHTML = directory.map(name => `<option value="${escapeHtml(name)}"></option>`).join('');
  for (let index = 0; index < 3; index += 1) addPlayer(directory[index] || '');
  resumeButton.classList.toggle('hidden', !load(STORAGE.game, null));
})();
