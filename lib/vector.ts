import { Index } from '@upstash/vector';

// Lazy singleton -- only initialised if env vars are present.
// The Upstash Vector index must be created with a built-in embedding model
// (e.g. bge-base-en-v1.5) so that upsert/query accept raw `data` strings.
let _index: Index | null = null;

export function getVectorIndex(): Index | null {
  if (_index) return _index;
  const url   = process.env.UPSTASH_VECTOR_REST_URL;
  const token = process.env.UPSTASH_VECTOR_REST_TOKEN;
  if (!url || !token) return null;
  _index = new Index({ url, token });
  return _index;
}

/** Text we embed for each course -- title + tagline + description + outcomes */
export function buildCourseEmbedText(config: any, title: string): string {
  const outcomes = (config?.learnOutcomes ?? []).join('. ');
  return [
    title,
    config?.tagline ?? '',
    config?.description ?? '',
    outcomes,
  ].filter(Boolean).join(' ').slice(0, 2000); // Upstash limit
}
