import { createHash } from 'node:crypto';
import { readdir, readFile, mkdir, writeFile, copyFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { normalizeBasePath } from '../src/js/shared/site-url.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'src'); const output = path.join(root, 'dist');
const basePath = normalizeBasePath(process.env.BASE_PATH || '/');
if (path.dirname(output) !== root || path.basename(output) !== 'dist') throw new Error('Invalid build destination');
async function files(directory) {
  const items = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(items.map(item => item.isDirectory() ? files(path.join(directory, item.name)) : [path.join(directory, item.name)]));
  return nested.flat().sort();
}
const allSource = await files(source); const hash = createHash('sha256');
hash.update(`base:${basePath}\0`);
for (const file of allSource) hash.update(path.relative(source, file).replaceAll('\\', '/')).update('\0').update(await readFile(file));
const sourceMedia = [['type-a.mp3', 'type-a.mp3'], ['type-b.mp3', 'type-b.mp3'], ['video-poster.jpg', 'video-poster.jpg']];
const media = {};
await mkdir(path.join(output, 'media'), { recursive: true });
for (const [file, label] of sourceMedia) {
  const bytes = await readFile(path.join(root, 'source-media', file)); const digest = createHash('sha256').update(bytes).digest('hex');
  hash.update(file).update(digest);
  const name = `${digest.slice(0, 12)}-${label}`;
  await writeFile(path.join(output, 'media', name), bytes); media[file] = { url: `${basePath}media/${name}`, bytes: bytes.length, sha256: digest };
}
const build = hash.digest('hex').slice(0, 16); const assets = path.join(output, 'assets', build);
await mkdir(assets, { recursive: true });
for (const file of allSource.filter(file => file.startsWith(path.join(source, 'js') + path.sep))) {
  const dest = path.join(assets, path.relative(path.join(source, 'js'), file));
  await mkdir(path.dirname(dest), { recursive: true }); await copyFile(file, dest);
}
const css = await Promise.all(['tokens.css', 'base.css', 'components.css'].map(name => readFile(path.join(source, 'styles', name), 'utf8')));
await writeFile(path.join(assets, 'styles.css'), css.join('\n'));
await copyFile(path.join(source, 'static', 'favicon.svg'), path.join(assets, 'favicon.svg'));
const tokens = {
  BUILD_ID: build, BASE_PATH: basePath, STYLE_URL: `${basePath}assets/${build}/styles.css`, APP_URL: `${basePath}assets/${build}/app.js`,
  POSTER_URL: media['video-poster.jpg'].url, FAVICON_URL: `${basePath}assets/${build}/favicon.svg`,
  TYPE_A_URL: media['type-a.mp3'].url, TYPE_B_URL: media['type-b.mp3'].url
};
const replace = input => input.replace(/\{\{([A-Z_]+)\}\}/g, (_all, name) => { if (!(name in tokens)) throw new Error('Unknown build token ' + name); return tokens[name]; });
await writeFile(path.join(output, 'index.html'), replace(await readFile(path.join(source, 'index.html'), 'utf8')));
const project = replace(await readFile(path.join(source, 'data', 'project.json'), 'utf8')); JSON.parse(project);
await writeFile(path.join(assets, 'project.json'), project);
await writeFile(path.join(output, 'version.json'), JSON.stringify({ build }) + '\n');
await writeFile(path.join(output, '404.html'), `<!doctype html><html lang="ko"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>페이지를 찾을 수 없습니다 · 으-탱</title><h1>페이지를 찾을 수 없습니다.</h1><p><a href="${basePath}">으-탱 프로젝트로 돌아가기</a></p></html>\n`);
await writeFile(path.join(output, '.nojekyll'), '');
await unlink(path.join(output, '_headers')).catch(error => { if (error.code !== 'ENOENT') throw error; });
await mkdir(path.join(root, '.artifacts'), { recursive: true });
await writeFile(path.join(root, '.artifacts', 'build.json'), JSON.stringify({ build, basePath, media, preservedPreviousAssetGraphs: true }, null, 2) + '\n');
console.log(JSON.stringify({ build, basePath, static_directory: 'dist', source_files: allSource.length, media_files: sourceMedia.length, previous_asset_graphs_retained: true }));
