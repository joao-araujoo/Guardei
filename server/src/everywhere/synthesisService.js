import { hybridSearch } from "../search/searchService.js";

export async function synthesizeKnowledge(prisma, userId, query) {
  const q = String(query || "").replace(/[\u0000-\u001F]/g, " ").trim().slice(0, 1000);
  if (!q) { const error = new Error("Informe o assunto que voce quer recuperar."); error.status = 400; throw error; }
  const search = await hybridSearch({ prisma, userId, params: { q, limit: 14, mode: "hybrid" } });
  const items = search.results.map(result => result.item);
  const concepts = countTerms(items.flatMap(item => Array.isArray(item.capsule?.concepts) ? item.capsule.concepts : []).map(String));
  const points = unique(items.flatMap(item => Array.isArray(item.capsule?.keyPoints) ? item.capsule.keyPoints : []).map(String)).slice(0, 8);
  const applications = unique(items.flatMap(item => Array.isArray(item.capsule?.practicalApplications) ? item.capsule.practicalApplications : []).map(String)).slice(0, 5);
  const themes = concepts.slice(0, 6).map(([name, count]) => ({ name, count }));
  const summaries = items.map(item => item.capsule?.summary || item.summary || item.note).filter(Boolean).slice(0, 5);
  const summary = items.length
    ? `Encontrei ${items.length} itens do seu acervo relacionados a “${q}”. ${themes.length ? `Os temas que mais se repetem sao ${themes.slice(0, 3).map(item => item.name).join(", ")}.` : "As fontes parecem relacionadas, mas ainda faltam conceitos estruturados."}`
    : `Nao encontrei base suficiente no seu Guardei para responder sobre “${q}”.`;
  return {
    query: q,
    summary,
    themes,
    keyPoints: points.length ? points : summaries,
    applications,
    sources: search.results.slice(0, 10).map(result => ({ id: result.item.id, title: result.item.titleCustom || result.item.titleAi || result.item.titleOriginal, url: result.item.url, score: result.score, reasons: result.reasons })),
    gaps: items.length < 3 ? ["Seu acervo ainda tem poucas fontes sobre este assunto."] : [],
    mode: search.mode,
  };
}

function unique(values) { return [...new Set(values.map(value => value.replace(/\s+/g, " ").trim()).filter(value => value.length >= 3))]; }
function countTerms(values) { const map = new Map(); for (const value of values) { const key = value.trim(); if (key) map.set(key, (map.get(key) || 0) + 1); } return [...map.entries()].sort((a, b) => b[1] - a[1]); }
