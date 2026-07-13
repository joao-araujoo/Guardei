# Cápsulas Inteligentes

A funcionalidade de Cápsulas Inteligentes transforma um item salvo em conhecimento estruturado sem afirmar que acessou dados indisponíveis.

## Fluxo

1. A rota autenticada confirma que o item pertence ao usuário da sessão.
2. Texto fornecido pelo usuário tem prioridade e recebe cobertura `user_content`.
3. Plataformas restritas ou modo `metadata_only` usam apenas metadados existentes.
4. Para outras páginas, o extrator valida URL, DNS e cada redirecionamento, baixa somente tipos permitidos e sanitiza o conteúdo sem executar scripts.
5. O Gemini recebe uma fonte delimitada como não confiável e retorna JSON estruturado.
6. O backend normaliza tamanhos, quantidades, confiança, evidências e cobertura antes de persistir.
7. Na ausência de chave do Gemini, o sistema mantém um fallback extrativo local e deixa o modelo usado explícito.

## Coberturas

- `full_content`: texto público completo obtido e normalizado.
- `partial_content`: download ou extração truncada.
- `user_content`: texto, transcrição ou anotação fornecida pelo usuário.
- `metadata_only`: somente título, descrição, autor, tags, notas e URL.

`metadata_only` e `partial_content` geram status `limited`. As demais coberturas geram `completed` quando a geração termina.

## Estados

- `idle`
- `extracting`
- `generating`
- `completed`
- `limited`
- `failed`

## Endpoints

Todos exigem o cookie de sessão válido e ignoram qualquer `userId` enviado pelo cliente.

- `GET /api/videos/:id/capsule`
- `POST /api/videos/:id/capsule`
- `POST /api/videos/:id/capsule/regenerate`
- `DELETE /api/videos/:id/capsule`

Payload opcional de criação e regeneração:

```json
{
  "sourceText": "Texto ou transcrição fornecida pelo usuário",
  "analysisMode": "auto",
  "forceRegenerate": false
}
```

## Variáveis

- `GEMINI_API_KEY`: chave somente no backend.
- `GEMINI_CAPSULE_MODEL`: modelo autorizado para cápsulas; o frontend não escolhe o modelo.
- `GEMINI_MODEL`: fallback para o modelo já usado no projeto.
- `CORS_ORIGIN`: lista separada por vírgulas de origens permitidas.

## Migração

A migração `20260713010000_add_content_capsules` apenas cria enums, tabela, chaves estrangeiras e índices. Nenhuma coluna existente é removida ou tornada obrigatória.

Em ambientes que utilizam migrações versionadas:

```bash
cd server
npx prisma migrate deploy
npx prisma generate
```

O fluxo atual de deploy com `prisma db push` também reconhece o novo modelo sem destruir os registros existentes.

## Limites e segurança

- Corpo JSON global: 256 KB.
- Texto normalizado persistido: até 80.000 caracteres.
- Download remoto: até 1,5 MB.
- Redirecionamentos: até 3.
- Timeout de extração: 8 segundos por requisição remota.
- Timeout de geração da cápsula: 30 segundos.
- Criação/regeneração/exclusão: 8 operações por hora por usuário e IP.
- Rotas gerais de IA: 30 operações por 10 minutos por usuário e IP.
- Chat do Guardinho: 20 operações por 10 minutos dentro do limite geral.

O rate limiter é local ao processo para não adicionar infraestrutura paga. Em deploy horizontal, ele deve ser substituído por um armazenamento compartilhado compatível com a mesma interface.

## Testes

Execute:

```bash
npm --prefix server test
npm run build
```

A suíte cobre bloqueio de redes privadas, redirecionamentos, limite e sanitização, propriedade, payload, normalização estruturada, rate limiting, fallback de IA e criação por metadados ou texto do usuário.
