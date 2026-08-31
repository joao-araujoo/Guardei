from pathlib import Path

schema_path = Path('server/prisma/schema.prisma')
schema = schema_path.read_text()

for relation in [
    '  integrationAccounts    IntegrationAccount[]\n',
    '  integrationLinks       IntegrationLink[]\n',
]:
    if relation not in schema:
        raise SystemExit(f'Expected relation not found: {relation.strip()}')
    schema = schema.replace(relation, '')


def remove_model(text, model_name):
    marker = f'\nmodel {model_name} {{'
    start = text.find(marker)
    if start < 0:
        raise SystemExit(f'Model {model_name} not found')
    brace = text.find('{', start)
    depth = 0
    end = None
    for index in range(brace, len(text)):
        char = text[index]
        if char == '{':
            depth += 1
        elif char == '}':
            depth -= 1
            if depth == 0:
                end = index + 1
                break
    if end is None:
        raise SystemExit(f'Could not find end of model {model_name}')
    while end < len(text) and text[end] == '\n':
        end += 1
    return text[:start] + '\n' + text[end:]

schema = remove_model(schema, 'IntegrationAccount')
schema = remove_model(schema, 'IntegrationLink')

for token in ['IntegrationAccount', 'IntegrationLink', 'integrationAccounts', 'integrationLinks']:
    if token in schema:
        raise SystemExit(f'Orphan integration token remains in schema: {token}')

schema_path.write_text(schema)

migration_dir = Path('server/prisma/migrations/20260831005500_remove_unused_integration_scaffolding')
migration_dir.mkdir(parents=True, exist_ok=True)
(migration_dir / 'migration.sql').write_text('''-- Remove generic integration scaffolding that has no runtime consumer.\n-- Kept as a forward migration so environments that already applied Everywhere stay consistent.\n\nDROP TABLE IF EXISTS "IntegrationLink";\nDROP TABLE IF EXISTS "IntegrationAccount";\n''')

# Record this product invariant for future agents.
agents_path = Path('AGENTS.md')
agents = agents_path.read_text()
invariant = '''\n### Product data invariant: consumir != aplicar\n\n- `watchedAt` / `consumedAt` mean the user consumed the content.\n- `applicationStatus`, `appliedAt` and application commitments mean the user actually applied something.\n- Never set `status: aplicado` merely because a video/link was watched, opened, reviewed or marked as seen.\n- Any new Guardinho action that mutates consumption/application state must have a regression test for this distinction.\n'''
if '### Product data invariant: consumir != aplicar' not in agents:
    agents += invariant
agents_path.write_text(agents)

# Keep README aligned with the actual final validation and product surface.
readme_path = Path('README.md')
readme = readme_path.read_text()
readme = readme.replace(
    '- Central Hoje com sessões por tempo disponível.',
    '- Central Hoje com sessões por tempo disponível e progresso real da meta diária de revisão.'
)
readme = readme.replace(
    '- token de captura restrito para a extensão do navegador.',
    '- token de captura restrito para a extensão do navegador, com pausa global e revogação individual.'
)
readme = readme.replace(
    '- coleções públicas com slug próprio;',
    '- coleções públicas com slug próprio e exclusão com confirmação segura;'
)
readme = readme.replace(
    '- instalação frontend/backend;\n- geração do Prisma Client;',
    '- instalação limpa frontend/backend com `npm ci`;\n- `npm audit` frontend/backend em nível high;\n- geração do Prisma Client;'
)
readme_path.write_text(readme)
