import { CONDITION_MULTIPLIERS, PRICE_FRESHNESS_MS, VERDICT_THRESHOLDS } from './constants';

export function conditionAdjust(nmPrice, fromCondition, toCondition = 'NM') {
  if (!nmPrice || !fromCondition) return nmPrice;
  const fromMult = CONDITION_MULTIPLIERS[fromCondition] ?? 1;
  const toMult = CONDITION_MULTIPLIERS[toCondition] ?? 1;
  return nmPrice * (toMult / fromMult);
}

export function normalizePriceToNM(price, condition) {
  const mult = CONDITION_MULTIPLIERS[condition] ?? 1;
  return mult === 0 ? price : price / mult;
}

// Weights for consensus: sold comps highest, then market, then active asks
const SOURCE_WEIGHTS = {
  ebay_sold_median: 3,
  tcgplayer_market: 2,
  justtcg: 2,
  ebay_active_low: 1,
  pricecharting_graded: 2,
};

export function computeConsensus(priceRecords) {
  if (!priceRecords?.length) return null;

  const valid = priceRecords.filter(p => p.value > 0);
  if (!valid.length) return null;

  let weightedSum = 0;
  let totalWeight = 0;
  const values = valid.map(p => p.value);

  for (const p of valid) {
    const w = SOURCE_WEIGHTS[p.source] ?? 1;
    weightedSum += p.value * w;
    totalWeight += w;
  }

  const fairValue = weightedSum / totalWeight;
  const low = Math.min(...values);
  const high = Math.max(...values);

  return { fairValue, low, high, sources: valid };
}

export function isPriceFresh(fetchedAt) {
  if (!fetchedAt) return false;
  return Date.now() - new Date(fetchedAt).getTime() < PRICE_FRESHNESS_MS;
}

export function computeVerdict(askingPrice, fairValue, shipping = 0, sellingFees = 0.13, config = {}) {
  if (!askingPrice || !fairValue) return null;

  const goodBuyThreshold = config.goodBuyMargin ?? VERDICT_THRESHOLDS.GOOD_BUY_MARGIN;
  const fairMinThreshold = config.fairMinMargin ?? VERDICT_THRESHOLDS.FAIR_MIN_MARGIN;

  const effectiveCost = askingPrice + shipping;
  const expectedResale = fairValue * (1 - sellingFees) - shipping;
  const margin = (expectedResale - effectiveCost) / effectiveCost;

  let verdict;
  if (margin >= goodBuyThreshold) verdict = 'GOOD_BUY';
  else if (margin >= fairMinThreshold) verdict = 'FAIR';
  else verdict = 'OVERPRICED';

  return {
    effectiveCost,
    expectedResale: Math.max(0, expectedResale),
    margin,
    marginPercent: Math.round(margin * 100),
    verdict,
  };
}

export function formatPrice(value, currency = 'USD') {
  if (value == null) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
}

export function formatFreshness(fetchedAt) {
  if (!fetchedAt) return 'never';
  const diffMs = Date.now() - new Date(fetchedAt).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}
