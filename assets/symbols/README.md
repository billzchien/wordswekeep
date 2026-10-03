# Ribbon Draw: Words We Keep category symbols

Motion handoff for the six category symbols: All, Perspective, Growth, Drive, Community, Romance.

## Files

| File | What it is |
| --- | --- |
| `symbol-transitions.json` | Symbol-to-symbol transitions. It holds the six symbols as ribbons, the 15 hand-drawn bridges (one per pair, usable both ways), the settings and the fixed constants. |
| `symbol-draw-in.json` | Draw-in for each symbol on its own. It holds the six symbols as ribbons, with settings and constants for drawing a symbol in from nothing. |
| `ribbon-draw.js` | Reference implementation, with no framework. The geometry functions are pure: data goes in and SVG path strings come out. `createRenderer` paints frames into an `<svg viewBox="0 0 60 60">`. The prototype runs on exactly this code and data. |

## Motion

- **Transition A → B:** one ribbon makes the whole trip.
  - The thick (leading) end leaves A at its thick tip, follows the A/B bridge and starts B at B's thick tip.
  - The thin (trailing) end sets off 50 ms later and lands on B's thick tip.
  - When the leading end reaches B's thin tip, the ribbon is exactly B.
  - Easing is `cubic-bezier(0.4, 0, 0, 1)`. Duration is 800 ms.
- **Draw-in:** the stroke starts at the symbol's thick tip and is drawn to its thin tip. Same 800 ms and same easing. Depth is fade only (10%), with no blur.
- **Depth (transitions):**
  - The end being drawn stays crisp.
  - Moving back along the new symbol, opacity drops and blur grows, reaching max at the new symbol's thick tip.
  - Anything older than that (rest of the bridge, what's left of the old symbol) stays at the max.
  - Max fade is 10%. Max blur radius is 3% of the 60-unit box (Gaussian σ = 0.9 units).
  - The effect eases in over the first 20% of the duration and clears over the last 40%, so the first and last frames are the exact symbols.
- **Moving ends** narrow to a point over 2 units. The narrowing fades out as each end lands.
- **Rest state:** draw the symbol's `path` translated by its `offset`. That is the exact Figma outline.

## Using the reference code

```js
import transitions from './symbol-transitions.json';
import { createModel, createRenderer, play } from './ribbon-draw.js';

import drawIn from './symbol-draw-in.json';

const model = createModel(transitions);
const r = createRenderer(svgElement, model, { drawInModel: createModel(drawIn) });   // ink colour = the svg's CSS `color`
r.rest('All');
play(model, t => r.transition('All', 'Growth', t));
// draw-in: play(model, t => r.drawIn('Growth', t));
```

## Implementation notes

- **Settings vs constants.** `settings` holds the tunable values: duration, delay, easing, max fade and max blur. `constants` holds values that are fixed by design. `createModel(data, overrides)` accepts setting overrides.
- **Interrupting mid-transition.** Snap to the nearer symbol, or let the current transition finish, then start the next one from a rest state. Transitions are defined rest-to-rest.
- **Reduced motion.** `play` jumps straight to the end when `prefers-reduced-motion` is set.
- **Rendering.** The depth effect relies on `mix-blend-mode: plus-lighter` inside an isolated group, so the pieces of the ribbon add up with no seams. All current engines support it. A canvas or WebGL port can do the same with additive compositing.
- **Small sizes.** For 20 px symbols, `createRenderer(svg, model, { levels: 2, pieces: 10 })` and `stride: 3` keep the cost low.
