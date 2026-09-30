# Pokertings Trainer

A poker trainer for a $1/$1 home game where raises are usually $18 or $30, not 3bb.
It scores your decisions and explains the maths behind each one: pot odds, equity against real ranges, implied odds and bet sizing.

Open `index.html` in a browser. There's no build step and no server.

## What's inside

- **Course** (start here): 16 beginner lessons in 5 modules. Hand rankings → reading the board → how a hand plays out → position → hand shorthand → which hands to play → facing big raises → what you flopped → outs → pot odds → player types → why you bet → calling bets → bankroll → tilt → a personal game plan. Each lesson has short reading pages, then a practice round with fresh questions every time; you have to pass it to unlock the next lesson.

- **Train**: 9-handed hands (with optional UTG or Mississippi straddles) dealt against five opponent types (Nit, TAG, LAG, Calling station, Maniac)
  - *Preflop*: first in (open, limp or fold, and the raise size) and facing $18/$30 raises (fold, call or 3-bet)
  - *Call or fold*: an opponent bets or shoves on the flop, turn or river. It's graded by expected value against that opponent's betting range.
  - *Bet sizing*: the opponent checks to you. Choose check, ⅓, ⅔, pot or all-in. It's graded by expected value against their checking range and how often they call.
- **Odds quiz**: required equity, the rule of 2 and 4, counting real outs, and bluff break-even frequency
- **Lessons**: short, game-specific notes on the ideas behind the drills
- **Progress**: score, accuracy, EV given away, a list of your leaks with a fix for each, and a **live VPIP tracker** to tap through at your real game

Progress is stored in your browser only (localStorage).

## Files

- `engine.js`: card evaluator, range parser, Monte Carlo and exact equity, hand classifier
- `coach.js`: villain profiles, preflop charts, scenario generation, grading, quiz
- `course.js`: the beginner course (lessons, question generators, game plan)
- `app.js`, `index.html`: the interface

## Tests

```
node test/engine.test.js
node test/coach.test.js
```

## Model notes

The grading is a teaching model, not a solver. Villain ranges are hand-written per player type, and on later streets they are narrowed by what each type would have bet or called earlier.
Postflop EV looks one street ahead, with an implied-odds allowance for draws on the turn.
Preflop calls use equity against the opener's range, adjusted for position and playability, plus the 15× stack rule for set-mining.
