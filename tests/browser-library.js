import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const endpoint = process.env.CDP_ENDPOINT || "http://127.0.0.1:9222/json";
const targetUrl = process.env.BROWSER_TEST_URL || "http://127.0.0.1:8000/index.html";
const cssText = readFileSync(new URL("../css/app.css", import.meta.url), "utf8");
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

async function waitFor(expression, timeout = 10000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (await evaluate(expression)) return;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`Timed out waiting for ${expression}`);
}

await send("Runtime.enable");
await send("Page.enable");
await send("DOM.enable");
await send("CSS.enable");
await send("Network.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    localStorage.setItem("readingProgress", JSON.stringify({
      mondschein: { chapter: 15, scrollPercent: 42, timestamp: Date.now() }
    }));
    localStorage.setItem("litoverlay:v2:readState", JSON.stringify({ completed: {}, highlights: {} }));
    localStorage.setItem("litoverlay:v2:library", JSON.stringify({ view: "list" }));
  `
});
await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false
});
await send("Page.navigate", { url: targetUrl });
await waitFor("document.readyState === 'complete'");
await waitFor("Boolean(document.querySelector('.book-card'))");

const before = await evaluate(`(() => {
  const cover = document.querySelector('.book-cover-link');
  const copy = document.querySelector('[data-copy-link]');
  const coverStyle = getComputedStyle(cover);
  const copyStyle = getComputedStyle(copy);
  return {
    cards: document.querySelectorAll('.book-card').length,
    metaItems: document.querySelectorAll('.book-meta-item').length,
    metaIcons: document.querySelectorAll('.book-meta-item svg').length,
    metaTexts: [...document.querySelectorAll('.book-meta-item')].map((node) => node.textContent.trim()),
    bookLinks: [...document.querySelectorAll('.book-title-link')].map((node) => node.getAttribute('href')),
    coverOpacity: coverStyle.opacity,
    coverTransitionProperty: coverStyle.transitionProperty,
    coverTransitionDuration: coverStyle.transitionDuration,
    copyBackground: copyStyle.backgroundColor,
    copyBorderColor: copyStyle.borderColor,
    copyColor: copyStyle.color
  };
})()`);

const documentNode = await send("DOM.getDocument");
const coverNode = await send("DOM.querySelector", {
  nodeId: documentNode.root.nodeId,
  selector: ".book-cover-link"
});
const copyNode = await send("DOM.querySelector", {
  nodeId: documentNode.root.nodeId,
  selector: "[data-copy-link]"
});
await send("CSS.forcePseudoState", { nodeId: coverNode.nodeId, forcedPseudoClasses: ["hover"] });
await send("CSS.forcePseudoState", { nodeId: copyNode.nodeId, forcedPseudoClasses: ["hover"] });

const hover = await evaluate(`(() => {
  const cover = document.querySelector('.book-cover-link');
  const copy = document.querySelector('[data-copy-link]');
  const coverStyle = getComputedStyle(cover);
  const copyStyle = getComputedStyle(copy);
  return {
    coverOpacity: coverStyle.opacity,
    copyBackground: copyStyle.backgroundColor,
    copyBorderColor: copyStyle.borderColor,
    copyColor: copyStyle.color
  };
})()`);

const cardUx = await evaluate(`(() => {
  const firstCard = document.querySelector('.book-card');
  const description = firstCard.querySelector('.book-description');
  const tags = firstCard.querySelector('.book-tags');
  const metaItems = [...document.querySelectorAll('.book-meta-item')];
  const themeIcon = document.querySelector('.library-actions.theme-switcher .theme-icon');
  const listDescriptionStyle = getComputedStyle(description);
  const listLineClamp = listDescriptionStyle.webkitLineClamp || 'none';
  const listDisplay = listDescriptionStyle.display;
  const tagsDisplayBeforeGrid = getComputedStyle(tags).display;
  document.querySelector('[data-view="grid"]').click();
  const gridCard = document.querySelector('.book-card');
  const gridDescriptionStyle = getComputedStyle(gridCard.querySelector('.book-description'));
  const gridTagsStyle = getComputedStyle(gridCard.querySelector('.book-tags'));
  return {
    chapterTexts: metaItems.map((node) => node.textContent.trim()).filter((text) => text.includes('глав')),
    metaTitles: metaItems.map((node) => node.getAttribute('title')).filter(Boolean),
    listLineClamp,
    listDisplay,
    gridDescriptionDisplay: gridDescriptionStyle.display,
    gridTagsDisplay: gridTagsStyle.display,
    gridCardHeight: Math.round(gridCard.getBoundingClientRect().height),
    themeIconWidth: getComputedStyle(themeIcon).width,
    tagsDisplayBeforeGrid
  };
})()`);

const controlUx = await evaluate(`(async () => {
  const controls = document.querySelector('.library-controls');
  const searchShell = document.querySelector('.search-shell');
  const input = document.querySelector('[data-library-search]');
  const segmented = document.querySelector('.segmented');
  const viewButton = segmented.querySelector('.icon-btn');
  const controlsStyle = getComputedStyle(controls);
  const searchStyle = getComputedStyle(searchShell);
  const segmentedStyle = getComputedStyle(segmented);
  input.focus();
  await new Promise((resolve) => requestAnimationFrame(resolve));
  const focusedSearchStyle = getComputedStyle(searchShell);
  return {
    controlsHeight: Math.round(controls.getBoundingClientRect().height),
    controlsJustifyContent: controlsStyle.justifyContent,
    controlsGridTemplateColumns: controlsStyle.gridTemplateColumns,
    searchWidth: Math.round(searchShell.getBoundingClientRect().width),
    searchOpacity: searchStyle.opacity,
    searchFocused: document.activeElement === input,
    searchFocusedBoxShadow: focusedSearchStyle.boxShadow,
    searchPlaceholder: input.getAttribute('placeholder'),
    segmentedBackground: segmentedStyle.backgroundColor,
    viewButtonWidth: Math.round(viewButton.getBoundingClientRect().width),
    viewButtonHeight: Math.round(viewButton.getBoundingClientRect().height)
  };
})()`);

const searchValue = await evaluate(`(() => {
  const input = document.querySelector('[data-library-search]');
  const clear = document.querySelector('[data-library-search-clear]');
  const beforeCount = document.querySelectorAll('.book-card').length;
  input.value = 'mondschein';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  const afterFilterCount = document.querySelectorAll('.book-card').length;
  const visibleAfterInput = !clear.hidden;
  const clearColor = getComputedStyle(clear).color;
  clear.click();
  return {
    inputType: input.type,
    beforeCount,
    afterFilterCount,
    visibleAfterInput,
    clearHiddenAfterClick: clear.hidden,
    valueAfterClick: input.value,
    countAfterClear: document.querySelectorAll('.book-card').length,
    clearColor
  };
})()`);

const continueValue = await evaluate(`(() => {
  const section = document.querySelector('[data-continue]');
  const clear = document.querySelector('[data-clear-progress]');
  if (!section || !clear) return { hasSection: Boolean(section), hasClear: Boolean(clear) };
  clear.click();
  const confirm = document.querySelector('.inline-confirm');
  const confirmLabels = [...confirm.querySelectorAll('button')].map((button) => button.textContent.trim());
  const confirmVisible = Boolean(confirm);
  confirm.querySelector('[data-cancel-clear]').click();
  const removedAfterCancel = !document.querySelector('.inline-confirm');
  clear.click();
  document.querySelector('[data-confirm-clear]').click();
  return {
    hasSection: true,
    hasClear: true,
    confirmVisible,
    confirmLabels,
    removedAfterCancel,
    hiddenAfterConfirm: section.hidden,
    clearStillExists: Boolean(document.querySelector('[data-clear-progress]'))
  };
})()`);

socket.close();

assert.ok(before.cards > 0, "Expected library cards");
assert.ok(before.bookLinks.includes("./book.html?id=hellfire"), `Expected hellfire card link to keep book id: ${JSON.stringify(before)}`);
assert.ok(before.bookLinks.includes("./book.html?id=train"), `Expected train card link to keep book id: ${JSON.stringify(before)}`);
assert.ok(before.bookLinks.includes("./book.html?id=mondschein"), `Expected mondschein card link to keep book id: ${JSON.stringify(before)}`);
assert.ok(before.bookLinks.includes("./book.html?id=digitalfever"), `Expected digitalfever card link to keep book id: ${JSON.stringify(before)}`);
assert.ok(before.metaItems >= before.cards * 3, `Expected metadata rows, got ${JSON.stringify(before)}`);
assert.equal(before.metaIcons, before.metaItems, `Expected every metadata item to have an icon: ${JSON.stringify(before)}`);
assert.ok(before.metaTexts.some((text) => /\d+ глав/.test(text) || /\d+ глава/.test(text) || /\d+ главы/.test(text)), `Expected chapter metadata: ${JSON.stringify(before)}`);
assert.ok(
  before.coverTransitionProperty.includes("opacity") || before.coverTransitionProperty === "all",
  `Expected cover hover transition on opacity: ${JSON.stringify(before)}`
);
assert.match(cssText, /\.book-cover-link:hover\s*{[^}]*opacity:\s*0\.65;/s, "Expected cover hover opacity rule");
assert.ok(cardUx.chapterTexts.some((text) => text.includes("глав")), `Expected full chapter word in metadata: ${JSON.stringify(cardUx)}`);
assert.ok(cardUx.metaTitles.includes("Дата публикации"), `Expected metadata publication date hint: ${JSON.stringify(cardUx)}`);
assert.ok(cardUx.metaTitles.includes("Количество глав"), `Expected metadata chapters hint: ${JSON.stringify(cardUx)}`);
assert.notEqual(cardUx.tagsDisplayBeforeGrid, "none", `Expected tags visible before grid: ${JSON.stringify(cardUx)}`);
assert.equal(cardUx.gridDescriptionDisplay, "none", `Expected grid descriptions hidden: ${JSON.stringify(cardUx)}`);
assert.equal(cardUx.gridTagsDisplay, "none", `Expected grid tags hidden: ${JSON.stringify(cardUx)}`);
assert.notEqual(cardUx.listDisplay, "-webkit-box", `Expected unclamped list description: ${JSON.stringify(cardUx)}`);
assert.equal(cardUx.listLineClamp, "none", `Expected no description line clamp: ${JSON.stringify(cardUx)}`);
assert.equal(cardUx.themeIconWidth, "24px", `Expected larger library theme icon: ${JSON.stringify(cardUx)}`);
assert.ok(controlUx.searchWidth <= 360, `Expected compact library search width: ${JSON.stringify(controlUx)}`);
assert.ok(controlUx.controlsHeight <= 42, `Expected compact library controls height: ${JSON.stringify(controlUx)}`);
assert.equal(controlUx.controlsJustifyContent, "end", `Expected library controls aligned away from cards: ${JSON.stringify(controlUx)}`);
assert.equal(controlUx.searchPlaceholder, "Поиск...", `Expected quieter library search placeholder: ${JSON.stringify(controlUx)}`);
assert.equal(controlUx.searchOpacity, "1", `Expected library search text not to be faded through container opacity: ${JSON.stringify(controlUx)}`);
assert.equal(controlUx.searchFocused, true, `Expected library search to accept focus: ${JSON.stringify(controlUx)}`);
assert.equal(controlUx.searchFocusedBoxShadow, "none", `Expected library search focus without heavy panel shadow: ${JSON.stringify(controlUx)}`);
assert.ok(controlUx.viewButtonWidth <= 32 && controlUx.viewButtonHeight <= 32, `Expected compact view toggle buttons: ${JSON.stringify(controlUx)}`);
assert.ok(
  hover.copyBackground !== before.copyBackground || hover.copyBorderColor !== before.copyBorderColor || hover.copyColor !== before.copyColor,
  `Expected copy button hover style change: ${JSON.stringify({ before, hover })}`
);
assert.equal(continueValue.hasSection, true, `Expected continue section: ${JSON.stringify(continueValue)}`);
assert.equal(continueValue.hasClear, true, `Expected continue clear button: ${JSON.stringify(continueValue)}`);
assert.equal(continueValue.confirmVisible, true, `Expected inline confirm next to clear button: ${JSON.stringify(continueValue)}`);
assert.deepEqual(continueValue.confirmLabels, ["Удалить", "Отмена"], `Expected inline confirm actions: ${JSON.stringify(continueValue)}`);
assert.equal(continueValue.removedAfterCancel, true, `Expected inline confirm to cancel cleanly: ${JSON.stringify(continueValue)}`);
assert.equal(continueValue.hiddenAfterConfirm, true, `Expected continue section hidden after progress delete: ${JSON.stringify(continueValue)}`);
assert.equal(searchValue.inputType, "text", `Expected custom text search input: ${JSON.stringify(searchValue)}`);
assert.equal(searchValue.visibleAfterInput, true, `Expected library clear button visible after input: ${JSON.stringify(searchValue)}`);
assert.equal(searchValue.clearHiddenAfterClick, true, `Expected library clear button hidden after click: ${JSON.stringify(searchValue)}`);
assert.equal(searchValue.valueAfterClick, "", `Expected library search cleared: ${JSON.stringify(searchValue)}`);
assert.ok(searchValue.afterFilterCount < searchValue.beforeCount, `Expected library search to filter cards: ${JSON.stringify(searchValue)}`);
assert.equal(searchValue.countAfterClear, searchValue.beforeCount, `Expected library clear to restore cards: ${JSON.stringify(searchValue)}`);

console.log("Browser library passed.", { before, hover, cardUx, controlUx, searchValue, continueValue });
