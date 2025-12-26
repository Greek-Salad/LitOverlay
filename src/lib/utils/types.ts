export type MediaRule = {
  src: string[];
  chapter: number;
  before?: string;
  after?: string;
  title?: string;
};

export type ChapterBlock =
  | { type: 'html'; content: string }
  | { type: 'audio'; src: string; title?: string }
  | { type: 'image'; src: string };