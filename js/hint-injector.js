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

        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = p.innerHTML;

        const fullText = tempDiv.textContent;
        const regex = new RegExp(Utils.escapeRegex(hintRule.text), "g");

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
    const regex = new RegExp(Utils.escapeRegex(searchText), "g");

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
    document.querySelectorAll("u[data-hint]").forEach((u) => {
      u.removeEventListener("mouseenter", this.handleHintMouseEnter);
    });

    document.querySelectorAll("u[data-hint]").forEach((u) => {
      u.addEventListener("mouseenter", (e) => this.handleHintMouseEnter(e));
    });
  }

  handleHintMouseEnter(event) {
    const u = event.currentTarget;
    const hint = u.getAttribute("data-hint");
    const rect = u.getBoundingClientRect();

    const tempTooltip = document.createElement("div");
    tempTooltip.textContent = hint;
    const maxWidth = window.innerWidth <= 768 ? window.innerWidth * 0.6 : 500;

    Object.assign(tempTooltip.style, {
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

    document.body.appendChild(tempTooltip);
    const singleLineWidth = tempTooltip.offsetWidth;
    tempTooltip.remove();

    const tooltipEl = document.createElement("div");
    tooltipEl.className = "dynamic-hint-tooltip";
    tooltipEl.textContent = hint;

    const isSingleLine = singleLineWidth <= maxWidth;
    const widthForStyling = isSingleLine ? "fit-content" : maxWidth + "px";

    Object.assign(tooltipEl.style, {
      position: "absolute",
      top: rect.top + window.scrollY - 10 + "px",
      zIndex: "1000",
      background: getComputedStyle(u).getPropertyValue("--sidebar-bg"),
      color: getComputedStyle(u).getPropertyValue("--sidebar-text"),
      padding: "0.25rem 0.5rem",
      borderRadius: "0.25rem",
      fontSize: "0.8rem",
      fontFamily: getComputedStyle(u).fontFamily,
      fontWeight: getComputedStyle(u).fontWeight,
      boxShadow: getComputedStyle(u).getPropertyValue("--shadow"),
      border:
        "1px solid " + getComputedStyle(u).getPropertyValue("--border-color"),
      maxWidth: maxWidth + "px",
      whiteSpace: isSingleLine ? "nowrap" : "normal",
      wordWrap: isSingleLine ? "normal" : "break-word",
      textAlign: "center",
      pointerEvents: "none",
      width: widthForStyling,
    });

    document.body.appendChild(tooltipEl);

    const tooltipWidth = tooltipEl.offsetWidth;
    const targetCenterX = rect.left + rect.width / 2 + window.scrollX;

    let finalLeft = targetCenterX - tooltipWidth / 2;

    if (finalLeft < 10) {
      finalLeft = 10;
    } else if (finalLeft + tooltipWidth > window.innerWidth - 10) {
      finalLeft = window.innerWidth - 10 - tooltipWidth;
    }

    tooltipEl.style.left = finalLeft + "px";
    tooltipEl.style.transform = "translateY(-100%)";

    u.addEventListener(
      "mouseleave",
      () => {
        if (tooltipEl.parentNode) tooltipEl.remove();
      },
      { once: true },
    );
  }
}

export default HintInjector;
