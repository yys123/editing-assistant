import { articleContentToStructuredMarkers } from './articleStructure'

export const ARTICLE_PARSE_CACHE_VERSION = 13

export function buildArticleParseSource(articleContent: string, articleParseContent?: string) {
  const sourceContent = articleParseContent?.trim() || articleContent
  return articleContentToStructuredMarkers(sourceContent)
}

export function hashArticleParseSource(source: string) {
  let hash = 0x811c9dc5
  for (let i = 0; i < source.length; i += 1) {
    hash ^= source.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}

export function getArticleParseCacheKey(articleContent: string, articleParseContent?: string) {
  return hashArticleParseSource(buildArticleParseSource(articleContent, articleParseContent))
}
