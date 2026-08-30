const CATEGORY_LABELS = { dev: "Dev", tech: "Tecnologia", design: "Design", mente: "Mentalidade", grana: "Financeiro", corpo: "Saude", ideias: "Inspiracao", musica: "Musica", cultura: "Entretenimento", misc: "Geral" };

export async function buildAutomaticSpaces(prisma, userId) {
  const videos = await prisma.video.findMany({ where: { userId, status: { not: "arquivado" } }, select: { id: true, category: true, tags: true, titleAi: true, titleCustom: true, capsule: { select: { concepts: true } } }, orderBy: { updatedAt: "desc" }, take: 600 });
  const groups = new Map();
  for (const video of videos) {
    add(groups, `cat:${video.category}`, CATEGORY_LABELS[video.category] || video.category, video.id, "Categoria que aparece naturalmente no seu acervo.");
    const concepts = Array.isArray(video.capsule?.concepts) ? video.capsule.concepts : [];
    for (const concept of concepts.slice(0, 4)) {
      const name = String(concept).trim(); if (name.length >= 3) add(groups, `concept:${normalize(name)}`, name, video.id, "Conceito recorrente encontrado nas suas Capsulas.");
    }
    for (const tag of (video.tags || []).slice(0, 5)) {
      const name = String(tag).replace(/[-_]/g, " ").trim(); if (name.length >= 4) add(groups, `tag:${normalize(name)}`, name, video.id, "Tema recorrente nas tags do acervo.");
    }
  }
  return [...groups.entries()].map(([id, group]) => ({ id, ...group, count: group.itemIds.length })).filter(group => group.count >= 2).sort((a, b) => b.count - a.count || a.name.localeCompare(b.name)).slice(0, 12);
}

function add(map, id, name, itemId, reason) { const current = map.get(id) || { name, reason, itemIds: [] }; if (!current.itemIds.includes(itemId)) current.itemIds.push(itemId); map.set(id, current); }
function normalize(value) { return String(value).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80); }
