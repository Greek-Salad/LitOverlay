import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { adjustHex, bookUrl, chapterCandidates, getBookIdFromLocation, mix } from "../js/core/utils.js";
import { AudioController, audioTrackId, getSliderPercent, isPrimarySliderPointer } from "../js/reader/audio.js";
import {
  getLegacyLastChapter,
  loadAgeGate,
  loadReaderSettings,
  loadTheme,
  loadReadingProgress,
  saveAgeGateConfirmed,
  saveBookProgress,
  saveReaderSettings,
  STANDARD_THEMES
} from "../js/core/storage.js";
import { ChapterResolver } from "../js/data/books.js";

class MemoryStorage {
  constructor() {
    this.map = new Map();
  }

  getItem(key) {
    return this.map.has(key) ? this.map.get(key) : null;
  }

  setItem(key, value) {
    this.map.set(key, String(value));
  }

  removeItem(key) {
    this.map.delete(key);
  }

  clear() {
    this.map.clear();
  }
}

globalThis.localStorage = new MemoryStorage();

assert.deepEqual(chapterCandidates(7), ["7.html", "07.html", "007.html", "0007.html"]);
assert.deepEqual(chapterCandidates(0), ["0.html", "00.html", "000.html", "0000.html"]);
assert.equal(bookUrl("hellfire"), "./book.html?id=hellfire");
assert.equal(bookUrl("train", 3), "./book.html?id=train&chapter=3");
assert.equal(getBookIdFromLocation({ search: "?id=digitalfever", pathname: "/book.html" }), "digitalfever");
assert.equal(getBookIdFromLocation({ search: "?id=train", pathname: "/book" }), "train");
assert.equal(getBookIdFromLocation({ search: "", pathname: "/book/mondschein" }), "mondschein");
assert.equal(mix("#000000", "#ffffff", 0.5), "#808080");
assert.equal(adjustHex("#202124", 0.15), "#46474a");
assert.equal(adjustHex("#ffffff", -0.15), "#d9d9d9");
const serveConfig = JSON.parse(readFileSync(new URL("../serve.json", import.meta.url), "utf8"));
assert.equal(serveConfig.cleanUrls, false);
assert.equal(serveConfig.directoryListing, false);
assert.deepEqual(serveConfig.rewrites, [{ source: "/", destination: "/index.html" }]);

const slider = { getBoundingClientRect: () => ({ left: 100, width: 200 }) };
assert.equal(getSliderPercent(slider, { clientX: 150 }), 0.25);
assert.equal(getSliderPercent(slider, { clientX: 20 }), 0);
assert.equal(getSliderPercent(slider, { clientX: 360 }), 1);
assert.equal(isPrimarySliderPointer({ button: 0 }), true);
assert.equal(isPrimarySliderPointer({ button: 2 }), false);
assert.deepEqual(STANDARD_THEMES.light, { bg: "#f7f8f4", text: "#242424" });
assert.equal(
  audioTrackId({ chapter: 15, src: ["media/audio/burial.mp3"] }, "./books/mondschein/media/audio/burial.mp3"),
  "15:./books/mondschein/media/audio/burial.mp3"
);

const OriginalAudio = globalThis.Audio;
globalThis.Audio = class {
  constructor(src) {
    this.src = src;
    this.paused = true;
    this.currentTime = 0;
    this.duration = Number.NaN;
    this.seekable = { length: 0 };
  }

  addEventListener() {}

  play() {
    this.paused = false;
    return Promise.resolve();
  }

  pause() {
    this.paused = true;
  }
};
const registerController = new AudioController({ bookId: "demo" });
const firstTrack = registerController.register({ chapter: 3, src: ["media/audio/theme.mp3"], title: "Artist — Theme" });
const secondTrack = registerController.register({ chapter: 3, src: ["media/audio/theme.mp3"], title: "Artist — Theme" });
assert.equal(firstTrack, secondTrack);
assert.equal(registerController.tracks.length, 1);
globalThis.Audio = OriginalAudio;

