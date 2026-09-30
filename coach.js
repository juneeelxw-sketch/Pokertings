/* Pokertings coach: villain profiles, scenario generation and grading.
   Depends on PokerEngine. Browser: window.PokerCoach. Node: module.exports. */
(function (root) {
  'use strict';
  const E = typeof module !== 'undefined' && module.exports ? require('./engine.js') : root.PokerEngine;

  const rnd = n => (Math.random() * n) | 0;
  const pick = a => a[rnd(a.length)];
  const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
  const r5 = x => Math.max(5, Math.round(x / 5) * 5);
  const r1 = x => Math.max(1, Math.round(x));
  function pickWeighted(obj) {
    const ks = Object.keys(obj);
    let t = Math.random() * ks.reduce((s, k) => s + obj[k], 0);
    for (const k of ks) { t -= obj[k]; if (t <= 0) return k; }
    return ks[ks.length - 1];
  }

  // ---------- Villain profiles ----------
  // bet: chance they bet each holding class. cont: chance they continue vs a ~2/3 pot bet.
  // elastic: how much bet size changes their calling (station barely cares, nit cares a lot).
  const PROFILES = {
    nit: {
      name: 'Nick', type: 'Nit', vpip: '10–14%',
      blurb: 'Plays very few hands. Raises only with strong hands, bets when they have it, folds when pushed.',
      exploit: 'Fold to their raises and big bets without a strong hand. Steal their blinds. Small bluffs work on them.',
      open18: '88+, AJs+, KQs, AQo+', open30: 'TT+, AKs, AKo',
      pf: '88+, AJs+, KQs, AQo+', pf3: 'TT+, AKs, AKo',
      bet: { strong: .9, medium: .15, draw: .1, weak: .03, air: .03 }, shove: .3,
      cont: { medium: .25, draw: .35, weak: .03, air: 0 }, elastic: .8,
      sizes: [.5, .66], implied: .15,
    },
    tag: {
      name: 'Tina', type: 'TAG', vpip: '18–24%',
      blurb: 'Solid regular. Raises a sensible range, bets for value and with good draws, bluffs sometimes.',
      exploit: 'Respect their 3-bets and turn/river raises. Play in position, avoid marginal calls out of position.',
      open18: '55+, A9s+, KTs+, QTs+, JTs, T9s, 98s, AJo+, KQo', open30: '88+, ATs+, KQs, AQo+',
      pf: '55+, A9s+, KTs+, QTs+, JTs, T9s, 98s, AJo+, KQo', pf3: '99+, AJs+, KQs, AQo+',
      bet: { strong: .85, medium: .4, draw: .6, weak: .15, air: .3 }, shove: .5,
      cont: { medium: .45, draw: .55, weak: .12, air: .02 }, elastic: .6,
      sizes: [.5, .66, .75], implied: .3,
    },
    lag: {
      name: 'Larry', type: 'LAG', vpip: '30–40%',
      blurb: 'Loose and aggressive. Raises lots of hands, barrels often, puts pressure on everyone.',
      exploit: 'Call down lighter with good pairs. 3-bet your strong hands for value. Let them bluff into you.',
      open18: '22+, A2s+, K8s+, Q9s+, J9s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, ATo+, KJo+, QJo',
      open30: '55+, A7s+, KTs+, QTs+, JTs, T9s, 98s, AJo+, KQo',
      pf: '22+, A2s+, K8s+, Q9s+, J9s+, T8s+, 97s+, 86s+, 75s+, 65s, 54s, ATo+, KJo+, QJo',
      pf3: '77+, A9s+, KTs+, QJs, JTs, AJo+, KQo',
      bet: { strong: .85, medium: .6, draw: .8, weak: .45, air: .5 }, shove: .7,
      cont: { medium: .6, draw: .7, weak: .3, air: .08 }, elastic: .45,
      sizes: [.66, .75, 1], implied: .4,
    },
    station: {
      name: 'Steve', type: 'Calling station', vpip: '45–60%',
      blurb: 'Calls with almost anything and hates folding. Rarely raises or bets without a real hand.',
      exploit: 'Never bluff them. Value bet big and often, even with top pair. When they bet or raise, believe them.',
      open18: '99+, AJs+, KQs, AQo+', open30: 'JJ+, AKs, AKo',
      pf: '22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 76s, 65s, 54s, A2o+, KTo+, QTo+, JTo',
      pf3: 'TT+, AJs+, KQs, AQo+',
      bet: { strong: .7, medium: .25, draw: .05, weak: .05, air: .03 }, shove: .5,
      cont: { medium: .95, draw: .9, weak: .7, air: .25 }, elastic: .1,
      sizes: [.33, .5], implied: .6,
    },
    maniac: {
      name: 'Max', type: 'Maniac', vpip: '55–70%',
      blurb: 'Raises $30 with anything, bets every street, shoves light. Huge swings.',
      exploit: 'Tighten up, then let them hang themselves. Call down with top pair+. Do not try to bluff them.',
      open18: '22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 96s+, 85s+, 74s+, 63s+, 53s+, 43s, A2o+, K8o+, Q9o+, J9o+, T9o, 98o',
      open30: '22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 96s+, 85s+, 74s+, 63s+, 53s+, 43s, A2o+, K8o+, Q9o+, J9o+, T9o, 98o',
      pf: '22+, A2s+, K2s+, Q5s+, J7s+, T7s+, 96s+, 85s+, 74s+, 63s+, 53s+, 43s, A2o+, K8o+, Q9o+, J9o+, T9o, 98o',
      pf3: '22+, A2s+, K8s+, Q9s+, J9s+, T8s+, 98s, A7o+, KTo+, QJo',
      bet: { strong: .95, medium: .85, draw: .9, weak: .8, air: .7 }, shove: 1,
      cont: { medium: .75, draw: .75, weak: .45, air: .15 }, elastic: .25,
      sizes: [.75, 1, 1.25], implied: .5,
    },
  };
  const VILLAIN_KEYS = Object.keys(PROFILES);
  const CLASSES = ['strong', 'draw', 'medium', 'weak', 'air'];
  const CLASS_NAMES = { strong: 'Strong (top pair good kicker+)', draw: 'Draws', medium: 'Medium pairs', weak: 'Weak pairs / gutshots', air: 'Air (nothing)' };

  const _cache = {};
  function combos(rangeStr) {
    if (!_cache[rangeStr]) _cache[rangeStr] = E.rangeCombos(E.parseRange(rangeStr));
    return _cache[rangeStr];
  }
  const keysOf = s => E.parseRange(s);

  function contProb(p, cls, frac) {
    if (cls === 'strong') return 1;
    const adj = 1 + p.elastic * (0.66 - frac) * 1.2;
    return clamp(p.cont[cls] * adj, 0, 1);
  }

  // ---------- Preflop tables (9-handed, $1/$1, big opens, straddles) ----------
  const STRADDLE = 2;
  const POS = ['UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO', 'BTN', 'SB', 'BB'];
  const POST_ORDER = ['SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO', 'BTN'];
  // Opening ranges are chosen by how many players are still to act behind you.
  const OPEN = {
    'UTG': '77+, ATs+, KQs, AQo+',
    'UTG+1': '77+, A9s+, KJs+, AQo+, KQo',
    'UTG+2': '66+, A9s+, KJs+, QJs, AJo+, KQo',
    'MP': '55+, A8s+, KTs+, QTs+, JTs, AJo+, KQo',
    'HJ': '44+, A5s+, K9s+, Q9s+, J9s+, T9s, ATo+, KJo+',
    'CO': '22+, A2s+, K8s+, Q9s+, J9s+, T8s+, 98s, 87s, A9o+, KTo+, QJo',
    'BTN': '22+, A2s+, K5s+, Q8s+, J8s+, T8s+, 97s+, 86s+, 76s, 65s, 54s, A7o+, KTo+, QTo+, JTo',
    'SB': '22+, A2s+, K8s+, Q9s+, J9s+, T9s, 98s, A8o+, KJo+, QJo',
  };
  const BY_BEHIND = { 8: 'UTG', 7: 'UTG+1', 6: 'UTG+2', 5: 'MP', 4: 'HJ', 3: 'CO', 2: 'BTN', 1: 'BTN' };
  const STRADDLE_NAMES = { none: 'No straddle', utg: 'UTG straddle', btn: 'Mississippi (button) straddle' };

  // Works out who has posted what and the preflop acting order. The straddler acts last preflop.
  function tableSetup(settings) {
    let st = settings.straddle || 'none';
    if (st === 'random') st = pickWeighted({ none: 2, utg: 1, btn: 1 });
    const straddler = st === 'utg' ? 'UTG' : st === 'btn' ? 'BTN' : null;
    const order = POS.filter(p => p !== straddler).concat(straddler ? [straddler] : []);
    const posted = p => (p === 'SB' || p === 'BB' ? 1 : p === straddler ? STRADDLE : 0);
    return { st, straddler, order, posted, dead: 2 + (straddler ? STRADDLE : 0), toCall: straddler ? STRADDLE : 1 };
  }
  const OPEN_KEYS = {};
  for (const k in OPEN) OPEN_KEYS[k] = keysOf(OPEN[k]);
  const PREMIUM = keysOf('QQ+, AKs, AKo');
  const SPECULATIVE = keysOf('22-99, A2s-A9s, KTs, QTs, JTs, T9s, 98s, 87s, 76s, 65s, 54s, K9s, Q9s, J9s, T8s, 97s, 86s');
  const TEMPTING = [...keysOf('22-TT, A2s-A9s, A2o-AJo, KTo, KJo, QTo, QJo, JTo, K9o, Q9o, J9o, T9o, 98o, K9s, KTs, KJs, Q9s, QTs, J9s, JTs, T9s, T8s, 98s, 87s, 76s, 65s, 54s, K5s, Q7s, J7s, 96s, 85s, AQo, AQs, KQo, KQs, JJ, QQ')];
  const HERO_POST = '22+, A2s+, K9s+, Q9s+, J9s+, T8s+, 97s+, 87s, 76s, 65s, ATo+, KJo+, QJo';
  const CALLER_RANGE = '22+, A2s+, K9s+, Q9s+, J9s+, T8s+, 97s+, 87s, 76s, 65s, ATo+, KJo+, QJo';

  function dealHand(fromKeys) {
    for (;;) {
      let c1, c2;
      if (fromKeys) {
        const cs = E.combosForKey(pick(fromKeys));
        [c1, c2] = pick(cs);
        if (Math.random() < 0.5) [c1, c2] = [c2, c1];
      } else {
        c1 = rnd(52); c2 = rnd(52);
      }
      if (c1 !== c2) return [c1, c2];
    }
  }
  function heroPreflopHand() {
    const r = Math.random();
    if (r < 0.3) return dealHand(null);
    if (r < 0.9) return dealHand(TEMPTING);
    return dealHand([...PREMIUM]);
  }
  const pctStr = x => Math.round(x * 100) + '%';
  const money = x => '$' + Math.round(x);

  // ---------- Preflop: action folds (or limps) to you ----------
  function buildOpen(settings) {
    const T = tableSetup(settings);
    const hero = heroPreflopHand();
    const seats = T.order.filter(p => p !== 'BB' && p !== T.straddler);
    const pos = pick(seats);
    const idx = T.order.indexOf(pos);
    const limpers = Math.min(idx, pickWeighted({ 0: 5, 1: 3, 2: 2 }) | 0);
    const key = E.handKey(hero[0], hero[1]);
    const behind = T.order.length - 1 - idx;
    // With limpers in front, raise a tighter range (as if two more players were behind you).
    let effPos, widerPos;
    if (pos === 'SB') { effPos = limpers ? 'HJ' : 'SB'; widerPos = limpers ? 'CO' : 'BTN'; }
    else {
      const eff = Math.min(8, behind + (limpers ? 2 : 0));
      effPos = BY_BEHIND[eff]; widerPos = BY_BEHIND[Math.max(2, eff - 1)];
    }
    const inRange = OPEN_KEYS[effPos].has(key);
    const near = !inRange && OPEN_KEYS[widerPos].has(key);
    const pot = T.dead + limpers * T.toCall;
    const log = T.straddler ? [`${T.straddler} straddles $${STRADDLE}`] : [];
    const before = T.order.slice(0, idx);
    const limpSeats = limpers ? before.slice(-limpers) : [];
    for (const p of before) log.push(limpSeats.includes(p) ? `${p} limps $${T.toCall}` : `${p} folds`);
    const limpCost = T.toCall - T.posted(pos);
    return {
      kind: 'open', hero, pos, limpers, key, effPos, inRange, near, pot, behindN: behind,
      straddle: T.st, straddler: T.straddler,
      stack: settings.stack, log, board: [],
      actions: [
        { id: 'fold', label: 'Fold' },
        { id: 'limp', label: pos === 'SB' ? `Complete $${limpCost}` : `Limp $${limpCost}` },
        { id: 'r6', label: 'Raise $6', amt: 6 },
        { id: 'r12', label: 'Raise $12', amt: 12 },
        { id: 'r18', label: 'Raise $18', amt: 18 },
        { id: 'r30', label: 'Raise $30', amt: 30 },
      ],
      prompt: (T.straddler ? `${T.straddler} straddled. ` : '') +
        (limpers ? `${limpers} limper${limpers > 1 ? 's' : ''} in front of you. Your move.` : 'Folded to you. Your move.'),
    };
  }
  function gradeOpen(s, a) {
    const g = { best: [], ok: [], notes: [] };
    const premium = PREMIUM.has(s.key);
    const spec = SPECULATIVE.has(s.key);
    const late = s.behindN <= 3 || s.pos === 'SB';
    const sizeLimpers = s.limpers + (s.straddler ? 1 : 0);
    if (s.inRange) {
      if (sizeLimpers === 0) { g.best.push('r12', 'r18'); g.ok.push('r30', 'r6'); }
      else if (sizeLimpers === 1) { g.best.push('r18'); g.ok.push('r12', 'r30'); }
      else { g.best.push('r18', 'r30'); g.ok.push('r12'); }
      if (!premium && spec && s.limpers && late) g.ok.push('limp');
      g.headline = `${s.key} is a raise from ${s.pos}${s.limpers ? ' over limpers' : ''}.`;
    } else if (s.near) {
      g.best.push('fold'); g.ok.push('r12', 'r18');
      if (spec && s.limpers && late) g.ok.push('limp');
      g.headline = `${s.key} is borderline from ${s.pos}. Folding is the disciplined choice.`;
    } else {
      g.best.push('fold');
      if (spec && s.limpers >= 2 && late) g.ok.push('limp');
      g.headline = `${s.key} is a fold from ${s.pos}.`;
    }
    const range = OPEN_KEYS[s.effPos];
    g.notes.push(`${s.behindN} player${s.behindN === 1 ? '' : 's'} still to act behind you. Coach's ${s.limpers ? 'raising range over limpers' : 'opening range'} here is about ${pctStr(E.rangePct(range))} of hands: ${OPEN[s.effPos]}.`);
    if (s.straddler) g.notes.push(`The ${s.straddler} straddle adds $${STRADDLE} of dead money and acts last before the flop, so count the straddler as one more player behind you. Raise to about $18 rather than $12.`);
    if (s.limpers) g.notes.push('With limpers, raise a tighter range and raise bigger (about $15 plus $3–5 per limper). Limping behind builds a multiway pot you will usually lose with a weak hand.');
    else g.notes.push('At a table where $18 is a normal raise, a $12–$18 open is fine. Pick one size and use it with all your hands so the size gives nothing away.');
    if (a === 'limp') g.notes.push(`Limping is the classic home-game leak. It invites an $18 raise and you either fold (losing $${s.pot > 3 && s.straddler ? STRADDLE : 1}) or call out of position with a weak hand.`);
    if (a === 'r6' && s.straddler) g.notes.push('$6 is barely a min-raise over a $2 straddle. Everyone behind gets a great price to call.');
    else if (a === 'r6') g.notes.push('$6 is too small at this table. Five people call and you play a huge multiway pot. Make it bigger or fold.');
    if (a === 'r30' && !premium) g.notes.push('$30 with a non-premium hand risks a lot and only gets called by better hands.');
    if (!s.inRange && a !== 'fold') g.leak = a === 'limp' ? 'Limping' : 'Too loose preflop';
    else if (s.inRange && a === 'fold') g.leak = 'Too tight preflop';
    else if (a === 'limp') g.leak = 'Limping';
    g.played = a !== 'fold';
    g.coachPlayed = !g.best.includes('fold');
    return finish(g, a);
  }

  // ---------- Preflop: facing a big raise ----------
  function buildFacing(settings) {
    const T = tableSetup(settings);
    const vk = settings.villain === 'random' ? pick(VILLAIN_KEYS) : settings.villain;
    const p = PROFILES[vk];
    const size = vk === 'maniac' ? pick([18, 30, 30]) : pick([18, 18, 30]);
    const n = T.order.length;
    // Openers come from the non-blind seats; the hero acts somewhere after them.
    const openers = T.order.filter(x => !['SB', 'BB', T.straddler].includes(x) && T.order.indexOf(x) < n - 1);
    const openPos = pick(openers);
    const oIdx = T.order.indexOf(openPos);
    const hIdx = oIdx + 1 + rnd(n - 1 - oIdx);
    const heroPos = T.order[hIdx];
    const callers = hIdx - oIdx > 1 && Math.random() < 0.35 ? 1 : 0;
    const callerPos = callers ? T.order[hIdx - 1] : null;
    const hero = heroPreflopHand();
    const call = size - T.posted(heroPos);
    const pot = T.dead - T.posted(openPos) - (callerPos ? T.posted(callerPos) : 0) + size * (1 + callers);
    const oop = POST_ORDER.indexOf(heroPos) < POST_ORDER.indexOf(openPos);
    const threeBet = r5(size * (oop ? 3.5 : 3) + size * callers);
    const log = T.straddler ? [`${T.straddler} straddles $${STRADDLE}`] : [];
    for (let i = 0; i < hIdx; i++) {
      const x = T.order[i];
      if (i === oIdx) log.push(`${x} (${p.name}, ${p.type}) raises to $${size}`);
      else if (x === callerPos) log.push(`${x} calls $${size}`);
      else log.push(`${x} folds`);
    }
    const s = {
      kind: 'facing', vk, hero, heroPos, openPos, size, callers, callerPos, call, pot, stack: settings.stack,
      key: E.handKey(hero[0], hero[1]), oop, threeBet, log, board: [], straddle: T.st, straddler: T.straddler,
      range: size >= 30 ? p.open30 : p.open18,
      actions: [
        { id: 'fold', label: 'Fold' },
        { id: 'call', label: `Call $${call}` },
        { id: '3bet', label: `3-bet to $${Math.min(threeBet, settings.stack)}` },
      ],
      prompt: `${p.name} raised to $${size}${callers ? ' and got a call' : ''}. You are in the ${heroPos}${heroPos === T.straddler ? ' (you straddled)' : ''}.`,
    };
    const ranges = [combos(s.range)];
    if (callers) ranges.push(combos(CALLER_RANGE));
    s.eq = E.equityMC(hero, [], ranges, 4000);
    return s;
  }
  function realization(s) {
    const [c1, c2] = s.hero;
    const r1 = E.rankOf(c1), r2 = E.rankOf(c2);
    const pair = r1 === r2, suited = E.suitOf(c1) === E.suitOf(c2), gap = Math.abs(r1 - r2);
    let R = s.oop ? 0.8 : 1.0;
    const why = [s.oop ? 'out of position (−20%)' : 'in position'];
    if (!pair && suited) { R += 0.05; why.push('suited (+5%)'); }
    if (!pair && gap <= 2 && Math.max(r1, r2) <= 11) { R += 0.03; why.push('connected (+3%)'); }
    if (!pair && !suited && gap >= 2) { R -= 0.1; why.push('offsuit and disconnected (−10%)'); }
    if (!pair && !suited && Math.min(r1, r2) >= 10 && gap < 2) { R -= 0.05; why.push('offsuit broadway, often dominated (−5%)'); }
    if (s.callers && !pair) { R -= 0.05; why.push('multiway (−5%)'); }
    return { R, why };
  }
  function gradeFacing(s, a) {
    const p = PROFILES[s.vk];
    const g = { best: [], ok: [], notes: [] };
    const need = s.call / (s.pot + s.call);
    const { R, why } = realization(s);
    const real = s.eq * R;
    const r1 = E.rankOf(s.hero[0]), r2 = E.rankOf(s.hero[1]);
    const pair = r1 === r2, suited = E.suitOf(s.hero[0]) === E.suitOf(s.hero[1]);
    const smallPair = pair && r1 <= 9;
    const speculative = !pair && suited && (Math.abs(r1 - r2) <= 2 || Math.max(r1, r2) === 14);
    const ratio = s.stack / s.call;
    const vThreeBet = s.callers ? 0.4 : 0.56;
    const premium = PREMIUM.has(s.key);
    g.math = [
      ['Pot before you act', money(s.pot)],
      ['Cost to call', money(s.call)],
      ['Pot odds (equity needed)', `${money(s.call)} / (${money(s.pot)} + ${money(s.call)}) = ${pctStr(need)}`],
      [`Your equity vs ${p.name}'s range${s.callers ? ' + caller' : ''}`, pctStr(s.eq)],
      ['Realised equity', `${pctStr(real)} (${why.join(', ')})`],
      ['Stack vs call', `${money(s.stack)} is ${ratio.toFixed(1)}× the call`],
    ];
    if (premium && s.eq < vThreeBet) {
      g.best.push('call', '3bet');
      g.headline = `${s.key} is too strong to fold, but ${p.name}'s range is tight. Calling or re-raising are both fine.`;
      g.notes.push(`Against a tight range, ${s.key} is closer to a coin flip than it feels. Keep the pot manageable and don't go broke with one pair.`);
    } else if (s.eq >= vThreeBet && !smallPair) {
      g.best.push('3bet');
      if (s.eq < vThreeBet + 0.08 || s.vk === 'maniac') g.ok.push('call');
      g.headline = `${s.key} is ahead of ${p.name}'s range. Re-raise for value.`;
      g.notes.push(`You have ${pctStr(s.eq)} equity against the hands ${p.name} raises with here. When you are ahead, build the pot now. Size it about ${s.oop ? '3.5' : '3'}× the raise (${money(s.threeBet)}).`);
    } else if (smallPair) {
      if (ratio >= 15) {
        g.best.push('call'); g.ok.push('fold');
        g.headline = `Set-mining ${s.key} is OK here: you have ${ratio.toFixed(0)}× the call behind.`;
      } else {
        g.best.push('fold');
        g.headline = `Fold ${s.key}. You only have ${ratio.toFixed(0)}× the call behind, and set-mining needs about 15×.`;
      }
      g.notes.push(`A small pair flops a set about 12% of the time (1 in 8.5). You need to win roughly 15× the call when you hit to make up for the misses. $${s.call} × 15 = $${s.call * 15}.${s.vk === 'nit' ? ' Nits pay off sets with overpairs, so set-mining against them is fine.' : ''}`);
    } else if (real >= need - 0.015) {
      g.best.push('call');
      if (real < need + 0.03) g.ok.push('fold');
      g.headline = `Calling is fine. Your realised equity (${pctStr(real)}) covers the ${pctStr(need)} you need.`;
    } else if (speculative && ratio >= 20 && !s.oop && ['lag', 'station', 'maniac'].includes(s.vk)) {
      g.best.push('fold'); g.ok.push('call');
      g.headline = `${s.key} is close. Deep stacks and a loose opener make a call playable, but folding is simpler.`;
      g.notes.push('Suited hands make money through implied odds: you hit a flush or straight and win a big pot. That needs deep stacks (20× the call) and an opponent who pays off.');
    } else {
      g.best.push('fold');
      if (real >= need - 0.05) g.ok.push('call');
      g.headline = `Fold ${s.key}. You need ${pctStr(need)} and only realise about ${pctStr(real)}.`;
      if (!pair && !suited) g.notes.push(`Offsuit hands like ${s.key} are the biggest leak against $${s.size} raises. When you hit top pair you are often outkicked by the hands that raised.`);
    }
    g.notes.push(`${p.name} (${p.type}) raises $${s.size} with about ${pctStr(E.rangePct(keysOf(s.range)))} of hands: ${s.range}.`);
    if (s.size >= 30) g.notes.push('A $30 raise is 30 big blinds. Call it only with hands that are strong or that can win a big pot, like sets.');
    g.leak = null;
    if (a !== 'fold' && g.best.includes('fold') && !g.ok.includes(a)) g.leak = 'Calling big raises too wide';
    else if (a === 'fold' && !g.best.includes('fold') && !g.ok.includes('fold')) g.leak = 'Too tight preflop';
    else if (a === 'call' && g.best.includes('3bet') && !g.ok.includes('call')) g.leak = 'Flat-calling premiums';
    else if (a === '3bet' && !g.best.includes('3bet')) g.leak = 'Re-raising light';
    g.played = a !== 'fold';
    g.coachPlayed = !g.best.includes('fold');
    return finish(g, a);
  }

  // ---------- Postflop helpers ----------
  function dealBoard(dead, n) {
    const b = [];
    while (b.length < n) {
      const c = rnd(52);
      if (dead.includes(c) || b.includes(c)) continue;
      if (b.length < 3 && b.some(x => E.rankOf(x) === E.rankOf(c))) continue; // unpaired flop
      b.push(c);
    }
    return b;
  }
  function villainRange(p, pfStr, board, hero, weightFn, threeBetPot) {
    const all = combos(pfStr).filter(c => !board.includes(c[0]) && !board.includes(c[1]) && !hero.includes(c[0]) && !hero.includes(c[1]));
    const cls = all.map(c => E.classify(c, board).cls);
    const w = cls.map(k => weightFn(k));
    // On later streets they only arrive with hands that bet or called the earlier streets.
    for (let n = 3; n < board.length && !threeBetPot; n++) {
      const prev = board.slice(0, n);
      for (let i = 0; i < all.length; i++) {
        if (!w[i]) continue;
        const k = E.classify(all[i], prev).cls;
        w[i] *= clamp(Math.max(p.bet[k], contProb(p, k, 0.55)), 0.02, 1);
      }
    }
    return { combos: all, cls, w };
  }
  function summarize(vr, eqs, wMul) {
    let sw = 0, se = 0;
    const byCls = {};
    for (const k of CLASSES) byCls[k] = 0;
    for (let i = 0; i < vr.combos.length; i++) {
      const w = vr.w[i] * (wMul ? wMul(vr.cls[i]) : 1);
      if (!(w > 0) || Number.isNaN(eqs[i])) continue;
      sw += w; se += w * eqs[i]; byCls[vr.cls[i]] += w;
    }
    for (const k of CLASSES) byCls[k] = sw ? byCls[k] / sw : 0;
    return { w: sw, eq: sw ? se / sw : 0, byCls };
  }
  function potSetup(street, stack) {
    // Single-raised pot: $18 open called. Flop bet ~half pot called, turn bet ~60% called.
    const pre = Math.min(18, stack);
    let pot = 2 * pre + 1, behind = stack - pre;
    const lines = ['Preflop: $18 raise, called ($37 pot).'];
    if (street === 'turn' || street === 'river') {
      const f = Math.min(r1(pot * 0.5), behind);
      pot += 2 * f; behind -= f;
      lines.push(`Flop: $${f} bet, called.`);
    }
    if (street === 'river') {
      const t = Math.min(r1(pot * 0.6), behind);
      pot += 2 * t; behind -= t;
      lines.push(`Turn: $${t} bet, called.`);
    }
    return { pot, behind, lines };
  }
  const STREET_CARDS = { flop: 3, turn: 4, river: 5 };

  function genHeroAndBoard(street, target, p, pfStr, weightFn, threeBetPot) {
    let best = null;
    for (let tries = 0; tries < 400; tries++) {
      const hero = dealHand([...keysOf(HERO_POST)]);
      const board = dealBoard(hero, STREET_CARDS[street]);
      const hc = E.classify(hero, board);
      if (hc.cls !== target && tries < 350) continue;
      const vr = villainRange(p, pfStr, board, hero, weightFn, threeBetPot);
      const tot = vr.w.reduce((a, b) => a + b, 0);
      if (tot < 4) continue;
      best = { hero, board, hc, vr };
      break;
    }
    return best;
  }

  // ---------- Postflop: villain bets, you decide ----------
  function buildDecision(settings) {
    const vk = settings.villain === 'random' ? pick(VILLAIN_KEYS) : settings.villain;
    const p = PROFILES[vk];
    const street = pick(['flop', 'turn', 'turn', 'river', 'river']);
    const target = pickWeighted(street === 'river'
      ? { strong: .25, medium: .35, weak: .25, air: .15 }
      : { strong: .2, medium: .28, draw: .32, weak: .12, air: .08 });
    const isShove = street === 'flop';
    const pfStr = isShove ? p.pf3 : p.pf;
    const weightFn = k => p.bet[k] * (isShove && k !== 'strong' ? p.shove : 1);
    const g = genHeroAndBoard(street, target, p, pfStr, weightFn, isShove);
    let pot, behind, lines;
    if (isShove) {
      const pre = Math.min(60, settings.stack - 5);
      pot = 2 * pre + 1; behind = settings.stack - pre;
      lines = [`Preflop: you 3-bet to $${pre}, ${p.name} called ($${pot} pot).`];
    } else {
      ({ pot, behind, lines } = potSetup(street, settings.stack));
    }
    const B = isShove ? behind : Math.min(r1(pot * pick(p.sizes)), behind);
    const allIn = B >= behind;
    const eqs = E.comboEquities(g.hero, g.board, g.vr.combos, 150);
    const sumAll = summarize(g.vr, eqs);
    const s = {
      kind: 'decision', vk, street, hero: g.hero, board: g.board, hc: g.hc, pot, bet: B, behind, allIn,
      log: lines.concat([`${street[0].toUpperCase() + street.slice(1)}: ${p.name} ${allIn ? 'moves all-in for' : 'bets'} $${B}.`]),
      eq: sumAll.eq, byCls: sumAll.byCls, stack: settings.stack,
      prompt: `${p.name} ${allIn ? 'shoves' : 'bets'} $${B} into $${pot}. Call $${B} to win $${pot + B}.`,
    };
    s.ev = { fold: 0 };
    s.need = B / (pot + 2 * B);
    s.ev.call = sumAll.eq * (pot + 2 * B) - B;
    s.implied = 0;
    if (g.hc.cls === 'draw' && street === 'turn' && !allIn && behind - B > 0) {
      s.implied = p.implied * Math.min(behind - B, 0.6 * (pot + 2 * B));
      s.ev.call += sumAll.eq * s.implied;
      s.needImplied = B / (pot + 2 * B + s.implied);
    }
    s.actions = [{ id: 'fold', label: 'Fold' }, { id: 'call', label: `Call $${B}` }];
    if (!allIn) {
      let Rz = r1(B * 3 + pot * 0.2);
      if (Rz >= behind * 0.6) Rz = behind;
      const frac = (Rz - B) / (pot + B + Rz);
      const cont = summarize(g.vr, eqs, k => contProb(p, k, frac * 1.5));
      const f = sumAll.w ? 1 - cont.w / sumAll.w : 0;
      s.raiseTo = Rz; s.foldToRaise = f; s.eqWhenCalled = cont.eq;
      s.ev.raise = f * (pot + B) + (1 - f) * (cont.eq * (pot + 2 * Rz) - Rz);
      s.actions.push({ id: 'raise', label: Rz >= behind ? `All-in $${Rz}` : `Raise to $${Rz}` });
    }
    return s;
  }
  function gradeDecision(s, a) {
    const p = PROFILES[s.vk];
    const g = evGrade(s, a);
    const call = s.bet, total = s.pot + 2 * s.bet;
    g.math = [
      ['Your hand', s.hc.label],
      ['Pot odds', `Call ${money(call)} to win ${money(s.pot + s.bet)} → need ${pctStr(s.need)} equity`],
      [`Equity vs ${p.name}'s ${s.allIn ? 'shoving' : 'betting'} range`, pctStr(s.eq)],
    ];
    if (s.implied) g.math.push(['Implied odds', `+${money(s.implied)} you expect to win on the river when you hit → need ${pctStr(s.needImplied)}`]);
    if (s.ev.raise !== undefined) g.math.push(['If you raise', `${p.name} folds ${pctStr(s.foldToRaise)}; your equity when called ${pctStr(s.eqWhenCalled)}`]);
    const top = Object.entries(s.byCls).filter(([, v]) => v > 0.005).sort((x, y) => y[1] - x[1]);
    g.range = top;
    const eqTxt = pctStr(s.eq), needTxt = pctStr(s.implied ? s.needImplied : s.need);
    if (g.bestId === 'fold') g.headline = `Fold. You need ${needTxt} and have about ${eqTxt} against what ${p.name} bets here.`;
    else if (g.bestId === 'call') g.headline = `Call. You need ${needTxt} and have about ${eqTxt}.`;
    else g.headline = s.eq > 0.55 ? `Raise for value. You are ahead of ${p.name}'s range (${eqTxt}).` : `Raise. ${p.name} folds ${pctStr(s.foldToRaise)} of the time, which makes a semi-bluff profitable.`;
    g.notes.push(`The pot odds formula: call ÷ (pot after you call). Here ${money(call)} ÷ ${money(total)} = ${pctStr(s.need)}.`);
    if (s.street === 'river') g.notes.push('On the river there are no more cards. Your hand is a bluff-catcher, so the question is simple: do they bluff often enough?');
    if (s.hc.cls === 'draw' && s.street === 'turn') g.notes.push('One card to come: roughly outs × 2 = your equity. Flush draw ≈ 9 outs ≈ 18–20%. Open-ended ≈ 8 outs ≈ 17%.');
    if (s.street === 'flop' && s.allIn) g.notes.push('All-in on the flop means you see both the turn and river: roughly outs × 4 = your equity.');
    g.notes.push(`${p.type} tendency: ${p.exploit}`);
    if (!g.good) {
      if (a === 'call') g.leak = 'Calling without the odds';
      else if (a === 'fold') g.leak = 'Folding with the odds';
      else if (a === 'raise') g.leak = s.eq < 0.45 ? 'Bluff-raising the wrong spot' : 'Raising instead of calling';
      if (g.bestId === 'raise' && a !== 'raise') g.leak = 'Missing value raises';
    }
    return g;
  }

  // ---------- Bet sizing: villain checks to you ----------
  function buildSizing(settings) {
    const vk = settings.villain === 'random' ? pick(VILLAIN_KEYS) : settings.villain;
    const p = PROFILES[vk];
    const street = pick(['flop', 'turn', 'river', 'river']);
    const target = pickWeighted(street === 'river'
      ? { strong: .4, medium: .3, weak: .1, air: .2 }
      : { strong: .35, medium: .25, draw: .2, weak: .08, air: .12 });
    const weightFn = k => 1 - p.bet[k];
    const g = genHeroAndBoard(street, target, p, p.pf, weightFn);
    const { pot, behind, lines } = potSetup(street, settings.stack);
    const eqs = E.comboEquities(g.hero, g.board, g.vr.combos, 150);
    const all = summarize(g.vr, eqs);
    const s = {
      kind: 'sizing', vk, street, hero: g.hero, board: g.board, hc: g.hc, pot, behind, eq: all.eq, byCls: all.byCls,
      stack: settings.stack,
      log: lines.concat([`${street[0].toUpperCase() + street.slice(1)}: ${p.name} checks to you.`]),
      prompt: `${p.name} checks. Pot is $${pot}, you have $${behind} behind. What do you do?`,
      ev: { check: all.eq * pot }, sizes: {},
      actions: [{ id: 'check', label: 'Check' }],
    };
    const opts = [['b33', 0.33, '⅓ pot'], ['b66', 0.66, '⅔ pot'], ['b100', 1, 'Pot']];
    const seen = new Set();
    for (const [id, frac, lab] of opts) {
      const S = Math.min(r1(pot * frac), behind);
      if (seen.has(S)) continue;
      seen.add(S);
      addSize(id, S, `${lab} $${S}`);
    }
    // Shoving is a realistic option on the river, or earlier when the stack is small compared to the pot.
    if (behind > pot * 1.1 && (street === 'river' || behind <= pot * 2)) addSize('allin', behind, `All-in $${behind}`);
    function addSize(id, S, label) {
      const frac = S / pot;
      const cont = summarize(g.vr, eqs, k => contProb(p, k, frac));
      const f = all.w ? 1 - cont.w / all.w : 0;
      s.ev[id] = f * pot + (1 - f) * (cont.eq * (pot + 2 * S) - S);
      s.sizes[id] = { S, f, eqC: cont.eq };
      s.actions.push({ id, label });
    }
    return s;
  }
  function gradeSizing(s, a) {
    const p = PROFILES[s.vk];
    const g = evGrade(s, a);
    g.math = [['Your hand', s.hc.label], [`Equity vs ${p.name}'s checking range`, pctStr(s.eq)]];
    if (a !== 'check' && s.sizes[a]) {
      const z = s.sizes[a];
      g.math.push(['Your bet', `${money(z.S)}: ${p.name} folds ${pctStr(z.f)}, your equity when called ${pctStr(z.eqC)}`]);
      g.math.push(['Break-even as a pure bluff', `${money(z.S)} ÷ (${money(s.pot)} + ${money(z.S)}) = ${pctStr(z.S / (s.pot + z.S))} folds needed`]);
    }
    const b = g.bestId;
    const bestLabel = s.actions.find(x => x.id === b).label;
    g.range = Object.entries(s.byCls).filter(([, v]) => v > 0.005).sort((x, y) => y[1] - x[1]);
    const strongish = s.eq >= 0.55;
    if (b === 'check') g.headline = strongish ? `Check. Betting only gets called by better hands here.` : `Check. ${p.name} won't fold enough and calls with better.`;
    else g.headline = strongish ? `Bet for value: ${bestLabel}.` : `Bet as a bluff: ${bestLabel}. ${p.name} folds enough.`;
    if (s.vk === 'station') g.notes.push('Against a calling station: bet big with good hands (they call anyway) and never bluff.');
    if (s.vk === 'nit') g.notes.push('Against a nit: they fold most hands that missed, so small bets win the pot cheaply. When they call or raise, they usually have it.');
    if (s.vk === 'maniac') g.notes.push('Against a maniac: they checked, so they are often weak, but they call wide. Value bet your good hands and skip fancy bluffs.');
    g.notes.push('Why bet? Either worse hands call (value) or better hands fold (bluff). If neither happens, check.');
    if (s.street !== 'river' && a === 'check') g.notes.push('Checking assumes you get to showdown with your current equity. That is a simplification, but it shows how much betting adds.');
    if (!g.good) {
      if (a === 'check') g.leak = strongish ? 'Missing value bets' : 'Missing good bluffs';
      else if (b === 'check') g.leak = strongish ? 'Betting too thin' : 'Bluffing the wrong player';
      else g.leak = 'Bet sizing';
    }
    return g;
  }

  function evGrade(s, a) {
    const ids = s.actions.map(x => x.id);
    let bestId = ids[0];
    for (const id of ids) if (s.ev[id] > s.ev[bestId]) bestId = id;
    const bestEV = s.ev[bestId];
    const scale = s.pot + (s.bet || 0);
    const diff = bestEV - s.ev[a];
    const g = { best: [bestId], ok: [], notes: [], bestId, evTable: ids.map(id => [s.actions.find(x => x.id === id).label, s.ev[id], id]) };
    for (const id of ids) {
      const d = bestEV - s.ev[id];
      if (id !== bestId && d <= Math.max(2, 0.04 * scale)) g.best.push(id);
      else if (id !== bestId && d <= 0.15 * scale) g.ok.push(id);
    }
    const out = finish(g, a);
    out.evLoss = Math.max(0, diff);
    return out;
  }

  function finish(g, a) {
    g.choice = a;
    g.grade = g.best.includes(a) ? 'best' : g.ok.includes(a) ? 'ok' : 'mistake';
    g.points = g.grade === 'best' ? 10 : g.grade === 'ok' ? 6 : 0;
    g.good = g.grade !== 'mistake';
    if (g.good && g.grade === 'best') g.leak = null;
    return g;
  }

  function build(kind, settings) {
    if (kind === 'mixed') kind = pickWeighted({ open: 2, facing: 3, decision: 4, sizing: 3 });
    if (kind === 'preflop') kind = pick(['open', 'facing', 'facing']);
    return kind === 'open' ? buildOpen(settings) : kind === 'facing' ? buildFacing(settings)
      : kind === 'decision' ? buildDecision(settings) : buildSizing(settings);
  }
  function grade(s, a) {
    return s.kind === 'open' ? gradeOpen(s, a) : s.kind === 'facing' ? gradeFacing(s, a)
      : s.kind === 'decision' ? gradeDecision(s, a) : gradeSizing(s, a);
  }

  // ---------- Pot-odds quiz ----------
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function pctOptions(correct, distract) {
    const set = new Set([Math.round(correct * 100)]);
    for (const d of distract) { const v = Math.round(d * 100); if (v > 0 && v < 100) set.add(v); }
    let k = 1;
    while (set.size < 4) { const v = Math.round(correct * 100) + (k % 2 ? 1 : -1) * (6 + 3 * k); k++; if (v > 0 && v < 100) set.add(v); }
    const opts = shuffle([...set].slice(0, 4));
    return { options: opts.map(v => v + '%'), answer: opts.indexOf(Math.round(correct * 100)) };
  }
  const QUIZ = {
    need() {
      const P = pick([20, 30, 40, 50, 60, 80, 100, 120, 150, 200]);
      const frac = pick([0.25, 0.33, 0.5, 0.66, 0.75, 1, 1.5, 2]);
      const B = r1(P * frac);
      const need = B / (P + 2 * B);
      const o = pctOptions(need, [B / (P + B), B / P]);
      return {
        q: `The pot is $${P}. Your opponent bets $${B}. What equity do you need to call?`,
        ...o,
        explain: `Call ÷ (pot after you call) = $${B} ÷ ($${P} + $${B} + $${B}) = $${B} ÷ $${P + 2 * B} = ${pctStr(need)}. A common mistake is dividing by the pot before their bet, which gives ${pctStr(B / (P + B))}.`,
      };
    },
    outs() {
      const [outs, name] = pick([[4, 'a gutshot'], [8, 'an open-ended straight draw'], [9, 'a flush draw'], [12, 'a flush draw + gutshot'], [15, 'a flush draw + open-ended straight draw'], [6, 'two overcards'], [2, 'a pocket pair (set outs)']]);
      const two = Math.random() < 0.5;
      const eq = two ? 1 - ((47 - outs) / 47) * ((46 - outs) / 46) : outs / 46;
      const o = pctOptions(eq, [two ? outs / 46 : 1 - ((47 - outs) / 47) * ((46 - outs) / 46), outs / 100]);
      return {
        q: `You have ${name} (${outs} outs). ${two ? 'You are all-in on the flop, so you see the turn and the river.' : 'You are on the turn with one card to come.'} Roughly how often do you hit?`,
        ...o,
        explain: `${two ? 'Two cards to come: outs × 4' : 'One card to come: outs × 2'} ≈ ${outs * (two ? 4 : 2)}%. Exact: ${pctStr(eq)}.${two && outs > 8 ? ' With lots of outs, the ×4 rule runs a little high; subtract (outs − 8).' : ''}`,
      };
    },
    callfold() {
      const [outs, name] = pick([[9, 'flush draw'], [8, 'open-ended straight draw'], [4, 'gutshot'], [12, 'flush draw + gutshot']]);
      const eq = outs / 46;
      const P = pick([40, 60, 80, 100, 120]);
      const B = r1(P * pick([0.33, 0.5, 0.66, 1, 1.5]));
      const need = B / (P + 2 * B);
      const call = eq >= need;
      return {
        q: `Turn. You have a ${name} (${outs} outs, about ${pctStr(eq)} to hit on the river). Pot is $${P}, villain bets $${B}. Ignoring implied odds, call or fold?`,
        options: ['Call', 'Fold'], answer: call ? 0 : 1,
        explain: `You need $${B} ÷ $${P + 2 * B} = ${pctStr(need)}. You have ${pctStr(eq)}. ${call ? 'Enough: call.' : 'Not enough: fold, unless you are confident of getting paid a lot more when you hit (implied odds).'}`,
      };
    },
    bluff() {
      const P = pick([30, 50, 80, 100, 150]);
      const frac = pick([0.33, 0.5, 0.66, 1, 1.5]);
      const B = r1(P * frac);
      const need = B / (P + B);
      const o = pctOptions(need, [B / (P + 2 * B), frac]);
      return {
        q: `River. You missed and want to bluff $${B} into $${P}. How often must villain fold for the bluff to break even?`,
        ...o,
        explain: `Risk ÷ (risk + reward) = $${B} ÷ ($${B} + $${P}) = ${pctStr(need)}. Calling stations fold far less than that, so don't bluff them.`,
      };
    },
    count() {
      for (let t = 0; t < 200; t++) {
        const hero = dealHand([...keysOf('A2s+, K9s+, QTs+, JTs, T9s, 98s, 87s, 76s, 65s')]);
        const board = dealBoard(hero, 4);
        const hc = E.classify(hero, board);
        if (hc.cls !== 'draw') continue;
        const top = Math.max(...board.map(E.rankOf));
        const vCombos = combos('AA-22, AKo, AQo, AJo, ATo, KQo, KJo, QJo').filter(c => {
          const r = [E.rankOf(c[0]), E.rankOf(c[1])];
          return !hero.concat(board).includes(c[0]) && !hero.concat(board).includes(c[1]) && r.includes(top) && E.classify(c, board).label.startsWith('Top pair');
        });
        if (!vCombos.length) continue;
        const v = pick(vCombos);
        if (E.evaluate(hero.concat(board)) > E.evaluate(v.concat(board))) continue;
        const outs = E.riverOuts(hero, v, board);
        const n = outs.length;
        const set = new Set([n]);
        for (const d of [n + 2, n - 2, n + 4, n - 3, n + 6]) if (d > 0) set.add(d);
        const opts = shuffle([...set].slice(0, 4));
        return {
          q: `You hold ${hero.map(E.cardStr).join(' ')} (${hc.label.toLowerCase()}). Villain shows ${v.map(E.cardStr).join(' ')}. How many river cards win for you?`,
          cards: { hero, board, villain: v },
          options: opts.map(String), answer: opts.indexOf(n),
          explain: `${n} outs: ${outs.map(E.cardStr).join(' ')}. That's ${pctStr(n / 44)} with 44 unseen cards. Cards that complete your draw but also improve villain (e.g. pairing the board for trips or two pair) are not real outs.`,
        };
      }
      return QUIZ.need();
    },
  };
  function quizQuestion() {
    const k = pickWeighted({ need: 3, outs: 2, callfold: 3, bluff: 2, count: 2 });
    return QUIZ[k]();
  }

  const api = { PROFILES, VILLAIN_KEYS, CLASS_NAMES, OPEN, POS, STRADDLE, STRADDLE_NAMES, build, grade, quizQuestion, QUIZ, OPEN_KEYS, PREMIUM, pctStr, money };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PokerCoach = api;
})(typeof window !== 'undefined' ? window : globalThis);
