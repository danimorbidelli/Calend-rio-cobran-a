"use strict";

/**
 * Camada de armazenamento do Calendário de Cobrança.
 *
 * Seleciona automaticamente o backend:
 *  - DATABASE_URL definida → PostgreSQL (durável; Render, Supabase, Neon…).
 *  - Caso contrário → arquivo JSON local (data/events.json).
 *
 * Interface assíncrona comum:
 *   init(), list({from,to}), create(ev), update(id, ev), remove(id),
 *   replaceSeed(events), getMeta(k), setMeta(k,v)
 */

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const pad = (n) => String(n).padStart(2, "0");

function normalizeRow(row) {
  const hour = row.hour;
  const start = row.start || row.start_time || (hour != null ? pad(Number(hour)) + ":00" : "");
  return {
    id: row.id,
    date: row.date,
    start,
    end: row.end || row.end_time || "",
    hour: hour != null ? Number(hour) : (start ? Number(start.slice(0, 2)) : 0),
    cat: row.cat || "outro",
    title: row.title || "",
    owner: row.owner || "",
    volume: row.volume == null ? "" : Number(row.volume),
    pitch: row.pitch || "",
    objections: row.objections || "",
    notes: row.notes || "",
    done: row.done === true || row.done === "true" || row.done === 1,
    summaryOnly: row.summaryOnly === true || row.summary_only === true || row.summary_only === "true" || row.summary_only === 1,
    updatedAt: row.updatedAt || row.updated_at || null,
  };
}

// ---------------------------------------------------------------------------
// Backend: arquivo JSON
// ---------------------------------------------------------------------------
function createFileStore() {
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
  const DATA_FILE = path.join(DATA_DIR, "events.json");
  const META_FILE = path.join(DATA_DIR, "meta.json");
  let writeQueue = Promise.resolve();

  function ensure() {
    if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
    if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]", "utf8");
  }
  async function readAll() {
    ensure();
    try {
      const data = JSON.parse(await fsp.readFile(DATA_FILE, "utf8"));
      return Array.isArray(data) ? data : [];
    } catch (e) { return []; }
  }
  function writeAll(events) {
    writeQueue = writeQueue.then(async () => {
      ensure();
      const tmp = DATA_FILE + ".tmp";
      await fsp.writeFile(tmp, JSON.stringify(events, null, 2), "utf8");
      await fsp.rename(tmp, DATA_FILE);
    }).catch((e) => console.error("Erro ao gravar arquivo:", e));
    return writeQueue;
  }

  return {
    label: `arquivo JSON (${DATA_DIR})`,
    async init() { ensure(); },
    async list({ from, to } = {}) {
      let events = await readAll();
      if (from) events = events.filter((e) => e.date >= from);
      if (to) events = events.filter((e) => e.date <= to);
      return events.map(normalizeRow);
    },
    async create(ev) {
      const events = await readAll();
      events.push(ev);
      await writeAll(events);
      return normalizeRow(ev);
    },
    async update(id, ev) {
      const events = await readAll();
      const idx = events.findIndex((e) => e.id === id);
      if (idx < 0) return null;
      events[idx] = ev;
      await writeAll(events);
      return normalizeRow(ev);
    },
    async remove(id) {
      const events = await readAll();
      const next = events.filter((e) => e.id !== id);
      if (next.length === events.length) return false;
      await writeAll(next);
      return true;
    },
    // upsert por id (mescla) ou substitui tudo
    async bulk(incoming, mode) {
      let events = mode === "replace" ? [] : await readAll();
      const byId = new Map(events.map((e) => [e.id, e]));
      for (const ev of incoming) byId.set(ev.id, ev);
      events = [...byId.values()];
      await writeAll(events);
      return events.length;
    },
    // remove os eventos do seed (id seed-*) e reinsere o novo conjunto
    async replaceSeed(seed) {
      const events = (await readAll()).filter((e) => !String(e.id).startsWith("seed-"));
      const merged = events.concat(seed);
      await writeAll(merged);
      return merged.length;
    },
    async getMeta(k) {
      try { const m = JSON.parse(await fsp.readFile(META_FILE, "utf8")); return m[k] ?? null; }
      catch (e) { return null; }
    },
    async setMeta(k, v) {
      ensure();
      let m = {};
      try { m = JSON.parse(await fsp.readFile(META_FILE, "utf8")); } catch (e) { m = {}; }
      m[k] = v;
      await fsp.writeFile(META_FILE, JSON.stringify(m, null, 2), "utf8");
    },
  };
}

