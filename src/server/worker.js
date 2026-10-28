const json = (value, status = 200, extra = {}) =>
  new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extra,
    },
  });
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_REQUEST_BYTES = MAX_IMAGE_BYTES + 64 * 1024;

function isSupportedImage(bytes, type) {
  if (type === "image/jpeg")
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (type === "image/png")
    return (
      bytes.length >= 8 &&
      [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)
    );
  return (
    type === "image/webp" &&
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.subarray(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.subarray(8, 12)) === "WEBP"
  );
}

async function readBoundedBody(request) {
  const contentLength = request.headers.get("Content-Length");
  if (contentLength && Number(contentLength) > MAX_REQUEST_BYTES)
    return null;
  if (!request.body) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > MAX_REQUEST_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function bytesToBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000)
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  return btoa(binary);
}

function parseAnalysis(text) {
  const value = JSON.parse(text);
  if (
    !value ||
    typeof value.subjectTitle !== "string" ||
    typeof value.visibleDescription !== "string" ||
    !Array.isArray(value.facts) ||
    value.facts.length > 3 ||
    value.facts.some((fact) => typeof fact !== "string") ||
    typeof value.uncertain !== "boolean" ||
    (value.uncertaintyNotice !== null &&
      typeof value.uncertaintyNotice !== "string")
  )
    return null;

  const subjectTitle = value.subjectTitle.trim().slice(0, 120);
  const visibleDescription = value.visibleDescription.trim().slice(0, 1600);
  const facts = value.facts
    .map((fact) => fact.trim().slice(0, 400))
    .filter(Boolean);
  if (!subjectTitle || !visibleDescription) return null;
  return {
    subjectTitle,
    visibleDescription,
    facts,
    uncertain: value.uncertain,
    uncertaintyNotice:
      value.uncertain && value.uncertaintyNotice
        ? value.uncertaintyNotice.trim().slice(0, 500)
        : null,
  };
}

