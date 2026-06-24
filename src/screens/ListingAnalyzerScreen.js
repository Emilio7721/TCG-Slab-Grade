import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  ActivityIndicator, Image, Alert,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { identifyCard, assessCondition } from '../services/ximilar';
import { fetchAllPrices } from '../services/pricing';
import { prepareImageForUpload } from '../services/imageUtils';
import { computeConsensus, computeVerdict, formatPrice } from '../utils/priceUtils';
import { getDatabase, upsertCard, insertListingAnalysis } from '../db/database';
import { CONDITION_LABELS, PRICE_SOURCE_LABELS } from '../utils/constants';

const VERDICTS = {
  GOOD_BUY: { label: 'Good Deal', color: '#22C55E', icon: '✅' },
  FAIR: { label: 'Fair Deal', color: '#FBBF24', icon: '⚖️' },
  OVERPRICED: { label: 'Bad Deal', color: '#EF4444', icon: '❌' },
};

export default function ListingAnalyzerScreen() {
  const [url, setUrl] = useState('');
  const [price, setPrice] = useState('');
  const [shipping, setShipping] = useState('0');
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);

  async function pickPhoto() {
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      quality: 0.9,
    });
    if (!res.canceled) {
      setPhotos(prev => [...prev, ...res.assets.map(a => a.uri)]);
    }
  }

  async function analyze() {
    const askingPrice = parseFloat(price);
    const shipCost = parseFloat(shipping) || 0;

    if (!photos.length && !url) {
      Alert.alert('Need input', 'Paste a listing URL or add photos from the listing.');
      return;
    }
    if (!askingPrice || askingPrice <= 0) {
      Alert.alert('Need price', 'Enter the listing price.');
      return;
    }

    setLoading(true);
    try {
      const imageBase64 = photos.length > 0
        ? await prepareImageForUpload(photos[0])
        : null;

      // Identify card and assess condition in parallel
      const [idResult, condResult] = await Promise.allSettled([
        imageBase64 ? identifyCard(imageBase64) : Promise.resolve(null),
        imageBase64 ? assessCondition(imageBase64) : Promise.resolve(null),
      ]);

      const card = idResult.status === 'fulfilled' ? idResult.value?.card : null;
      const condition = condResult.status === 'fulfilled' ? condResult.value?.condition : 'NM';

      if (!card) {
        Alert.alert('Card not identified', 'Could not identify the card from the photos. Try adding clearer images.');
        setLoading(false);
        return;
      }

      // Fetch market prices
      const prices = await fetchAllPrices(card, condition);
      const consensus = computeConsensus(prices);
      const verdict = consensus
        ? computeVerdict(askingPrice, consensus.fairValue, shipCost)
        : null;

      // Build reasoning
      const reasoning = buildReasoning(card, condition, askingPrice, shipCost, consensus, verdict);

      // Save to DB
      const db = await getDatabase();
      const cardId = await upsertCard(db, card);
      await insertListingAnalysis(db, {
        source_url: url,
        parsed_price: askingPrice,
        shipping: shipCost,
        assessed_condition: condition,
        fair_value: consensus?.fairValue ?? null,
        verdict: verdict?.verdict ?? '',
        reasoning,
        card_id: cardId,
      });

      setResult({ card, condition, askingPrice, shipCost, prices, consensus, verdict, reasoning });
    } catch (err) {
      Alert.alert('Analysis failed', err.message);
    } finally {
      setLoading(false);
    }
  }

  function buildReasoning(card, condition, asking, shipping, consensus, verdict) {
    const parts = [];
    if (card) parts.push(`Identified as: ${card.name} (${card.set_name} #${card.card_number})`);
    if (condition) parts.push(`Assessed condition: ${CONDITION_LABELS[condition] ?? condition}`);
    if (consensus) {
      parts.push(`Fair value at ${condition}: ${formatPrice(consensus.fairValue)} (range: ${formatPrice(consensus.low)}–${formatPrice(consensus.high)})`);
    }
    if (verdict) {
      parts.push(`Effective cost: ${formatPrice(verdict.effectiveCost)} | Expected resale: ${formatPrice(verdict.expectedResale)} | Margin: ${verdict.marginPercent}%`);
    }
    return parts.join('\n');
  }

  const v = result?.verdict ? VERDICTS[result.verdict.verdict] : null;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content} keyboardShouldPersistTaps="handled">
      <Text style={s.subtitle}>Paste a listing or add photos to assess the price and condition.</Text>

      <View style={s.section}>
        <Text style={s.label}>Listing URL (optional)</Text>
        <TextInput
          style={s.input}
          value={url}
          onChangeText={setUrl}
          placeholder="https://www.ebay.com/itm/..."
          placeholderTextColor="#475569"
          autoCapitalize="none"
          autoCorrect={false}
        />
      </View>

      <View style={s.section}>
        <Text style={s.label}>Listing Photos</Text>
        <TouchableOpacity style={s.addPhotoBtn} onPress={pickPhoto}>
          <Text style={s.addPhotoBtnText}>+ Add Photos from Listing</Text>
        </TouchableOpacity>
        {photos.length > 0 && (
          <ScrollView horizontal style={s.photoStrip}>
            {photos.map((uri, i) => (
              <TouchableOpacity key={i} onLongPress={() => setPhotos(p => p.filter((_, j) => j !== i))}>
                <Image source={{ uri }} style={s.photoThumb} />
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}
        <Text style={s.hint}>Long-press a photo to remove it.</Text>
      </View>

      <View style={s.section}>
        <Text style={s.label}>Listing Price ($)</Text>
        <TextInput
          style={s.input}
          value={price}
          onChangeText={setPrice}
          placeholder="e.g. 25.00"
          placeholderTextColor="#475569"
          keyboardType="decimal-pad"
        />
        <Text style={[s.label, { marginTop: 12 }]}>Shipping ($)</Text>
        <TextInput
          style={s.input}
          value={shipping}
          onChangeText={setShipping}
          placeholder="0.00"
          placeholderTextColor="#475569"
          keyboardType="decimal-pad"
        />
      </View>

      <TouchableOpacity style={s.analyzeBtn} onPress={analyze} disabled={loading}>
        {loading
          ? <ActivityIndicator color="#fff" />
          : <Text style={s.analyzeBtnText}>Analyze Listing</Text>}
      </TouchableOpacity>

      {result && (
        <>
          {/* Identified card */}
          <View style={s.resultSection}>
            <Text style={s.resultTitle}>Card Identified</Text>
            <Text style={s.resultCardName}>{result.card.name}</Text>
            <Text style={s.resultMeta}>{result.card.set_name} #{result.card.card_number}</Text>
            <Text style={s.resultMeta}>Assessed condition: {CONDITION_LABELS[result.condition] ?? result.condition}</Text>
          </View>

          {/* Verdict */}
          {v && (
            <View style={[s.verdictCard, { borderColor: v.color }]}>
              <Text style={s.verdictIcon}>{v.icon}</Text>
              <Text style={[s.verdictLabel, { color: v.color }]}>{v.label}</Text>
              <Text style={s.reasoning}>{result.reasoning}</Text>
            </View>
          )}

          {/* Price sources */}
          {result.prices.length > 0 && (
            <View style={s.resultSection}>
              <Text style={s.resultTitle}>Market Prices ({result.condition})</Text>
              {result.prices.map((p, i) => (
                <View key={i} style={s.priceRow}>
                  <Text style={s.priceSource}>{PRICE_SOURCE_LABELS[p.source] ?? p.source}</Text>
                  <Text style={s.priceValue}>{formatPrice(p.value)}</Text>
                </View>
              ))}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 16, paddingBottom: 40 },
  subtitle: { color: '#64748B', fontSize: 13, marginBottom: 14, lineHeight: 18 },
  section: { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 12 },
  label: { color: '#CBD5E1', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: '#0F172A', color: '#F8FAFC', borderRadius: 8, padding: 12, fontSize: 15 },
  hint: { color: '#475569', fontSize: 11, marginTop: 4 },
  addPhotoBtn: { backgroundColor: '#334155', borderRadius: 8, padding: 10, alignItems: 'center', marginBottom: 8 },
  addPhotoBtnText: { color: '#3B82F6', fontWeight: '600' },
  photoStrip: { flexDirection: 'row', marginBottom: 4 },
  photoThumb: { width: 56, height: 78, borderRadius: 4, marginRight: 6 },
  analyzeBtn: { backgroundColor: '#3B82F6', borderRadius: 10, padding: 14, alignItems: 'center', marginBottom: 14 },
  analyzeBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  resultSection: { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 12 },
  resultTitle: { color: '#CBD5E1', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 8 },
  resultCardName: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  resultMeta: { color: '#94A3B8', fontSize: 13, marginTop: 3 },
  verdictCard: { borderRadius: 12, borderWidth: 2, padding: 16, backgroundColor: '#1E293B', marginBottom: 12, alignItems: 'center' },
  verdictIcon: { fontSize: 32, marginBottom: 6 },
  verdictLabel: { fontSize: 22, fontWeight: '900', marginBottom: 10 },
  reasoning: { color: '#94A3B8', fontSize: 13, lineHeight: 20, textAlign: 'center' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#334155' },
  priceSource: { color: '#94A3B8', fontSize: 13 },
  priceValue: { color: '#F8FAFC', fontSize: 13, fontWeight: '700' },
});
