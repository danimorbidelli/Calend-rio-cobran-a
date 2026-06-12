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

const pad = (n) => String(n).padStart(2, "0");
const timeOk = (s) => /^\d{1,2}:\d{2}$/.test(s);
const toMin = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + (m || 0); };

// Normaliza/valida um evento vindo do cliente
function sanitize(body) {
  const dateOk = /^\d{4}-\d{2}-\d{2}$/.test(body.date || "");
  if (!dateOk) return { error: "Data inválida (use YYYY-MM-DD)." };

  // Início: aceita "start" (HH:MM) ou, por compatibilidade, "hour".
  let start = String(body.start || "").trim();
  if (!start && body.hour != null && body.hour !== "") start = pad(Number(body.hour)) + ":00";
  if (!timeOk(start)) return { error: "Horário de início inválido (use HH:MM)." };
  const [sh, sm] = start.split(":").map(Number);
  if (sh < 0 || sh > 23 || sm < 0 || sm > 59) return { error: "Horário de início fora do intervalo." };
  start = pad(sh) + ":" + pad(sm);

  // Fim: opcional; descartado se inválido ou <= início.
  let end = String(body.end || "").trim();
  if (end) {
    if (!timeOk(end) || toMin(end) <= toMin(start)) end = "";
    else { const [eh, em] = end.split(":").map(Number); end = pad(eh) + ":" + pad(em); }
  }

  const title = String(body.title || "").trim();
  if (!title) return { error: "Título é obrigatório." };
  return {
    event: {
      id: body.id || uid(),
      date: body.date,
      start,
      end,
      hour: sh,
      cat: String(body.cat || "outro"),
      title,
      owner: String(body.owner || "").trim(),
      volume: body.volume === "" || body.volume == null ? "" : Number(body.volume) || 0,
      pitch: String(body.pitch || "").trim(),
      objections: String(body.objections || "").trim(),
      notes: String(body.notes || "").trim(),
      done: body.done === true || body.done === "true",
      summaryOnly: body.summaryOnly === true || body.summaryOnly === "true",
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

// ---- Biblioteca (diretórios: pitch / objecao / estrategia) ----
const LIB_DIRS = ["pitch", "objecao", "estrategia"];
function sanitizeLib(body) {
  const dir = String(body.dir || "");
  if (!LIB_DIRS.includes(dir)) return { error: "Diretório inválido." };
  const title = String(body.title || "").trim();
  if (!title) return { error: "Título é obrigatório." };
  return { entry: { id: body.id || uid(), dir, title, body: String(body.body || "").trim(), updatedAt: new Date().toISOString() } };
}

app.get("/api/library", wrap(async (req, res) => {
  res.json(await store.libList(req.query.dir));
}));
app.post("/api/library", wrap(async (req, res) => {
  const { entry, error } = sanitizeLib(req.body);
  if (error) return res.status(400).json({ error });
  res.status(201).json(await store.libCreate(entry));
}));
app.put("/api/library/:id", wrap(async (req, res) => {
  const { entry, error } = sanitizeLib({ ...req.body, id: req.params.id });
  if (error) return res.status(400).json({ error });
  const updated = await store.libUpdate(req.params.id, entry);
  if (!updated) return res.status(404).json({ error: "Item não encontrado." });
  res.json(updated);
}));
app.delete("/api/library/:id", wrap(async (req, res) => {
  const ok = await store.libRemove(req.params.id);
  if (!ok) return res.status(404).json({ error: "Item não encontrado." });
  res.json({ ok: true });
}));

app.get("/api/health", (req, res) => res.json({ ok: true, storage: store.label }));

// Versão do seed: ao mudar, o servidor reaplica as atividades-modelo (substitui
// apenas os registros seed-*; eventos criados pela equipe são preservados).
const SEED_VERSION = "3"; // v3: início/fim + done

// Semeia/atualiza o calendário com o rascunho (seed.json). Desative com SEED=off.
async function seedAndUpgrade() {
  if (process.env.SEED === "off") return;
  const seedPath = path.join(__dirname, "seed.json");
  if (!fs.existsSync(seedPath)) return;
  const applied = await store.getMeta("seedVersion");
  if (applied === SEED_VERSION) return; // já está na versão atual
  let seed;
  try { seed = JSON.parse(fs.readFileSync(seedPath, "utf8")); } catch (e) { return; }
  if (!Array.isArray(seed) || seed.length === 0) return;
  const stamped = seed.map((e) => ({ ...e, updatedAt: new Date().toISOString() }));
  const total = await store.replaceSeed(stamped);
  await store.setMeta("seedVersion", SEED_VERSION);
  console.log(`Seed v${SEED_VERSION} aplicado: ${stamped.length} atividades-modelo (total na base: ${total}).`);
}

// Conteúdo-modelo da Biblioteca
const LIB_SEED_VERSION = "1";
async function seedLibrary() {
  if (process.env.SEED === "off") return;
  const applied = await store.getMeta("libSeedVersion");
  if (applied === LIB_SEED_VERSION) return;
  let seed;
  try { seed = require("./lib-seed"); } catch (e) { return; }
  if (!Array.isArray(seed) || seed.length === 0) return;
  const stamped = seed.map((e) => ({ ...e, updatedAt: new Date().toISOString() }));
  const total = await store.libReplaceSeed(stamped);
  await store.setMeta("libSeedVersion", LIB_SEED_VERSION);
  console.log(`Biblioteca v${LIB_SEED_VERSION}: ${stamped.length} itens-modelo (total: ${total}).`);
}

store.init()
  .then(seedAndUpgrade)
  .then(seedLibrary)
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Calendário de Cobrança rodando na porta ${PORT} — armazenamento: ${store.label}`);
    });
  })
  .catch((e) => {
    console.error("Falha ao inicializar o armazenamento:", e);
    process.exit(1);
  });
