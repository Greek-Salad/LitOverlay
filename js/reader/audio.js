import { icon } from "../core/icons.js";
import { loadAudioSettings, saveAudioSettings } from "../core/storage.js";
import { clamp, escapeHtml, formatDuration, resolveMediaPath, splitTrackTitle } from "../core/utils.js";

export function getSliderPercent(container, event) {
  const rect = container.getBoundingClientRect();
  if (!rect.width) return 0;
  return clamp((event.clientX - rect.left) / rect.width, 0, 1);
}

export function isPrimarySliderPointer(event) {
  return event.button === undefined || event.button === 0;
}

export function audioTrackId(rule, src) {
  return String(rule.id || `${Number(rule.chapter) || 0}:${src}`);
}

export class AudioController {
  constructor({ bookId, onLyrics, onPlaybackStart, reportWarning }) {
    this.bookId = bookId;
    this.onLyrics = onLyrics;
    this.onPlaybackStart = onPlaybackStart;
    this.reportWarning = reportWarning;
    this.settings = loadAudioSettings();
    this.tracks = [];
    this.trackById = new Map();
    this.activeTrack = null;
    this.global = null;
  }

  attachGlobal(container) {
    this.global = container;
    this.renderGlobal();
  }

  register(rule) {
    const src = resolveMediaPath(this.bookId, rule.src?.[0]);
    const id = audioTrackId(rule, src);
    if (this.trackById.has(id)) return this.trackById.get(id);
    const audio = new Audio(src);
    audio.preload = "metadata";
    audio.volume = this.settings.volume;
    audio.muted = this.settings.muted;
    const parsed = splitTrackTitle(rule.title);
    const track = {
      id,
      src,
      originalSrc: src,
      blobUrl: null,
      blobPromise: null,
      pendingSeekPercent: null,
      visualSeekTime: null,
      resumeAfterSeek: false,
      seekVersion: 0,
      chapter: rule.chapter,
      audio,
      title: parsed.title,
      artist: parsed.artist,
      rawTitle: rule.title || parsed.title,
      lyrics: rule.lyrics || ""
    };
    audio.addEventListener("play", () => {
      if (this.activeTrack && this.activeTrack !== track) this.activeTrack.audio.pause();
      this.activeTrack = track;
      this.renderGlobal();
      this.syncLaunchers();
      this.onPlaybackStart?.();
    });
    audio.addEventListener("pause", () => {
      this.renderGlobal();
      this.syncLaunchers();
    });
    audio.addEventListener("timeupdate", () => this.updateGlobalState());
    audio.addEventListener("loadedmetadata", () => {
      this.renderGlobal();
      this.updateGlobalState();
    });
    audio.addEventListener("error", () => {
      this.reportWarning?.({
        type: "audio-file",
        id,
        chapter: track.chapter,
        anchor: track.rawTitle,
        src: track.src
      });
    });
    audio.addEventListener("ended", () => this.next());
    this.tracks.push(track);
    this.trackById.set(id, track);
    this.renderGlobal();
    return track;
  }

  createLauncher(track) {
    const wrapper = document.createElement("div");
    wrapper.className = "audio-player-container";
    wrapper.innerHTML = `
      <div class="audio-launcher" data-track-id="${escapeHtml(track.id)}">
        <div class="audio-launcher-row">
          <button class="icon-btn" type="button" data-play aria-label="Воспроизвести">${icon("play", 20)}</button>
          <div class="audio-track-text">
            <div class="audio-track-artist">${track.artist || "Аудио"}</div>
            <div class="audio-track-title">${track.title}</div>
          </div>
          ${track.lyrics ? `<button class="icon-btn" type="button" data-lyrics aria-label="Показать текст">${icon("lyrics", 16)}</button>` : ""}
        </div>
      </div>
    `;
    wrapper.querySelector("[data-play]").addEventListener("click", () => this.toggle(track.id));
    wrapper.querySelector("[data-lyrics]")?.addEventListener("click", () => this.onLyrics(track));
    return wrapper;
  }

  toggle(trackId = this.activeTrack?.id) {
    const track = this.trackById.get(trackId);
    if (!track) return;
    if (this.activeTrack && this.activeTrack !== track) this.activeTrack.audio.pause();
    this.activeTrack = track;
    if (track.audio.paused) {
      if (Number.isFinite(track.visualSeekTime)) {
        track.resumeAfterSeek = true;
      } else {
        track.audio.play().catch(() => {});
      }
    } else {
      track.resumeAfterSeek = false;
      track.audio.pause();
    }
    this.renderGlobal();
    this.syncLaunchers();
  }

