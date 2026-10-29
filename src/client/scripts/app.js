let activeProfile = "user";

let serverIdentity = { ready: false, isDeveloper: false };

let catalogVersion = null;

const activities = [
  [
    "Caminhada curiosa",
    "Perceba algo que desperte sua curiosidade pelo caminho.",
    "🔎",
    "Ao ar livre",
    15,
    "Caminhe em ritmo confortável por um local conhecido. Se algo chamar sua atenção, pare em um lugar seguro para observar e, se quiser, fotografar sua descoberta no Olhar curioso.",
  ],
  [
    "Pedale sem pressa",
    "Uma volta leve para mudar de cenário.",
    "🚲",
    "Movimento",
    30,
    "Escolha uma rota segura, confira a bicicleta e use capacete. Pedale em ritmo confortável e faça pausas quando precisar.",
  ],
  [
    "Respire e desacelere",
    "Uma pausa para voltar ao momento presente.",
    "〰️",
    "Relaxar",
    5,
    "Sente-se confortavelmente e solte os ombros. Respire de forma natural, observando a entrada e saída do ar, sem prender a respiração.",
  ],
  [
    "Corrida leve",
    "Encontre seu próprio ritmo, sem competição.",
    "👟",
    "Movimento",
    20,
    "Comece caminhando e alterne com trotes leves conforme seu conforto. Escolha um percurso seguro e interrompa se sentir desconforto.",
  ],
  [
    "Alongamento suave",
    "Dê um descanso ao corpo e à tela.",
    "🙆",
    "Relaxar",
    10,
    "Levante-se devagar. Movimente ombros e braços suavemente, sem forçar a amplitude. Faça uma pausa entre cada movimento.",
  ],
  [
    "Dance uma música",
    "Seu quarto também pode virar uma pista.",
    "🎵",
    "Em casa",
    5,
    "Escolha uma música de que você gosta, libere espaço e se movimente do seu jeito. Não precisa seguir passos.",
  ],
  [
    "Fotografia de detalhes",
    "Procure beleza em cinco coisas comuns.",
    "📷",
    "Criatividade",
    15,
    "Escolha um tema: cores, sombras ou texturas. Fotografe cinco detalhes ao redor e escolha seu favorito.",
  ],
  [
    "Pausa de leitura",
    "Algumas páginas e um novo ponto de vista.",
    "📖",
    "Em casa",
    15,
    "Escolha um texto curto, encontre um lugar confortável e deixe as notificações de lado por alguns minutos.",
  ],
  [
    "Desenho livre",
    "Coloque uma ideia no papel sem cobrar perfeição.",
    "🎨",
    "Criatividade",
    10,
    "Pegue papel e lápis. Desenhe um objeto próximo sem apagar, apenas explorando suas formas.",
  ],
  [
    "Passeio pelo bairro",
    "Um caminho diferente para renovar o dia.",
    "☀️",
    "Ao ar livre",
    20,
    "Escolha uma rua tranquila e observe algo que você ainda não havia notado. Considere clima, acessibilidade e segurança do percurso.",
  ],
  [
    "Organize um cantinho",
    "Uma pequena mudança no seu ambiente.",
    "🪴",
    "Em casa",
    10,
    "Escolha apenas uma superfície. Guarde cinco objetos e crie um espaço mais confortável para sua próxima pausa.",
  ],
  [
    "Escuta atenta",
    "Uma música, sem fazer outra coisa.",
    "🎧",
    "Relaxar",
    5,
    "Use um volume confortável. Ouça uma faixa inteira e tente perceber um instrumento ou detalhe novo.",
  ],
];

