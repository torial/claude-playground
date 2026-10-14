# Rewrite

A puzzle game about string rewriting. The player writes an ordered list of rules for a small machine; the machine has to turn each input string into the right output. Eight levels (flip, sort, tidy, even or odd, doubler, add one, balanced, reverse) and a sandbox.

Single page, no dependencies, no network use except Google Fonts. Open `dist/index.html`.

## The machine

A Markov algorithm. Rules are ordered. Each step finds the first rule, from the top, whose pattern occurs anywhere in the string, rewrites the leftmost occurrence, and starts again from the top. An empty pattern occurs at the start of every string. A rule marked *stop* ends the run after it fires. A run also fails after 5000 steps or when the string exceeds 300 characters. Spaces are removed from every field; rows with an empty pattern, empty replacement and no stop mark are ignored.

## Layout

| Path | Contents |
|---|---|
| `src/core.js` | Engine, level definitions (task, spec function, visible cases, hidden-case generator, reference solution) and `check()`. Runs in the browser and in Node. |
| `src/app.js`, `src/body.html`, `src/style.css` | Interface. |
| `build.cjs` | Produces `dist/index.html` (standalone) and `dist/artifact.html` (fragment for a host that supplies `<html>`/`<head>`). |
| `tests/run.cjs` | `node tests/run.cjs` |

## How a level is judged

Each level has a `spec` function giving the right answer for any input. The visible cases are shown to the player. `check()` also runs hidden cases: every string up to a length bound over the level's alphabet, plus seeded random longer ones (270 to 530 per level, 27 for the two unary levels). A failing hidden case is reported as a counterexample with a button to run it, so the player is never told only "wrong".

## What the tests establish

`tests/run.cjs` is built so each check can fail:

1. Each reference solution passes all visible and hidden cases.
2. Deleting any single rule from a reference solution makes it fail. This found one dead rule in the first Balanced solution (`(N → N` can never fire, because the leftmost `(` is always the one turned into `N`); it was removed and par is now 8.
3. A cheater that memorises the visible cases passes them and fails hidden ones on every level. The first version of the cheater did not even pass the visible cases (a short memorised pattern fired inside a longer input), which was a bug in the test, fixed by sorting patterns longest first.
4. Engine limits: an `a → a` loop ends as `limit`, `a → aa` as `overflow`, stop rules stop, leftmost beats later, rule order beats position.
5. Specs agree with hand-worked answers.

Not tested: the interface was driven through the DOM once (levels 1 and 8 solved by filling rows and pressing Check) and viewed at desktop and 375 px width in light and dark. There are no automated UI tests.

## Notes for a maintainer

- Par is the length of the reference solution, which is not proven minimal. A player can go under it; the game says so.
- Progress is in `localStorage` under `rewrite.v1`, wrapped in try/catch; the page works without it.
- To add a level, add an object to `levels` in `core.js` with a `spec` and a `solution`, then run the tests. The deletion test will tell you whether the solution has a dead rule.
