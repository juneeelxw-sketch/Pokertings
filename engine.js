/* Pokertings engine: cards, hand evaluation, ranges, equity, hand classification.
   Works in the browser (window.PokerEngine) and in Node (module.exports). */
(function (root) {
  'use strict';

  const RANKS = '23456789TJQKA';
  const SUITS = 'shdc';
  const SUIT_SYM = ['♠', '♥', '♦', '♣'];
  const CAT_NAMES = ['High card', 'Pair', 'Two pair', 'Trips', 'Straight', 'Flush', 'Full house', 'Quads', 'Straight flush'];

  const card = (r, s) => (r - 2) * 4 + s;
  const rankOf = c => (c >> 2) + 2;
  const suitOf = c => c & 3;
  const rv = ch => RANKS.indexOf(ch.toUpperCase()) + 2;
  const rankChar = r => RANKS[r - 2];
  const cardStr = c => rankChar(rankOf(c)) + SUITS[suitOf(c)];
  const parseCard = s => card(rv(s[0]), SUITS.indexOf(s[1].toLowerCase()));

  // ---------- Hand evaluation (5 to 7 cards). Higher score = better hand. ----------
  const cnt = new Int8Array(15), sc = new Int8Array(4), sm = new Int32Array(4);
  const P16 = 1048576; // 16^5

  function straightHigh(m) {
    if (m & (1 << 14)) m |= 2; // ace plays low
    for (let h = 14; h >= 5; h--) {
      const need = 31 << (h - 4);
      if ((m & need) === need) return h;
    }
    return 0;
  }
  function pack(cat, a) {
    let v = cat;
    for (let i = 0; i < 5; i++) v = v * 16 + (a[i] || 0);
    return v;
  }
  function evaluate(cards) {
    cnt.fill(0); sc.fill(0); sm.fill(0);
    let mask = 0;
    for (let i = 0; i < cards.length; i++) {
      const c = cards[i], r = (c >> 2) + 2, s = c & 3;
      cnt[r]++; sc[s]++; sm[s] |= 1 << r; mask |= 1 << r;
    }
    let fs = -1;
    for (let s = 0; s < 4; s++) if (sc[s] >= 5) fs = s;
    if (fs >= 0) { const h = straightHigh(sm[fs]); if (h) return pack(8, [h]); }
    const quads = [], trips = [], pairs = [], singles = [];
    for (let r = 14; r >= 2; r--) {
      const n = cnt[r];
      if (n === 4) quads.push(r); else if (n === 3) trips.push(r);
      else if (n === 2) pairs.push(r); else if (n === 1) singles.push(r);
    }
    if (quads.length) {
      const q = quads[0]; let k = 0;
      for (let r = 14; r >= 2; r--) if (r !== q && cnt[r]) { k = r; break; }
      return pack(7, [q, k]);
    }
    if (trips.length && (trips.length > 1 || pairs.length)) {
      return pack(6, [trips[0], Math.max(trips[1] || 0, pairs[0] || 0)]);
    }
    if (fs >= 0) {
      const a = [];
      for (let r = 14; r >= 2 && a.length < 5; r--) if (sm[fs] & (1 << r)) a.push(r);
      return pack(5, a);
    }
    const sh = straightHigh(mask);
    if (sh) return pack(4, [sh]);
    if (trips.length) {
      const t = trips[0], k = [];
      for (let r = 14; r >= 2 && k.length < 2; r--) if (r !== t && cnt[r]) k.push(r);
      return pack(3, [t].concat(k));
    }
    if (pairs.length >= 2) {
      const p1 = pairs[0], p2 = pairs[1]; let k = 0;
      for (let r = 14; r >= 2; r--) if (r !== p1 && r !== p2 && cnt[r]) { k = r; break; }
      return pack(2, [p1, p2, k]);
    }
    if (pairs.length === 1) {
      const p = pairs[0], k = [];
      for (let r = 14; r >= 2 && k.length < 3; r--) if (r !== p && cnt[r]) k.push(r);
      return pack(1, [p].concat(k));
    }
    return pack(0, singles.slice(0, 5));
  }
  const category = score => Math.floor(score / P16);

  // ---------- Ranges ----------
  function classKey(hi, lo, t) {
    const a = rankChar(hi), b = rankChar(lo);
    return hi === lo ? a + b : a + b + t;
  }
  function handKey(c1, c2) {
    const r1 = rankOf(c1), r2 = rankOf(c2);
    return classKey(Math.max(r1, r2), Math.min(r1, r2), suitOf(c1) === suitOf(c2) ? 's' : 'o');
  }
  const R = '[2-9TJQKA]';
  const rePairDash = new RegExp('^(' + R + ')\\1-(' + R + ')\\2$', 'i');
  const rePair = new RegExp('^(' + R + ')\\1(\\+?)$', 'i');
  const reDash = new RegExp('^(' + R + ')(' + R + ')([so])-(' + R + ')(' + R + ')([so])$', 'i');
  const reHand = new RegExp('^(' + R + ')(' + R + ')([so]?)(\\+?)$', 'i');

  // Parses "22+, A2s+, KTs+, ATo+, KQo, A9o-A2o, 99-55" into a Set of hand keys.
  function parseRange(str) {
    const keys = new Set();
    for (let tok of str.split(',')) {
      tok = tok.trim();
      if (!tok) continue;
      let m;
      if ((m = tok.match(rePairDash))) {
        let a = rv(m[1]), b = rv(m[2]);
        if (a < b) [a, b] = [b, a];
        for (let r = b; r <= a; r++) keys.add(classKey(r, r));
      } else if ((m = tok.match(rePair))) {
        const a = rv(m[1]);
        for (let r = a; r <= (m[2] ? 14 : a); r++) keys.add(classKey(r, r));
      } else if ((m = tok.match(reDash))) {
        const hi = rv(m[1]), t = m[3].toLowerCase();
        let a = rv(m[2]), b = rv(m[5]);
        if (a < b) [a, b] = [b, a];
        for (let r = b; r <= a; r++) keys.add(classKey(hi, r, t));
      } else if ((m = tok.match(reHand))) {
        let hi = rv(m[1]), lo = rv(m[2]);
        if (hi < lo) [hi, lo] = [lo, hi];
        const types = m[3] ? [m[3].toLowerCase()] : ['s', 'o'];
        const top = m[4] ? hi - 1 : lo;
        for (let r = lo; r <= top; r++) for (const t of types) keys.add(classKey(hi, r, t));
      } else {
        throw new Error('Bad range token: ' + tok);
      }
    }
    return keys;
  }
  function combosForKey(k) {
    const hi = rv(k[0]), lo = rv(k[1]), out = [];
    if (hi === lo) {
      for (let a = 0; a < 4; a++) for (let b = a + 1; b < 4; b++) out.push([card(hi, a), card(lo, b)]);
    } else if (k[2] === 's') {
      for (let s = 0; s < 4; s++) out.push([card(hi, s), card(lo, s)]);
    } else {
      for (let a = 0; a < 4; a++) for (let b = 0; b < 4; b++) if (a !== b) out.push([card(hi, a), card(lo, b)]);
    }
    return out;
  }
  function rangeCombos(keys) {
    const out = [];
    for (const k of keys) for (const c of combosForKey(k)) out.push(c);
    return out;
  }
  const comboCount = k => (k.length === 2 ? 6 : k[2] === 's' ? 4 : 12);
  function rangePct(keys) {
    let n = 0;
    for (const k of keys) n += comboCount(k);
    return n / 1326;
  }

  // ---------- Equity ----------
  // Monte Carlo equity for hero vs one or more opponents, each drawn from a combo list.
  function equityMC(hero, board, ranges, trials) {
    const dead0 = new Uint8Array(52);
    for (const c of hero) dead0[c] = 1;
    for (const c of board) dead0[c] = 1;
    const dead = new Uint8Array(52);
    let total = 0, done = 0, guard = 0;
    const b = new Array(5), hc = new Array(7), oc = new Array(7);
    while (done < trials && guard < trials * 30) {
      guard++;
      dead.set(dead0);
      const opp = [];
      let ok = true;
      for (const rg of ranges) {
        const cb = rg[(Math.random() * rg.length) | 0];
        if (dead[cb[0]] || dead[cb[1]]) { ok = false; break; }
        dead[cb[0]] = dead[cb[1]] = 1;
        opp.push(cb);
      }
      if (!ok) continue;
      let n = 0;
      for (; n < board.length; n++) b[n] = board[n];
      while (n < 5) { const c = (Math.random() * 52) | 0; if (!dead[c]) { dead[c] = 1; b[n++] = c; } }
      hc[0] = hero[0]; hc[1] = hero[1];
      for (let i = 0; i < 5; i++) hc[i + 2] = oc[i + 2] = b[i];
      const hs = evaluate(hc);
      let best = -1, ties = 0;
      for (const o of opp) {
        oc[0] = o[0]; oc[1] = o[1];
        const s = evaluate(oc);
        if (s > best) { best = s; ties = s === hs ? 1 : 0; }
        else if (s === best && s === hs) ties++;
      }
      if (hs > best) total += 1;
      else if (hs === best) total += 1 / (ties + 1);
      done++;
    }
    return done ? total / done : 0;
  }

  // Equity of hero against each villain combo individually (NaN when the combo is blocked).
  function comboEquities(hero, board, combos, samples) {
    samples = samples || 120;
    const dead = new Uint8Array(52);
    for (const c of hero) dead[c] = 1;
    for (const c of board) dead[c] = 1;
    const deck = [];
    for (let c = 0; c < 52; c++) if (!dead[c]) deck.push(c);
    const need = 5 - board.length;
    const out = new Float64Array(combos.length);
    const hc = [hero[0], hero[1]].concat(board), vc = [0, 0].concat(board);
    function duel(extra) {
      const h = hc.concat(extra), v = vc.concat(extra);
      const a = evaluate(h), b = evaluate(v);
      return a > b ? 1 : a === b ? 0.5 : 0;
    }
    for (let i = 0; i < combos.length; i++) {
      const [x, y] = combos[i];
      if (dead[x] || dead[y]) { out[i] = NaN; continue; }
      vc[0] = x; vc[1] = y;
      if (need === 0) { out[i] = duel([]); continue; }
      const left = deck.filter(c => c !== x && c !== y);
      let sum = 0, n = 0;
      if (need === 1) {
        for (const c of left) { sum += duel([c]); n++; }
      } else {
        for (let k = 0; k < samples; k++) {
          const a = (Math.random() * left.length) | 0;
          let b = (Math.random() * (left.length - 1)) | 0;
          if (b >= a) b++;
          sum += duel([left[a], left[b]]); n++;
        }
      }
      out[i] = sum / n;
    }
    return out;
  }

  // River cards that turn a losing hero hand into a winner against a known villain hand.
  function riverOuts(hero, villain, board) {
    const dead = new Uint8Array(52);
    for (const c of hero.concat(villain, board)) dead[c] = 1;
    const outs = [];
    for (let c = 0; c < 52; c++) {
      if (dead[c]) continue;
      const b = board.concat([c]);
      if (evaluate(hero.concat(b)) > evaluate(villain.concat(b))) outs.push(c);
    }
    return outs;
  }

  // ---------- Hand classification ----------
  // Buckets a holding on a board into strong / draw / medium / weak / air with a readable label.
  function classify(hole, board) {
    const all = hole.concat(board);
    const s = evaluate(all), cat = category(s);
    const bcat = category(evaluate(board));
    const br = board.map(rankOf).sort((a, b) => b - a);
    const ubr = [...new Set(br)];
    const top = ubr[0], second = ubr[1] || 0;
    const h1 = rankOf(hole[0]), h2 = rankOf(hole[1]);
    const hi = Math.max(h1, h2), lo = Math.min(h1, h2);
    const pocket = h1 === h2;

    if (cat >= 4 && cat > bcat) return { cls: 'strong', label: CAT_NAMES[cat] };
    if (cat === 3 && bcat < 3) return { cls: 'strong', label: pocket ? 'Set' : 'Trips' };
    if (cat === 2 && bcat === 0) return { cls: 'strong', label: 'Two pair' };

    // One-pair analysis (includes a real pair on a paired board).
    let made = null;
    const matched = [h1, h2].filter(r => br.includes(r));
    if (pocket && !br.includes(h1)) {
      if (h1 > top) made = { cls: 'strong', label: 'Overpair' };
      else if (h1 > second) made = { cls: 'medium', label: 'Pocket pair below the top card' };
      else made = { cls: 'weak', label: 'Small pocket pair' };
    } else if (matched.length && cat >= 1) {
      const m = Math.max(...matched);
      const kicker = m === h1 ? h2 : h1;
      if (m === top) made = kicker >= 11 || (m === 14 && kicker >= 10)
        ? { cls: 'strong', label: 'Top pair, good kicker' }
        : { cls: 'medium', label: 'Top pair, weak kicker' };
      else if (m === second) made = { cls: 'medium', label: 'Second pair' };
      else made = { cls: 'weak', label: 'Bottom pair' };
    }
    if (made && made.cls === 'strong') return made;

    let draw = null;
    if (board.length < 5) {
      for (let st = 0; st < 4; st++) {
        const n = all.filter(c => suitOf(c) === st).length;
        const mine = hole.some(c => suitOf(c) === st);
        if (n === 4 && mine) { draw = 'Flush draw'; break; }
      }
      const rs = new Set(all.map(rankOf));
      if (rs.has(14)) rs.add(1);
      const holeR = new Set([h1, h2, h1 === 14 ? 1 : 0, h2 === 14 ? 1 : 0]);
      let oesd = false, gut = false;
      for (let lowR = 1; lowR <= 10; lowR++) {
        const win = [lowR, lowR + 1, lowR + 2, lowR + 3, lowR + 4];
        const have = win.filter(r => rs.has(r));
        if (have.length !== 4 || !have.some(r => holeR.has(r))) continue;
        const missing = win.find(r => !rs.has(r));
        // Open-ended if the missing card is at either end and the other end can still extend.
        if ((missing === lowR + 4 && lowR >= 2) || (missing === lowR && lowR + 4 <= 13)) oesd = true;
        else gut = true;
      }
      if (draw && (oesd || gut)) draw = oesd ? 'Flush draw + straight draw' : 'Flush draw + gutshot';
      else if (!draw && oesd) draw = 'Open-ended straight draw';
      if (draw) return { cls: 'draw', label: made ? made.label + ' + ' + draw.toLowerCase() : draw };
      if (gut && !made) return { cls: 'weak', label: 'Gutshot straight draw' };
    }
    if (made) return made;
    if (lo > top) return { cls: 'air', label: 'Two overcards, no pair' };
    if (hi === 14) return { cls: 'air', label: 'Ace high' };
    return { cls: 'air', label: 'Nothing (missed)' };
  }

  const api = {
    RANKS, SUITS, SUIT_SYM, CAT_NAMES,
    card, rankOf, suitOf, rankChar, cardStr, parseCard,
    evaluate, category, handKey, parseRange, combosForKey, rangeCombos, rangePct, comboCount,
    equityMC, comboEquities, riverOuts, classify,
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PokerEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
