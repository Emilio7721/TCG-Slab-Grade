import axios from 'axios';
import { PRICE_SOURCES } from '../utils/constants';

// ── JustTCG ──────────────────────────────────────────────────────────────────
export async function fetchJustTCGPrice(card, condition = 'NM') {
  const apiKey = process.env.EXPO_PUBLIC_JUSTTCG_API_KEY;
  if (!apiKey) return null;

  try {
    const res = await axios.get('https://api.justtcg.com/v1/prices', {
      headers: { 'x-api-key': apiKey },
      params: {
        game: card.game === 'one_piece' ? 'onepiece' : 'pokemon',
        set_code: card.set_code,
        card_number: card.card_number,
        condition,
      },
      timeout: 8000,
    });

    const data = res.data;
    if (!data) return null;

    return {
      source: PRICE_SOURCES.JUSTTCG,
      condition,
      value: data.market_price ?? data.price ?? 0,
      low: data.low_price ?? null,
      high: data.high_price ?? null,
      currency: 'USD',
    };
  } catch {
    return null;
  }
}

// ── eBay Browse API (active listings) ────────────────────────────────────────
let ebayToken = null;
let ebayTokenExpiry = 0;

async function getEbayAccessToken() {
  if (ebayToken && Date.now() < ebayTokenExpiry) return ebayToken;

  const clientId = process.env.EXPO_PUBLIC_EBAY_CLIENT_ID;
  const clientSecret = process.env.EXPO_PUBLIC_EBAY_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;

  const credentials = btoa(`${clientId}:${clientSecret}`);
  const res = await axios.post(
    'https://api.ebay.com/identity/v1/oauth2/token',
    'grant_type=client_credentials&scope=https%3A%2F%2Fapi.ebay.com%2Foauth%2Fapi_scope',
    {
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    }
  );

  ebayToken = res.data.access_token;
  ebayTokenExpiry = Date.now() + res.data.expires_in * 1000 - 60000;
  return ebayToken;
}

export async function fetchEbayActiveListings(card, condition = 'NM') {
  try {
    const token = await getEbayAccessToken();
    if (!token) return null;

    const query = buildEbayQuery(card, condition);
    const res = await axios.get('https://api.ebay.com/buy/browse/v1/item_summary/search', {
      headers: { Authorization: `Bearer ${token}` },
      params: {
        q: query,
        category_ids: '2536',
        limit: 10,
        sort: 'price',
      },
      timeout: 8000,
    });

    const items = res.data?.itemSummaries ?? [];
    if (!items.length) return null;

    const prices = items
      .map(i => parseFloat(i.price?.value ?? '0'))
      .filter(p => p > 0)
      .sort((a, b) => a - b);

    return {
      source: PRICE_SOURCES.EBAY_ACTIVE_LOW,
      condition,
      value: prices[0],
      low: prices[0],
      high: prices[prices.length - 1],
      currency: 'USD',
    };
  } catch {
    return null;
  }
}

function buildEbayQuery(card, condition) {
  const parts = [card.name];
  if (card.set_name) parts.push(card.set_name);
  if (card.card_number) parts.push(`#${card.card_number}`);
  if (card.language && card.language !== 'en') parts.push(card.language);
  if (condition === 'NM') parts.push('Near Mint');
  return parts.join(' ');
}

// ── PriceCharting (graded / sealed) ──────────────────────────────────────────
export async function fetchPriceChartingPrice(card, gradeLevel = null) {
  const apiKey = process.env.EXPO_PUBLIC_PRICECHARTING_API_KEY;
  if (!apiKey) return null;

  try {
    const query = `${card.name} ${card.set_name ?? ''} ${card.card_number ?? ''}`.trim();
    const res = await axios.get('https://www.pricecharting.com/api/product', {
      params: { id: query, status: 'price', q: query },
      headers: { Authorization: `Token ${apiKey}` },
      timeout: 8000,
    });

    const data = res.data;
    if (!data?.id) return null;

    const value = gradeLevel ? data[`graded-${gradeLevel}-price`] : data['loose-price'];

    return {
      source: PRICE_SOURCES.PRICECHARTING_GRADED,
      condition: gradeLevel ? `PSA${gradeLevel}` : 'RAW',
      value: (value ?? 0) / 100,
      currency: 'USD',
    };
  } catch {
    return null;
  }
}

// ── Aggregate all sources ─────────────────────────────────────────────────────
export async function fetchAllPrices(card, condition = 'NM') {
  const results = await Promise.allSettled([
    fetchJustTCGPrice(card, condition),
    fetchEbayActiveListings(card, condition),
    card.is_graded_slab ? fetchPriceChartingPrice(card) : Promise.resolve(null),
  ]);

  return results
    .map(r => r.status === 'fulfilled' ? r.value : null)
    .filter(Boolean);
}
