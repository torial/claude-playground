// Rewrite: engine and levels. Plain script so the same file runs in the browser
// (inlined by build.cjs) and in Node (tests/run.cjs).
//
// The machine is a Markov algorithm. Rules are ordered. On every step it finds
// the first rule, from the top, whose pattern occurs in the string, rewrites the
// leftmost occurrence, and starts again from the top. An empty pattern occurs
// at the very start of every string. It stops when no rule matches, or after a
// rule marked "stop" has fired.
const Rewrite = (() => {
  const MAX_STEPS = 5000;
  const MAX_LEN = 300;

  // Spaces never matter, so they are removed wherever text enters the machine.
  const clean = (t) => String(t).replace(/\s+/g, '');
  const isBlank = (r) => r.from === '' && r.to === '' && !r.halt;

  // Rows the player left completely empty are ignored; nothing else is.
  function activeRules(rules) {
    return rules
      .map((r) => ({ from: clean(r.from), to: clean(r.to), halt: !!r.halt }))
      .filter((r) => !isBlank(r));
  }

  // status: 'done' (no rule matched), 'halted' (a stop rule fired),
  //         'limit' (too many steps), 'overflow' (string grew past MAX_LEN).
  function run(rules, input, opts = {}) {
    const rs = opts.prepared ? rules : activeRules(rules);
    const trace = opts.trace ? [] : null;
    let s = clean(input);
    let steps = 0;
    let status = 'done';
    while (true) {
      let hit = -1;
      let pos = 0;
      for (let i = 0; i < rs.length; i++) {
        const p = rs[i].from === '' ? 0 : s.indexOf(rs[i].from);
        if (p >= 0) {
          hit = i;
          pos = p;
          break;
        }
      }
      if (hit < 0) break;
      if (steps >= MAX_STEPS) {
        status = 'limit';
        break;
      }
      const r = rs[hit];
      const after = s.slice(0, pos) + r.to + s.slice(pos + r.from.length);
      if (trace) trace.push({ rule: hit, pos, len: r.from.length, before: s, after });
      s = after;
      steps++;
      if (s.length > MAX_LEN) {
        status = 'overflow';
        break;
      }
      if (r.halt) {
        status = 'halted';
        break;
      }
    }
    return { output: s, steps, status, trace };
  }

  // ---- tiny seeded generator so "hidden" cases are the same on every run ----
  function rng(seed) {
    let a = seed >>> 0;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function allStrings(alphabet, maxLen, minLen = 0) {
    const out = [];
    let layer = [''];
    if (minLen === 0) out.push('');
    for (let n = 1; n <= maxLen; n++) {
      const next = [];
      for (const w of layer) for (const c of alphabet) next.push(w + c);
      layer = next;
      if (n >= minLen) out.push(...layer);
    }
    return out;
  }
  function randomStrings(alphabet, count, minLen, maxLen, seed) {
    const r = rng(seed);
    const out = [];
    for (let i = 0; i < count; i++) {
      const n = minLen + Math.floor(r() * (maxLen - minLen + 1));
      let w = '';
      for (let k = 0; k < n; k++) w += alphabet[Math.floor(r() * alphabet.length)];
      out.push(w);
    }
    return out;
  }
  function randomBalanced(count, maxPairs, seed) {
    const r = rng(seed);
    const out = [];
    for (let i = 0; i < count; i++) {
      const pairs = 1 + Math.floor(r() * maxPairs);
      let open = 0;
      let left = pairs;
      let w = '';
      while (left > 0 || open > 0) {
        if (left > 0 && (open === 0 || r() < 0.5)) {
          w += '(';
          open++;
          left--;
        } else {
          w += ')';
          open--;
        }
      }
      out.push(w);
    }
    return out;
  }

  // ---- levels ----------------------------------------------------------
  const R = (from, to, halt = false) => ({ from, to, halt });

  const levels = [
    {
      id: 'flip',
      name: 'Flip',
      alphabet: 'ab',
      brief: 'Strings of a and b come in. Every a has to leave as a b.',
      lesson:
        'A rule is a pattern and a replacement. The machine looks for the pattern in the string and swaps it out. It keeps going until no rule matches.',
      hint: 'One rule is enough. Watch how many steps a long string takes.',
      visible: ['aaa', 'abab', 'b', ''],
      spec: (w) => w.replace(/a/g, 'b'),
      hidden: () => [...allStrings('ab', 7), ...randomStrings('ab', 20, 8, 14, 11)],
      solution: [R('a', 'b')],
    },
    {
      id: 'sort',
      name: 'Sort',
      alphabet: 'ab',
      brief: 'Put every a in front of every b.',
      lesson:
        'The machine always rewrites the leftmost match, then starts over. A small swap, repeated, can do a large job.',
      hint: 'Find one pair of neighbours that is certainly out of order. Swap it. The machine does the repeating.',
      visible: ['baba', 'bbaa', 'ab', 'bbb'],
      spec: (w) => [...w].sort().join(''),
      hidden: () => [...allStrings('ab', 7), ...randomStrings('ab', 20, 8, 14, 12)],
      solution: [R('ba', 'ab')],
    },
    {
      id: 'tidy',
      name: 'Tidy',
      alphabet: 'ax',
      brief: 'Delete every x. Leave the a’s where they are.',
      lesson: 'A replacement may be empty, which deletes whatever matched.',
      hint: 'Leave the replacement box empty.',
      visible: ['axxa', 'xxx', 'a', 'xaxax'],
      spec: (w) => w.replace(/x/g, ''),
      hidden: () => [...allStrings('ax', 7), ...randomStrings('ax', 20, 8, 14, 13)],
      solution: [R('x', '')],
    },
    {
      id: 'parity',
      name: 'Even or odd',
      alphabet: 'a',
      brief: 'Count the a’s. Answer E if the count is even, O if it is odd. Zero counts as even.',
      lesson:
        'Order is priority. A rule lower in the list only gets a turn when nothing above it matches, so the last rule can mean “nothing else applied”. A rule marked stop ends the run as soon as it fires.',
      hint: 'Cancel the a’s in pairs. At most one a is left over. Then ask what is left.',
      visible: ['aaa', 'aaaa', 'a', ''],
      spec: (w) => (w.length % 2 === 0 ? 'E' : 'O'),
      hidden: () => allStrings('a', 30),
      solution: [R('aa', ''), R('a', 'O', true), R('', 'E', true)],
    },
    {
      id: 'double',
      name: 'Doubler',
      alphabet: '1',
      brief: 'Replace every 1 with two 1s, so 111 becomes 111111.',
      lesson:
        'You can write your own symbols. A marker, walked along the string, lets the machine remember where it is. An empty pattern matches at the start of any string, which is how a program plants its first marker.',
      hint: 'Put the empty-pattern rule at the bottom. It plants a marker once. The rules above it move the marker along, and one marked stop rule removes it at the end.',
      visible: ['1', '111', '11111', ''],
      spec: (w) => w + w,
      hidden: () => allStrings('1', 30),
      solution: [R('|1', '11|'), R('|', '', true), R('', '|')],
    },
    {
      id: 'increment',
      name: 'Add one',
      alphabet: '01',
      brief: 'A binary number comes in, most significant bit first. Send it back plus one. Keep leading zeros, but grow by one digit if every bit was 1.',
      lesson:
        'Carrying is the same trick as the doubler: send a marker along the string, turn it around at the end, and let it move back leftward doing the work.',
      hint: 'Use two markers: one that walks right until it falls off the end, and one that carries leftward. A 0 meeting the carry becomes 1 and the job is done.',
      visible: ['0', '1', '101', '111', '1011'],
      spec: (w) => {
        if (/^1*$/.test(w)) return '1' + '0'.repeat(w.length);
        const i = w.lastIndexOf('0');
        return w.slice(0, i) + '1' + '0'.repeat(w.length - i - 1);
      },
      hidden: () => [...allStrings('01', 7, 1), ...randomStrings('01', 20, 8, 14, 14)],
      solution: [
        R('>0', '0>'),
        R('>1', '1>'),
        R('>', '<'),
        R('0<', '1', true),
        R('1<', '<0'),
        R('<', '1', true),
        R('', '>'),
      ],
    },
    {
      id: 'balanced',
      name: 'Balanced',
      alphabet: '()',
      brief: 'Parentheses come in. Answer Y if every ( has a matching ) in the right order, otherwise N. The empty string is balanced.',
      lesson:
        'Reduction: remove what you understand, and look at what is left. A rule that rewrites something into itself with stop is a legitimate way to say “this is the answer”.',
      hint: 'Delete () pairs first. Whatever survives is unbalanced. Turn one survivor into an N and let the N swallow its neighbours. Y is the answer when nothing at all is left.',
      visible: ['()', '(())', '(()', ')(', '()()', ''],
      spec: (w) => {
        let d = 0;
        for (const c of w) {
          d += c === '(' ? 1 : -1;
          if (d < 0) return 'N';
        }
        return d === 0 ? 'Y' : 'N';
      },
      hidden: () => [
        ...allStrings('()', 8),
        ...randomStrings('()', 15, 9, 16, 15),
        ...randomBalanced(15, 8, 16),
      ],
      solution: [
        R('()', ''),
        R('N(', 'N'),
        R('N)', 'N'),
        R(')N', 'N'),
        R('N', 'N', true),
        R('(', 'N'),
        R(')', 'N'),
        R('', 'Y', true),
      ],
    },
    {
      id: 'reverse',
      name: 'Reverse',
      alphabet: 'ab',
      brief: 'Send the string back reversed.',
      lesson:
        'The hardest thing the machine can’t do in one move is carry something across a long stretch. Capital letters can stand for “this letter, in transit”.',
      hint: 'Keep a finished part on the left, behind a ^ wall, and a marker | between it and the rest. Take the first letter after |, turn it into a capital, and let the capital walk left until it hits ^. Then turn it back.',
      visible: ['abb', 'ab', 'aab', 'a', ''],
      spec: (w) => [...w].reverse().join(''),
      hidden: () => [...allStrings('ab', 7), ...randomStrings('ab', 20, 8, 12, 17)],
      solution: [
        R('aA', 'Aa'),
        R('bA', 'Ab'),
        R('aB', 'Ba'),
        R('bB', 'Bb'),
        R('^A', '^a'),
        R('^B', '^b'),
        R('|a', 'A|'),
        R('|b', 'B|'),
        R('|', ''),
        R('^', '', true),
        R('', '^|'),
      ],
    },
  ];

  // Runs the player's rules on the visible cases and on the hidden ones.
  function check(level, rules) {
    const rs = activeRules(rules);
    const verdict = (input) => {
      const expected = level.spec(input);
      const res = run(rs, input, { prepared: true });
      const ok = (res.status === 'done' || res.status === 'halted') && res.output === expected;
      return { input, expected, got: res.output, status: res.status, steps: res.steps, ok };
    };
    const visible = level.visible.map(verdict);
    const seen = new Set(level.visible);
    const hiddenInputs = [...new Set(level.hidden())].filter((w) => !seen.has(w));
    let firstFail = null;
    let passed = 0;
    for (const w of hiddenInputs) {
      const v = verdict(w);
      if (v.ok) passed++;
      else if (!firstFail) firstFail = v;
    }
    const visibleOk = visible.every((v) => v.ok);
    const hiddenOk = passed === hiddenInputs.length;
    return {
      visible,
      hidden: { total: hiddenInputs.length, passed, firstFail },
      ruleCount: rs.length,
      solved: visibleOk && hiddenOk,
    };
  }

  return { run, check, levels, activeRules, clean, MAX_STEPS, MAX_LEN };
})();
if (typeof module !== 'undefined') module.exports = Rewrite;
