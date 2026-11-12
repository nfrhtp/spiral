'use strict';
/*
 * Drawing the fretboard (SVG).
 *
 * Orientation is a MIRROR of the guitar as the player sees it:
 *   row 0 (top)  = lowest string (thickest line)
 *   nut on the left, frets running to the right.
 *
 * "six"    view: the real 6 strings, frets 0..N (fret 0 = open, drawn left of the nut).
 * "spiral" view: 12 rows x (N+1) columns lattice. The real strings are rows 3..8
 *                (4th to 9th from the top); rows above are lower, rows below are higher,
 *                each row a fourth (5 semitones) apart, exactly like the real strings.
 */
const Render = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const INLAY_SINGLE = [3, 5, 7, 9, 15, 17, 21];
  const INLAY_DOUBLE = [12, 24];
  const STRING_WIDTHS = [6, 5, 4, 3.2, 2.4, 1.7]; // low (top) to high (bottom)

  function el(tag, attrs, parent) {
    const e = document.createElementNS(NS, tag);
    for (const k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, str, cls, size, baseline) {
    const t = el('text', { x, y, class: cls, 'font-size': size,
      'text-anchor': 'middle', 'dominant-baseline': baseline || 'central' }, parent);
    t.textContent = str;
    return t;
  }

  // Where the visual centre of each Greek letter sits above its baseline, as a fraction of
  // the font size (Times metrics: x-height 0.45, ascender 0.68, descender 0.22). Placing the
  // baseline this far below the dot's centre puts the ink, not the font box, in the middle.
  const LUMA_INK_CENTRE = { 'α': 0.224, 'β': 0.309, 'γ': 0.116, 'δ': 0.342, 'ε': 0.224 };
  function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

  function geometry(state) {
    const six = state.view === 'six';
    const rows = six ? 6 : 12;
    const cols = state.frets + 1;
    const W = 1600, mx = 40;
    const ml = 80;                         // wider left margin: room for the open-string note names
    const cellW = (W - ml - mx) / cols;
    const rowGap = six ? cellW * 1.25 : cellW * 0.95;
    const my = six ? 70 : 50;
    const H = rowGap * rows + 2 * my;
    // Row 0 is always the lowest string. 'mirror' draws it on top (player's view);
    // 'standard' draws it at the bottom (higher notes higher on screen).
    const flip = state.orientation === 'standard';
    return {
      six, rows, cols, W, H, mx, ml, my, cellW, rowGap, flip,
      x: f => ml + cellW * (f + 0.5),      // dot centre for fret f
      y: r => my + rowGap * ((flip ? rows - 1 - r : r) + 0.5),  // string row r
      wire: k => ml + cellW * (k + 1),     // fret wire k (k = 0 is the nut)
      hitR: Math.min(cellW, rowGap) * 0.36,                                   // full-size radius (click target)
      r: Math.min(cellW, rowGap) * 0.36 * ((+state.dotSize || 100) / 100),   // dot radius at the chosen size
      anchorRow: six ? 0 : 3,              // row of the real lowest string
    };
  }

  // MIDI note of the open string on a given row.
  function openOfRow(state, row) {
    const base = state.view === 'six' ? 0 : 3;
    // Standard tuning (six-string view only): the 4th and 5th strings up from the lowest
    // (rows 3 and 4) are a major third apart, so every string from row 4 up sits a semitone lower.
    const third = state.tuning === 'standard' && state.view === 'six' && row >= 4 ? 1 : 0;
    return state.openLow + 5 * (row - base) - third;
  }

  // Which positions belong to the scale pattern (or null when pattern mode is off).
  // The pattern takes n consecutive scale notes per string, starting at
  // state.patternFret on the lowest real string and continuing upward in pitch;
  // rows above the anchor (only in the spiral view) continue it downward.
  function patternKeys(state, g, parent) {
    if (state.pattern === 'off') return null;
    const set = new Set();
    for (let pc = 0; pc < 12; pc++) {
      if (Theory.classify(pc, parent).kind === state.pattern) set.add(pc);
    }
    const n = state.pattern === 'chroma' ? 3 : 2;
    const keys = new Set();
    let start = openOfRow(state, g.anchorRow) + state.patternFret;
    while (!set.has(Theory.mod(start, 12))) start++;

    let cursor = start;
    for (let r = g.anchorRow; r < g.rows; r++) {
      let count = 0;
      for (let q = cursor; count < n; q++) {
        if (!set.has(Theory.mod(q, 12))) continue;
        const f = q - openOfRow(state, r);
        if (f >= 0 && f <= state.frets) keys.add(r + ':' + f);
        count++; cursor = q + 1;
      }
    }
    cursor = start - 1;
    for (let r = g.anchorRow - 1; r >= 0; r--) {
      let count = 0;
      for (let q = cursor; count < n; q--) {
        if (!set.has(Theory.mod(q, 12))) continue;
        const f = q - openOfRow(state, r);
        if (f >= 0 && f <= state.frets) keys.add(r + ':' + f);
        count++; cursor = q - 1;
      }
    }
    return keys;
  }

  function drawDot(parent, x, y, r, info, state, parentRoot, extraClass) {
    const cls = ['dot', info.kind === 'chroma' ? 'chroma deg-' + info.degree : 'luma', extraClass || ''].join(' ');
    const grp = el('g', { class: cls, transform: `translate(${x},${y})` }, parent);
    if (info.kind === 'chroma' && info.degree === 1) {
      // "1" is a half-and-half dot: left white, right black.
      el('path', { d: `M0,${-r} A${r},${r} 0 0 0 0,${r} Z`, class: 'half-l' }, grp);
      el('path', { d: `M0,${-r} A${r},${r} 0 0 1 0,${r} Z`, class: 'half-r' }, grp);
      el('circle', { r, class: 'half-ring' }, grp);
    } else {
      el('circle', { r }, grp);
    }
    if (info.kind === 'luma' && state.lumaLabel === 'greek') {
      const fs = r * 1.15;
      text(grp, 0, (LUMA_INK_CENTRE[info.letter] || 0.25) * fs, info.letter, 'greek', fs, 'alphabetic');
    } else if (info.kind === 'luma' && state.lumaLabel === 'degree') {
      // Distance from the mode's root (C Minor pentatonic: 1 · ♭3 · 4 · 5 · ♭7; C Ionian: ♭2 ♭3 ♭5 ♭6 ♭7),
      // in every mode since 2026-11-12. Same size as chroma note names.
      const label = Theory.intervalName(info.pc - state.root);
      const fs = r * 0.85;
      text(grp, 0, 0.34 * fs, label, 'degree', fs, 'alphabetic');
    } else if (info.kind === 'luma' && state.lumaLabel === 'name') {
      // Note name, always with flats: luma notes are the parent's flatted degrees (♭2 ♭3 ♭5 ♭6 ♭7),
      // so C Minor pentatonic reads C Eb F G Bb. Same size as chroma note names.
      text(grp, 0, 0, Theory.NAMES_FLAT[info.pc], 'degree', r * 0.85);
    }
    if (info.kind === 'chroma' && (state.chromaLabel === 'name' || state.chromaLabel === 'degree')) {
      // Note name (spelled in the parent key), or scale degree counted from the mode's root
      // (G# Aeolian: G# = 1, B = ♭3, E = ♭6), written the same way as the pentatonic luma degrees.
      const nm = state.chromaLabel === 'name' ? Theory.noteName(info.pc, parentRoot)
                                              : Theory.intervalName(info.pc - state.root);
      if (info.degree === 1) {
        // Half-and-half "1" dot: the letter ends just left of the centre line, on the white half in
        // the dark color; a ♭/♯ starts just right of it, on the black half in the light color. So the
        // pair sits about as close as on a solid dot, and a lone letter stays near the middle.
        const gap = r * 0.05;
        text(grp, -gap, 0, nm[0], 'name on-light', r * 0.85).setAttribute('text-anchor', 'end');
        if (nm.length > 1) text(grp, gap, 0, nm.slice(1), 'name on-dark', r * 0.85).setAttribute('text-anchor', 'start');
      } else {
        text(grp, 0, 0, nm, 'name', r * 0.85);
      }
    }
    return grp;
  }

  // String thickness by row. Six-string view: row = string. Twelve-row view: rows 3..8 are the
  // real strings; rows below them in pitch get thicker still, rows above look like the high string.
  function stringWidth(row, rows) {
    if (rows === 6) return STRING_WIDTHS[row];
    if (row < 3) return STRING_WIDTHS[0] + (3 - row) * 1.3;
    if (row > 8) return STRING_WIDTHS[5];
    return STRING_WIDTHS[row - 3];
  }

  // The open-string note to the left of each of the six real strings, styled like the fret numbers.
  // In the Spiral view only the six playable rows (3..8) get one. Hidden with the fret numbers in clean view.
  function drawOpenNames(gp, g, state, size) {
    // Open strings are named the way guitarists name them (D G C F Bb Eb), whatever the key.
    for (let r = g.anchorRow; r < g.anchorRow + 6; r++) {
      const pc = Theory.mod(openOfRow(state, r), 12);
      const t = text(gp, g.ml - 18, g.y(r), Theory.NAMES_FLAT[pc], 'fretnum', size);
      t.setAttribute('text-anchor', 'end');
    }
  }

  // A guitar neck: wood, nut, fret wires, inlays, strings of varying thickness.
  // Used for the six-string view and for the "Guitar neck" style of the Spiral view.
  function drawNeck(gp, g, state) {
    const rows = g.rows;
    const top = g.my, bottom = g.H - g.my, left = g.ml, right = g.W - g.mx;
    const nutX = g.wire(0);
    // The six-string neck sits on the plain page background; only the 12-row neck gets the faint
    // fretboard tint plus the brighter band marking the six playable strings.
    if (!g.six) {
      el('rect', { x: nutX, y: top, width: right - nutX, height: bottom - top, class: 'wood' }, gp);
      const bandTop = Math.min(g.y(3), g.y(8)) - g.rowGap / 2;
      el('rect', { x: left, y: bandTop, width: right - left, height: g.rowGap * 6, class: 'band' }, gp);
    }
    for (const yy of [top, bottom]) {
      const off = yy === top ? -7 : 7;
      el('line', { x1: left, y1: yy, x2: right, y2: yy, class: 'edge' }, gp);
      el('line', { x1: left, y1: yy + off, x2: right, y2: yy + off, class: 'edge thin' }, gp);
    }
    for (let k = 1; k <= state.frets; k++) {
      el('line', { x1: g.wire(k), y1: top, x2: g.wire(k), y2: bottom, class: 'fret' }, gp);
    }
    el('line', { x1: nutX, y1: top, x2: nutX, y2: bottom, class: 'nut' }, gp);

    const mid = rows / 2;
    const inlayR = g.cellW * 0.075;
    for (let f = 1; f <= state.frets; f++) {
      const single = INLAY_SINGLE.includes(f), dbl = INLAY_DOUBLE.includes(f);
      if (single) el('circle', { cx: g.x(f), cy: (g.y(mid - 1) + g.y(mid)) / 2, r: inlayR, class: 'inlay' }, gp);
      if (dbl) {
        el('circle', { cx: g.x(f), cy: (g.y(mid - 2) + g.y(mid - 1)) / 2, r: inlayR, class: 'inlay' }, gp);
        el('circle', { cx: g.x(f), cy: (g.y(mid) + g.y(mid + 1)) / 2, r: inlayR, class: 'inlay' }, gp);
      }
      if (single || dbl) text(gp, g.x(f), bottom + 30, String(f), 'fretnum', 20);
    }
    for (let r = 0; r < rows; r++) {
      el('line', { x1: left, y1: g.y(r), x2: right, y2: g.y(r), class: 'string',
                   'stroke-width': stringWidth(r, rows) }, gp);
    }
    drawOpenNames(gp, g, state, 20);
  }

  // The abstract lattice: fine lines only, no nut, no string thickness. A faint band marks the real strings.
  function drawGrid(gp, g, state) {
    const top = g.my, bottom = g.H - g.my, left = g.ml, right = g.W - g.mx;
    const bandTop = Math.min(g.y(3), g.y(8)) - g.rowGap / 2;
    el('rect', { x: left, y: bandTop, width: right - left, height: g.rowGap * 6, class: 'band' }, gp);
    // Vertical lines sit between the dots and look like fret wires (wire(-1) is the left edge);
    // horizontals look like strings, all at the thin weight of the high string. No nut.
    for (let k = -1; k <= state.frets; k++) {
      el('line', { x1: g.wire(k), y1: top, x2: g.wire(k), y2: bottom, class: 'fret' }, gp);
    }
    for (let r = 0; r < g.rows; r++) {
      el('line', { x1: left, y1: g.y(r), x2: right, y2: g.y(r), class: 'string', 'stroke-width': STRING_WIDTHS[5] }, gp);
    }
    for (let f = 1; f <= state.frets; f++) {
      if (INLAY_SINGLE.includes(f) || INLAY_DOUBLE.includes(f)) text(gp, g.x(f), bottom + 24, String(f), 'fretnum', 18);
    }
    drawOpenNames(gp, g, state, 18);
  }

  // Build the whole board. Returns geometry, the parent "1", a map of every
  // position (key "row:fret") and the SVG group where live highlights go.
  function build(svg, state) {
    clear(svg);
    const g = geometry(state);
    svg.setAttribute('viewBox', `0 0 ${g.W} ${g.H}`);
    const parent = Theory.parentRoot(state.root, state.mode);
    const pat = patternKeys(state, g, parent);
    const positions = new Map();

    const board = el('g', { class: 'board' }, svg);
    if (g.six || state.spiralStyle !== 'grid') drawNeck(board, g, state); else drawGrid(board, g, state);

    const dots = el('g', { class: 'dots' }, svg);
    for (let r = 0; r < g.rows; r++) {
      for (let f = 0; f <= state.frets; f++) {
        const pitch = openOfRow(state, r) + f;
        const pc = Theory.mod(pitch, 12);
        const info = Object.assign({ pc, pitch }, Theory.classify(pc, parent));
        // Chroma dots never show in a pentatonic mode (Kevin, 2026-11-12), whatever the chroma setting.
        const layerOn = info.kind === 'chroma' ? state.chroma && !Theory.modeById(state.mode).penta : state.luma;
        const key = r + ':' + f;
        const visible = state.dots !== 'played' && layerOn && (!pat || pat.has(key));
        const pos = { key, row: r, fret: f, x: g.x(f), y: g.y(r), r: g.r, hitR: g.hitR, pitch, info, visible };
        positions.set(key, pos);
        if (visible) drawDot(dots, pos.x, pos.y, g.r, info, state, parent);
      }
    }
    const liveLayer = el('g', { class: 'live-layer' }, svg);
    return { geometry: g, parent, positions, liveLayer };
  }

  return { el, build, drawDot, openOfRow };
})();

