import { GoogleGenAI, Type } from "@google/genai";

const CATEGORIES = ["dev", "tech", "design", "mente", "grana", "corpo", "ideias", "musica", "cultura", "misc"];
const REASONS = ["aprender", "aplicar", "inspirar", "comprar", "refletir", "guardar"];
const PRIORITIES = ["baixa", "media", "alta"];
const MOODS = ["leve", "neutro", "focado", "criativo"];
const EFFORTS = ["baixo", "medio", "alto"];
const DURATIONS = ["short", "medium", "long", "unknown"];

const CATEGORY_KEYWORDS = {
  dev: ["react", "javascript", "typescript", "node", "next", "programacao", "codigo", "frontend", "backend", "api", "developer", "dev", "prisma", "sql"],
  tech: ["ia", "ai", "inteligencia artificial", "chatgpt", "gemini", "claude", "automacao", "ferramenta", "startup", "tech", "software", "app"],
  design: ["design", "ui", "ux", "interface", "landing page", "figma", "logo", "branding", "visual", "layout"],
  grana: ["dinheiro", "financa", "investimento", "renda", "vendas", "negocio", "empreender", "marketing", "cliente"],
  corpo: ["academia", "treino", "corpo", "saude", "dieta", "sono", "shape", "corrida", "postura"],
  mente: ["mentalidade", "disciplina", "produtividade", "foco", "ansiedade", "rotina", "habito", "vida"],
  ideias: ["ideia", "inspiracao", "referencia", "conteudo", "roteiro", "hook", "viral", "storytelling", "template"],
  musica: ["musica", "spotify", "playlist", "album", "artista", "banda", "podcast", "track", "show", "audio"],
  cultura: ["filme", "serie", "netflix", "documentario", "livro", "jogo", "game", "cinema", "trailer", "cultura"]
};

export const fallbackClassification = ({ url, title = "", description = "", platform = "tiktok" }) => {
  const text = normalize(`${url} ${title} ${description}`);
  const tags = new Set([platform]);
  let category = "misc";
  let reason = "guardar";
  let priority = "baixa";

  for (const [id, words] of Object.entries(CATEGORY_KEYWORDS)) {
    if (words.some((word) => text.includes(word))) {
      category = id;
      tags.add(id);
      break;
    }
  }

  if (hasAny(text, ["tutorial", "aula", "aprenda", "guia", "passo a passo"])) reason = "aprender";
  if (hasAny(text, ["usar", "aplicar", "implementar", "projeto", "fazer", "criar"])) reason = "aplicar";
  if (hasAny(text, ["inspiracao", "ideia", "referencia", "modelo", "exemplo"])) reason = "inspirar";
  if (hasAny(text, ["comprar", "produto", "preco", "review", "oferta"])) reason = "comprar";
  if (hasAny(text, ["vida", "mente", "reflexao", "ansiedade", "rotina", "habito"])) reason = "refletir";

  if (hasAny(text, ["urgente", "importante", "preciso fazer", "usar depois", "projeto"])) priority = "alta";
  else if (category !== "misc") priority = "media";

  const durationBucket = platform === "tiktok" || platform === "spotify" || /\/shorts\//i.test(url) ? "short" : "medium";
  const effort = hasAny(text, ["aula", "tutorial", "guia", "estrategia", "analise", "curso"]) ? "alto" : durationBucket === "short" ? "baixo" : "medio";
  const mood = effort === "baixo" ? "leve" : category === "design" || category === "ideias" ? "criativo" : "neutro";
  const titleAi = title && title.trim().length > 0 ? title.trim().slice(0, 90) : `Link salvo de ${platformLabel(platform)}`;
  const summary = `${platformLabel(platform)} para ${reason}; ${effort === "baixo" ? "leve e rapido" : "pede um pouco mais de atencao"}.`;

  return {
    titleAi,
    category,
    reason,
    priority,
    tags: [...tags].slice(0, 8),
    summary,
    note: summary,
    mood,
    effort,
    durationBucket,
    bestFor: effort === "baixo" ? "Assistir sem pensar muito" : reason === "aplicar" ? "Transformar em acao" : "Revisar com atencao",
    watchWhen: durationBucket === "short" ? "Quando tiver 2 a 5 minutos livres" : "Quando tiver 10 a 20 minutos",
    confidence: category === "misc" ? 0.42 : 0.68,
    rationale: "Classificacao local por palavras-chave e metadados publicos."
  };
};

