// node tests/run.cjs
// Every check here must be able to go red: the second block deletes each rule of
// every reference solution and the third plays a cheater, and both have to fail.
const R = require('../src/core.js');
let failures = 0;
const fail = (msg) => {
  failures++;
  console.log('  FAIL ' + msg);
};
const ok = (msg) => console.log('  ok   ' + msg);

console.log('1. reference solutions pass the visible and hidden cases');
for (const lv of R.levels) {
  const res = R.check(lv, lv.solution);
  const line = `${lv.id}: ${res.ruleCount} rules, visible ${res.visible.filter((v) => v.ok).length}/${res.visible.length}, hidden ${res.hidden.passed}/${res.hidden.total}`;
  if (res.solved && res.hidden.total >= 10) ok(line);
  else fail(line + (res.hidden.firstFail ? ' first failure: ' + JSON.stringify(res.hidden.firstFail) : ''));
}

console.log('2. deleting any one rule of a reference solution makes it fail (tests have teeth, solutions have no dead rules)');
for (const lv of R.levels) {
  lv.solution.forEach((_, i) => {
    const mutant = lv.solution.filter((__, j) => j !== i);
    const res = R.check(lv, mutant);
    if (res.solved) fail(`${lv.id}: rule ${i + 1} (${lv.solution[i].from}→${lv.solution[i].to}) can be deleted and the level still passes`);
  });
  ok(`${lv.id}: ${lv.solution.length} single-rule deletions all rejected`);
}

console.log('3. a cheater that memorises the visible cases passes them and is caught by the hidden ones');
for (const lv of R.levels) {
  // Longest pattern first, or a short memorised case fires inside a longer input.
  const cheat = lv.visible.map((w) => ({ from: w, to: lv.spec(w), halt: true })).sort((a, b) => b.from.length - a.from.length);
  const res = R.check(lv, cheat);
  const visiblePass = res.visible.every((v) => v.ok);
  if (!visiblePass) {
    // The cheater itself must work, or this proves nothing about the hidden set.
    fail(`${lv.id}: cheater does not even beat the visible cases ${JSON.stringify(res.visible.filter((v) => !v.ok))}`);
  } else if (res.solved) fail(`${lv.id}: cheater solved the level`);
  else ok(`${lv.id}: cheater passes visible, fails ${res.hidden.total - res.hidden.passed}/${res.hidden.total} hidden`);
}

console.log('4. engine limits');
{
  const loop = R.run([{ from: 'a', to: 'a', halt: false }], 'a');
  loop.status === 'limit' && loop.steps === R.MAX_STEPS ? ok('a→a never ends: status limit at ' + loop.steps) : fail('loop status ' + loop.status);
  const grow = R.run([{ from: 'a', to: 'aa', halt: false }], 'a');
  grow.status === 'overflow' ? ok('a→aa overflows') : fail('grow status ' + grow.status);
  const halt = R.run([{ from: 'a', to: 'b', halt: true }], 'aaa');
  halt.status === 'halted' && halt.output === 'baa' && halt.steps === 1 ? ok('stop rule stops after one rewrite') : fail('halt ' + JSON.stringify(halt));
  const leftmost = R.run([{ from: 'ab', to: 'X' }], 'ababab', { trace: true });
  leftmost.trace[0].pos === 0 && leftmost.output === 'XXX' ? ok('leftmost match first') : fail('leftmost');
  const priority = R.run([{ from: 'b', to: '1' }, { from: 'a', to: '2' }], 'ab', { trace: true });
  priority.trace[0].rule === 0 && priority.output === '21' ? ok('earlier rule wins over earlier position') : fail('priority ' + JSON.stringify(priority));
  const blank = R.activeRules([{ from: '', to: '', halt: false }, { from: ' a ', to: ' b', halt: false }, { from: '', to: '', halt: true }]);
  blank.length === 2 && blank[0].from === 'a' && blank[0].to === 'b' ? ok('blank rows ignored, spaces stripped, empty stop rule kept') : fail('blank ' + JSON.stringify(blank));
  const looping = R.check(R.levels[0], [{ from: 'a', to: 'b' }, { from: '', to: 'a' }]);
  !looping.solved ? ok('a looping program does not pass') : fail('looping program passed');
}

console.log('5. specs agree with hand-worked answers');
{
  const byId = Object.fromEntries(R.levels.map((l) => [l.id, l]));
  const cases = [
    ['increment', '1011', '1100'], ['increment', '0011', '0100'], ['increment', '111', '1000'], ['increment', '0', '1'],
    ['balanced', ')(', 'N'], ['balanced', '(()())', 'Y'], ['balanced', '())(', 'N'], ['balanced', '', 'Y'],
    ['parity', '', 'E'], ['parity', 'aaa', 'O'], ['reverse', 'aab', 'baa'], ['double', '111', '111111'], ['sort', 'bbaa', 'aabb'],
  ];
  for (const [id, input, want] of cases) {
    const got = byId[id].spec(input);
    got === want ? ok(`${id}(${input || 'ε'}) = ${want}`) : fail(`${id}(${input}) gave ${got}, wanted ${want}`);
  }
}

console.log(failures === 0 ? '\nALL GREEN' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
