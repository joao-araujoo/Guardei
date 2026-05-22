# Guardei - Acervo com IA

PWA para guardar qualquer link da internet e transformar tudo em um acervo organizado: videos, musicas, threads, artigos, posts, repositorios, produtos e ideias.

## O que faz

- Salva links manualmente, pelo clipboard ou pelo compartilhar do celular.
- Detecta plataformas conhecidas como TikTok, YouTube, X/Twitter, Spotify, Instagram, Reddit, Pinterest, LinkedIn, Substack, Medium, GitHub, Twitch e Netflix.
- Usa IA ou heuristica local para sugerir titulo, categoria, tags, prioridade, humor, esforco e melhor momento para abrir.
- Recomenda um item conforme tempo livre, humor e plataforma.
- Mantem backup/importacao JSON e estrutura pronta para backend via API.

## Rodar o frontend

```bash
npm install
npm run dev
```

## Backend opcional

```bash
cd server
npm install
npm run db:generate
npm run db:push
npm run dev
```

Variaveis uteis:

```env
VITE_STORAGE_MODE=api
VITE_API_BASE_URL=http://localhost:3333
DATABASE_URL=connection_string_pooled_do_neon
DATABASE_DIRECT_URL=connection_string_direta_do_neon
GEMINI_API_KEY=sua_chave_gemini
```

Com `VITE_STORAGE_MODE=api`, os links sao salvos no banco pelo backend. Sem essa variavel, o app continua funcionando com `localStorage`.
