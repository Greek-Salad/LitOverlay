<script lang="ts">
  import { onMount } from 'svelte';

  export let src = '';
  export let title = '';
  export let theme: 'light' | 'dark' = 'light';

  // Извлекаем название из src, если не задано
  if (!title && src) {
    const filename = src.split('/').pop()?.replace(/\.[^/.]+$/, '');
    title = filename || 'Неизвестный трек';
  }

  let audio: HTMLAudioElement;
  let isPlaying = false;
  let currentTime = 0;
  let duration = 0;
  let volume = 1;
  let isMuted = false;

  function formatTime(seconds: number): string {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }

  function togglePlay() {
    if (isPlaying) {
      audio.pause();
    } else {
      audio.play().catch(e => console.warn('Autoplay blocked:', e));
    }
    isPlaying = !isPlaying;
  }

  function toggleMute() {
    if (isMuted) {
      audio.volume = volume;
      isMuted = false;
    } else {
      audio.volume = 0;
      isMuted = true;
    }
  }

  function seek(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    audio.currentTime = Math.max(0, Math.min(duration, percent * duration));
  }

  function setVolume(event: MouseEvent) {
    const target = event.currentTarget as HTMLElement;
    const rect = target.getBoundingClientRect();
    const percent = (event.clientX - rect.left) / rect.width;
    const newVol = Math.max(0, Math.min(1, percent));
    audio.volume = newVol;
    volume = newVol;
    isMuted = newVol === 0;
  }

  onMount(() => {
    audio = new Audio(src);
    audio.volume = volume;

    audio.addEventListener('loadedmetadata', () => {
      duration = audio.duration;
    });
    audio.addEventListener('timeupdate', () => {
      currentTime = audio.currentTime;
    });
    audio.addEventListener('ended', () => {
      isPlaying = false;
    });
    audio.addEventListener('volumechange', () => {
      if (audio.volume === 0 && !isMuted) {
        isMuted = true;
      } else if (audio.volume > 0 && isMuted) {
        isMuted = false;
      }
    });
  });

  $: iconColor = theme === 'dark' ? 'white' : 'black';
</script>

<div class="custom-audio-player" data-theme="{theme}">
  <!-- Основная строка -->
  <div class="player-row">
    <!-- Play/Pause -->
    <button on:click={togglePlay} class="control-btn play-btn">
      <img
        src="/icons/{isPlaying ? 'pause' : 'play'}-{iconColor}.svg"
        alt={isPlaying ? 'Pause' : 'Play'}
        width="20"
        height="20"
      />
    </button>

    <!-- Центр: название + время -->
    <div class="center-column">
      <div class="title-time-row">
        <span class="track-title">{title}</span>
        <span class="time-display">{formatTime(currentTime)} / {formatTime(duration)}</span>
      </div>
      <!-- Прогресс-бар -->
      <button type="button" class="progress-container" on:click={seek} aria-label="Seek track" title="Seek track">
        <div
          class="progress-bar"
          style="width: {duration ? (currentTime / duration) * 100 : 0}%"
        ></div>
      </button>
    </div>

    <!-- Громкость -->
    <div class="volume-section">
      <button on:click={toggleMute} class="control-btn mute-btn">
        <img
          src="/icons/{isMuted ? 'muted' : 'volume'}-{iconColor}.svg"
          alt={isMuted ? 'Unmute' : 'Mute'}
          width="16"
          height="16"
        />
      </button>
      <button type="button" class="volume-slider-container" on:click={setVolume} aria-label="Set volume" title="Set volume">
        <div
          class="volume-slider"
          style="width: {(volume) * 100}%"
        ></div>
      </button>
    </div>
  </div>
</div>

<style>
  .custom-audio-player {
    background: var(--bg-color);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    padding: 12px 16px;
    width: 100%;
    max-width: 600px;
    margin: 1rem auto;
    font-family: inherit;
    box-sizing: border-box;
  }

  .player-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .control-btn {
    background: none;
    border: none;
    cursor: pointer;
    padding: 4px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .control-btn:hover {
    background: var(--hover-bg);
  }

  .center-column {
    flex-grow: 1;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .title-time-row {
    display: flex;
    justify-content: space-between;
    font-size: 0.875rem;
    color: var(--text-color);
  }

  .track-title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    max-width: 200px;
  }

  .time-display {
    color: var(--text-muted);
    min-width: 50px;
    text-align: right;
  }

  .progress-container {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    border: none;
    padding: 0;
    height: 6px;
    background: var(--progress-bg);
    border-radius: 3px;
    cursor: pointer;
    position: relative;
  }

  .progress-bar {
    height: 100%;
    background: var(--progress-fill);
    border-radius: 3px;
    transition: width 0.1s ease;
  }

  .volume-section {
    display: flex;
    align-items: center;
    gap: 8px;
    min-width: 100px;
  }

  .volume-slider-container {
    -webkit-appearance: none;
    -moz-appearance: none;
    appearance: none;
    border: none;
    padding: 0;
    height: 6px;
    background: var(--progress-bg);
    border-radius: 3px;
    cursor: pointer;
    flex-grow: 1;
    position: relative;
  }

  .volume-slider {
    height: 100%;
    background: var(--progress-fill);
    border-radius: 3px;
    transition: width 0.1s ease;
  }

  /* Темы */
  :global(.theme-light) .custom-audio-player {
    --bg-color: #f9f9f9;
    --border-color: #ddd;
    --text-color: #222;
    --text-muted: #666;
    --hover-bg: #e0e0e0;
    --progress-bg: #ddd;
    --progress-fill: #1e88e5;
  }

  :global(.theme-dark) .custom-audio-player {
    --bg-color: #222;
    --border-color: #444;
    --text-color: #eee;
    --text-muted: #aaa;
    --hover-bg: #333;
    --progress-bg: #444;
    --progress-fill: #4fc3f7;
  }
</style>