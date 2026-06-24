export const XIMILAR_BASE_URL = 'https://api.ximilar.com/collectibles/v2';

export const CONDITION_LABELS = {
  NM: 'Near Mint',
  LP: 'Lightly Played',
  MP: 'Moderately Played',
  HP: 'Heavily Played',
  DMG: 'Damaged',
};

// Condition multipliers relative to NM (1.0)
export const CONDITION_MULTIPLIERS = {
  NM: 1.0,
  LP: 0.8,
  MP: 0.64,
  HP: 0.4,
  DMG: 0.25,
};

export const PRICE_SOURCES = {
  TCGPLAYER_MARKET: 'tcgplayer_market',
  EBAY_SOLD_MEDIAN: 'ebay_sold_median',
  EBAY_ACTIVE_LOW: 'ebay_active_low',
  PRICECHARTING_GRADED: 'pricecharting_graded',
  JUSTTCG: 'justtcg',
};

export const PRICE_SOURCE_LABELS = {
  tcgplayer_market: 'TCGplayer Market',
  ebay_sold_median: 'eBay Sold (median)',
  ebay_active_low: 'eBay Active (low)',
  pricecharting_graded: 'PriceCharting Graded',
  justtcg: 'JustTCG',
};

export const PRICE_FRESHNESS_MS = 30 * 60 * 1000; // 30 min cache

export const VERDICT_THRESHOLDS = {
  GOOD_BUY_MARGIN: 0.2,   // ≥20% upside = Good Buy
  FAIR_MIN_MARGIN: -0.05, // within -5% = Fair
  // below -5% = Overpriced
};

export const SUPPORTED_GAMES = ['pokemon', 'one_piece'];
