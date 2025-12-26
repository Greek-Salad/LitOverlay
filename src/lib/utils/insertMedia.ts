import { JSDOM } from 'jsdom';

type MediaRule = {
  src: string[];
  chapter: number;
  before?: string;
  after?: string;
};

function createMediaElement(srcList: string[], document: Document): HTMLElement {
  const wrapper = document.createElement('p');
  wrapper.style.margin = '2rem 0';

  for (const src of srcList) {
    if (src.endsWith('.mp3') || src.endsWith('.wav')) {
      const audio = document.createElement('audio');
      audio.controls = true;
      audio.style.width = '100%';
      const source = document.createElement('source');
      source.src = src;
      source.type = src.endsWith('.mp3') ? 'audio/mpeg' : 'audio/wav';
      audio.appendChild(source);
      wrapper.appendChild(audio);
    } else if (src.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      const img = document.createElement('img');
      img.src = src;
      img.alt = 'Media';
      img.style.maxWidth = '100%';
      img.style.height = 'auto';
      img.style.borderRadius = '8px';
      img.style.margin = '0.5rem 0';
      wrapper.appendChild(img);
    }
  }

  return wrapper;
}

export function insertMediaIntoHtml(html: string, rules: MediaRule[]): string {
  if (!html.trim()) return html;

  // Обернём в <div>, чтобы JSDOM не ругался
  const dom = new JSDOM(`<div>${html}</div>`);
  const doc = dom.window.document;
  const root = doc.body.firstChild as HTMLElement;

  for (const rule of rules) {
    const paragraphs = root.querySelectorAll('p');
    for (const p of Array.from(paragraphs)) {
      const text = p.textContent?.trim() || '';

      if (rule.before && text.startsWith(rule.before)) {
        const mediaEl = createMediaElement(rule.src, doc);
        p.parentNode?.insertBefore(mediaEl, p);
      } else if (rule.after && text.startsWith(rule.after)) {
        const mediaEl = createMediaElement(rule.src, doc);
        p.parentNode?.insertBefore(mediaEl, p.nextSibling);
      }
    }
  }

  return root.innerHTML;
}