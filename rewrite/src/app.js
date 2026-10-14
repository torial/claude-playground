// Rewrite: the interface. Depends on core.js (the global `Rewrite`).
(function () {
  'use strict';
  const Core = Rewrite;
  const LEVELS = Core.levels;
  const SANDBOX = {
    id: 'sandbox',
    name: 'Sandbox',
    alphabet: '',
    sandbox: true,
    brief: 'No task and no tests. Write any rules, feed in any string, and watch what the machine does with them.',
    lesson: 'Good things to try: a rule that grows the string until it hits the 300-character wall, two rules that undo each other, a stop rule with an empty pattern.',
    hint: '',
    visible: [],
  };
  const MAX_RULES = 16;
  const DELAYS = [700, 360, 160, 60, 18];
  const KEY = 'rewrite.v1';

  const $ = (sel, root = document) => root.querySelector(sel);
  function h(tag, props, ...kids) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (v === true) node.setAttribute(k, '');
      else if (v !== false && v != null) node.setAttribute(k, v);
    }
    for (const kid of kids.flat()) if (kid != null) node.append(kid);
    return node;
  }

  // ---- saved progress: a convenience, never required ----
  let store = { level: 'flip', rules: {}, solved: {}, input: {} };
  function loadStore() {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) {
        const o = JSON.parse(raw);
        store = { level: 'flip', rules: {}, solved: {}, input: {}, ...o };
      }
    } catch (e) { /* storage unavailable: carry on without it */ }
  }
  function saveStore() {
    try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) { /* ignore */ }
  }

  // ---- state ----
  const S = {
    level: LEVELS[0],
    rules: [],
    input: '',
    run: null,
    rowOf: [], // active rule index -> row index
    k: 0,
    timer: null,
    verdict: null,
  };

  const rowBlank = (r) => Core.clean(r.from) === '' && Core.clean(r.to) === '' && !r.halt;
  const blankRow = () => ({ from: '', to: '', halt: false });
  const starterRules = (lv) => (lv.id === 'flip' ? [{ from: 'a', to: '', halt: false }] : [blankRow()]);

  function allLevels() { return [...LEVELS, SANDBOX]; }
  function levelIndex(lv) { return allLevels().indexOf(lv); }

  function setLevel(id, fresh) {
    stopTimer();
    const lv = allLevels().find((l) => l.id === id) || LEVELS[0];
    S.level = lv;
    store.level = lv.id;
    S.rules = (!fresh && store.rules[lv.id]) || starterRules(lv);
    S.rules = S.rules.map((r) => ({ from: r.from || '', to: r.to || '', halt: !!r.halt }));
    if (!S.rules.length) S.rules = [blankRow()];
    S.input = store.input[lv.id] != null ? store.input[lv.id] : lv.visible[0] != null ? lv.visible[0] : 'ab';
    if (lv.sandbox && store.input[lv.id] == null) S.input = 'aab';
    S.verdict = null;
    saveStore();
    recompute();
    renderAll();
  }

  function persistRules() {
    store.rules[S.level.id] = S.rules;
    store.input[S.level.id] = S.input;
    saveStore();
  }

  function recompute() {
    const rows = [];
    S.rules.forEach((r, i) => { if (!rowBlank(r)) rows.push(i); });
    S.rowOf = rows;
    const prepared = Core.activeRules(S.rules);
    S.run = Core.run(prepared, S.input, { prepared: true, trace: true });
    S.k = 0;
  }

  function current() {
    const t = S.run.trace;
    return S.k === 0 ? Core.clean(S.input) : t[S.k - 1].after;
  }
  const total = () => S.run.trace.length;
  const atEnd = () => S.k >= total();

  // ---- rendering: levels + brief ----
  function renderLevels() {
    const nav = $('#levels');
    nav.replaceChildren();
    allLevels().forEach((lv, i) => {
      const solved = store.solved[lv.id];
      nav.append(
        h('button', {
          type: 'button',
          class: 'level-chip',
          'aria-current': String(lv === S.level),
          onclick: () => setLevel(lv.id),
        },
        h('span', { class: 'n', text: lv.sandbox ? '∞' : String(i + 1) }),
        h('span', { class: 'nm', text: lv.name }),
        solved ? h('span', { class: 'done', text: '✓ ' + solved }) : null),
      );
    });
  }

  function renderBrief() {
    const lv = S.level;
    const box = $('#brief');
    box.replaceChildren();
    const solved = store.solved[lv.id];
    const par = lv.solution ? lv.solution.length : null;
    box.append(
      h('div', { class: 'level-no', text: lv.sandbox ? 'Free play' : `Level ${levelIndex(lv) + 1} of ${LEVELS.length}` }),
      h('h2', {}, lv.name, solved ? h('span', { class: 'solved-tag', text: `Solved in ${solved}` }) : null),
      h('p', { class: 'task', text: lv.brief }),
      h('p', { class: 'lesson', text: lv.lesson }),
    );
    if (!lv.sandbox) {
      box.append(h('div', { class: 'meta' },
        h('span', {}, 'Symbols in the input: ', h('b', { class: 'mono', text: lv.alphabet.split('').join(' ') })),
        h('span', {}, 'Par: ', h('b', { text: `${par} rule${par === 1 ? '' : 's'}` })),
      ));
      box.append(h('details', {}, h('summary', { text: 'Hint' }), h('p', { text: lv.hint })));
    }
    box.append(
      h('details', {},
        h('summary', { text: 'How the machine works' }),
        h('ul', { class: 'howto' },
          h('li', { text: 'It looks down the rule list for the first rule whose pattern appears anywhere in the string.' }),
          h('li', { text: 'It rewrites the leftmost place that pattern appears, then starts again from the top of the list.' }),
          h('li', { text: 'An empty pattern matches at the very start of the string, every time.' }),
          h('li', { text: 'It stops when no rule matches, or right after a rule marked stop fires.' }),
          h('li', { text: 'It also stops, and the run fails, after 5000 steps or if the string passes 300 characters.' }),
          h('li', { text: 'Spaces are ignored. Any symbol you add beyond the level’s own is a marker and shows in a different colour.' }),
        ),
      ),
    );
  }

  // ---- rules ----
  function renderRules() {
    const list = $('#rule-list');
    list.replaceChildren();
    S.rules.forEach((r, i) => {
      const blank = rowBlank(r);
      const row = h('div', { class: 'rule' + (blank ? ' is-blank' : ''), 'data-row': String(i) });
      const from = h('input', {
        class: 'mono-input', type: 'text', value: r.from, maxlength: '14', autocomplete: 'off', spellcheck: 'false',
        placeholder: 'start of string', 'aria-label': `Pattern for rule ${i + 1}`,
      });
      const to = h('input', {
        class: 'mono-input', type: 'text', value: r.to, maxlength: '14', autocomplete: 'off', spellcheck: 'false',
        placeholder: 'nothing', 'aria-label': `Replacement for rule ${i + 1}`,
      });
      from.addEventListener('input', () => { r.from = from.value; onRulesChanged(i); });
      to.addEventListener('input', () => { r.to = to.value; onRulesChanged(i); });
      const stop = h('input', { type: 'checkbox', 'aria-label': `Rule ${i + 1} stops the run` });
      stop.checked = !!r.halt;
      stop.addEventListener('change', () => { r.halt = stop.checked; onRulesChanged(i); });
      const up = h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Move rule ${i + 1} up`, text: '↑', disabled: i === 0, onclick: () => moveRule(i, -1) });
      const down = h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Move rule ${i + 1} down`, text: '↓', disabled: i === S.rules.length - 1, onclick: () => moveRule(i, 1) });
      const del = h('button', { type: 'button', class: 'icon-btn', 'aria-label': `Delete rule ${i + 1}`, text: 'Delete', onclick: () => deleteRule(i) });
      row.append(
        h('span', { class: 'pri', text: String(i + 1) }),
        from,
        h('span', { class: 'arrow', text: '→' }),
        to,
        h('div', { class: 'row-tools' },
          h('label', { class: 'stop-toggle' }, stop, 'stop after this rule'),
          h('span', { class: 'blank-note', 'data-blank': String(i), text: blank ? 'Blank, so the machine skips it' : '' }),
          h('span', { class: 'spacer' }),
          up, down, del),
      );
      list.append(row);
    });
    $('#add-rule').disabled = S.rules.length >= MAX_RULES;
    markNextRule();
  }

  function onRulesChanged(i) {
    stopTimer();
    const note = $(`[data-blank="${i}"]`);
    const rowEl = $(`[data-row="${i}"]`);
    const blank = rowBlank(S.rules[i]);
    if (note) note.textContent = blank ? 'Blank, so the machine skips it' : '';
    if (rowEl) rowEl.classList.toggle('is-blank', blank);
    S.verdict = null;
    persistRules();
    recompute();
    renderMachine();
    renderTests();
    renderVerdict();
  }
  function moveRule(i, d) {
    const j = i + d;
    if (j < 0 || j >= S.rules.length) return;
    [S.rules[i], S.rules[j]] = [S.rules[j], S.rules[i]];
    afterStructuralChange();
  }
  function deleteRule(i) {
    S.rules.splice(i, 1);
    if (!S.rules.length) S.rules.push(blankRow());
    afterStructuralChange();
  }
  function afterStructuralChange() {
    stopTimer();
    S.verdict = null;
    persistRules();
    recompute();
    renderRules();
    renderMachine();
    renderTests();
    renderVerdict();
  }
  function markNextRule() {
    document.querySelectorAll('.rule.next').forEach((e) => e.classList.remove('next'));
    if (!S.run || atEnd()) return;
    const row = S.rowOf[S.run.trace[S.k].rule];
    const el = $(`[data-row="${row}"]`);
    if (el) el.classList.add('next');
  }

  // ---- machine ----
  function isMarker(ch) { return !S.level.sandbox && !S.level.alphabet.includes(ch); }

  function renderTape() {
    const tape = $('#tape');
    tape.replaceChildren();
    const s = current();
    const t = S.run.trace;
    const next = !atEnd() ? t[S.k] : null;
    const prev = S.k > 0 ? t[S.k - 1] : null;
    if (s === '' && !(next && next.len === 0)) {
      tape.append(h('span', { class: 'empty-tape', text: 'empty string' }));
      return;
    }
    const chars = [...s];
    chars.forEach((ch, i) => {
      if (next && next.len === 0 && next.pos === i) tape.append(h('span', { class: 'caret', title: 'The next rule writes here', 'aria-hidden': 'true' }));
      let cls = 'tile';
      if (isMarker(ch)) cls += ' marker';
      if (next && next.len > 0 && i >= next.pos && i < next.pos + next.len) cls += ' match';
      if (prev && i >= prev.pos && i < prev.pos + (prev.after.length - prev.before.length + prev.len)) cls += ' fresh';
      tape.append(h('span', { class: cls, text: ch }));
    });
    if (next && next.len === 0 && next.pos >= chars.length) tape.append(h('span', { class: 'caret', 'aria-hidden': 'true' }));
  }

  function renderExpect() {
    const box = $('#expect');
    box.replaceChildren();
    const lv = S.level;
    if (lv.sandbox) return;
    const w = Core.clean(S.input);
    if (![...w].every((c) => lv.alphabet.includes(c))) return;
    let want;
    try { want = lv.spec(w); } catch (e) { return; }
    box.append('Target for this input: ', h('code', { text: want === '' ? 'empty string' : want }));
    if (atEnd()) {
      const got = current();
      const fine = got === want && (S.run.status === 'done' || S.run.status === 'halted');
      box.append('  ', h('span', { class: fine ? 'match-yes' : 'match-no', text: fine ? 'Match' : 'Not a match' }));
    }
  }

  function statusText() {
    const n = total();
    if (!atEnd()) {
      const t = S.run.trace[S.k];
      const rowNo = S.rowOf[t.rule] + 1;
      const where = t.len === 0 ? `at the start` : `at position ${t.pos + 1}`;
      return [h('span', { class: 'k', text: `Step ${S.k} of ${n}. ` }), `Next: rule ${rowNo} ${where}.`];
    }
    const lead = h('span', { class: 'k', text: `Step ${S.k} of ${n}. ` });
    switch (S.run.status) {
      case 'halted': return [lead, 'Stopped: a stop rule fired.'];
      case 'limit': return [lead, `Gave up after ${Core.MAX_STEPS} steps. The rules never settle on this input.`];
      case 'overflow': return [lead, `Stopped: the string grew past ${Core.MAX_LEN} characters.`];
      default: return [lead, n === 0 ? 'No rule matches this string, so nothing happens.' : 'Stopped: no rule matches any more.'];
    }
  }

  function renderStatus() {
    const st = $('#status');
    st.replaceChildren(...statusText());
  }

  function renderLog() {
    const ol = $('#log');
    ol.replaceChildren();
    const t = S.run.trace;
    const mk = (i, label, s, rule, cls) => h('li', { class: cls || '', onclick: () => { stopTimer(); S.k = i; renderMachine(); } },
      h('span', { class: 'i', text: String(i) }),
      h('span', { class: 's', text: s === '' ? '(empty)' : s }),
      h('span', { class: 'rl', text: rule }));
    ol.append(mk(0, '', Core.clean(S.input), 'start', S.k === 0 ? 'now' : ''));
    const MAXROWS = 300;
    const show = (idx) => {
      const x = t[idx];
      ol.append(mk(idx + 1, '', x.after, `rule ${S.rowOf[x.rule] + 1}`, S.k === idx + 1 ? 'now' : ''));
    };
    if (t.length <= MAXROWS) t.forEach((_, idx) => show(idx));
    else {
      for (let idx = 0; idx < MAXROWS / 2; idx++) show(idx);
      ol.append(h('li', {}, h('span', { class: 'rl', text: `… ${t.length - MAXROWS} steps not listed …` })));
      for (let idx = t.length - MAXROWS / 2; idx < t.length; idx++) show(idx);
    }
    const now = ol.querySelector('.now');
    if (now && $('#log-wrap').open) now.scrollIntoView({ block: 'nearest' });
  }

  function renderControls() {
    const running = S.timer != null;
    $('#btn-run').textContent = running ? 'Pause' : 'Run';
    $('#btn-step').disabled = atEnd();
    $('#btn-end').disabled = atEnd();
    $('#btn-reset').disabled = S.k === 0;
  }

  function renderMachine() {
    renderTape();
    renderExpect();
    renderStatus();
    renderLog();
    renderControls();
    markNextRule();
    renderChips();
  }

  function renderChips() {
    const box = $('#input-chips');
    box.replaceChildren();
    const lv = S.level;
    const cur = Core.clean(S.input);
    lv.visible.forEach((w) => {
      let tick = null;
      let cls = 'chip';
      if (!lv.sandbox) {
        const r = Core.run(Core.activeRules(S.rules), w, { prepared: true });
        const good = (r.status === 'done' || r.status === 'halted') && r.output === lv.spec(w);
        cls += good ? ' ok' : ' no';
        tick = h('span', { class: 'tick', text: good ? '✓' : '✗', 'aria-label': good ? 'passes' : 'fails' });
      }
      box.append(h('button', { type: 'button', class: cls, 'aria-pressed': String(cur === w), onclick: () => setInput(w) }, w === '' ? 'empty' : w, tick));
    });
  }

  function setInput(w) {
    stopTimer();
    S.input = w;
    $('#trial-input').value = w;
    persistRules();
    recompute();
    renderMachine();
    renderTests();
  }

  function randomInput() {
    const alpha = S.level.sandbox ? 'ab' : S.level.alphabet;
    if (S.level.id === 'balanced') {
      const n = 2 + Math.floor(Math.random() * 7);
      let w = '';
      for (let i = 0; i < n; i++) w += Math.random() < 0.5 ? '(' : ')';
      return w;
    }
    const n = 2 + Math.floor(Math.random() * 7);
    let w = '';
    for (let i = 0; i < n; i++) w += alpha[Math.floor(Math.random() * alpha.length)];
    return w;
  }

  // ---- running ----
  function stopTimer() {
    if (S.timer != null) { clearInterval(S.timer); S.timer = null; }
  }
  function stepOnce() {
    if (atEnd()) { stopTimer(); return false; }
    S.k++;
    return true;
  }
  function toggleRun() {
    if (S.timer != null) { stopTimer(); renderControls(); return; }
    if (atEnd()) S.k = 0;
    const speed = Number($('#speed').value) - 1;
    const tick = () => {
      stepOnce();
      renderMachine();
      if (atEnd()) { stopTimer(); renderControls(); }
    };
    S.timer = setInterval(tick, DELAYS[speed]);
    tick();
  }

  // ---- tests ----
  function renderTests() {
    const lv = S.level;
    const card = $('#tests-card');
    card.hidden = !!lv.sandbox;
    if (lv.sandbox) return;
    const prepared = Core.activeRules(S.rules);
    const list = $('#test-list');
    list.replaceChildren();
    let pass = 0;
    const cur = Core.clean(S.input);
    lv.visible.forEach((w) => {
      const want = lv.spec(w);
      const r = Core.run(prepared, w, { prepared: true });
      const good = (r.status === 'done' || r.status === 'halted') && r.output === want;
      if (good) pass++;
      const gotText = r.status === 'limit' ? 'never stops' : r.status === 'overflow' ? 'grows without end' : r.output === '' ? 'empty' : r.output;
      list.append(h('button', {
        type: 'button', class: 'test-row ' + (good ? 'ok' : 'no'), 'aria-pressed': String(cur === w),
        onclick: () => setInput(w),
      },
      h('span', { class: 'cell' }, h('small', { text: 'in' }), w === '' ? 'empty' : w),
      h('span', { class: 'arrow', text: '→' }),
      h('span', { class: 'cell' }, h('small', { text: good ? 'out' : `want ${want === '' ? 'empty' : want}, got` }), good ? (want === '' ? 'empty' : want) : gotText),
      h('span', { class: 'mark', text: good ? '✓' : '✗', 'aria-label': good ? 'passes' : 'fails' })));
    });
    $('#tests-sub').textContent = `${pass} of ${lv.visible.length} shown cases pass. Check also runs hidden cases.`;
    const n = Core.activeRules(S.rules).length;
    $('#check-note').textContent = `${n} rule${n === 1 ? '' : 's'} in use. Par is ${lv.solution.length}.`;
  }

  function doCheck() {
    stopTimer();
    const lv = S.level;
    const res = Core.check(lv, S.rules);
    S.verdict = { res, level: lv.id };
    if (res.solved) {
      const prev = store.solved[lv.id];
      if (prev == null || res.ruleCount < prev) store.solved[lv.id] = res.ruleCount;
      saveStore();
      renderLevels();
      renderBrief();
    }
    renderVerdict();
  }

  function renderVerdict() {
    const box = $('#verdict');
    box.replaceChildren();
    box.className = 'verdict';
    if (!S.verdict || S.verdict.level !== S.level.id) return;
    const { res } = S.verdict;
    const lv = S.level;
    const par = lv.solution.length;
    if (res.solved) {
      box.classList.add('win');
      const diff = res.ruleCount - par;
      const line = diff < 0 ? `${-diff} under par: shorter than the reference solution.` : diff === 0 ? 'Exactly par.' : `${diff} over par. The reference uses ${par}; there is a shorter way.`;
      box.append(h('h3', { text: 'Solved' }),
        h('p', { text: `${res.ruleCount} rule${res.ruleCount === 1 ? '' : 's'}. ${line}` }),
        h('p', { text: `All ${res.visible.length} shown cases and ${res.hidden.total} hidden cases pass.` }));
      const idx = LEVELS.indexOf(lv);
      const nextLv = LEVELS[idx + 1];
      box.append(nextLv
        ? h('button', { type: 'button', class: 'btn btn-primary', onclick: () => setLevel(nextLv.id), text: `Next: ${nextLv.name}` })
        : h('button', { type: 'button', class: 'btn btn-primary', onclick: () => setLevel('sandbox'), text: 'Go to the sandbox' }));
    } else {
      box.classList.add('lose');
      const vis = res.visible.filter((v) => !v.ok).length;
      box.append(h('h3', { text: 'Not yet' }));
      if (vis) box.append(h('p', { text: `${vis} of the shown cases fail. Click one to watch it run.` }));
      else if (res.hidden.firstFail) {
        const f = res.hidden.firstFail;
        const gotText = f.status === 'limit' ? 'it never stops' : f.status === 'overflow' ? 'the string grows without end' : `the machine returns ${f.got === '' ? 'the empty string' : f.got}`;
        box.append(
          h('p', { text: `The shown cases pass, but ${res.hidden.total - res.hidden.passed} of ${res.hidden.total} hidden cases fail.` }),
          h('p', {}, 'For example, on ', h('code', { text: f.input === '' ? 'the empty string' : f.input }), `: expected ${f.expected === '' ? 'the empty string' : f.expected}, but ${gotText}.`),
          h('button', { type: 'button', class: 'btn', onclick: () => setInput(f.input), text: 'Try that input' }));
      }
    }
  }

  function renderAll() {
    renderLevels();
    renderBrief();
    renderRules();
    $('#trial-input').value = S.input;
    $('#machine-sub').textContent = S.level.sandbox ? 'Any string, any rules.' : 'Run any input to see the machine work.';
    renderMachine();
    renderTests();
    renderVerdict();
  }

  // ---- wiring ----
  function init() {
    loadStore();
    $('#add-rule').addEventListener('click', () => {
      if (S.rules.length >= MAX_RULES) return;
      S.rules.push(blankRow());
      afterStructuralChange();
      const rows = document.querySelectorAll('.rule');
      const last = rows[rows.length - 1];
      if (last) $('input', last).focus();
    });
    $('#clear-rules').addEventListener('click', () => {
      S.rules = [blankRow()];
      afterStructuralChange();
    });
    $('#trial-input').addEventListener('input', (e) => {
      stopTimer();
      S.input = e.target.value;
      persistRules();
      recompute();
      renderMachine();
      renderTests();
    });
    $('#random-input').addEventListener('click', () => setInput(randomInput()));
    $('#btn-reset').addEventListener('click', () => { stopTimer(); S.k = 0; renderMachine(); });
    $('#btn-step').addEventListener('click', () => { stopTimer(); stepOnce(); renderMachine(); });
    $('#btn-run').addEventListener('click', () => { toggleRun(); renderControls(); });
    $('#btn-end').addEventListener('click', () => { stopTimer(); S.k = total(); renderMachine(); });
    $('#btn-check').addEventListener('click', doCheck);
    $('#log-wrap').addEventListener('toggle', () => { if ($('#log-wrap').open) renderLog(); });
    const start = store.level && allLevels().some((l) => l.id === store.level) ? store.level : 'flip';
    setLevel(start);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
