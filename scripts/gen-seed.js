"use strict";

/**
 * Gera seed.json a partir do rascunho "Calendário de Estratégia de Cobrança".
 *
 * Uso: node scripts/gen-seed.js <caminho-do-rascunho.html>
 *
 * Extrai o objeto `data` (programação por dia) embutido no HTML e converte
 * cada linha de horário em uma atividade no formato do calendário.
 */

const fs = require("fs");
const path = require("path");

const src = process.argv[2];
if (!src) { console.error("Informe o caminho do HTML do rascunho."); process.exit(1); }
const html = fs.readFileSync(src, "utf8");

// Extrai o trecho de script que define REPORT_12H/REPORT_18H e data {...}
const m = html.match(/const REPORT_12H[\s\S]*?\n\};\n/);
if (!m) { console.error("Não encontrei o objeto `data` no HTML."); process.exit(1); }
const fn = new Function(m[0] + "\nreturn { data, REPORT_12H, REPORT_18H };");
const { data } = fn();

// 2026-06 — junho
const pad = (n) => String(n).padStart(2, "0");

// Hora inicial a partir de rótulos como "9h00", "9h20-12h00", "12h-13h", "—"
function parseHour(label) {
  const mm = String(label).match(/(\d{1,2})\s*h/);
  if (mm) return Math.max(0, Math.min(23, Number(mm[1])));
  return 18; // tarefas de sistema sem horário ("—") ao fim do expediente
}

// Categoria a partir do ícone Tabler usado no rascunho
function categoryFor(icon, desc) {
  switch (icon) {
    case "ti-phone-call": return "movimento";
    case "ti-shield-check": return "movimento";
    case "ti-mail":
    case "ti-message-2":
    case "ti-microphone":
    case "ti-robot":
    case "ti-bolt": return "volumetria";
    case "ti-chart-bar": return "reuniao";
    case "ti-clipboard-text":
      return /Report de resultados/.test(desc) ? "reuniao" : "outro";
    default: return "outro";
  }
}

function ownerFor(icon) {
  switch (icon) {
    case "ti-phone-call":
    case "ti-shield-check": return "Equipe";
    case "ti-mail":
    case "ti-message-2":
    case "ti-microphone":
    case "ti-robot":
    case "ti-bolt": return "Sistema";
    case "ti-chart-bar":
    case "ti-clipboard-text": return "Gestão";
    default: return "";
  }
}

function titleFrom(label, desc) {
  let t = desc.split(": ")[0];
  if (t === desc) t = desc.split(/ — | – /)[0];
  t = t.trim();
  if (t.length > 72) t = t.slice(0, 71) + "…";
  // prefixa o intervalo quando o rótulo tem faixa horária (ex.: 9h20-12h00)
  if (/-/.test(label)) t = `(${label}) ${t}`;
  return t;
}

function objectionsFor(icon, desc) {
  if (icon === "ti-clipboard-text" && /Report de resultados do dia/.test(desc)) {
    return "Análise de objeções: levantamento dos motivos de recusa mais frequentes do dia, usado para ajustar pitch e priorização do dia seguinte.";
  }
  if (/classifica[: ]|classificação de obstáculo|pergunta de obstáculo/i.test(desc)) {
    return "Classificação de obstáculo: falta de dinheiro / esquecimento / insatisfação / outro.";
  }
  return "";
}

const events = [];
const days = Object.keys(data).map(Number).sort((a, b) => a - b);

// Volumetria estimada a partir do tamanho das faixas (base real do rascunho)
const FAIXA = { 1: 188, 2: 299, 3: 92, 4: 19 }; // total 598
function computeVolume(icon, desc) {
  const dispatch = ["ti-phone-call", "ti-mail", "ti-message-2", "ti-microphone", "ti-robot", "ti-bolt", "ti-gavel"];
  if (!dispatch.includes(icon)) return ""; // reports, ação preventiva, tags etc. sem volume
  if (/F1\s*[-–]\s*F4/.test(desc)) return 598;                                  // "(F1-F4)" = toda a base
  if (/100%\s*d(a|os)\s*(base|casos)|toda\s+a?\s*base|todas as faixas/i.test(desc)) return 598;
  const toks = new Set((desc.match(/F([1-4])/g) || []).map((s) => Number(s[1])));
  if (toks.size) { let v = 0; toks.forEach((n) => (v += FAIXA[n])); return v; }   // soma das faixas citadas
  if (/100%/.test(desc)) return 598;                                            // dispatch p/ "100%" sem faixa
  return "";
}

for (const day of days) {
  const item = data[day];
  const date = `2026-06-${pad(day)}`;
  const metricsLine = (item.m || []).map((mm) => `${mm[0]} ${mm[1]}`).join(" · ");
  let firstPhoneUsed = false;

  (item.h || []).forEach((hh, idx) => {
    const [label, icon, desc] = hh;
    const hour = parseHour(label);
    const cat = categoryFor(icon, desc);
    const ev = {
      // id determinístico para o seed ser idempotente
      id: `seed-${date}-${idx}`,
      date,
      hour,
      cat,
      title: titleFrom(label, desc),
      owner: ownerFor(icon),
      volume: computeVolume(icon, desc),
      pitch: "",
      objections: objectionsFor(icon, desc),
      notes: desc,
    };
    // Anexa o pitch do dia ao primeiro bloco de ligação
    if (icon === "ti-phone-call" && !firstPhoneUsed && item.p) {
      ev.pitch = item.p;
      firstPhoneUsed = true;
    }
    // Resumo do dia (faixas/cobertura) no primeiro evento
    if (idx === 0 && metricsLine) {
      ev.notes = `[${item.t}]\nIndicadores do dia: ${metricsLine}.\n\n${desc}`;
    }
    events.push(ev);
  });
}

const out = path.join(__dirname, "..", "seed.json");
fs.writeFileSync(out, JSON.stringify(events, null, 2), "utf8");
console.log(`Gerados ${events.length} eventos em ${out} (dias ${days[0]}–${days[days.length - 1]}/06).`);