const seekEvents = [];
const fakeAudio = {
  paused: false,
  duration: 100,
  currentTime: 0,
  seekable: { length: 0 },
  pause() {
    seekEvents.push("pause");
    this.paused = true;
  },
  play() {
    seekEvents.push("play");
    this.paused = false;
    return Promise.resolve();
  }
};
const seekController = Object.create(AudioController.prototype);
let settleCalls = 0;
seekController.updateGlobalState = () => {};
seekController.setAudioCurrentTime = (audio, target) => {
  seekEvents.push(`set:${target}`);
  audio.currentTime = target;
};
seekController.canSeekTo = () => false;
seekController.settleSeek = async () => {
  settleCalls += 1;
  return settleCalls > 1;
};
seekController.ensureSeekableSource = async (track) => {
  seekEvents.push(`fallback-paused:${track.audio.paused}`);
};
const fakeTrack = {
  audio: fakeAudio,
  pendingSeekPercent: 0.75,
  visualSeekTime: null,
  resumeAfterSeek: false,
  seekVersion: 1
};
await seekController.seekTrack(fakeTrack);
assert.deepEqual(seekEvents, ["pause", "set:75", "fallback-paused:true", "set:75", "play"]);
assert.equal(fakeTrack.visualSeekTime, null);
assert.equal(fakeTrack.resumeAfterSeek, false);

const cancelSeekEvents = [];
const cancelAudio = {
  ...fakeAudio,
  paused: false,
  currentTime: 0,
  pause() {
    cancelSeekEvents.push("pause");
    this.paused = true;
  },
  play() {
    cancelSeekEvents.push("play");
    this.paused = false;
    return Promise.resolve();
  }
};
let cancelSettleCalls = 0;
const cancelSeekController = Object.create(AudioController.prototype);
cancelSeekController.updateGlobalState = () => {};
cancelSeekController.setAudioCurrentTime = (audio, target) => {
  cancelSeekEvents.push(`set:${target}`);
  audio.currentTime = target;
};
cancelSeekController.canSeekTo = () => false;
cancelSeekController.settleSeek = async () => {
  cancelSettleCalls += 1;
  return cancelSettleCalls > 1;
};
cancelSeekController.ensureSeekableSource = async (track) => {
  cancelSeekEvents.push(`fallback-paused:${track.audio.paused}`);
  track.resumeAfterSeek = false;
};
const cancelTrack = {
  audio: cancelAudio,
  pendingSeekPercent: 0.75,
  visualSeekTime: null,
  resumeAfterSeek: false,
  seekVersion: 1
};
await cancelSeekController.seekTrack(cancelTrack);
assert.deepEqual(cancelSeekEvents, ["pause", "set:75", "fallback-paused:true", "set:75"]);
assert.equal(cancelTrack.visualSeekTime, null);
assert.equal(cancelTrack.resumeAfterSeek, false);

localStorage.clear();
localStorage.setItem("readerSettings", JSON.stringify({ fontSize: 99, textWidth: 10, lineHeight: 9 }));
assert.deepEqual(loadReaderSettings().value, {
  fontFamily: "Lato",
  fontSize: 24,
  textWidth: 400,
  lineHeight: 2.4,
  lastChapter: 1
});
localStorage.setItem("readerSettings", JSON.stringify({
  fontFamily: "Whitney",
  fontSize: 21,
  textWidth: 900,
  lineHeight: 1.8,
  lastChapter: 16,
  experimental: "keep"
}));
assert.equal(getLegacyLastChapter(loadReaderSettings().raw), 16);
assert.equal(getLegacyLastChapter({ lastChapter: 1 }), null);
saveReaderSettings({ fontSize: 20 });
assert.deepEqual(JSON.parse(localStorage.getItem("readerSettings")), {
  fontFamily: "Whitney",
  fontSize: 20,
  textWidth: 900,
  lineHeight: 1.8,
  lastChapter: 16,
  experimental: "keep"
});

localStorage.setItem("themePreset", JSON.stringify("light"));
localStorage.setItem("themeColors", JSON.stringify({ bg: "#ffffff", text: "#000000" }));
assert.deepEqual(loadTheme().value, {
  preset: "light",
  colors: STANDARD_THEMES.light
});
localStorage.setItem("themePreset", JSON.stringify("custom"));
localStorage.setItem("themeColors", JSON.stringify({ bg: "#123456", text: "#abcdef" }));
assert.deepEqual(loadTheme().value, {
  preset: "custom",
  colors: { bg: "#123456", text: "#abcdef" }
});
localStorage.setItem("themePreset", JSON.stringify("custom"));
localStorage.setItem("themeColors", JSON.stringify({ bg: "tomato", text: "#abc" }));
assert.deepEqual(loadTheme().value, {
  preset: "custom",
  colors: { bg: "#202124", text: "#abc" }
});