/*
 * Live highlights: rings around the positions currently being played.
 */
const Live = (() => {
  let layer = null, positions = null, state = null, parent = 0;
  const active = new Map();

  function reset(board, st) {
    layer = board.liveLayer; positions = board.positions; parent = board.parent; state = st;
    active.clear();
  }
  function on(keys) {
    if (!layer) return;
    for (const key of keys) {
      const pos = positions.get(key);
      if (!pos) continue;
      const a = active.get(key);
      if (a) { clearTimeout(a.timer); a.el.classList.remove('off'); continue; }
      const grp = Render.el('g', { class: 'live', transform: `translate(${pos.x},${pos.y})` }, layer);
      // In "played only" mode the note appears as a full dot; otherwise an off-pattern note shows as a ghost.
      // A played note off the visible dots gets its dot drawn here, except a chroma note in a
      // pentatonic mode, which shows as the ring alone (no chroma dots in pentatonic modes).
      const noChromaHere = pos.info.kind === 'chroma' && Theory.modeById(state.mode).penta;
      if (!pos.visible && !noChromaHere) Render.drawDot(grp, 0, 0, pos.r, pos.info, state, parent, state.dots === 'played' ? '' : 'ghost');
      Render.el('circle', { r: pos.r * 1.45, class: 'ring-outer' }, grp);
      Render.el('circle', { r: pos.r * 1.45, class: 'ring-inner' }, grp);
      active.set(key, { el: grp, timer: null });
    }
  }
  function off(keys) {
    for (const key of keys) {
      const a = active.get(key);
      if (!a) continue;
      a.el.classList.add('off');
      a.timer = setTimeout(() => { a.el.remove(); active.delete(key); }, 600);
    }
  }
  function allOff() { off([...active.keys()]); }
  return { reset, on, off, allOff };
})();
