/* Pokertings Course: a beginner curriculum, from hand rankings to pot odds and bankroll.
   Each lesson has short reading pages and a practice round that unlocks the next lesson. */
(function () {
  'use strict';
  const E = window.PokerEngine, C = window.PokerCoach;
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const rnd = n => (Math.random() * n) | 0;
  const pick = a => a[rnd(a.length)];
  const shuffle = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pct = x => Math.round(x * 100) + '%';
  const pc = s => s.split(' ').map(E.parseCard);

  // ---------- Saved progress ----------
  const KEY = 'pokertings.course.v1';
  let P = { done: {}, plan: null };
  try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.done) P = Object.assign(P, s); } catch (e) { /* in memory */ }
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(P)); } catch (e) { /* ignore */ } };

  // ---------- Card and table pictures ----------
  const SUITCLS = ['s', 'h', 'd', 'c'];
  function card(c, size) {
    const r = E.rankChar(E.rankOf(c)), s = E.suitOf(c);
    return `<span class="card ${SUITCLS[s]} ${size || 'sm'}" aria-label="${r}${'shdc'[s]}"><b>${r === 'T' ? '10' : r}</b><i>${E.SUIT_SYM[s]}</i></span>`;
  }
  const cards = (cs, size) => `<span class="cardrow">${cs.map(c => card(c, size)).join('')}</span>`;

  const SEATS = ['BTN', 'SB', 'BB', 'UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO'];
  function seatMap(highlight, note) {
    const cx = 170, cy = 105, rx = 138, ry = 74;
    let g = '';
    SEATS.forEach((s, i) => {
      const a = (Math.PI / 180) * (70 + i * 40);
      const x = cx + rx * Math.cos(a), y = cy + ry * Math.sin(a);
      const on = highlight && highlight.includes(s);
      g += `<g><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="21" class="${on ? 'seat on' : 'seat'}"/>` +
        `<text x="${x.toFixed(1)}" y="${(y + 4).toFixed(1)}" text-anchor="middle" class="${on ? 'seatt on' : 'seatt'}">${s}</text></g>`;
      if (s === 'BTN') g += `<circle cx="${(x - 30).toFixed(1)}" cy="${(y - 14).toFixed(1)}" r="9" class="dbtn"/><text x="${(x - 30).toFixed(1)}" y="${(y - 10.5).toFixed(1)}" text-anchor="middle" class="dbtnt">D</text>`;
    });
    return `<figure class="seatmap"><svg viewBox="0 0 340 210" role="img" aria-label="9-seat poker table">
      <ellipse cx="${cx}" cy="${cy}" rx="112" ry="52" class="tablefelt"/>
      <text x="${cx}" y="${cy + 4}" text-anchor="middle" class="tablet">action moves clockwise →</text>${g}</svg>
      ${note ? `<figcaption>${note}</figcaption>` : ''}</figure>`;
  }

  // Builds a random 5-card example of a hand category (0 = high card … 9 = royal flush).
  function exampleHand(cat) {
    const s = rnd(4);
    if (cat === 9) return [14, 13, 12, 11, 10].map(r => E.card(r, s));
    if (cat === 8) { const lo = 2 + rnd(8); return [4, 3, 2, 1, 0].map(k => E.card(lo + k, s)); }
    if (cat === 4) {
      for (;;) {
        const lo = 2 + rnd(9); const h = [4, 3, 2, 1, 0].map(k => E.card(lo + k, rnd(4)));
        if (E.category(E.evaluate(h)) === 4) return h;
      }
    }
    if (cat === 5) {
      for (;;) {
        const rs = shuffle([2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]).slice(0, 5).sort((a, b) => b - a);
        const h = rs.map(r => E.card(r, s));
        if (E.category(E.evaluate(h)) === 5) return h;
      }
    }
    if (cat === 7) { const r = 2 + rnd(13); let k; do { k = 2 + rnd(13); } while (k === r); return [0, 1, 2, 3].map(x => E.card(r, x)).concat([E.card(k, rnd(4))]); }
    if (cat === 6) { const r = 2 + rnd(13); let k; do { k = 2 + rnd(13); } while (k === r); const ss = shuffle([0, 1, 2, 3]); return [E.card(r, ss[0]), E.card(r, ss[1]), E.card(r, ss[2]), E.card(k, ss[0]), E.card(k, ss[3])]; }
    for (;;) {
      const d = shuffle([...Array(52).keys()]).slice(0, 5);
      if (E.category(E.evaluate(d)) === cat) return d.sort((a, b) => E.rankOf(b) - E.rankOf(a));
    }
  }
  const CAT10 = ['High card', 'One pair', 'Two pair', 'Three of a kind', 'Straight', 'Flush', 'Full house', 'Four of a kind', 'Straight flush', 'Royal flush'];
  const ODDS7 = ['17.4%', '43.8%', '23.5%', '4.8%', '4.6%', '3.0%', '2.6%', '0.17%', '0.03%', '0.003%'];
  const cat10 = score => { const c = E.category(score); return c === 8 && E.describe(score) === 'Royal flush' ? 9 : c; };
  function best5(seven) {
    let best = -1, hand = null;
    for (let a = 0; a < 7; a++) for (let b = a + 1; b < 7; b++) {
      const h = seven.filter((_, i) => i !== a && i !== b);
      const s = E.evaluate(h);
      if (s > best) { best = s; hand = h; }
    }
    return hand.sort((x, y) => E.rankOf(y) - E.rankOf(x));
  }
  function deal(n, dead) {
    const out = [];
    while (out.length < n) { const c = rnd(52); if (!out.includes(c) && !(dead || []).includes(c)) out.push(c); }
    return out;
  }

  // ---------- Question generators ----------
  // Each returns { q, visual?, options, answer, explain }. `answer` is the index of the right option.
  function mcq(q, right, wrong, explain, visual) {
    const opts = shuffle([right].concat(wrong));
    return { q, visual, options: opts, answer: opts.indexOf(right), explain };
  }
  function fromPool(pool) {
    let used = [];
    return () => {
      if (used.length >= pool.length) used = [];
      let i; do { i = rnd(pool.length); } while (used.includes(i));
      used.push(i);
      const [q, right, wrong, explain] = pool[i];
      return mcq(q, right, wrong, explain);
    };
  }

  const G = {};
  G.rankOrder = () => {
    let a, b;
    do { a = rnd(10); b = rnd(10); } while (a === b);
    if (Math.random() < 0.55) {
      const ha = exampleHand(a), hb = exampleHand(b);
      const q = mcq('Which five cards make the stronger hand?', a > b ? 'Hand A' : 'Hand B', [a > b ? 'Hand B' : 'Hand A'],
        `Hand A is <b>${CAT10[a].toLowerCase()}</b>. Hand B is <b>${CAT10[b].toLowerCase()}</b>. ${CAT10[Math.max(a, b)]} ranks higher.`,
        `<div class="vs"><div><span class="small">Hand A</span>${cards(ha)}</div><div><span class="small">Hand B</span>${cards(hb)}</div></div>`);
      q.options = ['Hand A', 'Hand B']; q.answer = a > b ? 0 : 1;
      return q;
    }
    return mcq(`Which is stronger: ${CAT10[a].toLowerCase()} or ${CAT10[b].toLowerCase()}?`, CAT10[Math.max(a, b)], [CAT10[Math.min(a, b)]],
      `${CAT10[Math.max(a, b)]} ranks higher. The rarer the hand, the stronger it is: you make ${CAT10[Math.max(a, b)].toLowerCase()} by the river about ${ODDS7[Math.max(a, b)]} of the time, and ${CAT10[Math.min(a, b)].toLowerCase()} about ${ODDS7[Math.min(a, b)]}.`);
  };
  G.nameIt = () => {
    const cat = Math.random() < 0.3 ? rnd(4) : 3 + rnd(7);
    const h = shuffle(exampleHand(cat));
    const wrong = shuffle(CAT10.filter((_, i) => i !== cat && Math.abs(i - cat) <= 3)).slice(0, 3);
    return mcq('What is this hand called?', CAT10[cat], wrong, `It's <b>${E.describe(E.evaluate(h)).toLowerCase()}</b>.`, cards(h, ''));
  };
  G.bestHand = () => {
    let hole, board, sc;
    for (let t = 0; t < 40; t++) {
      [hole, board] = [deal(2), null]; board = deal(5, hole);
      sc = E.evaluate(hole.concat(board));
      if (E.category(sc) >= 1 || t > 30) break;
    }
    const cat = cat10(sc);
    const best = best5(hole.concat(board));
    const playsBoard = E.evaluate(board) === sc;
    const wrong = shuffle(CAT10.filter((_, i) => i !== cat && Math.abs(i - cat) <= 3)).slice(0, 3);
    return mcq('Using your two cards and the five on the board, what is your best hand?', CAT10[cat], wrong,
      `<b>${esc(E.describe(sc))}</b>. Your best five cards: ${cards(best)}${playsBoard ? '<br>Neither of your cards improves the board, so you are "playing the board". Everyone still in the hand has at least this.' : ''}`,
      `<div class="vs"><div><span class="small">You</span>${cards(hole)}</div><div><span class="small">Board</span>${cards(board)}</div></div>`);
  };
  G.whichWins = () => {
    let a, b, board, sa, sb;
    for (let t = 0; t < 40; t++) {
      a = deal(2); b = deal(2, a); board = deal(5, a.concat(b));
      sa = E.evaluate(a.concat(board)); sb = E.evaluate(b.concat(board));
      if (E.category(sa) === E.category(sb) || Math.random() < 0.4) break;
    }
    const right = sa > sb ? 'You' : sb > sa ? 'Opponent' : 'Split pot';
    let why = `You have <b>${esc(E.describe(sa).toLowerCase())}</b>. Opponent has <b>${esc(E.describe(sb).toLowerCase())}</b>.`;
    if (sa === sb) why += ' The best five cards are equal, so the pot is split.';
    else if (E.category(sa) === E.category(sb)) why += ' Same type of hand, so the higher cards decide. Compare the best five cards one by one: that extra card is the "kicker".';
    why += `<div class="vs"><div><span class="small">Your best five</span>${cards(best5(a.concat(board)))}</div><div><span class="small">Opponent's best five</span>${cards(best5(b.concat(board)))}</div></div>`;
    const q = mcq('Showdown. Who wins?', right, [], why,
      `<div class="vs"><div><span class="small">You</span>${cards(a)}</div><div><span class="small">Opponent</span>${cards(b)}</div><div><span class="small">Board</span>${cards(board)}</div></div>`);
    q.options = ['You', 'Opponent', 'Split pot']; q.answer = q.options.indexOf(right);
    return q;
  };
  G.rules = fromPool([
    ['How many cards are dealt on the flop?', '3', ['1', '2', '5'], 'The flop is three shared cards. Then one on the turn and one on the river: five in total.'],
    ['What order do the betting rounds come in?', 'Preflop, flop, turn, river', ['Flop, preflop, river, turn', 'Preflop, turn, flop, river', 'Flop, turn, river, showdown, preflop'], 'Preflop (just your two cards), then the flop (3 cards), the turn (4th card) and the river (5th card). Then showdown if two or more players are left.'],
    ['Nobody has bet yet on the turn. What can you do?', 'Check or bet', ['Call or raise', 'Only fold', 'Check or call'], 'With no bet in front of you, you can check (pass) or bet. You can only call or raise once someone has bet.'],
    ['Someone bets $20. Which of these can you NOT do?', 'Check', ['Fold', 'Call $20', 'Raise'], 'Once there is a bet, checking is no longer allowed. You must fold, call, or raise.'],
    ['What are the blinds for?', 'They are forced bets, so every pot starts with something to win', ['They are a fee paid to the host', 'They decide who deals', 'They are a penalty for folding'], 'Without blinds, everyone could wait for aces. The $1 small blind and $1 big blind make every hand worth fighting for.'],
    ['What does it mean to "limp"?', 'Just calling the big blind before the flop instead of raising', ['Folding after the flop', 'Betting the minimum on the river', 'Going all-in'], 'Limping means entering the pot for the minimum. It is a weak habit: you invite raises and you never win the pot right away.'],
    ['What happens if everyone folds to your bet?', 'You win the pot without showing your cards', ['The hand is replayed', 'You must show your cards', 'The pot is split'], 'Most pots are won this way. You do not need the best hand if everyone else gives up.'],
    ['What is a straddle?', 'An optional extra blind, usually twice the big blind, posted before the cards are dealt', ['A type of bluff', 'A split pot', 'Raising twice in a row'], 'In your game the straddle is $2. The straddler acts last before the flop.'],
    ['Board: A♠ A♦ K♣ K♥ Q♠. You hold 7♥ 2♣, your opponent holds 3♣ 4♦. Who wins?', 'Split pot: you both play the board', ['You', 'Opponent', 'Nobody, the hand is dead'], 'The best five cards for both of you are A-A-K-K-Q, all on the board. Your own cards don\'t play, so the pot is split.'],
    ['What is "all-in"?', 'Betting every chip you have in front of you', ['Everyone at the table calling', 'A hand that can\'t lose', 'Showing both your cards'], 'All-in means you have no more chips to bet. You can only win as much from each player as you put in.'],
  ]);
  const POS_POOL = [
    ['With no straddle, who acts first before the flop?', 'UTG (the player to the left of the big blind)', ['The small blind', 'The button', 'The big blind'], 'Preflop action starts to the left of the big blind. UTG means "under the gun": first to act, with the whole table behind.'],
    ['After the flop, who acts last?', 'The button (BTN)', ['UTG', 'The big blind', 'Whoever raised preflop'], 'After the flop, action starts at the small blind and ends with the button. That is why the button is the best seat.'],
    ['After the flop, who acts first (if still in the hand)?', 'The small blind', ['The button', 'UTG', 'The big blind'], 'From the flop onwards, action starts at the first player left of the button still in the hand, often the small blind.'],
    ['Why is acting last an advantage?', 'You see what everyone else does before you decide', ['You get dealt better cards', 'You pay less in blinds', 'You can\'t be raised'], 'Information is money. When others check to you, you can bet or take a free card. When they bet, you know where you stand.'],
    ['Which seats are "late position"?', 'The cutoff (CO) and the button (BTN)', ['UTG and UTG+1', 'The blinds', 'MP and HJ'], 'The cutoff and button act last after the flop. You can play the most hands there.'],
    ['From which seat should you play the fewest hands?', 'UTG', ['The button', 'The cutoff', 'The hijack'], 'UTG has eight players left to act behind. Someone often has a strong hand, and you will be out of position after the flop.'],
    ['Why are the blinds a bad seat even though you already have money in?', 'You act first after the flop, with no information', ['You can\'t raise from the blinds', 'Blind money is refunded', 'You must call every raise'], 'The blinds are out of position for the whole hand. Don\'t defend them with weak hands just because you "already paid".'],
    ['With a Mississippi (button) straddle, who acts last before the flop?', 'The button', ['UTG', 'The big blind', 'The small blind'], 'The straddler always acts last preflop. On the button, they also act last after the flop.'],
  ];
  G.positions = (() => {
    const pool = fromPool(POS_POOL);
    return () => {
      if (Math.random() < 0.4) {
        const s = pick(SEATS);
        const wrong = shuffle(SEATS.filter(x => x !== s)).slice(0, 3);
        const q = mcq('What is the highlighted seat called?', s, wrong,
          `That's the <b>${s}</b>. From the button, going clockwise: SB, BB, UTG, UTG+1, UTG+2, MP, HJ (hijack), CO (cutoff), then back to BTN.`, seatMap([s]));
        return q;
      }
      return pool();
    };
  })();
  G.notation = () => {
    const h = deal(2);
    const k = E.handKey(h[0], h[1]);
    const r1 = k[0], r2 = k[1];
    let wrong;
    if (r1 === r2) wrong = [`${r1}${r2}s`, `${r1}${r2}o`, `${r1}x`];
    else wrong = [k[2] === 's' ? `${r1}${r2}o` : `${r1}${r2}s`, `${r2}${r1}${k[2]}`, `${r1}${r1}`];
    const expl = r1 === r2 ? `A pair is written with the rank twice: <b>${k}</b>. There's no "s" or "o" because a pair can never be suited.`
      : `Highest card first, then <b>s</b> for suited (same suit) or <b>o</b> for offsuit: <b>${k}</b>.`;
    return mcq('How is this starting hand written?', k, wrong, expl, cards(h, ''));
  };

  // Starting hand tiers used in the lessons.
  const TIER = {
    premium: E.parseRange('QQ+, AKs, AKo'),
    strong: E.parseRange('TT-JJ, AQs, AQo, AJs, KQs'),
  };
  function tierOf(k) {
    if (TIER.premium.has(k)) return 'Premium';
    if (TIER.strong.has(k)) return 'Strong';
    if (C.OPEN_KEYS.BTN.has(k)) return 'Playable in the right seat';
    return 'Trash';
  }
  const BTN_KEYS = [...C.OPEN_KEYS.BTN];
  G.openFold = () => {
    const seat = pick(['UTG', 'UTG+1', 'UTG+2', 'MP', 'HJ', 'CO', 'BTN', 'SB']);
    let h;
    if (Math.random() < 0.55) h = deal(2);
    else { const cs = E.combosForKey(pick(BTN_KEYS)); h = pick(cs); }
    const k = E.handKey(h[0], h[1]);
    const play = C.OPEN_KEYS[seat].has(k);
    const tier = tierOf(k);
    const q = mcq(`Everyone folds to you in the <b>${seat}</b>. Raise or fold?`, play ? 'Raise' : 'Fold', [play ? 'Fold' : 'Raise'],
      `${esc(k)} is <b>${tier.toLowerCase()}</b>. ${play ? `It is in the ${seat} raising range, so raise to about $15–18.` : tier === 'Trash' ? 'Trash hands are folds from every seat.' : `It is not strong enough from the ${seat}${['CO', 'BTN'].includes(seat) ? '' : ', where many players are still to act behind you'}. Fold.`}<br><span class="small">${seat} range: ${esc(C.OPEN[seat])}</span>`,
      `${seatMap([seat])}<div class="center">${cards(h, '')}</div>`);
    q.options = ['Raise', 'Fold']; q.answer = play ? 0 : 1;
    return q;
  };

  const SIM = { stack: 200, villain: 'random', straddle: 'none' };
  // Wraps a trainer spot as a course question. Best or acceptable answers both count as correct.
  function spotQuestion(kind, simplify) {
    const s = C.build(kind, SIM);
    const p = s.vk ? C.PROFILES[s.vk] : null;
    let actions = s.actions;
    if (simplify) actions = simplify(s);
    const visual = `<div class="mini-felt">
      ${p ? `<div class="small on-felt">${esc(p.name)} · ${esc(p.type)}: ${esc(p.blurb)}</div>` : ''}
      <div class="small on-felt">${s.log.map(esc).join(' · ')}</div>
      ${s.board.length ? `<div>${cards(s.board, '')}</div>` : ''}
      <div class="row"><span class="small on-felt">You${s.hc ? ` · ${esc(s.hc.label)}` : ''}</span>${cards(s.hero, '')}</div></div>`;
    return {
      q: esc(s.prompt), visual, options: actions.map(a => a.label), ids: actions.map(a => a.id), spot: s,
      check(i) {
        const g = C.grade(s, actions[i].id);
        const expl = [`<b>${esc(g.headline)}</b>`];
        if (g.math) expl.push(g.math.slice(0, 4).map(([k, v]) => `${esc(k)}: <span class="mono">${esc(v)}</span>`).join('<br>'));
        if (g.notes && g.notes[0]) expl.push(esc(g.notes[0]));
        if (g.grade === 'ok') expl.unshift('<span class="okline">Acceptable, but not the best choice.</span>');
        const right = actions.findIndex(a => g.best.includes(a.id));
        return { correct: g.good, right, explain: expl.join('<br><br>') };
      },
    };
  }
  G.facing = () => spotQuestion('facing');
  G.callFold = () => spotQuestion('decision');
  G.betCheck = () => spotQuestion('sizing', s => {
    // Offer check or the best-performing bet size so beginners make one decision: bet or not.
    const bets = s.actions.filter(a => a.id !== 'check');
    const top = bets.reduce((m, a) => (s.ev[a.id] > s.ev[m.id] ? a : m), bets[0]);
    return [s.actions[0], { id: top.id, label: `Bet (${top.label.toLowerCase()})` }];
  });
  const CLS_TEXT = { strong: 'Strong made hand', draw: 'Drawing hand', medium: 'Medium pair', weak: 'Weak pair or weak draw', air: 'Nothing yet' };
  const CLS_WHY = {
    strong: 'Top pair with a good kicker or better. You are usually ahead: bet to get paid.',
    draw: 'Four cards to a flush or an open-ended straight. You are probably behind now, but you have lots of outs.',
    medium: 'A pair that isn\'t top pair, or top pair with a weak kicker. It can win, but don\'t build a big pot with it.',
    weak: 'Bottom pair, a small pocket pair, or a gutshot. Usually not worth putting money in against a bet.',
    air: 'No pair and no real draw. Usually check and let it go, unless your opponent folds a lot.',
  };
  G.flopClass = () => {
    const target = pick(['strong', 'draw', 'medium', 'weak', 'air']);
    let h, b, c;
    for (let t = 0; t < 300; t++) {
      h = pick(E.combosForKey(pick(BTN_KEYS)));
      b = deal(3, h);
      if (new Set(b.map(E.rankOf)).size < 3) continue;
      c = E.classify(h, b);
      if (c.cls === target) break;
    }
    const opts = ['strong', 'draw', 'medium', 'weak', 'air'];
    return {
      q: 'What have you got on this flop?',
      visual: `<div class="vs"><div><span class="small">You</span>${cards(h, '')}</div><div><span class="small">Flop</span>${cards(b, '')}</div></div>`,
      options: opts.map(k => CLS_TEXT[k]), answer: opts.indexOf(c.cls),
      explain: `<b>${esc(c.label)}</b>. ${CLS_WHY[c.cls]}`,
    };
  };
  G.outs = () => { const q = C.QUIZ.outs(); return { q: esc(q.q), options: q.options, answer: q.answer, explain: esc(q.explain) }; };
  G.countOuts = () => {
    const q = C.QUIZ.count();
    const v = q.cards ? `<div class="vs"><div><span class="small">You</span>${cards(q.cards.hero, '')}</div><div><span class="small">Board</span>${cards(q.cards.board, '')}</div><div><span class="small">Opponent</span>${cards(q.cards.villain, '')}</div></div>` : '';
    return { q: esc(q.q), visual: v, options: q.options, answer: q.answer, explain: esc(q.explain) };
  };
  G.need = () => { const q = C.QUIZ.need(); return { q: esc(q.q), options: q.options, answer: q.answer, explain: esc(q.explain) }; };
  G.callfoldMath = () => { const q = C.QUIZ.callfold(); return { q: esc(q.q), options: q.options, answer: q.answer, explain: esc(q.explain) }; };
  G.bluffMath = () => { const q = C.QUIZ.bluff(); return { q: esc(q.q), options: q.options, answer: q.answer, explain: esc(q.explain) }; };
  const TYPES = ['Nit', 'TAG', 'LAG', 'Calling station', 'Maniac'];
  G.typeId = (() => {
    const pool = [
      ['Folds for an hour, then raises to $30 from early position.', 'Nit'],
      ['Calls your $18 raise with K4 offsuit, then calls every bet to the river with bottom pair.', 'Calling station'],
      ['Raises to $30 almost every hand and has rebought three times tonight.', 'Maniac'],
      ['Raises lots of hands, bets most flops, but folds when you raise back.', 'LAG'],
      ['Raises about one hand in five, bets when they hit, and usually shows down good hands.', 'TAG'],
      ['Rarely bets, but called three streets and showed ace-high.', 'Calling station'],
      ['Only ever shows down aces, kings and sets.', 'Nit'],
      ['Moves all-in on the flop with a gutshot.', 'Maniac'],
      ['Opens wide on the button and tight from early seats. Hard to push around.', 'TAG'],
      ['Re-raises often before the flop and bets again when a scary card comes.', 'LAG'],
      ['Limps almost every hand and never folds a pair.', 'Calling station'],
      ['Folds to nearly every re-raise and never bluffs the river.', 'Nit'],
    ];
    const p = fromPool(pool.map(([d, t]) => [`Which player type is this? "${d}"`, t, TYPES.filter(x => x !== t), '']));
    return () => {
      const q = p();
      const t = q.options[q.answer];
      const prof = Object.values(C.PROFILES).find(x => x.type === t);
      q.explain = `<b>${t}</b>: ${esc(prof.blurb)}<br>How to beat them: ${esc(prof.exploit)}`;
      return q;
    };
  })();
  G.bankroll = fromPool([
    ['With a $200 buy-in, how many buy-ins is a $2,300 loss?', 'About 11 to 12', ['About 2', 'About 5', 'About 20'], '$2,300 ÷ $200 ≈ 11.5 buy-ins. Even strong players rarely lose more than 3 buy-ins in a night at $1/$1. Losses this size mean decisions are the problem, and decisions can be fixed.'],
    ['What is a stop-loss?', 'A loss limit you set before the game. When you hit it, you leave.', ['A bet that stops others from calling', 'The house rule for maximum rebuys', 'Folding every hand for a while'], 'The decision is made while you are calm, before you sit down. At the table you just follow it.'],
    ['You are down 3 buy-ins and feel the cards are "about to turn". Best move?', 'Leave. Past hands don\'t change future cards.', ['Rebuy for double to win it back faster', 'Play every hand until you hit something', 'Switch to bigger bluffs'], 'Cards have no memory. The feeling that you are "due" is exactly how small losses become huge ones.'],
    ['Which money should you play poker with?', 'Money you can afford to lose without it touching bills or savings', ['Whatever is in your wallet that night', 'Money you plan to win back tomorrow', 'Credit, as long as you pay it off'], 'Poker money should be entertainment money. If losing it hurts your life, the stakes are too high.'],
    ['How much should you bring to a session?', 'A set amount decided in advance, and no ATM or transfers after that', ['As much as possible, in case of a good game', 'Enough to rebuy until you are even', 'It doesn\'t matter if you play well'], 'Limiting the cash you bring is the simplest stop-loss there is.'],
    ['Why write down every session\'s result?', 'Memory remembers the wins and blurs the losses. Numbers don\'t.', ['So others can see how you did', 'It changes your luck', 'The house requires it'], 'Tracking buy-in, cash-out, hours and VPIP shows your real trend, not the one you feel.'],
  ]);
  G.tilt = fromPool([
    ['You just lost a big pot to a lucky river. Next hand you get K7 offsuit UTG. What do you do?', 'Fold, same as any other time', ['Raise: you need to win it back', 'Call to see a cheap flop', 'Go all-in to show you are not scared'], 'The previous hand has nothing to do with this one. K7o UTG is a fold every time.'],
    ['Which of these is a sign of tilt?', 'Wanting to win it all back tonight', ['Folding a weak hand', 'Taking a break after a bad beat', 'Sticking to your starting hands'], 'Chasing losses, playing faster, calling to "keep them honest": all signs your emotions are playing, not you.'],
    ['What is the best thing to do when you feel tilt?', 'Stand up and walk away for 10 minutes, or end the session', ['Play more hands to get it out of your system', 'Raise the stakes', 'Have another drink and relax'], 'Physically leaving the table breaks the loop. There is always another game.'],
    ['A friend says "you\'re due for a win". Are you?', 'No. Every hand is independent.', ['Yes, luck evens out within the night', 'Yes, after 3 losing sessions', 'Only if you play more hands'], 'Luck does even out, but over thousands of hands, not one evening. Only good decisions give you an edge.'],
    ['What is a good goal for a session?', 'Make good decisions and stick to your plan', ['Win at least $500', 'Never fold the big blind', 'Win back last week\'s losses'], 'Results follow decisions over weeks and months. A night where you folded correctly and lost is a good night.'],
    ['You are playing more hands than usual and calling "just to see". What is happening?', 'Your VPIP is creeping up: tighten up or take a break', ['You are reading the table well', 'The cards are running hot', 'That is how you win at home games'], 'Use the live VPIP tracker. If it climbs past 30%, something is off.'],
  ]);

  // ---------- The curriculum ----------
  const PAGE = {};
  PAGE.basics = () => `
    <h3>Texas Hold'em in one minute</h3>
    <p>You get <b>two private cards</b>. Then <b>five shared cards</b> are dealt face-up in the middle, and everyone can use them.</p>
    <p>Your hand is the <b>best five cards</b> you can make out of those seven.</p>
    <div class="vs"><div><span class="small">Your two cards</span>${cards(pc('Ah Kh'), '')}</div><div><span class="small">Five shared cards (the "board")</span>${cards(pc('Kd 7h 2h 9c Qh'), '')}</div></div>
    <p>There are two ways to win the pot:</p>
    <ul><li><b>Showdown</b>: you have the best hand when the cards are turned over.</li>
    <li><b>Everyone else folds</b>: nobody is willing to call your bet. This is how most pots are won.</li></ul>
    <p class="callout">The winner of a poker night is the player who makes the best decisions about when to put money in, not whoever has the most fun hands.</p>`;
  PAGE.ladder = () => `
    <h3>The ten hands, strongest first</h3>
    <p>Rarer hands beat more common ones. The last column is how often you make that hand by the river.</p>
    <div class="ladder">${[9, 8, 7, 6, 5, 4, 3, 2, 1, 0].map(c => `<div class="lrow"><span class="lname">${CAT10[c]}</span>${cards(exampleHand(c))}<span class="lodds mono">${ODDS7[c]}</span></div>`).join('')}</div>
    <p class="small">Suits are all equal. A heart flush and a spade flush of the same ranks split the pot.</p>`;
  PAGE.best5 = () => `
    <h3>Seven cards, best five</h3>
    <p>You can use <b>both</b> of your cards, <b>one</b>, or <b>none</b>. Whatever makes the best five.</p>
    <div class="example"><div class="vs"><div><span class="small">You</span>${cards(pc('Kh 7c'), '')}</div><div><span class="small">Board</span>${cards(pc('Ks Kd 7h 2c 9s'), '')}</div></div>
      <p>Best five: ${cards(pc('Kh Ks Kd 7c 7h'))} Full house, kings full of sevens. Both of your cards play.</p></div>
    <div class="example"><div class="vs"><div><span class="small">You</span>${cards(pc('3c 4d'), '')}</div><div><span class="small">Board</span>${cards(pc('Ah Kh Qh Jh 9h'), '')}</div></div>
      <p>Best five: the board itself, an ace-high flush. Your cards don't help. That's "playing the board", and anyone still in the hand has the same.</p></div>`;
  PAGE.kickers = () => `
    <h3>Ties and kickers</h3>
    <p>When two players have the same type of hand, compare the cards in the best five, highest first. The first difference decides it. That deciding card is called the <b>kicker</b>.</p>
    <div class="example"><div class="vs"><div><span class="small">Board</span>${cards(pc('Ad 8c 4s 3h Jd'), '')}</div></div>
      <div class="vs"><div><span class="small">You</span>${cards(pc('As Qd'), '')}</div><div><span class="small">Opponent</span>${cards(pc('Ac 9h'), '')}</div></div>
      <p>Both have a pair of aces. Your next cards are Q-J-8, theirs are J-9-8. Your queen beats their jack, so <b>you win on the kicker</b>.</p></div>
    <p class="callout">This is why hands like A9 and KJ get you into trouble. When you hit your pair, someone with a better kicker often has you beaten.</p>`;
  PAGE.flow = () => `
    <h3>How one hand plays out</h3>
    <ol class="steps">
      <li><b>Blinds.</b> The two players left of the dealer button post forced bets: the small blind ($1) and big blind ($1 in your game). Sometimes a player posts a $2 straddle.</li>
      <li><b>Preflop.</b> Everyone gets two cards. Betting starts left of the big blind.</li>
      <li><b>Flop.</b> Three shared cards. Another betting round.</li>
      <li><b>Turn.</b> A fourth card. Betting.</li>
      <li><b>River.</b> The fifth card. Last betting round.</li>
      <li><b>Showdown.</b> If two or more players are left, best hand wins.</li>
    </ol>
    <p>The button moves one seat clockwise after every hand, so everyone takes turns in every seat.</p>`;
  PAGE.actions = () => `
    <h3>Your five choices</h3>
    <div class="tbl"><table><tbody>
      <tr><td><b>Fold</b></td><td>Give up the hand. You lose nothing more.</td></tr>
      <tr><td><b>Check</b></td><td>Pass without betting. Only allowed when nobody has bet.</td></tr>
      <tr><td><b>Bet</b></td><td>Put chips in when nobody else has.</td></tr>
      <tr><td><b>Call</b></td><td>Match someone else's bet.</td></tr>
      <tr><td><b>Raise</b></td><td>Increase someone else's bet. They must match it or fold.</td></tr>
    </tbody></table></div>
    <p>Two words you'll hear a lot: <b>limp</b> (just calling the big blind before the flop) and <b>all-in</b> (betting everything you have).</p>
    <p class="callout">Folding is the move that saves you the most money. Good players fold far more than they play.</p>`;
  PAGE.seats = () => `
    <h3>Your seat changes everything</h3>
    ${seatMap(['CO', 'BTN'], 'The dealer button (D) moves clockwise each hand. The cutoff and button are the best seats.')}
    <p>After the flop, the player on the <b>button acts last</b> on every street. Acting last means you see what everyone else did before you decide.</p>
    <div class="tbl"><table><thead><tr><th>Group</th><th>Seats</th><th>How many hands</th></tr></thead><tbody>
      <tr><td>Early</td><td>UTG, UTG+1, UTG+2</td><td>Very few. Eight players still to act behind you.</td></tr>
      <tr><td>Middle</td><td>MP, HJ</td><td>A few more.</td></tr>
      <tr><td>Late</td><td>CO, BTN</td><td>The most. Few players behind, and you have position.</td></tr>
      <tr><td>Blinds</td><td>SB, BB</td><td>Careful: you already paid, but you act first after the flop.</td></tr>
    </tbody></table></div>`;
  PAGE.notation = () => `
    <h3>Reading hand shorthand</h3>
    <p>Charts and players write hands like this. Highest card first.</p>
    <div class="tbl"><table><tbody>
      <tr><td class="mono">AKs</td><td>${cards(pc('Ah Kh'))}</td><td>Ace-king, <b>s</b>uited (same suit)</td></tr>
      <tr><td class="mono">AKo</td><td>${cards(pc('As Kd'))}</td><td>Ace-king, <b>o</b>ffsuit (different suits)</td></tr>
      <tr><td class="mono">77</td><td>${cards(pc('7c 7d'))}</td><td>A pocket pair of sevens</td></tr>
      <tr><td class="mono">A9s+</td><td></td><td>A9s, ATs, AJs, AQs, AKs: raise the second card up to just below the first</td></tr>
      <tr><td class="mono">66+</td><td></td><td>66, 77, 88 … up to AA</td></tr>
    </tbody></table></div>
    <p>There are 169 different starting hands. You're dealt a pocket pair about once every 17 hands.</p>`;
  PAGE.tiers = () => `
    <h3>Most hands are folds</h3>
    <p>A good player at a 9-handed table plays about <b>1 hand in 5</b>. That feels boring at first. Folding is also what stops the losses.</p>
    <div class="tbl"><table><thead><tr><th>Tier</th><th>Hands</th><th>What to do</th></tr></thead><tbody>
      <tr><td><b>Premium</b></td><td class="mono">AA KK QQ AK</td><td>Raise from any seat. Re-raise if someone raised.</td></tr>
      <tr><td><b>Strong</b></td><td class="mono">JJ TT AQ AJs KQs</td><td>Raise from any seat. Careful against big raises from tight players.</td></tr>
      <tr><td><b>Playable</b></td><td class="mono">small pairs, suited aces, suited connectors, KJ, QJ…</td><td>Only from later seats, and only if nobody raised.</td></tr>
      <tr><td><b>Trash</b></td><td class="mono">K4o, J6o, 93s, 72o…</td><td>Fold. Every seat, every time.</td></tr>
    </tbody></table></div>
    <p>Rule one: <b>raise or fold, never limp</b>. When you play, raise to about $15–18, the normal size at your table.</p>`;
  PAGE.seatRanges = () => `
    <h3>Your raising chart</h3>
    <p>If everyone folds to you, raise these hands and fold the rest. The later your seat, the more hands you can play.</p>
    <div class="tbl"><table><thead><tr><th>Seat</th><th>Share</th><th>Hands</th></tr></thead><tbody>
      ${Object.entries(C.OPEN).map(([s, r]) => `<tr><td><b>${s}</b></td><td class="mono">${pct(E.rangePct(E.parseRange(r)))}</td><td class="mono small">${esc(r)}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="small">You don't need to memorise it today. The practice will teach it hand by hand.</p>`;
  PAGE.facing = () => `
    <h3>When someone raises $18</h3>
    <p>At a $1/$1 table, $18 is <b>18 big blinds</b>. That's a lot. To call a raise you need a <b>better</b> hand than you'd need to raise first yourself, because the raiser has already shown strength.</p>
    <div class="tbl"><table><thead><tr><th>Your hand</th><th>Facing $18</th><th>Facing $30</th></tr></thead><tbody>
      <tr><td>AA KK QQ AK</td><td>Re-raise to ~$55–65</td><td>Re-raise, or call against a tight player</td></tr>
      <tr><td>JJ TT AQ</td><td>Call (re-raise against a maniac)</td><td>Usually call against loose players, fold against tight ones</td></tr>
      <tr><td>Small pairs 22–99</td><td>Call only if you have $270+ behind</td><td>Fold unless $450+ behind</td></tr>
      <tr><td>Everything else</td><td>Fold</td><td>Fold</td></tr>
    </tbody></table></div>
    <p>Why small pairs need deep stacks: you only flop a set about 1 time in 8. When you do, you need to win a big pot to pay for all the times you miss.</p>
    <p class="callout">This one table is probably where most of your losses have come from. Calling $18 with hands like KJ, A8 or suited junk costs a lot, slowly.</p>`;
  PAGE.flop = () => `
    <h3>After the flop: what have I got?</h3>
    <p>Before you think about betting, name your hand. Put it in one of five boxes:</p>
    <div class="tbl"><table><tbody>
      <tr><td><b>Strong made hand</b></td><td>${cards(pc('As Qd'))} on ${cards(pc('Ac 8h 3s'))}</td><td>Top pair, good kicker or better. Bet.</td></tr>
      <tr><td><b>Drawing hand</b></td><td>${cards(pc('Jh Th'))} on ${cards(pc('9h 4h 2c'))}</td><td>Flush draw. Chase it only at the right price.</td></tr>
      <tr><td><b>Medium pair</b></td><td>${cards(pc('8s 8d'))} on ${cards(pc('Kc 5h 2d'))}</td><td>Could win, but keep the pot small.</td></tr>
      <tr><td><b>Weak</b></td><td>${cards(pc('Qs 3s'))} on ${cards(pc('Kc 9h 3d'))}</td><td>Bottom pair. Usually give up if someone bets.</td></tr>
      <tr><td><b>Nothing</b></td><td>${cards(pc('Ks Jd'))} on ${cards(pc('8c 6h 2s'))}</td><td>Check, and fold to a bet.</td></tr>
    </tbody></table></div>
    <p><b>Top pair</b> means pairing the highest card on the board. An <b>overpair</b> is a pocket pair above every board card, like QQ on 9-7-2.</p>`;
  PAGE.outs = () => `
    <h3>Outs: cards that save you</h3>
    <p>When you're behind, an <b>out</b> is a card that would make you the winner.</p>
    <div class="example"><div class="vs"><div><span class="small">You</span>${cards(pc('Ah Th'), '')}</div><div><span class="small">Board</span>${cards(pc('Kh 7h 2c'), '')}</div></div>
      <p>You have four hearts. There are 13 hearts in the deck, and you can see 4, so <b>9 hearts</b> are left. 9 outs.</p></div>
    <p><b>The rule of 2 and 4:</b> with one card to come, outs × 2 ≈ your % chance. On the flop, if you're all-in and will see both cards, outs × 4.</p>
    <div class="tbl"><table><thead><tr><th>Draw</th><th>Outs</th><th>One card</th><th>Two cards</th></tr></thead><tbody>
      <tr><td>Flush draw</td><td class="mono">9</td><td class="mono">~20%</td><td class="mono">~35%</td></tr>
      <tr><td>Open-ended straight draw (e.g. 9-8 on 7-6-2)</td><td class="mono">8</td><td class="mono">~17%</td><td class="mono">~32%</td></tr>
      <tr><td>Gutshot (one card in the middle missing)</td><td class="mono">4</td><td class="mono">~9%</td><td class="mono">~17%</td></tr>
    </tbody></table></div>
    <p>A flush draw with one card to come hits only <b>1 time in 5</b>. That's the number to remember next time you want to chase.</p>`;
  PAGE.potodds = () => `
    <h3>Pot odds: is the price right?</h3>
    <p>Imagine a friend offers a bet: you pay $10, and if you win you get $40. You only need to win more than 1 time in 5 for this to be a good deal.</p>
    <p>Calling a bet works the same way. Compare <b>the price</b> with <b>your chance of winning</b>.</p>
    <p class="callout"><b>Equity you need = your call ÷ the total pot after you call</b></p>
    <div class="example"><p>Pot is $60. Opponent bets $30. You'd call $30, and the final pot would be $60 + $30 + $30 = $120.</p>
    <p>$30 ÷ $120 = <b>25%</b>. If you win more than 1 time in 4, call.</p></div>
    <div class="tbl"><table><thead><tr><th>Their bet</th><th>You need</th></tr></thead><tbody>
      <tr><td>Half the pot</td><td class="mono">25%</td></tr><tr><td>Two-thirds pot</td><td class="mono">29%</td></tr>
      <tr><td>Pot-sized</td><td class="mono">33%</td></tr><tr><td>Twice the pot</td><td class="mono">40%</td></tr>
    </tbody></table></div>
    <p>A flush draw on the turn (~20%) facing a pot-sized bet (needs 33%) is a <b>fold</b>. "But it might come" is true, just not often enough.</p>`;
  PAGE.people = () => `
    <h3>The five players at your table</h3>
    <p>The same hand can be a call against one player and a fold against another. Watch what people do, especially what they show at showdown.</p>
    <div class="tbl"><table><thead><tr><th>Type</th><th>Plays</th><th>Looks like</th><th>How to beat</th></tr></thead><tbody>
      ${Object.values(C.PROFILES).map(p => `<tr><td><b>${p.type}</b></td><td class="mono">${p.vpip}</td><td>${esc(p.blurb)}</td><td>${esc(p.exploit)}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="small">"Plays" is roughly the share of hands they put money in. You're aiming for about 20%.</p>`;
  PAGE.whyBet = () => `
    <h3>Every bet needs a reason</h3>
    <p>There are only two good reasons to bet:</p>
    <ul><li><b>Value:</b> worse hands will call. You have top pair; they call with second pair.</li>
    <li><b>Bluff:</b> better hands will fold. You have nothing, but they'll fold their small pair.</li></ul>
    <p>If you can't name worse hands that call <i>or</i> better hands that fold, <b>check</b>.</p>
    <div class="tbl"><table><thead><tr><th>Opponent</th><th>Value bets</th><th>Bluffs</th></tr></thead><tbody>
      <tr><td>Calling station</td><td>Big and often</td><td>Never</td></tr>
      <tr><td>Maniac</td><td>Yes, let them call</td><td>Never</td></tr>
      <tr><td>Nit</td><td>Smaller</td><td>Small ones work</td></tr>
      <tr><td>TAG / LAG</td><td>Normal (half to ⅔ pot)</td><td>Sometimes</td></tr>
    </tbody></table></div>
    <p>A bluff risking $B to win a pot of $P has to work at least B ÷ (B + P) of the time. A pot-sized bluff has to work half the time.</p>`;
  PAGE.calling = () => `
    <h3>Three questions before you call</h3>
    <ol class="steps">
      <li><b>What have I got?</b> Strong, draw, medium, weak or nothing.</li>
      <li><b>Who is betting?</b> A nit's bet means a strong hand. A maniac's bet means anything.</li>
      <li><b>What's the price?</b> Your call ÷ the final pot. Compare it with how often you win against <i>their</i> hands.</li>
    </ol>
    <p class="callout">The biggest leak at home games is calling bets from people who rarely bluff. When a calling station or a nit bets big, fold one pair.</p>`;
  PAGE.bankroll = () => `
    <h3>Protecting your money</h3>
    <p>Losing $2,300 at $1/$1 is about <b>11 buy-ins</b> of $200 in one night. Even very good players lose some nights, but rarely more than 2–3 buy-ins, because they fold more and stop sooner.</p>
    <ul>
      <li><b>Bring a fixed amount.</b> Decide at home. No ATM, no transfers, no IOUs at the table.</li>
      <li><b>Set a stop-loss</b>, for example 2 buy-ins ($400). When it's gone, the night is over, no matter how good the game looks.</li>
      <li><b>Track every session:</b> buy-in, cash-out, hours, and your VPIP from the tracker.</li>
      <li>While you're learning, consider <b>playing less often</b> or buying in for less. Your skill will grow faster than your losses if you slow down.</li>
    </ul>`;
  PAGE.tilt = () => `
    <h3>Tilt, and feeling bad after losing</h3>
    <p><b>Tilt</b> is playing worse because of emotion: after a bad beat, a long losing run, or needle from other players. Everyone tilts. Good players notice it and stop.</p>
    <p>Signs: wanting it back <i>tonight</i>, playing hands you'd normally fold, calling "to see", rebuying fast.</p>
    <ul><li>Stand up after any big loss. Walk for 10 minutes.</li>
    <li>If you've hit your stop-loss, go home. The game will be there next week.</li>
    <li>Judge a night by your decisions, not the money.</li></ul>
    <p>Feeling sad or defeated after a big loss is normal, and it's not a sign you can't get better. But if you notice you're finding it hard to stop, hiding losses, or poker has stopped being fun, that's worth taking seriously. Talking to someone helps. Free, confidential helplines include Singapore 1800-6-668-668, UK 0808 8020 133, and US 1-800-GAMBLER.</p>`;

  const COURSE = [
    { title: 'How poker works', lessons: [
      { id: 'l1', title: 'The goal and the ten hands', pages: [PAGE.basics, PAGE.ladder], gens: ['rankOrder', 'nameIt'], n: 10, pass: 8 },
      { id: 'l2', title: 'Making your best five cards', pages: [PAGE.best5, PAGE.kickers], gens: ['bestHand', 'whichWins'], n: 10, pass: 8 },
      { id: 'l3', title: 'How a hand plays out', pages: [PAGE.flow, PAGE.actions], gens: ['rules'], n: 8, pass: 7 },
    ] },
    { title: 'Before the flop', lessons: [
      { id: 'l4', title: 'Your seat matters', pages: [PAGE.seats], gens: ['positions'], n: 8, pass: 7 },
      { id: 'l5', title: 'Reading hand shorthand', pages: [PAGE.notation], gens: ['notation'], n: 6, pass: 5 },
      { id: 'l6', title: 'Which hands to play', pages: [PAGE.tiers, PAGE.seatRanges], gens: ['openFold'], n: 12, pass: 10 },
      { id: 'l7', title: 'When someone raises $18', pages: [PAGE.facing], gens: ['facing'], n: 10, pass: 8 },
    ] },
    { title: 'After the flop', lessons: [
      { id: 'l8', title: 'What did I flop?', pages: [PAGE.flop], gens: ['flopClass'], n: 10, pass: 8 },
      { id: 'l9', title: 'Counting outs', pages: [PAGE.outs], gens: ['outs', 'countOuts'], n: 8, pass: 6 },
      { id: 'l10', title: 'Pot odds', pages: [PAGE.potodds], gens: ['need', 'callfoldMath'], n: 10, pass: 8 },
    ] },
    { title: 'People and bets', lessons: [
      { id: 'l11', title: 'The five players', pages: [PAGE.people], gens: ['typeId'], n: 8, pass: 6 },
      { id: 'l12', title: 'Why you bet', pages: [PAGE.whyBet], gens: ['betCheck', 'bluffMath'], n: 8, pass: 6 },
      { id: 'l13', title: 'Calling a bet', pages: [PAGE.calling], gens: ['callFold'], n: 8, pass: 6 },
    ] },
    { title: 'Money and mindset', lessons: [
      { id: 'l14', title: 'Protecting your money', pages: [PAGE.bankroll], gens: ['bankroll'], n: 6, pass: 5 },
      { id: 'l15', title: 'Tilt and bad nights', pages: [PAGE.tilt], gens: ['tilt'], n: 6, pass: 5 },
      { id: 'l16', title: 'Your plan for the next game', plan: true },
    ] },
  ];
  const ALL = COURSE.flatMap(m => m.lessons);
  const unlocked = id => { const i = ALL.findIndex(l => l.id === id); return i === 0 || !!P.done[ALL[i - 1].id]; };

  // ---------- Views ----------
  const root = () => $('#course');
  let L = null; // active lesson state

  function renderMap() {
    L = null;
    const doneN = ALL.filter(l => P.done[l.id]).length;
    const next = ALL.find(l => !P.done[l.id]);
    let html = `<div class="c-intro">
      <h2>Start from the beginning</h2>
      <p>${ALL.length} short lessons, about 10 minutes each. Read a little, then practise until you get it right. Each lesson unlocks the next.</p>
      <div class="c-progress"><div style="width:${(doneN / ALL.length * 100).toFixed(0)}%"></div></div>
      <p class="small">${doneN} of ${ALL.length} lessons done${next ? ` · next up: <b>${esc(next.title)}</b>` : ' · course complete'}</p>
      ${next ? `<button class="next" id="cContinue">${doneN ? 'Continue' : 'Start lesson 1'} →</button>` : ''}
    </div>`;
    if (P.plan) html += planCard();
    COURSE.forEach((m, mi) => {
      html += `<section class="c-module"><div class="label">Module ${mi + 1}</div><h3>${esc(m.title)}</h3><div class="c-lessons">`;
      for (const l of m.lessons) {
        const n = ALL.indexOf(l) + 1;
        const st = P.done[l.id] ? 'done' : unlocked(l.id) ? 'open' : 'locked';
        const score = P.done[l.id] && P.done[l.id].score != null ? `${P.done[l.id].score}/${P.done[l.id].n}` : '';
        html += `<button class="c-lesson ${st}" data-l="${l.id}" ${st === 'locked' ? 'disabled' : ''}>
          <span class="c-num">${st === 'done' ? '✓' : n}</span><span class="c-title">${esc(l.title)}</span>
          <span class="c-state">${st === 'done' ? score || 'Done' : st === 'open' ? 'Start' : 'Locked'}</span></button>`;
      }
      html += '</div></section>';
    });
    if (!next) html += `<div class="panel"><h3>Course complete</h3><p>Now use the <b>Train</b> tab every day for 15 minutes, and the <b>Progress → live tracker</b> at every game.</p></div>`;
    root().innerHTML = html;
    root().querySelectorAll('.c-lesson:not([disabled])').forEach(b => b.addEventListener('click', () => openLesson(b.dataset.l)));
    const c = $('#cContinue'); if (c) c.addEventListener('click', () => openLesson(next.id));
  }

  function planCard() {
    const p = P.plan;
    return `<div class="panel plan"><div class="label">Your plan for the next game</div>
      <div class="plangrid"><div><span class="small">Buy-in</span><b class="mono">$${p.buyin}</b></div>
      <div><span class="small">Stop-loss</span><b class="mono">$${p.stop}</b></div>
      <div><span class="small">Leave by</span><b class="mono">${esc(p.hours)} h</b></div>
      <div><span class="small">VPIP target</span><b class="mono">≤ ${p.vpip}%</b></div></div>
      ${p.rules.length ? `<ul class="notes">${p.rules.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}</div>`;
  }

  function openLesson(id) {
    const l = ALL.find(x => x.id === id);
    L = { l, page: 0, phase: l.plan ? 'plan' : 'read', qi: 0, right: 0, q: null, answered: false };
    renderLesson();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function header() {
    const l = L.l, n = ALL.indexOf(l) + 1;
    const total = l.pages ? l.pages.length : 0;
    const where = L.phase === 'read' ? `Read ${L.page + 1} of ${total}` : L.phase === 'practice' ? `Practice ${Math.min(L.qi + 1, l.n)} of ${l.n}` : L.phase === 'plan' ? 'Plan' : 'Result';
    return `<div class="c-head"><button class="linkbtn" id="cBack">← All lessons</button><span class="small">Lesson ${n} · ${where}</span></div>
      <h2>${esc(l.title)}</h2>`;
  }
  function wireBack() { $('#cBack').addEventListener('click', renderMap); }

  function renderLesson() {
    const l = L.l;
    if (L.phase === 'plan') return renderPlan();
    if (L.phase === 'read') {
      const last = L.page === l.pages.length - 1;
      root().innerHTML = `${header()}<article class="panel c-read">${l.pages[L.page]()}</article>
        <div class="c-nav">${L.page ? '<button class="ghost" id="cPrev">← Back</button>' : '<span></span>'}
        <button class="next" id="cNext">${last ? `Start practice (${l.pass} of ${l.n} to pass) →` : 'Next →'}</button></div>`;
      wireBack();
      if (L.page) $('#cPrev').addEventListener('click', () => { L.page--; renderLesson(); });
      $('#cNext').addEventListener('click', () => {
        if (last) { L.phase = 'practice'; L.qi = 0; L.right = 0; nextQuestion(); } else { L.page++; renderLesson(); }
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
      return;
    }
    if (L.phase === 'result') return renderResult();
  }

  function nextQuestion() {
    const l = L.l;
    root().innerHTML = `${header()}<div class="panel"><p class="small">Dealing…</p></div>`;
    wireBack();
    setTimeout(() => {
      L.q = G[l.gens[L.qi % l.gens.length]]();
      L.answered = false;
      renderQuestion();
    }, 10);
  }

  function dots() {
    const l = L.l;
    let d = '';
    for (let i = 0; i < l.n; i++) {
      const s = L.marks && L.marks[i];
      d += `<span class="dot ${s === true ? 'y' : s === false ? 'n' : i === L.qi ? 'cur' : ''}"></span>`;
    }
    return `<div class="dots" aria-label="Progress">${d}</div>`;
  }

  function renderQuestion() {
    const q = L.q;
    root().innerHTML = `${header()}${dots()}
      <div class="panel c-q">
        <h3>${q.q}</h3>
        ${q.visual ? `<div class="c-visual">${q.visual}</div>` : ''}
        <div class="qopts ${q.options.length > 3 || q.options.some(o => o.length > 18) ? 'wide' : ''}">${q.options.map((o, i) => `<button data-i="${i}">${esc(o)}</button>`).join('')}</div>
        <div id="cExp" hidden></div>
      </div>`;
    wireBack();
    root().querySelectorAll('.qopts button').forEach(b => b.addEventListener('click', () => answer(+b.dataset.i)));
  }

  function answer(i) {
    if (L.answered) return;
    L.answered = true;
    const q = L.q;
    let correct, right, explain;
    if (q.check) ({ correct, right, explain } = q.check(i));
    else { correct = i === q.answer; right = q.answer; explain = q.explain; }
    L.marks = L.marks || [];
    L.marks[L.qi] = correct;
    if (correct) L.right++;
    root().querySelectorAll('.qopts button').forEach((b, j) => {
      b.disabled = true;
      if (j === right) b.classList.add('right');
      else if (j === i && !correct) b.classList.add('wrong');
      else if (j === i && correct) b.classList.add('right');
    });
    const last = L.qi === L.l.n - 1;
    const ex = $('#cExp');
    ex.hidden = false;
    ex.innerHTML = `<div class="verdict"><span class="pill ${correct ? 'best' : 'mistake'}">${correct ? 'Correct' : 'Not quite'}</span><div class="c-exp">${explain}</div></div>
      <button class="next" id="cGo">${last ? 'See result →' : 'Next question →'}</button>`;
    root().querySelector('.dots').outerHTML = dots();
    $('#cGo').addEventListener('click', () => {
      if (last) { L.phase = 'result'; renderLesson(); }
      else { L.qi++; nextQuestion(); }
    });
    $('#cGo').focus({ preventScroll: true });
  }

  function renderResult() {
    const l = L.l, ok = L.right >= l.pass;
    if (ok) {
      const prev = P.done[l.id];
      if (!prev || prev.score < L.right) P.done[l.id] = { score: L.right, n: l.n };
      save();
    }
    const nextL = ALL[ALL.indexOf(l) + 1];
    root().innerHTML = `${header()}${dots()}<div class="panel c-result">
      <span class="pill ${ok ? 'best' : 'ok'}">${ok ? 'Lesson complete' : 'Almost there'}</span>
      <h3>${L.right} of ${l.n} correct</h3>
      <p>${ok ? (nextL ? `Well done. <b>${esc(nextL.title)}</b> is unlocked.` : 'Well done.') : `You need ${l.pass} to pass. Have another look at the lesson, then try again. The questions are new every time.`}</p>
      <div class="c-nav">
        ${ok ? '<button class="ghost" id="cAgain">Practise again</button>' : '<button class="ghost" id="cReread">Re-read the lesson</button>'}
        ${ok && nextL ? '<button class="next" id="cNextL">Next lesson →</button>' : ok ? '<button class="next" id="cHome">Back to the course</button>' : '<button class="next" id="cAgain">Try again →</button>'}
      </div></div>`;
    wireBack();
    const on = (id, fn) => { const el = $('#' + id); if (el) el.addEventListener('click', fn); };
    on('cAgain', () => { L.phase = 'practice'; L.qi = 0; L.right = 0; L.marks = []; nextQuestion(); });
    on('cReread', () => { L.phase = 'read'; L.page = 0; L.marks = []; renderLesson(); });
    on('cNextL', () => openLesson(nextL.id));
    on('cHome', renderMap);
  }

  function renderPlan() {
    const p = P.plan || { buyin: 200, stop: 400, hours: 4, vpip: 25, rules: [] };
    const RULES = [
      'I raise or fold before the flop. I never limp.',
      'I fold to $18+ raises unless my hand is on the chart.',
      'I don\'t straddle UTG.',
      'I stand up for 10 minutes after any big loss.',
      'When I hit my stop-loss, I go home. No ATM, no IOUs.',
      'I tap the VPIP tracker every hand.',
      'I write down my result after every game.',
    ];
    root().innerHTML = `${header()}<form class="panel c-plan" id="planForm">
      <p>Decide these now, while you're calm. The app will show your plan at the top of the course.</p>
      <div class="plangrid">
        <label class="field" for="pBuy">Buy-in ($)<input id="pBuy" type="number" min="20" step="10" value="${p.buyin}"></label>
        <label class="field" for="pStop">Stop-loss for the night ($)<input id="pStop" type="number" min="20" step="10" value="${p.stop}"></label>
        <label class="field" for="pHours">Leave after (hours)<input id="pHours" type="number" min="1" max="12" step="0.5" value="${p.hours}"></label>
        <label class="field" for="pVpip">VPIP limit (%)<input id="pVpip" type="number" min="10" max="40" value="${p.vpip}"></label>
      </div>
      <p class="small" id="pHint"></p>
      <fieldset><legend class="label">My rules</legend>
        ${RULES.map((r, i) => `<label class="chk" for="pr${i}"><input type="checkbox" id="pr${i}" value="${esc(r)}" ${!P.plan || p.rules.includes(r) ? 'checked' : ''}> ${esc(r)}</label>`).join('')}
      </fieldset>
      <button class="next" type="submit">Save my plan</button>
    </form>`;
    wireBack();
    const hint = () => {
      const b = +$('#pBuy').value || 0, s = +$('#pStop').value || 0;
      $('#pHint').textContent = b ? `Your stop-loss is ${(s / b).toFixed(1)} buy-ins. 2 to 3 is a sensible limit.` : '';
    };
    ['pBuy', 'pStop'].forEach(id => $('#' + id).addEventListener('input', hint));
    hint();
    $('#planForm').addEventListener('submit', e => {
      e.preventDefault();
      P.plan = {
        buyin: +$('#pBuy').value || 200, stop: +$('#pStop').value || 400,
        hours: $('#pHours').value || '4', vpip: +$('#pVpip').value || 25,
        rules: [...root().querySelectorAll('.chk input:checked')].map(x => x.value),
      };
      P.done[L.l.id] = { score: null, n: 0 };
      save();
      renderMap();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  window.PokerCourse = { render: renderMap, G, COURSE };
  if ($('#course')) renderMap();
})();
