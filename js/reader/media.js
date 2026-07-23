import { normalizeSpaces, resolveMediaPath } from "../core/utils.js";

export class MediaInjector {
  constructor({ bookId, rules, audioController, reportWarning }) {
    this.bookId = bookId;
    this.rules = rules || [];
    this.audioController = audioController;
    this.reportWarning = reportWarning;
  }

  apply(chapterNumber, container) {
    const rules = this.rules.filter((rule) => Number(rule.chapter) === Number(chapterNumber));
    for (const rule of rules) {
      const target = this.findTarget(container, rule);
      if (!target) {
        this.reportWarning({
          type: "media",
          id: rule.id || rule.type,
          chapter: chapterNumber,
          anchor: rule.anchor
        });
        continue;
      }
      const node = rule.type === "audio" ? this.createAudio(rule) : this.createImages(rule, target, chapterNumber);
      if (!node) continue;
      this.insert(rule.position, target, node);
    }
  }

  findTarget(container, rule) {
    const elements = Array.from(container.querySelectorAll("p, blockquote"));
    const exact = elements.find((element) => element.textContent.includes(rule.anchor));
    if (exact) return exact;
    const normalizedAnchor = normalizeSpaces(rule.anchor);
    return elements.find((element) => normalizeSpaces(element.textContent).includes(normalizedAnchor));
  }

  createAudio(rule) {
    const track = this.audioController.register(rule);
    return this.audioController.createLauncher(track);
  }

  createImages(rule, target, chapterNumber) {
    const figure = document.createElement("figure");
    figure.className = "media-container media-figure";
    if (rule.width) figure.style.width = rule.width;
    for (const [index, src] of (rule.src || []).entries()) {
      const resolvedSrc = resolveMediaPath(this.bookId, src);
      const img = document.createElement("img");
      img.className = "media-image";
      img.src = resolvedSrc;
      img.alt = rule.alt || rule.caption || `Иллюстрация ${index + 1}`;
      img.loading = rule.position === "instead" ? "eager" : "lazy";
      if (rule.width) img.style.width = rule.width;
      if (rule.height) img.style.height = rule.height;
      img.addEventListener("error", () => {
        this.reportWarning({
          type: "media-file",
          id: `${rule.id || rule.type || "media"}:${index}`,
          chapter: chapterNumber,
          anchor: rule.anchor,
          src: resolvedSrc
        });
      }, { once: true });
      figure.append(img);
    }
    if (rule.caption) {
      const caption = document.createElement("figcaption");
      caption.className = "media-caption";
      caption.textContent = rule.caption;
      figure.append(caption);
    }
    if (rule.position === "instead") this.handleInstead(figure, target, rule, chapterNumber);
    return figure;
  }

  handleInstead(figure, target, rule, chapterNumber) {
    figure.hidden = true;
    target.dataset.mediaFallback = "true";
    const images = Array.from(figure.querySelectorAll("img"));
    if (!images.length) {
      target.remove();
      figure.hidden = false;
      return;
    }
    let settled = 0;
    let failed = false;
    const finish = () => {
      settled += 1;
      if (settled < images.length) return;
      window.clearTimeout(timer);
      if (failed) {
        figure.remove();
      } else {
        target.remove();
        figure.hidden = false;
      }
    };
    const timer = window.setTimeout(() => {
      failed = true;
      this.reportWarning({
        type: "media-timeout",
        id: rule.id || rule.type || "media",
        chapter: chapterNumber,
        anchor: rule.anchor,
        src: (rule.src || []).join(", ")
      });
      figure.remove();
    }, 10000);
    for (const img of images) {
      img.addEventListener("load", () => {
        finish();
      }, { once: true });
      img.addEventListener("error", () => {
        failed = true;
        finish();
      }, { once: true });
      if (img.complete) {
        // Cached image already settled: load/error fired before we subscribed.
        if (img.naturalWidth === 0) failed = true;
        finish();
      }
    }
  }

  insert(position, target, node) {
    if (position === "before" || position === "instead") {
      target.before(node);
    } else {
      target.after(node);
    }
  }
}
