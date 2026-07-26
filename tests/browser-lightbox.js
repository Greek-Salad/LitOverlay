import assert from "node:assert/strict";

const endpoint = process.env.CDP_ENDPOINT || "http://127.0.0.1:9222/json";
const targetUrl = process.env.BROWSER_TEST_URL || "http://127.0.0.1:8000/book.html?id=mondschein&chapter=15";
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
await send("Emulation.setDeviceMetricsOverride", { width: 1280, height: 860, deviceScaleFactor: 1, mobile: false });
await send("Page.addScriptToEvaluateOnNewDocument", {
  source: `
    localStorage.setItem("ageGateConfirmed", JSON.stringify(true));
    localStorage.setItem("ageGateConfirmedTimestamp", JSON.stringify(Date.now()));
  `
});
await send("Page.navigate", { url: targetUrl });
await waitFor("document.readyState === 'complete'");
await waitFor("Boolean(document.querySelector('[data-chapter-content] h2'))");
await waitFor("Boolean(document.querySelector('[data-chapter-content] img'))");
await waitFor("document.querySelector('[data-chapter-content] img')?.naturalWidth > 0");

const value = await evaluate(`(async () => {
  const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  const contentImg = document.querySelector('[data-chapter-content] img');
  const cursor = getComputedStyle(contentImg).cursor;

  contentImg.click();
  await sleep(250);
  const overlay = document.querySelector('.image-lightbox');
  if (!overlay) return { opened: false };
  const overlayVisible = overlay.classList.contains('visible');
  // Снимаем значения сразу: CSSStyleDeclaration "живой" и после закрытия обнулится
  const overlayStyleNow = getComputedStyle(overlay);
  const overlayPosition = overlayStyleNow.position;
  const overlayZ = overlayStyleNow.zIndex;
  const big = overlay.querySelector('.image-lightbox-img');
  const rect = big.getBoundingClientRect();
  const fitsViewport = rect.width <= window.innerWidth && rect.height <= window.innerHeight;
  const naturalRatio = big.naturalWidth / big.naturalHeight;
  const shownRatio = rect.width / rect.height;
  const ratioKept = Math.abs(naturalRatio - shownRatio) < 0.02;

  // Space при открытом просмотре не должен дёргать плеер
  const app = document.querySelector('lo-reader-app');
  const pausedBefore = app.audio.tracks.map((track) => track.audio.paused);
  document.dispatchEvent(new KeyboardEvent('keydown', { code: 'Space', key: ' ', bubbles: true, cancelable: true }));
  await sleep(120);
  const pausedAfterSpace = app.audio.tracks.map((track) => track.audio.paused);

  // Клик по самой картинке НЕ закрывает
  big.click();
  await sleep(120);
  const stillOpenAfterImgClick = Boolean(document.querySelector('.image-lightbox'));

  // Клик по затенению закрывает
  overlay.click();
  await sleep(400);
  const closedByBackdrop = !document.querySelector('.image-lightbox');

  // Повторное открытие и Escape
  contentImg.click();
  await sleep(250);
  const reopened = Boolean(document.querySelector('.image-lightbox'));
  document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }));
  await sleep(400);
  const closedByEscape = !document.querySelector('.image-lightbox');

  return {
    opened: true,
    cursor,
    overlayVisible,
    overlayPosition,
    overlayZ,
    fitsViewport,
    naturalRatio,
    shownRatio,
    ratioKept,
    pausedBefore,
    pausedAfterSpace,
    stillOpenAfterImgClick,
    closedByBackdrop,
    reopened,
    closedByEscape
  };
})()`);

socket.close();

assert.equal(value.opened, true, `Expected lightbox to open on image click: ${JSON.stringify(value)}`);
assert.equal(value.cursor, "zoom-in", `Expected zoom-in cursor on chapter images: ${JSON.stringify(value)}`);
assert.equal(value.overlayVisible, true, `Expected lightbox overlay to become visible: ${JSON.stringify(value)}`);
assert.equal(value.overlayPosition, "fixed", `Expected fixed lightbox overlay: ${JSON.stringify(value)}`);
assert.equal(value.fitsViewport, true, `Expected enlarged image to fit viewport: ${JSON.stringify(value)}`);
assert.equal(value.ratioKept, true, `Expected aspect ratio preserved: ${JSON.stringify(value)}`);
assert.deepEqual(value.pausedAfterSpace, value.pausedBefore, `Expected Space not to toggle audio while lightbox open: ${JSON.stringify(value)}`);
assert.equal(value.stillOpenAfterImgClick, true, `Expected click on the image itself not to close lightbox: ${JSON.stringify(value)}`);
assert.equal(value.closedByBackdrop, true, `Expected backdrop click to close lightbox: ${JSON.stringify(value)}`);
assert.equal(value.reopened, true, `Expected lightbox to reopen: ${JSON.stringify(value)}`);
assert.equal(value.closedByEscape, true, `Expected Escape to close lightbox: ${JSON.stringify(value)}`);
console.log("Browser lightbox passed.", value);
