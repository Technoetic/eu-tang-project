import { normalizeBasePath } from '../shared/site-url.js';

const validBuild = value => typeof value === 'string' && /^[a-f0-9]{12,64}$/.test(value);
let checkSequence = 0;

async function fetchVersion(signal, basePath) {
  const url = new URL(basePath + 'version.json', location.origin);
  url.searchParams.set('__check', `${Date.now().toString(36)}-${++checkSequence}`);
  const response = await fetch(url, { cache: 'no-store', signal });
  if (!response.ok) throw new Error('Version unavailable');
  return response.json();
}

export class VersionService {
  #loaded; #latest; #fetch; #onPending; #sequence = 0; #navigation = 0; #controller;
  constructor({ loadedBuild, basePath = '/', fetchVersion: fetcher, onPending = () => {} }) {
    if (!validBuild(loadedBuild)) throw new Error('Invalid loaded build identity');
    const base = normalizeBasePath(basePath);
    this.#loaded = loadedBuild; this.#latest = loadedBuild; this.#fetch = fetcher || (signal => fetchVersion(signal, base)); this.#onPending = onPending;
  }
  get changed() { return this.#latest !== this.#loaded; }
  async check() {
    const request = ++this.#sequence;
    this.#controller?.abort(); const controller = new AbortController(); this.#controller = controller;
    const timeout = setTimeout(() => controller.abort(), 3000);
    try {
      const data = await this.#fetch(controller.signal);
      if (!validBuild(data?.build)) throw new Error('Invalid version response');
      if (request !== this.#sequence) return { ok: false, changed: this.changed, build: this.#latest };
      this.#latest = data.build; this.#onPending(this.changed);
      return { ok: true, changed: this.changed, build: this.#latest };
    } catch { return { ok: false, changed: this.changed, build: this.#latest }; }
    finally { clearTimeout(timeout); }
  }
  async navigationDecision(targetURL, { currentURL, isBusy, replace = false }) {
    const navigation = ++this.#navigation;
    const result = await this.check();
    if (navigation !== this.#navigation) return { kind: 'cancel', pending: this.changed };
    if (!result.ok || !result.changed || isBusy()) return { kind: 'local', pending: this.changed };
    const target = new URL(targetURL, currentURL); const current = new URL(currentURL);
    if (target.origin !== current.origin) return { kind: 'local', pending: this.changed };
    target.searchParams.set('__build', result.build);
    if (target.pathname + target.search === current.pathname + current.search) {
      const old = Number(current.searchParams.get('__refresh'));
      target.searchParams.set('__refresh', String(Number.isSafeInteger(old) ? old + 1 : 1));
    }
    return { kind: 'document', url: target.href, replace, pending: true };
  }
  dispose() { ++this.#sequence; ++this.#navigation; this.#controller?.abort(); }
}
