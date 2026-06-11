"use strict";

/**
 * Camada de armazenamento do Calendário de Cobrança.
 *
 * Seleciona automaticamente o backend:
 *  - Se a variável de ambiente DATABASE_URL estiver definida, usa PostgreSQL
 *    (durável; funciona com Render, Supabase, Neon, etc.).
 *  - Caso contrário, usa um arquivo JSON local (data/events.json) — ideal
 *    para uso local ou no plano free, sem dependências externas.
 *
 * Ambas expõem a mesma interface assíncrona:
 *    init(), list({from, to}), create(ev), update(id, ev), remove(id),
 *    bulk(events, mode)
 */

const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

// Campos de um evento, na ordem usada pelo banco
const FIELDS = ["id", "date", "hour", "cat", "title", "owner", "volume", "pitch", "objections", "notes", "updatedAt"];

function normalizeRow(row) {
  // Garante o formato esperado pelo frontend (volume "" quando nulo)
  return {
    id: row.id,
    date: row.date,
    hour: Number(row.hour),
    cat: row.cat || "outro",
    title: row.title || "",
    owner: row.owner || "",
    volume: row.volume == null ? "" : Number(row.volume),
    pitch: row.pitch || "",
    objections: row.objections || "",
    notes: row.notes || "",
    updatedAt: row.updatedAt || row.updated_at || null,
  };
}

// ---------------------------------------------------------------------------
// Backend: arquivo JSON
// ---------------------------------------------------------------------------
function createFileStore() {
  const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
  const DATA_FILE = path.join(DATA_DIR, "events.json");
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
    async bulk(incoming, mode) {
      let events = mode === "replace" ? [] : await readAll();
      events = events.concat(incoming);
      await writeAll(events);
      return events.length;
    },
  };
}

// ---------------------------------------------------------------------------
// Backend: PostgreSQL
// ---------------------------------------------------------------------------
function createPgStore(connectionString) {
  const { Pool } = require("pg");
  // SSL é exigido pela maioria dos provedores gerenciados (Render/Supabase/Neon)
  const isLocal = /localhost|127\.0\.0\.1/.test(connectionString);
  const ssl = isLocal || process.env.PGSSLMODE === "disable" ? false : { rejectUnauthorized: false };
  const pool = new Pool({ connectionString, ssl });

  function toRow(e) {
    return [e.id, e.date, e.hour, e.cat, e.title, e.owner,
      e.volume === "" || e.volume == null ? null : Number(e.volume),
      e.pitch, e.objections, e.notes, e.updatedAt];
  }

  return {
    label: "PostgreSQL",
    async init() {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS events (
          id          TEXT PRIMARY KEY,
          date        TEXT NOT NULL,
          hour        INTEGER NOT NULL,
          cat         TEXT,
          title       TEXT NOT NULL,
          owner       TEXT,
          volume      INTEGER,
          pitch       TEXT,
          objections  TEXT,
          notes       TEXT,
          updated_at  TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_events_date ON events(date);
      `);
    },
    async list({ from, to } = {}) {
      const where = [];
      const params = [];
      if (from) { params.push(from); where.push(`date >= $${params.length}`); }
      if (to) { params.push(to); where.push(`date <= $${params.length}`); }
      const sql = `SELECT id, date, hour, cat, title, owner, volume, pitch, objections, notes, updated_at AS "updatedAt"
                   FROM events ${where.length ? "WHERE " + where.join(" AND ") : ""}
                   ORDER BY date, hour`;
      const { rows } = await pool.query(sql, params);
      return rows.map(normalizeRow);
    },
    async create(ev) {
      await pool.query(
        `INSERT INTO events (id,date,hour,cat,title,owner,volume,pitch,objections,notes,updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`, toRow(ev));
      return normalizeRow(ev);
    },
    async update(id, ev) {
      const { rowCount } = await pool.query(
        `UPDATE events SET date=$2,hour=$3,cat=$4,title=$5,owner=$6,volume=$7,
         pitch=$8,objections=$9,notes=$10,updated_at=$11 WHERE id=$1`, toRow(ev));
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
            `INSERT INTO events (id,date,hour,cat,title,owner,volume,pitch,objections,notes,updated_at)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
             ON CONFLICT (id) DO UPDATE SET date=EXCLUDED.date,hour=EXCLUDED.hour,cat=EXCLUDED.cat,
               title=EXCLUDED.title,owner=EXCLUDED.owner,volume=EXCLUDED.volume,pitch=EXCLUDED.pitch,
               objections=EXCLUDED.objections,notes=EXCLUDED.notes,updated_at=EXCLUDED.updated_at`,
            toRow(ev));
        }
        await client.query("COMMIT");
        const { rows } = await client.query("SELECT COUNT(*)::int AS n FROM events");
        return rows[0].n;
      } catch (e) {
        await client.query("ROLLBACK"); throw e;
      } finally { client.release(); }
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

module.exports = { createStore, FIELDS };
