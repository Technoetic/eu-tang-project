import test from 'node:test';
import assert from 'node:assert/strict';
import { HomeScreen } from '../src/js/screens/home-screen.js';

const loadedBuild = 'aaaaaaaaaaaa';
const newerBuild = 'bbbbbbbbbbbb';
const turn = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve;
  const promise = new Promise(done => { resolve = done; });
  return { promise, resolve };
};
const response = build => ({ ok: true, json: async () => ({ build }) });

class Element extends EventTarget {
  dataset = {}; textContent = ''; hidden = false; disabled = false; attributes = new Map();
  classList = { toggle() {} };
  setAttribute(name, value) { this.attributes.set(name, value); }
  getAttribute(name) { return this.attributes.get(name); }
  removeAttribute(name) { this.attributes.delete(name); }
}
class Audio extends EventTarget {
  currentTime = 0; duration = 120; volume = 0.8; src = '';
  play() { return Promise.resolve(); }
  pause() { this.dispatchEvent(new Event('pause')); }
  load() {}
  removeAttribute(name) { if (name === 'src') this.src = ''; }
}

async function mountScreen(t) {
  const globals = ['document', 'window', 'Audio', 'location', 'fetch'];
  const originals = new Map(globals.map(name => [name, Object.getOwnPropertyDescriptor(globalThis, name)]));
  const window = new EventTarget();
  const document = new EventTarget();
  const status = new Element(), retry = new Element(), beats = new Element(), play = new Element(), toggle = new Element();
  play.dataset.play = 'type-a';
  document.body = { classList: { toggle() {} } };
  document.querySelector = selector => ({ '#load-status': status, '#retry-load': retry, '#beats': beats, '#player-toggle': toggle }[selector] || null);
  document.querySelectorAll = selector => selector === '[data-play]' ? [play] : [];
  let href = 'https://example.test/';
  const hashEvents = [], documents = [], replies = [];
  let versionCalls = 0;
  const location = {
    origin: 'https://example.test',
    get href() { return href; },
    get hash() { return new URL(href).hash; },
    set hash(hash) {
      const oldURL = href; const next = new URL(href); next.hash = hash; href = next.href;
      if (oldURL !== href) hashEvents.push({ oldURL, newURL: href });
    },
    assign(url) { documents.push({ method: 'assign', url }); },
    replace(url) { documents.push({ method: 'replace', url }); }
  };
  globalThis.document = document; globalThis.window = window; globalThis.Audio = Audio; globalThis.location = location;
  globalThis.fetch = async url => {
    if (new URL(url).pathname.endsWith('/version.json')) { ++versionCalls; return await (replies.shift() || response(loadedBuild)); }
    return { ok: true, json: async () => ({ tracks: [
      { id: 'type-a', title: 'Type A', src: '/media/a.mp3' },
      { id: 'type-b', title: 'Type B', src: '/media/b.mp3' }
    ] }) };
  };
  const screen = new HomeScreen({ build: loadedBuild, projectURL: 'https://example.test/project.json' });
  t.after(() => {
    screen.dispose();
    for (const [name, descriptor] of originals) {
      if (descriptor) Object.defineProperty(globalThis, name, descriptor); else delete globalThis[name];
    }
  });
  await screen.mount(); await turn();
  const baseline = versionCalls;
  return {
    location, documents, replies,
    get versionCalls() { return versionCalls - baseline; },
    play() { play.dispatchEvent(new Event('click')); },
    pause() { toggle.dispatchEvent(new Event('click')); },
    click(hash) {
      const link = { href: 'https://example.test/' + hash };
      const event = new Event('click', { cancelable: true });
      Object.defineProperties(event, { button: { value: 0 }, target: { value: { closest: () => link } } });
      document.dispatchEvent(event);
    },
    dispatchHash() {
      const detail = hashEvents.shift(); assert.ok(detail, 'expected a queued native hashchange');
      const event = new Event('hashchange'); Object.assign(event, detail); window.dispatchEvent(event);
    }
  };
}

test('an own busy hash transition cannot start a late reload when music is paused', async t => {
  const page = await mountScreen(t); page.play(); await turn();
  const lateDuplicate = deferred(); page.replies.push(response(newerBuild), lateDuplicate.promise);
  page.click('#beats'); await turn(); assert.equal(page.location.hash, '#beats');
  page.dispatchHash(); await turn(); page.pause(); await turn();
  lateDuplicate.resolve(response(newerBuild)); await turn();
  assert.deepEqual(page.documents, [], 'pausing must not complete a duplicate reload to the previous menu');
  assert.equal(page.versionCalls, 1, 'one user navigation performs one version check');
});

test('external or history hash changes still check the version at their current target', async t => {
  const page = await mountScreen(t); page.replies.push(response(newerBuild));
  page.location.hash = '#story'; page.dispatchHash(); await turn();
  assert.equal(page.versionCalls, 1); assert.equal(page.documents.length, 1);
  assert.equal(page.documents[0].method, 'replace'); assert.equal(new URL(page.documents[0].url).hash, '#story');
});

test('a queued stale hashchange is ignored until the current hash event arrives', async t => {
  const page = await mountScreen(t); page.location.hash = '#beats'; page.location.hash = '#story';
  page.dispatchHash(); await turn(); assert.equal(page.versionCalls, 0);
  page.dispatchHash(); await turn(); assert.equal(page.versionCalls, 1); assert.equal(page.location.hash, '#story');
});

test('concurrent user intents retain the newest target without an extra own hash check', async t => {
  const page = await mountScreen(t); const earlier = deferred(); page.replies.push(earlier.promise, response(loadedBuild));
  page.click('#about'); page.click('#beats'); await turn();
  assert.equal(page.location.hash, '#beats'); page.dispatchHash(); await turn();
  earlier.resolve(response(newerBuild)); await turn();
  assert.equal(page.location.hash, '#beats'); assert.deepEqual(page.documents, []); assert.equal(page.versionCalls, 2);
});
