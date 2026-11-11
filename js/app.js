'use strict';
(() => {
  const STORAGE = 'spacetime-spiral-v1';
  const ROOT_LABELS = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
  const THEMES = [
    { id: 'paper',       name: 'Paper',        dark: false },
    { id: 'studio',      name: 'Studio',       dark: false },
    { id: 'stage',       name: 'Stage',        dark: true  },
    { id: 'neon',        name: 'Neon',         dark: true  },
    { id: 'okabe',       name: 'Okabe–Ito',    dark: false },
    { id: 'autumn',      name: 'Autumn',       dark: false },
    { id: 'pastelnight', name: 'Pastel Night', dark: true  },
    { id: 'jewel',       name: 'Jewel',        dark: true  },
    { id: 'pop',         name: 'Pop',          dark: false },
  ];
  const themeById = id => THEMES.find(t => t.id === id) || THEMES[1];

  const DEFAULTS = {
    root: 0, mode: 0,                      // C Ionian
    view: 'six',                           // 'six' | 'spiral'
    spiralStyle: 'neck',                   // 'neck' | 'grid' — how the 12-string Spiral view is drawn
    orientation: 'standard',               // 'mirror' (low string on top) | 'standard' (high string on top)
    chroma: true, luma: false, names: false,
    lumaLabel: 'none',                     // 'none' | 'greek' | 'degree' (distance from the mode root)
    dots: 'all',                           // 'all' | 'played' (only the notes being played)
    dotSize: 100,                          // 100 | 75 | 50 — dot diameter, % of the original
    clean: false,                          // true hides the key badge, MIDI pill and fret numbers (key I)
    pattern: 'off', patternFret: 8,        // 'off' | 'chroma' | 'luma'
    openLow: 38,                           // D2 — lowest open string (MIDI note)
    tuning: 'fourths',                     // 'fourths' (all fourths) | 'standard' (major third between strings 4 and 5)
    frets: 18,
    theme: 'studio',
    midiDevice: 'all', stringMap: 'ch1high', transpose: 0, pcChannel: 'any',
    presets: [{ name: '', root: 0, mode: 0 }],
  };

  const $ = s => document.querySelector(s);
  const svg = $('#board');
  let state = load();
  let board = null;
  const held = new Map();      // "ch:note" -> keys lit for that note
  let pointerKey = null;

  function load() {
    let s;
    let raw = {};
    try { raw = JSON.parse(localStorage.getItem(STORAGE) || '{}'); } catch (e) { raw = {}; }
    s = Object.assign({}, DEFAULTS, raw);
    // Mode 7 used to be "Blues"; it is now "Major pentatonic", and Blues lives on as "Minor pentatonic" (11).
    if (raw.modeSet !== 2) {
      if (s.mode === 7) s.mode = 11;
      for (const p of s.presets || []) if (p.mode === 7) p.mode = 11;
    }
    s.modeSet = 2;
    s.panelOpen = /[?&]panel=1/.test(location.search); // board in full view unless ?panel=1
    if (s.theme === 'light') s.theme = 'studio';   // names from before the palette system
    if (s.theme === 'dark') s.theme = 'stage';
    if (s.presets && s.presets.length === 1 && s.presets[0].name === 'Example song') s.presets = [{ name: '', root: 0, mode: 0 }];
    if (s.greek !== undefined) { if (s.greek) s.lumaLabel = 'greek'; delete s.greek; }  // pre-label-option setting
    // Overrides in the web address, e.g. index.html?view=spiral&theme=dark&root=2&mode=1
    const q = new URLSearchParams(location.search);
    for (const k of ['view', 'spiralStyle', 'orientation', 'dots', 'theme', 'pattern', 'stringMap', 'lumaLabel', 'tuning']) if (q.has(k)) s[k] = q.get(k);
    for (const k of ['root', 'mode', 'patternFret', 'frets', 'openLow', 'transpose', 'dotSize']) if (q.has(k)) s[k] = +q.get(k);
    for (const k of ['chroma', 'luma', 'names', 'clean']) if (q.has(k)) s[k] = q.get(k) !== '0' && q.get(k) !== 'false';
    if (q.has('greek')) s.lumaLabel = (q.get('greek') !== '0' && q.get('greek') !== 'false') ? 'greek' : 'none';
    return s;
  }
  function save() {
    const copy = Object.assign({}, state);
    delete copy.panelOpen;
    localStorage.setItem(STORAGE, JSON.stringify(copy));
  }
  const isPenta = mode => !!(Theory.MODES[mode] && Theory.MODES[mode].penta);
  function set(patch) {
    const wasPenta = isPenta(state.mode);
    Object.assign(state, patch);
    const nowPenta = isPenta(state.mode);
    if (state.tuning === 'standard') state.view = 'six';   // the 12-row Spiral only makes sense in all fourths
    // Entering a pentatonic mode hides the colored chroma dots so only the pentatonic shows;
    // leaving it restores whatever the chroma setting was before.
    // it also turns the luma dots on (they are the whole picture there). Moving between pentatonic
    // modes changes nothing; leaving them restores both settings.
    if (nowPenta && !wasPenta) {
      state.chromaBeforePenta = state.chroma; state.chroma = false;
      state.lumaBeforePenta = state.luma; state.luma = true;
    }
    else if (wasPenta && !nowPenta) {
      state.chroma = state.chromaBeforePenta !== false;
      if (state.lumaBeforePenta !== undefined) state.luma = state.lumaBeforePenta;
      if (state.lumaLabel === 'degree') state.lumaLabel = 'none';   // degrees are a pentatonic-only crutch
    }
    render();
  }

  // ---------- rendering ----------
  function render() {
    const t = themeById(state.theme);
    document.body.className = 'theme-' + t.id + (t.dark ? ' dark' : ' light') + (state.clean ? ' clean' : '');
    board = Render.build(svg, state);
    Live.reset(board, state);
    held.clear();
    const parentName = Theory.noteName(board.parent, board.parent);
    $('#badge').textContent = `${Theory.describe(state.root, state.mode)}  ·  1 = ${parentName}`;
    syncPanel();
    save();
  }

  // ---------- mapping played notes onto the board ----------
  function stringFromChannel(ch) {
    if (state.stringMap === 'pitch' || ch < 1 || ch > 6) return null;
    return state.stringMap === 'ch1high' ? 6 - ch : ch - 1; // 0 = lowest string
  }
  function keysForNote(string, pitch) {
    const g = board.geometry;
    if (string != null) {
      const row = string + g.anchorRow;
      let f = pitch - Render.openOfRow(state, row);
      // A hard attack often makes the GR-20 report the note an octave low. The string is
      // right, the octave isn't — so lift it into range rather than lighting every position.
      while (f < 0) f += 12;
      if (f >= 0 && f <= state.frets) return [row + ':' + f];
    }
    const keys = [];
    for (let r = 0; r < g.rows; r++) {
      const f = pitch - Render.openOfRow(state, r);
      if (f >= 0 && f <= state.frets) keys.push(r + ':' + f);
    }
    return keys;
  }

  // ---------- MIDI ----------
  const HOLD_LIMIT_MS = 20000;   // safety net: no note stays lit longer than this without a fresh note-on
  const holdTimers = new Map();
  function releaseHeld(k) {
    clearTimeout(holdTimers.get(k));
    holdTimers.delete(k);
    const keys = held.get(k);
    if (keys) { Live.off(keys); held.delete(k); }
  }
  function releaseChannel(ch, exceptKey) {
    for (const k of [...held.keys()]) if (k.startsWith(ch + ':') && k !== exceptKey) releaseHeld(k);
  }
  function allNotesOff() {
    for (const k of [...held.keys()]) releaseHeld(k);
    Live.allOff();
  }
  Midi.on('noteon', m => {
    const pitch = m.note + state.transpose;
    const string = stringFromChannel(m.ch);
    const k = m.ch + ':' + m.note;
    // One string sounds one note at a time: a new note on a per-string channel ends the previous one.
    if (string != null) releaseChannel(m.ch, k);
    const keys = keysForNote(string, pitch);
    held.set(k, keys);
    clearTimeout(holdTimers.get(k));
    holdTimers.set(k, setTimeout(() => releaseHeld(k), HOLD_LIMIT_MS));
    Live.on(keys);
    $('#midi-last').textContent = `ch ${m.ch} · note ${m.note} = ${Theory.midiName(pitch, board.parent)} · vel ${m.vel}`;
  });
  Midi.on('noteoff', m => releaseHeld(m.ch + ':' + m.note));
  Midi.on('cc', m => {
    // 120 = All Sound Off, 123 = All Notes Off — guitar synths send these when strings are muted.
    if (m.cc === 120 || m.cc === 123) releaseChannel(m.ch);
  });
  Midi.on('program', m => {
    if (state.pcChannel !== 'any' && m.ch !== +state.pcChannel) return;
    const p = state.presets[m.program];
    if (p) {
      set({ root: p.root, mode: p.mode });
      toast(`PC ${m.program + 1}: ${p.name ? p.name + ' — ' : ''}${Theory.describe(p.root, p.mode)}`);
    } else {
      toast(`PC ${m.program + 1}: no preset`);
    }
  });
  let midiReady = false;
  function midiStatus(text, cls) {
    $('#midi-status').textContent = text;
    const pill = $('#midi-pill');
    pill.textContent = 'MIDI: ' + text;
    pill.className = cls;
  }
  Midi.on('devices', list => {
    midiReady = true;
    const sel = $('#midiDevice');
    sel.innerHTML = '';
    sel.add(new Option('All inputs', 'all'));
    for (const i of list) sel.add(new Option(i.name, i.id));
    sel.value = list.some(i => i.id === state.midiDevice) ? state.midiDevice : 'all';
    Midi.select(sel.value);
    if (list.length) midiStatus('ready — ' + list.map(i => i.name).join(', '), 'ready');
    else midiStatus('ready, but no MIDI inputs found. Is the interface plugged in?', 'waiting');
  });
  Midi.on('error', e => {
    // Embedded preview windows (Granular's preview, Electron apps) look like Chrome but can't grant MIDI access.
    const ua = navigator.userAgent;
    const embedded = /Electron/i.test(ua) || !/Chrome\//.test(ua);
    if (embedded) midiStatus('not available in this preview window — use the Google Chrome window instead', 'waiting');
    else midiStatus('blocked by Chrome. Click the icon at the left of the address bar, allow MIDI devices, then reload.', 'error');
  });
  function connectMidi() {
    if (!Midi.supported()) { midiStatus('not available in this browser. Use Google Chrome.', 'error'); return; }
    if (midiReady) return;
    midiStatus('waiting for Chrome’s permission — look for an "Allow" bubble under the address bar', 'waiting');
    Midi.init();
  }

  // ---------- pointer testing (click a position to "play" it) ----------
  function svgPoint(e) {
    const pt = svg.createSVGPoint();
    pt.x = e.clientX; pt.y = e.clientY;
    return pt.matrixTransform(svg.getScreenCTM().inverse());
  }
  function nearest(pt) {
    let best = null, bestD = Infinity;
    for (const pos of board.positions.values()) {
      const d = Math.hypot(pos.x - pt.x, pos.y - pt.y);
      if (d < bestD) { bestD = d; best = pos; }
    }
    return best && bestD <= best.hitR * 1.3 ? best : null;   // full-size target even when dots are small
  }
  svg.addEventListener('pointerdown', e => {
    const pos = nearest(svgPoint(e));
    if (!pos) return;
    if (e.shiftKey && pos.row === board.geometry.anchorRow) { set({ patternFret: pos.fret }); return; }
    pointerKey = pos.key;
    Live.on([pointerKey]);
    svg.setPointerCapture(e.pointerId);
  });
  const pointerRelease = () => { if (pointerKey) { Live.off([pointerKey]); pointerKey = null; } };
  svg.addEventListener('pointerup', pointerRelease);
  svg.addEventListener('pointercancel', pointerRelease);

  // ---------- panel ----------
  function buttonGroup(container, items, field) {
    container.innerHTML = '';
    items.forEach((label, i) => {
      const b = document.createElement('button');
      b.textContent = label;
      b.dataset.value = i;
      b.onclick = () => set({ [field]: i });
      container.appendChild(b);
    });
  }
  function buildPanel() {
    buttonGroup($('#roots'), ROOT_LABELS, 'root');
    // Church modes in one row, pentatonic modes in the row below; each button's value is its MODES index.
    for (const [box, penta] of [[$('#modes'), false], [$('#pentas'), true]]) {
      box.innerHTML = '';
      Theory.MODES.forEach((m, i) => {
        if (!!m.penta !== penta) return;
        const b = document.createElement('button');
        b.textContent = m.short || m.name;
        b.title = m.name;
        b.dataset.value = i;
        b.onclick = () => set({ mode: i });
        box.appendChild(b);
      });
    }
    const tc = $('#themes');
    for (const t of THEMES) {
      // Each row carries its palette's class, so its dots and background show that palette's real colors.
      const b = document.createElement('button');
      b.className = 'theme-row theme-' + t.id + (t.dark ? ' dark' : ' light');
      b.dataset.value = t.id;
      b.innerHTML = `<span class="tname">${t.name}</span><span class="tdots">` +
        `<span class="half"></span><span class="d2"></span><span class="d3"></span><span class="d4"></span>` +
        `<span class="d5"></span><span class="d6"></span><span class="d7"></span><span class="dl"></span></span>`;
      b.onclick = () => set({ theme: t.id });
      tc.appendChild(b);
    }

    document.querySelectorAll('.btn-row[data-field]').forEach(row => {
      row.querySelectorAll('button').forEach(b => {
        b.onclick = () => {
          const v = b.dataset.value;
          set({ [row.dataset.field]: row.dataset.field === 'dotSize' ? +v : v });
        };
      });
    });
    for (const id of ['chroma', 'luma', 'names', 'clean']) {
      $('#' + id).onchange = e => set({ [id]: e.target.checked });
    }
    $('#patternFret').onchange = e => set({ patternFret: clamp(+e.target.value, 0, state.frets) });
    $('#frets').onchange = e => set({ frets: clamp(+e.target.value, 12, 24) });
    $('#transpose').onchange = e => set({ transpose: clamp(+e.target.value, -24, 24) });

    const ol = $('#openLow');
    for (let m = 33; m <= 47; m++) {
      let label = Theory.midiName(m, 0);
      if (m === 40) label += '  (standard fourths)';
      if (m === 38) label += '  (down a whole step)';
      ol.add(new Option(label, m));
    }
    ol.onchange = e => set({ openLow: +e.target.value });
    $('#stringMap').onchange = e => set({ stringMap: e.target.value });
    const pcc = $('#pcChannel');
    pcc.add(new Option('Any channel', 'any'));
    for (let c = 1; c <= 16; c++) pcc.add(new Option('Channel ' + c, c));
    pcc.onchange = e => set({ pcChannel: e.target.value });
    $('#midiDevice').onchange = e => { state.midiDevice = e.target.value; Midi.select(state.midiDevice); save(); };

    $('#preset-add').onclick = () => {
      state.presets.push({ name: 'New song', root: state.root, mode: state.mode });
      buildPresets(); save();
    };
    $('#panel-toggle').onclick = () => togglePanel();
    $('#panel-close').onclick = () => togglePanel(false);
    $('#help-chip').onclick = () => toggleHelp();
    $('#fullscreen').onclick = () => toggleFullscreen();
    $('#midi-connect').onclick = () => connectMidi();
    buildPresets();
  }
  function buildPresets() {
    const box = $('#presets');
    box.innerHTML = '';
    state.presets.forEach((p, i) => {
      const row = document.createElement('div');
      row.className = 'preset';
      row.innerHTML = `<span class="pc">PC ${i + 1}</span><input class="pname" placeholder="Song name"><select class="proot"></select><select class="pmode"></select><button class="pload" title="Load this preset">▶</button><button class="pdel" title="Remove">×</button>`;
      const name = row.querySelector('.pname'), rs = row.querySelector('.proot'), ms = row.querySelector('.pmode');
      name.value = p.name;
      ROOT_LABELS.forEach((l, j) => rs.add(new Option(l, j)));
      Theory.MODES.forEach((m, j) => ms.add(new Option(m.name, j)));
      rs.value = p.root; ms.value = p.mode;
      name.onchange = e => { p.name = e.target.value; save(); };
      rs.onchange = e => { p.root = +e.target.value; save(); };
      ms.onchange = e => { p.mode = +e.target.value; save(); };
      row.querySelector('.pload').onclick = () => set({ root: p.root, mode: p.mode });
      row.querySelector('.pdel').onclick = () => { state.presets.splice(i, 1); buildPresets(); save(); };
      box.appendChild(row);
    });
  }
  function syncPanel() {
    const mark = (container, value) => container.querySelectorAll('button').forEach(b =>
      b.classList.toggle('active', String(b.dataset.value) === String(value)));
    mark($('#roots'), state.root);
    mark($('#modes'), state.mode);
    mark($('#pentas'), state.mode);
    mark($('#themes'), themeById(state.theme).id);
    document.querySelectorAll('.btn-row[data-field]').forEach(row => mark(row, state[row.dataset.field]));
    const spiralBtn = document.querySelector('.btn-row[data-field="view"] button[data-value="spiral"]');
    spiralBtn.disabled = state.tuning === 'standard';
    spiralBtn.title = spiralBtn.disabled ? 'The Spiral view needs All Fourths tuning' : '';
    for (const id of ['chroma', 'luma', 'names', 'clean']) $('#' + id).checked = state[id];
    $('#patternFret').value = state.patternFret;
    $('#frets').value = state.frets;
    $('#transpose').value = state.transpose;
    $('#openLow').value = state.openLow;
    $('#stringMap').value = state.stringMap;
    $('#pcChannel').value = state.pcChannel;
    const parent = Theory.parentRoot(state.root, state.mode);
    const pn = Theory.noteName(parent, parent);
    let hint = `Colors are measured from ${pn} as "1". Luma = the five notes outside ${pn} major.`;
    if (isPenta(state.mode)) {
      const m = Theory.MODES[state.mode];
      hint = `${Theory.describe(state.root, state.mode)}: the root is the black luma ${Theory.LUMA[m.offset]} note; the five luma dots are ${Theory.noteName(state.root, parent)} ${m.name}. Colors are measured from ${pn} as "1".`;
    }
    $('#key-hint').textContent = hint;
    const degBtn = document.querySelector('.btn-row[data-field="lumaLabel"] button[data-value="degree"]');
    if (degBtn) degBtn.style.display = isPenta(state.mode) ? '' : 'none';
    $('#panel').classList.toggle('hidden', !state.panelOpen);
  }
  function togglePanel(force) {
    state.panelOpen = force === undefined ? !state.panelOpen : force;
    $('#panel').classList.toggle('hidden', !state.panelOpen);
    save();
  }
  function toggleHelp(force) {
    const h = $('#help');
    h.classList.toggle('hidden', force === undefined ? !h.classList.contains('hidden') : !force);
  }
  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen();
    else document.documentElement.requestFullscreen();
  }
  function clamp(v, lo, hi) { return Math.min(hi, Math.max(lo, isNaN(v) ? lo : v)); }

  let toastTimer = null;
  function toast(msg) {
    const t = $('#toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 2500);
  }

  // Move the pattern start to the previous/next scale note on the low string.
  function stepPattern(dir) {
    const kind = state.pattern === 'off' ? 'chroma' : state.pattern;
    const parent = Theory.parentRoot(state.root, state.mode);
    const inSet = f => Theory.classify(Theory.mod(state.openLow + f, 12), parent).kind === kind;
    let f = state.patternFret;
    while (f <= state.frets && !inSet(f)) f++;
    let g = f + dir;
    while (g >= 0 && g <= state.frets && !inSet(g)) g += dir;
    if (g >= 0 && g <= state.frets) set({ patternFret: g });
  }

  // ---------- keyboard ----------
  const PATTERNS = ['off', 'chroma', 'luma'];
  document.addEventListener('keydown', e => {
    if (['INPUT', 'SELECT', 'TEXTAREA'].includes(e.target.tagName)) return;
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    switch (e.key.toLowerCase()) {
      case 'h': togglePanel(); break;
      case 'k': toggleHelp(); break;
      case 'f': toggleFullscreen(); break;
      case 'v':
        if (state.tuning === 'standard') { toast('The Spiral view needs All Fourths tuning'); break; }
        set({ view: state.view === 'six' ? 'spiral' : 'six' });
        break;
      case 'o': set({ orientation: state.orientation === 'mirror' ? 'standard' : 'mirror' }); break;
      case 'd': set({ dots: state.dots === 'all' ? 'played' : 'all' }); break;
      case 'c': set({ chroma: !state.chroma }); break;
      case 'l': set({ luma: !state.luma }); break;
      case 'g': {
        const order = isPenta(state.mode) ? ['none', 'greek', 'degree'] : ['none', 'greek'];
        set({ lumaLabel: order[(order.indexOf(state.lumaLabel) + 1) % order.length] });
        break;
      }
      case 'n': set({ names: !state.names }); break;
      case 'i': set({ clean: !state.clean }); break;
      case 's': {
        const sizes = [100, 75, 50];
        const next = sizes[(sizes.indexOf(+state.dotSize) + 1) % sizes.length];
        set({ dotSize: next });
        toast('Dot size: ' + next + '%');
        break;
      }
      case 't': {
        const i = THEMES.indexOf(themeById(state.theme));
        const next = THEMES[(i + 1) % THEMES.length];
        set({ theme: next.id });
        toast('Palette: ' + next.name);
        break;
      }
      case 'p': set({ pattern: PATTERNS[(PATTERNS.indexOf(state.pattern) + 1) % 3] }); break;
      case '[': stepPattern(-1); break;
      case ']': stepPattern(1); break;
      case 'arrowleft': set({ root: Theory.mod(state.root - 1, 12) }); break;
      case 'arrowright': set({ root: Theory.mod(state.root + 1, 12) }); break;
      case 'arrowup': set({ mode: Theory.mod(state.mode - 1, Theory.MODES.length) }); break;
      case 'arrowdown': set({ mode: Theory.mod(state.mode + 1, Theory.MODES.length) }); break;
      case 'escape': toggleHelp(false); togglePanel(false); allNotesOff(); break;
      default: return;
    }
    e.preventDefault();
  });

  // ---------- start ----------
  buildPanel();
  render();
  connectMidi();
  // index.html?panel=1#palette opens the settings scrolled to that section.
  if (location.hash) { const target = document.querySelector(location.hash); if (target) target.scrollIntoView(); }
  // Chrome may only show its permission bubble in response to a click, so try again on the first click.
  document.addEventListener('pointerdown', () => { if (!midiReady) connectMidi(); }, { capture: true });
})();
