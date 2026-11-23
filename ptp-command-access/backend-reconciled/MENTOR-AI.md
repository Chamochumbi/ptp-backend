# Mentor NEXT — integração de IA preparada, não implantada

23/11/2026. O responsável confirmou que não possui API de IA contratada. Nenhuma credencial foi recebida, nenhum serviço pago contratado e nenhuma chamada real ao provedor realizada.

## Contrato

GET /api/mentor/status: prontidão de configuração, sem chamada ao provedor nem garantia de crédito/modelo disponível.
POST /api/mentor: pergunta, contexto, estágio, tema e até nove pares anteriores. Autorização por token Wix de membro aprovado e e-mail verificado. Aceita membros comuns; não depende da identidade administrativa. A validação real das permissões FULL deve ser homologada com uma conta de participante.

Resposta: version 1, kind ai, text, citations com intervalos e URL HTTPS, webSearched. Não há resposta editorial de contingência. Respostas vazias, incompletas ou com citações inválidas falham de forma explícita. O servidor não retorna erros brutos do provedor ou credenciais.

## Configuração segura após contratação

No ambiente do servidor, configure OPENAI_API_KEY (segredo), OPENAI_MODEL (modelo disponível na conta), MENTOR_AI_ENABLED=true e, apenas após homologação, MENTOR_WEB_SEARCH=true. Nunca colocar a chave em JS público, Git ou chat.

A integração usa POST https://api.openai.com/v1/responses com store:false. Isso não é uma promessa de retenção zero pelo provedor: revisar suas condições e controles aplicáveis antes do lançamento.

Reconciliar primeiro branch, diretório, artefato e comandos de build/start do Render. O serviço atual diverge do repositório e não deve ser reimplantado cegamente. Ver README.md. Publicar inicialmente com MENTOR_AI_ENABLED=false e conferir saúde, login e rotas anteriores.

O limite atual é por processo: 15 chamadas por membro/dia, 100 gerais/dia e intervalo de três segundos. Reiniciar o processo ou usar múltiplas réplicas reinicia/divide esses controles. Antes do uso público, mover cotas para armazenamento durável e estabelecer limites financeiros no provedor. Pesquisa web é opt-in, limitada a fontes selecionadas, com até duas chamadas de ferramenta. Verificar compatibilidade do modelo escolhido e custo antes de ativar.

## Qualidade da mentoria

As instruções exigem adaptação ao histórico e contexto, até duas perguntas quando faltarem dados essenciais, decisão fundamentada, até três ações com evidência esperada e critério de decisão, limites e pergunta de aprofundamento. Não inventar autores, DOI, números ou leitura de documentos. O catálogo fornece metadados de curadoria; não é um pipeline RAG de arquivos completos.

Validar com casos reais: MVP de AgTech sem receita; preço B2B com custos incompletos; vendas com funil inconsistente; hipótese acadêmica sem evidência; ESG com alegação não comprovada; continuidade de conversa após resposta parcial. Conferir especificidade, utilidade, fontes, custo/latência e honestidade das lacunas. Instruções e testes simulados não comprovam a qualidade real do modelo.

## Testes

npm test inclui os 19 testes de servidor existentes e 13 da integração. Testes HTTP locais usam identidades e resultados do provedor simulados. A suíte integrada da plataforma tem 271 casos aprovados nesta entrega. Não equivale a homologação em produção.

Documentação oficial consultada:
- https://developers.openai.com/api/reference/resources/responses/methods/create
- https://developers.openai.com/api/docs/guides/text
- https://developers.openai.com/api/docs/guides/tools-web-search
