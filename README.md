# PTP Backend

Serviço Node.js para recebimento de solicitações do PTP e gravação em Wix CMS. Mantém o frontend Wix existente.

## Estrutura
- `package.json` — scripts `npm start` e `npm test`
- `src/server.js` — GET `/health`, POST `/api/requests`
- `tests/server.test.js` — testes automatizados
- `render.yaml` — configuração Render Blueprint

## Publicação
1. Envie **todos os arquivos e a pasta `src`** à raiz da branch `main` de `https://github.com/Chamochumbi/ptp-backend` (não envie apenas o ZIP).
2. No Render, configurar `Build Command: npm install --omit=dev`, `Start Command: npm start`; Node.js 22+.
3. Configurar `WIX_SITE_ID=11bfcf84-d1f4-4604-bfcf-82c08b20f0d4`, `WIX_CLIENT_ID=33921d68-22e1-4e95-b38a-d8f4c70aa416`, `PTP_FRONTEND_ORIGIN=https://headless-imjmmxsthlj-pedrousinae-140b.wix-site-host.com`.
4. Executar `npm test`; confirmar o GET `/health`; testar inserção real no CMS com um dado não pessoal antes de ativar o frontend.

## Segurança
- O endpoint é para solicitações públicas, não concede acesso administrativo.
- Em operação visitante, o servidor solicita token anônimo Wix; o CMS deve permitir inserções na coleção `PTPSolicitacoesPublicas`.
- Use controle de abuso adicional (CAPTCHA ou firewall) antes de aceitar alto volume; CORS e rate limit em memória não substituem autenticação.
- Nunca gravar API keys no repositório ou no frontend.
- O backend não substitui os módulos privados e a validação do Centro de Comando.