async function analyzeImage(request, env, url) {
  if (request.method !== "POST")
    return json({ error: "Método não permitido." }, 405);
  const origin = request.headers.get("Origin");
  const allowedOrigins = (env.ALLOWED_ORIGINS || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  if (!origin || (origin !== url.origin && !allowedOrigins.includes(origin)))
    return json({ error: "Origem da solicitação não autorizada." }, 403);
  if (!env.OLLAMA_BASE_URL)
    return json(
      {
        error:
          "O serviço de análise ainda não está configurado. Configure o endereço do servidor Ollama.",
      },
      503,
    );
  let modelEndpoint;
  try {
    const baseUrl = new URL(env.OLLAMA_BASE_URL);
    if (
      !["http:", "https:"].includes(baseUrl.protocol) ||
      baseUrl.username ||
      baseUrl.password ||
      baseUrl.search ||
      baseUrl.hash
    )
      throw new Error("Invalid Ollama URL");
    if (
      !env.LOCAL_PREVIEW &&
      (baseUrl.protocol !== "https:" || !env.OLLAMA_API_TOKEN)
    )
      return json(
        {
          error:
            "A produção exige um servidor Ollama HTTPS protegido por token.",
        },
        503,
      );
    modelEndpoint = new URL("/api/chat", baseUrl);
  } catch {
    return json(
      { error: "O endereço do servidor de análise está inválido." },
      503,
    );
  }
  const model = env.OLLAMA_MODEL || "gemma3:4b";
  if (model.length > 100 || /\s/.test(model))
    return json({ error: "O modelo configurado para análise é inválido." }, 503);
  if (!env.ANALYSIS_LIMITER)
    return json(
      { error: "O serviço de análise ainda não está configurado para uso público." },
      503,
    );
  const clientIp = env.LOCAL_PREVIEW
    ? "local-preview-global"
    : request.headers.get("CF-Connecting-IP");
  if (!clientIp)
    return json(
      { error: "Não foi possível verificar o limite de solicitações." },
      503,
    );
  try {
    const { success } = await env.ANALYSIS_LIMITER.limit({ key: clientIp });
    if (!success)
      return json(
        {
          error:
            "Muitas análises em pouco tempo. Aguarde um pouco e tente novamente.",
        },
        429,
      );
  } catch {
    return json(
      { error: "O serviço de análise está temporariamente indisponível." },
      503,
    );
  }

  let body;
  try {
    body = await readBoundedBody(request);
  } catch {
    return json({ error: "Não foi possível ler a imagem enviada." }, 400);
  }
  if (!body)
    return json({ error: "O envio excede o limite permitido de 5 MB." }, 413);

  let form;
  try {
    form = await new Request(url, {
      method: "POST",
      headers: request.headers,
      body,
    }).formData();
  } catch {
    return json({ error: "Envie uma imagem válida para análise." }, 400);
  }
  const photo = form.get("photo");
  if (!photo || typeof photo === "string" || typeof photo.arrayBuffer !== "function")
    return json({ error: "Selecione uma imagem para analisar." }, 400);
  if (photo.size === 0)
    return json({ error: "A imagem enviada está vazia." }, 400);
  if (photo.size > MAX_IMAGE_BYTES)
    return json({ error: "A imagem deve ter no máximo 5 MB." }, 413);
  if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type))
    return json(
      { error: "Use uma imagem nos formatos JPEG, PNG ou WebP." },
      415,
    );

  const bytes = new Uint8Array(await photo.arrayBuffer());
  if (!isSupportedImage(bytes, photo.type))
    return json(
      { error: "O conteúdo do arquivo não corresponde a uma imagem compatível." },
      415,
    );

  const prompt = [
    "Você é um guia de observação acolhedor para a atividade Olhar curioso, em um parque.",
    "Analise a fotografia e responda em português brasileiro, com linguagem acessível, breve e gentil.",
    "Descreva apenas o que é visivelmente observável e separe observações de inferências.",
    "Identifique o assunto principal somente quando houver evidência suficiente. Nunca invente espécie, nome científico, contexto ou fato.",
    "Se a imagem for ambígua, distante, desfocada ou insuficiente, diga claramente que não foi possível identificar com confiança e explique a incerteza.",
    "Inclua até três fatos interessantes apenas quando forem confiáveis e relevantes; se não houver fatos seguros, retorne uma lista vazia.",
    "A atividade é opcional e sem avaliação. Não dê notas nem transforme a resposta em uma tarefa.",
    'Retorne somente um objeto JSON com as propriedades: "subjectTitle" (string curta), "visibleDescription" (string), "facts" (array com até três strings), "uncertain" (boolean) e "uncertaintyNotice" (string ou null).',
  ].join(" ");

  let modelResponse;
  try {
    const headers = { "Content-Type": "application/json" };
    if (env.OLLAMA_API_TOKEN)
      headers.Authorization = `Bearer ${env.OLLAMA_API_TOKEN}`;
    modelResponse = await fetch(modelEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: prompt,
            images: [bytesToBase64(bytes)],
          },
        ],
        format: "json",
        stream: false,
        options: { temperature: 0.2, num_predict: 900 },
      }),
      signal: AbortSignal.timeout(120000),
    });
  } catch (error) {
    return json(
      {
        error:
          error?.name === "TimeoutError" || error?.name === "AbortError"
            ? "A análise demorou mais que o esperado. Tente novamente."
            : "Não foi possível conectar ao servidor de análise. Verifique se o Ollama está ativo.",
      },
      error?.name === "TimeoutError" || error?.name === "AbortError" ? 504 : 503,
    );
  }

  if (!modelResponse.ok) {
    if (modelResponse.status === 429)
      return json(
        {
          error:
            "O servidor de análise está ocupado. Aguarde um pouco e tente novamente.",
        },
        429,
      );
    if (modelResponse.status === 401 || modelResponse.status === 403)
      return json(
        {
          error:
            "A autenticação do servidor de análise falhou. Peça ajuda à equipe do Viva.",
        },
        503,
      );
    if (modelResponse.status === 404)
      return json(
        {
          error:
            `O modelo ${model} não está disponível no Ollama. Baixe-o no servidor e tente novamente.`,
        },
        503,
      );
    return json(
      { error: "O servidor não conseguiu analisar a imagem agora. Tente novamente." },
      modelResponse.status >= 500 ? 503 : 502,
    );
  }

  let modelData;
  try {
    modelData = await modelResponse.json();
  } catch {
    return json(
      { error: "O servidor retornou uma resposta inválida. Tente novamente." },
      502,
    );
  }
  const text = modelData?.message?.content?.trim();
  if (!text)
    return json(
      { error: "O servidor não retornou uma análise utilizável. Tente outra foto." },
      502,
    );
  let analysis;
  try {
    analysis = parseAnalysis(text);
  } catch {
    analysis = null;
  }
  if (!analysis)
    return json(
      { error: "O servidor retornou uma análise inválida. Tente novamente." },
      502,
    );
  return json(analysis);
}

