// src/routes/+layout.server.ts
import { getChapters } from '$lib/utils/getChapters';

export async function load() {
  return { chapters: getChapters() };
}