// js/hint-injector.js

import Utils from "./utils.js";

class HintInjector {
  constructor() {
    this.hints = [];
    this.configPath = "./config/hint-rules.json";
  }

  async init() {
    await this.loadHints();
    console.log(`✅ HintInjector initialized with ${this.hints.length} hints`);
  }

  async loadHints() {
    try {
      const config = await Utils.loadJSON(this.configPath);
      if (config && Array.isArray(config.hints)) {
        this.hints = config.hints;
        console.log(`📦 Loaded ${this.hints.length} hint rules`);
      }
    } catch (error) {
      console.warn("Error loading hints:", error);
    }
  }

  async injectHints(html, chapterNumber) {
    console.log(
      `🎯 injectHints called for chapter ${chapterNumber}, found ${this.hints.length} total hints`,
    );

    const chapterHints = this.hints.filter(
      (hint) => hint.chapter === chapterNumber,
    );
    console.log(
      `📋 Found ${chapterHints.length} hints for chapter ${chapterNumber}:`,
      chapterHints,
    );

    if (chapterHints.length === 0) {
      return html;
    }

    const parser = new DOMParser();
    const doc = parser.parseFromString(html, "text/html");

    for (const hintRule of chapterHints) {
      console.log(`🔧 Applying hint:`, hintRule);
      await this.applyHint(doc, hintRule);
    }

    const result = doc.body.innerHTML;
    console.log(`✅ Hints injected, returning modified HTML`);
    return result;
  }

  applyHint(doc, hintRule) {
    const paragraphs = doc.querySelectorAll("p");

    for (const p of paragraphs) {
      const originalText = p.textContent;

      if (originalText.includes(hintRule.text)) {
        console.log(
          `✅ Found text to replace: "${hintRule.text}" in paragraph: "${originalText.substring(0, 50)}..."`,
        );

        // Создаём временный div для безопасной обработки
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = p.innerHTML;

        // Заменяем текст с сохранением остальной разметки
        const fullText = tempDiv.textContent;
        const regex = new RegExp(Utils.escapeRegex(hintRule.text), "g");

        // Заменяем только текстовое содержимое, сохраняя разметку
        const newHTML = this.replaceTextWithHint(
          fullText,
          hintRule.text,
          hintRule.hint,
          tempDiv.innerHTML,
        );
        p.innerHTML = newHTML;

        console.log(`✅ Text wrapped with hint: ${hintRule.text}`);
      }
    }
  }

  replaceTextWithHint(fullText, searchText, hintText, originalHTML) {
    // Простая замена в HTML с учётом разметки
    const regex = new RegExp(Utils.escapeRegex(searchText), "g");

    // Экранируем кавычки в hintText для безопасности
    const safeHintText = this.escapeHtml(hintText);

    return originalHTML.replace(
      regex,
      `<u data-hint="${safeHintText}">${searchText}</u>`,
    );
  }

  escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  setupHintTooltips() {
    // Удаляем старые обработчики
    document.querySelectorAll("u[data-hint]").forEach((u) => {
      u.removeEventListener("mouseenter", this.handleHintMouseEnter);
    });

    // Назначаем новые
    document.querySelectorAll("u[data-hint]").forEach((u) => {
      u.addEventListener("mouseenter", (e) => this.handleHintMouseEnter(e));
    });
  }

  handleHintMouseEnter(event) {
    const u = event.currentTarget;
    const hint = u.getAttribute("data-hint");
    const tooltip = u.nextElementSibling?.classList.contains("hint-tooltip")
      ? u.nextElementSibling
      : null;

    if (!tooltip) {
      const tooltipEl = document.createElement("div");
      tooltipEl.className = "hint-tooltip";
      tooltipEl.textContent = hint;

      // Применяем стили для измерения
      Object.assign(tooltipEl.style, {
        position: "absolute",
        visibility: "hidden",
        pointerEvents: "none",
        zIndex: "-1",
        whiteSpace: "nowrap",
        padding: "0.25rem 0.5rem",
        fontSize: "0.8rem",
        fontFamily: getComputedStyle(u).fontFamily,
        fontWeight: getComputedStyle(u).fontWeight,
      });

      document.body.appendChild(tooltipEl);

      const width = tooltipEl.offsetWidth;
      const maxWidth = window.innerWidth <= 768 ? window.innerWidth * 0.6 : 500;

      if (width > maxWidth) {
        tooltipEl.style.whiteSpace = "normal";
        tooltipEl.style.maxWidth = window.innerWidth <= 768 ? "60%" : "500px";
      } else {
        tooltipEl.style.maxWidth = "none";
      }

      tooltipEl.style.visibility = "visible";
      tooltipEl.style.zIndex = "1000";
      tooltipEl.style.position = "absolute";
      tooltipEl.style.background =
        getComputedStyle(u).getPropertyValue("--sidebar-bg");
      tooltipEl.style.color =
        getComputedStyle(u).getPropertyValue("--sidebar-text");
      tooltipEl.style.borderRadius = "0.25rem";
      tooltipEl.style.boxShadow =
        getComputedStyle(u).getPropertyValue("--shadow");
      tooltipEl.style.border =
        "1px solid " + getComputedStyle(u).getPropertyValue("--border-color");

      const rect = u.getBoundingClientRect();
      tooltipEl.style.top = rect.top + window.scrollY - 10 + "px";
      tooltipEl.style.left = rect.left + rect.width / 2 + window.scrollX + "px";
      tooltipEl.style.transform = "translate(-50%, -100%)";

      // Добавляем класс для стилей
      tooltipEl.classList.add("dynamic-hint-tooltip");

      // Удаляем при mouseleave
      u.addEventListener(
        "mouseleave",
        () => {
          if (tooltipEl.parentNode) tooltipEl.remove();
        },
        { once: true },
      );
    }
  }
}

export default HintInjector;
