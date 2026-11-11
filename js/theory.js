'use strict';
/*
 * Music theory for the Spacetime Spiral.
 *
 * Everything is measured from the PARENT major key ("1"), not from the
 * mode's own root. In D Dorian the parent is C major, so C is "1" and D is "2".
 *
 * Chroma (diatonic) degrees 1..7 get colors; luma (the five notes outside the
 * key) get Greek letters by their flat-interval from "1": b2=α b3=β b5=γ b6=δ b7=ε.
 */
const Theory = (() => {
  const NAMES_SHARP = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  const NAMES_FLAT  = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

  // offset = semitones from the parent "1" up to the mode's root.
  const MODES = [
    { name: 'Ionian',     offset: 0,  alias: 'major' },
    { name: 'Dorian',     offset: 2 },
    { name: 'Phrygian',   offset: 4 },
    { name: 'Lydian',     offset: 5 },
    { name: 'Mixolydian', offset: 7 },
    { name: 'Aeolian',    offset: 9,  alias: 'natural minor' },
    { name: 'Locrian',    offset: 11 },
    // Blues: the root is the luma β note (b3 of the parent "1"), so the parent lies 3 semitones
    // below the root and the five luma dots form the minor pentatonic on the root.
    { name: 'Blues',      offset: 3,  alias: 'root is luma β' },
  ];

  const MAJOR = [0, 2, 4, 5, 7, 9, 11];          // intervals of degrees 1..7
  const LUMA       = { 1: 'α', 3: 'β', 6: 'γ', 8: 'δ', 10: 'ε' };
  const LUMA_NAMES = { 1: 'alpha', 3: 'beta', 6: 'gamma', 8: 'delta', 10: 'epsilon' };

  // Parent keys that are spelled with flats.
  const FLAT_PARENTS = new Set([5, 10, 3, 8, 1, 6]); // F Bb Eb Ab Db Gb

  const mod = (n, m) => ((n % m) + m) % m;

  const parentRoot = (root, mode) => mod(root - MODES[mode].offset, 12);

  // Classify a pitch class relative to the parent "1".
  function classify(pc, parent) {
    const iv = mod(pc - parent, 12);
    const d = MAJOR.indexOf(iv);
    if (d >= 0) return { kind: 'chroma', degree: d + 1, interval: iv };
    return { kind: 'luma', letter: LUMA[iv], name: LUMA_NAMES[iv], interval: iv };
  }

  const names    = parent => (FLAT_PARENTS.has(parent) ? NAMES_FLAT : NAMES_SHARP);
  const noteName = (pc, parent) => names(parent)[mod(pc, 12)];
  const midiName = (m, parent) => noteName(m, parent) + (Math.floor(m / 12) - 1);

  // Name of an interval above a root, in semitones: 0 → "1", 3 → "♭3", 10 → "♭7" ...
  const INTERVAL_NAMES = ['1', '♭2', '2', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];
  const intervalName = semis => INTERVAL_NAMES[mod(semis, 12)];

  function describe(root, mode) {
    return `${noteName(root, parentRoot(root, mode))} ${MODES[mode].name}`;
  }

  return { NAMES_SHARP, NAMES_FLAT, MODES, MAJOR, LUMA, LUMA_NAMES,
           mod, parentRoot, classify, noteName, midiName, describe, intervalName };
})();
