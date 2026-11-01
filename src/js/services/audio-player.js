export class AudioPlayer {
  #audio; #notify; #tracks = new Map(); #track = null; #status = 'idle'; #error = ''; #generation = 0; #handlers = [];

  constructor(audio, onState = () => {}) {
    this.#audio = audio; this.#notify = onState; audio.volume = 0.8;
    const listen = (event, handler) => { audio.addEventListener(event, handler); this.#handlers.push([event, handler]); };
    for (const event of ['timeupdate', 'loadedmetadata', 'durationchange', 'volumechange']) listen(event, () => this.#emit());
    listen('pause', () => { if (this.#status === 'playing') { this.#status = 'paused'; this.#emit(); } });
    listen('ended', () => { ++this.#generation; this.#status = 'ended'; this.#emit(); });
    listen('error', () => {
      if (!this.#track) return;
      ++this.#generation; this.#status = 'error'; this.#error = '비트를 불러오지 못했어요. 다시 재생하거나 원본 자료를 확인해 주세요.'; this.#emit();
    });
  }

  get state() {
    return { track: this.#track ? { ...this.#track } : null, status: this.#status, error: this.#error,
      currentTime: Number.isFinite(this.#audio.currentTime) ? this.#audio.currentTime : 0,
      duration: Number.isFinite(this.#audio.duration) ? this.#audio.duration : 0, volume: this.#audio.volume };
  }

  setTracks(tracks) { this.#tracks = new Map(tracks.map(track => [track.id, { ...track }])); }

  async play(id) {
    const track = this.#tracks.get(id);
    if (!track) return false;
    const request = ++this.#generation;
    const switching = this.#track?.id !== id;
    const previousStatus = this.#status;
    this.#status = 'loading'; this.#error = '';
    if (switching) {
      this.#audio.pause(); this.#track = track; this.#audio.src = track.src; this.#audio.currentTime = 0;
    } else if (previousStatus === 'ended') this.#audio.currentTime = 0;
    else if (previousStatus === 'error') this.#audio.load();
    this.#emit();
    try {
      await this.#audio.play();
      if (request !== this.#generation) return false;
      this.#status = 'playing'; this.#emit(); return true;
    } catch {
      if (request !== this.#generation) return false;
      this.#status = 'error'; this.#error = '재생하지 못했어요. 다시 재생 버튼을 누르거나 원본 자료를 확인해 주세요.';
      this.#emit(); return false;
    }
  }

  pause() { ++this.#generation; this.#status = this.#track ? 'paused' : 'idle'; this.#audio.pause(); this.#emit(); }
  async toggle(id = this.#track?.id) {
    if (this.#track?.id === id && ['playing', 'loading'].includes(this.#status)) { this.pause(); return false; }
    return this.play(id);
  }
  seek(fraction) {
    const duration = this.#audio.duration;
    if (Number.isFinite(duration) && duration > 0 && Number.isFinite(fraction)) this.#audio.currentTime = Math.max(0, Math.min(1, fraction)) * duration;
    this.#emit();
  }
  setVolume(value) { if (Number.isFinite(value)) this.#audio.volume = Math.max(0, Math.min(1, value)); this.#emit(); }
  close() { this.pause(); this.#track = null; this.#status = 'idle'; this.#error = ''; this.#audio.removeAttribute('src'); this.#audio.load(); this.#emit(); }
  dispose() { this.pause(); for (const [event, fn] of this.#handlers) this.#audio.removeEventListener(event, fn); this.#notify = () => {}; }
  #emit() { this.#notify(this.state); }
}
