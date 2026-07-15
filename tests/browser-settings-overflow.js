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

async function measure(width, height) {
  await send("Emulation.setDeviceMetricsOverride", {
    width,
    height,
    deviceScaleFactor: 1,
    mobile: width <= 520
  });
  await send("Page.navigate", { url: targetUrl });
  await waitFor("document.readyState === 'complete'");
  await waitFor("Boolean(document.querySelector('[data-confirm]') || document.querySelector('[data-settings-toggle]'))");
  await evaluate("document.querySelector('[data-confirm]')?.click()");
  await waitFor("Boolean(document.querySelector('[data-settings-toggle]'))");
  await evaluate("document.querySelector('[data-settings-toggle]').click()");
  await waitFor("document.querySelector('[data-settings]')?.classList.contains('open')");
  return evaluate(`(() => {
    const panel = document.querySelector('[data-settings]');
    const content = panel.querySelector('.settings-content');
    const firstSlider = panel.querySelector('.settings-slider');
    firstSlider.focus();
    const firstSliderStyle = getComputedStyle(firstSlider);
    const sliders = [...panel.querySelectorAll('.settings-slider')].map((slider) => ({
      min: Number(slider.min),
      max: Number(slider.max),
      value: Number(slider.value),
      percent: slider.style.getPropertyValue('--slider-percent'),
      outlineStyle: getComputedStyle(slider).outlineStyle,
      boxShadow: getComputedStyle(slider).boxShadow,
      height: getComputedStyle(slider).height,
      backgroundColor: getComputedStyle(slider).backgroundColor
    }));
    const visible = (element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.display !== 'none' && style.visibility !== 'hidden' && rect.width > 0 && rect.height > 0;
    };
    const offenders = Array.from(panel.querySelectorAll('*'))
      .filter((element) => visible(element) && element.scrollWidth > element.clientWidth + 1)
      .slice(0, 8)
      .map((element) => ({
        tag: element.tagName.toLowerCase(),
        className: element.className,
        scrollWidth: element.scrollWidth,
        clientWidth: element.clientWidth
      }));
    return {
      width: window.innerWidth,
      panelClient: panel.clientWidth,
      panelScroll: panel.scrollWidth,
      contentClient: content.clientWidth,
      contentScroll: content.scrollWidth,
      overflowX: getComputedStyle(content).overflowX,
      fontOptions: {
        whitney: getComputedStyle(panel.querySelector('[data-font-family] option[value="Whitney"]')).fontFamily,
        antiqua: getComputedStyle(panel.querySelector('[data-font-family] option[value="Antiqua"]')).fontFamily,
        sourceCodePro: getComputedStyle(panel.querySelector('[data-font-family] option[value="SourceCodePro"]')).fontFamily
      },
      focusedSlider: {
        outlineStyle: firstSliderStyle.outlineStyle,
        boxShadow: firstSliderStyle.boxShadow
      },
      sliders,
      offenders
    };
  })()`);
}

