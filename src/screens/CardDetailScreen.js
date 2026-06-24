import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { getDatabase, getPricesForCard, deleteHolding } from '../db/database';
import { fetchAllPrices } from '../services/pricing';
import { upsertPrice } from '../db/database';
import { computeConsensus, formatPrice, formatFreshness } from '../utils/priceUtils';
import { CONDITION_LABELS, PRICE_SOURCE_LABELS } from '../utils/constants';

export default function CardDetailScreen({ route, navigation }) {
  const { holding } = route.params;
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { loadPrices(); }, []);

  async function loadPrices() {
    setLoading(true);
    const db = await getDatabase();
    const cached = await getPricesForCard(db, holding.card_id, holding.condition);
    setPrices(cached);
    setLoading(false);
  }

  async function refreshPrice() {
    setLoading(true);
    try {
      const fresh = await fetchAllPrices(holding, holding.condition);
      const db = await getDatabase();
      for (const p of fresh) {
        await upsertPrice(db, { ...p, card_id: holding.card_id });
      }
      await loadPrices();
    } finally {
      setLoading(false);
    }
  }

  function confirmDelete() {
    Alert.alert('Remove from collection?', `Remove ${holding.name} from your portfolio?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove', style: 'destructive',
        onPress: async () => {
          const db = await getDatabase();
          await deleteHolding(db, holding.id);
          navigation.goBack();
        },
      },
    ]);
  }

  const consensus = computeConsensus(prices);
  const gainLoss = consensus && holding.acquisition_cost
    ? consensus.fairValue - holding.acquisition_cost : null;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Card header */}
      <View style={s.header}>
        {holding.image_url
          ? <Image source={{ uri: holding.image_url }} style={s.img} resizeMode="contain" />
          : <View style={s.imgPlaceholder}><Text style={{ fontSize: 48 }}>🃏</Text></View>}
        <View style={s.headerInfo}>
          <Text style={s.name}>{holding.name}</Text>
          <Text style={s.meta}>{holding.set_name}</Text>
          <Text style={s.meta}>#{holding.card_number}{holding.rarity ? ` · ${holding.rarity}` : ''}</Text>
          {holding.variant ? <Text style={s.meta}>Variant: {holding.variant}</Text> : null}
          <Text style={s.meta}>Language: {holding.language?.toUpperCase()}</Text>
          <View style={s.condBadge}>
            <Text style={s.condBadgeText}>{CONDITION_LABELS[holding.condition] ?? holding.condition}</Text>
          </View>
        </View>
      </View>

      {/* Value summary */}
      {consensus && (
        <View style={s.valueCard}>
          <Text style={s.valueLabel}>Current Fair Value</Text>
          <Text style={s.valueAmount}>{formatPrice(consensus.fairValue)}</Text>
          <Text style={s.valueRange}>Range: {formatPrice(consensus.low)} – {formatPrice(consensus.high)}</Text>
          {holding.acquisition_cost && (
            <View style={s.gainRow}>
              <Text style={s.gainLabel}>Cost Basis: {formatPrice(holding.acquisition_cost)}</Text>
              <Text style={[s.gainValue, gainLoss >= 0 ? s.green : s.red]}>
                {gainLoss >= 0 ? '+' : ''}{formatPrice(gainLoss)}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Price breakdown */}
      <View style={s.section}>
        <View style={s.sectionHeader}>
          <Text style={s.sectionTitle}>Price Sources</Text>
          <TouchableOpacity onPress={refreshPrice}>
            <Text style={s.refreshLink}>Refresh</Text>
          </TouchableOpacity>
        </View>
        {loading
          ? <ActivityIndicator color="#3B82F6" />
          : prices.length === 0
            ? <Text style={s.empty}>No prices cached yet. Tap Refresh.</Text>
            : prices.map((p, i) => (
              <View key={i} style={s.priceRow}>
                <View>
                  <Text style={s.priceSource}>{PRICE_SOURCE_LABELS[p.source] ?? p.source}</Text>
                  <Text style={s.priceFresh}>{formatFreshness(p.fetched_at)}</Text>
                </View>
                <Text style={s.priceValue}>{formatPrice(p.value)}</Text>
              </View>
            ))
        }
      </View>

      {/* Actions */}
      <TouchableOpacity style={s.deleteBtn} onPress={confirmDelete}>
        <Text style={s.deleteBtnText}>Remove from Collection</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', gap: 16, marginBottom: 16 },
  img: { width: 120, height: 168, borderRadius: 8 },
  imgPlaceholder: { width: 120, height: 168, backgroundColor: '#1E293B', borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  headerInfo: { flex: 1, justifyContent: 'center' },
  name: { color: '#F8FAFC', fontSize: 18, fontWeight: '800' },
  meta: { color: '#94A3B8', fontSize: 13, marginTop: 3 },
  condBadge: { marginTop: 8, alignSelf: 'flex-start', backgroundColor: '#1E40AF', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 10 },
  condBadgeText: { color: '#BFDBFE', fontSize: 12, fontWeight: '700' },
  valueCard: { backgroundColor: '#172554', borderRadius: 12, padding: 16, marginBottom: 14 },
  valueLabel: { color: '#93C5FD', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.5 },
  valueAmount: { color: '#DBEAFE', fontSize: 32, fontWeight: '900', marginTop: 4 },
  valueRange: { color: '#93C5FD', fontSize: 12, marginTop: 4 },
  gainRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#1D4ED8' },
  gainLabel: { color: '#93C5FD', fontSize: 13 },
  gainValue: { fontSize: 14, fontWeight: '700' },
  green: { color: '#22C55E' },
  red: { color: '#EF4444' },
  section: { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 12 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sectionTitle: { color: '#CBD5E1', fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  refreshLink: { color: '#3B82F6', fontSize: 13, fontWeight: '600' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#334155' },
  priceSource: { color: '#CBD5E1', fontSize: 13 },
  priceFresh: { color: '#475569', fontSize: 11, marginTop: 2 },
  priceValue: { color: '#F8FAFC', fontSize: 14, fontWeight: '700' },
  deleteBtn: { borderWidth: 1, borderColor: '#7F1D1D', borderRadius: 10, padding: 13, alignItems: 'center', marginTop: 6 },
  deleteBtnText: { color: '#EF4444', fontWeight: '700' },
  empty: { color: '#475569', fontSize: 13, textAlign: 'center' },
});
