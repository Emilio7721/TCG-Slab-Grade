import React, { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Switch, Alert,
} from 'react-native';
import { useAppStore } from '../store/useAppStore';

export default function SettingsScreen() {
  const { settings, updateSettings } = useAppStore();

  const [goodBuyMargin, setGoodBuyMargin] = useState(String(Math.round(settings.goodBuyMargin * 100)));
  const [sellingFees, setSellingFees] = useState(String(Math.round(settings.sellingFees * 100)));
  const [defaultShipping, setDefaultShipping] = useState(String(settings.defaultShipping ?? '4'));

  function save() {
    const margin = parseFloat(goodBuyMargin) / 100;
    const fees = parseFloat(sellingFees) / 100;
    const shipping = parseFloat(defaultShipping);

    if (isNaN(margin) || isNaN(fees) || isNaN(shipping)) {
      Alert.alert('Invalid values', 'Please enter valid numbers.');
      return;
    }

    updateSettings({ goodBuyMargin: margin, sellingFees: fees, defaultShipping: shipping });
    Alert.alert('Saved', 'Settings updated.');
  }

  return (
    <ScrollView style={s.container} contentContainerStyle={s.content}>

      <View style={s.section}>
        <Text style={s.sectionTitle}>Buy Decision Thresholds</Text>
        <Text style={s.label}>Good Buy Margin (%)</Text>
        <Text style={s.hint}>Flag as "Good Buy" when expected margin exceeds this. Default: 20%</Text>
        <TextInput
          style={s.input}
          value={goodBuyMargin}
          onChangeText={setGoodBuyMargin}
          keyboardType="decimal-pad"
          placeholderTextColor="#475569"
        />
        <Text style={[s.label, { marginTop: 14 }]}>Selling Fees (%)</Text>
        <Text style={s.hint}>eBay + payment processor fees. Default: 13%</Text>
        <TextInput
          style={s.input}
          value={sellingFees}
          onChangeText={setSellingFees}
          keyboardType="decimal-pad"
          placeholderTextColor="#475569"
        />
        <Text style={[s.label, { marginTop: 14 }]}>Default Shipping ($)</Text>
        <Text style={s.hint}>Shipping cost used in buy-decision calculations.</Text>
        <TextInput
          style={s.input}
          value={defaultShipping}
          onChangeText={setDefaultShipping}
          keyboardType="decimal-pad"
          placeholderTextColor="#475569"
        />
        <TouchableOpacity style={s.saveBtn} onPress={save}>
          <Text style={s.saveBtnText}>Save Settings</Text>
        </TouchableOpacity>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>API Keys</Text>
        <Text style={s.hint}>
          For security, API keys are read from environment variables set at build time.
          Add them to your .env file (see .env.example in the project root).
        </Text>
        <View style={s.keyRow}>
          <Text style={s.keyLabel}>Ximilar</Text>
          <Text style={s.keyStatus(!!process.env.EXPO_PUBLIC_XIMILAR_API_TOKEN)}>
            {process.env.EXPO_PUBLIC_XIMILAR_API_TOKEN ? 'Configured' : 'Not set'}
          </Text>
        </View>
        <View style={s.keyRow}>
          <Text style={s.keyLabel}>JustTCG</Text>
          <Text style={s.keyStatus(!!process.env.EXPO_PUBLIC_JUSTTCG_API_KEY)}>
            {process.env.EXPO_PUBLIC_JUSTTCG_API_KEY ? 'Configured' : 'Not set'}
          </Text>
        </View>
        <View style={s.keyRow}>
          <Text style={s.keyLabel}>eBay</Text>
          <Text style={s.keyStatus(!!process.env.EXPO_PUBLIC_EBAY_CLIENT_ID)}>
            {process.env.EXPO_PUBLIC_EBAY_CLIENT_ID ? 'Configured' : 'Not set'}
          </Text>
        </View>
        <View style={s.keyRow}>
          <Text style={s.keyLabel}>PriceCharting</Text>
          <Text style={s.keyStatus(!!process.env.EXPO_PUBLIC_PRICECHARTING_API_KEY)}>
            {process.env.EXPO_PUBLIC_PRICECHARTING_API_KEY ? 'Configured' : 'Not set'}
          </Text>
        </View>
      </View>

      <View style={s.section}>
        <Text style={s.sectionTitle}>About</Text>
        <Text style={s.about}>TCG Slab Grade · Phase 1</Text>
        <Text style={s.about}>Supports Pokémon · One Piece</Text>
        <Text style={[s.about, { marginTop: 8 }]}>
          Prices are estimates. Always verify with multiple sources before buying.
          eBay sold data requires Path A or B configuration (see README).
        </Text>
      </View>
    </ScrollView>
  );
}

const keyStatusStyle = (active) => ({
  color: active ? '#22C55E' : '#EF4444',
  fontSize: 13,
  fontWeight: '600',
});

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0F172A' },
  content: { padding: 16, paddingBottom: 40 },
  section: { backgroundColor: '#1E293B', borderRadius: 12, padding: 14, marginBottom: 14 },
  sectionTitle: { color: '#CBD5E1', fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12 },
  label: { color: '#CBD5E1', fontSize: 13, fontWeight: '600', marginBottom: 4 },
  hint: { color: '#475569', fontSize: 12, marginBottom: 6, lineHeight: 16 },
  input: { backgroundColor: '#0F172A', color: '#F8FAFC', borderRadius: 8, padding: 12, fontSize: 15 },
  saveBtn: { backgroundColor: '#3B82F6', borderRadius: 10, padding: 12, alignItems: 'center', marginTop: 14 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  keyRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#334155' },
  keyLabel: { color: '#94A3B8', fontSize: 13 },
  keyStatus: keyStatusStyle,
  about: { color: '#64748B', fontSize: 13, lineHeight: 18 },
});