await send("Runtime.enable");
await send("Page.enable");
await send("Network.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });

const desktop = await measure(1440, 900);
const mobile = await measure(390, 844);
socket.close();

for (const result of [desktop, mobile]) {
  assert.ok(
    result.panelScroll <= result.panelClient + 1,
    `Settings panel overflows at ${result.width}px: ${JSON.stringify(result)}`
  );
  assert.ok(
    result.contentScroll <= result.contentClient + 1,
    `Settings content overflows at ${result.width}px: ${JSON.stringify(result)}`
  );
  assert.ok(result.fontOptions.whitney.includes("Whitney"), `Whitney option font mismatch: ${JSON.stringify(result.fontOptions)}`);
  assert.ok(result.fontOptions.antiqua.includes("Antiqua"), `Antiqua option font mismatch: ${JSON.stringify(result.fontOptions)}`);
  assert.ok(result.fontOptions.sourceCodePro.includes("SourceCodePro"), `SourceCodePro option font mismatch: ${JSON.stringify(result.fontOptions)}`);
  assert.equal(result.focusedSlider.outlineStyle, "none", `Expected settings slider focus without outline: ${JSON.stringify(result.focusedSlider)}`);
  assert.equal(result.focusedSlider.boxShadow, "none", `Expected settings slider focus without outer shadow: ${JSON.stringify(result.focusedSlider)}`);
  assert.equal(result.sliders.length, 3, `Expected three settings sliders: ${JSON.stringify(result.sliders)}`);
  for (const slider of result.sliders) {
    assert.match(slider.percent, /%$/, `Expected settings slider progress percent: ${JSON.stringify(slider)}`);
    assert.equal(slider.backgroundColor, "rgba(0, 0, 0, 0)", `Expected transparent settings slider base: ${JSON.stringify(slider)}`);
  }
}

assert.match(cssText, /\.settings-slider\s*{[\s\S]*appearance:\s*none;/, "Expected settings sliders to disable native appearance");
assert.match(cssText, /\.settings-slider\s*{[\s\S]*-webkit-appearance:\s*none;/, "Expected settings sliders to disable native webkit appearance");
assert.match(cssText, /\.settings-slider\s*{[\s\S]*--settings-slider-track-size:\s*6px;/, "Expected settings slider track size to stay independent from reader font size");
assert.match(cssText, /\.settings-slider\s*{[\s\S]*--settings-slider-thumb-size:\s*16px;/, "Expected settings slider thumb size to stay independent from reader font size");
assert.match(cssText, /\.settings-slider::-webkit-slider-runnable-track\s*{[\s\S]*height:\s*var\(--settings-slider-track-size\);/, "Expected webkit settings slider track to use fixed track size variable");
assert.match(cssText, /\.settings-slider::-webkit-slider-runnable-track\s*{[\s\S]*border:\s*0;/, "Expected webkit settings slider track without border");
assert.match(cssText, /\.settings-slider::-webkit-slider-thumb\s*{[\s\S]*width:\s*var\(--settings-slider-thumb-size\);[\s\S]*height:\s*var\(--settings-slider-thumb-size\);[\s\S]*margin-top:\s*-5px;/, "Expected webkit settings slider thumb centered from fixed thumb/track sizes");
assert.match(cssText, /\.settings-slider::-webkit-slider-thumb\s*{[\s\S]*border:\s*0;/, "Expected webkit settings slider thumb without border");
assert.match(cssText, /\.settings-slider::-webkit-slider-thumb\s*{[\s\S]*-webkit-appearance:\s*none;/, "Expected webkit settings slider thumb to disable native appearance");
assert.match(cssText, /\.settings-slider::-webkit-slider-thumb\s*{[\s\S]*box-shadow:\s*none;/, "Expected webkit settings slider thumb without bottom-heavy shadow");
assert.match(cssText, /\.settings-slider::-moz-range-track\s*{[\s\S]*height:\s*var\(--settings-slider-track-size\);/, "Expected moz settings slider track to use fixed track size variable");
assert.match(cssText, /\.settings-slider::-moz-range-track\s*{[\s\S]*border:\s*0;/, "Expected moz settings slider track without border");
assert.match(cssText, /\.settings-slider::-moz-range-thumb\s*{[\s\S]*width:\s*var\(--settings-slider-thumb-size\);[\s\S]*height:\s*var\(--settings-slider-thumb-size\);/, "Expected moz settings slider thumb to use fixed thumb size variable");
assert.match(cssText, /\.settings-slider::-moz-range-thumb\s*{[\s\S]*border:\s*0;/, "Expected moz settings slider thumb without border");
assert.match(cssText, /\.settings-slider::-moz-range-thumb\s*{[\s\S]*box-shadow:\s*none;/, "Expected moz settings slider thumb without bottom-heavy shadow");
assert.doesNotMatch(cssText, /\.settings-slider\s*{[\s\S]*accent-color:/, "Expected settings sliders not to rely on native accent-color");

console.log("Browser settings overflow passed.", { desktop, mobile });
