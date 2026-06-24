import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { Text } from 'react-native';

import ScanScreen from '../screens/ScanScreen';
import ScanConfirmScreen from '../screens/ScanConfirmScreen';
import PortfolioScreen from '../screens/PortfolioScreen';
import CardDetailScreen from '../screens/CardDetailScreen';
import BuyDecisionScreen from '../screens/BuyDecisionScreen';
import ListingAnalyzerScreen from '../screens/ListingAnalyzerScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();

function ScanStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="ScanCamera" component={ScanScreen} options={{ title: 'Scan Card' }} />
      <Stack.Screen name="ScanConfirm" component={ScanConfirmScreen} options={{ title: 'Confirm Card' }} />
      <Stack.Screen name="BuyDecision" component={BuyDecisionScreen} options={{ title: 'Buy Decision' }} />
    </Stack.Navigator>
  );
}

function PortfolioStack() {
  return (
    <Stack.Navigator screenOptions={stackOptions}>
      <Stack.Screen name="Portfolio" component={PortfolioScreen} options={{ title: 'My Collection' }} />
      <Stack.Screen name="CardDetail" component={CardDetailScreen} options={{ title: 'Card Detail' }} />
    </Stack.Navigator>
  );
}

const stackOptions = {
  headerStyle: { backgroundColor: '#0F172A' },
  headerTintColor: '#F8FAFC',
  headerTitleStyle: { fontWeight: '700' },
};

const tabBarIcon = (name) => ({ color, size }) => (
  <Text style={{ color, fontSize: size }}>{TAB_ICONS[name]}</Text>
);

const TAB_ICONS = {
  Scan: '📷',
  Portfolio: '💼',
  Analyzer: '🔍',
  Settings: '⚙️',
};

export default function AppNavigator() {
  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: { backgroundColor: '#0F172A', borderTopColor: '#1E293B' },
          tabBarActiveTintColor: '#3B82F6',
          tabBarInactiveTintColor: '#64748B',
          headerShown: false,
        }}
      >
        <Tab.Screen
          name="Scan"
          component={ScanStack}
          options={{ tabBarIcon: tabBarIcon('Scan'), title: 'Scan' }}
        />
        <Tab.Screen
          name="PortfolioTab"
          component={PortfolioStack}
          options={{ tabBarIcon: tabBarIcon('Portfolio'), title: 'Portfolio' }}
        />
        <Tab.Screen
          name="Analyzer"
          component={ListingAnalyzerScreen}
          options={{ tabBarIcon: tabBarIcon('Analyzer'), title: 'Analyzer',
            headerShown: true, ...stackOptions }}
        />
        <Tab.Screen
          name="Settings"
          component={SettingsScreen}
          options={{ tabBarIcon: tabBarIcon('Settings'), title: 'Settings',
            headerShown: true, ...stackOptions }}
        />
      </Tab.Navigator>
    </NavigationContainer>
  );
}
