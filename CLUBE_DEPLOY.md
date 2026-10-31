# Clube PTP — identidade (homologação)
Esta branch não modifica a main. O serviço Render de identidade é isolado.

## Configuração
- Banco PostgreSQL gerenciado com TLS, **DATABASE_URL** exclusivamente em segredo de ambiente no Render.
- Origem CORS: PTP_CORS_ORIGINS=https://headless-bnbjhenmacf-pedrousinae-140b.wix-site-host.com
- Instalar: pip install -r clube_requirements.txt
- Migrar uma única vez com acesso autorizado: python clube_migrate.py
- Bootstrap institucional controlado: PTP_ADMIN_EMAIL + senha forte >=16 caracteres fornecidos como segredos, python clube_bootstrap_admin.py, remover PTP_ADMIN_PASSWORD em seguida.
- Iniciar: uvicorn clube_api:app --host 0.0.0.0 --port $PORT
- /health indica vida do processo; /ready só retorna 200 com DB e tabelas.
- A conta de gestor deve aguardar homologação da empresa, contrato e validação financeira no fluxo administrativo.

## Impedimentos para produção
- Convites são registrados, mas o provedor de envio de emails não está integrado; não divulgar links de convite sem canal seguro.
- Recuperação de senha, MFA, rate limiting, controles de resgate e monitoramento transacional não foram concluídos neste serviço.
- Não conectar o login público Wix nem cadastrar CPFs/usuários reais antes de testes de segurança e recuperação operacional.
- O banco gratuito Render expira em 2026-11-30. Definir plano gerenciado e política de backups antes do uso real.
- As rotas administrativas retornam somente 200 registros por consulta; adicionar paginação para escala.

## Testes de homologação
Validar /health, /ready, ausência de login com usuário inativo, convites de gestor restritos à empresa, ativação administrativa, revogação e consulta de auditoria. Não usar dados reais.
