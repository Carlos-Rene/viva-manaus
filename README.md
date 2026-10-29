# Viva · Uma pausa que faz bem

Aplicativo de atividades e bem-estar com parques de Manaus, acompanhamento de caminhada, exercícios guiados, vídeos do YouTube e catálogo administrado por desenvolvedores autenticados.

## Pastas

| Pasta                              | Conteúdo                                                                                           |
| ---------------------------------- | -------------------------------------------------------------------------------------------------- |
| `src/client/index.html`            | Telas e estrutura da interface                                                                     |
| `src/client/styles/`               | Estilos da interface                                                                               |
| `src/client/scripts/features/`     | Atividades, câmera, caminhada, parques, eventos, vídeos, treinos, rotina, administração e tutorial |
| `src/client/scripts/app.js`        | Estado e inicialização do aplicativo                                                               |
| `src/client/scripts/manifest.json` | Ordem de montagem dos scripts                                                                      |
| `src/shared/`                      | Validação do catálogo usada no navegador e no servidor                                             |
| `src/server/`                      | API, autorização e entrega dos arquivos                                                            |
| `public/assets/`                   | Imagens e vídeo explicativo                                                                        |
| `public/vendor/leaflet/`           | Arquivos de terceiros                                                                              |
| `scripts/`                         | Construção e servidor de desenvolvimento                                                           |
| `tests/`                            | Testes de autorização, catálogo, vídeo, estrutura e análise de imagem                             |
| `.openai/`                         | Configuração da hospedagem                                                                         |
| `dist/`                            | Saída gerada; não editar                                                                           |

## Executar

Requer Node.js 20 ou superior. Não há dependências de instalação.

```sh
npm run build
npm test
npm run dev
```

Abra `http://localhost:4173`. A prévia local não simula uma conta de desenvolvedor.

Os arquivos de funcionalidades são reunidos em um script clássico para preservar os eventos das telas. As declarações de funções são carregadas antes da inicialização em `scripts/app.js`. A validação compartilhada é incluída no navegador e no Worker a partir do mesmo arquivo, sem cópias de regras.

## Análise de imagem do Olhar curioso

