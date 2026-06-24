import { create } from 'zustand';

export const useAppStore = create((set, get) => ({
  // Current scan session
  scanPhotos: [],
  scanResult: null,
  scanCondition: null,
  pendingCard: null,

  addScanPhoto: (uri) =>
    set(s => ({ scanPhotos: [...s.scanPhotos, uri] })),

  clearScanPhotos: () =>
    set({ scanPhotos: [], scanResult: null, scanCondition: null, pendingCard: null }),

  setScanResult: (result) => set({ scanResult: result }),
  setScanCondition: (condition) => set({ scanCondition: condition }),
  setPendingCard: (card) => set({ pendingCard: card }),

  // Portfolio
  holdings: [],
  setHoldings: (holdings) => set({ holdings }),

  // Price cache (cardId -> { condition -> prices[] })
  priceCache: {},
  setPriceCache: (cardId, condition, prices) =>
    set(s => ({
      priceCache: {
        ...s.priceCache,
        [cardId]: { ...(s.priceCache[cardId] ?? {}), [condition]: prices },
      },
    })),

  getCachedPrices: (cardId, condition) =>
    get().priceCache[cardId]?.[condition] ?? [],

  // Settings
  settings: {
    goodBuyMargin: 0.2,
    sellingFees: 0.13,
    defaultShipping: 4.0,
    currency: 'USD',
  },
  updateSettings: (patch) =>
    set(s => ({ settings: { ...s.settings, ...patch } })),
}));
