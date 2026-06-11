"use strict";

/**
 * Servidor do Calendário de Cobrança.
 *
 * - Serve o frontend estático de /public
 * - Expõe uma API REST simples para CRUD de atividades, com persistência
 *   em arquivo JSON (data/events.json). Sem dependências nativas.
 * - Escritas são serializadas e atômicas (grava em arquivo temporário e
 *   renomeia), suficiente para o volume de uma equipe de cobrança.
 */

const express = require("express");
const fs = require("fs");
const fsp = require("fs/promises");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

// DATA_DIR pode apontar para um disco persistente (ex.: /var/data no Render)
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, "data");
const DATA_FILE = path.join(DATA_DIR, "events.json");

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

// ---- Persistência ----
let writeQueue = Promise.resolve(); // serializa gravações

function ensureStore() {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) fs.writeFileSync(DATA_FILE, "[]", "utf8");
}

async function readEvents() {
  ensureStore();
  try {
    const raw = await fsp.readFile(DATA_FILE, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch (e) {
    return [];
  }
}

function writeEvents(events) {
  // Encadeia na fila para evitar gravações concorrentes
  writeQueue = writeQueue.then(async () => {
    ensureStore();
    const tmp = DATA_FILE + ".tmp";
    await fsp.writeFile(tmp, JSON.stringify(events, null, 2), "utf8");
    await fsp.rename(tmp, DATA_FILE);
  }).catch((e) => { console.error("Erro ao gravar:", e); });
  return writeQueue;
}

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// Normaliza/valida um evento vindo do cliente
function sanitize(body) {
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(body.date || "");
  if (!dateOk) return { error: "Data inválida (use YYYY-MM-DD)." };
  const hour = Number(body.hour);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return { error: "Hora inválida (0-23)." };
  const title = String(body.title || "").trim();
  if (!title) return { error: "Título é obrigatório." };
  return {
    event: {
      id: body.id || uid(),
      date: body.date,
      hour,
      cat: String(body.cat || "outro"),
      title,
      owner: String(body.owner || "").trim(),
      volume: body.volume === "" || body.volume == null ? "" : Number(body.volume) || 0,
      pitch: String(body.pitch || "").trim(),
      objections: String(body.objections || "").trim(),
      notes: String(body.notes || "").trim(),
      updatedAt: new Date().toISOString(),
    },
  };
}

// ---- Rotas ----

// Lista eventos, opcionalmente filtrando por intervalo [from, to]
app.get("/api/events", async (req, res) => {
  const { from, to } = req.query;
  let events = await readEvents();
  if (from) events = events.filter((e) => e.date >= from);
  if (to) events = events.filter((e) => e.date <= to);
  res.json(events);
});

// Cria
app.post("/api/events", async (req, res) => {
  const { event, error } = sanitize(req.body);
  if (error) return res.status(400).json({ error });
  const events = await readEvents();
  events.push(event);
  await writeEvents(events);
  res.status(201).json(event);
});

// Atualiza
app.put("/api/events/:id", async (req, res) => {
  const { event, error } = sanitize({ ...req.body, id: req.params.id });
  if (error) return res.status(400).json({ error });
  const events = await readEvents();
  const idx = events.findIndex((e) => e.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: "Atividade não encontrada." });
  events[idx] = event;
  await writeEvents(events);
  res.json(event);
});

// Exclui
app.delete("/api/events/:id", async (req, res) => {
  const events = await readEvents();
  const next = events.filter((e) => e.id !== req.params.id);
  if (next.length === events.length) return res.status(404).json({ error: "Atividade não encontrada." });
  await writeEvents(next);
  res.json({ ok: true });
});

// Importação em massa (mescla ou substitui)
app.post("/api/import", async (req, res) => {
  const { events: incoming, mode } = req.body || {};
  if (!Array.isArray(incoming)) return res.status(400).json({ error: "Esperado um array de eventos." });
  let events = mode === "replace" ? [] : await readEvents();
  for (const raw of incoming) {
    const { event } = sanitize(raw);
    if (event) events.push(event);
  }
  await writeEvents(events);
  res.json({ ok: true, total: events.length });
});

app.get("/api/health", (req, res) => res.json({ ok: true }));

app.listen(PORT, "0.0.0.0", () => {
  ensureStore();
  console.log(`Calendário de Cobrança rodando na porta ${PORT} (dados em ${DATA_DIR})`);
});
