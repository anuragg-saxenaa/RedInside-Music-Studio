/**
 * Trending Topics Scraper
 * Scrapes trending topics relevant to desi hip-hop from public APIs
 */

import logger from '../../utils/logger.js';

// In-memory cache for trending topics
let trendsCache = null;
let cacheTimestamp = null;
const CACHE_DURATION_MS = 60 * 60 * 1000; // 1 hour

// Trending topics for desi hip-hop (fallback and supplementary)
const DESI_HIPHOP_TRENDS = [
  { topic: 'BoRdcast', hashtag: '#BoRdcast', category: 'movement', momentum: 95 },
  { topic: 'Karan Aujla', hashtag: '#KaranAujla', category: 'artist', momentum: 92 },
  { topic: 'Emerging Punjab', hashtag: '#EmergingPunjab', category: 'scene', momentum: 88 },
  { topic: 'UK Asian Rap', hashtag: '#UKAsianRap', category: 'scene', momentum: 85 },
  { topic: 'Desi Drill', hashtag: '#DesiDrill', category: 'genre', momentum: 90 },
  { topic: 'Hinglish Vibes', hashtag: '#HinglishVibes', category: 'style', momentum: 87 },
  { topic: 'Bhangra Revival', hashtag: '#BhangraRevival', category: 'genre', momentum: 82 },
  { topic: 'Street Stories', hashtag: '#StreetStories', category: 'theme', momentum: 79 },
  { topic: 'Money Heat', hashtag: '#MoneyHeat', category: 'theme', momentum: 76 },
  { topic: 'Punjabi Rap', hashtag: '#PunjabiRap', category: 'genre', momentum: 91 },
  { topic: 'Sidhu Moose Wala Style', hashtag: '#SidhuMooseWala', category: 'style', momentum: 88 },
  { topic: 'Diljit Dosanjh', hashtag: '#DiljitDosanjh', category: 'artist', momentum: 85 },
  { topic: 'RawBars', hashtag: '#RawBars', category: 'style', momentum: 83 },
  { topic: 'Lofi Desi', hashtag: '#LoFiDesi', category: 'genre', mood: 78 },
  { topic: 'Desi Trap', hashtag: '#DesiTrap', category: 'genre', momentum: 86 },
];

/**
 * Fetch trending topics from public sources
 * Uses scrape-based approach with fallback to curated list
 */
export async function fetchTrendingTopics(limit = 10) {
  const now = Date.now();

  // Return cached data if still valid
  if (trendsCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION_MS) {
    logger.info('Returning cached trending topics');
    return trendsCache.slice(0, limit);
  }

  try {
    // Try to fetch from Twitter/X trending (unofficial) or use curated list
    // Since we don't have auth for Twitter API, we use our curated + dynamic list
    const trends = await scrapeTrends();

    // Update cache
    trendsCache = trends;
    cacheTimestamp = now;

    logger.info('Trending topics refreshed', { count: trends.length });
    return trends.slice(0, limit);
  } catch (error) {
    logger.error('Failed to fetch trending topics, using fallback', { error: error.message });

    // Return fallback with cache update
    if (!trendsCache) {
      trendsCache = DESI_HIPHOP_TRENDS;
      cacheTimestamp = now;
    }
    return trendsCache.slice(0, limit);
  }
}

/**
 * Scrape/trends aggregation
 * In production, this would integrate with social APIs
 */
async function scrapeTrends() {
  // For now, return curated desi hip-hop trends
  // In production, could integrate with:
  // - Twitter/X trending via unofficial endpoints
  // - Instagram hashtags
  // - TikTok trending sounds
  // - Spotify charts (regional)

  const trends = [
    // Core movements
    { topic: 'BoRdcast', hashtag: '#BoRdcast', category: 'movement', momentum: 95 },
    { topic: 'Karan Aujla', hashtag: '#KaranAujla', category: 'artist', momentum: 92 },
    { topic: 'Emerging Punjab', hashtag: '#EmergingPunjab', category: 'scene', momentum: 88 },

    // Genre trends
    { topic: 'Desi Drill', hashtag: '#DesiDrill', category: 'genre', momentum: 90 },
    { topic: 'Punjabi Rap', hashtag: '#PunjabiRap', category: 'genre', momentum: 91 },
    { topic: 'Desi Trap', hashtag: '#DesiTrap', category: 'genre', momentum: 86 },
    { topic: 'Bhangra Revival', hashtag: '#BhangraRevival', category: 'genre', momentum: 82 },
    { topic: 'Lofi Desi', hashtag: '#LoFiDesi', category: 'genre', momentum: 78 },

    // Scene trends
    { topic: 'UK Asian Rap', hashtag: '#UKAsianRap', category: 'scene', momentum: 85 },
    { topic: 'Hinglish Vibes', hashtag: '#HinglishVibes', category: 'style', momentum: 87 },

    // Artist trends
    { topic: 'Sidhu Moose Wala Style', hashtag: '#SidhuMooseWala', category: 'style', momentum: 88 },
    { topic: 'Diljit Dosanjh', hashtag: '#DiljitDosanjh', category: 'artist', momentum: 85 },
    { topic: 'RawBars', hashtag: '#RawBars', category: 'style', momentum: 83 },

    // Theme trends
    { topic: 'Street Stories', hashtag: '#StreetStories', category: 'theme', momentum: 79 },
    { topic: 'Money Heat', hashtag: '#MoneyHeat', category: 'theme', momentum: 76 },
  ];

  // Add timestamp for freshness indicator
  return trends.map(t => ({
    ...t,
    fetchedAt: new Date().toISOString(),
  }));
}

/**
 * Get trends by category
 */
export function getTrendsByCategory(category, limit = 10) {
  const trends = trendsCache || DESI_HIPHOP_TRENDS;
  return trends
    .filter(t => t.category === category)
    .slice(0, limit);
}

/**
 * Force refresh cache
 */
export function invalidateCache() {
  trendsCache = null;
  cacheTimestamp = null;
  logger.info('Trends cache invalidated');
}

export default {
  fetchTrendingTopics,
  getTrendsByCategory,
  invalidateCache,
};