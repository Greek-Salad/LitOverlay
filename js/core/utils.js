export const $ = (selector, root = document) => root.querySelector(selector);
export const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

export function clamp(value, min, max) {
  const number = Number(value);
  if (!Number.isFinite(number)) return min;
  return Math.min(max, Math.max(min, number));
}

export function debounce(fn, delay) {
  let timer = 0;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}

export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function normalizeSpaces(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

export function formatDate(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat("ru-RU").format(date);
}

export function formatTimeAgo(timestamp) {
  const value = Number(timestamp);
  if (!Number.isFinite(value) || value <= 0) return "";
  const diff = Date.now() - value;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;
  if (diff < minute) return "только что";
  if (diff < hour) return `${Math.floor(diff / minute)} мин. назад`;
  if (diff < day) return `${Math.floor(diff / hour)} ч. назад`;
  return `${Math.floor(diff / day)} дн. назад`;
}

export function formatDuration(seconds) {
  const safe = Math.max(0, Math.floor(Number(seconds) || 0));
  const minutes = Math.floor(safe / 60);
  const rest = String(safe % 60).padStart(2, "0");
  return `${minutes}:${rest}`;
}

export function parseChapterNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const number = Number.parseInt(String(value), 10);
  return Number.isFinite(number) ? number : null;
}

export function chapterCandidates(number) {
  const normalized = Number(number);
  if (!Number.isInteger(normalized) || normalized < 0) return [];
  const text = String(normalized);
  return [
    `${text}.html`,
    `${text.padStart(2, "0")}.html`,
    `${text.padStart(3, "0")}.html`,
    `${text.padStart(4, "0")}.html`
  ].filter((candidate, index, all) => all.indexOf(candidate) === index);
}

export function bookUrl(bookId, chapter = null, options = {}) {
  const params = new URLSearchParams();
  params.set("id", bookId);
  if (chapter !== null && chapter !== undefined) params.set("chapter", String(chapter));
  if (options.scrollPercent !== undefined) params.set("scroll", String(options.scrollPercent));
  if (options.start) params.set("start", "1");
  return `./book.html?${params.toString()}`;
}

export function copyText(value) {
  if (navigator.clipboard?.writeText) return navigator.clipboard.writeText(value);
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
  return Promise.resolve();
}

export function getBookIdFromLocation(location = window.location) {
  const params = new URLSearchParams(location.search);
  const fromQuery = params.get("id");
  if (fromQuery) return fromQuery;
  const parts = location.pathname.split("/").filter(Boolean);
  const bookIndex = parts.lastIndexOf("book");
  if (bookIndex >= 0 && parts[bookIndex + 1]) return parts[bookIndex + 1];
  return null;
}

export function createElement(tag, attrs = {}, children = []) {
  const element = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === false || value === null || value === undefined) continue;
    if (key === "class") element.className = value;
    else if (key === "dataset") Object.assign(element.dataset, value);
    else if (key.startsWith("on") && typeof value === "function") element.addEventListener(key.slice(2), value);
    else if (value === true) element.setAttribute(key, "");
    else element.setAttribute(key, String(value));
  }
  for (const child of Array.isArray(children) ? children : [children]) {
    if (child === null || child === undefined) continue;
    element.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return element;
}

export function sanitizeTrustedHtml(html) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(String(html ?? ""), "text/html");
  doc.querySelectorAll("script, object, embed").forEach((node) => node.remove());
  doc.querySelectorAll("iframe").forEach((node) => {
    node.removeAttribute("srcdoc");
    const src = (node.getAttribute("src") || "").trim();
    if (!/^https?:\/\//i.test(src)) node.remove();
  });
  doc.querySelectorAll("*").forEach((node) => {
    for (const attr of Array.from(node.attributes)) {
      const name = attr.name.toLowerCase();
      const value = attr.value.trim().toLowerCase();
      if (name.startsWith("on")) node.removeAttribute(attr.name);
      if ((name === "href" || name === "src") && value.startsWith("javascript:")) node.removeAttribute(attr.name);
    }
  });
  return doc.body.innerHTML;
}

export function rewriteChapterMediaPaths(container, bookId) {
  const mediaExtensions = /\.(mp3|png|jpe?g|gif|webp|avif|svg)$/i;
  for (const node of $$("[src], [href]", container)) {
    const attr = node.hasAttribute("src") ? "src" : "href";
    const raw = node.getAttribute(attr);
    if (!raw || /^(https?:)?\/\//i.test(raw) || raw.startsWith("data:") || raw.startsWith("#")) continue;
    if (!mediaExtensions.test(raw)) continue;
    const cleaned = raw.replace(/^\.?\//, "").replace(/^media\//, "");
    node.setAttribute(attr, `./books/${bookId}/media/${cleaned}`);
  }
}

export async function fetchJson(url, fallback = null) {
  const response = await fetch(url);
  if (!response.ok) {
    if (fallback !== null && response.status === 404) return fallback;
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

export async function fetchText(url) {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to fetch ${url}: ${response.status}`);
  return response.text();
}

export async function urlExists(url) {
  try {
    const head = await fetch(url, { method: "HEAD" });
    if (head.ok) return true;
    if (![405, 501].includes(head.status)) return false;
  } catch (error) {
    // Some static servers do not like HEAD. Fall back to a normal fetch below.
  }
  // Network failure here must NOT read as "file does not exist": a suspended
  // mobile tab or sleeping radio would otherwise mark real chapters absent
  // until a full reload. Let the rejection propagate so callers can retry.
  const response = await fetch(url);
  return response.ok;
}

export function splitTrackTitle(title = "") {
  const parts = String(title).split(" — ");
  if (parts.length >= 2) {
    return { artist: parts[0], title: parts.slice(1).join(" — ") };
  }
  return { artist: "", title: String(title || "Аудиотрек") };
}

export function resolveMediaPath(bookId, src) {
  const value = String(src ?? "");
  if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:")) return value;
  if (value.startsWith("./") || value.startsWith("../")) return value;
  return `./books/${bookId}/media/${value.replace(/^media\//, "")}`;
}

export function lightOrDark(hex) {
  const rgb = parseHex(hex);
  if (!rgb) return "dark";
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness > 155 ? "light" : "dark";
}

export function parseHex(hex) {
  const raw = String(hex ?? "").trim();
  const short = /^#([0-9a-f]{3})$/i.exec(raw);
  if (short) {
    const [r, g, b] = short[1].split("").map((part) => Number.parseInt(part + part, 16));
    return { r, g, b };
  }
  const full = /^#([0-9a-f]{6})$/i.exec(raw);
  if (!full) return null;
  const value = full[1];
  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16)
  };
}

export function isValidHex(hex) {
  return Boolean(parseHex(hex));
}

export function adjustHex(hex, amount) {
  const rgb = parseHex(hex);
  if (!rgb) return hex;
  const adjustment = Math.round(Number(amount || 0) * 255);
  const channel = (value) => clamp(value + adjustment, 0, 255);
  return `#${[channel(rgb.r), channel(rgb.g), channel(rgb.b)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}

export function mix(hexA, hexB, ratio) {
  const a = parseHex(hexA);
  const b = parseHex(hexB);
  if (!a || !b) return hexA;
  const amount = clamp(ratio, 0, 1);
  const channel = (start, end) => Math.round(start + (end - start) * amount);
  return `#${[channel(a.r, b.r), channel(a.g, b.g), channel(a.b, b.b)]
    .map((value) => value.toString(16).padStart(2, "0"))
    .join("")}`;
}
