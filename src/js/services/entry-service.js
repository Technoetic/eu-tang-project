import { normalizeBasePath } from '../shared/site-url.js';
import { VersionService } from './version-service.js';

export async function entryDecision({ loadedBuild, basePath = '/', readURL = () => location.href, storage, fetchVersion }) {
  let version;
  try {
    const base = normalizeBasePath(basePath);
    version = new VersionService({ loadedBuild, basePath: base, fetchVersion });
    const result = await version.check();
    if (!result.ok) return { kind: 'mount' };
    const session = storage === undefined ? globalThis.sessionStorage : storage;
    if (!session) return { kind: 'mount' };
    const key = 'eu-tang:entry-attempt:' + base;
    if (!result.changed) { session.removeItem(key); return { kind: 'mount' }; }
    const pair = loadedBuild + '->' + result.build;
    if (session.getItem(key) === pair) return { kind: 'mount' };
    const current = new URL(readURL()); const target = new URL(current.href);
    target.searchParams.set('__build', result.build);
    if (target.pathname + target.search === current.pathname + current.search) {
      const old = Number(current.searchParams.get('__refresh'));
      target.searchParams.set('__refresh', String(Number.isSafeInteger(old) ? old + 1 : 1));
    }
    session.setItem(key, pair);
    return { kind: 'document', url: target.href };
  } catch { return { kind: 'mount' }; }
  finally { version?.dispose(); }
}
