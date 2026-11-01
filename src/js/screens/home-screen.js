import { AudioPlayer } from '../services/audio-player.js';
import { ProjectService } from '../services/project-service.js';
import { VersionService } from '../services/version-service.js';
import { formatTime } from '../shared/format.js';

export class HomeScreen {
  #player; #project; #version; #events = new AbortController(); #ready = false; #disposed = false; #loadGeneration = 0; #checkedHashURL = null;
  constructor({ build, projectURL, basePath = '/' }) {
    const audio = new Audio(); audio.preload = 'metadata';
    this.#player = new AudioPlayer(audio, state => this.#renderPlayer(state));
    this.#project = new ProjectService(projectURL, { basePath });
    this.#version = new VersionService({ loadedBuild: build, basePath, onPending: changed => this.#renderUpdate(changed) });
  }
  async mount() {
    const signal = this.#events.signal;
    for (const button of document.querySelectorAll('[data-play]')) {
      button.disabled = true;
      button.addEventListener('click', async () => { if (this.#ready) await this.#player.toggle(button.dataset.play); }, { signal });
    }
    document.querySelector('#player-toggle')?.addEventListener('click', () => { void this.#player.toggle(); }, { signal });
    document.querySelector('#player-close')?.addEventListener('click', () => this.#player.close(), { signal });
    document.querySelector('#player-seek')?.addEventListener('input', event => this.#player.seek(Number(event.target.value) / 1000), { signal });
    document.querySelector('#player-volume')?.addEventListener('input', event => this.#player.setVolume(Number(event.target.value)), { signal });
    document.querySelector('#retry-load')?.addEventListener('click', () => { void this.#load(); }, { signal });
    const menu = document.querySelector('#menu-toggle');
    menu?.addEventListener('click', () => menu.setAttribute('aria-expanded', String(menu.getAttribute('aria-expanded') !== 'true')), { signal });
    document.addEventListener('keydown', event => { if (event.key === 'Escape') menu?.setAttribute('aria-expanded', 'false'); }, { signal });
    document.addEventListener('click', event => {
      const link = event.target.closest('a[data-nav]');
      if (!link || event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
      event.preventDefault(); menu?.setAttribute('aria-expanded', 'false'); void this.#navigate(link.href);
    }, { signal });
    for (const button of document.querySelectorAll('[data-open-video]')) button.addEventListener('click', () => this.#openVideo(), { signal });
    const dialog = document.querySelector('#video-dialog');
    document.querySelector('[data-close-video]')?.addEventListener('click', () => dialog.close(), { signal });
    dialog?.addEventListener('close', () => document.querySelector('#video-mount').replaceChildren(), { signal });
    dialog?.addEventListener('click', event => { if (event.target === dialog) { const rect = dialog.getBoundingClientRect(); if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close(); } }, { signal });
    window.addEventListener('focus', () => { void this.#version.check(); }, { signal });
    window.addEventListener('pageshow', () => { void this.#version.check(); }, { signal });
    document.addEventListener('visibilitychange', () => { if (!document.hidden) void this.#version.check(); }, { signal });
    window.addEventListener('hashchange', event => {
      const currentURL = location.href;
      if (event.newURL && event.newURL !== currentURL) return;
      this.#syncNavigation();
      const alreadyChecked = this.#checkedHashURL === currentURL;
      this.#checkedHashURL = null;
      if (!alreadyChecked) void this.#navigate(currentURL, true);
    }, { signal });
    window.addEventListener('pagehide', event => { if (!event.persisted) this.dispose(); }, { signal });
    this.#syncNavigation(); void this.#version.check(); await this.#load();
  }
  async #load() {
    const request = ++this.#loadGeneration;
    const status = document.querySelector('#load-status'); const retry = document.querySelector('#retry-load');
    this.#ready = false; status.textContent = '비트를 준비하고 있어요.'; retry.hidden = true;
    document.querySelector('#beats')?.setAttribute('aria-busy', 'true');
    try {
      const data = await this.#project.load(); if (!data || this.#disposed || request !== this.#loadGeneration) return;
      this.#player.setTracks(data.tracks);
      for (const track of data.tracks) {
        const link = document.querySelector(`[data-download="${track.id}"]`);
        if (link) { link.href = track.src; link.setAttribute('download', track.downloadName); }
      }
      this.#ready = true; status.textContent = '재생 버튼을 눌러 두 비트를 들어보세요.';
    } catch (error) {
      if (this.#disposed || request !== this.#loadGeneration) return;
      status.textContent = '비트를 준비하지 못했어요. 다시 시도하거나 원본 자료에서 확인해 주세요.'; retry.hidden = false;
    } finally {
      if (!this.#disposed && request === this.#loadGeneration) {
        document.querySelector('#beats')?.setAttribute('aria-busy', 'false');
        for (const button of document.querySelectorAll('[data-play]')) button.disabled = !this.#ready;
      }
    }
  }
  #renderPlayer(state) {
    if (this.#disposed) return;
    const active = ['playing', 'loading'].includes(state.status);
    document.body.classList.toggle('is-playing', state.status === 'playing');
    document.body.classList.toggle('has-player', !!state.track);
    for (const button of document.querySelectorAll('[data-play]')) {
      const pressed = state.track?.id === button.dataset.play && active;
      button.setAttribute('aria-pressed', String(pressed));
      button.setAttribute('aria-label', `${button.dataset.play === 'type-a' ? 'Type A' : 'Type B'} ${pressed ? '일시정지' : '재생'}`);
    }
    for (const card of document.querySelectorAll('[data-track]')) card.classList.toggle('is-playing', active && card.dataset.track === state.track?.id);
    const bar = document.querySelector('#player-bar'); if (!bar) return; bar.hidden = !state.track;
    document.querySelector('#player-toggle').setAttribute('aria-pressed', String(active));
    document.querySelector('#player-toggle').setAttribute('aria-label', active ? '일시정지' : '재생');
    document.querySelector('#player-title').textContent = state.track ? `${state.track.title} — DJ Juice` : '';
    document.querySelector('#player-current').textContent = formatTime(state.currentTime);
    document.querySelector('#player-duration').textContent = formatTime(state.duration);
    const seek = document.querySelector('#player-seek');
    seek.value = state.duration > 0 ? String(Math.min(1000, Math.round(state.currentTime / state.duration * 1000))) : '0';
    seek.disabled = state.duration <= 0;
    seek.setAttribute('aria-valuetext', `${formatTime(state.currentTime)} / ${formatTime(state.duration)}`);
    document.querySelector('#player-volume').value = String(state.volume);
    const message = state.error || (state.status === 'loading' ? '비트를 불러오는 중이에요.' : state.status === 'ended' ? '재생이 끝났어요. 다시 듣거나 다른 비트를 골라보세요.' : '');
    const status = document.querySelector('#player-status'); if (status.textContent !== message) status.textContent = message;
    this.#renderUpdate(this.#version?.changed || false);
  }
  #renderUpdate(changed) {
    const notice = document.querySelector('#update-notice'); if (!notice) return;
    notice.hidden = !changed;
    notice.textContent = this.#busy() ? '새로운 내용이 준비됐어요. 음악을 멈춘 뒤 다음 메뉴로 이동하면 반영됩니다.' : '새로운 내용이 준비됐어요. 다음 메뉴로 이동하면 자동으로 반영됩니다.';
  }
  #busy() { return ['playing', 'loading'].includes(this.#player.state.status); }
  async #navigate(target, restored = false) {
    const result = await this.#version.navigationDecision(target, { currentURL: location.href, isBusy: () => this.#busy(), replace: restored });
    if (this.#disposed || result.kind === 'cancel') return;
    if (result.kind === 'document') { result.replace ? location.replace(result.url) : location.assign(result.url); return; }
    if (!restored) {
      const hash = new URL(target).hash || '#home';
      if (location.hash !== hash) {
        const next = new URL(location.href); next.hash = hash;
        this.#checkedHashURL = next.href; location.hash = hash;
      }
      else document.querySelector(hash)?.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    }
    this.#syncNavigation();
  }
  #syncNavigation() {
    const hash = location.hash || '#home';
    for (const link of document.querySelectorAll('#site-nav a[data-nav]')) {
      if (link.hash === hash) link.setAttribute('aria-current', 'location'); else link.removeAttribute('aria-current');
    }
  }
  #openVideo() {
    this.#player.pause(); const mount = document.querySelector('#video-mount');
    const frame = document.createElement('iframe');
    frame.src = 'https://www.youtube-nocookie.com/embed/3WUmK-k2OYM?start=6&autoplay=1&rel=0';
    frame.title = '으른랩퍼 + 우탱클랜, 으-탱 프로젝트의 서막'; frame.allow = 'autoplay; encrypted-media; picture-in-picture'; frame.allowFullscreen = true;
    frame.referrerPolicy = 'strict-origin-when-cross-origin'; mount.replaceChildren(frame); document.querySelector('#video-dialog').showModal();
  }
  dispose() { this.#disposed = true; this.#events.abort(); this.#project.dispose(); this.#version.dispose(); this.#player.dispose(); }
}
