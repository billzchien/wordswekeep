/**
 * Ribbon Draw — reference implementation for the Words We Keep category symbols.
 *
 * Reads the two data files:
 *   symbol-transitions.json  (symbol -> symbol, along Bill's hand-drawn bridges)
 *   symbol-draw-in.json      (one symbol drawing in on its own)
 *
 * Framework-free. The geometry functions are pure (data in, SVG path strings out); `createRenderer` paints a frame into
 * an <svg viewBox="0 0 60 60">. Port either part as needed; the numbers in the JSON are the source of truth.
 *
 * Coordinates: the 60 x 60 symbol box, y down. Every symbol is a single ribbon described by its two edges ("left"/"right"),
 * sampled every `sampleStep` units of centre-line length, ordered from the THICK tip to the THIN tip.
 */

// ---------------------------------------------------------------- helpers
const clamp01 = x => x < 0 ? 0 : x > 1 ? 1 : x;
const smoothstep = x => { x = clamp01(x); return x*x*(3 - 2*x); };
export function cubicBezier(x1, y1, x2, y2){
  const cx = 3*x1, bx = 3*(x2-x1) - cx, ax = 1 - cx - bx, cy = 3*y1, by = 3*(y2-y1) - cy, ay = 1 - cy - by;
  const X = t => ((ax*t + bx)*t + cx)*t, Y = t => ((ay*t + by)*t + cy)*t;
  return x => { if (x <= 0) return 0; if (x >= 1) return 1; let lo = 0, hi = 1, t = x;
    for (let i = 0; i < 50; i++){ const v = X(t); if (Math.abs(v - x) < 1e-7) break; if (v < x) lo = t; else hi = t; t = (lo + hi)/2; } return Y(t); };
}
function lower(s, v){ let lo = 0, hi = s.length-1; while (lo < hi){ const mid = (lo+hi+1) >> 1; if (s[mid] <= v) lo = mid; else hi = mid-1; } return lo; }
const pairs = flat => { const out = []; for (let i = 0; i < flat.length; i += 2) out.push([flat[i], flat[i+1]]); return out; };

// ---------------------------------------------------------------- model
/** Build a model from either JSON file (or both merged). `overrides` may replace any value in `settings`. */
export function createModel(data, overrides = {}){
  const S = { ...data.settings, ...overrides, depth: { ...data.settings.depth, ...(overrides.depth || {}) } };
  const C = data.constants;
  const ease = cubicBezier(...S.easing);
  const step = data.sampleStep;
  const symbols = {};
  for (const [name, ic] of Object.entries(data.symbols)) symbols[name] = { e0: ic.left, e1: ic.right, m: ic.left.length/2, path: ic.path, offset: ic.offset };
  return { data, S, C, ease, step, symbols, cache: {} };
}

// One ribbon "track" = arrays of left/right edge points with centre-line arc length s.
function finishTrack(e0, e1){
  const m = e0.length/2, x = new Float64Array(m), y = new Float64Array(m), s = new Float64Array(m);
  for (let i = 0; i < m; i++){ x[i] = (e0[i*2]+e1[i*2])/2; y[i] = (e0[i*2+1]+e1[i*2+1])/2; if (i) s[i] = s[i-1] + Math.max(Math.hypot(x[i]-x[i-1], y[i]-y[i-1]), 1e-4); }
  return { e0, e1, x, y, s, m, L: s[m-1] };
}

/**
 * Transition track for a -> b:  A's body (thin tip -> splice) + bridge (A splice -> B splice) + B's body (splice -> thin tip).
 * Each symbol's thick terminal (tip -> splice) is kept as a "ghost" laid over the first/last stretch of the bridge, so the
 * window at rest shows exactly the symbol and the terminal eases into / out of the bridge while moving.
 * Bridges are stored once per pair ("A/B", running A -> B); for b -> a the same bridge is run backwards.
 */