activities.push(
  [
    "Passeio de cinco minutos",
    "Mude de ambiente em uma volta curta.",
    "🚶",
    "Ao ar livre",
    5,
    "Escolha um percurso próximo e acessível. Caminhe com conforto e observe o ambiente.",
  ],
  [
    "Desafio das três cores",
    "Encontre três cores diferentes ao seu redor.",
    "🔎",
    "Criatividade",
    5,
    "Escolha três cores e procure um objeto de cada cor. Se quiser, fotografe ou desenhe seus achados.",
  ],
  [
    "Uma mensagem de carinho",
    "Reserve um momento para se conectar.",
    "💬",
    "Conexão",
    5,
    "Pense em alguém com quem gostaria de conversar. Escreva uma mensagem simples, sem obrigação de receber uma resposta imediata.",
  ],
  [
    "Pausa sem tela",
    "Dê espaço para descansar a atenção.",
    "🌙",
    "Relaxar",
    5,
    "Deixe a tela de lado por alguns minutos. Encontre uma posição confortável e observe os sons ao seu redor.",
  ],
  [
    "Caça às folhas",
    "Descubra formas diferentes na natureza.",
    "🍃",
    "Ao ar livre",
    10,
    "Observe folhas de plantas sem arrancá-las. Procure três formatos e use a área Descobrir para experimentar uma curiosidade.",
  ],
  [
    "Circuito de movimento leve",
    "Movimente braços e pernas no seu ritmo.",
    "⚡",
    "Movimento",
    5,
    "Em um espaço livre, alterne caminhada no lugar e movimentos suaves de braços. Faça pausas e adapte ao seu conforto.",
  ],
  [
    "Escrita livre",
    "Coloque o que está sentindo em palavras.",
    "✍️",
    "Criatividade",
    5,
    "Escreva sobre como você está agora, sem revisar nem buscar uma solução. Você pode guardar ou descartar o texto.",
  ],
  [
    "Escolha um caminho novo",
    "Uma pequena aventura perto de você.",
    "🧭",
    "Ao ar livre",
    15,
    "Escolha um trajeto conhecido com um pequeno desvio seguro. Observe um detalhe novo e faça uma pausa para apreciá-lo.",
  ],
);

const moodOptions = [
  ["😴", "Cansado"],
  ["😶", "Entediado"],
  ["😣", "Agitado"],
  ["😔", "Desanimado"],
  ["🤝", "Querendo companhia"],
  ["🙂", "Tranquilo"],
  ["⚡", "Disposto"],
];

const moodMatches = {
  Cansado: [2, 4, 7, 11, 15, 18],
  Entediado: [0, 5, 6, 8, 9, 10, 12, 13, 16, 17, 19],
  Agitado: [2, 4, 7, 11, 12, 15, 18],
  Desanimado: [5, 8, 11, 12, 14, 18],
  "Querendo companhia": [0, 1, 5, 9, 12, 14, 19],
  Tranquilo: [0, 1, 2, 6, 7, 8, 9, 11, 13, 16, 18, 19],
  Disposto: [0, 1, 3, 5, 9, 12, 16, 17, 19],
};

const intentMatches = {
  "Me surpreenda": null,
  Relaxar: [2, 4, 7, 11, 15, 18],
  "Movimentar o corpo": [0, 1, 3, 4, 5, 9, 12, 17, 19],
  "Me divertir": [1, 5, 6, 8, 13, 19],
  "Sair de casa": [0, 1, 3, 9, 12, 16, 19],
  "Explorar a natureza": [0, 6, 12, 13, 16, 19],
  "Criar algo": [6, 8, 10, 13, 18],
  "Me conectar": [0, 1, 5, 9, 12, 14, 19],
};

let intent = "Me surpreenda";

let state;

try {
  state = JSON.parse(localStorage.getItem("viva-state")) || {};
} catch {
  state = {};
}

state.logs ??= [];

state.plants ??= false;

let mood = "Entediado",
  time = 15,
  filter = "Todas",
  recommended = true;

const today = () =>
  new Date().toLocaleDateString("sv-SE", { timeZone: "America/Manaus" });

document.querySelectorAll("nav button").forEach(
  (b) =>
    (b.onclick = () => {
      recommended = false;
      go(b.dataset.page);
    }),
);

document.getElementById("modal").onclick = (e) => {
  if (e.target.id === "modal") closeModal();
};

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

renderChoices();

renderStats();

if (state.sleep != null) document.getElementById("sleep").value = state.sleep;

if (state.goal) document.getElementById("goal").value = state.goal;

let cameraStream = null,
  cameraRequest = 0;

window.addEventListener("pagehide", stopCamera);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) stopCamera();
});

const htmlEscape = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );

state.youtube ??= [
  {
    id: "zGqvlPkjAcY",
    title: "Alongamento — exemplo do YouTube",
    type: "Alongamento",
    start: 0,
  },
];

let videoFilter = "Todos";

let minuteSession = null,
  minuteInterval = null;

renderYoutube();

let walkMap = null,
  walkLine = null,
  walkMarker = null,
  parkLayer = null,
  parkBoundaryLayer = null,
  userPositionMarker = null,
  walkWatch = null,
  walkTimer = null,
  walkSession = null,
  lastWalkPosition = null,
  followWalkPosition = true,
  lastFollowPoint = null,
  nearbyCenter = null,
  parkAbort = null,
  locating = false;

let walkStarting = false;

