// js/media-injector.js

import Utils from "./utils.js";
import { MEDIA_TYPES, MEDIA_CONFIG_PATH } from "./constants.js";

class MediaInjector {
  constructor(themeManager = null, audioManager = null) {
    this.mediaRules = [];
    this.audioPlayers = new Map();
    this.contentParser = new DOMParser();
    this.themeManager = themeManager;
    this.audioManager = audioManager;
    this.initialized = false;
  }

  async init() {
    if (this.initialized) return;

    await this.loadMediaRules();
    this.initialized = true;
    console.log("✅ MediaInjector initialized");
  }

  async loadMediaRules() {
    try {
      const config = await Utils.loadJSON(MEDIA_CONFIG_PATH);
      if (config && config.media) {
        this.mediaRules = config.media;
        console.log(`📦 Loaded ${this.mediaRules.length} media rules`);
      } else {
        console.log("No media rules found");
      }
    } catch (error) {
      console.warn("Error loading media rules:", error);
    }
  }

  async injectMedia(html, chapterNumber) {
    console.log(`🎯 injectMedia called for chapter ${chapterNumber}`);

    const chapterRules = this.mediaRules.filter(
      (rule) => rule.chapter === chapterNumber,
    );

    console.log(
      `📋 Found ${chapterRules.length} rules for chapter ${chapterNumber}:`,
      chapterRules,
    );

    if (chapterRules.length === 0) {
      return html;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    for (const rule of chapterRules) {
      console.log(`🔧 Applying rule:`, rule);
      await this.applyRule(doc, rule);
    }

    return doc.body.innerHTML;
  }

  async applyRule(doc, rule) {
    console.log(`🔍 Looking for anchor: "${rule.anchor.substring(0, 50)}..."`);

    const targetParagraph = this.findParagraphByText(doc, rule.anchor);

    if (!targetParagraph) {
      console.warn(
        `❌ Media rule anchor not found: "${rule.anchor}" in chapter ${rule.chapter}`,
      );
      return;
    }

    console.log(`✅ Found anchor paragraph`);

    const mediaElement = await this.createMediaElement(rule); // await

    if (!mediaElement) {
      console.warn(`❌ Failed to create media element for rule:`, rule);
      return;
    }

    if (!(mediaElement instanceof Node)) {
      console.error(`❌ Media element is not a valid Node:`, mediaElement);
      return;
    }

    if (rule.position === "before") {
      targetParagraph.parentNode.insertBefore(mediaElement, targetParagraph);
    } else {
      targetParagraph.parentNode.insertBefore(
        mediaElement,
        targetParagraph.nextSibling,
      );
    }

    console.log(`✅ Media element inserted`);
  }

  async openLyricsPanel(audioPath, trackTitle) {
    const panel = document.getElementById("lyrics-panel");
    const content = document.getElementById("lyrics-content");

    if (!panel || !content) {
      console.error("Lyrics panel or content not found");
      return;
    }

    content.textContent = "Загрузка...";

    const rule = this.mediaRules.find(
      (r) => r.src && r.src.some((s) => s.includes(audioPath.split("/").pop())),
    );

    if (rule && rule.lyrics) {
      if (typeof rule.lyrics === "string") {
        if (rule.lyrics.endsWith(".txt") || rule.lyrics.endsWith(".lrc")) {
          try {
            const response = await fetch(rule.lyrics);
            if (response.ok) {
              content.textContent = await response.text();
            } else {
              content.textContent = "Ошибка загрузки текста.";
            }
          } catch (e) {
            content.textContent = "Ошибка загрузки текста.";
          }
        } else {
          content.textContent = rule.lyrics;
        }
      } else {
        content.textContent = "Текст недоступен.";
      }
    } else {
      content.textContent = "Текст недоступен.";
    }

    panel.classList.add("open");

    const overlay = document.getElementById("overlay");
    if (overlay) {
      overlay.classList.add("visible");
    }
  }

  findParagraphByText(doc, searchText) {
    const paragraphs = doc.querySelectorAll("p");
    for (const paragraph of paragraphs) {
      if (paragraph.textContent.includes(searchText)) {
        return paragraph;
      }
    }
    return null;
  }

  async createMediaElement(rule) {
    const container = Utils.createElement("div", "media-container", {
      "data-media-id": rule.id || `media-${Date.now()}`,
      "data-type": rule.type,
    });

    let innerElement;
    switch (rule.type) {
      case MEDIA_TYPES.AUDIO:
        innerElement = await this.createAudioElement(container, rule);
        break;
      case MEDIA_TYPES.IMAGE:
        innerElement = await this.createImageElement(container, rule);
        break;
      default:
        console.warn(`Unknown media type: ${rule.type}`);
        return null;
    }

    if (!innerElement) {
      return null;
    }

    return container;
  }

  async createImageElement(container, rule) {
    const imagePaths = rule.src;
    if (!imagePaths || !Array.isArray(imagePaths) || imagePaths.length === 0) {
      console.error("No image sources provided in rule:", rule);
      return null;
    }

    if (rule.width) container.style.width = rule.width;
    if (rule.height) container.style.height = rule.height;

    const loadPromises = imagePaths.map((path, index) => {
      return this.loadImageElement(path, rule, index);
    });

    const imageElements = await Promise.all(loadPromises);
    let hasValidImages = false;

    imageElements.forEach((img, index) => {
      if (img) {
        container.appendChild(img);
        hasValidImages = true;
        if (index < imageElements.length - 1) {
          const spacer = Utils.createElement("div");
          spacer.style.height = "1rem";
          container.appendChild(spacer);
        }
      }
    });

    return hasValidImages ? container : null;
  }

  async loadImageElement(path, rule, index) {
    const normalizedPath = this.normalizePath(path);

    const img = Utils.createElement("img", "media-image", {
      src: normalizedPath,
      alt: rule.alt || `Изображение ${rule.id || "unknown"} - ${index + 1}`,
      loading: "lazy",
    });

    if (rule.width) img.style.width = rule.width;
    if (rule.height) img.style.height = rule.height;

    img.onerror = () => {
      console.error(`❌ Failed to load image: ${normalizedPath}`);
      img.style.display = "none";

      const errorSpan = Utils.createElement("span");
      errorSpan.textContent = `[Ошибка загрузки изображения: ${path}]`;
      errorSpan.style.color = "var(--error-color, red)";
      errorSpan.style.fontSize = "0.8em";

      img.parentNode?.insertBefore(errorSpan, img.nextSibling);
    };

    return img;
  }

  async createAudioElement(container, rule) {
    console.log(`🎵 Creating audio element for rule:`, rule);

    const audioPath = rule.src?.[0];
    if (!audioPath) {
      console.error("No audio path provided in rule:", rule);
      return null;
    }

    const normalizedPath = this.normalizePath(audioPath);
    console.log(`🎵 Audio path: ${normalizedPath}`);

    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = normalizedPath;

    this.audioPlayers.set(normalizedPath, audio);

    const playerHTML = this.createAudioPlayerHTML(
      normalizedPath,
      rule.title || "Аудиофайл",
    );

    container.innerHTML = playerHTML;

    const playerContainer = container.querySelector(".custom-audio-player");
    if (playerContainer) {
      console.log(`✅ Audio player container created`);

      if (playerContainer.classList.contains("audio-launcher")) {
        this.setupAudioLauncher(
          playerContainer,
          audio,
          normalizedPath,
          rule.title || "Аудиофайл",
        );
      } else {
        this.setupAudioPlayerControls(
          playerContainer,
          audio,
          normalizedPath,
          rule.title || "Аудиофайл",
        );
      }

      return container;
    } else {
      console.error(`❌ Audio player container not found in HTML`);
      return null;
    }
  }

  createAudioPlayerHTML(audioPath, title) {
    const [artist, trackName] = this.splitTrackInfo(title);

    return `
    <div class="audio-player-container">
      <div class="custom-audio-player audio-launcher" data-audio-path="${audioPath}" data-original-title="${Utils.escapeHtml(title)}">
        <div class="launcher-row">
          <button class="control-btn play-btn" aria-label="Воспроизведение" type="button">
            <svg class="play-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z"/>
            </svg>
            <svg class="pause-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" style="display: none;">
              <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
            </svg>
          </button>
          
          <div class="launcher-info">
            <div class="launcher-artist">${artist || "Исполнитель"}</div>
            <div class="launcher-title">${trackName || "Название трека"}</div>
          </div>

          <button class="control-btn lyrics-btn" aria-label="Показать текст" title="Показать текст">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/>
              <path d="M14 3.5L18.5 8H14V3.5z"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  `;
  }

  splitTrackInfo(trackString) {
    const parts = trackString.split(" — ");
    if (parts.length >= 2) {
      return [parts[0], parts.slice(1).join(" — ")];
    }
    return ["", trackString];
  }

  setupAudioLauncher(playerElement, audio, audioPath, trackTitle) {
    const playBtn = playerElement.querySelector(".play-btn");
    const playIcon = playerElement.querySelector(".play-icon");
    const pauseIcon = playerElement.querySelector(".pause-icon");
    const artistElement = playerElement.querySelector(".launcher-artist");
    const titleElement = playerElement.querySelector(".launcher-title");

    if (!playBtn) {
      console.error("Play button not found in launcher");
      return;
    }

    let isPlaying = false;

    const [artist, title] = this.splitTrackInfo(trackTitle);
    if (artistElement) {
      artistElement.textContent =
        artist && artist.trim() ? artist : "Неизвестный исполнитель";
    }
    if (titleElement) {
      titleElement.textContent =
        title && title.trim() ? title : "Неизвестный трек";
    }

    const updateButton = () => {
      if (playIcon && pauseIcon) {
        playIcon.style.display = isPlaying ? "none" : "block";
        pauseIcon.style.display = isPlaying ? "block" : "none";
      }
    };

    const onPlay = () => {
      isPlaying = true;
      updateButton();

      if (this.audioManager) {
        this.audioManager.registerAudioPlayer(audio, {
          title: trackTitle,
          path: audioPath,
          element: playerElement,
          isLauncher: true,
        });
      }
    };

    const onPause = () => {
      isPlaying = false;
      updateButton();
    };

    const onEnded = () => {
      isPlaying = false;
      updateButton();
      audio.currentTime = 0;
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);

    playBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (isPlaying) {
        audio.pause();
      } else {
        this.stopAllCurrentPlayersExcept(audio);
        audio.play().catch((err) => {
          console.error("Play error:", err);
        });
      }
    });

