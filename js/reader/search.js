import { debounce } from "../core/utils.js";

export class SearchManager {
  constructor({ input, status, prevButton, nextButton, clearButton, scrollContainer, content }) {
    this.input = input;
    this.status = status;
    this.prevButton = prevButton;
    this.nextButton = nextButton;
    this.clearButton = clearButton;
    this.scrollContainer = scrollContainer;
    this.content = content;
    this.matches = [];
    this.currentIndex = -1;
    this.search = debounce(() => this.run(), 250);
    this.bind();
  }

  bind() {
    this.input.addEventListener("input", () => {
      this.updateClearButton();
      this.search();
    });
    this.input.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        event.shiftKey ? this.previous() : this.next();
      }
      if (event.key === "Escape") {
        this.clear();
        this.input.blur();
      }
    });
    this.prevButton.addEventListener("click", () => this.previous());
    this.nextButton.addEventListener("click", () => this.next());
    this.clearButton?.addEventListener("click", () => {
      this.clear();
      this.input.focus();
    });
    this.updateClearButton();
  }

  run() {
    const query = this.input.value.trim();
    this.removeHighlights();
    if (!query) {
      this.setStatus("");
      return;
    }
    const lower = query.toLowerCase();
    const walker = document.createTreeWalker(this.content, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => {
        const parent = node.parentElement;
        if (!parent || parent.closest(".media-container, .audio-player-container, .search-highlight")) return NodeFilter.FILTER_REJECT;
        return node.nodeValue.toLowerCase().includes(lower) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    for (const node of nodes) this.highlightNode(node, query);
    this.currentIndex = this.matches.length ? 0 : -1;
    this.updateCurrent();
    this.setStatus(this.matches.length ? `1/${this.matches.length}` : "Не найдено");
  }

  highlightNode(node, query) {
    const text = node.nodeValue;
    const lower = text.toLowerCase();
    const needle = query.toLowerCase();
    const fragment = document.createDocumentFragment();
    let cursor = 0;
    let index = lower.indexOf(needle, cursor);
    while (index !== -1) {
      if (index > cursor) fragment.append(document.createTextNode(text.slice(cursor, index)));
      const span = document.createElement("span");
      span.className = "search-highlight";
      span.textContent = text.slice(index, index + query.length);
      fragment.append(span);
      this.matches.push(span);
      cursor = index + query.length;
      index = lower.indexOf(needle, cursor);
    }
    if (cursor < text.length) fragment.append(document.createTextNode(text.slice(cursor)));
    node.replaceWith(fragment);
  }

  removeHighlights() {
    this.matches.forEach((span) => span.replaceWith(document.createTextNode(span.textContent)));
    this.content.normalize();
    this.matches = [];
    this.currentIndex = -1;
  }

  clear() {
    this.input.value = "";
    this.removeHighlights();
    this.setStatus("");
    this.updateClearButton();
  }

  next() {
    if (!this.matches.length) return;
    this.currentIndex = (this.currentIndex + 1) % this.matches.length;
    this.updateCurrent();
  }

  previous() {
    if (!this.matches.length) return;
    this.currentIndex = (this.currentIndex - 1 + this.matches.length) % this.matches.length;
    this.updateCurrent();
  }

  updateCurrent() {
    this.matches.forEach((span, index) => {
      span.classList.toggle("search-current-highlight", index === this.currentIndex);
    });
    if (this.currentIndex >= 0) {
      this.matches[this.currentIndex].scrollIntoView({ block: "center", behavior: "smooth" });
      this.setStatus(`${this.currentIndex + 1}/${this.matches.length}`);
    }
  }

  setStatus(value) {
    this.status.textContent = value;
  }

  updateClearButton() {
    if (!this.clearButton) return;
    this.clearButton.hidden = !this.input.value;
  }
}
