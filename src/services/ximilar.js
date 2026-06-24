import axios from 'axios';
import { XIMILAR_BASE_URL } from '../utils/constants';

function getHeaders() {
  const token = process.env.EXPO_PUBLIC_XIMILAR_API_TOKEN;
  if (!token) throw new Error('EXPO_PUBLIC_XIMILAR_API_TOKEN is not set');
  return { Authorization: `Token ${token}`, 'Content-Type': 'application/json' };
}

// Identify a card from a base64-encoded image (or a public URL)
export async function identifyCard(imageBase64OrUrl) {
  const payload = {
    records: [
      imageBase64OrUrl.startsWith('http')
        ? { _url: imageBase64OrUrl }
        : { _base64: imageBase64OrUrl },
    ],
  };

  const res = await axios.post(`${XIMILAR_BASE_URL}/tcg_id`, payload, { headers: getHeaders() });
  return parseIdentifyResponse(res.data);
}

// Assess condition from a base64-encoded front image
export async function assessCondition(imageBase64OrUrl) {
  const payload = {
    records: [
      imageBase64OrUrl.startsWith('http')
        ? { _url: imageBase64OrUrl }
        : { _base64: imageBase64OrUrl },
    ],
  };

  const res = await axios.post(`${XIMILAR_BASE_URL}/condition`, payload, { headers: getHeaders() });
  return parseConditionResponse(res.data);
}

// Full grading (corners/edges/surface/centering) — use for high-value or listing analysis
export async function gradeCard(imageBase64OrUrl) {
  const payload = {
    records: [
      imageBase64OrUrl.startsWith('http')
        ? { _url: imageBase64OrUrl }
        : { _base64: imageBase64OrUrl },
    ],
  };

  const res = await axios.post(`${XIMILAR_BASE_URL}/grade`, payload, { headers: getHeaders() });
  return res.data;
}

function parseIdentifyResponse(data) {
  if (!data?.records?.length) return null;

  const record = data.records[0];
  const best = record?.best_match;
  const alternatives = record?.matches?.slice(0, 3) ?? [];

  if (!best) return null;

  return {
    confidence: best.prob ?? best.score ?? 0,
    card: normalizeXimilarCard(best),
    alternatives: alternatives.map(normalizeXimilarCard),
    raw: record,
  };
}

function normalizeXimilarCard(match) {
  if (!match) return null;
  return {
    ximilar_id: match.id ?? match._id ?? '',
    game: detectGame(match),
    name: match.name ?? match.card_name ?? '',
    set_name: match.set ?? match.set_name ?? '',
    set_code: match.set_code ?? match.set_id ?? '',
    card_number: match.card_number ?? match.number ?? '',
    rarity: match.rarity ?? '',
    variant: match.variant ?? match.foil ?? '',
    language: match.language ?? 'en',
    image_url: match.image_url ?? match._url ?? '',
    is_graded_slab: !!(match.graded ?? match.is_slab),
    confidence: match.prob ?? match.score ?? 0,
  };
}

function detectGame(match) {
  const name = (match.game ?? match.tcg ?? match.set ?? '').toLowerCase();
  if (name.includes('one piece') || name.includes('op')) return 'one_piece';
  return 'pokemon';
}

function parseConditionResponse(data) {
  if (!data?.records?.length) return null;
  const record = data.records[0];
  return {
    condition: record?.condition ?? record?.best_label ?? 'NM',
    confidence: record?.prob ?? record?.score ?? 0,
    raw: record,
  };
}