saveBookProgress("mondschein", { chapter: 12, scrollPercent: 47.4, timestamp: 123 });
assert.deepEqual(loadReadingProgress().value.mondschein, {
  chapter: 12,
  scrollPercent: 47,
  timestamp: 123
});
localStorage.setItem("readingProgress", JSON.stringify({
  mondschein: { chapter: 16, scrollPercent: 105, timestamp: 456 },
  broken: { chapter: "nope", scrollPercent: 50, timestamp: 1 }
}));
assert.deepEqual(loadReadingProgress().value, {
  mondschein: { chapter: 16, scrollPercent: 100, timestamp: 456 }
});

localStorage.setItem("ageGateConfirmed", JSON.stringify(true));
localStorage.setItem("ageGateConfirmedTimestamp", JSON.stringify(Date.now()));
assert.equal(loadAgeGate().value.confirmed, true);
localStorage.setItem("ageGateConfirmedTimestamp", JSON.stringify(Date.now() - 25 * 60 * 60 * 1000));
assert.equal(loadAgeGate().value.confirmed, false);
saveAgeGateConfirmed();
assert.equal(JSON.parse(localStorage.getItem("ageGateConfirmed")), true);
assert.equal(Number.isFinite(JSON.parse(localStorage.getItem("ageGateConfirmedTimestamp"))), true);

const indexHtml = readFileSync(new URL("../index.html", import.meta.url), "utf8");
const bookHtml = readFileSync(new URL("../book.html", import.meta.url), "utf8");
for (const html of [indexHtml, bookHtml]) {
  assert.ok(html.includes('light: { bg: "#f7f8f4", text: "#242424" }'), "Expected early theme bootstrap to use remaster light colors");
  assert.ok(html.includes('safePreset === "custom"'), "Expected early theme bootstrap to treat custom colors separately");
}

const existing = new Set([
  "./books/demo/chapters/00.html",
  "./books/demo/chapters/7.html",
  "./books/demo/chapters/08.html"
]);

globalThis.fetch = async (url) => ({
  ok: existing.has(url),
  status: existing.has(url) ? 200 : 404,
  json: async () => ({}),
  text: async () => ""
});

const resolver = new ChapterResolver("demo", { totalChapters: 8, hasPreface: false });
await resolver.resolve();
assert.equal(resolver.getFile(0), "00.html");
assert.equal(resolver.getFile(7), "7.html");
assert.equal(resolver.getFile(8), "08.html");
assert.equal(resolver.chapters.length, 3);

const paddedExisting = new Set([
  "./books/padded/chapters/00.html",
  "./books/padded/chapters/01.html",
  "./books/padded/chapters/02.html"
]);
const paddedRequests = [];
globalThis.fetch = async (url) => {
  paddedRequests.push(url);
  return {
    ok: paddedExisting.has(url),
    status: paddedExisting.has(url) ? 200 : 404,
    json: async () => ({}),
    text: async () => ""
  };
};

const paddedResolver = new ChapterResolver("padded", { totalChapters: 2 });
await paddedResolver.resolve();
assert.equal(paddedResolver.getFile(1), "01.html");
assert.equal(paddedResolver.getFile(2), "02.html");
assert.ok(!paddedRequests.includes("./books/padded/chapters/1.html"));

const lazyExisting = new Set(["./books/lazy/chapters/15.html"]);
const lazyRequests = [];
globalThis.fetch = async (url, options = {}) => {
  lazyRequests.push({ url, method: options.method || "GET" });
  return {
    ok: lazyExisting.has(url),
    status: lazyExisting.has(url) ? 200 : 404,
    json: async () => ({}),
    text: async () => ""
  };
};

const lazyResolver = new ChapterResolver("lazy", { totalChapters: 40 });
const lazyChapter = await lazyResolver.resolveNumber(15);
assert.equal(lazyChapter.number, 15);
assert.deepEqual(lazyResolver.chapters.map((chapter) => chapter.number), [15]);
assert.equal(lazyResolver.resolvedAll, false);
assert.ok(lazyRequests.every((request) => request.url.includes("/15.html")));

console.log("Unit checks passed.");