  previous() {
    if (!this.tracks.length) return;
    const index = Math.max(0, this.tracks.indexOf(this.activeTrack));
    const nextIndex = (index - 1 + this.tracks.length) % this.tracks.length;
    this.playTrack(this.tracks[nextIndex]);
  }

  next() {
    if (!this.tracks.length) return;
    const index = Math.max(0, this.tracks.indexOf(this.activeTrack));
    const nextIndex = (index + 1) % this.tracks.length;
    this.playTrack(this.tracks[nextIndex]);
  }

  playTrack(track) {
    if (this.activeTrack && this.activeTrack !== track) this.activeTrack.audio.pause();
    this.activeTrack = track;
    track.resumeAfterSeek = false;
    track.audio.play().catch(() => {});
    this.renderGlobal();
  }

  setVolume(value) {
    const volume = clamp(value, 0, 1);
    this.settings.volume = volume;
    if (volume > 0) this.settings.muted = false;
    for (const track of this.tracks) track.audio.volume = volume;
    for (const track of this.tracks) track.audio.muted = this.settings.muted;
    saveAudioSettings({ volume, muted: this.settings.muted });
    this.updateGlobalState();
  }

  setMuted(muted) {
    this.settings.muted = muted;
    for (const track of this.tracks) track.audio.muted = muted;
    saveAudioSettings({ muted });
    this.renderGlobal();
  }

