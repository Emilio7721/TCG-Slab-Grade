# TCG Slab Grade

A cross-platform mobile app (iOS + Android) for scanning, identifying, pricing, and portfolio-tracking TCG cards (Pokémon and One Piece), with support for graded slabs.

---

## Features (Phase 1)

- **Multi-angle card scanning** — guided 2–3 shot capture flow; auto-picks the sharpest frame
- **AI card identification** — Ximilar `/v2/tcg_id` identifies exact set, number, rarity, foil, language, and whether it's a graded slab
- **Condition detection** — Ximilar `/v2/condition` assesses NM/LP/MP/HP/DMG from the front photo
- **Multi-source pricing** — JustTCG (TCGplayer market data), eBay Browse API (active low), PriceCharting (graded/sealed)
- **Consensus fair value** — weighted aggregation of sold comps and market data, with a low–high range
- **Buy decision engine** — enter an asking price, see effective cost vs expected resale, get Good Buy / Fair / Overpriced verdict
- **Local collection portfolio** — save confirmed scans to SQLite; portfolio screen shows total value, cost basis, gain/loss
- **eBay listing analyzer** — add listing photos + price, get condition assessment and good/bad deal verdict

---

## Tech Stack

| Layer | Choice |
|-------|--------|
| Framework | React Native + Expo (managed workflow) |
| Camera | expo-camera, expo-image-picker |
| Image processing | expo-image-manipulator, expo-file-system |
| Local database | expo-sqlite |
| State | Zustand |
| Server state / caching | TanStack Query |
| HTTP | axios |
| Navigation | React Navigation (bottom tabs + stack) |

---

## Getting Started

### 1. Install dependencies

```bash
npm install
```

### 2. Configure API keys

Copy `.env.example` to `.env` and fill in your keys:

```bash
cp .env.example .env
```

| Key | Where to get it |
|-----|----------------|
| `EXPO_PUBLIC_XIMILAR_API_TOKEN` | [app.ximilar.com](https://app.ximilar.com) — sign up, get token |
| `EXPO_PUBLIC_JUSTTCG_API_KEY` | [api.justtcg.com](https://api.justtcg.com) — free tier available |
| `EXPO_PUBLIC_EBAY_CLIENT_ID/SECRET` | [developer.ebay.com](https://developer.ebay.com) — free account → Create App |
| `EXPO_PUBLIC_PRICECHARTING_API_KEY` | [pricecharting.com/api](https://www.pricecharting.com/api) — optional |

### 3. Start the app

```bash
npm start
```

Scan the QR code with Expo Go (iOS/Android) or press `a` for Android emulator.

---

## Project Structure

```
src/
  db/           SQLite schema + query helpers
  navigation/   Bottom tab + stack navigators
  screens/      All app screens
  services/     Ximilar, pricing APIs, image utilities
  store/        Zustand global state
  utils/        Price math, constants, formatting
```

---

## Data Model

| Table | Purpose |
|-------|---------|
| `cards` | Canonical card identity keyed by game + set_code + card_number + variant + language |
| `scans` | Scan events with captured photos + Ximilar confidence |
| `prices` | Per-card, per-condition, per-source price records with `fetched_at` |
| `holdings` | Portfolio entries with acquisition cost |
| `listing_analyses` | Saved eBay listing analysis results |

Every price row is tagged with its `source` so sold comps and asking prices are never mixed.

---

## Accuracy Principles

1. Always key on **exact set + card number + variant + language**, never just the name
2. **Condition-adjust** every value and every comparison
3. Prefer **SOLD comps** over asking prices; label sources explicitly
4. **Cache + timestamp** every price; surface freshness; show ranges, not false-precise numbers
5. Surface **confidence** and require user confirmation before a scan becomes a holding
6. Foil/variant/edition/language is where most mis-IDs happen — confirm/correct fast

---

## eBay Sold Data (the main project risk)

eBay's Marketplace Insights API (real sold comps) is a **limited-release, partner-only** API. Two paths:

- **Path A (ideal):** Apply to eBay for Marketplace Insights access at [developer.ebay.com](https://developer.ebay.com)
- **Path B (pragmatic):** Use a third-party sold-listings aggregator (e.g., Apify actors, or a pricing aggregator that includes sales history). This is scraping-adjacent — respect ToS and rate limits, cache aggressively.

The app currently uses **eBay Browse API** for active listing prices (freely available with a dev account). This is labeled `ebay_active_low` and is NOT used as a sold comp in the consensus.

---

## Build Phases

- [x] **Phase 1** — Expo skeleton · camera capture · Ximilar identify · one aggregator price · SQLite collection
- [ ] **Phase 2** — Multi-source price aggregation + consensus fair value + portfolio live totals
- [ ] **Phase 3** — Buy-decision engine with configurable margin *(partially done in Phase 1)*
- [ ] **Phase 4** — eBay listing analyzer *(partially done in Phase 1)*
- [ ] **Phase 5** — Grading endpoint · cloud sync/auth · price-history charts · backend key-proxy

---

## Caveats

- All prices are **estimates** — ranges and source breakdowns are shown, never a single false-precise number
- eBay sold data access is the **main project risk** — see above
- Respect every provider's **ToS and rate limits**; cache aggressively to stay within free/cheap tiers
- The app currently ships keys via `EXPO_PUBLIC_*` env vars. For production, migrate to a **backend proxy** (Supabase Edge Functions or Railway) so keys never appear in the app bundle
