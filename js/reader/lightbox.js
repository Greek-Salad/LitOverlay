// Полноэкранный просмотр картинок главы: клик по изображению затемняет
// вьюпорт и показывает картинку крупно (вписана в экран, пропорции сохранены).
// Закрытие: клик вне картинки или Escape.

export class ImageLightbox {
  constructor() {
    this.overlay = null;
    this.lastFocus = null;
    this.boundKeydown = (event) => this.handleKeydown(event);
  }

  attach(container) {
    container.addEventListener("click", (event) => {
      const img = event.target instanceof Element ? event.target.closest("img") : null;
      if (!img || !container.contains(img)) return;
      if (!img.naturalWidth) return;   // битая/не загруженная — нечего увеличивать
      event.preventDefault();
      this.open(img);
    });
  }

  open(sourceImg) {
    this.close(true);
    this.lastFocus = document.activeElement;
    const overlay = document.createElement("div");
    overlay.className = "image-lightbox";
    overlay.setAttribute("role", "dialog");
    overlay.setAttribute("aria-modal", "true");
    overlay.setAttribute("aria-label", sourceImg.alt || "Просмотр изображения");
    overlay.tabIndex = -1;
    const img = document.createElement("img");
    img.className = "image-lightbox-img";
    img.src = sourceImg.currentSrc || sourceImg.src;
    img.alt = sourceImg.alt || "";
    overlay.append(img);
    overlay.addEventListener("click", (event) => {
      if (event.target !== img) this.close();
    });
    // Затенение перекрывает весь экран — не даём фону прокручиваться под ним.
    overlay.addEventListener("wheel", (event) => event.preventDefault(), { passive: false });
    overlay.addEventListener("touchmove", (event) => event.preventDefault(), { passive: false });
    document.addEventListener("keydown", this.boundKeydown, true);
    document.body.append(overlay);
    this.overlay = overlay;
    requestAnimationFrame(() => overlay.classList.add("visible"));
    overlay.focus({ preventScroll: true });
  }

  handleKeydown(event) {
    if (!this.overlay) return;
    if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      this.close();
      return;
    }
    // Пока открыт просмотр, глушим глобальные хоткеи плеера (Space/M),
    // чтобы под затенением внезапно не запускалась музыка.
    if (event.code === "Space" || event.code === "KeyM") {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  close(immediate = false) {
    const overlay = this.overlay;
    if (!overlay) return;
    this.overlay = null;
    document.removeEventListener("keydown", this.boundKeydown, true);
    const finish = () => overlay.remove();
    if (immediate) {
      finish();
    } else {
      overlay.classList.remove("visible");
      overlay.addEventListener("transitionend", finish, { once: true });
      window.setTimeout(finish, 300);   // страховка, если transition не случится
    }
    if (this.lastFocus instanceof HTMLElement && this.lastFocus.isConnected) {
      this.lastFocus.focus({ preventScroll: true });
    }
    this.lastFocus = null;
  }
}
