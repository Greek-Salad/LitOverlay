"use strict";

class MediaInjector {
  constructor() {
    this.mediaRules = [];
    this.audioPlayers = new Map();
    this.init();
  }

  async init() {
    await this.loadMediaRules();
    console.log("✅ MediaInjector initialized");
  }

  async loadMediaRules() {
    try {
      const response = await fetch("./config/media-rules.json");
      if (!response.ok) {
        console.log("No media rules found");
        return;
      }

      const config = await response.json();
      this.mediaRules = config.media || [];
      console.log(`📦 Loaded ${this.mediaRules.length} media rules`);
    } catch (error) {
      console.warn("Error loading media rules:", error);
    }
  }

  async injectMedia(html, chapterNumber) {
    const chapterRules = this.mediaRules.filter(
      (rule) => rule.chapter === chapterNumber,
    );

    if (chapterRules.length === 0) {
      return html;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");
    const paragraphs = Array.from(doc.querySelectorAll("p"));

    chapterRules.forEach((rule) => {
      this.applyRule(doc, paragraphs, rule);
    });

    return doc.body.innerHTML;
  }

  applyRule(doc, paragraphs, rule) {
    const targetParagraph = this.findParagraphByText(paragraphs, rule.anchor);

    if (!targetParagraph) {
      console.warn(
        `Media rule anchor not found: "${rule.anchor}" in chapter ${rule.chapter}`,
      );
      return;
    }

    const mediaElement = this.createMediaElement(rule);

    if (!mediaElement) {
      console.warn(`Failed to create media element for rule:`, rule);
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

    if (rule.description) {
      const caption = this.createCaption(rule.description);
      mediaElement.parentNode.insertBefore(caption, mediaElement.nextSibling);
    }
  }

  findParagraphByText(paragraphs, searchText) {
    return paragraphs.find((p) => {
      const text = p.textContent.trim();
      return text.includes(searchText);
    });
  }

  createMediaElement(rule) {
    const container = document.createElement("div");
    container.className = "media-container";
    container.dataset.mediaId = rule.id || `media-${Date.now()}`;
    container.dataset.type = rule.type;

    switch (rule.type) {
      case "audio":
        return this.createAudioElement(container, rule);
      case "image":
        return this.createImageElement(container, rule);
      default:
        console.warn(`Unknown media type: ${rule.type}`);
        return null;
    }
  }

  createImageElement(container, rule) {
    console.log("🖼️ Starting image element creation for rule:", rule);

    const imagePaths = rule.src;
    if (!imagePaths || !Array.isArray(imagePaths) || imagePaths.length === 0) {
      console.error("No image sources provided in rule:", rule);
      return null;
    }

    if (rule.width) {
      container.style.width = rule.width;
    }
    if (rule.height) {
      container.style.height = rule.height;
    }

    for (let i = 0; i < imagePaths.length; i++) {
      let imagePath = imagePaths[i];

      if (
        !imagePath.startsWith("/") &&
        !imagePath.startsWith("./") &&
        !imagePath.startsWith("http")
      ) {
        imagePath = "./" + imagePath;
      }

      console.log(`🖼️ Creating image element for: ${imagePath}`);

      const imgElement = document.createElement("img");
      imgElement.src = imagePath;
      imgElement.alt = rule.alt || `Изображение ${rule.id || 'unknown'} - ${i+1}`;
      imgElement.className = "media-image";

      if (rule.width) {
        imgElement.style.width = rule.width;
      }
      if (rule.height) {
        imgElement.style.height = rule.height;
      }

      imgElement.onerror = () => {
        console.error(`❌ Failed to load image: ${imagePath}`);
        imgElement.style.display = 'none';
        const errorSpan = document.createElement('span');
        errorSpan.textContent = `[Ошибка загрузки изображения: ${imagePath}]`;
        errorSpan.style.color = 'red';
        errorSpan.style.fontSize = '0.8em';
        imgElement.parentNode?.insertBefore(errorSpan, imgElement.nextSibling);
      };

      container.appendChild(imgElement);

      if (i < imagePaths.length - 1) {
        const spacer = document.createElement('div');
        spacer.style.height = '1rem';
        container.appendChild(spacer);
      }
    }

    return container;
  }

  createAudioElement(container, rule) {
    console.log("🎵 Starting audio player creation...");
    let audioPath = rule.src[0];
    if (!audioPath) {
      console.error("No audio path provided in rule:", rule);
      return null;
    }

    if (
      !audioPath.startsWith("/") &&
      !audioPath.startsWith("./") &&
      !audioPath.startsWith("http")
    ) {
      audioPath = "./" + audioPath;
    }

    console.log(`🎵 Creating audio player for: ${audioPath}`);

    const playerContainer = document.createElement("div");
    playerContainer.className = "audio-player-container";

    const audio = new Audio();
    audio.preload = "metadata";
    audio.src = audioPath;

    playerContainer.innerHTML = `
            <div class="custom-audio-player" data-audio-path="${audioPath}">
                <div class="player-row">
                    <button class="control-btn play-btn" aria-label="Воспроизведение" type="button">
                        <svg class="play-icon" width="24" height="24" viewBox="0 0 24 24">
                            <path d="M8 5v14l11-7z"/>
                        </svg>
                        <svg class="pause-icon" width="24" height="24" viewBox="0 0 24 24" style="display: none;">
                            <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/>
                        </svg>
                    </button>
                    <div class="center-column">
                        <div class="title-time-row">
                            <span class="track-title">${rule.title || "Аудиофайл"}</span>
                            <span class="time-display">0:00 / 0:00</span>
                        </div>
                        <div class="progress-container" aria-label="Перемотка трека">
                            <div class="progress-bar"></div>
                        </div>
                    </div>
                    <div class="volume-section">
                        <button class="control-btn mute-btn" aria-label="Отключить звук" type="button">
                            <svg class="volume-icon" width="20" height="20" viewBox="0 0 24 24">
                                <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
                            </svg>
                            <svg class="muted-icon" width="20" height="20" viewBox="0 0 24 24" style="display: none;">
                                <path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>
                            </svg>
                        </button>
                        <div class="volume-slider-container" aria-label="Регулировка громкости">
                            <div class="volume-slider"></div>
                        </div>
                    </div>
                </div>
                <div class="player-status" style="display: none;">Загрузка...</div>
            </div>
        `;

    this.audioPlayers.set(audioPath, audio);

    container.appendChild(playerContainer);
    return container;
  }

  stopAllCurrentPlayers() {
    console.log("MediaInjector: Stopping all current audio players.");
    for (const [path, audio] of this.audioPlayers.entries()) {
      if (!audio.paused) {
        audio.pause();
        audio.currentTime = 0;
        console.log(`MediaInjector: Paused audio for path: ${path}`);
      }
    }
  }

  reinitializeAudioPlayersInContainer(containerElement) {
    if (!containerElement) {
      console.warn(
        "MediaInjector: Container element for reinitializing audio players is null or undefined.",
      );
      return;
    }

    const playerContainers = containerElement.querySelectorAll(
      ".audio-player-container",
    );

    playerContainers.forEach((playerContainer) => {
      const customPlayer = playerContainer.querySelector(
        ".custom-audio-player",
      );
      const audioPath = customPlayer
        ? customPlayer.getAttribute("data-audio-path")
        : null;

      if (!audioPath) {
        console.warn(
          "MediaInjector: Could not find audio path on player container.",
          customPlayer,
        );
        return;
      }

      const audio = this.audioPlayers.get(audioPath);
      if (!audio) {
        console.warn(
          `MediaInjector: Audio object for path '${audioPath}' not found in map.`,
        );
        return;
      }

      const playBtn = customPlayer.querySelector(".play-btn");
      const playIcon = customPlayer.querySelector(".play-icon");
      const pauseIcon = customPlayer.querySelector(".pause-icon");
      const muteBtn = customPlayer.querySelector(".mute-btn");
      const volumeIcon = customPlayer.querySelector(".volume-icon");
      const mutedIcon = customPlayer.querySelector(".muted-icon");
      const progressContainer = customPlayer.querySelector(
        ".progress-container",
      );
      const progressBar = customPlayer.querySelector(".progress-bar");
      const timeDisplay = customPlayer.querySelector(".time-display");
      const volumeSliderContainer = customPlayer.querySelector(
        ".volume-slider-container",
      );
      const volumeSlider = customPlayer.querySelector(".volume-slider");
      const statusDiv = customPlayer.querySelector(".player-status");

      if (
        !playBtn ||
        !progressContainer ||
        !muteBtn ||
        !volumeSliderContainer
      ) {
        console.error(
          "MediaInjector: Critical control elements not found in player DOM structure.",
          customPlayer,
        );
        return;
      }

      let isPlaying = false;
      let isMuted = audio.muted;
      let volume = audio.volume;

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
        if (volumeIcon && mutedIcon) {
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

      playBtn.onclick = null;
      progressContainer.onclick = null;
      muteBtn.onclick = null;
      volumeSliderContainer.onclick = null;

      audio.removeEventListener("loadedmetadata", updateProgress);
      audio.removeEventListener("timeupdate", updateProgress);
      audio.removeEventListener("ended", () => {
        isPlaying = false;
        updateButtonStates();
        audio.currentTime = 0;
        updateProgress();
      });
      audio.removeEventListener("play", () => {
        isPlaying = true;
        updateButtonStates();
      });
      audio.removeEventListener("pause", () => {
        isPlaying = false;
        updateButtonStates();
      });
      audio.removeEventListener("error", (e) => {
        console.error("MediaInjector: Audio error:", audio.error);
        showStatus("Ошибка загрузки", "#f44336", 5000);
      });

      audio.addEventListener("loadedmetadata", () => {
        console.log(
          `✅ MediaInjector: Audio metadata loaded for ${audioPath}: ${formatTime(audio.duration)}`,
        );
        updateProgress();
        hideStatus();
        showStatus("Готово", "#43a047", 1500);
      });

      audio.addEventListener("canplay", () => {
        console.log(`🎵 MediaInjector: Audio can play for ${audioPath}`);
        hideStatus();
      });

      audio.addEventListener("timeupdate", updateProgress);

      audio.addEventListener("ended", () => {
        console.log(`⏹️ MediaInjector: Audio ended for ${audioPath}`);
        isPlaying = false;
        updateButtonStates();
        audio.currentTime = 0;
        updateProgress();
      });

      audio.addEventListener("play", () => {
        console.log(`▶️ MediaInjector: Audio play event for ${audioPath}`);
        isPlaying = true;
        updateButtonStates();
      });

      audio.addEventListener("pause", () => {
        console.log(`⏸️ MediaInjector: Audio pause event for ${audioPath}`);
        isPlaying = false;
        updateButtonStates();
      });

      audio.addEventListener("error", (e) => {
        console.error(
          "❌ MediaInjector: Audio error:",
          audio.error,
          "for",
          audioPath,
        );
        showStatus("Ошибка загрузки", "#f44336", 5000);
      });

      playBtn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        console.log("🎵 MediaInjector: Play button clicked for", audioPath);

        if (isPlaying) {
          audio.pause();
        } else {
          audio.play().catch((err) => {
            console.error("MediaInjector: Play error for", audioPath, err);
            if (err.name === "NotAllowedError") {
              showStatus("Нажмите на страницу для разрешения", "#ff9800", 3000);
            }
          });
        }
      });

      progressContainer.onclick = (e) => {
        if (!audio.duration || isNaN(audio.duration)) return;
        const rect = progressContainer.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audio.currentTime = percent * audio.duration;
        updateProgress();
      };

      muteBtn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        isMuted = !isMuted;
        audio.muted = isMuted;
        updateButtonStates();
      };

      volumeSliderContainer.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        const rect = volumeSliderContainer.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        volume = Math.max(0, Math.min(1, percent));
        audio.volume = volume;
        audio.muted = false;
        isMuted = false;
        volumeSlider.style.width = `${volume * 100}%`;
        updateButtonStates();
      };

      audio.volume = volume;
      audio.muted = isMuted;
      volumeSlider.style.width = `${volume * 100}%`;
      updateButtonStates();
      updateProgress();

      if (audio.readyState === 0) {
        audio.load();
      } else {
        updateProgress();
        hideStatus();
      }

      console.log(
        `🔄 MediaInjector: Reinitialized audio player for ${audioPath}`,
      );

      if (window.readingApp && window.readingApp.themeManager) {
        window.readingApp.themeManager.updateAudioPlayerIconsForElement(
          customPlayer,
        );
      } else {
        console.warn(
          "MediaInjector: ThemeManager not available during reinitialization for",
          audioPath,
        );
      }
    });
  }

  updateIconsForPlayerElement(playerElement) {
    if (!playerElement) return;
    const themeManager = window.readingApp
      ? window.readingApp.themeManager
      : null;
    if (!themeManager) {
      console.warn(
        "MediaInjector: Cannot update icons, ThemeManager not found in global scope.",
      );
      return;
    }
    themeManager.updateAudioPlayerIconsForElement(playerElement);
  }

  createCaption(text) {
    const caption = document.createElement("div");
    caption.className = "media-caption";
    caption.textContent = text;
    return caption;
  }
}