O Olhar curioso envia a foto, após consentimento explícito, ao endpoint do Viva, que encaminha a imagem a um servidor [Ollama](https://docs.ollama.com/capabilities/vision) configurado para o projeto. O modelo padrão é **Gemma 3 4B** (`gemma3:4b`), uma variante multimodal capaz de receber imagens. A API recebe a imagem em memória; o Worker não a grava em armazenamento persistente nem registra seu conteúdo. O operador do servidor Ollama ainda pode aplicar suas próprias regras de retenção e acesso.

Escolhemos inferência via Ollama em vez da API Gemini para esta experiência voltada a usuários: os [termos atuais do Gemini API](https://ai.google.dev/gemini-api/terms#data-use-unpaid) descrevem o serviço como destinado a uso profissional/comercial, não a uso do consumidor; além disso, conteúdo enviado por serviços não pagos pode ser usado para melhorar produtos do Google. Revise os termos do provedor novamente antes de alterar essa decisão.

O endpoint aceita JPEG, PNG ou WebP de até 5 MB, valida os bytes iniciais do formato, limita o tempo de análise a 120 segundos e não salva a foto. Na prévia local, há limite global de 10 solicitações por 15 minutos e uma análise simultânea; esses limites são compartilhados por todos os visitantes e reiniciam quando o processo da prévia reinicia. As respostas são orientativas e podem estar incertas; confirme informações importantes em fontes confiáveis.

### Desenvolvimento local

1. Instale [Ollama 0.6 ou mais recente](https://ollama.com/download) em uma máquina com recursos suficientes para o modelo de visão. A disponibilidade de memória depende do modelo, quantização e tamanho da imagem.
2. Baixe o modelo multimodal (o download pode ser grande):

   ```sh
   ollama pull gemma3:4b
   ```

3. Copie `.env.example` para `.env`. O padrão já aponta para `http://127.0.0.1:11434`; ajuste `OLLAMA_MODEL` se necessário. O `.env` é ignorado pelo Git e não deve ser compartilhado:

   ```sh
   cp .env.example .env
   ```

4. Gere uma senha de desenvolvedor e um segredo de sessão. O utilitário solicita a senha sem exibi-la e imprime os dois valores para configuração; guarde-os em um gerenciador de segredos e coloque-os somente nas variáveis correspondentes de `.env`:

   ```sh
   node scripts/generate-dev-auth.mjs
   ```

   Use uma senha com pelo menos 12 caracteres. O hash usa PBKDF2-HMAC-SHA-256, salt aleatório de 16 bytes e 600.000 iterações, no formato versionado `pbkdf2-sha256$v1$iteracoes$salt_base64url$hash_base64url`. O segredo de sessão é aleatório, tem 256 bits e deve permanecer confidencial.

5. Se o Ollama não estiver rodando como serviço, inicie-o ligado somente ao loopback: `OLLAMA_HOST=127.0.0.1:11434 ollama serve`. Para serviços já instalados, confirme que `OLLAMA_HOST` também não está configurado como `0.0.0.0`. Em outro terminal, execute `npm run dev` e abra `http://localhost:4173`.

Se o Ollama ou o modelo não estiverem disponíveis, a atividade mostra um erro de configuração/serviço e não inventa uma análise. A prévia local não exige uma chave de API, mas depende dos recursos de hardware para executar o modelo.

### Compartilhar a prévia pelo ngrok

A prévia pode ser compartilhada sem exigir que visitantes façam login. O acesso é público para qualquer pessoa com o link; a edição do catálogo exige a senha de desenvolvedor configurada no servidor. O [ngrok Free atribui à conta um domínio de desenvolvimento](https://ngrok.com/docs/pricing-limits/free-plan-limits/) que permanece o mesmo ao reiniciar o agente. Use o domínio atribuído, sem configurar uma política OAuth do ngrok:

1. Inicie o Ollama e a prévia em um terminal:

   ```sh
   npm run dev
   ```

2. Em outro terminal, crie o túnel HTTP para a prévia:

   ```sh
   ngrok http 4173
   ```

3. Copie a origem HTTPS estável indicada pelo ngrok (por exemplo, `https://nome-atribuido.ngrok-free.app`) para `ALLOWED_ORIGINS` no `.env`, sem caminho nem barra final. Essa origem é necessária também para as solicitações de autenticação e publicação. Reinicie `npm run dev` após alterar `.env`; o túnel pode continuar ativo. A prévia valida essa origem para as operações protegidas, mas isso não substitui o rate limiter.

O agente ngrok abre uma conexão de saída e encaminha o tráfego público ao serviço local, como descrito em [como compartilhar localhost](https://ngrok.com/docs/share-localhost/tunnels/). A prévia aplica limites globais porque não depende de cabeçalhos de IP encaminhado para identificar visitantes: 10 tentativas a cada 15 minutos e no máximo uma análise simultânea. Ao atingir um limite, o endpoint retorna HTTP 429; as tentativas voltam a ser permitidas após a janela. Como os limites são globais, um visitante pode consumir a cota compartilhada; reiniciar a prévia também reinicia a janela.

Não crie um túnel para a porta `11434`: somente a porta do Viva (`4173`) deve ser exposta. O navegador envia a foto ao endpoint `/api/analyze-image` do Viva, que encaminha os bytes ao Ollama em `OLLAMA_BASE_URL`; o endpoint Ollama e qualquer token não são expostos ao navegador. No plano gratuito, o ngrok pode mostrar uma página intersticial antes do site; o visitante deve confirmar para continuar.

### Produção

- O Worker precisa alcançar um endpoint Ollama protegido por HTTPS, configurado em `OLLAMA_BASE_URL`. Não exponha a porta Ollama (`11434`) diretamente à internet: coloque o servidor atrás de um proxy autenticado e configure o segredo `OLLAMA_API_TOKEN` no ambiente do Worker. O token é enviado somente pelo servidor em um cabeçalho Bearer; o proxy deve validá-lo.
- Configure `OLLAMA_MODEL` com um modelo multimodal disponível no host e mantenha o modelo atualizado. Um Worker hospedado na nuvem não consegue usar o Ollama `127.0.0.1` do computador do desenvolvedor.
- Configure também o binding Cloudflare Rate Limiting `ANALYSIS_LIMITER`, com um limite por IP adequado à capacidade do modelo. O endpoint de produção falha de forma fechada se não houver binding, URL HTTPS ou token. A prévia local usa seu próprio limitador global em memória e permite Ollama em HTTP local.
- Configure `VIVA_DEV_PASSWORD_HASH` e `VIVA_SESSION_SECRET` como secrets no ambiente do Worker. Gere-os com `node scripts/generate-dev-auth.mjs` em um terminal confiável e forneça os valores diretamente ao gerenciador de secrets (por exemplo, `npx wrangler secret put VIVA_DEV_PASSWORD_HASH` e `npx wrangler secret put VIVA_SESSION_SECRET`); nunca os coloque no código, nos arquivos versionados, em logs ou na configuração pública do Worker. Configure `ALLOWED_ORIGINS` com as origens HTTPS exatas permitidas. Sem hash ou segredo válido, o login e as publicações falham de forma fechada.
- Provisione e monitore o host Ollama separadamente; hospedagem de modelo pode ter custos de infraestrutura, apesar de não haver tarifa por chamada de uma API de IA. Execute `npm run build` e publique o Worker depois de configurar cada ambiente.

O servidor do modelo pode processar fotos enviadas pelos usuários. Informe as pessoas sobre quem opera esse servidor, seus controles de acesso e a política de retenção aplicável.

## Acesso e dados

O login de desenvolvedor verifica a senha no servidor e cria uma sessão assinada, com validade de oito horas, em cookie `HttpOnly`, `Secure` e `SameSite=Strict`. A senha e o token de sessão não são guardados no armazenamento do navegador nem enviados na resposta de login. As tentativas de senha são limitadas e bloqueadas temporariamente após falhas repetidas; no Worker, o limite em memória é por IP e por instância, enquanto a prévia local usa um limite global. O catálogo compartilhado é público para leitura e exige uma sessão válida para publicação; os controles da interface não substituem a autorização da API. O catálogo usa o binding R2 `BUCKET`. O histórico pessoal e os trajetos ficam no armazenamento local do navegador.

O GPS e a câmera dependem de HTTPS e da permissão do usuário. Eventos de exemplo não representam uma agenda verificada. Os vídeos do YouTube dependem da disponibilidade do conteúdo externo.

Na prévia local, a primeira leitura cria `catalog.json` com estado válido ainda não publicado (`config: null`) no diretório de dados da aplicação: `~/.local/share/viva/` no Linux (ou `$XDG_DATA_HOME/viva/` quando definido), `~/Library/Application Support/Viva/` no macOS e `%APPDATA%/Viva/` no Windows. Defina `VIVA_DATA_DIR` no ambiente ou no `.env` para escolher outro diretório. A pasta `.viva-data/`, útil para uma localização alternativa dentro do projeto, está ignorada pelo Git. Faça cópias de segurança desse arquivo para preservar as publicações da prévia; restaure-o com a prévia parada. O arquivo contém somente o catálogo público do aplicativo, não credenciais ou segredos. A hospedagem de produção continua usando o binding Cloudflare R2 `BUCKET`.
