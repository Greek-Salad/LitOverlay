import assert from "node:assert/strict";

const endpoint = process.env.CDP_ENDPOINT || "http://127.0.0.1:9222/json";
const baseUrl = process.env.BROWSER_TEST_BASE_URL || "http://127.0.0.1:8000";
const books = [
  { id: "hellfire", title: "Гореть тебе в Аду" },
  { id: "train", title: "Весьма странная гармония" },
  { id: "mondschein", title: "От предвечной Тьмы к лунному Свету" },
  { id: "digitalfever", title: "Цифровая лихорадка" }
];

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
    localStorage.setItem("ageGateConfirmed", JSON.stringify(true));
    localStorage.setItem("ageGateConfirmedTimestamp", JSON.stringify(Date.now()));
    localStorage.setItem("readingProgress", JSON.stringify({}));
    localStorage.setItem("litoverlay:v2:readState", JSON.stringify({ completed: {}, highlights: {} }));
  `
});

await send("Page.navigate", { url: `${baseUrl}/` });
await waitFor("document.readyState === 'complete'");
await waitFor("Boolean(document.querySelector('lo-library-app'))");
await waitFor("document.querySelectorAll('.book-card').length >= 4");
const rootValue = await evaluate(`({
  pathname: window.location.pathname,
  hasLibrary: Boolean(document.querySelector('lo-library-app')),
  cards: document.querySelectorAll('.book-card').length,
  directoryListingTitle: document.querySelector('h1')?.textContent || ''
})`);
assert.equal(rootValue.hasLibrary, true, `Expected root URL to render library app: ${JSON.stringify(rootValue)}`);
assert.ok(rootValue.cards >= 4, `Expected root URL to render book cards: ${JSON.stringify(rootValue)}`);
assert.doesNotMatch(rootValue.directoryListingTitle, /Index of/i, `Expected root URL not to show directory listing: ${JSON.stringify(rootValue)}`);

const results = [];
let shortFooterChecks = 0;
for (const book of books) {
  await send("Page.navigate", { url: `${baseUrl}/book.html?id=${book.id}` });
  await waitFor("document.readyState === 'complete'");
  await waitFor("document.querySelector('lo-reader-app')?.bookId && !document.querySelector('.age-gate-card')");
  await waitFor(`document.title.includes(${JSON.stringify(book.title)}) || document.querySelector('.error-state')`);
  const value = await evaluate(`(() => {
    const app = document.querySelector('lo-reader-app');
    return {
      requested: ${JSON.stringify(book.id)},
      url: window.location.href,
      appBookId: app?.bookId || '',
      title: document.title,
      heading: document.querySelector('[data-chapter-content] h1, [data-chapter-content] h2')?.textContent || '',
      readingAreaBottom: Math.round(document.querySelector('[data-reading-area]')?.getBoundingClientRect().bottom || 0),
      readingAreaClientHeight: document.querySelector('[data-reading-area]')?.clientHeight || 0,
      readingAreaScrollHeight: document.querySelector('[data-reading-area]')?.scrollHeight || 0,
      footerBottom: Math.round(document.querySelector('.chapter-navigation')?.getBoundingClientRect().bottom || 0),
      error: document.querySelector('.error-state')?.textContent || ''
    };
  })()`);
  results.push(value);
  assert.equal(value.appBookId, book.id, `Expected routed book id to stay ${book.id}: ${JSON.stringify(value)}`);
  assert.match(value.title, new RegExp(book.title.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Expected document title for ${book.id}: ${JSON.stringify(value)}`);
  if (value.readingAreaScrollHeight <= value.readingAreaClientHeight + 1) {
    shortFooterChecks += 1;
    assert.ok(Math.abs(value.footerBottom - value.readingAreaBottom) <= 1, `Expected short chapter footer pinned to bottom of reading area: ${JSON.stringify(value)}`);
  }
  assert.equal(value.error, "", `Expected no reader error for ${book.id}: ${JSON.stringify(value)}`);
}

assert.ok(shortFooterChecks >= 1, `Expected at least one non-scrollable preface for footer layout coverage: ${JSON.stringify(results)}`);

await send("Emulation.setDeviceMetricsOverride", {
  width: 390,
  height: 844,
  deviceScaleFactor: 2,
  mobile: true
});
await send("Page.navigate", { url: `${baseUrl}/book.html?id=hellfire` });
await waitFor("document.readyState === 'complete'");
await waitFor("document.querySelector('lo-reader-app')?.bookId === 'hellfire' && !document.querySelector('.age-gate-card')");
await evaluate(`(() => {
  const area = document.querySelector('[data-reading-area]');
  area.scrollTop = area.scrollHeight;
})()`);
await waitFor("Math.abs(document.querySelector('.chapter-navigation')?.getBoundingClientRect().bottom - document.querySelector('[data-reading-area]')?.getBoundingClientRect().bottom) <= 1");
const mobileFooter = await evaluate(`(() => {
  const nav = document.querySelector('.chapter-navigation');
  const inner = document.querySelector('.chapter-navigation-inner');
  const navStyle = getComputedStyle(nav);
  const appSeparatorStyle = getComputedStyle(document.body, '::after');
  const navRect = nav.getBoundingClientRect();
  const innerRect = inner.getBoundingClientRect();
  return {
    viewportHeight: window.innerHeight,
    navBottom: Math.round(navRect.bottom),
    innerBottom: Math.round(innerRect.bottom),
    buttonSafeGap: Math.round(navRect.bottom - innerRect.bottom),
    paddingBottom: navStyle.paddingBottom,
    appSeparatorContent: appSeparatorStyle.content,
    appSeparatorHeight: appSeparatorStyle.height,
    appSeparatorPosition: appSeparatorStyle.position,
    appSeparatorPointerEvents: appSeparatorStyle.pointerEvents,
    appSeparatorBackground: appSeparatorStyle.backgroundColor,
    mobileSearchButton: Boolean(document.querySelector('[data-mobile-search]'))
  };
})()`);
assert.ok(mobileFooter.navBottom <= mobileFooter.viewportHeight + 1, `Expected mobile footer inside visual viewport: ${JSON.stringify(mobileFooter)}`);
assert.ok(mobileFooter.buttonSafeGap >= 10, `Expected mobile footer buttons above system bar buffer: ${JSON.stringify(mobileFooter)}`);
assert.equal(mobileFooter.appSeparatorHeight, "1px", `Expected 1px global mobile system separator: ${JSON.stringify(mobileFooter)}`);
assert.equal(mobileFooter.appSeparatorPosition, "fixed", `Expected fixed global mobile system separator: ${JSON.stringify(mobileFooter)}`);
assert.equal(mobileFooter.appSeparatorPointerEvents, "none", `Expected non-interactive global mobile system separator: ${JSON.stringify(mobileFooter)}`);
assert.notEqual(mobileFooter.appSeparatorBackground, "rgba(0, 0, 0, 0)", `Expected visible global mobile system separator: ${JSON.stringify(mobileFooter)}`);
assert.equal(mobileFooter.mobileSearchButton, false, `Expected reader mobile search toggle removed: ${JSON.stringify(mobileFooter)}`);

socket.close();

console.log("Browser routing passed.", { rootValue, results, mobileFooter });
