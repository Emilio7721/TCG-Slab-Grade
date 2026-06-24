import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl,
  Image, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getDatabase, getHoldingsWithCards, getPricesForCard } from '../db/database';
import { computeConsensus, formatPrice } from '../utils/priceUtils';
import { fetchAllPrices } from '../services/pricing';
import { upsertPrice } from '../db/database';
import { CONDITION_LABELS } from '../utils/constants';

export default function PortfolioScreen({ navigation }) {
  const [holdings, setHoldings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totals, setTotals] = useState({ value: 0, cost: 0 });

  useFocusEffect(useCallback(() => { loadHoldings(); }, []));

  async function loadHoldings() {
    setLoading(true);
    try {
      const db = await getDatabase();
      const rows = await getHoldingsWithCards(db);

      // Enrich with cached prices
      const enriched = await Promise.all(rows.map(async h => {
        const prices = await getPricesForCard(db, h.card_id, h.condition);
        const consensus = computeConsensus(prices);
        return { ...h, currentValue: consensus?.fairValue ?? null };
      }));

      setHoldings(enriched);
      computeTotals(enriched);
    } finally {
      setLoading(false);
    }
  }

  async function refreshPrices() {
    setRefreshing(true);
    try {
      const db = await getDatabase();
      const rows = await getHoldingsWithCards(db);

      await Promise.all(rows.map(async h => {
        const prices = await fetchAllPrices(h, h.condition);
        for (const p of prices) {
          await upsertPrice(db, { ...p, card_id: h.card_id });
        }
      }));

      await loadHoldings();
    } finally {
      setRefreshing(false);
    }
  }

  function computeTotals(rows) {
    let value = 0, cost = 0;
    for (const h of rows) {
      value += (h.currentValue ?? 0) * h.quantity;
      cost += (h.acquisition_cost ?? 0) * h.quantity;
    }
    setTotals({ value, cost });
  }

  const gainLoss = totals.value - totals.cost;
  const gainPct = totals.cost > 0 ? (gainLoss / totals.cost) * 100 : 0;

  if (loading) {
    return <View style={s.center}><ActivityIndicator color="#3B82F6" size="large" /></View>;
  }

  return (
    <View style={s.container}>
      {/* Summary header */}
      <View style={s.header}>
        <View style={s.statBox}>
          <Text style={s.statLabel}>Portfolio Value</Text>
          <Text style={s.statValue}>{formatPrice(totals.value)}</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statLabel}>Cost Basis</Text>
          <Text style={s.statValue}>{formatPrice(totals.cost)}</Text>
        </View>
        <View style={s.statBox}>
          <Text style={s.statLabel}>Gain / Loss</Text>
          <Text style={[s.statValue, gainLoss >= 0 ? s.green : s.red]}>
            {gainLoss >= 0 ? '+' : ''}{formatPrice(gainLoss)}
          </Text>
          <Text style={[s.statSub, gainPct >= 0 ? s.green : s.red]}>
            {gainPct >= 0 ? '+' : ''}{gainPct.toFixed(1)}%
          </Text>
        </View>
      </View>

      <TouchableOpacity style={s.refreshBtn} onPress={refreshPrices}>
        <Text style={s.refreshBtnText}>Refresh All Prices</Text>
      </TouchableOpacity>

      {holdings.length === 0 ? (
        <View style={s.center}>
          <Text style={s.empty}>No cards yet. Scan a card to get started!</Text>
        </View>
      ) : (
        <FlatList
          data={holdings}
          keyExtractor={h => String(h.id)}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refreshPrices} tintColor="#3B82F6" />}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={s.row}
              onPress={() => navigation.navigate('CardDetail', { holding: item })}
            >
              {item.image_url
                ? <Image source={{ uri: item.image_url }} style={s.thumb} resizeMode="contain" />
                : <View style={s.thumbPlaceholder}><Text>🃏</Text></View>}
              <View style={s.rowInfo}>
                <Text style={s.rowName} numberOfLines={1}>{item.name}</Text>
                <Text style={s.rowMeta}>{item.set_name} #{item.card_number}</Text>
                <Text style={s.rowCond}>{CONDITION_LABELS[item.condition] ?? item.condition}</Text>
              </View>
              <View style={s.rowRight}>
                {item.currentValue != null
                  ? <Text style={s.rowValue}>{formatPrice(item.currentValue)}</Text>
                  : <Text style={s.noPrice}>—</Text>}
                {item.acquisition_cost != null && item.currentValue != null && (
                  <Text style={[s.rowGain, item.currentValue >= item.acquisition_cost ? s.green : s.red]}>
                    {item.currentValue >= item.acquisition_cost ? '+' : ''}
                    {formatPrice(item.currentValue - item.acquisition_cost)}
                  </Text>
                )}
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', backgroundColor: '#1E293B', padding: 16, gap: 2 },
  statBox: { flex: 1, alignItems: 'center' },
  statLabel: { color: '#64748B', fontSize: 10, textTransform: 'uppercase', letterSpacing: 0.5 },
  statValue: { color: '#F8FAFC', fontSize: 16, fontWeight: '800', marginTop: 2 },
  statSub: { fontSize: 11, fontWeight: '600' },
  green: { color: '#22C55E' },
  red: { color: '#EF4444' },
  refreshBtn: { margin: 12, backgroundColor: '#1E293B', borderRadius: 8, padding: 10, alignItems: 'center', borderWidth: 1, borderColor: '#334155' },
  refreshBtnText: { color: '#3B82F6', fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#1E293B', marginHorizontal: 12, marginBottom: 8, borderRadius: 10, padding: 10, gap: 10 },
  thumb: { width: 44, height: 62, borderRadius: 4 },
  thumbPlaceholder: { width: 44, height: 62, borderRadius: 4, backgroundColor: '#334155', alignItems: 'center', justifyContent: 'center' },
  rowInfo: { flex: 1 },
  rowName: { color: '#F8FAFC', fontWeight: '700', fontSize: 14 },
  rowMeta: { color: '#64748B', fontSize: 11, marginTop: 2 },
  rowCond: { color: '#94A3B8', fontSize: 11, marginTop: 2 },
  rowRight: { alignItems: 'flex-end' },
  rowValue: { color: '#F8FAFC', fontWeight: '700', fontSize: 14 },
  rowGain: { fontSize: 12, fontWeight: '600', marginTop: 2 },
  noPrice: { color: '#475569', fontSize: 14 },
  empty: { color: '#475569', fontSize: 14, textAlign: 'center' },
});