export function transitionTrack(M, a, b){
  const key = a + '>' + b; if (M.cache[key]) return M.cache[key];
  let br = M.data.bridges[a + '/' + b], rev = false;
  if (!br){ br = M.data.bridges[b + '/' + a]; rev = true; }
  if (!br) throw new Error(`No bridge between ${a} and ${b}`);
  let bL = pairs(br.left), bR = pairs(br.right), sA = br.spliceA, sB = br.spliceB;
  if (rev){ const L = bR.slice().reverse(), R = bL.slice().reverse(); bL = L; bR = R; sA = br.spliceB; sB = br.spliceA; }
  const A = M.symbols[a], B = M.symbols[b], iA = Math.round(sA / M.step), iB = Math.round(sB / M.step);
  const e0 = [], e1 = [], kind = [];
  for (let i = A.m-1; i > iA; i--){ e0.push(A.e1[i*2], A.e1[i*2+1]); e1.push(A.e0[i*2], A.e0[i*2+1]); kind.push(0); }   // backwards: sides swap
  for (let i = 0; i < bL.length; i++){ e0.push(bL[i][0], bL[i][1]); e1.push(bR[i][0], bR[i][1]); kind.push(1); }
  for (let i = iB+1; i < B.m; i++){ e0.push(B.e0[i*2], B.e0[i*2+1]); e1.push(B.e1[i*2], B.e1[i*2+1]); kind.push(2); }
  const T = finishTrack(e0, e1);
  T.sJA = T.s[kind.indexOf(1)]; T.sJB = T.s[kind.lastIndexOf(1)];
  const ghost = (I, i0, swap) => { const g = { e0: [], e1: [], s: [] }; let acc = 0, px = null, py = null;
    for (let i = i0; i >= 0; i--){ const cx = (I.e0[i*2]+I.e1[i*2])/2, cy = (I.e0[i*2+1]+I.e1[i*2+1])/2; if (px !== null) acc += Math.hypot(cx-px, cy-py); px = cx; py = cy;
      const L = swap ? I.e1 : I.e0, R = swap ? I.e0 : I.e1; g.e0.push(L[i*2], L[i*2+1]); g.e1.push(R[i*2], R[i*2+1]); g.s.push(acc); }
    roundTip(g); return g; };
  T.gA = ghost(A, iA, true); T.gB = ghost(B, iB, false);
  T.LtA = T.gA.s[T.gA.s.length-1]; T.LtB = T.gB.s[T.gB.s.length-1];
  T.jA = T.sJA + T.LtA;    // rest position of the leading (thick) end: A's thick tip
  T.jB = T.sJB - T.LtB;    // rest position of the trailing (thin) end at the finish: B's thick tip
  return M.cache[key] = T;
}
/** Draw-in track: the symbol itself, thick tip -> thin tip. */
export function drawInTrack(M, n){
  const key = 'in:' + n; if (M.cache[key]) return M.cache[key];
  const I = M.symbols[n]; return M.cache[key] = finishTrack(I.e0, I.e1);
}

// A copy of a ghost terminal whose angled tip cut is replaced by a round end (used while it is moving).
function roundTip(g){
  const n = g.s.length, L = g.s[n-1], Lc = Math.min(1.4, L*0.4), e0 = g.e0.slice(), e1 = g.e1.slice();
  let k = n-1; while (k > 0 && g.s[k] > L - Lc) k--;
  const cx = (g.e0[k*2]+g.e1[k*2])/2, cy = (g.e0[k*2+1]+g.e1[k*2+1])/2, k2 = Math.max(k-4, 0);
  const px = (g.e0[k2*2]+g.e1[k2*2])/2, py = (g.e0[k2*2+1]+g.e1[k2*2+1])/2;
  let tx = cx-px, ty = cy-py; const tl = Math.hypot(tx, ty) || 1; tx /= tl; ty /= tl;
  const hx = (g.e0[k*2]-g.e1[k*2])/2, hy = (g.e0[k*2+1]-g.e1[k*2+1])/2, span = L - g.s[k];
  for (let i = k+1; i < n; i++){ const d = g.s[i] - g.s[k], u = Math.min(d/span, 1), m = Math.sqrt(Math.max(1 - u*u, 0)), x = cx + tx*d, y = cy + ty*d;
    e0[i*2] = x + hx*m; e0[i*2+1] = y + hy*m; e1[i*2] = x - hx*m; e1[i*2+1] = y - hy*m; }
  g.r0 = e0; g.r1 = e1;
}
function sampleGhost(g, d, ex){
  const n = g.s.length; d = Math.min(Math.max(d, 0), g.s[n-1]);
  const i = Math.min(lower(g.s, d), n-2), u = clamp01((d - g.s[i]) / Math.max(g.s[i+1]-g.s[i], 1e-9)), I = i*2, J = I+2, f = (A, k) => A[I+k] + (A[J+k]-A[I+k])*u;
  return [0, 1].flatMap(side => { const A = side ? g.e1 : g.e0, R = side ? g.r1 : g.r0; return [f(R,0) + (f(A,0)-f(R,0))*ex, f(R,1) + (f(A,1)-f(R,1))*ex]; });
}

