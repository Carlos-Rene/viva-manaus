function matchingIds(m, t, wanted) {
  let ids = moodMatches[m] || [];
  return ids.filter(
    (i) =>
      activities[i][4] <= t &&
      (!intentMatches[wanted] || intentMatches[wanted].includes(i)),
  );
}

function chooseMood(m) {
  mood = m;
  recommended = true;
  filter = "Todas";
  renderChoices();
  renderActivities();
}

function chooseIntent(v) {
  intent = v;
  recommended = true;
  filter = "Todas";
  renderChoices();
  renderActivities();
}

function chooseTime(v) {
  time = v;
  recommended = true;
  renderChoices();
  renderActivities();
}

function renderChoices() {
  document.getElementById("moods").innerHTML = moodOptions
    .map(
      ([e, m]) =>
        `<button aria-pressed="${m === mood}" class="mood ${m === mood ? "selected" : ""}" onclick="chooseMood('${m}')"><span>${e}</span>${m}</button>`,
    )
    .join("");
  document.getElementById("times").innerHTML = [5, 15, 30, 60]
    .map(
      (t) =>
        `<button aria-pressed="${t === time}" class="chip ${t === time ? "selected" : ""}" onclick="chooseTime(${t})">${t === 60 ? "1 hora" : t + " min"}</button>`,
    )
    .join("");
  document.getElementById("intentOptions").innerHTML = Object.keys(
    intentMatches,
  )
    .map(
      (v) =>
        `<button aria-pressed="${v === intent}" class="chip ${v === intent ? "selected" : ""}" onclick="chooseIntent('${v}')">${v}</button>`,
    )
    .join("");
}

function art(a) {
  let type = activities.indexOf(a);
  if ([0, 3, 9].includes(type))
    return `<img src="/assets/images/visual-7.svg" alt="" style="width:100%;height:100%">`;
  if (type === 1)
    return `<img src="/assets/images/visual-8.svg" alt="" style="width:100%;height:100%">`;
  return `<img src="/assets/images/visual-9.svg" alt="" style="width:100%;height:100%">`;
}

function card(a) {
  let i = activities.indexOf(a);
  return `<article class="activity"><div class="illustration">${art(a)}</div><div class="row" style="margin-top:14px"><span class="sub">${a[3]}</span><span class="sub">◷ ${a[4]} min</span></div><h3>${a[0]}</h3><p>${a[1]}</p><button class="btn ghost" onclick="startActivity(${i})">Quero experimentar ↗</button></article>`;
}

function recommend() {
  recommended = true;
  filter = "Todas";
  state.mood = mood;
  persist();
  renderActivities();
  document
    .getElementById("resultsHeading")
    .scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderActivities() {
  document.getElementById("recText").textContent =
    "Escolha como você está e o que quer fazer. As sugestões mudam na hora.";
  document.getElementById("categories").innerHTML = [
    "Todas",
    "Ao ar livre",
    "Movimento",
    "Relaxar",
    "Em casa",
    "Criatividade",
    "Conexão",
  ]
    .map(
      (c) =>
        `<button class="chip ${filter === c ? "selected" : ""}" onclick="filter='${c}';renderActivities()">${c}</button>`,
    )
    .join("");
  let ids = matchingIds(mood, time, intent);
  let list = ids
    .map((i) => activities[i])
    .filter((a) => filter === "Todas" || a[3] === filter);
  document.getElementById("resultsHeading").textContent =
    `${list.length} opções para o seu momento`;
  document.getElementById("matchSummary").textContent =
    `${mood} · ${intent} · até ${time} min`;
  document.getElementById("matchReason").textContent = {
    Cansado: "Pausas leves e de baixa exigência para o seu momento.",
    Entediado: "Novidade, criatividade e pequenos desafios para variar o dia.",
    Agitado: "Atividades tranquilas para fazer uma coisa de cada vez.",
    Desanimado: "Começos pequenos, expressão e conexão, sem cobrança.",
    "Querendo companhia":
      "Ideias que você pode compartilhar ou fazer com alguém.",
    Tranquilo: "Espaço para observar, criar e explorar com calma.",
    Disposto: "Mais movimento e exploração, respeitando seu ritmo.",
  }[mood];
  document.getElementById("activityList").innerHTML =
    list.map(card).join("") ||
    `<div class="notice" style="grid-column:1/-1">Não encontramos uma opção para essa combinação. Experimente outra categoria, aumente o tempo ou escolha “Me surpreenda”.<button class="btn ghost" style="margin-top:12px" onclick="intent='Me surpreenda';filter='Todas';renderChoices();renderActivities()">Ampliar as opções</button></div>`;
}

function startActivity(i) {
  let a = activities[i];
  modal(
    `<div style="font-size:64px;padding-top:12px">${a[2]}</div><span class="eyebrow">${a[3]} · ${a[4]} MIN</span><h1>${a[0]}</h1><p>${a[5]}</p><div class="notice">Adapte a atividade à sua condição e ao seu espaço. Você pode parar quando quiser.</div><button class="btn" style="width:100%;margin-top:22px" onclick="running(${i})">Começar minha pausa →</button>`,
  );
}

function running(i) {
  let a = activities[i];
  modal(
    `<div style="font-size:58px">${a[2]}</div><h2>Sua pausa começou.</h2><p>${a[0]} · sugestão de ${a[4]} minutos</p><p>Deixe a tela de lado e aproveite seu momento. Ao voltar, registre como foi.</p><label for="actual">Quantos minutos você fez?</label><input id="actual" type="number" value="${a[4]}" min="1" max="300" style="margin:12px 0"><button class="btn" onclick="finish(${i})">Concluir e registrar ✓</button>${i === 0 ? '<button class="chip" onclick="closeModal();go(\'nature\')">Abrir Olhar curioso</button>' : ""}`,
  );
}

function finish(i) {
  let n = Number(document.getElementById("actual").value);
  if (!n || n < 1 || n > 300) {
    notify("Informe entre 1 e 300 minutos.");
    return;
  }
  state.logs.push({ name: activities[i][0], minutes: n, date: today() });
  persist();
  closeModal();
  notify("Pausa registrada. Um passo por você!");
}
