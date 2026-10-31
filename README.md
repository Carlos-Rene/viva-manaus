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

O ngrok cria um túnel HTTPS público para o serviço local em `http://127.0.0.1:4173`. A URL é pública para qualquer pessoa que a conheça; a edição do catálogo continua exigindo a senha de desenvolvedor configurada no servidor. O computador, a prévia e o agente ngrok precisam permanecer ligados enquanto o endereço estiver em uso.

#### Instalação e autenticação no Artix Linux

Instale ngrok para Linux usando as instruções oficiais de [download e instalação](https://ngrok.com/download) ou um pacote compatível com Artix de uma fonte confiável. Confirme que `ngrok` está disponível no `PATH`:

```sh
ngrok version
```

Crie ou acesse sua conta em [ngrok](https://dashboard.ngrok.com/), copie seu authtoken do painel e configure-o para o usuário local:

```sh
ngrok config add-authtoken YOUR_NGROK_AUTHTOKEN
ngrok config check
```

O authtoken fica na configuração privada do ngrok fora deste repositório. Não o coloque no código, no `.env` do projeto ou em arquivos versionados.

#### Iniciar e acessar remotamente

1. Se ainda não fez a configuração local, copie `.env.example` para `.env`. Inicie o Ollama conforme a seção de desenvolvimento local, mantendo-o ligado somente ao loopback (`127.0.0.1:11434`).
2. Se sua conta tiver um domínio estático ngrok atribuído, defina `NGROK_DOMAIN` no `.env` como o hostname (ou origem HTTPS) exato, por exemplo `nome-atribuido.ngrok-free.app`. Não invente um domínio: consulte o domínio efetivamente atribuído à conta no painel ngrok. Sem esse valor, ngrok atribui uma URL temporária.
3. Inicie a prévia e o túnel juntos:

   ```sh
   npm run dev:ngrok
   ```

   O comando verifica a configuração e o authtoken do ngrok, inicia o Viva, aguarda a resposta local e encaminha ngrok para `http://127.0.0.1:4173`. Ele imprime a URL HTTPS pública quando o túnel está pronto. Abra essa URL para usar o site; a conexão HTTPS habilita os recursos do navegador que exigem contexto seguro, como GPS e câmera.

   A URL pública exata é adicionada somente como origem permitida ao processo local do Viva (junto às origens exatas já configuradas). Isso mantém a validação de origem sem curingas e permite autenticação e análise de imagem também quando ngrok atribui uma URL temporária. O valor não é gravado no `.env`.

4. Para parar os dois processos iniciados por esse comando, pressione **Ctrl+C** no terminal. O launcher encerra apenas os processos Viva e ngrok que ele próprio iniciou. Não use `systemctl`; não é necessário criar serviços systemd ou dinit para a execução manual.

Para depuração, também é possível iniciar cada processo separadamente em terminais diferentes: `npm run dev`, depois `ngrok http http://127.0.0.1:4173`. Nesse modo, configure `ALLOWED_ORIGINS` com a origem HTTPS exata do ngrok no `.env` e reinicie a prévia depois de alterar o arquivo; para uma URL temporária, faça isso após o ngrok exibi-la. Para encerrar, use Ctrl+C em cada terminal. Não inicie esse fluxo separado ao mesmo tempo que `npm run dev:ngrok`, pois a porta `4173` já estará ocupada.

No plano gratuito, os visitantes podem ver a página intersticial do ngrok com o botão **Visit Site** antes de entrar no Viva. Isso é comportamento padrão do plano gratuito e é intencionalmente aceito neste projeto; não tentamos removê-lo nem contorná-lo.

A prévia aplica limites globais de 10 tentativas a cada 15 minutos e no máximo uma análise de imagem simultânea. Não crie túnel para a porta `11434`: somente a porta do Viva (`4173`) é exposta. O navegador envia fotos ao endpoint `/api/analyze-image` do Viva, e somente o backend encaminha os bytes ao Ollama local; a porta e o endpoint Ollama não ficam públicos.

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