// ---------------------------------------------------------------- one frame
/**
 * Frame state for a transition at normalised time t (0..1 over settings.durationMs).
 * The leading end (thick) runs from A's thick tip, along the bridge, to B's thin tip; the trailing end (thin) follows
 * `thinEndDelayMs` later and lands on B's thick tip. Both use the same easing.
 */
export function transitionFrame(M, a, b, t){
  const T = transitionTrack(M, a, b), S = M.S, C = M.C;
  const ms = t*S.durationMs, run = Math.max(S.durationMs - S.thinEndDelayMs, 1);
  const eh = M.ease(clamp01(ms/run)), et = M.ease(clamp01((ms - S.thinEndDelayMs)/run));
  const head = T.jA + (T.L - T.jA)*eh, tail = T.jB*et;
  const wa = 1 - smoothstep((head - T.jA) / C.terminalSettle);           // A's terminal lets go as the head leaves
  const wb = smoothstep((tail - (T.jB - C.terminalSettle)) / C.terminalSettle);   // B's terminal settles as the tail lands
  return { T, t, head, tail, wa, wb,
    kh: 1 - smoothstep((head - (T.L - 3))/3), LH: C.thickEndTaper*(1 - wa**4),
    kt: smoothstep(tail/3), LT: C.thinEndTaper*(1 - wb**4),
    // Where the depth gradient starts (full fade and blur there, none at the leading end). Default: B's thick tip,
    // with everything older held at the max. settings.depth.span = 'ribbon': the trailing (thin) end, so the gradient
    // runs the whole visible ribbon from the first frame and the leading (thick) end is always crisp.
    depthFrom: S.depth.span === 'ribbon' ? tail : Math.max(T.jB, tail) };
}
/** Frame state for a single symbol drawing in: the leading end runs from the thick tip to the thin tip; nothing trails. */
export function drawInFrame(M, n, t){
  const T = drawInTrack(M, n), S = M.S, C = M.C;
  const head = T.L * M.ease(clamp01(t));
  return { T, t, head, tail: 0, wa: 0, wb: 0, kh: 1 - smoothstep((head - (T.L - 3))/3), LH: C.thickEndTaper, kt: 0, LT: 0, depthFrom: 0 };
}

function edgesAt(F, pos){
  const T = F.T, i = Math.min(Math.max(lower(T.s, pos), 0), T.m-2), u = clamp01((pos - T.s[i]) / Math.max(T.s[i+1]-T.s[i], 1e-9)), I = i*2, J = I+2;
  const r = [T.e0[I]+(T.e0[J]-T.e0[I])*u, T.e0[I+1]+(T.e0[J+1]-T.e0[I+1])*u, T.e1[I]+(T.e1[J]-T.e1[I])*u, T.e1[I+1]+(T.e1[J+1]-T.e1[I+1])*u];
  if (T.gA){
    const hA = Math.max(F.head, T.jA), tB = Math.min(F.tail, T.jB);
    if (F.wa > 0 && pos > T.sJA && pos <= hA){ const g = sampleGhost(T.gA, (pos - T.sJA) * T.LtA / (hA - T.sJA), F.wa**4); for (let k = 0; k < 4; k++) r[k] += (g[k]-r[k])*F.wa; }
    if (F.wb > 0 && pos < T.sJB && pos >= tB){ const g = sampleGhost(T.gB, (T.sJB - pos) * T.LtB / (T.sJB - tB), F.wb**4); for (let k = 0; k < 4; k++) r[k] += (g[k]-r[k])*F.wb; }
  }
  return r;
}
/** Closed SVG outline of the ribbon between arc positions lo..hi (clamped to the frame's window), with the end tapers. */
export function outline(F, lo = -Infinity, hi = Infinity, stride = 1){
  const T = F.T, head = F.head, tail = F.tail, A0 = Math.max(tail, lo), A1 = Math.min(head, hi);
  if (head - tail < 0.05 || A1 - A0 < 0.02) return '';
  const Lp = [], Rp = [];
  const emit = pos => {
    const r = edgesAt(F, pos); let mH = 1, mT = 1;
    if (F.LH > 0.05 && F.kh > 0){ const u = clamp01((head - pos)/F.LH); mH = 1 - F.kh*Math.pow(1-u, 2.2); }
    if (F.LT > 0.05 && F.kt > 0){ const u = clamp01((pos - tail)/F.LT); mT = 1 - F.kt*(1-u)*(1-u); }
    const m = mH*mT, cx = (r[0]+r[2])/2, cy = (r[1]+r[3])/2;
    Lp.push((cx + (r[0]-cx)*m).toFixed(3) + ' ' + (cy + (r[1]-cy)*m).toFixed(3));
    Rp.push((cx + (r[2]-cx)*m).toFixed(3) + ' ' + (cy + (r[3]-cy)*m).toFixed(3));
  };
  const stops = [];
  for (let i = lower(T.s, A0) + 1, i1 = lower(T.s, A1); i <= i1; i += stride) if (T.s[i] > A0 && T.s[i] < A1) stops.push(T.s[i]);
  for (let d = 0.04; d < 1.5; d += 0.12){ stops.push(tail + d); stops.push(head - d); }     // keep the tapers round
  emit(A0); stops.filter(p => p > A0 && p < A1).sort((p, q) => p - q).forEach(emit); emit(A1);
  return 'M' + Lp.join('L') + 'L' + Rp.reverse().join('L') + 'Z';
}
export function centre(F, pos){ const q = edgesAt(F, Math.min(Math.max(pos, F.tail), F.head)); return [(q[0]+q[2])/2, (q[1]+q[3])/2]; }

