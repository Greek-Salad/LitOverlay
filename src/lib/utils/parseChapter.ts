// src/lib/utils/parseChapter.ts
import { JSDOM } from 'jsdom';
import type { MediaRule, ChapterBlock } from './types';

export function parseChapterOnServer(rawHtml: string, mediaRules: MediaRule[]): ChapterBlock[] {
	const blocks: ChapterBlock[] = [];

	// Используем JSDOM для парсинга на сервере
	const dom = new JSDOM(`<div>${rawHtml}</div>`);
	const doc = dom.window.document;
	const root = doc.body.firstChild as HTMLElement;
	const allBlocks = root.querySelectorAll('p, h2, h3, blockquote, hr, pre, ul, ol, li, div');
	const blockElements = Array.from(allBlocks).filter((el) => {
		const parent = el.parentElement;
		if (!parent || parent === root) return true;
		return !parent.matches('p, h2, h3, blockquote, hr, pre, ul, ol, li, div');
	});

	const beforeMap = new Map<string, MediaRule>();
	const afterMap = new Map<string, MediaRule>();

	for (const rule of mediaRules) {
		if (rule.before) beforeMap.set(rule.before, rule);
		if (rule.after) afterMap.set(rule.after, rule);
	}

	for (const el of blockElements) {
		const text = el.textContent?.trim() || '';
		const outerHTML = el.outerHTML;
		/*
		const textContent = el.textContent?.trim() || '';

		if (textContent === '' && !outerHTML.includes('<img') && !outerHTML.includes('<audio')) {
			const temp = new JSDOM(outerHTML);
			const allBr = temp.window.document.querySelectorAll('br');
			const allTextNodes = Array.from(temp.window.document.body.childNodes)
				.filter((node) => node.nodeType === 3)
				.every((node) => (node as Text).textContent?.trim() === '');

			if (allBr.length > 0 && allTextNodes) {
				continue;
			}
		}
		*/

		// Ищем правило "before": вставляем ДО параграфа, если подстрока найдена
		let beforeRule: MediaRule | undefined;
		for (const [needle, rule] of beforeMap.entries()) {
			if (text.includes(needle)) {
				beforeRule = rule;
				break;
			}
		}

		if (beforeRule) {
			for (const src of beforeRule.src) {
				if (src.match(/\.(mp3|wav)$/)) {
					blocks.push({ type: 'audio', src, title: beforeRule.title });
				} else {
					blocks.push({ type: 'image', src });
				}
			}
		}

		// Добавляем сам параграф
		blocks.push({ type: 'html', content: outerHTML });

		// Ищем правило "after": вставляем ПОСЛЕ параграфа, если подстрока найдена
		let afterRule: MediaRule | undefined;
		for (const [needle, rule] of afterMap.entries()) {
			if (text.includes(needle)) {
				afterRule = rule;
				break;
			}
		}

		if (afterRule) {
			for (const src of afterRule.src) {
				if (src.match(/\.(mp3|wav)$/)) {
					blocks.push({ type: 'audio', src, title: afterRule.title });
				} else {
					blocks.push({ type: 'image', src });
				}
			}
		}
	}

	return blocks;
}
