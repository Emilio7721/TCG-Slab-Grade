import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  TextInput, Alert, ActivityIndicator,
} from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { getDatabase, upsertCard, insertScan, insertHolding, upsertPrice } from '../db/database';
import { fetchAllPrices } from '../services/pricing';
import { computeConsensus, formatPrice, formatFreshness } from '../utils/priceUtils';
import { CONDITION_LABELS, PRICE_SOURCE_LABELS } from '../utils/constants';

export default function ScanConfirmScreen({ navigation }) {
  const { scanResult, scanCondition, scanPhotos, clearScanPhotos } = useAppStore();
  const [selectedCard, setSelectedCard] = useState(scanResult?.card ?? null);
  const [condition, setCondition] = useState(scanCondition ?? 'NM');
  const [acquisitionCost, setAcquisitionCost] = useState('');
  const [prices, setPrices] = useState([]);
  const [loadingPrices, setLoadingPrices] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selectedCard) loadPrices(selectedCard, condition);
  }, [selectedCard]);

  async function loadPrices(card, cond) {
    setLoadingPrices(true);
    try {
      const fetched = await fetchAllPrices(card, cond);
      setPrices(fetched);
    } catch { /* pricing is non-critical */ }
    finally { setLoadingPrices(false); }
  }

  const consensus = computeConsensus(prices);

  async function saveToCollection() {
    if (!selectedCard) return;
    setSaving(true);
    try {
      const db = await getDatabase();
      const cardId = await upsertCard(db, selectedCard);
      const scanId = await insertScan(db, {
        card_id: cardId,
        photo_uris: scanPhotos,
        ximilar_confidence: scanResult?.confidence ?? 0,
        detected_condition: condition,
        raw_ximilar_response: scanResult?.raw ?? {},
      });
      await insertHolding(db, {
        card_id: cardId,
        scan_id: scanId,
        condition,
        quantity: 1,
        acquisition_cost: parseFloat(acquisitionCost) || null,
      });

      for (const p of prices) {
        await upsertPrice(db, { ...p, card_id: cardId });
      }

      clearScanPhotos();
      Alert.alert('Saved!', `${selectedCard.name} added to your collection.`, [
        { text: 'View Portfolio', onPress: () => navigation.navigate('PortfolioTab') },
        { text: 'Scan Another', onPress: () => navigation.navigate('ScanCamera') },
      ]);
    } catch (err) {
      Alert.alert('Error saving', err.message);
    } finally {
      setSaving(false);
    }
  }

  if (!selectedCard) {
    return (
      <View style={s.center}>
        <Text style={s.empty}>No scan result. Go back and scan a card.</Text>
        <TouchableOpacity style={s.btn} onPress={() => navigation.goBack()}>
          <Text style={s.btnText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const alternatives = scanResult?.alternatives?.filter(a => a && a.name !== selectedCard.name) ?? [];
  const confidencePct = Math.round((scanResult?.confidence ?? 0) * 100);

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Card identity */}
      <View style={s.card}>
        {selectedCard.image_url ? (
          <Image source={{ uri: selectedCard.image_url }} style={s.cardImg} resizeMode="contain" />
        ) : (
          <View style={s.cardImgPlaceholder}><Text style={s.placeholderText}>🃏</Text></View>
        )}
        <View style={s.cardInfo}>
          <Text style={s.cardName}>{selectedCard.name}</Text>
          <Text style={s.cardMeta}>{selectedCard.set_name} · #{selectedCard.card_number}</Text>
          {selectedCard.rarity ? <Text style={s.cardMeta}>{selectedCard.rarity}</Text> : null}
          {selectedCard.variant ? <Text style={s.cardMeta}>Variant: {selectedCard.variant}</Text> : null}
          <Text style={s.cardMeta}>Lang: {selectedCard.language?.toUpperCase()}</Text>
          <View style={[s.badge, confidencePct >= 80 ? s.badgeGreen : s.badgeYellow]}>
            <Text style={s.badgeText}>{confidencePct}% confident</Text>
          </View>
        </View>
      </View>

      {/* Alternatives */}
      {alternatives.length > 0 && (
        <View style={s.section}>
          <Text style={s.sectionTitle}>Not the right card?</Text>
          {alternatives.map((alt, i) => (
            <TouchableOpacity key={i} style={s.altRow} onPress={() => setSelectedCard(alt)}>
              <Text style={s.altText}>{alt.name} · {alt.set_name} #{alt.card_number}</Text>
              <Text style={s.altConf}>{Math.round(alt.confidence * 100)}%</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}

      {/* Condition */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Condition</Text>
        <View style={s.condRow}>
          {Object.keys(CONDITION_LABELS).map(c => (
            <TouchableOpacity
              key={c}
              style={[s.condBtn, condition === c && s.condBtnActive]}
              onPress={() => { setCondition(c); loadPrices(selectedCard, c); }}
            >
              <Text style={[s.condBtnText, condition === c && s.condBtnTextActive]}>{c}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <Text style={s.condLabel}>{CONDITION_LABELS[condition]}</Text>
      </View>

      {/* Prices */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>Market Prices ({condition})</Text>
        {loadingPrices
          ? <ActivityIndicator color="#3B82F6" style={{ marginTop: 8 }} />
          : prices.length === 0
            ? <Text style={s.empty}>No price data available (add API keys in Settings)</Text>
            : (
              <>
                {consensus && (
                  <View style={s.consensus}>
                    <Text style={s.consensusLabel}>Fair Value</Text>
                    <Text style={s.consensusValue}>{formatPrice(consensus.fairValue)}</Text>
                    <Text style={s.consensusRange}>Range: {formatPrice(consensus.low)} – {formatPrice(consensus.high)}</Text>
                  </View>
                )}
                {prices.map((p, i) => (
                  <View key={i} style={s.priceRow}>
                    <Text style={s.priceSource}>{PRICE_SOURCE_LABELS[p.source] ?? p.source}</Text>
                    <Text style={s.priceValue}>{formatPrice(p.value)}</Text>
                  </View>
                ))}
              </>
            )
        }
      </View>

      {/* Acquisition cost */}
      <View style={s.section}>
        <Text style={s.sectionTitle}>What did you pay? (optional)</Text>
        <TextInput
          style={s.input}
          value={acquisitionCost}
          onChangeText={setAcquisitionCost}
          placeholder="e.g. 12.50"
          placeholderTextColor="#475569"
          keyboardType="decimal-pad"
        />
      </View>

      {/* Actions */}
      <View style={s.actionRow}>
        {consensus && (
          <TouchableOpacity
            style={s.btnSecondary}
            onPress={() => navigation.navigate('BuyDecision', {
              card: selectedCard,
              condition,
              fairValue: consensus.fairValue,
            })}
          >
            <Text style={s.btnSecondaryText}>Buy Decision</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity style={s.btnPrimary} onPress={saveToCollection} disabled={saving}>
          {saving
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Save to Collection</Text>}
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 16, paddingBottom: 40 },
  center: { flex: 1, backgroundColor: '#0F172A', alignItems: 'center', justifyContent: 'center', padding: 20 },
  card: { flexDirection: 'row', gap: 12, backgroundColor: '#1E293B', borderRadius: 12, padding: 12, marginBottom: 16 },
  cardImg: { width: 80, height: 112, borderRadius: 6 },
  cardImgPlaceholder: { width: 80, height: 112, borderRadius: 6, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  placeholderText: { fontSize: 32 },
  cardInfo: { flex: 1, justifyContent: 'center' },
  cardName: { color: '#F8FAFC', fontSize: 16, fontWeight: '700', marginBottom: 4 },
  cardMeta: { color: '#94A3B8', fontSize: 12, marginBottom: 2 },
  badge: { marginTop: 6, alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeGreen: { backgroundColor: '#14532D' },
  badgeYellow: { backgroundColor: '#713F12' },
  badgeText: { color: '#F8FAFC', fontSize: 11, fontWeight: '600' },
  section: { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 12 },
  sectionTitle: { color: '#CBD5E1', fontSize: 13, fontWeight: '600', marginBottom: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  altRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#334155' },
  altText: { color: '#94A3B8', fontSize: 13, flex: 1 },
  altConf: { color: '#3B82F6', fontSize: 13, fontWeight: '700' },
  condRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  condBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, backgroundColor: '#334155' },
  condBtnActive: { backgroundColor: '#3B82F6' },
  condBtnText: { color: '#94A3B8', fontWeight: '600', fontSize: 13 },
  condBtnTextActive: { color: '#fff' },
  condLabel: { color: '#64748B', fontSize: 12, marginTop: 6 },
  consensus: { backgroundColor: '#172554', borderRadius: 8, padding: 12, marginBottom: 10 },
  consensusLabel: { color: '#93C5FD', fontSize: 12, fontWeight: '600', textTransform: 'uppercase' },
  consensusValue: { color: '#DBEAFE', fontSize: 28, fontWeight: '800', marginTop: 2 },
  consensusRange: { color: '#93C5FD', fontSize: 12, marginTop: 2 },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderTopWidth: 1, borderTopColor: '#334155' },
  priceSource: { color: '#94A3B8', fontSize: 13 },
  priceValue: { color: '#F8FAFC', fontSize: 13, fontWeight: '600' },
  input: { backgroundColor: '#0F172A', color: '#F8FAFC', borderRadius: 8, padding: 10, fontSize: 15 },
  actionRow: { flexDirection: 'row', gap: 10, marginTop: 4 },
  btnPrimary: { flex: 1, backgroundColor: '#3B82F6', borderRadius: 10, padding: 14, alignItems: 'center' },
  btnSecondary: { backgroundColor: '#1E293B', borderRadius: 10, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#334155', flex: 1 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnSecondaryText: { color: '#94A3B8', fontWeight: '700', fontSize: 15 },
  empty: { color: '#475569', fontSize: 13, textAlign: 'center' },
  btn: { backgroundColor: '#3B82F6', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8, marginTop: 12 },
});
