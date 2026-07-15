import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const endpoint = process.env.CDP_ENDPOINT || "http://127.0.0.1:9222/json";
const targetUrl = process.env.BROWSER_TEST_URL || "http://127.0.0.1:8000/book.html?id=mondschein&chapter=15";
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

async function waitFor(expression, timeout = 8000) {
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
await send("Page.navigate", { url: targetUrl });
await waitFor("document.readyState === 'complete'");
await waitFor("Boolean(document.querySelector('[data-confirm]') || document.querySelector('.audio-launcher'))");
await evaluate("document.querySelector('[data-confirm]')?.click()");
await waitFor("Boolean(document.querySelector('.audio-launcher'))");

const value = await evaluate(`(async () => {
  const launcher = document.querySelector('.audio-launcher [data-play]');
  launcher.click();
  const seek = document.querySelector('[data-seek]');
  const app = document.querySelector('lo-reader-app');
  const track = app?.audio?.activeTrack || app?.audio?.tracks?.[0];
  const audio = track?.audio;
  if (!seek || !audio) return { hasSeek: Boolean(seek), hasAudio: Boolean(audio) };
  audio.muted = true;
  const playResult = await audio.play().then(() => true).catch((error) => error.name || String(error));

  const metadataReady = await new Promise((resolve) => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) {
      resolve(true);
      return;
    }
    audio.addEventListener('loadedmetadata', () => resolve(true), { once: true });
    audio.load();
    setTimeout(() => resolve(false), 5000);
  });
  if (!metadataReady || !Number.isFinite(audio.duration) || audio.duration <= 0) {
    return { hasSeek: true, hasAudio: true, metadataReady, duration: audio.duration };
  }

  const directExpected = Math.min(5, audio.duration / 10);
  audio.currentTime = directExpected;
  await new Promise((resolve) => setTimeout(resolve, 250));
  const directAfter = audio.currentTime;
  audio.currentTime = 0;
  await new Promise((resolve) => setTimeout(resolve, 250));

  const activeSeek = document.querySelector('[data-seek]');
  const rect = activeSeek.getBoundingClientRect();
  activeSeek.focus();
  const seekFocusStyle = getComputedStyle(activeSeek);
  const sliderRingRules = [...document.styleSheets].flatMap((sheet) => {
    try {
      return [...sheet.cssRules];
    } catch {
      return [];
    }
  }).filter((rule) => {
    return rule.selectorText
      && /audio-(progress|volume)-container/.test(rule.selectorText)
      && /(hover|dragging|focus-visible)/.test(rule.selectorText);
  }).map((rule) => ({
    selectorText: rule.selectorText,
    boxShadow: rule.style.boxShadow || '',
    outline: rule.style.outline || ''
  }));
  const dispatchPointer = (type, button, ratio) => {
    const event = new PointerEvent(type, {
      bubbles: true,
      cancelable: true,
      pointerId: button === 0 ? 51 : 52,
      pointerType: 'mouse',
      button,
      buttons: type === 'pointerup' ? 0 : (button === 0 ? 1 : 2),
      clientX: rect.left + rect.width * ratio,
      clientY: rect.top + rect.height / 2
    });
    activeSeek.dispatchEvent(event);
    return event.defaultPrevented;
  };

  const leftDownPrevented = dispatchPointer('pointerdown', 0, 0.75);
  const draggingBoxShadow = getComputedStyle(activeSeek).boxShadow;
  const immediateProgress = Number.parseFloat(activeSeek.querySelector('[data-seek-bar]').style.width);
  const progressContainerTransform = getComputedStyle(activeSeek).transform;
  const progressKnob = getComputedStyle(activeSeek.querySelector('[data-seek-bar]'), '::after');
  const volumeContainer = document.querySelector('[data-volume]');
  const volumeKnob = getComputedStyle(volumeContainer.querySelector('[data-volume-bar]'), '::after');
  const leftUpPrevented = dispatchPointer('pointerup', 0, 0.75);
  const expectedLeft = audio.duration * 0.75;
  await new Promise((resolve) => {
    const started = Date.now();
    const tick = () => {
      if (Math.abs(audio.currentTime - expectedLeft) < 2 || Date.now() - started > 6000) {
        resolve();
        return;
      }
      setTimeout(tick, 100);
    };
    tick();
  });
  const afterLeft = audio.currentTime;

  audio.pause();
  const beforeRight = audio.currentTime;
  const rightDownPrevented = dispatchPointer('pointerdown', 2, 0.1);
  const rightUpPrevented = dispatchPointer('pointerup', 2, 0.1);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const contextEvent = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: rect.left + rect.width * 0.1,
    clientY: rect.top + rect.height / 2
  });
  activeSeek.dispatchEvent(contextEvent);

  return {
    hasSeek: true,
    hasAudio: true,
    metadataReady,
    duration: audio.duration,
    readyState: audio.readyState,
    networkState: audio.networkState,
    paused: audio.paused,
    playResult,
    seekableLength: audio.seekable.length,
    seekableStart: audio.seekable.length ? audio.seekable.start(0) : null,
    seekableEnd: audio.seekable.length ? audio.seekable.end(audio.seekable.length - 1) : null,
    bufferedLength: audio.buffered.length,
    bufferedEnd: audio.buffered.length ? audio.buffered.end(audio.buffered.length - 1) : null,
    errorCode: audio.error?.code || null,
    directExpected,
    directAfter,
    rectWidth: rect.width,
    seekFocusOutlineStyle: seekFocusStyle.outlineStyle,
    seekFocusOutlineWidth: seekFocusStyle.outlineWidth,
    seekFocusBoxShadow: seekFocusStyle.boxShadow,
    draggingBoxShadow,
    sliderRingRules,
    immediateProgress,
    progressContainerTransform,
    progressKnobWidth: progressKnob.width,
    progressKnobHeight: progressKnob.height,
    volumeKnobWidth: volumeKnob.width,
    volumeKnobHeight: volumeKnob.height,
    expectedLeft,
    afterLeft,
    leftDownPrevented,
    leftUpPrevented,
    beforeRight,
    afterRight: audio.currentTime,
    rightDownPrevented,
    rightUpPrevented,
    contextDefaultPrevented: contextEvent.defaultPrevented
  };
})()`);

socket.close();

assert.equal(value.hasSeek, true, "Expected global audio seek slider");
assert.equal(value.hasAudio, true, "Expected active audio object");
assert.equal(value.metadataReady, true, `Expected audio metadata, got duration ${value.duration}`);
assert.ok(value.duration > 0, `Expected positive duration, got ${value.duration}`);
assert.ok(
  Math.abs(value.immediateProgress - 75) < 1,
  `Expected immediate visual seek near 75%, got ${value.immediateProgress}; ${JSON.stringify(value)}`
);
assert.equal(value.progressContainerTransform, "none", `Expected seek container not to scale knobs: ${JSON.stringify(value)}`);
assert.doesNotMatch(
  cssText,
  /\.audio-progress-container:focus-visible,[\s\S]*?outline:\s*2px\s+solid\s+var\(--progress-fill\)/,
  "Expected audio slider focus style not to use the old heavy outline"
);
assert.equal(value.seekFocusOutlineStyle, "none", `Expected focused audio seek slider without visible outline: ${JSON.stringify(value)}`);
assert.equal(value.seekFocusBoxShadow, "none", `Expected focused audio seek slider without outer shadow: ${JSON.stringify(value)}`);
assert.equal(value.draggingBoxShadow, "none", `Expected dragging audio seek slider without outer shadow: ${JSON.stringify(value)}`);
assert.ok(
  value.sliderRingRules.every((rule) => !rule.boxShadow),
  `Expected audio slider hover/drag/focus rules without outer box-shadow: ${JSON.stringify(value.sliderRingRules)}`
);
assert.equal(value.progressKnobWidth, value.progressKnobHeight, `Expected round progress knob: ${JSON.stringify(value)}`);
assert.equal(value.volumeKnobWidth, value.volumeKnobHeight, `Expected round volume knob: ${JSON.stringify(value)}`);
assert.ok(
  Math.abs(value.afterLeft - value.expectedLeft) < 2,
  `Expected left click seek near ${value.expectedLeft}, got ${value.afterLeft}; ${JSON.stringify(value)}`
);
assert.ok(
  Math.abs(value.afterRight - value.beforeRight) < 0.05,
  `Expected right click to keep ${value.beforeRight}, got ${value.afterRight}`
);
assert.equal(value.contextDefaultPrevented, true, "Expected contextmenu to be prevented on seek slider");

console.log("Browser audio seek passed.", value);
