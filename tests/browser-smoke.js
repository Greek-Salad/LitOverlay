import assert from "node:assert/strict";

const endpoint = process.env.CDP_ENDPOINT || "http://127.0.0.1:9222/json";
const targetUrl = process.env.BROWSER_TEST_URL || "http://127.0.0.1:8000/book.html?id=mondschein&chapter=15";
const cleanTargetUrl = targetUrl.replace(/\/book\.html(?=[?#]|$)/, "/book");
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
await send("Network.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    localStorage.setItem("themePreset", JSON.stringify("dark"));
    localStorage.setItem("themeColors", JSON.stringify({ bg: "#202124", text: "#e8eaed" }));
    localStorage.setItem("ageGateConfirmed", JSON.stringify(false));
    localStorage.setItem("ageGateConfirmedTimestamp", JSON.stringify(0));
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
await waitFor("Boolean(document.querySelector('[data-confirm]') || document.querySelector('[data-chapter-content] h2'))");
const ageGateValue = await evaluate(`(() => {
  const card = document.querySelector('.age-gate-card');
  const actions = document.querySelector('.age-gate-card .modal-actions');
  if (!card || !actions) return { visible: false };
  const confirm = actions.querySelector('[data-confirm]');
  const actionsStyle = getComputedStyle(actions);
  const confirmStyle = getComputedStyle(confirm);
  return {
    visible: true,
    title: card.querySelector('h2')?.textContent.trim() || '',
    text: card.textContent.replace(/\\s+/g, ' ').trim(),
    labels: [...actions.querySelectorAll('button')].map((button) => button.textContent.trim()),
    focused: document.activeElement?.textContent?.trim() || '',
    actionsJustify: actionsStyle.justifyContent,
    actionsAlign: actionsStyle.alignItems,
    confirmBorderColor: confirmStyle.borderTopColor,
    confirmFontSize: confirmStyle.fontSize,
    confirmOutlineStyle: confirmStyle.outlineStyle,
    confirmOutlineWidth: confirmStyle.outlineWidth,
    confirmBoxShadow: confirmStyle.boxShadow
  };
})()`);
await evaluate("document.querySelector('[data-confirm]')?.click()");
await waitFor("document.querySelector('[data-chapter-content] h2')?.textContent.includes('Глава 15')");
await waitFor("Boolean(document.querySelector('img[src*=\"comments15.png\"]'))");
await waitFor("![...document.querySelectorAll('[data-chapter-content] p')].some((node) => node.textContent.includes('получили, гады'))");
await waitFor("document.querySelectorAll('.chapter-item').length >= 34", 12000);
await waitFor("document.querySelector('[data-next] span')?.textContent.includes('Сервер лежит')", 15000);

const value = await evaluate(`({
    title: document.querySelector('[data-chapter-content] h2')?.textContent || '',
    chapters: document.querySelectorAll('.chapter-item').length,
    audioLaunchers: document.querySelectorAll('.audio-launcher').length,
    commentsImage: Boolean(document.querySelector('img[src*="comments15.png"]')),
    commentsImageAlt: document.querySelector('img[src*="comments15.png"]')?.alt || '',
    commentsParagraphPresent: [...document.querySelectorAll('[data-chapter-content] p')].some((node) => node.textContent.includes('получили, гады')),
    warningsVisible: !document.querySelector('[data-warnings]')?.hidden,
    footerWidth: Math.round(document.querySelector('.chapter-navigation')?.getBoundingClientRect().width || 0),
    viewportWidth: window.innerWidth,
    prevNavLeft: Math.round(document.querySelector('[data-prev]')?.getBoundingClientRect().left || 0),
    nextNavRight: Math.round(document.querySelector('[data-next]')?.getBoundingClientRect().right || 0),
    nextNav: document.querySelector('[data-next] span')?.textContent || '',
    launcherBg: getComputedStyle(document.querySelector('.audio-launcher')).backgroundColor,
    launcherBorder: getComputedStyle(document.querySelector('.audio-launcher')).borderTopColor,
    bodyBg: getComputedStyle(document.body).backgroundColor
  })`);

const audioValue = await evaluate(`(async () => {
  const app = document.querySelector('lo-reader-app');
  const beforeRepeat = app.audio.tracks.length;
  await app.goToChapter(15);
  const afterRepeat = app.audio.tracks.length;
  let globalToggleCount = 0;
  const originalToggle = app.audio.toggle.bind(app.audio);
  app.audio.toggle = () => {
    globalToggleCount += 1;
  };
  const playButton = document.querySelector('.audio-launcher [data-play]');
  playButton.focus();
  playButton.dispatchEvent(new KeyboardEvent('keydown', {
    key: ' ',
    code: 'Space',
    bubbles: true,
    cancelable: true
  }));
  app.audio.toggle = originalToggle;
  return {
    beforeRepeat,
    afterRepeat,
    launchersAfterRepeat: document.querySelectorAll('.audio-launcher').length,
    globalToggleCount
  };
})()`);

const searchValue = await evaluate(`(async () => {
  const input = document.querySelector('[data-search-input]');
  const clear = document.querySelector('[data-search-clear]');
  const paddingBeforeInput = getComputedStyle(input).paddingRight;
  input.value = 'Глава';
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise((resolve) => setTimeout(resolve, 350));
  const matchesAfterInput = document.querySelectorAll('.search-highlight').length;
  const statusAfterInput = document.querySelector('[data-search-status]').textContent;
  const clearVisibleAfterInput = !clear.hidden;
  const paddingAfterInput = getComputedStyle(input).paddingRight;
  clear.click();
  const paddingAfterClear = getComputedStyle(input).paddingRight;
  return {
    inputType: input.type,
    paddingBeforeInput,
    paddingAfterInput,
    paddingAfterClear,
    matchesAfterInput,
    statusAfterInput,
    clearVisibleAfterInput,
    valueAfterClear: input.value,
    clearHiddenAfterClick: clear.hidden,
    matchesAfterClear: document.querySelectorAll('.search-highlight').length,
    statusAfterClear: document.querySelector('[data-search-status]').textContent
  };
})()`);

const warningValue = await evaluate(`(() => {
  const app = document.querySelector('lo-reader-app');
  app.reportWarning({
    type: 'media-file',
    id: 'browser-smoke-missing-file',
    chapter: app.currentChapter,
    anchor: 'browser-smoke anchor',
    src: './books/mondschein/media/missing-smoke-file.png'
  });
  app.reportWarning({
    type: 'media-file',
    id: 'browser-smoke-missing-file',
    chapter: app.currentChapter,
    anchor: 'browser-smoke anchor',
    src: './books/mondschein/media/missing-smoke-file.png'
  });
  const button = document.querySelector('[data-warnings]');
  const style = getComputedStyle(button);
  const closedColor = style.color;
  const closedBackground = style.backgroundColor;
  button.click();
  const openStyle = getComputedStyle(button);
  const popover = document.querySelector('[data-warnings-popover]');
  return {
    hidden: button.hidden,
    hasWarningsClass: button.classList.contains('has-warnings'),
    closedColor,
    closedBackground,
    openBackground: openStyle.backgroundColor,
    ariaExpanded: button.getAttribute('aria-expanded'),
    ariaLabel: button.getAttribute('aria-label'),
    popoverHidden: popover.hidden,
    popoverText: popover.textContent
  };
})()`);

await send("Page.navigate", { url: cleanTargetUrl });
await waitFor("document.readyState === 'complete'");
await waitFor("Boolean(document.querySelector('[data-confirm]') || document.querySelector('[data-chapter-content] h2'))");
await evaluate("document.querySelector('[data-confirm]')?.click()");
await waitFor("document.querySelector('[data-chapter-content] h2')?.textContent.includes('Глава 15')");
const cleanUrlValue = await evaluate(`({
  pathname: window.location.pathname,
  title: document.querySelector('[data-chapter-content] h2')?.textContent || '',
  hasReader: Boolean(document.querySelector('lo-reader-app')),
  hasLauncher: Boolean(document.querySelector('.audio-launcher'))
})`);

socket.close();

assert.ok(value.title.includes("Глава 15"), `Expected chapter 15, got ${value.title}`);
assert.equal(ageGateValue.visible, true, `Expected age gate to be visible: ${JSON.stringify(ageGateValue)}`);
assert.equal(ageGateValue.title, "Предупреждение о возрасте", `Expected old age gate title: ${JSON.stringify(ageGateValue)}`);
assert.match(ageGateValue.text, /содержит контент, предназначенный исключительно для лиц, достигших 18 лет/, `Expected stricter age gate copy: ${JSON.stringify(ageGateValue)}`);
assert.deepEqual(ageGateValue.labels, ["Мне уже есть 18 лет", "Мне ещё нет 18 лет"], `Expected age buttons confirm first: ${JSON.stringify(ageGateValue)}`);
assert.equal(ageGateValue.focused, "Мне уже есть 18 лет", `Expected confirm button focus: ${JSON.stringify(ageGateValue)}`);
assert.equal(ageGateValue.actionsJustify, "center", `Expected centered age actions: ${JSON.stringify(ageGateValue)}`);
assert.equal(ageGateValue.actionsAlign, "center", `Expected centered age actions: ${JSON.stringify(ageGateValue)}`);
assert.match(ageGateValue.confirmBorderColor, /rgba\(0, 0, 0, 0\)|transparent/, `Expected age confirm border to be transparent: ${JSON.stringify(ageGateValue)}`);
assert.ok(Number.parseFloat(ageGateValue.confirmFontSize) >= 16, `Expected larger age button font: ${JSON.stringify(ageGateValue)}`);
assert.equal(ageGateValue.confirmOutlineStyle, "none", `Expected age confirm without system outline: ${JSON.stringify(ageGateValue)}`);
assert.ok(value.chapters >= 34, `Expected resolved chapter list, got ${value.chapters}`);
assert.equal(value.commentsImage, true, `Expected generated comments media image: ${JSON.stringify(value)}`);
assert.match(value.commentsImageAlt, /комментариев/, `Expected comments image alt text: ${JSON.stringify(value)}`);
assert.equal(value.commentsParagraphPresent, false, `Expected comments paragraph replaced by media: ${JSON.stringify(value)}`);
assert.ok(value.footerWidth >= value.viewportWidth - 1, `Expected full-width footer, got ${value.footerWidth}/${value.viewportWidth}`);
assert.ok(value.prevNavLeft <= 24, `Expected previous footer button near left edge: ${JSON.stringify(value)}`);
assert.ok(value.nextNavRight >= value.viewportWidth - 24, `Expected next footer button near right edge: ${JSON.stringify(value)}`);
assert.ok(value.nextNav.includes("Сервер лежит"), `Expected next chapter title, got ${value.nextNav}`);
assert.equal(value.launcherBg, value.bodyBg, `Expected audio launcher background to match page: ${JSON.stringify(value)}`);
assert.equal(value.launcherBorder, "rgb(70, 71, 74)", `Expected old dark player border: ${JSON.stringify(value)}`);
assert.equal(audioValue.afterRepeat, audioValue.beforeRepeat, `Expected repeated chapter injection not to duplicate audio tracks: ${JSON.stringify(audioValue)}`);
assert.equal(audioValue.launchersAfterRepeat, 2, `Expected two chapter audio launchers after repeat render: ${JSON.stringify(audioValue)}`);
assert.equal(audioValue.globalToggleCount, 0, `Expected focused audio controls to bypass global Space hotkey: ${JSON.stringify(audioValue)}`);
assert.equal(searchValue.inputType, "text", `Expected reader search to use custom text input: ${JSON.stringify(searchValue)}`);
assert.ok(parseFloat(searchValue.paddingBeforeInput) <= 16, `Expected empty search input to leave room for placeholder: ${JSON.stringify(searchValue)}`);
assert.ok(parseFloat(searchValue.paddingAfterInput) >= 80, `Expected active search input to reserve room for clear/status controls: ${JSON.stringify(searchValue)}`);
assert.ok(parseFloat(searchValue.paddingAfterClear) <= 16, `Expected cleared search input to restore placeholder padding: ${JSON.stringify(searchValue)}`);
assert.ok(searchValue.matchesAfterInput > 0, `Expected reader search matches: ${JSON.stringify(searchValue)}`);
assert.equal(searchValue.clearVisibleAfterInput, true, `Expected reader clear visible after input: ${JSON.stringify(searchValue)}`);
assert.equal(searchValue.valueAfterClear, "", `Expected reader search cleared: ${JSON.stringify(searchValue)}`);
assert.equal(searchValue.clearHiddenAfterClick, true, `Expected reader clear hidden after click: ${JSON.stringify(searchValue)}`);
assert.equal(searchValue.matchesAfterClear, 0, `Expected reader search highlights cleared: ${JSON.stringify(searchValue)}`);
assert.equal(searchValue.statusAfterClear, "", `Expected reader search status cleared: ${JSON.stringify(searchValue)}`);
assert.equal(warningValue.hidden, false, `Expected warnings button visible after warning: ${JSON.stringify(warningValue)}`);
assert.equal(warningValue.hasWarningsClass, true, `Expected warnings button class: ${JSON.stringify(warningValue)}`);
assert.equal(warningValue.closedBackground, "rgba(0, 0, 0, 0)", `Expected closed warnings button to stay icon-style transparent: ${JSON.stringify(warningValue)}`);
assert.notEqual(warningValue.openBackground, "rgb(249, 171, 0)", `Expected open warnings button not to become a solid warning fill: ${JSON.stringify(warningValue)}`);
assert.equal(warningValue.closedColor, "rgb(249, 171, 0)", `Expected warnings icon to use theme warning color: ${JSON.stringify(warningValue)}`);
assert.equal(warningValue.ariaExpanded, "true", `Expected warnings popover expanded state: ${JSON.stringify(warningValue)}`);
assert.equal(warningValue.popoverHidden, false, `Expected warnings popover open: ${JSON.stringify(warningValue)}`);
assert.match(warningValue.popoverText, /media: не загрузился файл/, `Expected media file warning text: ${JSON.stringify(warningValue)}`);
assert.equal(cleanUrlValue.hasReader, true, `Expected /book clean URL to render reader: ${JSON.stringify(cleanUrlValue)}`);
assert.equal(cleanUrlValue.hasLauncher, true, `Expected /book clean URL to render audio launchers: ${JSON.stringify(cleanUrlValue)}`);
assert.ok(cleanUrlValue.title.includes("Глава 15"), `Expected clean URL chapter 15, got ${JSON.stringify(cleanUrlValue)}`);
console.log("Browser smoke passed.", { value, ageGateValue, audioValue, searchValue, warningValue, cleanUrlValue });