    const lyricsBtn = playerElement.querySelector(".lyrics-btn");
    if (lyricsBtn) {
      lyricsBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this.openLyricsPanel(audioPath, trackTitle);
      });
    }

    updateButton();

    if (this.audioManager) {
      this.audioManager.registerAudioPlayer(audio, {
        title: trackTitle,
        path: audioPath,
        element: playerElement,
        isLauncher: true,
      });
    }

    if (this.audioManager) {
      this.audioManager.registerAudioPlayer(audio, {
        title: trackTitle,
        path: audioPath,
        element: playerElement,
        isLauncher: true,
      });
    }
  }

  stopAllCurrentPlayersExcept(currentAudio) {
    for (const [path, audio] of this.audioPlayers.entries()) {
      if (audio !== currentAudio && !audio.paused) {
        audio.pause();
        console.log(`MediaInjector: Stopped other audio: ${path}`);
      }
    }
  }

  setupAudioPlayerControls(playerElement, audio, audioPath, trackTitle) {
    const playBtn = playerElement.querySelector(".play-btn");
    const playIcon = playerElement.querySelector(".play-icon");
    const pauseIcon = playerElement.querySelector(".pause-icon");
    const muteBtn = playerElement.querySelector(".mute-btn");
    const volumeIcon = playerElement.querySelector(".volume-icon");
    const mutedIcon = playerElement.querySelector(".muted-icon");
    const progressContainer = playerElement.querySelector(
      ".progress-container",
    );
    const progressBar = playerElement.querySelector(".progress-bar");
    const timeDisplay = playerElement.querySelector(".time-display");
    const volumeSliderContainer = playerElement.querySelector(
      ".volume-slider-container",
    );
    const volumeSlider = playerElement.querySelector(".volume-slider");
    const statusDiv = playerElement.querySelector(".player-status");

    if (playerElement.classList.contains("audio-launcher")) {
      console.log(
        "⚠️ Лаунчер попал в setupAudioPlayerControls, перенаправляем...",
      );
      if (trackTitle) {
        this.setupAudioLauncher(playerElement, audio, audioPath, trackTitle);
      } else {
        const registeredPlayer = this.audioManager?.getRegisteredAudioPlayer?.(
          audio.src,
        );
        const titleToUse = registeredPlayer?.title || "Неизвестный трек";
        this.setupAudioLauncher(playerElement, audio, audio.src, titleToUse);
      }
      return;
    }

    if (!playBtn || !progressContainer) {
      console.error("Critical control elements not found in player");
      return;
    }

    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent);
    const supportsVolumeControl = typeof audio.volume !== "undefined" && !isIOS;

    if (!supportsVolumeControl && muteBtn) {
      const volumeSection = playerElement.querySelector(".volume-section");
      if (volumeSection) {
        volumeSection.style.display = "none";
      }
    }

    let isPlaying = false;
    let isMuted = false;
    let volume = 0.7;
    let updateInterval = null;

    const formatTime = (seconds) => {
      if (isNaN(seconds) || seconds <= 0) return "0:00";
      const mins = Math.floor(seconds / 60);
      const secs = Math.floor(seconds % 60);
      return `${mins}:${secs.toString().padStart(2, "0")}`;
    };

    const updateProgress = () => {
      if (!audio.duration || isNaN(audio.duration)) {
        timeDisplay.textContent = "0:00 / 0:00";
        progressBar.style.width = "0%";
        return;
      }

      const progress = (audio.currentTime / audio.duration) * 100;
      progressBar.style.width = `${progress}%`;
      timeDisplay.textContent = `${formatTime(audio.currentTime)} / ${formatTime(audio.duration)}`;
    };

    const updateButtonStates = () => {
      if (playIcon && pauseIcon) {
        playIcon.style.display = isPlaying ? "none" : "block";
        pauseIcon.style.display = isPlaying ? "block" : "none";
      }
      if (volumeIcon && mutedIcon && supportsVolumeControl) {
        volumeIcon.style.display = isMuted ? "none" : "block";
        mutedIcon.style.display = isMuted ? "block" : "none";
      }
    };

    const showStatus = (message, color = "#2196f3", timeout = 2000) => {
      if (statusDiv) {
        statusDiv.style.display = "block";
        statusDiv.textContent = message;
        statusDiv.style.color = color;

        if (timeout > 0) {
          setTimeout(() => {
            statusDiv.style.display = "none";
          }, timeout);
        }
      }
    };

    const hideStatus = () => {
      if (statusDiv) {
        statusDiv.style.display = "none";
      }
    };

    const onPlay = () => {
      isPlaying = true;
      updateButtonStates();

      if (updateInterval) clearInterval(updateInterval);
      updateInterval = setInterval(updateProgress, 100);

      if (this.audioManager) {
        this.audioManager.registerAudioPlayer(audio, {
          title: trackTitle,
          path: audioPath,
          element: playerElement,
        });
      }
    };

    const onPause = () => {
      isPlaying = false;
      updateButtonStates();

      if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
      }
    };

    const onEnded = () => {
      isPlaying = false;
      updateButtonStates();
      audio.currentTime = 0;
      updateProgress();

      if (updateInterval) {
        clearInterval(updateInterval);
        updateInterval = null;
      }
    };

    const onError = (e) => {
      console.error("Audio error:", audio.error);
      showStatus("Ошибка загрузки", "#f44336", 5000);
      onPause();
    };

    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("error", onError);
    audio.addEventListener("loadedmetadata", () => {
      updateProgress();
      hideStatus();
      showStatus("Готово", "#43a047", 1500);
    });
    audio.addEventListener("canplay", hideStatus);

    playBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (isPlaying) {
        audio.pause();
      } else {
        audio.play().catch((err) => {
          console.error("Play error:", err);
          if (err.name === "NotAllowedError") {
            showStatus("Нажмите на страницу для разрешения", "#ff9800", 3000);
          }
        });
      }
    });

    progressContainer.addEventListener("click", (e) => {
      if (!audio.duration || isNaN(audio.duration)) return;

      const rect = progressContainer.getBoundingClientRect();
      const percent = (e.clientX - rect.left) / rect.width;
      audio.currentTime = percent * audio.duration;
      updateProgress();
    });

    if (supportsVolumeControl && muteBtn) {
      muteBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        isMuted = !isMuted;
        audio.muted = isMuted;
        updateButtonStates();
      });

      if (volumeSliderContainer) {
        volumeSliderContainer.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();

          const rect = volumeSliderContainer.getBoundingClientRect();
          const percent = (e.clientX - rect.left) / rect.width;
          volume = Utils.clamp(percent, 0, 1);
          audio.volume = volume;
          audio.muted = false;
          isMuted = false;
          volumeSlider.style.width = `${volume * 100}%`;
          updateButtonStates();
        });
      }
    }

    if (supportsVolumeControl) {
      audio.volume = volume;
    }
    updateButtonStates();
    updateProgress();

    if (this.audioManager) {
      this.audioManager.registerAudioPlayer(audio, {
        title: trackTitle,
        path: audioPath,
        element: playerElement,
      });
    }
  }

  normalizePath(path) {
    if (!path) return "";

    let normalized = path.trim();

    if (normalized.startsWith("/")) {
      normalized = "." + normalized;
    }

    if (
      normalized.startsWith("./") ||
      normalized.startsWith("http://") ||
      normalized.startsWith("https://") ||
      normalized.startsWith("data:")
    ) {
      return normalized;
    }

    return "./" + normalized;
  }

  stopAllCurrentPlayers() {
    for (const [path, audio] of this.audioPlayers.entries()) {
      if (!audio.paused) {
        audio.pause();
        console.log(`MediaInjector: Paused audio for path: ${path}`);
      }
    }
  }

  reinitializeAudioPlayersInContainer(containerElement) {
    if (!containerElement) {
      console.warn(
        "Container element for reinitializing audio players is null",
      );
      return;
    }

    const playerElements = containerElement.querySelectorAll(
      ".custom-audio-player",
    );
    playerElements.forEach((playerElement) => {
      const audioPath = playerElement.getAttribute("data-audio-path");
      if (!audioPath) return;

      const audio = this.audioPlayers.get(audioPath);
      if (!audio) {
        console.warn(`Audio object for path '${audioPath}' not found`);
        return;
      }

      if (playerElement.classList.contains("audio-launcher")) {
        const originalTitle =
          playerElement.getAttribute("data-original-title") ||
          "Неизвестный трек";
        this.setupAudioLauncher(playerElement, audio, audioPath, originalTitle);
      } else {
        this.setupAudioPlayerControls(
          playerElement,
          audio,
          audioPath,
          "Неизвестный трек",
        );
      }
    });
  }

  cleanup() {
    for (const [path, audio] of this.audioPlayers.entries()) {
      audio.pause();
      audio.src = "";
      audio.load();
    }

    this.audioPlayers.clear();
    this.mediaRules = [];
    this.initialized = false;
  }
}

export default MediaInjector;
