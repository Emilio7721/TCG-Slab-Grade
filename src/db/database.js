import * as SQLite from 'expo-sqlite';

let db;

export async function getDatabase() {
  if (!db) {
    db = await SQLite.openDatabaseAsync('tcg_slab_grade.db');
    await initSchema(db);
  }
  return db;
}

async function initSchema(db) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;

    CREATE TABLE IF NOT EXISTS cards (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game TEXT NOT NULL,
      name TEXT NOT NULL,
      set_name TEXT,
      set_code TEXT,
      card_number TEXT,
      rarity TEXT,
      variant TEXT,
      language TEXT DEFAULT 'en',
      image_url TEXT,
      ximilar_id TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS scans (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER REFERENCES cards(id),
      photo_uris TEXT,
      ximilar_confidence REAL,
      detected_condition TEXT,
      raw_ximilar_response TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS prices (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL REFERENCES cards(id),
      condition TEXT NOT NULL,
      source TEXT NOT NULL,
      value REAL NOT NULL,
      currency TEXT DEFAULT 'USD',
      low REAL,
      high REAL,
      fetched_at TEXT DEFAULT (datetime('now')),
      UNIQUE(card_id, condition, source)
    );

    CREATE TABLE IF NOT EXISTS holdings (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      card_id INTEGER NOT NULL REFERENCES cards(id),
      scan_id INTEGER REFERENCES scans(id),
      condition TEXT NOT NULL,
      quantity INTEGER DEFAULT 1,
      acquisition_cost REAL,
      acquired_at TEXT DEFAULT (datetime('now')),
      notes TEXT
    );

    CREATE TABLE IF NOT EXISTS listing_analyses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_url TEXT,
      parsed_price REAL,
      shipping REAL,
      assessed_condition TEXT,
      fair_value REAL,
      verdict TEXT,
      reasoning TEXT,
      card_id INTEGER REFERENCES cards(id),
      created_at TEXT DEFAULT (datetime('now'))
    );
  `);
}

// --- Cards ---

export async function upsertCard(db, card) {
  const existing = await db.getFirstAsync(
    'SELECT id FROM cards WHERE game = ? AND set_code = ? AND card_number = ? AND variant = ? AND language = ?',
    [card.game, card.set_code ?? '', card.card_number ?? '', card.variant ?? '', card.language ?? 'en']
  );
  if (existing) return existing.id;

  const result = await db.runAsync(
    `INSERT INTO cards (game, name, set_name, set_code, card_number, rarity, variant, language, image_url, ximilar_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [card.game, card.name, card.set_name ?? '', card.set_code ?? '', card.card_number ?? '',
     card.rarity ?? '', card.variant ?? '', card.language ?? 'en', card.image_url ?? '', card.ximilar_id ?? '']
  );
  return result.lastInsertRowId;
}

export async function getCard(db, cardId) {
  return db.getFirstAsync('SELECT * FROM cards WHERE id = ?', [cardId]);
}

export async function getAllCards(db) {
  return db.getAllAsync('SELECT * FROM cards ORDER BY created_at DESC');
}

// --- Scans ---

export async function insertScan(db, scan) {
  const result = await db.runAsync(
    `INSERT INTO scans (card_id, photo_uris, ximilar_confidence, detected_condition, raw_ximilar_response)
     VALUES (?, ?, ?, ?, ?)`,
    [scan.card_id, JSON.stringify(scan.photo_uris ?? []), scan.ximilar_confidence ?? 0,
     scan.detected_condition ?? 'NM', JSON.stringify(scan.raw_ximilar_response ?? {})]
  );
  return result.lastInsertRowId;
}

// --- Prices ---

export async function upsertPrice(db, price) {
  await db.runAsync(
    `INSERT INTO prices (card_id, condition, source, value, currency, low, high, fetched_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
     ON CONFLICT(card_id, condition, source) DO UPDATE SET
       value = excluded.value, low = excluded.low, high = excluded.high, fetched_at = excluded.fetched_at`,
    [price.card_id, price.condition, price.source, price.value, price.currency ?? 'USD',
     price.low ?? null, price.high ?? null]
  );
}

export async function getPricesForCard(db, cardId, condition) {
  if (condition) {
    return db.getAllAsync('SELECT * FROM prices WHERE card_id = ? AND condition = ? ORDER BY fetched_at DESC', [cardId, condition]);
  }
  return db.getAllAsync('SELECT * FROM prices WHERE card_id = ? ORDER BY fetched_at DESC', [cardId]);
}

// --- Holdings ---

export async function insertHolding(db, holding) {
  const result = await db.runAsync(
    `INSERT INTO holdings (card_id, scan_id, condition, quantity, acquisition_cost, acquired_at, notes)
     VALUES (?, ?, ?, ?, ?, datetime('now'), ?)`,
    [holding.card_id, holding.scan_id ?? null, holding.condition, holding.quantity ?? 1,
     holding.acquisition_cost ?? null, holding.notes ?? '']
  );
  return result.lastInsertRowId;
}

export async function getHoldingsWithCards(db) {
  return db.getAllAsync(`
    SELECT h.*, c.name, c.game, c.set_name, c.set_code, c.card_number, c.rarity, c.variant, c.language, c.image_url
    FROM holdings h
    JOIN cards c ON h.card_id = c.id
    ORDER BY h.acquired_at DESC
  `);
}

export async function deleteHolding(db, holdingId) {
  await db.runAsync('DELETE FROM holdings WHERE id = ?', [holdingId]);
}

// --- Listing analyses ---

export async function insertListingAnalysis(db, analysis) {
  const result = await db.runAsync(
    `INSERT INTO listing_analyses (source_url, parsed_price, shipping, assessed_condition, fair_value, verdict, reasoning, card_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [analysis.source_url ?? '', analysis.parsed_price ?? null, analysis.shipping ?? null,
     analysis.assessed_condition ?? '', analysis.fair_value ?? null, analysis.verdict ?? '',
     analysis.reasoning ?? '', analysis.card_id ?? null]
  );
  return result.lastInsertRowId;
}

export async function getListingAnalyses(db) {
  return db.getAllAsync('SELECT * FROM listing_analyses ORDER BY created_at DESC LIMIT 50');
}
