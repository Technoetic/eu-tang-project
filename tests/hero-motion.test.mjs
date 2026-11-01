import test from 'node:test';
import assert from 'node:assert/strict';

class Target extends EventTarget {
  listeners = new Map();
  addEventListener(type, callback, options) {
    super.addEventListener(type, callback, options);
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(callback);
  }
  removeEventListener(type, callback, options) {
    super.removeEventListener(type, callback, options); this.listeners.get(type)?.delete(callback);
  }
  get listenerCount() { return [...this.listeners.values()].reduce((count, values) => count + values.size, 0); }
}
class Style {
  values = new Map(); writes = 0;
  setProperty(name, value) { this.values.set(name, value); ++this.writes; }
}
const emit = (target, type, values = {}) => { const event = new Event(type); Object.assign(event, values); target.dispatchEvent(event); };
async function fixture({ reduced = false, coarse = false } = {}) {
  const module = await import('../src/js/components/hero-motion.js').catch(() => ({}));
  assert.equal(typeof module.HeroMotion, 'function', 'the hero needs a bounded motion controller');
  const root = new Target(); root.style = new Style();
  const scene = { style: new Style() }; const classes = new Set();
  root.classList = { toggle: (name, enabled) => enabled ? classes.add(name) : classes.delete(name), remove: name => classes.delete(name) };
  root.querySelector = selector => selector === '[data-hero-scene]' ? scene : null;
  const rect = { left: 100, top: 0, width: 200, height: 400 };
  root.getBoundingClientRect = () => ({ ...rect });
  const window = new Target(); const document = new Target(); document.hidden = false;
  const reduceQuery = new Target(); reduceQuery.matches = reduced;
  const coarseQuery = new Target(); coarseQuery.matches = coarse;
  const frames = new Map(); let sequence = 0; let observer;
  const environment = {
    window, document,
    matchMedia: query => query.includes('reduced-motion') ? reduceQuery : coarseQuery,
    requestAnimationFrame: callback => { frames.set(++sequence, callback); return sequence; },
    cancelAnimationFrame: id => frames.delete(id),
    IntersectionObserver: class {
      constructor(callback) { this.callback = callback; this.disconnected = false; observer = this; }
      observe(target) { this.target = target; }
      disconnect() { this.disconnected = true; }
    }
  };
  const motion = new module.HeroMotion(root, environment); motion.mount();
  return {
    root, scene, classes, rect, window, document, reduceQuery, coarseQuery, frames, motion,
    get observer() { return observer; },
    intersect(visible) { observer.callback([{ target: root, isIntersecting: visible }]); },
    flush() { const callbacks = [...frames.values()]; frames.clear(); for (const callback of callbacks) callback(); }
  };
}

test('reduced motion and coarse pointers keep the decorative scene static without frames', async () => {
  for (const preference of [{ reduced: true }, { coarse: true }]) {
    const page = await fixture(preference); page.intersect(true);
    emit(page.root, 'pointermove', { clientX: 900, clientY: -100 }); emit(page.window, 'scroll');
    assert.equal(page.frames.size, 0); assert.equal(page.classes.has('is-in-view'), true);
    assert.equal(page.scene.style.values.get('--hero-x'), '0px'); assert.equal(page.scene.style.values.get('--hero-rx'), '0deg');
    page.motion.dispose();
  }
});

test('pointer and scroll inputs coalesce into bounded decorative-only updates', async () => {
  const page = await fixture(); page.intersect(true); page.flush();
  emit(page.root, 'pointermove', { clientX: -1000, clientY: 900 });
  emit(page.root, 'pointermove', { clientX: 900, clientY: -1000 }); emit(page.window, 'scroll');
  assert.equal(page.frames.size, 1); page.flush();
  assert.equal(page.scene.style.values.get('--hero-x'), '18px'); assert.equal(page.scene.style.values.get('--hero-y'), '-18px');
  assert.equal(page.scene.style.values.get('--hero-rx'), '7deg'); assert.equal(page.scene.style.values.get('--hero-ry'), '7deg');
  page.rect.top = -1000; emit(page.window, 'scroll'); page.flush();
  assert.equal(page.scene.style.values.get('--hero-scroll'), '80px');
  emit(page.root, 'pointerleave'); page.flush();
  assert.equal(page.scene.style.values.get('--hero-x'), '0px'); assert.equal(page.scene.style.values.get('--hero-rx'), '0deg');
  assert.equal(page.scene.style.values.get('--hero-scroll'), '80px');
  assert.equal(page.root.style.writes, 0, 'interactive hero content must not receive movement styles');
  page.motion.dispose();
});

test('offscreen and disposal cancel work and ignore a late cancelled animation frame', async () => {
  const page = await fixture(); page.intersect(true); page.flush();
  emit(page.root, 'pointermove', { clientX: 900, clientY: 900 });
  const lateOffscreen = [...page.frames.values()][0]; page.intersect(false);
  assert.equal(page.frames.size, 0); assert.equal(page.classes.has('is-in-view'), false);
  const offscreenWrites = page.scene.style.writes; lateOffscreen();
  assert.equal(page.scene.style.writes, offscreenWrites); emit(page.window, 'scroll'); assert.equal(page.frames.size, 0);
  page.intersect(true); const lateDisposed = [...page.frames.values()][0]; page.motion.dispose();
  const disposedWrites = page.scene.style.writes; lateDisposed();
  assert.equal(page.scene.style.writes, disposedWrites); assert.equal(page.frames.size, 0); assert.equal(page.observer.disconnected, true);
  assert.equal(page.root.listenerCount + page.window.listenerCount + page.document.listenerCount + page.reduceQuery.listenerCount + page.coarseQuery.listenerCount, 0);
});

test('blur, hidden documents and live reduced-motion changes reset and suspend the scene', async () => {
  const page = await fixture(); page.intersect(true); page.flush(); page.motion.mount();
  emit(page.root, 'pointermove', { clientX: 900, clientY: 900 }); emit(page.window, 'blur');
  assert.equal(page.frames.size, 0); assert.equal(page.scene.style.values.get('--hero-x'), '0px');
  page.document.hidden = true; emit(page.document, 'visibilitychange'); emit(page.window, 'focus'); emit(page.window, 'scroll');
  assert.equal(page.frames.size, 0);
  page.document.hidden = false; emit(page.document, 'visibilitychange'); assert.equal(page.frames.size, 1);
  page.reduceQuery.matches = true; emit(page.reduceQuery, 'change');
  assert.equal(page.frames.size, 0); emit(page.root, 'pointermove', { clientX: 900, clientY: 900 }); assert.equal(page.frames.size, 0);
  assert.equal(page.scene.style.values.get('--hero-scroll'), '0px');
  page.motion.dispose();
});
