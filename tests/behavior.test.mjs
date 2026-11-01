import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioPlayer } from '../src/js/services/audio-player.js';
import { VersionService } from '../src/js/services/version-service.js';
import { ProjectService } from '../src/js/services/project-service.js';

const tracks = [{ id: 'type-a', title: 'Type A', src: '/media/a.mp3' }, { id: 'type-b', title: 'Type B', src: '/media/b.mp3' }];
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
class FakeAudio extends EventTarget {
  currentTime = 0; duration = 120; volume = 0.8; src = ''; pending = [];
  play() { return this.pending.shift() || Promise.resolve(); }
  pause() { this.dispatchEvent(new Event('pause')); }
  load() {}
  removeAttribute(name) { if (name === 'src') this.src = ''; }
}

test('late rejection from the previous track cannot replace the newly playing track', async () => {
  const audio = new FakeAudio(); const old = deferred(); audio.pending.push(old.promise, Promise.resolve());
  const player = new AudioPlayer(audio); player.setTracks(tracks);
  const first = player.play('type-a'); await player.play('type-b'); old.reject(new Error('aborted previous request')); await first;
  assert.equal(player.state.track.id, 'type-b'); assert.equal(player.state.status, 'playing'); assert.equal(player.state.error, '');
});

test('pausing an unresolved play promise prevents a false playing state', async () => {
  const audio = new FakeAudio(); const pending = deferred(); audio.pending.push(pending.promise);
  const player = new AudioPlayer(audio); player.setTracks(tracks);
  const task = player.play('type-a'); player.pause(); pending.resolve(); await task;
  assert.equal(player.state.status, 'paused'); assert.equal(player.state.track.id, 'type-a');
});

test('rejected playback is recoverable without claiming success', async () => {
  const audio = new FakeAudio(); audio.pending.push(Promise.reject(new Error('network unavailable')));
  const player = new AudioPlayer(audio); player.setTracks(tracks);
  assert.equal(await player.play('type-a'), false); assert.equal(player.state.status, 'error'); assert.ok(player.state.error);
  assert.equal(await player.play('type-a'), true); assert.equal(player.state.status, 'playing'); assert.equal(player.state.error, '');
});

test('seek is bounded and an invalid duration never becomes a NaN media position', async () => {
  const audio = new FakeAudio(); const player = new AudioPlayer(audio); player.setTracks(tracks); await player.play('type-a');
  player.seek(2); assert.equal(audio.currentTime, 120); player.seek(-1); assert.equal(audio.currentTime, 0);
  audio.duration = NaN; player.seek(0.5); assert.equal(audio.currentTime, 0);
  player.setVolume(2); assert.equal(audio.volume, 1); player.setVolume(-1); assert.equal(audio.volume, 0);
});

test('a different build, including rollback, requests a full document at the intended hash', async () => {
  const service = new VersionService({ loadedBuild: 'bbbbbbbbbbbb', fetchVersion: async () => ({ build: 'aaaaaaaaaaaa' }) });
  const decision = await service.navigationDecision('https://example.test/#beats', { currentURL: 'https://example.test/', isBusy: () => false });
  assert.equal(decision.kind, 'document'); assert.equal(new URL(decision.url).hash, '#beats'); assert.equal(new URL(decision.url).searchParams.get('__build'), 'aaaaaaaaaaaa');
});

test('fresh version check rechecks playback before allowing document replacement', async () => {
  const wait = deferred(); let busy = false;
  const service = new VersionService({ loadedBuild: 'aaaaaaaaaaaa', fetchVersion: () => wait.promise });
  const request = service.navigationDecision('https://example.test/#story', { currentURL: 'https://example.test/', isBusy: () => busy });
  busy = true; wait.resolve({ build: 'bbbbbbbbbbbb' });
  const decision = await request; assert.equal(decision.kind, 'local'); assert.equal(decision.pending, true);
});

test('version network errors keep local navigation working and do not throw', async () => {
  const service = new VersionService({ loadedBuild: 'aaaaaaaaaaaa', fetchVersion: async () => { throw new Error('offline'); } });
  assert.equal((await service.navigationDecision('https://example.test/#beats', { currentURL: 'https://example.test/', isBusy: () => false })).kind, 'local');
});

test('an old slow response never overwrites the newest observed build', async () => {
  const old = deferred(); let count = 0;
  const service = new VersionService({ loadedBuild: 'aaaaaaaaaaaa', fetchVersion: () => ++count === 1 ? old.promise : Promise.resolve({ build: 'aaaaaaaaaaaa' }) });
  const first = service.check(); await service.check(); old.resolve({ build: 'bbbbbbbbbbbb' }); await first;
  assert.equal(service.changed, false);
});

test('a malformed project containing the same track twice is rejected before enabling playback', async context => {
  context.mock.method(globalThis, 'fetch', async () => new Response(JSON.stringify({ tracks: [tracks[0], tracks[0]] }), { status: 200 }));
  const service = new ProjectService('https://example.test/project.json');
  await assert.rejects(() => service.load(), /Invalid project data/);
});
