const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export class HeroMotion {
  #root; #scene; #environment; #window; #document; #request; #cancel; #reduce; #coarse;
  #observer; #cleanup = []; #frame = null; #epoch = 0; #mounted = false; #disposed = false;
  #inView = false; #focused = true; #pointer = null;

  constructor(rootElement, environment = {}) { this.#root = rootElement; this.#environment = environment; }

  mount() {
    if (this.#mounted || this.#disposed || !this.#root) return;
    this.#scene = this.#root.querySelector('[data-hero-scene]');
    if (!this.#scene) return;
    const environment = this.#environment;
    this.#window = environment.window ?? globalThis.window;
    this.#document = environment.document ?? this.#window.document;
    this.#request = environment.requestAnimationFrame ?? this.#window.requestAnimationFrame.bind(this.#window);
    this.#cancel = environment.cancelAnimationFrame ?? this.#window.cancelAnimationFrame.bind(this.#window);
    const matchMedia = environment.matchMedia ?? this.#window.matchMedia.bind(this.#window);
    this.#reduce = matchMedia('(prefers-reduced-motion: reduce)');
    this.#coarse = matchMedia('(pointer: coarse)');
    this.#mounted = true; this.#reset();
    this.#listen(this.#root, 'pointermove', event => {
      if (!this.#allowed() || event.pointerType === 'touch' || !Number.isFinite(event.clientX) || !Number.isFinite(event.clientY)) return;
      this.#pointer = { x: event.clientX, y: event.clientY }; this.#schedule();
    });
    this.#listen(this.#root, 'pointerleave', () => { this.#pointer = null; this.#schedule(); });
    this.#listen(this.#window, 'scroll', () => this.#schedule());
    this.#listen(this.#window, 'blur', () => { this.#focused = false; this.#stop(); });
    this.#listen(this.#window, 'focus', () => { this.#focused = true; this.#schedule(); });
    this.#listen(this.#document, 'visibilitychange', () => { if (this.#document.hidden) this.#stop(); else this.#schedule(); });
    const preferenceChanged = () => { this.#stop(); this.#schedule(); };
    for (const query of [this.#reduce, this.#coarse]) {
      if (query.addEventListener) this.#listen(query, 'change', preferenceChanged);
      else { query.addListener(preferenceChanged); this.#cleanup.push(() => query.removeListener(preferenceChanged)); }
    }
    const Observer = environment.IntersectionObserver ?? this.#window.IntersectionObserver;
    if (Observer) {
      this.#observer = new Observer(entries => {
        if (!this.#mounted || this.#disposed) return;
        const entry = entries.find(item => item.target === this.#root); if (!entry) return;
        this.#inView = entry.isIntersecting;
        this.#root.classList.toggle('is-in-view', this.#inView);
        if (this.#inView) this.#schedule(); else this.#stop();
      }, { threshold: 0.05 });
      this.#observer.observe(this.#root);
    } else {
      this.#inView = true; this.#root.classList.toggle('is-in-view', true); this.#schedule();
    }
  }

  #listen(target, type, handler) {
    const options = { passive: true }; target.addEventListener(type, handler, options);
    this.#cleanup.push(() => target.removeEventListener(type, handler, options));
  }
  #allowed() {
    return this.#mounted && !this.#disposed && this.#inView && this.#focused && !this.#document.hidden && !this.#reduce.matches && !this.#coarse.matches;
  }
  #schedule() {
    if (this.#frame !== null || !this.#allowed()) return;
    const epoch = this.#epoch;
    this.#frame = this.#request(() => {
      if (epoch !== this.#epoch) return;
      this.#frame = null; if (!this.#allowed()) return;
      const rect = this.#root.getBoundingClientRect();
      const x = this.#pointer && rect.width > 0 ? clamp((this.#pointer.x - rect.left) / rect.width * 2 - 1, -1, 1) : 0;
      const y = this.#pointer && rect.height > 0 ? clamp((this.#pointer.y - rect.top) / rect.height * 2 - 1, -1, 1) : 0;
      const scroll = Number.isFinite(rect.top) ? clamp(-rect.top * 0.18, 0, 80) : 0;
      this.#scene.style.setProperty('--hero-x', `${x * 18}px`);
      this.#scene.style.setProperty('--hero-y', `${y * 18}px`);
      this.#scene.style.setProperty('--hero-rx', `${-y * 7}deg`);
      this.#scene.style.setProperty('--hero-ry', `${x * 7}deg`);
      this.#scene.style.setProperty('--hero-scroll', `${scroll}px`);
    });
  }
  #reset() {
    if (!this.#scene) return;
    for (const name of ['--hero-x', '--hero-y', '--hero-scroll']) this.#scene.style.setProperty(name, '0px');
    for (const name of ['--hero-rx', '--hero-ry']) this.#scene.style.setProperty(name, '0deg');
  }
  #stop() {
    ++this.#epoch;
    if (this.#frame !== null) this.#cancel(this.#frame);
    this.#frame = null; this.#pointer = null; this.#reset();
  }
  dispose() {
    if (this.#disposed) return;
    this.#disposed = true; this.#mounted = false; this.#stop();
    for (const cleanup of this.#cleanup.splice(0)) cleanup();
    this.#observer?.disconnect(); this.#root?.classList.remove('is-in-view');
  }
}
