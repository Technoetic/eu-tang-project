import test from 'node:test';
import assert from 'node:assert/strict';

const oldBuild = 'aaaaaaaaaaaa';
const newBuild = 'bbbbbbbbbbbb';
class Storage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}
async function decisionFunction() {
  const module = await import('../src/js/services/entry-service.js').catch(() => ({}));
  assert.equal(typeof module.entryDecision, 'function', 'entry bootstrap must provide an async freshness decision');
  return module.entryDecision;
}
const options = storage => ({
  loadedBuild: oldBuild, basePath: '/eu-tang-project/', storage,
  readURL: () => 'https://example.github.io/eu-tang-project/#beats',
  fetchVersion: async () => ({ build: newBuild })
});

test('a stale new entry replaces the document at the latest hash after the version response', async () => {
  const decide = await decisionFunction(); const storage = new Storage();
  let finish; const pending = new Promise(resolve => { finish = resolve; });
  let latestURL = 'https://example.github.io/eu-tang-project/#beats';
  const task = decide({ ...options(storage), readURL: () => latestURL, fetchVersion: () => pending });
  latestURL = 'https://example.github.io/eu-tang-project/?__build=bbbbbbbbbbbb#guide';
  finish({ build: newBuild }); const result = await task;
  assert.equal(result.kind, 'document');
  const url = new URL(result.url);
  assert.equal(url.pathname, '/eu-tang-project/'); assert.equal(url.hash, '#guide');
  assert.equal(url.searchParams.get('__build'), newBuild); assert.equal(url.searchParams.get('__refresh'), '1');
  assert.equal(storage.values.size, 1, 'the attempt must be stored before a caller can replace the document');
});

test('a repeated loaded-to-target pair mounts without a loop and is scoped to the base path', async () => {
  const decide = await decisionFunction(); const storage = new Storage();
  assert.equal((await decide(options(storage))).kind, 'document');
  assert.equal((await decide(options(storage))).kind, 'mount');
  assert.equal((await decide({ ...options(storage), basePath: '/other-project/', readURL: () => 'https://example.github.io/other-project/#story' })).kind, 'document');
});

test('version or session storage failure falls back to the usable current app', async () => {
  const decide = await decisionFunction();
  assert.equal((await decide({ ...options(new Storage()), fetchVersion: async () => { throw new Error('offline'); } })).kind, 'mount');
  assert.equal((await decide({ ...options(new Storage()), fetchVersion: async () => ({ build: 'invalid' }) })).kind, 'mount');
  assert.equal((await decide(options({ getItem() { throw new Error('storage blocked'); } }))).kind, 'mount');
  assert.equal((await decide(options({ getItem() { return null; }, setItem() { throw new Error('storage full'); } }))).kind, 'mount');
});

test('a matching server version mounts and clears the earlier attempt', async () => {
  const decide = await decisionFunction(); const storage = new Storage();
  await decide(options(storage)); assert.equal(storage.values.size, 1);
  const result = await decide({ ...options(storage), loadedBuild: newBuild });
  assert.equal(result.kind, 'mount'); assert.equal(storage.values.size, 0);
  assert.equal((await decide(options(storage))).kind, 'document');
});
