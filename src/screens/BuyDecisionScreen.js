import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
} from 'react-native';
import { useAppStore } from '../store/useAppStore';
import { computeVerdict, formatPrice } from '../utils/priceUtils';

const VERDICTS = {
  GOOD_BUY: { label: 'Good Buy', color: '#22C55E', bg: '#14532D', icon: '✅' },
  FAIR: { label: 'Fair', color: '#FBBF24', bg: '#713F12', icon: '⚖️' },
  OVERPRICED: { label: 'Overpriced', color: '#EF4444', bg: '#7F1D1D', icon: '❌' },
};

export default function BuyDecisionScreen({ route }) {
  const { settings } = useAppStore();
  const { card, condition, fairValue } = route.params ?? {};

  const [askingPrice, setAskingPrice] = useState('');
  const [shipping, setShipping] = useState(String(settings.defaultShipping ?? '4'));
  const [result, setResult] = useState(null);

  function calculate() {
    const asking = parseFloat(askingPrice);
    const ship = parseFloat(shipping) || 0;
    if (!asking || asking <= 0) return;
    const verdict = computeVerdict(asking, fairValue, ship, settings.sellingFees, {
      goodBuyMargin: settings.goodBuyMargin,
    });
    setResult(verdict);
  }

  const v = result ? VERDICTS[result.verdict] : null;

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>
      {/* Card context */}
      {card && (
        <View style={s.cardContext}>
          <Text style={s.cardName}>{card.name}</Text>
          <Text style={s.cardMeta}>{card.set_name} #{card.card_number} · {condition}</Text>
          <Text style={s.fairValue}>Fair Value: {formatPrice(fairValue)}</Text>
        </View>
      )}

      {/* Inputs */}
      <View style={s.section}>
        <Text style={s.label}>Asking Price ($)</Text>
        <TextInput
          style={s.input}
          value={askingPrice}
          onChangeText={setAskingPrice}
          placeholder="Enter asking price"
          placeholderTextColor="#475569"
          keyboardType="decimal-pad"
        />
        <Text style={[s.label, { marginTop: 12 }]}>Shipping ($)</Text>
        <TextInput
          style={s.input}
          value={shipping}
          onChangeText={setShipping}
          placeholder="Shipping cost"
          placeholderTextColor="#475569"
          keyboardType="decimal-pad"
        />
        <Text style={s.hint}>
          Selling fees: {Math.round((settings.sellingFees ?? 0.13) * 100)}% · Target margin: {Math.round((settings.goodBuyMargin ?? 0.2) * 100)}%
        </Text>
        <TouchableOpacity style={s.calcBtn} onPress={calculate}>
          <Text style={s.calcBtnText}>Calculate</Text>
        </TouchableOpacity>
      </View>

      {/* Result */}
      {result && v && (
        <View style={[s.verdictCard, { borderColor: v.color }]}>
          <View style={[s.verdictBadge, { backgroundColor: v.bg }]}>
            <Text style={s.verdictIcon}>{v.icon}</Text>
            <Text style={[s.verdictLabel, { color: v.color }]}>{v.label}</Text>
          </View>

          <View style={s.mathRow}>
            <Text style={s.mathLabel}>Effective Cost</Text>
            <Text style={s.mathValue}>{formatPrice(result.effectiveCost)}</Text>
          </View>
          <View style={s.mathRow}>
            <Text style={s.mathLabel}>Expected Resale</Text>
            <Text style={s.mathValue}>{formatPrice(result.expectedResale)}</Text>
          </View>
          <View style={[s.mathRow, s.mathTotal]}>
            <Text style={s.mathLabel}>Margin</Text>
            <Text style={[s.mathValue, result.margin >= 0 ? s.green : s.red]}>
              {result.margin >= 0 ? '+' : ''}{result.marginPercent}%
            </Text>
          </View>

          <Text style={s.reasoning}>
            {result.verdict === 'GOOD_BUY' &&
              `You could buy at ${formatPrice(result.effectiveCost)} and expect to sell for ~${formatPrice(result.expectedResale)} after fees — a ${result.marginPercent}% margin.`}
            {result.verdict === 'FAIR' &&
              `Price is close to fair value. Margin is ${result.marginPercent}% — not a strong flip, but reasonable for personal use.`}
            {result.verdict === 'OVERPRICED' &&
              `At ${formatPrice(result.effectiveCost)}, this card is ${Math.abs(result.marginPercent)}% above what you'd expect to recover. Pass unless you specifically need it.`}
          </Text>
        </View>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 16, paddingBottom: 40 },
  cardContext: { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 14 },
  cardName: { color: '#F8FAFC', fontSize: 16, fontWeight: '800' },
  cardMeta: { color: '#94A3B8', fontSize: 12, marginTop: 2 },
  fairValue: { color: '#3B82F6', fontSize: 20, fontWeight: '800', marginTop: 6 },
  section: { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 14 },
  label: { color: '#CBD5E1', fontSize: 13, fontWeight: '600', marginBottom: 6 },
  input: { backgroundColor: '#0F172A', color: '#F8FAFC', borderRadius: 8, padding: 12, fontSize: 16 },
  hint: { color: '#475569', fontSize: 11, marginTop: 8 },
  calcBtn: { backgroundColor: '#3B82F6', borderRadius: 10, padding: 13, alignItems: 'center', marginTop: 12 },
  calcBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  verdictCard: { borderRadius: 12, borderWidth: 2, padding: 16, backgroundColor: '#1E293B' },
  verdictBadge: { flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 8, padding: 10, marginBottom: 14 },
  verdictIcon: { fontSize: 20 },
  verdictLabel: { fontSize: 20, fontWeight: '900' },
  mathRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7, borderTopWidth: 1, borderTopColor: '#334155' },
  mathTotal: { borderTopWidth: 2, borderTopColor: '#475569' },
  mathLabel: { color: '#94A3B8', fontSize: 13 },
  mathValue: { color: '#F8FAFC', fontSize: 13, fontWeight: '700' },
  green: { color: '#22C55E' },
  red: { color: '#EF4444' },
  reasoning: { color: '#94A3B8', fontSize: 13, marginTop: 14, lineHeight: 20 },
});