// ---------------------------------------------------------------------------
// Backend: PostgreSQL
// ---------------------------------------------------------------------------
function createPgStore(connectionString) {
  const { Pool } = require("pg");
  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  const ssl = isLocal || process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false };
  const pool = new Pool({ connectionString, ssl });

  const COLS = "id,date,start_time,end_time,hour,cat,title,owner,volume,pitch,objections,notes,done,summary_only,updated_at";
  function toRow(e) {
    return [e.id, e.date, e.start || null, e.end || null, e.hour,
      e.cat, e.title, e.owner,
      e.volume === "" || e.volume == null ? null : Number(e.volume),
      e.pitch, e.objections, e.notes, e.done === true, e.summaryOnly === true, e.updatedAt];
  }
  const PLACEHOLDERS = "$1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15";
  const UPSERT_SET = `date=EXCLUDED.date,start_time=EXCLUDED.start_time,end_time=EXCLUDED.end_time,
    hour=EXCLUDED.hour,cat=EXCLUDED.cat,title=EXCLUDED.title,owner=EXCLUDED.owner,volume=EXCLUDED.volume,
    pitch=EXCLUDED.pitch,objections=EXCLUDED.objections,notes=EXCLUDED.notes,done=EXCLUDED.done,
    summary_only=EXCLUDED.summary_only,updated_at=EXCLUDED.updated_at`;
  const SELECT = `SELECT id,date,start_time,end_time,hour,cat,title,owner,volume,pitch,objections,notes,done,summary_only,updated_at AS "updatedAt" FROM events`;

  return {
    label: "PostgreSQL",
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS events (
          id TEXT PRIMARY KEY, date TEXT NOT NULL, hour INTEGER NOT NULL,
          cat TEXT, title TEXT NOT NULL, owner TEXT, volume INTEGER,
          pitch TEXT, objections TEXT, notes TEXT, updated_at TIMESTAMPTZ
        );
        ALTER TABLE events ADD COLUMN IF NOT EXISTS start_time TEXT;
        ALTER TABLE events ADD COLUMN IF NOT EXISTS end_time TEXT;
        ALTER TABLE events ADD COLUMN IF NOT EXISTS done BOOLEAN DEFAULT FALSE;
        ALTER TABLE events ADD COLUMN IF NOT EXISTS summary_only BOOLEAN DEFAULT FALSE;
        CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
        CREATE TABLE IF NOT EXISTS meta (k TEXT PRIMARY KEY, v TEXT);
      `);
    },
    async list({ from, to } = {}) {
      const where = []; const params = [];
      if (from) { params.push(from); where.push(`date >= $${params.length}`); }
      if (to) { params.push(to); where.push(`date <= $${params.length}`); }
      const sql = `${SELECT} ${where.length ? "WHERE " + where.join(" AND ") : ""} ORDER BY date, hour, start_time`;
      const { rows } = await pool.query(sql, params);
      return rows.map(normalizeRow);
    },
    async create(ev) {
      await pool.query(`INSERT INTO events (${COLS}) VALUES (${PLACEHOLDERS})`, toRow(ev));
      return normalizeRow(ev);
    },
    async update(id, ev) {
      const { rowCount } = await pool.query(
        `UPDATE events SET date=$2,start_time=$3,end_time=$4,hour=$5,cat=$6,title=$7,owner=$8,
         volume=$9,pitch=$10,objections=$11,notes=$12,done=$13,summary_only=$14,updated_at=$15 WHERE id=$1`, toRow(ev));
      return rowCount ? normalizeRow(ev) : null;
    },
    async remove(id) {
      const { rowCount } = await pool.query(`DELETE FROM events WHERE id=$1`, [id]);
      return rowCount > 0;
    },
    async bulk(incoming, mode) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        if (mode === "replace") await client.query("DELETE FROM events");
        for (const ev of incoming) {
          await client.query(
            `INSERT INTO events (${COLS}) VALUES (${PLACEHOLDERS})
             ON CONFLICT (id) DO UPDATE SET ${UPSERT_SET}`, toRow(ev));
        }
        await client.query("COMMIT");
        const { rows } = await client.query("SELECT COUNT(*)::int AS n FROM events");
        return rows[0].n;
      } catch (e) { await client.query("ROLLBACK"); throw e; }
      finally { client.release(); }
    },
    async replaceSeed(seed) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query("DELETE FROM events WHERE id LIKE 'seed-%'");
        for (const ev of seed) {
          await client.query(`INSERT INTO events (${COLS}) VALUES (${PLACEHOLDERS})
            ON CONFLICT (id) DO UPDATE SET ${UPSERT_SET}`, toRow(ev));
        }
        await client.query("COMMIT");
        const { rows } = await client.query("SELECT COUNT(*)::int AS n FROM events");
        return rows[0].n;
      } catch (e) { await client.query("ROLLBACK"); throw e; }
      finally { client.release(); }
    },
    async getMeta(k) {
      const { rows } = await pool.query("SELECT v FROM meta WHERE k=$1", [k]);
      return rows.length ? rows[0].v : null;
    },
    async setMeta(k, v) {
      await pool.query(`INSERT INTO meta (k,v) VALUES ($1,$2)
        ON CONFLICT (k) DO UPDATE SET v=EXCLUDED.v`, [k, v]);
    },
  };
}

function createStore() {
  if (process.env.DATABASE_URL) {
    try { return createPgStore(process.env.DATABASE_URL); }
    catch (e) { console.error("Falha ao iniciar PostgreSQL, usando arquivo:", e.message); }
  }
  return createFileStore();
}

module.exports = { createStore };
