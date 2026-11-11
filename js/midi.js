'use strict';
/*
 * Thin wrapper over the browser's Web MIDI API (Chrome / Edge / Opera).
 * Emits: 'devices' (list of inputs), 'noteon', 'noteoff', 'program', 'cc', 'error'.
 * Channels are reported 1..16.
 */
const Midi = (() => {
  let access = null;
  let selected = 'all';
  const listeners = {};

  const on = (ev, fn) => { (listeners[ev] = listeners[ev] || []).push(fn); };
  const emit = (ev, data) => (listeners[ev] || []).forEach(fn => fn(data));

  function supported() { return !!navigator.requestMIDIAccess; }

  async function init() {
    if (!supported()) return false;
    if (access) { emit('devices', inputs()); return true; }
    try {
      access = await navigator.requestMIDIAccess({ sysex: false });
    } catch (e) {
      emit('error', e);
      return false;
    }
    access.onstatechange = () => { bind(); emit('devices', inputs()); };
    bind();
    emit('devices', inputs());
    return true;
  }

  function inputs() { return access ? [...access.inputs.values()] : []; }

  function select(id) { selected = id; bind(); }

  function bind() {
    for (const inp of inputs()) {
      inp.onmidimessage = (selected === 'all' || inp.id === selected) ? handle : null;
    }
  }

  function handle(e) {
    const d = e.data;
    if (!d || d.length < 2) return;
    const status = d[0], d1 = d[1], d2 = d.length > 2 ? d[2] : 0;
    const type = status & 0xF0, ch = (status & 0x0F) + 1;
    if (type === 0x90 && d2 > 0) emit('noteon', { ch, note: d1, vel: d2 });
    else if (type === 0x80 || (type === 0x90 && d2 === 0)) emit('noteoff', { ch, note: d1 });
    else if (type === 0xC0) emit('program', { ch, program: d1 });
    else if (type === 0xB0) emit('cc', { ch, cc: d1, value: d2 });
  }

  return { supported, init, inputs, select, on };
})();
