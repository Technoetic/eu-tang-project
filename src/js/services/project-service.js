import { normalizeBasePath } from '../shared/site-url.js';

export class ProjectService {
  #url; #controller; #request = 0; #mediaPrefix;
  constructor(url, { basePath = '/' } = {}) { this.#url = url; this.#mediaPrefix = normalizeBasePath(basePath) + 'media/'; }
  async load() {
    this.#controller?.abort(); const controller = new AbortController(); this.#controller = controller; const request = ++this.#request;
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const response = await fetch(this.#url, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) throw new Error('Project data unavailable');
      const data = await response.json();
      if (request !== this.#request) return null;
      if (!Array.isArray(data.tracks) || data.tracks.length !== 2 || new Set(data.tracks.map(track => track?.id)).size !== 2 ||
          !data.tracks.every(track => ['type-a', 'type-b'].includes(track.id) && typeof track.title === 'string' && this.#validMediaURL(track.src))) throw new Error('Invalid project data');
      return data;
    } finally { clearTimeout(timeout); }
  }
  #validMediaURL(src) {
    if (typeof src !== 'string' || !src.startsWith(this.#mediaPrefix)) return false;
    try { return normalizeBasePath(src) === src + '/'; } catch { return false; }
  }
  dispose() { ++this.#request; this.#controller?.abort(); }
}
