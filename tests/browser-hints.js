import assert from "node:assert/strict";

const endpoint = process.env.CDP_ENDPOINT || "http://127.0.0.1:9222/json";
const targetUrl = process.env.BROWSER_TEST_URL || "http://127.0.0.1:8000/book.html?id=mondschein&chapter=7";
const blockquoteTargetUrl = new URL(targetUrl);
blockquoteTargetUrl.searchParams.set("chapter", "20");
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
  await waitFor("Boolean(document.querySelector('[data-confirm]') || document.querySelector('u[data-hint]'))");
  await evaluate("document.querySelector('[data-confirm]')?.click()");
  await waitFor("Boolean(document.querySelector('u[data-hint]'))");
  return evaluate(`(async () => {
    const hint = document.querySelector('u[data-hint]');
    hint.scrollIntoView({ block: 'center', inline: 'nearest' });
    await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    hint.focus();
    hint.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
    await new Promise((resolve) => requestAnimationFrame(resolve));
    const tooltip = document.querySelector('.hint-tooltip');
    const rect = tooltip?.getBoundingClientRect();
    const toolbar = document.querySelector('.toolbar')?.getBoundingClientRect();
    return {
      width: window.innerWidth,
      height: window.innerHeight,
      hasTooltip: Boolean(tooltip),
      described: Boolean(hint.getAttribute('aria-describedby')),
      toolbarBottom: toolbar?.bottom || 0,
      rect: rect ? {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
        width: rect.width,
        height: rect.height
      } : null
    };
  })()`);
}

await send("Runtime.enable");
await send("Page.enable");
await send("Network.enable");
await send("Network.setCacheDisabled", { cacheDisabled: true });

const desktop = await measure(1440, 900);
const mobile = await measure(390, 844);

await send("Emulation.setDeviceMetricsOverride", {
  width: 1440,
  height: 900,
  deviceScaleFactor: 1,
  mobile: false
});
await send("Page.navigate", { url: blockquoteTargetUrl.href });
await waitFor("document.readyState === 'complete'");
await waitFor("Boolean(document.querySelector('[data-confirm]') || document.querySelector('[data-chapter-content] h2'))");
await evaluate("document.querySelector('[data-confirm]')?.click()");
await waitFor("document.querySelector('[data-chapter-content] h2')?.textContent.includes('Глава 20')");
await waitFor("Boolean([...document.querySelectorAll('blockquote u[data-hint]')].some((node) => node.textContent.trim() === 'ПДК'))");
const blockquote = await evaluate(`(() => {
  const hint = [...document.querySelectorAll('blockquote u[data-hint]')].find((node) => node.textContent.trim() === 'ПДК');
  const app = document.querySelector('lo-reader-app');
  return {
    found: Boolean(hint),
    text: hint?.textContent || '',
    hint: hint?.dataset.hint || '',
    inBlockquote: Boolean(hint?.closest('blockquote')),
    warnings: app?.warnings?.map((warning) => ({ type: warning.type, anchor: warning.anchor })) || []
  };
})()`);
socket.close();

for (const result of [desktop, mobile]) {
  assert.equal(result.hasTooltip, true, `Expected tooltip at ${result.width}px: ${JSON.stringify(result)}`);
  assert.equal(result.described, true, `Expected aria-describedby at ${result.width}px: ${JSON.stringify(result)}`);
  assert.ok(result.rect.left >= 0, `Tooltip left overflow at ${result.width}px: ${JSON.stringify(result)}`);
  assert.ok(result.rect.right <= result.width, `Tooltip right overflow at ${result.width}px: ${JSON.stringify(result)}`);
  assert.ok(result.rect.top >= result.toolbarBottom, `Tooltip overlaps toolbar at ${result.width}px: ${JSON.stringify(result)}`);
  assert.ok(result.rect.bottom <= result.height, `Tooltip bottom overflow at ${result.width}px: ${JSON.stringify(result)}`);
}
assert.equal(blockquote.found, true, `Expected blockquote hint for PDK: ${JSON.stringify(blockquote)}`);
assert.equal(blockquote.inBlockquote, true, `Expected PDK hint inside blockquote: ${JSON.stringify(blockquote)}`);
assert.equal(blockquote.hint, "предельно допустимая концентрация", `Expected PDK hint text: ${JSON.stringify(blockquote)}`);
assert.equal(
  blockquote.warnings.some((warning) => warning.type === "hint" && warning.anchor === "ПДК"),
  false,
  `Expected no missing-hint warning for PDK: ${JSON.stringify(blockquote)}`
);

console.log("Browser hints passed.", { desktop, mobile, blockquote });