window.addEventListener("pagehide", () => {
  stopWatch();
  clearInterval(walkTimer);
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && walkSession?.running) {
    pauseWalk(true);
    document.getElementById("gpsStatus").textContent =
      "Caminhada pausada porque o app saiu da tela. Toque em Retomar ao voltar.";
  }
});

window.addEventListener("beforeunload", (e) => {
  if (walkSession) {
    e.preventDefault();
    e.returnValue = "";
  }
});

document.body.dataset.profile = "user";

const defaultParks = [
  {
    id: "jefferson",
    name: "Parque Senador Jefferson Péres",
    district: "Centro",
    point: [-3.1375, -60.01833],
    description:
      "Parque urbano no Centro Histórico, próximo ao Palácio Rio Negro.",
    source: "https://pt.wikipedia.org/wiki/Parque_Senador_Jefferson_P%C3%A9res",
    enabled: true,
  },
  {
    id: "bilhares",
    name: "Parque Ponte dos Bilhares",
    district: "Chapada",
    pointAccuracy: "reference",
    point: [-3.101667, -60.026944],
    description:
      "Espaço urbano de lazer às margens do igarapé do Mindu. Confirme acesso e condições no local.",
    source: "https://pt.wikipedia.org/wiki/Parque_Ponte_dos_Bilhares",
    boundary: {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
          properties: {
            id: "bilhares",
            name: "Parque dos Bilhares",
            boundaryStatus: "approximate",
          },
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-60.02894, -3.10128],
                [-60.02442, -3.10042],
                [-60.02453, -3.1015],
                [-60.02869, -3.10261],
                [-60.02894, -3.10128],
              ],
            ],
          },
        },
      ],
    },
    boundaryAccuracy: "approximate",
    boundaryAttribution: "Polígono aproximado fornecido nos dados do projeto Viva.",
    enabled: true,
  },
  {
    id: "mindu",
    name: "Parque Municipal do Mindu",
    district: "Parque Dez de Novembro",
    pointAccuracy: "reference",
    point: [-3.08091, -60.00357],
    description:
      "Área verde para contemplação da natureza. Marcador aproximado; confirme a entrada e as regras de visitação.",
    source: "https://pt.wikipedia.org/wiki/Parque_Municipal_do_Mindu",
    enabled: true,
  },
];

state.parks ??= structuredClone(defaultParks);
state.parks = mergeBundledParkData(state.parks);

function mergeBundledParkData(parks) {
  const updatedById = new Map(defaultParks.map((park) => [park.id, park]));
  return parks.map((park) => {
    const updated = updatedById.get(park.id);
    if (!updated) return park;
    const keepsVerifiedBoundary =
      park.boundaryAccuracy === "verified" &&
      park.boundarySource &&
      validParkBoundary(park.boundary);
    return {
      ...park,
      point: updated.point,
      pointAccuracy: updated.pointAccuracy,
      ...(park.id === "bilhares" && !keepsVerifiedBoundary
        ? {
            boundary: updated.boundary,
            boundaryAccuracy: updated.boundaryAccuracy,
            boundaryAttribution: updated.boundaryAttribution,
            boundarySource: undefined,
          }
        : {}),
    };
  });
}

state.events ??= [
  {
    id: "cultural-2026",
    name: "Show cover — especial Charlie Brown Jr",
    type: "Cultural",
    date: "2026-10-28",
    time: "",
    place: "Largo de São Sebastião, Manaus",
    description:
      "Listado na Agenda Cultural de Manaus. Confirme horário, acesso e eventual ingresso com o organizador.",
    url: "https://www.agendaculturaldemanaus.com.br/",
    demo: false,
    published: true,
  },
  {
    id: "bike-demo",
    name: "Pedal em grupo (exemplo)",
    type: "Bike",
    date: "",
    time: "",
    place: "Manaus · ponto de encontro a definir",
    description:
      "Exemplo para testar o app. Não é um passeio agendado. O desenvolvedor pode substituir por um encontro real com fonte e data.",
    url: "",
    demo: true,
    published: true,
  },
];

state.events = state.events.filter((e) =>
  ["Bike", "Caminhada", "Corrida", "Atletismo", "Atividade em grupo"].includes(
    e.type,
  ),
);

state.settings ??= {
  brand: "viva",
  accent: "#c4ee9b",
  routeColor: "#ff7b38",
  background: "#101713",
  welcome: "O que você quer fazer agora?",
  intro: "Escolha um caminho para o seu momento.",
};

