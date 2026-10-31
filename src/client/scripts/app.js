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
  "id": "jefferson",
  "name": "Parque Senador Jefferson Péres",
  "district": "Centro",
  "point": [-3.135867, -60.016778],
  "pointAccuracy": "osm",
  "description": "Parque urbano no Centro Histórico de Manaus, próximo ao Palácio Rio Negro.",
  "source": "https://www.openstreetmap.org/way/230975844",
  "enabled": true,
  "boundary": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {
          "id": "jefferson",
          "name": "Parque Senador Jefferson Péres",
          "boundaryStatus": "osm",
          "source": "OpenStreetMap",
          "osmId": "way/230975844"
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": [
            [
              [-60.018033, -3.134838],
              [-60.018129, -3.134841],
              [-60.018175, -3.135186],
              [-60.018127, -3.135193],
              [-60.018122, -3.135248],
              [-60.017992, -3.135420],
              [-60.017934, -3.135528],
              [-60.017802, -3.135656],
              [-60.017522, -3.135931],
              [-60.017544, -3.135958],
              [-60.017486, -3.136011],
              [-60.017527, -3.136054],
              [-60.017467, -3.136124],
              [-60.017363, -3.136047],
              [-60.017256, -3.136171],
              [-60.017313, -3.136222],
              [-60.017256, -3.136287],
              [-60.017325, -3.136347],
              [-60.017128, -3.136602],
              [-60.017055, -3.136542],
              [-60.016967, -3.136630],
              [-60.017075, -3.136717],
              [-60.016485, -3.137490],
              [-60.016401, -3.137600],
              [-60.015968, -3.137297],
              [-60.016043, -3.137208],
              [-60.016094, -3.137164],
              [-60.016178, -3.137112],
              [-60.016240, -3.137075],
              [-60.016281, -3.137046],
              [-60.016331, -3.136997],
              [-60.016370, -3.136942],
              [-60.016398, -3.136884],
              [-60.016417, -3.136819],
              [-60.016426, -3.136770],
              [-60.016426, -3.136719],
              [-60.016375, -3.136660],
              [-60.016361, -3.136606],
              [-60.016343, -3.136568],
              [-60.016324, -3.136523],
              [-60.016287, -3.136461],
              [-60.016306, -3.136404],
              [-60.016214, -3.136241],
              [-60.015989, -3.135843],
              [-60.015905, -3.135698],
              [-60.015825, -3.135523],
              [-60.015781, -3.135417],
              [-60.015745, -3.135344],
              [-60.015685, -3.135314],
              [-60.015659, -3.135255],
              [-60.015636, -3.135097],
              [-60.015620, -3.134850],
              [-60.015628, -3.134837],
              [-60.015646, -3.134830],
              [-60.015687, -3.134828],
              [-60.016499, -3.134822],
              [-60.016535, -3.135407],
              [-60.016540, -3.135643],
              [-60.016688, -3.135725],
              [-60.016855, -3.135714],
              [-60.016941, -3.135541],
              [-60.017008, -3.135286],
              [-60.017217, -3.135205],
              [-60.017560, -3.135199],
              [-60.017555, -3.134814],
              [-60.018034, -3.134804],
              [-60.018033, -3.134838]
            ]
          ]
        }
      }
    ]
  }
},    
{
  "id": "bilhares",
  "name": "Parque dos Bilhares",
  "district": "Chapada",
  "point": [-3.101667, -60.026944],
  "pointAccuracy": "osm",
  "boundaryAccuracy": "approximate",
  "boundaryAttribution": "OpenStreetMap (way/915524067). Limite cartográfico não confirmado oficialmente.",
  "description": "Parque Municipal Ponte dos Bilhares, localizado na Avenida Constantino Nery, no bairro Chapada, em Manaus.",
  "source": "https://www.openstreetmap.org/way/915524067",
  "enabled": true,
  "boundary": {
    "type": "Feature",
    "properties": {
      "id": "bilhares",
      "name": "Parque dos Bilhares",
      "boundaryStatus": "osm",
      "source": "OpenStreetMap",
      "osmId": "way/915524067"
    },
    "geometry": {
      "type": "Polygon",
      "coordinates": [
        [
          [-60.030173, -3.101272],
          [-60.029743, -3.102574],
          [-60.028823, -3.102982],
          [-60.028746, -3.102979],
          [-60.028384, -3.102278],
          [-60.027843, -3.10217],
          [-60.027237, -3.10204],
          [-60.026693, -3.1021],
          [-60.026381, -3.102472],
          [-60.026366, -3.102886],
          [-60.026258, -3.102816],
          [-60.02589, -3.102776],
          [-60.025702, -3.102738],
          [-60.02551, -3.102691],
          [-60.025247, -3.102604],
          [-60.025056, -3.102596],
          [-60.024891, -3.102595],
          [-60.024721, -3.102579],
          [-60.024453, -3.102553],
          [-60.02421, -3.102541],
          [-60.024227, -3.101764],
          [-60.024632, -3.101802],
          [-60.025248, -3.101979],
          [-60.025463, -3.102026],
          [-60.025681, -3.10207],
          [-60.026063, -3.102145],
          [-60.026218, -3.102184],
          [-60.026287, -3.102194],
          [-60.026327, -3.102189],
          [-60.026365, -3.102169],
          [-60.026822, -3.101811],
          [-60.026828, -3.101758],
          [-60.026822, -3.101694],
          [-60.026784, -3.101577],
          [-60.026749, -3.101454],
          [-60.026698, -3.101339],
          [-60.02667, -3.101297],
          [-60.026667, -3.101273],
          [-60.026636, -3.101226],
          [-60.030173, -3.101272]
        ]
      ]
    }
  }
},
 {
  "id": "mindu",
  "name": "Parque Municipal do Mindu",
  "district": "Parque 10 de Novembro",
  "point": [-3.081055, -60.003817],
  "boundaryAccuracy": "approximate",
  "boundaryAttribution": "OpenStreetMap (way/503474523). Limite cartográfico não confirmado oficialmente.",
  "pointAccuracy": "osm",
  "description": "Parque urbano de Manaus destinado à preservação ambiental, contemplação e contato com a natureza.",
  "source": "https://www.openstreetmap.org/way/503474523",
  "enabled": true,
  "boundary": {
    "type": "FeatureCollection",
    "features": [
      {
        "type": "Feature",
        "properties": {
          "id": "mindu",
          "name": "Parque Municipal do Mindu",
          "boundaryStatus": "osm",
          "source": "OpenStreetMap",
          "osmId": "way/503474523"
        },
        "geometry": {
          "type": "Polygon",
          "coordinates": [
            [
              [-60.009017, -3.078621],
              [-60.008999, -3.078859],
              [-60.008947, -3.079246],
              [-60.008886, -3.079483],
              [-60.008817, -3.079592],
              [-60.008726, -3.079685],
              [-60.008571, -3.079747],
              [-60.008386, -3.079795],
              [-60.008071, -3.079776],
              [-60.007836, -3.079784],
              [-60.007259, -3.080120],
              [-60.006994, -3.080334],
              [-60.006809, -3.080475],
              [-60.006726, -3.080557],
              [-60.006640, -3.080673],
              [-60.006579, -3.080842],
              [-60.006546, -3.080981],
              [-60.006525, -3.081155],
              [-60.006444, -3.081712],
              [-60.006355, -3.082151],
              [-60.006302, -3.082333],
              [-60.005960, -3.082919],
              [-60.005561, -3.082992],
              [-60.004111, -3.083857],
              [-60.003193, -3.084193],
              [-60.003150, -3.084307],
              [-60.002979, -3.084302],
              [-60.002554, -3.082625],
              [-60.001908, -3.082870],
              [-60.001907, -3.083014],
              [-60.000717, -3.082775],
              [-60.000733, -3.083219],
              [-59.999632, -3.083249],
              [-59.998494, -3.081682],
              [-59.998380, -3.081489],
              [-59.998514, -3.081266],
              [-59.998601, -3.081073],
              [-59.998577, -3.080827],
              [-59.998581, -3.080728],
              [-59.998626, -3.080495],
              [-59.998587, -3.080382],
              [-59.998509, -3.079737],
              [-59.998874, -3.079668],
              [-59.999078, -3.079665],
              [-59.999101, -3.080447],
              [-59.999105, -3.080789],
              [-59.999245, -3.080789],
              [-59.999759, -3.080748],
              [-59.999795, -3.081122],
              [-60.000076, -3.081071],
              [-60.000509, -3.080920],
              [-60.001816, -3.080301],
              [-60.001853, -3.080284],
              [-60.002324, -3.080058],
              [-60.002657, -3.079887],
              [-60.004125, -3.079262],
              [-60.005937, -3.078535],
              [-60.006413, -3.078274],
              [-60.007452, -3.077994],
              [-60.007953, -3.077857],
              [-60.008127, -3.077819],
              [-60.008322, -3.077837],
              [-60.008416, -3.077883],
              [-60.008463, -3.077944],
              [-60.008508, -3.078093],
              [-60.008620, -3.078230],
              [-60.008879, -3.078413],
              [-60.008988, -3.078495],
              [-60.009017, -3.078621]
            ]
          ]
        }
      }
    ]
  }
}
];

state.parks ??= structuredClone(defaultParks);
state.parks = mergeBundledParkData(state.parks);


function mergeBundledParkData(parks) {
  const updatedById = new Map(defaultParks.map((park) => [park.id, park]));

  return parks.map((park) => {
    const updated = updatedById.get(park.id);

    if (!updated) return park;

    const hasValidSavedBoundary =
      !!park.boundary && validParkBoundary(park.boundary);

    const hasValidBundledBoundary =
      !!updated.boundary && validParkBoundary(updated.boundary);

    return {
      ...park,

      // Mantém as coordenadas de referência atualizadas.
      point: updated.point,
      pointAccuracy: updated.pointAccuracy,

      // Preserva o polígono salvo no modo desenvolvedor.
      // Só utiliza o padrão quando não existe um polígono válido salvo.
      ...(!hasValidSavedBoundary && hasValidBundledBoundary
        ? {
            boundary: structuredClone(updated.boundary),
            boundaryAccuracy: updated.boundaryAccuracy,
            boundaryAttribution: updated.boundaryAttribution,
            boundarySource: updated.boundarySource
          }
        : {})
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
