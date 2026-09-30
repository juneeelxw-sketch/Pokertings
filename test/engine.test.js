const assert = require('assert');
const E = require('../engine.js');
const h = s => s.split(' ').map(E.parseCard);
const ev = s => E.evaluate(h(s));
let n = 0;
const t = (name, fn) => { fn(); n++; console.log('ok -', name); };

t('category detection', () => {
  assert.strictEqual(E.category(ev('Ah Kh Qh Jh Th 2c 3d')), 8);
  assert.strictEqual(E.category(ev('Ah 2h 3h 4h 5h 9c 9d')), 8);
  assert.strictEqual(E.category(ev('9s 9h 9d 9c 2s 3s 4d')), 7);
  assert.strictEqual(E.category(ev('9s 9h 9d 2c 2s 3s 4d')), 6);
  assert.strictEqual(E.category(ev('9s 9h 9d 2c 2s 3s 3d')), 6);
  assert.strictEqual(E.category(ev('9s 9h 9d 8c 8s 8h 4d')), 6);
  assert.strictEqual(E.category(ev('As 9s 7s 4s 2s Kd Qd')), 5);
  assert.strictEqual(E.category(ev('Ac 2d 3s 4h 5c Kd Qd')), 4);
  assert.strictEqual(E.category(ev('Tc Jd Qs Kh Ac 2d 2s')), 4);
  assert.strictEqual(E.category(ev('Qc Kd As 2h 3c 7d 8s')), 0);
  assert.strictEqual(E.category(ev('Qc Qd Js Jh 3c 3d 8s')), 2);
});
t('comparisons', () => {
  assert(ev('Ah Ad Kc 7s 4d 3c 2h') > ev('Kh Kd Ac 7s 4d 3c 2h'));
  assert(ev('Ah Ad Kc 7s 4d') > ev('Ah Ad Qc 7s 4d'));
  assert(ev('6c 2d 3s 4h 5c') > ev('Ac 2d 3s 4h 5d'));
  assert(ev('Qc Qd Js Jh 3c 3d As') > ev('Qc Qd Js Jh 3c 3d Ks'));
  assert.strictEqual(ev('Ah Kd 7c 7s 2d 3c 4h'), ev('As Kc 7h 7d 2c 3d 4s'));
});
t('ranges', () => {
  const r = E.parseRange('22+, A2s+, KTs+, ATo+, KQo, A9o-A5o, 99-66');
  assert(r.has('22') && r.has('AA') && r.has('A2s') && r.has('AKs') && r.has('KTs') && !r.has('K9s'));
  assert(r.has('A7o') && !r.has('A4o') && r.has('KQo'));
  assert.strictEqual(E.rangeCombos(E.parseRange('AA')).length, 6);
  assert.strictEqual(E.rangeCombos(E.parseRange('AKs')).length, 4);
  assert.strictEqual(E.rangeCombos(E.parseRange('AKo')).length, 12);
  assert.strictEqual(E.handKey(E.parseCard('Kh'), E.parseCard('Ah')), 'AKs');
});
t('equity AA vs KK ~82%', () => {
  const eq = E.equityMC(h('Ah Ad'), [], [E.rangeCombos(E.parseRange('KK'))], 20000);
  assert(eq > 0.79 && eq < 0.85, eq);
});
t('equity AKo vs QQ ~43%', () => {
  const eq = E.equityMC(h('As Kd'), [], [E.rangeCombos(E.parseRange('QQ'))], 20000);
  assert(eq > 0.40 && eq < 0.47, eq);
});
t('turn flush draw vs set = 9 outs (minus board pair) exact', () => {
  const eqs = E.comboEquities(h('Ah Kh'), h('2h 7h 9c Qd'), [h('9s 9d')]);
  // 9 hearts, but 9h not available? 9h is live; heart pairing board (2h,7h? no, Qh) gives FH:
  // hearts left: 3,4,5,6,8,9,T,J,Q (9 cards); 9h and Qh pair the board -> set fills up. 7 clean outs.
  assert(Math.abs(eqs[0] - 7 / 44) < 1e-9, eqs[0]);
  const outs = E.riverOuts(h('Ah Kh'), h('9s 9d'), h('2h 7h 9c Qd'));
  assert.strictEqual(outs.length, 7);
});
t('classification', () => {
  assert.strictEqual(E.classify(h('Ah Kh'), h('2h 7h 9c')).cls, 'draw');
  assert.strictEqual(E.classify(h('9s 9d'), h('2h 7h 9c')).label, 'Set');
  assert.strictEqual(E.classify(h('As Qd'), h('Ac 7h 2c')).label, 'Top pair, good kicker');
  assert.strictEqual(E.classify(h('As 5d'), h('Ac 7h 2c')).label, 'Top pair, weak kicker');
  assert.strictEqual(E.classify(h('Ks Kd'), h('Qc 7h 2c')).label, 'Overpair');
  assert.strictEqual(E.classify(h('8s 9d'), h('Tc 7h 2c')).label, 'Open-ended straight draw');
  assert.strictEqual(E.classify(h('8s 6d'), h('Tc 7h 2c')).label, 'Gutshot straight draw');
  assert.strictEqual(E.classify(h('Ks Jd'), h('Tc 7h 2c 3s 4d')).cls, 'air');
  assert.strictEqual(E.classify(h('7s 6d'), h('Kc 7h 2c')).label, 'Second pair');
});
t('describe', () => {
  assert.strictEqual(E.describe(ev('Kh Kd 7c 7s 2d 3c 4h')), 'Two pair, kings and sevens');
  assert.strictEqual(E.describe(ev('Ah Kh Qh Jh Th 2c 3d')), 'Royal flush');
  assert.strictEqual(E.describe(ev('9s 9h 9d 2c 2s 3s 4d')), 'Full house, nines full of twos');
  assert.strictEqual(E.describe(ev('Ac 2d 3s 4h 5c Kd Qd')), 'Straight, five high');
  assert.strictEqual(E.describe(ev('Ac Jd 3s 4h 8c')), 'Ace high');
});
console.log(`\n${n} tests passed`);
