import assert from "node:assert/strict";

const endpoint = process.env.CDP_ENDPOINT || "http://127.0.0.1:9222/json";
const baseUrl = process.env.BROWSER_TEST_BASE_URL || "http://127.0.0.1:8000";
const pages = await fetch(endpoint).then((response) => response.json());
const page = pages.find((item) => item.type === "page");
assert.ok(page, "No Chrome page target found");

let nextId = 1;
const pending = new Map();
const socket = new WebSocket(page.webSocketDebuggerUrl);

socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (!message.id || !pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  if (message.error) reject(new Error(message.error.message));
  else resolve(message.result);
});

await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

function send(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.text || "Runtime.evaluate failed");
  }
  return result.result.value;
}

async function waitFor(expression, timeout = 12000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

await send("Runtime.enable");
await send("Page.enable");
await send("Network.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false
});
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    (() => {
      const scenario = new URL(location.href).searchParams.get("__storageTest");
      if (!scenario) return;
      localStorage.clear();
      localStorage.setItem("ageGateConfirmed", JSON.stringify(true));
      localStorage.setItem("ageGateConfirmedTimestamp", JSON.stringify(Date.now()));
      localStorage.setItem("litoverlay:v2:readState", JSON.stringify({ completed: {}, highlights: {} }));
      if (scenario === "resume") {
        localStorage.setItem("themePreset", JSON.stringify("custom"));
        localStorage.setItem("themeColors", JSON.stringify({ bg: "#102030", text: "#f0e0d0" }));
        localStorage.setItem("readerSettings", JSON.stringify({
          fontFamily: "Whitney",
          fontSize: 21,
          textWidth: 900,
          lineHeight: 1.8,
          lastChapter: 16,
          experimental: "keep"
        }));
        localStorage.setItem("readingProgress", JSON.stringify({
          mondschein: { chapter: 15, scrollPercent: 33, timestamp: Date.now() - 60000 }
        }));
      }
      if (scenario === "legacy") {
        localStorage.setItem("themePreset", JSON.stringify("dark"));
        localStorage.setItem("themeColors", JSON.stringify({ bg: "#202124", text: "#e8eaed" }));
        localStorage.setItem("readerSettings", JSON.stringify({ lastChapter: 16 }));
        localStorage.setItem("readingProgress", JSON.stringify({}));
      }
      if (scenario === "default-last") {
        localStorage.setItem("themePreset", JSON.stringify("dark"));
        localStorage.setItem("themeColors", JSON.stringify({ bg: "#202124", text: "#e8eaed" }));
        localStorage.setItem("readerSettings", JSON.stringify({ lastChapter: 1 }));
        localStorage.setItem("readingProgress", JSON.stringify({}));
      }
    })();
  `
});

await send("Page.navigate", { url: `${baseUrl}/book.html?id=mondschein&__storageTest=resume` });
await waitFor("document.readyState === 'complete'");
await waitFor("Boolean(document.querySelector('[data-resume]'))");
const beforeResume = await evaluate(`(() => {
  const root = document.documentElement;
  const rootStyle = getComputedStyle(root);
  return {
    hasAgeGate: Boolean(document.querySelector('.age-gate-card')),
    hasResume: Boolean(document.querySelector('[data-resume]')),
    dataTheme: root.getAttribute('data-theme'),
    bg: rootStyle.getPropertyValue('--bg-color').trim(),
    text: rootStyle.getPropertyValue('--text-color').trim(),
    fontSize: rootStyle.fontSize,
    fontFamilyVar: rootStyle.getPropertyValue('--font-family').trim(),
    textWidth: rootStyle.getPropertyValue('--text-width').trim(),
    lineHeight: rootStyle.getPropertyValue('--line-height').trim(),
    fontSelect: document.querySelector('[data-font-family]')?.value || ''
  };
})()`);
assert.equal(beforeResume.hasAgeGate, false, `Expected legacy age gate confirmation to be accepted: ${JSON.stringify(beforeResume)}`);
assert.equal(beforeResume.hasResume, true, `Expected legacy readingProgress to show resume modal: ${JSON.stringify(beforeResume)}`);
assert.equal(beforeResume.dataTheme, "custom", `Expected legacy custom preset: ${JSON.stringify(beforeResume)}`);
assert.equal(beforeResume.bg, "#102030", `Expected legacy custom background: ${JSON.stringify(beforeResume)}`);
assert.equal(beforeResume.text, "#f0e0d0", `Expected legacy custom text color: ${JSON.stringify(beforeResume)}`);
assert.equal(beforeResume.fontSize, "21px", `Expected legacy font size: ${JSON.stringify(beforeResume)}`);
assert.match(beforeResume.fontFamilyVar, /Whitney/, `Expected legacy font family: ${JSON.stringify(beforeResume)}`);
assert.equal(beforeResume.textWidth, "900px", `Expected legacy text width: ${JSON.stringify(beforeResume)}`);
assert.equal(beforeResume.lineHeight, "1.8", `Expected legacy line height: ${JSON.stringify(beforeResume)}`);
assert.equal(beforeResume.fontSelect, "Whitney", `Expected settings select to reflect legacy font: ${JSON.stringify(beforeResume)}`);

await evaluate("document.querySelector('[data-resume]').click()");
await waitFor("document.querySelector('[data-chapter-content] h2')?.textContent.includes('Глава 15')");
const afterResume = await evaluate(`(() => {
  const progress = JSON.parse(localStorage.getItem('readingProgress'));
  const settings = JSON.parse(localStorage.getItem('readerSettings'));
  return {
    currentChapter: document.querySelector('lo-reader-app')?.currentChapter,
    heading: document.querySelector('[data-chapter-content] h2')?.textContent || '',
    progressChapter: progress.mondschein?.chapter,
    progressPercent: progress.mondschein?.scrollPercent,
    preservedSetting: settings.experimental
  };
})()`);
assert.equal(afterResume.currentChapter, 15, `Expected resume to open saved chapter: ${JSON.stringify(afterResume)}`);
assert.equal(afterResume.progressChapter, 15, `Expected progress to stay on resumed chapter: ${JSON.stringify(afterResume)}`);
assert.equal(afterResume.preservedSetting, "keep", `Expected unknown readerSettings field to survive untouched: ${JSON.stringify(afterResume)}`);
const sidebarStart = Date.now();
await evaluate("document.querySelector('[data-menu-toggle]').click()");
await waitFor("document.querySelectorAll('.chapter-item').length >= 34", 2500);
const resumeSidebar = await evaluate(`({
  elapsedMs: ${Date.now()} - ${sidebarStart},
  chapters: document.querySelectorAll('.chapter-item').length,
  activeChapter: document.querySelector('.chapter-item.active')?.dataset.chapter || ''
})`);
assert.ok(resumeSidebar.chapters >= 34, `Expected resumed reader sidebar to resolve full TOC quickly: ${JSON.stringify(resumeSidebar)}`);
assert.equal(resumeSidebar.activeChapter, "15", `Expected resumed chapter to stay active in full TOC: ${JSON.stringify(resumeSidebar)}`);

await send("Page.navigate", { url: `${baseUrl}/book.html?id=mondschein&__storageTest=legacy` });
await waitFor("document.readyState === 'complete'");
await waitFor("document.querySelector('[data-chapter-content] h2')?.textContent.includes('Глава 16')");
const legacyLast = await evaluate(`(() => {
  const progress = JSON.parse(localStorage.getItem('readingProgress'));
  return {
    currentChapter: document.querySelector('lo-reader-app')?.currentChapter,
    heading: document.querySelector('[data-chapter-content] h2')?.textContent || '',
    hasResume: Boolean(document.querySelector('[data-resume]')),
    progressChapter: progress.mondschein?.chapter
  };
})()`);
assert.equal(legacyLast.currentChapter, 16, `Expected non-default lastChapter fallback: ${JSON.stringify(legacyLast)}`);
assert.equal(legacyLast.hasResume, false, `Expected lastChapter fallback without resume prompt: ${JSON.stringify(legacyLast)}`);
assert.equal(legacyLast.progressChapter, 16, `Expected fallback chapter to migrate into readingProgress: ${JSON.stringify(legacyLast)}`);

await send("Page.navigate", { url: `${baseUrl}/book.html?id=mondschein&__storageTest=default-last` });
await waitFor("document.readyState === 'complete'");
await waitFor("document.querySelector('lo-reader-app')?.currentChapter === 0");
const defaultLast = await evaluate(`({
  currentChapter: document.querySelector('lo-reader-app')?.currentChapter,
  heading: document.querySelector('[data-chapter-content] h2')?.textContent || '',
  hasResume: Boolean(document.querySelector('[data-resume]'))
})`);
assert.equal(defaultLast.currentChapter, 0, `Expected default lastChapter=1 not to skip preface: ${JSON.stringify(defaultLast)}`);
assert.equal(defaultLast.hasResume, false, `Expected no resume prompt for default lastChapter fallback: ${JSON.stringify(defaultLast)}`);

socket.close();

console.log("Browser storage migration passed.", { beforeResume, afterResume, resumeSidebar, legacyLast, defaultLast });
