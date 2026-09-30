/* Pokertings UI: training loop, odds quiz, lessons, progress and live VPIP tracker. */
(function () {
  'use strict';
  const E = window.PokerEngine, C = window.PokerCoach;
  const $ = (s, el) => (el || document).querySelector(s);
  const esc = s => String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const pct = x => Math.round(x * 100) + '%';
  const money = x => (x < 0 ? '−$' : '$') + Math.abs(Math.round(x));

  // ---------- Persistent state (per browser) ----------
  const KEY = 'pokertings.v1';
  function fresh() {
    return {
      v: 1,
      settings: { mode: 'mixed', villain: 'random', stack: 200, straddle: 'random' },
      stats: { hands: 0, points: 0, max: 0, best: 0, ok: 0, streak: 0, bestStreak: 0, evLost: 0, pre: 0, prePlayed: 0, preCoach: 0, byKind: {}, leaks: {} },
      quiz: { n: 0, right: 0 },
      live: { hands: 0, played: 0, started: null, history: [] },
    };
  }
  let S = fresh();
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));
    if (saved && saved.v === 1) S = Object.assign(fresh(), saved);
  } catch (e) { /* storage unavailable: run in memory */ }
  // Earlier versions had no straddle setting and defaulted to $300 stacks.
  if (!S.settings.straddle) { S.settings.straddle = 'random'; S.settings.stack = 200; }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) { /* ignore */ } }

  // ---------- Tabs ----------
  const tabs = document.querySelectorAll('[role="tab"]');
  function showTab(name) {
    tabs.forEach(t => t.setAttribute('aria-selected', String(t.dataset.tab === name)));
    for (const v of ['course', 'train', 'quiz', 'learn', 'stats']) $('#view-' + v).hidden = v !== name;
    if (name === 'stats') renderStats();
    if (name === 'course' && window.PokerCourse) window.PokerCourse.render();
    if (name === 'quiz' && !quizQ) nextQuiz();
    try { localStorage.setItem(KEY + '.tab2', name); } catch (e) { /* ignore */ }
  }
  tabs.forEach(t => t.addEventListener('click', () => showTab(t.dataset.tab)));

  // ---------- Cards ----------
  const SUITCLS = ['s', 'h', 'd', 'c'];
  function cardHTML(c, size) {
    const r = E.rankChar(E.rankOf(c)), s = E.suitOf(c);
    return `<span class="card ${SUITCLS[s]} ${size || ''}" aria-label="${r}${'shdc'[s]}"><b>${r === 'T' ? '10' : r}</b><i>${E.SUIT_SYM[s]}</i></span>`;
  }
  const cardsHTML = (cs, size) => cs.map(c => cardHTML(c, size)).join('');

  // ---------- Train ----------
  const KIND_LABEL = { open: 'Preflop · first in', facing: 'Preflop · facing a raise', decision: 'Call or fold', sizing: 'Bet sizing' };
  let cur = null, answered = false;

  function syncControls() {
    document.querySelectorAll('#modeSeg button').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === S.settings.mode)));
    $('#villainSel').value = S.settings.villain;
    $('#stackSel').value = String(S.settings.stack);
    $('#straddleSel').value = S.settings.straddle;
  }
  document.querySelectorAll('#modeSeg button').forEach(b => b.addEventListener('click', () => {
    S.settings.mode = b.dataset.mode; save(); syncControls(); deal();
  }));
  $('#villainSel').addEventListener('change', e => { S.settings.villain = e.target.value; save(); deal(); });
  $('#straddleSel').addEventListener('change', e => { S.settings.straddle = e.target.value; save(); deal(); });
  $('#stackSel').addEventListener('change', e => { S.settings.stack = +e.target.value; save(); deal(); });

  function renderScoreline() {
    const st = S.stats;
    const acc = st.hands ? pct((st.best + st.ok) / st.hands) : '–';
    $('#scoreline').innerHTML =
      `<span>Score <b>${st.points}</b>/<b>${st.max}</b></span>` +
      `<span>Good decisions <b>${acc}</b></span>` +
      `<span>Streak <b>${st.streak}</b></span>` +
      `<span>Drill VPIP <b>${st.pre ? pct(st.prePlayed / st.pre) : '–'}</b> vs coach <b>${st.pre ? pct(st.preCoach / st.pre) : '–'}</b></span>`;
  }

  function deal() {
    answered = false;
    $('#feedback').hidden = true;
    $('#hintWrap').innerHTML = '';
    $('#felt').innerHTML = '<p class="loading">Dealing…</p>';
    $('#actions').innerHTML = '';
    // Let the "Dealing" frame paint before the equity maths runs.
    setTimeout(() => {
      cur = C.build(S.settings.mode, { stack: S.settings.stack, villain: S.settings.villain, straddle: S.settings.straddle });
      renderSpot();
    }, 20);
  }

  function renderSpot() {
    const s = cur;
    const p = s.vk ? C.PROFILES[s.vk] : null;
    const initials = p ? p.type.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 3) : 'You';
    const villain = p
      ? `<div class="villain"><div class="vbadge" aria-hidden="true">${esc(initials)}</div><div><div class="who">${esc(p.name)} <em>· ${esc(p.type)} · VPIP ${esc(p.vpip)}</em></div><p>${esc(p.blurb)}</p></div></div>`
      : `<div class="villain"><div class="vbadge" aria-hidden="true">9</div><div><div class="who">9-handed table <em>· blinds $1/$1${s.straddler ? ` · $${C.STRADDLE} straddle (${esc(s.straddler)})` : ''}</em></div><p>Typical raise here is $18, sometimes $30. Nobody has raised yet.</p></div></div>`;
    const log = `<div class="log">${s.log.map(l => `<span>${esc(l)}</span>`).join('')}</div>`;
    const board = s.board.length
      ? `<div class="board">${cardsHTML(s.board)}</div>`
      : `<div class="board"><span class="empty">Preflop</span></div>`;
    const potTxt = s.kind === 'facing' ? `Pot $${s.pot} · to call $${s.call}`
      : s.kind === 'open' ? `Pot $${s.pot}`
      : s.kind === 'decision' ? `Pot $${s.pot} · bet $${s.bet} · to call $${s.bet}`
      : `Pot $${s.pot}`;
    const pos = s.kind === 'open' ? s.pos : s.kind === 'facing' ? s.heroPos : (s.kind === 'sizing' ? 'In position' : 'You');
    const behind = s.behind != null ? s.behind : s.stack;
    const handLabel = s.hc ? ` · <b>${esc(s.hc.label)}</b>` : ` · <b>${esc(s.key)}</b>`;
    $('#felt').innerHTML = `
      <div class="label" style="color:var(--on-felt-dim)">${esc(KIND_LABEL[s.kind])}</div>
      ${villain}
      ${log}
      <div class="row">${board}<span class="pot">${esc(potTxt)}</span></div>
      <div class="hero">
        <div class="cards">${cardsHTML(s.hero, 'big')}</div>
        <div><div class="meta">${esc(pos)} · $${behind} behind${handLabel}</div><div class="prompt">${esc(s.prompt)}</div></div>
      </div>`;
    $('#actions').innerHTML = s.actions.map(a => `<button data-a="${a.id}">${esc(a.label)}</button>`).join('');
    $('#actions').querySelectorAll('button').forEach(b => b.addEventListener('click', () => answer(b.dataset.a)));
    renderHint();
  }

  function renderHint() {
    const s = cur;
    let txt = '';
    if (s.kind === 'facing') txt = `Pot odds: $${s.call} ÷ ($${s.pot} + $${s.call}) = ${pct(s.call / (s.pot + s.call))} equity needed. Set-mining rule: stack ≥ 15× the call ($${s.call * 15}).`;
    else if (s.kind === 'decision') txt = `Pot odds: $${s.bet} ÷ ($${s.pot} + $${s.bet} + $${s.bet}) = ${pct(s.bet / (s.pot + 2 * s.bet))} equity needed. Ask: what does a ${C.PROFILES[s.vk].type.toLowerCase()} bet with here?`;
    else if (s.kind === 'sizing') txt = 'Ask: which worse hands call, and which better hands fold? If you can\'t name any, check.';
    else txt = 'Ask: is this hand in my opening range for this seat? If I raise, what size gets called by worse?';
    $('#hintWrap').innerHTML = `<button class="hintbtn" id="hintBtn">Show a hint</button><p class="hint" id="hintTxt" hidden>${esc(txt)}</p>`;
    $('#hintBtn').addEventListener('click', () => { $('#hintTxt').hidden = false; $('#hintBtn').hidden = true; });
  }

  function answer(a) {
    if (answered) return;
    answered = true;
    const g = C.grade(cur, a);
    const st = S.stats;
    st.hands++; st.max += 10; st.points += g.points;
    if (g.grade === 'best') st.best++;
    if (g.grade === 'ok') st.ok++;
    st.streak = g.good ? st.streak + 1 : 0;
    st.bestStreak = Math.max(st.bestStreak, st.streak);
    if (g.evLoss && g.grade === 'mistake') st.evLost += g.evLoss;
    const bk = st.byKind[cur.kind] || (st.byKind[cur.kind] = { n: 0, good: 0 });
    bk.n++; if (g.good) bk.good++;
    if (g.leak && !g.good) st.leaks[g.leak] = (st.leaks[g.leak] || 0) + 1;
    if (cur.kind === 'open' || cur.kind === 'facing') {
      st.pre++; if (g.played) st.prePlayed++; if (g.coachPlayed) st.preCoach++;
    }
    save();
    $('#actions').querySelectorAll('button').forEach(b => {
      b.disabled = true;
      const id = b.dataset.a;
      if (g.best.includes(id)) b.classList.add('pick-best');
      else if (id === a && g.grade === 'ok') b.classList.add('pick-ok');
      else if (id === a) b.classList.add('pick-bad');
      if (id === a) b.textContent = '✓ ' + b.textContent;
    });
    $('#hintWrap').innerHTML = '';
    renderFeedback(g);
    renderScoreline();
  }

  const GRADE_TXT = { best: 'Good call', ok: 'Acceptable', mistake: 'Mistake' };
  function renderFeedback(g) {
    const s = cur;
    let html = `<div class="verdict"><span class="pill ${g.grade}">${GRADE_TXT[g.grade]}</span><div><h3>${esc(g.headline)}</h3>`;
    if (g.grade === 'mistake' && g.evLoss > 0.5) html += `<p class="loss">This choice gives up about ${money(g.evLoss)} on average every time you make it.</p>`;
    html += '</div></div>';
    if (g.math) html += `<table class="math"><tbody>${g.math.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')}</tbody></table>`;
    if (g.evTable) {
      const bestEV = Math.max(...g.evTable.map(r => r[1]));
      html += `<div><div class="label">Average result of each option</div><div class="evs">${g.evTable.map(([lab, ev, id]) =>
        `<div class="ev${ev === bestEV ? ' top' : ''}${id === g.choice ? ' mine' : ''}"><span>${esc(lab)}</span><b>${money(ev)}</b></div>`).join('')}</div>
        <p class="small" style="margin-top:6px">Expected value: what the option wins or loses on average, counting from this decision.</p></div>`;
    }
    if (g.range && g.range.length) {
      const who = C.PROFILES[s.vk].name;
      html += `<div><div class="label">What ${esc(who)} holds when ${s.kind === 'sizing' ? 'checking' : (s.allIn ? 'shoving' : 'betting')} here</div>
        <div class="rangebar" role="img" aria-label="Range breakdown">${g.range.map(([k, v]) => `<div class="c-${k}" style="width:${(v * 100).toFixed(1)}%"></div>`).join('')}</div>
        <div class="legend">${g.range.map(([k, v]) => `<span><i class="c-${k}"></i>${esc(C.CLASS_NAMES[k])} ${pct(v)}</span>`).join('')}</div></div>`;
    }
    html += `<ul class="notes">${g.notes.map(n => `<li>${esc(n)}</li>`).join('')}</ul>`;
    html += `<button class="next" id="nextBtn">Next hand →</button>`;
    const fb = $('#feedback');
    fb.innerHTML = html;
    fb.hidden = false;
    $('#nextBtn').addEventListener('click', () => { deal(); window.scrollTo({ top: 0, behavior: 'smooth' }); });
    $('#nextBtn').focus({ preventScroll: true });
  }

  // ---------- Quiz ----------
  let quizQ = null, quizDone = false;
  function renderQuizLine() {
    $('#quizline').innerHTML = `<span>Answered <b>${S.quiz.n}</b></span><span>Correct <b>${S.quiz.n ? pct(S.quiz.right / S.quiz.n) : '–'}</b></span>`;
  }
  function nextQuiz() {
    quizQ = C.quizQuestion();
    quizDone = false;
    const q = quizQ;
    let cards = '';
    if (q.cards) {
      cards = `<div class="qcards"><div>You ${cardsHTML(q.cards.hero, 'sm')}</div><div>Board ${cardsHTML(q.cards.board, 'sm')}</div><div>Villain ${cardsHTML(q.cards.villain, 'sm')}</div></div>`;
    }
    $('#quiz').innerHTML = `<div class="label">Pot odds & outs</div><h3>${esc(q.q)}</h3>${cards}
      <div class="qopts">${q.options.map((o, i) => `<button data-i="${i}">${esc(o)}</button>`).join('')}</div>
      <div id="qexp" hidden></div>`;
    $('#quiz').querySelectorAll('.qopts button').forEach(b => b.addEventListener('click', () => answerQuiz(+b.dataset.i)));
    renderQuizLine();
  }
  function answerQuiz(i) {
    if (quizDone) return;
    quizDone = true;
    const q = quizQ, right = i === q.answer;
    S.quiz.n++; if (right) S.quiz.right++;
    save();
    $('#quiz').querySelectorAll('.qopts button').forEach((b, j) => {
      b.disabled = true;
      if (j === q.answer) b.classList.add('right');
      else if (j === i) b.classList.add('wrong');
    });
    const ex = $('#qexp');
    ex.hidden = false;
    ex.innerHTML = `<div class="verdict"><span class="pill ${right ? 'best' : 'mistake'}">${right ? 'Correct' : 'Not quite'}</span><p>${esc(q.explain)}</p></div>
      <button class="next" id="qnext" style="margin-top:12px">Next question →</button>`;
    $('#qnext').addEventListener('click', nextQuiz);
    $('#qnext').focus({ preventScroll: true });
    renderQuizLine();
  }

  // ---------- Lessons ----------
  const P = C.PROFILES;
  const LESSONS = [
    ['Why big raises punish loose calls', `
      <p>At your table a raise is $18 or $30. With $1 blinds that is <b>18 to 30 big blinds</b>, about six times a normal raise. Every loose call costs six times as much as it would in a standard game.</p>
      <ul>
        <li>Call $18 and the pot is about $38. You need roughly <b>47% equity</b> to break even, and you get it only by getting to showdown.</li>
        <li>Hands like KJo, QTo, A8o and K7s mostly make second-best hands against a raising range. You hit top pair and lose a big pot to a better kicker.</li>
        <li>Most of your $1–2k losses probably come from three spots: calling big raises with medium hands, calling down with one pair, and bluffing people who never fold.</li>
      </ul>
      <p class="callout">Main habit: <b>facing an $18 raise, you fold most hands.</b> Play pairs when the stacks are deep enough, strong aces, and premiums. Re-raise the premiums.</p>`],
    ['Pot odds in one line', `
      <p><b>Equity needed = amount to call ÷ pot after you call.</b></p>
      <p>Pot $60, villain bets $30. You call $30 into a final pot of $60 + $30 + $30 = $120. $30 ÷ $120 = <b>25%</b>. If you win more than one time in four, calling makes money.</p>
      <div class="tbl"><table><thead><tr><th>Bet size</th><th>Equity you need</th><th>Example</th></tr></thead><tbody>
        <tr><td>¼ pot</td><td class="n">17%</td><td>$10 into $40</td></tr>
        <tr><td>⅓ pot</td><td class="n">20%</td><td>$20 into $60</td></tr>
        <tr><td>½ pot</td><td class="n">25%</td><td>$30 into $60</td></tr>
        <tr><td>⅔ pot</td><td class="n">29%</td><td>$40 into $60</td></tr>
        <tr><td>Pot</td><td class="n">33%</td><td>$60 into $60</td></tr>
        <tr><td>2× pot</td><td class="n">40%</td><td>$120 into $60</td></tr>
      </tbody></table></div>
      <p>Equity is how often you win against the hands they actually have, not against the hand you hope they have. The trainer shows their range after every hand so you learn what each player type bets with.</p>`],
    ['Outs and the rule of 2 and 4', `
      <p>Outs are the cards that make you the best hand. Multiply by <b>2</b> with one card to come, or by <b>4</b> when you are all-in on the flop and see two cards.</p>
      <div class="tbl"><table><thead><tr><th>Draw</th><th>Outs</th><th>Next card</th><th>Turn + river</th></tr></thead><tbody>
        <tr><td>Gutshot</td><td class="n">4</td><td class="n">9%</td><td class="n">17%</td></tr>
        <tr><td>Two overcards</td><td class="n">6</td><td class="n">13%</td><td class="n">24%</td></tr>
        <tr><td>Open-ended straight draw</td><td class="n">8</td><td class="n">17%</td><td class="n">32%</td></tr>
        <tr><td>Flush draw</td><td class="n">9</td><td class="n">20%</td><td class="n">35%</td></tr>
        <tr><td>Flush draw + gutshot</td><td class="n">12</td><td class="n">26%</td><td class="n">45%</td></tr>
        <tr><td>Flush draw + open-ended</td><td class="n">15</td><td class="n">33%</td><td class="n">54%</td></tr>
      </tbody></table></div>
      <p>A flush draw facing a pot-sized bet on the turn needs 33% and has 20%. That is a fold unless they pay you off a lot when you hit. Discount outs that also improve them: a heart that pairs the board may give them a full house.</p>`],
    ['Implied odds and set-mining', `
      <p>Implied odds are the extra money you expect to win <b>after</b> you hit. They justify calls that lose on direct pot odds, but only when stacks are deep and the opponent pays off.</p>
      <ul>
        <li><b>Small pairs</b> flop a set about 1 time in 8.5. To call a raise just to hit a set, you want the effective stack to be at least <b>15× the call</b>. $18 raise: $270 behind. $30 raise: $450 behind.</li>
        <li>With a <b>$200 buy-in</b>, calling $18 with 22–99 just to hit a set is a fold. Your stack isn't deep enough, and neither is the raiser's if they're shorter. Buying in bigger only helps if you are the better player in the deep pots. Until then, $200 caps your losses per buy-in.</li>
        <li><b>Suited connectors</b> need even more, about 20×, plus position and an opponent who pays (stations, maniacs). Against a nit, fold them.</li>
        <li><b>Reverse implied odds</b>: hands like KJo and A9o win small pots when they are ahead and lose big ones when they are behind. That is why they are folds against big raises.</li>
      </ul>`],
    ['The five players at your table', `
      <div class="tbl"><table><thead><tr><th>Type</th><th>VPIP</th><th>How to spot</th><th>How to beat</th></tr></thead><tbody>
        ${Object.values(P).map(p => `<tr><td><b>${p.type}</b><br><span class="small">"${p.name}"</span></td><td class="n">${p.vpip}</td><td>${p.blurb}</td><td>${p.exploit}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="callout">Your "gambler" image is useful. Once you tighten up, people will keep paying you off because they expect you to be bluffing. Just don't actually bluff the stations.</p>`],
    ['Bet sizing: why you bet and how much', `
      <p>Every bet is either <b>value</b> (worse hands call) or a <b>bluff</b> (better hands fold). If you can't name worse hands that call or better hands that fold, check.</p>
      <ul>
        <li><b>Value vs calling stations</b>: bet big (⅔ pot to pot). They call anyway, so charge them.</li>
        <li><b>Value vs nits</b>: bet smaller. They only continue with strong hands, and a small bet gets a call from their medium pairs.</li>
        <li><b>Wet boards</b> (flush and straight draws possible): bet bigger with strong hands so draws pay the wrong price.</li>
        <li><b>Dry boards</b> (like K-7-2 rainbow): small bets of about ⅓ pot do the job.</li>
        <li><b>Bluffs</b> only work on players who fold: nits and TAGs. Never against stations or maniacs.</li>
      </ul>
      <div class="tbl"><table><thead><tr><th>Bluff size</th><th>They must fold at least</th></tr></thead><tbody>
        <tr><td>⅓ pot</td><td class="n">25%</td></tr><tr><td>½ pot</td><td class="n">33%</td></tr>
        <tr><td>⅔ pot</td><td class="n">40%</td></tr><tr><td>Pot</td><td class="n">50%</td></tr>
      </tbody></table></div>
      <p><b>Preflop sizing at your table:</b> open to $12–18 with a tight range and use the same size every time. Add $3–5 per limper. Don't open to $6, because five players call and you are out of position in a huge multiway pot. Don't limp.</p>`],
    ['A preflop plan for this game (9-handed)', `
      <p>Raise-first-in ranges. Fold anything not listed. Pick the row by <b>how many players are still to act behind you</b>, counting the blinds and any straddler. When there are limpers, use the row two seats earlier.</p>
      <div class="tbl"><table><thead><tr><th>Seat (no straddle)</th><th>Share</th><th>Raise with</th></tr></thead><tbody>
        ${Object.entries(C.OPEN).map(([pos, r]) => `<tr><td><b>${pos}</b></td><td class="n">${pct(E.rangePct(E.parseRange(r)))}</td><td class="mono" style="font-size:13px">${r}</td></tr>`).join('')}
      </tbody></table></div>
      <p class="small">Players behind: UTG 8, UTG+1 7, UTG+2 6, MP 5, HJ 4, CO 3, BTN 2. With a UTG straddle everyone has one extra player behind, because the straddler acts last. So UTG+1 plays the UTG row and the button plays the CO row.</p>
      <p><b>Facing an $18 raise</b>: re-raise QQ+ and AK (and more against maniacs). Call with pairs when the stack is 15× the call, and with AQ, AJs, KQs against looser openers. Fold the rest. <b>Facing $30</b>: tighten more still.</p>
      <p>Your overall VPIP (the share of hands where you put money in voluntarily) should be around <b>18–25%</b>. A "gambler" is usually at 50% or more.</p>`],
    ['Straddles and the Mississippi', `
      <p>A straddle is a voluntary third blind, here $${C.STRADDLE}, posted before the cards are dealt. The straddler acts last before the flop.</p>
      <ul>
        <li><b>UTG straddle</b>: UTG posts $${C.STRADDLE}. Action starts at UTG+1, and UTG acts last preflop but first after the flop. That is the worst seat at the table.</li>
        <li><b>Mississippi straddle</b>: the button posts $${C.STRADDLE}. In this trainer, action starts at UTG as normal, skips the button, and the button acts last preflop. It stays in position after the flop. House rules vary; some games start the action from the small blind.</li>
      </ul>
      <p><b>What it changes for you</b></p>
      <ul>
        <li>There is more dead money ($4 instead of $2), so pots get bigger and stacks are effectively shorter. $200 is only 100 straddles deep.</li>
        <li>The straddler acts after everyone preflop, so count them as one more player behind you. Play one row tighter from the preflop chart.</li>
        <li>Raise to about $18 over a straddle. A $6 raise gets called by everyone.</li>
        <li>Limping now costs $${C.STRADDLE}, and it is still a leak.</li>
      </ul>
      <p class="callout"><b>Should you straddle?</b> A UTG straddle is a blind bet out of position. It loses money over time, and it is a classic "gambler" habit. Skip it. A Mississippi straddle is much less bad because you keep position, but it still puts $${C.STRADDLE} in with a random hand. Posting a straddle does not count toward your VPIP. Calling a raise after you straddled does.</p>`],
    ['Session discipline', `
      <ul>
        <li><b>Set a stop-loss before you sit down</b>, for example three buy-ins. When you hit it, leave, even if the game looks good.</li>
        <li><b>Never rebuy angry.</b> A loss after a bad beat is when a "gambler" style comes back. Take a walk first.</li>
        <li><b>Track every session</b>: buy-in, cash-out, hours, VPIP. Use the tracker in Progress while you play: tap once per hand.</li>
        <li><b>Review three hands after each game</b>: the biggest pot you lost, one call you weren't sure about, and one fold you regretted. Rebuild them here.</li>
        <li>You are in this game for fun and to improve. Losing $1–2k a night at $1/$1 means the variance is coming from decisions, not bad luck. That is good news, because decisions can be fixed.</li>
      </ul>`],
  ];
  function renderLessons() {
    $('#lessons').innerHTML = LESSONS.map(([t, body], i) =>
      `<details${i === 0 ? ' open' : ''}><summary>${esc(t)}</summary><div class="lesson">${body}</div></details>`).join('');
  }

  // ---------- Progress ----------
  const LEAK_TIPS = {
    'Calling big raises too wide': 'Against $18+ raises, fold offsuit broadways, weak aces and suited junk. Pot odds rarely justify it.',
    'Too loose preflop': 'Stick to the opening chart for your seat. Hands outside it lose money even when they "look pretty".',
    'Limping': 'Raise or fold. Limping invites a big raise and puts you in a bloated pot with a weak hand.',
    'Too tight preflop': 'You folded a hand that makes money. Tight is good, but strong hands in position need to be played.',
    'Flat-calling premiums': 'Re-raise your best hands. Build the pot while you are ahead.',
    'Re-raising light': 'Your 3-bets should mostly be strong hands at this table. Light 3-bets get called by stations.',
    'Calling without the odds': 'Compare call ÷ final pot with your equity against their real range. If the equity is short, fold.',
    'Folding with the odds': 'When the price is good enough, calling a bet with a draw or a bluff-catcher is correct even if you often lose.',
    'Bluff-raising the wrong spot': 'Raises as bluffs only work on players who fold. Look at the villain type first.',
    'Raising instead of calling': 'Raising folds out worse hands and gets called by better. Calling kept their bluffs in.',
    'Missing value raises': 'When you are well ahead of their betting range, raise. Stations and maniacs pay off.',
    'Missing value bets': 'Checking a strong hand gives free cards and lets worse hands off the hook. Bet.',
    'Missing good bluffs': 'Against nits and TAGs that checked, a small bet often takes the pot.',
    'Betting too thin': 'Only worse hands fold and better hands call. Check and take the showdown.',
    'Bluffing the wrong player': 'Never bluff calling stations or maniacs. Bet only when you have it.',
    'Bet sizing': 'Size up for value against loose players, size down against tight players.',
  };
  let confirmReset = false, confirmSession = false;
  function renderStats() {
    const st = S.stats;
    const acc = st.hands ? pct((st.best + st.ok) / st.hands) : '–';
    const kinds = Object.entries(st.byKind).map(([k, v]) =>
      `<div class="tile"><span>${esc(KIND_LABEL[k])}</span><b>${pct(v.good / v.n)}</b><small>${v.good} good of ${v.n}</small></div>`).join('');
    const leaks = Object.entries(st.leaks).sort((a, b) => b[1] - a[1]);
    const L = S.live;
    const vp = L.hands ? L.played / L.hands : 0;
    const drillV = st.pre ? st.prePlayed / st.pre : 0;
    const scale = x => Math.min(100, x * 100 / 0.7);
    $('#stats').innerHTML = `
      <div class="panel tracker">
        <div class="label">Live session tracker</div>
        <h3>Tap once per hand at your real game</h3>
        <p class="small">Tap "Played" if you put money in voluntarily (called or raised; posting a blind and checking doesn't count). Aim for 18–25%.</p>
        <div class="tbtns">
          <button class="fold" id="tFold">Folded preflop</button>
          <button class="play" id="tPlay">Played the hand</button>
        </div>
        <div>
          <div class="row" style="justify-content:space-between"><span>This session: <b class="num">${L.hands}</b> hands, played <b class="num">${L.played}</b></span><span>VPIP <b class="num">${L.hands ? pct(vp) : '–'}</b></span></div>
          <div class="gauge" style="margin-top:8px" role="img" aria-label="VPIP gauge, target 18 to 25 percent">
            <div class="band" style="left:${scale(0.18)}%;width:${scale(0.25) - scale(0.18)}%"></div>
            ${L.hands ? `<div class="mark" style="left:${scale(vp)}%"></div>` : ''}
          </div>
          <div class="gscale"><span>0%</span><span>target 18–25%</span><span>70%+</span></div>
          ${L.hands >= 20 ? `<p class="small" style="margin-top:6px">${vp > 0.3 ? 'You are playing too many hands. Fold more preflop, especially against $18+ raises.' : vp < 0.14 ? 'Very tight. Fine, but make sure you raise your good hands.' : 'Right in the zone. Keep it up.'}</p>` : ''}
        </div>
        <div class="row">
          <button class="linkbtn" id="tUndo" ${L.hands ? '' : 'disabled'}>Undo last tap</button>
          <span id="sessWrap">${confirmSession
            ? `<span class="confirm">Save this session and start a new one? <button class="yes" id="sessYes">Yes, new session</button><button id="sessNo">Cancel</button></span>`
            : `<button class="linkbtn" id="tNew">Finish session</button>`}</span>
        </div>
        ${L.history.length ? `<div class="tbl"><table class="hist"><thead><tr><th>Date</th><th>Hands</th><th>VPIP</th></tr></thead><tbody>
          ${L.history.slice(-8).reverse().map(h => `<tr><td>${esc(h.date)}</td><td class="n">${h.hands}</td><td class="n">${pct(h.played / Math.max(1, h.hands))}</td></tr>`).join('')}</tbody></table></div>` : ''}
      </div>

      <div style="height:14px"></div>
      <div class="tiles">
        <div class="tile"><span>Decisions</span><b>${st.hands}</b><small>${st.best} best · ${st.ok} acceptable</small></div>
        <div class="tile"><span>Good decisions</span><b>${acc}</b><small>best + acceptable</small></div>
        <div class="tile"><span>Drill VPIP</span><b>${st.pre ? pct(drillV) : '–'}</b><small>coach: ${st.pre ? pct(st.preCoach / st.pre) : '–'} on the same hands</small></div>
        <div class="tile"><span>Given away</span><b>${money(st.evLost)}</b><small>in expected value from postflop mistakes</small></div>
        <div class="tile"><span>Best streak</span><b>${st.bestStreak}</b><small>good decisions in a row</small></div>
        <div class="tile"><span>Odds quiz</span><b>${S.quiz.n ? pct(S.quiz.right / S.quiz.n) : '–'}</b><small>${S.quiz.right} of ${S.quiz.n} correct</small></div>
      </div>
      ${kinds ? `<div style="height:14px"></div><div class="tiles">${kinds}</div>` : ''}

      <div style="height:14px"></div>
      <div class="panel">
        <div class="label">Your leaks</div>
        ${leaks.length ? `<div class="leaks">${leaks.map(([k, n]) => `<div class="leak"><b>${esc(k)}</b><span class="c">×${n}</span><p>${esc(LEAK_TIPS[k] || '')}</p></div>`).join('')}</div>`
          : '<p class="small">No mistakes logged yet. Play some hands in Train, and your most common mistakes will be listed here with a fix for each.</p>'}
        <div id="resetWrap">${confirmReset
          ? `<span class="confirm">Erase all training stats? <button class="yes" id="resetYes">Erase</button><button id="resetNo">Cancel</button></span>`
          : `<button class="linkbtn danger" id="resetBtn">Reset training stats</button>`}</div>
      </div>`;
    const on = (id, fn) => { const el = $('#' + id); if (el) el.addEventListener('click', fn); };
    on('tFold', () => { liveTap(false); });
    on('tPlay', () => { liveTap(true); });
    on('tUndo', () => {
      const last = L.last || [];
      const wasPlay = last.pop();
      if (wasPlay === undefined) return;
      L.hands--; if (wasPlay) L.played--;
      L.last = last; save(); renderStats();
    });
    on('tNew', () => { confirmSession = true; renderStats(); });
    on('sessNo', () => { confirmSession = false; renderStats(); });
    on('sessYes', () => {
      if (L.hands) L.history.push({ date: new Date().toLocaleDateString(), hands: L.hands, played: L.played });
      L.hands = 0; L.played = 0; L.last = [];
      confirmSession = false; save(); renderStats();
    });
    on('resetBtn', () => { confirmReset = true; renderStats(); });
    on('resetNo', () => { confirmReset = false; renderStats(); });
    on('resetYes', () => {
      S.stats = fresh().stats; S.quiz = fresh().quiz;
      confirmReset = false; save(); renderStats(); renderScoreline(); renderQuizLine();
    });
  }
  function liveTap(played) {
    const L = S.live;
    L.hands++; if (played) L.played++;
    L.last = (L.last || []).slice(-50); L.last.push(played);
    save(); renderStats();
  }

  // ---------- Boot ----------
  syncControls();
  renderScoreline();
  renderLessons();
  let startTab = 'course';
  try { startTab = localStorage.getItem(KEY + '.tab2') || 'course'; } catch (e) { /* ignore */ }
  const hashTab = (location.hash || '').slice(1);
  if (['course', 'train', 'quiz', 'learn', 'stats'].includes(hashTab)) startTab = hashTab;
  showTab(startTab);
  deal();
})();
