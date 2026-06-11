"use strict";

/**
 * Smoke test: sobe o servidor (backend de arquivo) e verifica os principais
 * endpoints da API. Sem dependências externas — usa apenas o módulo http.
 * Sai com código 0 em sucesso, 1 em falha.
 */

const { spawn } = require("child_process");
const http = require("http");
const os = require("os");
const path = require("path");
const fs = require("fs");

const PORT = 3199;
const BASE = `http://127.0.0.1:${PORT}`;
const DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "cal-smoke-"));

function request(method, urlPath, body) {
  return new Promise((resolve, reject) => {
    const data = body ? JSON.stringify(body) : null;
    const req = http.request(BASE + urlPath, {
      method,
      headers: { "Content-Type": "application/json" },
    }, (res) => {
      let buf = "";
      res.on("data", (c) => (buf += c));
      res.on("end", () => {
        let json = null;
        try { json = buf ? JSON.parse(buf) : null; } catch (e) { /* keep raw */ }
        resolve({ status: res.statusCode, json, raw: buf });
      });
    });
    req.on("error", reject);
    if (data) req.write(data);
    req.end();
  });
}

function wait(ms) { return new Promise((r) => setTimeout(r, ms)); }

function assert(cond, msg) {
  if (!cond) throw new Error("FALHA: " + msg);
  console.log("  ok: " + msg);
}

async function main() {
  const server = spawn(process.execPath, [path.join(__dirname, "..", "server.js")], {
    env: { ...process.env, PORT: String(PORT), DATA_DIR, DATABASE_URL: "" },
    stdio: ["ignore", "inherit", "inherit"],
  });

  let failed = null;
  try {
    // Aguarda o servidor responder
    let up = false;
    for (let i = 0; i < 30; i++) {
      try { const h = await request("GET", "/api/health"); if (h.status === 200) { up = true; break; } }
      catch (e) { /* ainda subindo */ }
      await wait(200);
    }
    assert(up, "servidor respondeu em /api/health");

    const health = await request("GET", "/api/health");
    assert(health.json && health.json.ok === true, "health retorna ok");

    const created = await request("POST", "/api/events", {
      date: "2026-06-12", hour: 9, cat: "pitch", title: "Smoke test", owner: "CI", volume: 10,
    });
    assert(created.status === 201 && created.json.id, "POST /api/events cria atividade");
    const id = created.json.id;

    const list = await request("GET", "/api/events?from=2026-06-01&to=2026-06-30");
    assert(Array.isArray(list.json) && list.json.some((e) => e.id === id), "GET /api/events lista a atividade criada");

    const bad = await request("POST", "/api/events", { date: "2026-06-12", hour: 9 });
    assert(bad.status === 400, "POST sem título é rejeitado (400)");

    const upd = await request("PUT", "/api/events/" + id, {
      date: "2026-06-12", hour: 10, cat: "pitch", title: "Smoke editado",
    });
    assert(upd.status === 200 && upd.json.title === "Smoke editado", "PUT atualiza a atividade");

    const del = await request("DELETE", "/api/events/" + id);
    assert(del.status === 200 && del.json.ok === true, "DELETE remove a atividade");

    console.log("\nTodos os smoke tests passaram.");
  } catch (e) {
    failed = e;
    console.error("\n" + e.message);
  } finally {
    server.kill();
    try { fs.rmSync(DATA_DIR, { recursive: true, force: true }); } catch (e) { /* noop */ }
  }
  process.exit(failed ? 1 : 0);
}

main();