/**
 * Depth: the end being drawn is crisp; going back along the new symbol, fade and blur grow to their max at the new symbol's
 * thick tip, and everything older than that (rest of the bridge, what is left of the old symbol) sits at the max.
 * The amount eases in over the first `depthEaseIn` of the duration and clears over the last `depthClear`.
 *
 * Returns { rest } at t <= 0 / t >= 1, otherwise:
 *   base:    outline of everything older than the new symbol, drawn at max blur `sigma` and opacity `baseOpacity`
 *   sigma:   max Gaussian std-deviation in symbol units; level l uses sigma * l/(levels-1)
 *   pieces:  the new symbol cut into short pieces; each has its outline, the centre points where it starts/ends, and for
 *            every blur level the opacity at its start (v0) and end (v1). Paint each piece with a linear gradient
 *            from p0 (v0) to p1 (v1) into its level, so tone is continuous across cuts.
 */
export function depthPlan(M, F, rest, { levels = 5, pieces = 48, stride = 1 } = {}){
  const S = M.S, C = M.C, t = F.t;
  if (t <= 0 || t >= 1) return { rest };
  const k = smoothstep(t / C.depthEaseIn) * (1 - smoothstep((t - (1 - C.depthClear)) / C.depthClear));
  const sigma = S.depth.maxBlur/100 * 60 / 2 * k, fmax = S.depth.maxFade * k;     // maxBlur: % of the 60-unit box, as a blur radius
  const s0 = F.depthFrom, span = F.head - s0, plan = { sigma, levels, base: '', baseOpacity: 1 - fmax, pieces: [] };
  if (sigma < 0.005 && fmax < 0.005){ plan.base = outline(F, -Infinity, Infinity, stride); plan.baseOpacity = 1; plan.sigma = 0; return plan; }
  if (span < 0.05){ plan.base = outline(F, -Infinity, Infinity, stride); return plan; }
  plan.base = outline(F, -Infinity, s0, stride);
  const val = (e, l) => { e = 1 - e; return Math.max(0, 1 - Math.abs(e*(levels-1) - l)) * (1 - fmax*e); };   // e: 0 at the new symbol's thick tip, 1 at the drawing end
  let pA = centre(F, s0);
  for (let i = 0; i < pieces; i++){
    const e0 = i/pieces, e1 = (i+1)/pieces, a1 = s0 + span*e1, pB = centre(F, a1);
    const v0 = [], v1 = []; for (let l = 0; l < levels; l++){ v0.push(val(e0, l)); v1.push(val(e1, l)); }
    plan.pieces.push({ d: outline(F, s0 + span*e0, i < pieces-1 ? a1 : Infinity, stride), p0: pA, p1: pB, v0, v1 });
    pA = pB;
  }
  return plan;
}

// ---------------------------------------------------------------- SVG renderer
/**
 * Paints plans into an <svg viewBox="0 0 60 60">. Ink colour = the svg's CSS `color`.
 * Pass `drawInModel` (a model built from symbol-draw-in.json) to use the draw-in file's settings for drawIn().
 * Technique: everything is drawn in black and ADDED (mix-blend-mode: plus-lighter) inside an isolated group, so pieces
 * that share a cut add back to exactly one coverage and neighbouring blur levels blend with no seam (blur is linear);
 * the summed alpha is then tinted to the ink colour in one filter pass.
 */
