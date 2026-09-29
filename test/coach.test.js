const assert = require('assert');
const C = require('../coach.js');
const settings = { stack: 200, villain: 'random', straddle: 'random' };
const t0 = Date.now();
const tally = {};
for (const kind of ['open', 'facing', 'decision', 'sizing']) {
  for (let i = 0; i < 40; i++) {
    const s = C.build(kind, settings);
    assert(s.actions.length >= 2, kind);
    for (const a of s.actions) {
      const g = C.grade(s, a.id);
      assert(['best', 'ok', 'mistake'].includes(g.grade));
      assert(g.headline, kind + ' headline');
    }
    const best = C.grade(s, s.actions[0].id);
    const k = kind + ':' + best.best.join('/');
    tally[k] = (tally[k] || 0) + 1;
  }
}
for (let i = 0; i < 50; i++) {
  const q = C.quizQuestion();
  assert(q.answer >= 0 && q.answer < q.options.length, JSON.stringify(q));
}
console.log(tally);
console.log('coach smoke test ok in', Date.now() - t0, 'ms');
