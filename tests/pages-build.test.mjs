import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

test('the complete Pages artifact keeps entry, modules, media and 404 links below its repository path', () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const run = spawnSync(process.execPath, ['scripts/build.mjs'], { cwd: root, env: { ...process.env, BASE_PATH: '/eu-tang-project/' }, encoding: 'utf8' });
  assert.equal(run.status, 0, run.stderr);
  const version = JSON.parse(readFileSync(path.join(root, 'dist/version.json'), 'utf8'));
  const html = readFileSync(path.join(root, 'dist/index.html'), 'utf8');
  assert.match(html, /name="app-base" content="\/eu-tang-project\/"/);
  assert.ok(html.includes(`/eu-tang-project/assets/${version.build}/app.js`));
  assert.ok(html.includes(`/eu-tang-project/assets/${version.build}/styles.css`));
  const project = JSON.parse(readFileSync(path.join(root, `dist/assets/${version.build}/project.json`), 'utf8'));
  for (const track of project.tracks) {
    assert.ok(track.src.startsWith('/eu-tang-project/media/'));
    assert.ok(existsSync(path.join(root, 'dist', track.src.slice('/eu-tang-project/'.length))));
  }
  assert.ok(readFileSync(path.join(root, 'dist/404.html'), 'utf8').includes('href="/eu-tang-project/"'));
  assert.ok(existsSync(path.join(root, 'dist/.nojekyll')));
});