export function createRenderer(svg, M, { levels = 5, pieces = 48, drawInModel = M } = {}){
  const NS = 'http://www.w3.org/2000/svg', uid = 'rd' + Math.random().toString(36).slice(2, 8);
  const mk = (parent, tag, attrs = {}) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); parent.appendChild(e); return e; };
  const region = { filterUnits: 'userSpaceOnUse', x: -20, y: -20, width: 100, height: 100 };
  const defs = mk(svg, 'defs');
  const rest = mk(svg, 'path', { fill: 'currentColor' });
  const tint = mk(defs, 'filter', { id: uid + 't', ...region, 'color-interpolation-filters': 'sRGB' });
  mk(tint, 'feFlood', { 'flood-color': 'currentColor', result: 'c' }); mk(tint, 'feComposite', { in: 'c', in2: 'SourceAlpha', operator: 'in' });
  const g = mk(svg, 'g', { filter: `url(#${uid}t)` }); g.style.isolation = 'isolate';
  const add = (parent, tag, attrs) => { const e = mk(parent, tag, attrs); e.style.mixBlendMode = 'plus-lighter'; return e; };
  const blur = [], layers = []; let base;
  for (let l = 0; l < levels; l++){
    const attrs = {};
    if (l){ const f = mk(defs, 'filter', { id: `${uid}f${l}`, ...region }); blur[l] = mk(f, 'feGaussianBlur', { stdDeviation: 0 }); attrs.filter = `url(#${uid}f${l})`; }
    const lg = add(g, 'g', attrs); lg.style.isolation = 'isolate';
    const ps = [];
    for (let i = 0; i < pieces; i++){
      const gr = mk(defs, 'linearGradient', { id: `${uid}g${l}_${i}`, gradientUnits: 'userSpaceOnUse' });
      const st = [mk(gr, 'stop', { offset: 0, 'stop-color': '#000' }), mk(gr, 'stop', { offset: 1, 'stop-color': '#000' })];
      const p = add(lg, 'path', { fill: `url(#${uid}g${l}_${i})` }); p._g = gr; p._s = st; ps.push(p);
    }
    layers.push(ps);
    if (l === levels-1) base = add(lg, 'path', { fill: '#000' });     // older parts sit at max blur
  }
  const clear = () => { base.setAttribute('d', ''); layers.forEach(ps => ps.forEach(p => p.setAttribute('d', ''))); };
  function paint(plan){
    if (plan.rest){ const ic = M.symbols[plan.rest]; rest.setAttribute('d', ic.path); rest.setAttribute('transform', `translate(${ic.offset[0]} ${ic.offset[1]})`); clear(); return; }
    rest.setAttribute('d', ''); clear();
    for (let l = 1; l < levels; l++) blur[l].setAttribute('stdDeviation', (plan.sigma*l/(levels-1)).toFixed(3));
    // with no depth (sigma 0) the base still sits in the last level; its blur is 0 then
    base.setAttribute('d', plan.base); base.setAttribute('opacity', plan.baseOpacity.toFixed(4));
    plan.pieces.forEach((pc, i) => {
      for (let l = 0; l < levels; l++){
        const p = layers[l][i]; if (pc.v0[l] <= 0 && pc.v1[l] <= 0) continue;
        p.setAttribute('d', pc.d);
        p._g.setAttribute('x1', pc.p0[0].toFixed(3)); p._g.setAttribute('y1', pc.p0[1].toFixed(3)); p._g.setAttribute('x2', pc.p1[0].toFixed(3)); p._g.setAttribute('y2', pc.p1[1].toFixed(3));
        p._s[0].setAttribute('stop-opacity', pc.v0[l].toFixed(4)); p._s[1].setAttribute('stop-opacity', pc.v1[l].toFixed(4));
      }
    });
  }
  return {
    /** Symbol a -> symbol b at t in 0..1. */
    transition(a, b, t, stride = 1){ paint(depthPlan(M, transitionFrame(M, a, b, t), t >= 1 ? b : a, { levels, pieces, stride })); },
    /** Symbol n drawing in at t in 0..1 (t = 0 draws nothing). */
    drawIn(n, t, stride = 1){ if (t <= 0){ rest.setAttribute('d', ''); clear(); return; } const D = drawInModel; paint(depthPlan(D, drawInFrame(D, n, t), n, { levels, pieces, stride })); },
    rest(n){ paint({ rest: n }); },
  };
}

/** Minimal player: animates t from 0 to 1 over settings.durationMs. Honour prefers-reduced-motion by jumping to the end. */
export function play(M, step, done){
  const reduce = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce){ step(1); done && done(); return () => {}; }
  let raf = 0; const t0 = performance.now();
  const tick = now => { const t = Math.min((now - t0) / M.S.durationMs, 1); step(t); if (t < 1) raf = requestAnimationFrame(tick); else done && done(); };
  raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
}
