"use strict";

/**
 * Servidor do Calendário de Cobrança.
 *
 * - Serve o frontend estático de /public
 * - Expõe uma API REST para CRUD de atividades.
 * - A persistência é resolvida em storage.js: PostgreSQL (se DATABASE_URL
 *   estiver definida) ou arquivo JSON local (fallback).
 */

const express = require("express");
const fs = require("fs");
const path = require("path");
const { createStore } = require("./storage");

const app = express();
const PORT = process.env.PORT || 3000;
const store = createStore();

app.use(express.json({ limit: "2mb" }));
app.use(express.static(path.join(__dirname, "public")));

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

// Envolve handlers async para encaminhar erros ao Express
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: "Erro interno do servidor." });
});

// ---- Rotas ----

app.get("/api/events", wrap(async (req, res) => {
  const { from, to } = req.query;
  res.json(await store.list({ from, to }));
}));

app.post("/api/events", wrap(async (req, res) => {
  const { event, error } = sanitize(req.body);
  if (error) return res.status(400).json({ error });
  res.status(201).json(await store.create(event));
}));

app.put("/api/events/:id", wrap(async (req, res) => {
  const { event, error } = sanitize({ ...req.body, id: req.params.id });
  if (error) return res.status(400).json({ error });
  const updated = await store.update(req.params.id, event);
  if (!updated) return res.status(404).json({ error: "Atividade não encontrada." });
  res.json(updated);
}));

app.delete("/api/events/:id", wrap(async (req, res) => {
  const ok = await store.remove(req.params.id);
  if (!ok) return res.status(404).json({ error: "Atividade não encontrada." });
  res.json({ ok: true });
}));

app.post("/api/import", wrap(async (req, res) => {
  const { events: incoming, mode } = req.body || {};
  if (!Array.isArray(incoming)) return res.status(400).json({ error: "Esperado um array de eventos." });
  const clean = [];
  for (const raw of incoming) {
    const { event } = sanitize(raw);
    if (event) clean.push(event);
  }
  const total = await store.bulk(clean, mode === "replace" ? "replace" : "merge");
  res.json({ ok: true, total });
}));

app.get("/api/health", (req, res) => res.json({ ok: true, storage: store.label }));

// Semeia o calendário com o rascunho (seed.json) na primeira execução, quando
// o armazenamento está vazio. Idempotente: ids determinísticos + ON CONFLICT.
// Desative definindo SEED=off.
async function seedIfEmpty() {
  if (process.env.SEED === "off") return;
  const seedPath = path.join(__dirname, "seed.json");
  if (!fs.existsSync(seedPath)) return;
  const existing = await store.list({});
  if (existing.length > 0) return;
  let seed;
  try { seed = JSON.parse(fs.readFileSync(seedPath, "utf8")); } catch (e) { return; }
  if (!Array.isArray(seed) || seed.length === 0) return;
  const stamped = seed.map((e) => ({ ...e, updatedAt: new Date().toISOString() }));
  const total = await store.bulk(stamped, "merge");
  console.log(`Seed aplicado: ${total} atividades importadas do rascunho.`);
}

store.init()
  .then(seedIfEmpty)
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Calendário de Cobrança rodando na porta ${PORT} — armazenamento: ${store.label}`);
    });
  })
  .catch((e) => {
    console.error("Falha ao inicializar o armazenamento:", e);
    process.exit(1);
  });