function identity(request, env) {
  const id = request.headers.get("oai-authenticated-user-id"),
    email = (request.headers.get("oai-authenticated-user-email") || "")
      .trim()
      .toLowerCase();
  const allowed = (env.VIVA_DEV_EMAILS || "")
    .split(",")
    .map((v) => v.trim().toLowerCase())
    .filter(Boolean);
  return {
    authenticated: !!id,
    email,
    isDeveloper: !!id && !!email && allowed.includes(email),
  };
}
export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const account = identity(request, env);
      if (url.pathname === "/api/me") {
        if (request.method !== "GET")
          return json({ error: "Método não permitido." }, 405);
        return json(account);
      }
      if (url.pathname === "/api/analyze-image")
        return analyzeImage(request, env, url);
      if (url.pathname === "/api/catalog") {
        if (!account.authenticated)
          return json(
            { error: "Entre com sua conta para acessar o catálogo." },
            401,
          );
        if (!env.BUCKET)
          return json(
            { error: "Armazenamento do catálogo indisponível." },
            503,
          );
        if (request.method === "GET") {
          const object = await env.BUCKET.get("viva/catalog.json");
          if (!object) return json({ version: null, config: null });
          return json({ version: object.etag, config: await object.json() });
        }
        if (request.method !== "PUT")
          return json({ error: "Método não permitido." }, 405);
        if (!account.isDeveloper)
          return json(
            { error: "Sua conta não está autorizada a alterar o catálogo." },
            403,
          );
        const origin = request.headers.get("Origin");
        if (origin && origin !== url.origin)
          return json({ error: "Origem da solicitação não autorizada." }, 403);
        const text = await request.text();
        if (new TextEncoder().encode(text).length > 1000000)
          return json({ error: "Configuração maior que 1 MB." }, 413);
        let config;
        try {
          config = validateConfig(JSON.parse(text));
        } catch (error) {
          return json(
            { error: error.message || "Configuração inválida." },
            400,
          );
        }
        const match = request.headers.get("If-Match"),
          none = request.headers.get("If-None-Match");
        if (!match && none !== "*")
          return json(
            { error: "Recarregue o catálogo antes de publicar." },
            428,
          );
        const object = await env.BUCKET.put(
          "viva/catalog.json",
          JSON.stringify(config),
          {
            httpMetadata: { contentType: "application/json" },
            onlyIf: match ? { etagMatches: match } : { etagDoesNotMatch: "*" },
          },
        );
        if (!object)
          return json(
            {
              error:
                "O catálogo foi atualizado em outra sessão. Recarregue antes de editar.",
            },
            409,
          );
        return json({ version: object.etag });
      }
      if (url.pathname.startsWith("/api/"))
        return json({ error: "Não encontrado." }, 404);
      if (!["GET", "HEAD"].includes(request.method))
        return new Response("Method not allowed", { status: 405 });
      const key = url.pathname === "/" ? "/index.html" : url.pathname;
      const asset = ASSETS[key];
      if (!asset) return new Response("Not found", { status: 404 });
      const bytes = Uint8Array.from(atob(asset.data), (c) => c.charCodeAt(0));
      const headers = {
        "Content-Type": asset.type,
        "Content-Length": String(bytes.length),
        "X-Content-Type-Options": "nosniff",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Cache-Control": key.endsWith(".mp4")
          ? "public, max-age=3600"
          : "no-cache",
        "Accept-Ranges": "bytes",
      };
      const range = request.headers.get("Range");
      if (range) {
        const parsed = /^bytes=(\d*)-(\d*)$/.exec(range);
        if (!parsed)
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${bytes.length}` },
          });
        let start = parsed[1]
          ? Number(parsed[1])
          : Math.max(0, bytes.length - Number(parsed[2]));
        let end = parsed[1]
          ? parsed[2]
            ? Math.min(Number(parsed[2]), bytes.length - 1)
            : bytes.length - 1
          : bytes.length - 1;
        if (start > end || start >= bytes.length)
          return new Response(null, {
            status: 416,
            headers: { "Content-Range": `bytes */${bytes.length}` },
          });
        const part = bytes.slice(start, end + 1);
        return new Response(request.method === "HEAD" ? null : part, {
          status: 206,
          headers: {
            ...headers,
            "Content-Range": `bytes ${start}-${end}/${bytes.length}`,
            "Content-Length": String(part.length),
          },
        });
      }
      return new Response(request.method === "HEAD" ? null : bytes, {
        headers,
      });
    } catch {
      return json({ error: "Não foi possível concluir a solicitação." }, 500);
    }
  },
};