if (!state.simpleLookV1) {
  state.settings.accent = "#a9bc94";
  state.settings.background = "#18221d";
  state.settings.routeColor = "#9ab184";
  state.simpleLookV1 = true;
}

state.activityCatalog ??= activities.map((a) => [...a]);

state.texts ??= {};

function migrateCuriousLookCopy(activityCatalog, texts) {
  let migrated = false;
  const legacyWalkActivity = activityCatalog?.[0];
  if (
    legacyWalkActivity?.[0] === "Caminhada curiosa" &&
    legacyWalkActivity[1] === "Observe três plantas diferentes no seu caminho." &&
    legacyWalkActivity[5] ===
      "Caminhe em ritmo confortável por um local conhecido. Pare em um lugar seguro para observar uma planta e abrir Olhares curiosos."
  ) {
    activityCatalog[0] = [...activities[0]];
    migrated = true;
  }

  const legacyTextUpdates = {
    "text-nature-H1-0": [
      "Uma descoberta pelo caminho.",
      "Olhar curioso",
    ],
    "text-nature-P-0": [
      "Sua pausa também pode ser um convite para observar a natureza.",
      "O que chamou sua atenção pelo caminho? Fotografe algo curioso e descubra mais sobre o que você encontrou.",
    ],
  };
  for (const [key, [oldText, newText]] of Object.entries(legacyTextUpdates)) {
    if (texts[key] === oldText) {
      texts[key] = newText;
      migrated = true;
    }
  }
  return migrated;
}

if (migrateCuriousLookCopy(state.activityCatalog, state.texts)) persist();

const contentTargets = [
  ...document.querySelectorAll(
    "main section:not(#developer):not(#profiles) > h1,main section:not(#developer):not(#profiles) > p",
  ),
];

contentTargets.forEach((el, i) => {
  el.dataset.editKey =
    "text-" +
    el.closest("section").id +
    "-" +
    el.tagName +
    "-" +
    [...el.parentElement.children]
      .filter((n) => n.tagName === el.tagName)
      .indexOf(el);
  if (!(el.dataset.editKey in state.texts))
    state.texts[el.dataset.editKey] = el.innerText;
});

let selectedPark = null,
  parkSearch = "",
  eventType = "Todos",
  eventSearch = "";

const originalRenderDeveloper = renderDeveloper;

renderDeveloper = function () {
  originalRenderDeveloper();
  if (activeProfile === "developer") renderAdminEditors();
};

applyConfiguration();

document.body.classList.remove("show-welcome");

document
  .querySelectorAll(".page")
  .forEach((el) => el.classList.toggle("active", el.id === "home"));

state.dayCheckins ??= {};

state.personalGoals ??= { minutes: 90, days: 3 };

renderPersonalRhythm();

Promise.race([
  initializeAccount(),
  new Promise((resolve) => setTimeout(resolve, 1800)),
]).finally(() => {
  document.getElementById("splash").classList.add("done");
  setTimeout(
    () => document.getElementById("splash").classList.add("splash-hidden"),
    300,
  );
});

const exampleWorkouts = [
  {
    title: "Sentar e levantar da cadeira",
    type: "Treino",
    plan: { mode: "reps", sets: 3, reps: 10, rest: 30 },
    steps:
      "Use uma cadeira firme, sem rodinhas. Levante e sente devagar, com os pés apoiados. Use apoio se necessário. Este é um modelo ajustável, não uma prescrição individual.",
    source: "https://www.nhs.uk/live-well/exercise/strength-exercises/",
  },
  {
    title: "Alongamento de panturrilhas",
    type: "Alongamento",
    plan: { mode: "time", seconds: 60 },
    steps:
      "Com as mãos na parede, leve uma perna para trás e mantenha o calcanhar no chão. Sinta uma tensão leve, sem dor. Neste modelo: 30 segundos de cada lado.",
    source:
      "https://www.nhs.uk/live-well/exercise/how-to-stretch-after-exercising/",
  },
];

let workout = null,
  workoutTick = null;

document.getElementById("workoutCards").innerHTML = exampleWorkouts
  .map(
    (w, i) =>
      `<article class="workout-card"><span class="eyebrow">${w.type} · modelo ajustável</span><h3>${w.title}</h3><span class="prescription">${planLabel(w.plan)}</span><p>${w.steps}</p><a class="text-link" href="${w.source}" target="_blank" rel="noopener">Orientação do movimento (NHS) ↗</a><button class="btn ghost" onclick="configureWorkout(${i})">Ver e ajustar prática →</button></article>`,
  )
  .join("");
