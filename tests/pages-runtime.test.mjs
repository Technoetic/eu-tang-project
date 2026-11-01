import test from 'node:test';
import assert from 'node:assert/strict';
import { VersionService } from '../src/js/services/version-service.js';
import { ProjectService } from '../src/js/services/project-service.js';

const prefix = '/eu-tang-project/';
const tracks = path => [
  { id: 'type-a', title: 'Type A', src: path + 'a.mp3' },
  { id: 'type-b', title: 'Type B', src: path + 'b.mp3' }
];

test('version requests stay below the Pages prefix and bypass stale CDN responses', async t => {
  const originalLocation = Object.getOwnPropertyDescriptor(globalThis, 'location');
  globalThis.location = { origin: 'https://example.github.io' };
  t.after(() => originalLocation ? Object.defineProperty(globalThis, 'location', originalLocation) : delete globalThis.location);
  const requests = [];
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    requests.push({ url: new URL(url), options });
    return new Response(JSON.stringify({ build: 'bbbbbbbbbbbb' }), { status: 200 });
  });
  const service = new VersionService({ loadedBuild: 'aaaaaaaaaaaa', basePath: '/eu-tang-project' });
  t.after(() => service.dispose());
  assert.equal((await service.check()).ok, true); assert.equal((await service.check()).ok, true);
  assert.equal(requests.length, 2);
  for (const request of requests) {
    assert.equal(request.url.origin, 'https://example.github.io');
    assert.equal(request.url.pathname, '/eu-tang-project/version.json');
    assert.ok(request.url.searchParams.get('__check'));
    assert.equal(request.options.cache, 'no-store');
  }
  assert.notEqual(requests[0].url.searchParams.get('__check'), requests[1].url.searchParams.get('__check'));
});

test('Pages project data accepts media below its configured prefix', async t => {
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ tracks: tracks(prefix + 'media/') })));
  const service = new ProjectService('https://example.github.io/eu-tang-project/assets/project.json', { basePath: prefix });
  t.after(() => service.dispose());
  assert.equal((await service.load()).tracks[0].src, '/eu-tang-project/media/a.mp3');
});

test('Pages project data rejects origin-root media and paths that escape the media directory', async t => {
  let fixture = tracks('/media/');
  t.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ tracks: fixture })));
  const service = new ProjectService('https://example.github.io/eu-tang-project/assets/project.json', { basePath: prefix });
  t.after(() => service.dispose());
  for (const invalid of ['/media/', '/eu-tang-project/media/../', '/eu-tang-project/media/%2e%2e/', '/eu-tang-project/media/a%2f..%2f']) {
    fixture = tracks(invalid); await assert.rejects(() => service.load(), /Invalid project data/, invalid);
  }
});

test('base paths normalize root and an absolute project path with an optional trailing slash', async () => {
  const module = await import('../src/js/shared/site-url.js').catch(() => ({}));
  assert.equal(typeof module.normalizeBasePath, 'function', 'the runtime must provide the shared base-path validator');
  assert.equal(module.normalizeBasePath('/'), '/');
  assert.equal(module.normalizeBasePath('/eu-tang-project'), '/eu-tang-project/');
  assert.equal(module.normalizeBasePath('/eu-tang-project/'), '/eu-tang-project/');
});

test('base paths reject protocol, relative, traversal, query, and backslash inputs', async () => {
  const module = await import('../src/js/shared/site-url.js').catch(() => ({}));
  assert.equal(typeof module.normalizeBasePath, 'function');
  for (const invalid of ['https://example.test/', '//example.test/', 'eu-tang-project/', './eu-tang-project/', '/../', '/x/../', '/x/%2e%2e/', '/x?mode=1', '/x#beats', '/x\\y/', '/x//y/']) {
    assert.throws(() => module.normalizeBasePath(invalid), /Invalid base path/, invalid);
  }
});

test('version transitions preserve the Pages project path and requested hash', async () => {
  const service = new VersionService({ loadedBuild: 'aaaaaaaaaaaa', basePath: prefix, fetchVersion: async () => ({ build: 'bbbbbbbbbbbb' }) });
  const result = await service.navigationDecision('https://example.github.io/eu-tang-project/#story', {
    currentURL: 'https://example.github.io/eu-tang-project/#beats', isBusy: () => false
  });
  assert.equal(result.kind, 'document');
  assert.equal(new URL(result.url).pathname, '/eu-tang-project/');
  assert.equal(new URL(result.url).hash, '#story');
});