export async function classifyVideoWithGemini({
  url,
  title = "",
  description = "",
  author = "",
  platform = "tiktok",
}) {
  const fallback = fallbackClassification({ url, title, description, platform });

  if (!process.env.GEMINI_API_KEY) return fallback;

  const ai = new GoogleGenAI({
    apiKey: process.env.GEMINI_API_KEY,
  });

  const model = process.env.GEMINI_MODEL || "gemini-3.1-flash-lite";
  const prompt = `
Voce e uma IA organizadora de um acervo pessoal de links salvos.

Analise somente os metadados abaixo e retorne JSON curto, barato e util. Nao invente fatos que nao estejam nos dados.

Plataforma: ${platform}
URL: ${url || ""}
Titulo original: ${title || ""}
Descricao/legenda: ${description || ""}
Autor/canal: ${author || ""}

Objetivo do app:
- Ajudar a pessoa a decidir o que abrir, assistir, ouvir ou ler conforme tempo livre, humor e energia mental.
- Criar uma nota inicial para lembrar por que o link foi salvo.
- Organizar videos, musicas, threads, artigos, repositorios e posts no mesmo acervo.

Categorias permitidas: ${CATEGORIES.join(", ")}.
Motivos permitidos: ${REASONS.join(", ")}.
Prioridades: ${PRIORITIES.join(", ")}.
Humor: ${MOODS.join(", ")}.
Esforco mental: ${EFFORTS.join(", ")}.
Tempo: short, medium, long ou unknown. Use short para posts, musicas e videos curtos quando nao houver duracao.
`;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: prompt,
      config: {
        temperature: 0.2,
        maxOutputTokens: 420,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            titleAi: { type: Type.STRING },
            category: { type: Type.STRING, enum: CATEGORIES },
            reason: { type: Type.STRING, enum: REASONS },
            priority: { type: Type.STRING, enum: PRIORITIES },
            tags: { type: Type.ARRAY, items: { type: Type.STRING } },
            summary: { type: Type.STRING },
            note: { type: Type.STRING },
            mood: { type: Type.STRING, enum: MOODS },
            effort: { type: Type.STRING, enum: EFFORTS },
            durationBucket: { type: Type.STRING, enum: DURATIONS },
            bestFor: { type: Type.STRING },
            watchWhen: { type: Type.STRING },
            confidence: { type: Type.NUMBER },
            rationale: { type: Type.STRING },
          },
          required: ["titleAi", "category", "reason", "priority", "tags", "summary", "note", "mood", "effort", "durationBucket", "bestFor", "watchWhen"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");

    return {
      titleAi: clamp(parsed.titleAi, fallback.titleAi, 90),
      category: CATEGORIES.includes(parsed.category) ? parsed.category : fallback.category,
      reason: REASONS.includes(parsed.reason) ? parsed.reason : fallback.reason,
      priority: PRIORITIES.includes(parsed.priority) ? parsed.priority : fallback.priority,
      tags: normalizeTags(parsed.tags, fallback.tags),
      summary: clamp(parsed.summary, fallback.summary, 180),
      note: clamp(parsed.note, parsed.summary || fallback.note, 240),
      mood: MOODS.includes(parsed.mood) ? parsed.mood : fallback.mood,
      effort: EFFORTS.includes(parsed.effort) ? parsed.effort : fallback.effort,
      durationBucket: DURATIONS.includes(parsed.durationBucket) ? parsed.durationBucket : fallback.durationBucket,
      bestFor: clamp(parsed.bestFor, fallback.bestFor, 90),
      watchWhen: clamp(parsed.watchWhen, fallback.watchWhen, 90),
      confidence: Number.isFinite(parsed.confidence) ? Math.max(0, Math.min(1, parsed.confidence)) : 0.78,
      rationale: clamp(parsed.rationale, "Classificado com Gemini a partir dos metadados publicos.", 160),
    };
  } catch (error) {
    console.error("Erro ao classificar com Gemini:", error);
    return fallback;
  }
}

export async function classifyTikTokWithGemini(payload) {
  const result = await classifyVideoWithGemini({ ...payload, platform: "tiktok" });
  return {
    title_ai: result.titleAi,
    category: labelize(result.category),
    reason: labelize(result.reason),
    priority: result.priority,
    tags: result.tags,
    summary: result.summary,
  };
}

function hasAny(text, words) {
  return words.some((word) => text.includes(normalize(word)));
}

function normalize(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function normalizeTags(tags, fallback) {
  if (!Array.isArray(tags)) return fallback;
  const clean = tags
    .map((tag) => normalize(tag).replace(/\s+/g, "-"))
    .filter(Boolean)
    .slice(0, 8);
  return clean.length ? [...new Set(clean)] : fallback;
}

function clamp(value, fallback, max) {
  const text = String(value || fallback || "").trim();
  return text.length > max ? text.slice(0, max - 3).trim() + "..." : text;
}

function labelize(value) {
  return String(value || "").charAt(0).toUpperCase() + String(value || "").slice(1);
}

function platformLabel(platform) {
  const labels = {
    youtube: "YouTube",
    tiktok: "TikTok",
    twitter: "X/Twitter",
    instagram: "Instagram",
    spotify: "Spotify",
    pinterest: "Pinterest",
    reddit: "Reddit",
    linkedin: "LinkedIn",
    substack: "Substack",
    medium: "Medium",
    github: "GitHub",
    netflix: "Netflix",
    twitch: "Twitch",
    web: "Internet",
  };
  return labels[platform] || "Internet";
}