  renderGlobal() {
    if (!this.global) return;
    const track = this.activeTrack || this.tracks[0];
    if (!track) {
      this.global.innerHTML = `
        <div class="audio-dropdown-header">
          <div class="audio-nav-controls">
            <button class="icon-btn" type="button" data-audio-prev aria-label="Предыдущий трек" title="Предыдущий трек" disabled>${icon("track-prev", 16)}</button>
            <h4>Сейчас играет</h4>
            <button class="icon-btn" type="button" data-audio-next aria-label="Следующий трек" title="Следующий трек" disabled>${icon("track-next", 16)}</button>
          </div>
          <button class="icon-btn" type="button" data-audio-close aria-label="Закрыть аудиоплеер" title="Закрыть аудиоплеер">${icon("close", 20)}</button>
        </div>
        <div class="audio-dropdown-content">
          <div class="no-audio-message">В текущей сессии аудио ещё не появлялось.</div>
        </div>
      `;
      return;
    }
    const audio = track.audio;
    const current = formatDuration(audio.currentTime);
    const total = Number.isFinite(audio.duration) ? formatDuration(audio.duration) : "0:00";
    const progress = Number.isFinite(audio.duration) && audio.duration > 0 ? (audio.currentTime / audio.duration) * 100 : 0;
    this.global.innerHTML = `
      <div class="audio-dropdown-header">
        <div class="audio-nav-controls">
          <button class="icon-btn audio-prev-btn" type="button" data-audio-prev aria-label="Предыдущий трек" title="Предыдущий трек">${icon("track-prev", 16)}</button>
          <h4>Сейчас играет</h4>
          <button class="icon-btn audio-next-btn" type="button" data-audio-next aria-label="Следующий трек" title="Следующий трек">${icon("track-next", 16)}</button>
        </div>
        <button class="icon-btn" type="button" data-audio-close aria-label="Закрыть аудиоплеер" title="Закрыть аудиоплеер">${icon("close", 20)}</button>
      </div>
      <div class="audio-dropdown-content">
        <div class="global-audio-card">
          <div class="audio-player-row">
            <div class="audio-player-left">
              <button class="icon-btn audio-play-btn" type="button" data-audio-play aria-label="Воспроизвести">${icon(audio.paused ? "play" : "pause", 24)}</button>
            </div>
            <div class="audio-player-center">
              <div class="audio-track-info">
                <div class="audio-track-title"><span class="audio-artist">${escapeHtml(track.artist || "Аудио")}</span> — <span class="audio-title">${escapeHtml(track.title)}</span></div>
                <div class="audio-time-display" data-time>${current} / ${total}</div>
              </div>
              <div class="audio-progress-container" data-seek role="slider" tabindex="0" aria-label="Позиция трека" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(progress)}">
                <div class="audio-progress-bar" data-seek-bar style="width:${progress}%"></div>
              </div>
            </div>
            <div class="audio-player-right">
              <button class="icon-btn audio-mute-btn" type="button" data-audio-mute aria-label="Отключить звук" title="Отключить звук">${icon(this.settings.muted ? "muted" : "volume", 20)}</button>
              <div class="audio-volume-container" data-volume role="slider" tabindex="0" aria-label="Громкость" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(this.settings.volume * 100)}">
                <div class="audio-volume-slider" data-volume-bar style="width:${this.settings.volume * 100}%"></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
    this.global.querySelector("[data-audio-prev]").addEventListener("click", () => this.previous());
    this.global.querySelector("[data-audio-play]").addEventListener("click", () => this.toggle(track.id));
    this.global.querySelector("[data-audio-next]").addEventListener("click", () => this.next());
    this.global.querySelector("[data-audio-mute]").addEventListener("click", () => this.setMuted(!this.settings.muted));
    this.bindSlider(this.global.querySelector("[data-seek]"), (percent) => this.seek(track, percent));
    this.bindSlider(this.global.querySelector("[data-volume]"), (percent) => this.setVolume(percent));
    this.updateGlobalState();
  }

  seek(track, percent) {
    track.pendingSeekPercent = clamp(percent, 0, 1);
    track.seekVersion += 1;
    const duration = Number.isFinite(track.audio.duration) ? track.audio.duration : 0;
    const target = duration ? track.pendingSeekPercent * duration : 0;
    if (!track.audio.paused) {
      track.resumeAfterSeek = true;
      if (!this.canSeekTo(track.audio, target)) track.audio.pause();
    }
    this.seekTrack(track).catch(() => {});
  }

  async seekTrack(track) {
    const version = track.seekVersion;
    const audio = track.audio;
    const duration = Number.isFinite(audio.duration) ? audio.duration : 0;
    if (!duration) return;
    let target = track.pendingSeekPercent * duration;
    if (!audio.paused && !this.canSeekTo(audio, target)) {
      track.resumeAfterSeek = true;
      audio.pause();
    }
    track.visualSeekTime = target;
    this.updateGlobalState();
    this.setAudioCurrentTime(audio, target);
    if (this.canSeekTo(audio, target)) {
      await this.settleSeek(audio, target, 300);
      if (version === track.seekVersion) {
        const resumeWhenReady = track.resumeAfterSeek;
        track.visualSeekTime = null;
        track.resumeAfterSeek = false;
        this.updateGlobalState();
        if (resumeWhenReady && audio.paused) audio.play().catch(() => {});
      }
      return;
    }
    const accepted = await this.settleSeek(audio, target, 350);
    if (version !== track.seekVersion) return;
    if (!accepted) {
      if (!audio.paused) {
        track.resumeAfterSeek = true;
        audio.pause();
      }
      await this.ensureSeekableSource(track);
    }
    if (version !== track.seekVersion) return;
    const latestDuration = Number.isFinite(audio.duration) ? audio.duration : duration;
    target = clamp((track.pendingSeekPercent ?? 0) * latestDuration, 0, latestDuration);
    track.visualSeekTime = target;
    this.setAudioCurrentTime(audio, target);
    await this.settleSeek(audio, target, 500);
    if (version === track.seekVersion) {
      track.visualSeekTime = null;
    }
    this.updateGlobalState();
    if (version === track.seekVersion && track.resumeAfterSeek && audio.paused) {
      track.resumeAfterSeek = false;
      audio.play().catch(() => {});
    }
  }

  setAudioCurrentTime(audio, target) {
    try {
      audio.currentTime = target;
    } catch (error) {
      // Some media backends reject a seek before the source is ready; fallback handles it.
    }
  }

  settleSeek(audio, target, timeout) {
    const isClose = () => Math.abs((audio.currentTime || 0) - target) < 2;
    if (isClose()) return Promise.resolve(true);
    return new Promise((resolve) => {
      const done = (value) => {
        window.clearTimeout(timer);
        audio.removeEventListener("seeked", check);
        audio.removeEventListener("timeupdate", check);
        resolve(value);
      };
      const check = () => {
        if (isClose()) done(true);
      };
      const timer = window.setTimeout(() => done(isClose()), timeout);
      audio.addEventListener("seeked", check);
      audio.addEventListener("timeupdate", check);
    });
  }

  canSeekTo(audio, target) {
    if (target <= 0) return true;
    const ranges = audio.seekable;
    if (!ranges?.length) return false;
    for (let index = 0; index < ranges.length; index += 1) {
      if (target >= ranges.start(index) && target <= ranges.end(index)) return true;
    }
    return false;
  }

  async ensureSeekableSource(track) {
    if (track.blobUrl) return;
    if (!track.blobPromise) {
      track.blobPromise = fetch(track.originalSrc)
        .then((response) => {
          if (!response.ok) throw new Error(`Failed to fetch audio: ${response.status}`);
          return response.blob();
        })
        .then(async (blob) => {
          track.blobUrl = URL.createObjectURL(blob);
          track.audio.src = track.blobUrl;
          track.audio.load();
          await this.waitForMetadata(track.audio);
          return track.blobUrl;
        });
    }
    await track.blobPromise;
  }

  waitForMetadata(audio) {
    if (Number.isFinite(audio.duration) && audio.duration > 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const cleanup = () => {
        audio.removeEventListener("loadedmetadata", onLoaded);
        audio.removeEventListener("error", onError);
      };
      const onLoaded = () => {
        cleanup();
        resolve();
      };
      const onError = () => {
        cleanup();
        reject(audio.error || new Error("Audio metadata failed to load"));
      };
      audio.addEventListener("loadedmetadata", onLoaded, { once: true });
      audio.addEventListener("error", onError, { once: true });
    });
  }

  bindSlider(container, onUpdate) {
    if (!container) return;
    let activePointerId = null;
    const start = (event) => {
      if (!isPrimarySliderPointer(event)) return;
      activePointerId = event.pointerId;
      try {
        container.setPointerCapture?.(event.pointerId);
      } catch (error) {
        // Pointer capture is optional; seek should still work without it.
      }
      container.classList.add("dragging");
      onUpdate(getSliderPercent(container, event));
      event.preventDefault();
      event.stopPropagation();
    };
    const move = (event) => {
      if (activePointerId === null) return;
      if (activePointerId !== event.pointerId) return;
      onUpdate(getSliderPercent(container, event));
      event.preventDefault();
      event.stopPropagation();
    };
    const end = (event) => {
      if (activePointerId !== event.pointerId) return;
      activePointerId = null;
      container.classList.remove("dragging");
      try {
        container.releasePointerCapture?.(event.pointerId);
      } catch (error) {
        // Some browsers release capture automatically.
      }
      event.preventDefault();
      event.stopPropagation();
    };
    container.addEventListener("pointerdown", start);
    container.addEventListener("pointermove", move);
    container.addEventListener("pointerup", end);
    container.addEventListener("pointercancel", end);
    container.addEventListener("contextmenu", (event) => {
      event.preventDefault();
      event.stopPropagation();
    });
    container.addEventListener("keydown", (event) => {
      const current = Number(container.getAttribute("aria-valuenow")) || 0;
      let next = current;
      if (event.key === "ArrowLeft" || event.key === "ArrowDown") next = current - 5;
      else if (event.key === "ArrowRight" || event.key === "ArrowUp") next = current + 5;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = 100;
      else return;
      event.preventDefault();
      event.stopPropagation();
      onUpdate(clamp(next, 0, 100) / 100);
    });
  }

  updateGlobalState() {
    if (!this.global) return;
    const track = this.activeTrack || this.tracks[0];
    if (!track) return;
    const audio = track.audio;
    const displayTime = Number.isFinite(track.visualSeekTime) ? track.visualSeekTime : audio.currentTime;
    const current = formatDuration(displayTime);
    const total = Number.isFinite(audio.duration) ? formatDuration(audio.duration) : "0:00";
    const progress = Number.isFinite(audio.duration) && audio.duration > 0 ? (displayTime / audio.duration) * 100 : 0;
    const progressBar = this.global.querySelector("[data-seek-bar]");
    const progressSlider = this.global.querySelector("[data-seek]");
    const volumeBar = this.global.querySelector("[data-volume-bar]");
    const volumeSlider = this.global.querySelector("[data-volume]");
    const muteButton = this.global.querySelector("[data-audio-mute]");
    const time = this.global.querySelector("[data-time]");
    if (time) time.textContent = `${current} / ${total}`;
    if (progressBar) progressBar.style.width = `${progress}%`;
    if (progressSlider) progressSlider.setAttribute("aria-valuenow", String(Math.round(progress)));
    if (volumeBar) volumeBar.style.width = `${this.settings.volume * 100}%`;
    if (volumeSlider) volumeSlider.setAttribute("aria-valuenow", String(Math.round(this.settings.volume * 100)));
    if (muteButton) muteButton.innerHTML = icon(this.settings.muted ? "muted" : "volume", 20);
  }

  syncLaunchers() {
    document.querySelectorAll("[data-track-id]").forEach((launcher) => {
      const track = this.trackById.get(launcher.dataset.trackId);
      const play = launcher.querySelector("[data-play]");
      if (!track || !play) return;
      play.innerHTML = icon(track.audio.paused ? "play" : "pause", 20);
    });
  }

  pauseAll() {
    for (const track of this.tracks) {
      track.resumeAfterSeek = false;
      track.audio.pause();
    }
  }
}
