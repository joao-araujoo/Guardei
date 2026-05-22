export const CATEGORIES = [
  {
    id: 'dev',
    label: 'Dev',
    emoji: '💻',
    accent: '#c77dff',
    gradient: 'linear-gradient(135deg,#0d0020,#3a1260,#7b2fff55)',
    keywords: [
      'programação', 'programacao', 'dev', 'developer', 'desenvolvedor', 'código', 'codigo', 'javascript',
      'typescript', 'react', 'next', 'node', 'api', 'backend', 'frontend', 'css', 'html', 'prisma', 'sql',
      'mysql', 'postgres', 'firebase', 'github', 'deploy', 'vite', 'bug', 'terminal', 'framework', 'biblioteca'
    ]
  },
  {
    id: 'tech',
    label: 'Tech',
    emoji: '⚙️',
    accent: '#00d4ff',
    gradient: 'linear-gradient(135deg,#00121f,#003566,#00b4d855)',
    keywords: [
      'tech', 'tecnologia', 'ia', 'ai', 'chatgpt', 'openai', 'claude', 'app', 'software', 'startup',
      'automação', 'automacao', 'produtividade', 'ferramenta', 'sistema', 'notion', 'celular', 'iphone',
      'android', 'windows', 'mac', 'prompt', 'agente', 'workflow'
    ]
  },
  {
    id: 'design',
    label: 'Design',
    emoji: '🎨',
    accent: '#ff6b9d',
    gradient: 'linear-gradient(135deg,#1a0008,#5c1232,#ff6b9d55)',
    keywords: [
      'design', 'ux', 'ui', 'figma', 'interface', 'landing page', 'logo', 'branding', 'marca', 'visual',
      'typography', 'tipografia', 'paleta', 'layout', 'portfolio', 'portfólio', 'animação', 'animacao',
      'motion', 'minimalista', 'cards', 'grid'
    ]
  },
  {
    id: 'mente',
    label: 'Mente',
    emoji: '🧠',
    accent: '#a5b4fc',
    gradient: 'linear-gradient(135deg,#060826,#25234e,#a5b4fc4f)',
    keywords: [
      'mente', 'psicologia', 'ansiedade', 'disciplina', 'hábitos', 'habitos', 'foco', 'procrastinação',
      'procrastinacao', 'rotina', 'estudo', 'motivação', 'motivacao', 'reflexão', 'reflexao', 'vida',
      'relacionamento', 'comportamento', 'aprendizado', 'produtivo', 'autoconhecimento'
    ]
  },
  {
    id: 'grana',
    label: 'Grana',
    emoji: '💸',
    accent: '#06d6a0',
    gradient: 'linear-gradient(135deg,#001a0d,#0d3a1f,#06d6a055)',
    keywords: [
      'dinheiro', 'grana', 'finanças', 'financas', 'investimento', 'renda', 'preço', 'preco', 'venda',
      'negócio', 'negocio', 'cliente', 'empreendedorismo', 'freela', 'freelancer', 'contrato', 'orçamento',
      'orcamento', 'lucro', 'marketing', 'tráfego', 'trafego', 'proposta'
    ]
  },
  {
    id: 'corpo',
    label: 'Corpo',
    emoji: '🏃',
    accent: '#ffd166',
    gradient: 'linear-gradient(135deg,#1a0b00,#5c3500,#ffd16655)',
    keywords: [
      'corpo', 'treino', 'academia', 'saúde', 'saude', 'sono', 'alimentação', 'alimentacao', 'dieta',
      'exercício', 'exercicio', 'cardio', 'musculação', 'musculacao', 'postura', 'alongamento', 'corrida',
      'bem-estar', 'energia'
    ]
  },
  {
    id: 'ideias',
    label: 'Ideias',
    emoji: '✨',
    accent: '#f72585',
    gradient: 'linear-gradient(135deg,#1b0028,#4d006f,#f7258550)',
    keywords: [
      'ideia', 'inspiração', 'inspiracao', 'referência', 'referencia', 'criativo', 'conteúdo', 'conteudo',
      'roteiro', 'hook', 'viral', 'storytelling', 'copy', 'tendência', 'tendencia', 'exemplo', 'case',
      'modelo', 'template'
    ]
  },
  {
    id: 'musica',
    label: 'Musica',
    emoji: '🎧',
    accent: '#1db954',
    gradient: 'linear-gradient(135deg,#06140b,#12351f,#1db95466)',
    keywords: [
      'musica', 'playlist', 'spotify', 'album', 'artista', 'banda', 'show', 'dj', 'track', 'podcast',
      'audio', 'soundtrack', 'instrumental', 'lofi', 'mix', 'ep', 'single'
    ]
  },
  {
    id: 'cultura',
    label: 'Cultura',
    emoji: '🍿',
    accent: '#ff8a00',
    gradient: 'linear-gradient(135deg,#1f0d00,#613800,#ff8a0060)',
    keywords: [
      'filme', 'serie', 'netflix', 'documentario', 'livro', 'jogo', 'game', 'cinema', 'trailer',
      'entretenimento', 'review', 'critica', 'cultura', 'historia', 'arte'
    ]
  },
  {
    id: 'misc',
    label: 'Misc',
    emoji: '📌',
    accent: '#8b8ba7',
    gradient: 'linear-gradient(135deg,#11111d,#25253a,#8b8ba740)',
    keywords: []
  }
];

export const CATEGORY_BY_ID = Object.fromEntries(CATEGORIES.map(category => [category.id, category]));

export const REASONS = [
  { id: 'aprender', label: 'Aprender', emoji: '🧠', keywords: ['tutorial', 'aula', 'aprenda', 'aprender', 'dica', 'explica', 'guia', 'passo a passo', 'curso'] },
  { id: 'aplicar', label: 'Aplicar', emoji: '🛠️', keywords: ['usar', 'aplicar', 'implementar', 'projeto', 'código', 'codigo', 'fazer', 'build', 'criar'] },
  { id: 'inspirar', label: 'Inspirar', emoji: '✨', keywords: ['inspiração', 'inspiracao', 'ideia', 'referência', 'referencia', 'design', 'modelo', 'exemplo'] },
  { id: 'comprar', label: 'Comprar', emoji: '🛒', keywords: ['comprar', 'produto', 'preço', 'preco', 'review', 'vale a pena', 'oferta'] },
  { id: 'refletir', label: 'Refletir', emoji: '💭', keywords: ['vida', 'mente', 'reflexão', 'reflexao', 'ansiedade', 'rotina', 'hábito', 'habito'] },
  { id: 'guardar', label: 'Guardar', emoji: '📌', keywords: [] }
];

export const STATUS = {
  inbox: { label: 'Inbox', emoji: '📥' },
  novo: { label: 'Novo', emoji: '🆕' },
  rever: { label: 'Rever', emoji: '🔁' },
  importante: { label: 'Importante', emoji: '⭐' },
  aplicado: { label: 'Aplicado', emoji: '✅' },
  arquivado: { label: 'Arquivado', emoji: '🗄️' }
};
