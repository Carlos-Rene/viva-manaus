function renderStats() {
  let n = state.logs
    .filter((x) => x.date === today())
    .reduce((s, x) => s + x.minutes, 0);
  document.querySelectorAll(".minutes").forEach((x) => (x.textContent = n));
  let d = new Date(),
    dow = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - dow);
  let sum = 0;
  document.getElementById("week").innerHTML = [
    "Seg",
    "Ter",
    "Qua",
    "Qui",
    "Sex",
    "Sáb",
    "Dom",
  ]
    .map((name, i) => {
      let day = new Date(d);
      day.setDate(d.getDate() + i);
      let key = day.toLocaleDateString("sv-SE"),
        v = state.logs
          .filter((l) => l.date === key)
          .reduce((s, l) => s + l.minutes, 0);
      sum += v;
      return `<div class="day"><span>${v}</span><div class="bar" style="height:${Math.min(75, v * 1.5) + 5}px"></div>${name}</div>`;
    })
    .join("");
  document.getElementById("insight").textContent = sum
    ? `Você reservou ${sum} minutos para suas pausas nesta semana. Observe quais atividades você mais gosta de repetir.`
    : "Sua semana começa com uma pequena pausa. Que tal experimentar uma atividade de 5 minutos?";
  document.getElementById("history").innerHTML = state.logs.length
    ? state.logs
        .slice()
        .reverse()
        .slice(0, 8)
        .map(
          (l) =>
            `<div class="stat row"><b>${l.name}</b><span class="sub">${l.date.split("-").reverse().join("/")} · ${l.minutes} min${l.km != null ? " · " + l.km.toFixed(2) + " km" : ""}</span></div>`,
        )
        .join("")
    : "<p>Ainda sem registros. Sua primeira pausa aparece aqui.</p>";
  document.getElementById("herbarium").textContent = state.plants
    ? "Uma descoberta demonstrativa antiga está salva. Ela não foi identificada a partir de uma foto."
    : "Suas descobertas salvas aparecem aqui.";
}

function saveRoutine() {
  let val = document.getElementById("sleep").value,
    n = Number(val);
  if (val === "" || n < 0 || n > 24) {
    notify("Informe as horas de sono, entre 0 e 24.");
    return;
  }
  state.sleep = n;
  state.goal = document.getElementById("goal").value;
  persist();
  document.getElementById("routineAdvice").textContent =
    `Seu foco: ${state.goal.toLowerCase()}. ` +
    (n < 6
      ? "Você registrou uma noite curta. Hoje, experimente uma pausa leve e observe sua disposição."
      : "Escolha uma atividade que caiba no seu dia e observe como você se sente depois.");
  notify("Check-in salvo");
}

function saveDayCheckin() {
  state.dayCheckins[today()] = {
    mood: document.getElementById("dayMood").value,
    energy: document.getElementById("dayEnergy").value,
    stress: document.getElementById("dayStress").value,
    sleepQuality: document.getElementById("sleepQuality").value,
  };
  persist();
  renderPersonalRhythm();
  notify("Seu dia foi registrado.");
}

function savePersonalGoals() {
  const minutes = Number(document.getElementById("weeklyMinutesGoal").value),
    days = Number(document.getElementById("weeklyDaysGoal").value);
  if (
    !Number.isFinite(minutes) ||
    minutes < 5 ||
    minutes > 3000 ||
    !Number.isInteger(days) ||
    days < 1 ||
    days > 7
  ) {
    notify("Escolha de 5 a 3000 minutos e de 1 a 7 dias.");
    return;
  }
  state.personalGoals = { minutes, days };
  persist();
  renderPersonalRhythm();
  notify("Metas atualizadas.");
}

function renderPersonalRhythm() {
  const day = state.dayCheckins[today()];
  if (day) {
    document.getElementById("dayMood").value = day.mood;
    document.getElementById("dayEnergy").value = day.energy;
    document.getElementById("dayStress").value = day.stress;
    document.getElementById("sleepQuality").value = day.sleepQuality;
    document.getElementById("dayCheckinSummary").textContent =
      "Hoje: " +
      day.mood.toLowerCase() +
      " · disposição " +
      day.energy.toLowerCase() +
      " · sono " +
      day.sleepQuality.toLowerCase();
  }
  document.getElementById("weeklyMinutesGoal").value =
    state.personalGoals.minutes;
  document.getElementById("weeklyDaysGoal").value = state.personalGoals.days;
  let d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  const start = d.toLocaleDateString("sv-SE"),
    week = state.logs.filter((l) => l.date >= start && l.date <= today()),
    minutes = week.reduce((s, l) => s + l.minutes, 0),
    days = new Set(week.map((l) => l.date)).size;
  document.getElementById("personalProgress").textContent =
    `Nesta semana: ${Math.round(minutes)} de ${state.personalGoals.minutes} minutos · ${days} de ${state.personalGoals.days} dias ativos.`;
  const walks = state.logs.filter((l) => l.km != null);
  document.getElementById("walkHistorySummary").textContent =
    `${walks.length} caminhadas · ${walks.reduce((s, l) => s + l.km, 0).toFixed(2)} km registrados`;
  document.getElementById("walkHistoryRoutes").innerHTML = walks
    .slice()
    .reverse()
    .slice(0, 5)
    .map(
      (l) =>
        `<div class="route-history"><b>${htmlEscape(l.name)}</b><p class="sub">${l.date.split("-").reverse().join("/")} · ${l.km.toFixed(2)} km · ${l.minutes} min</p>${l.route ? `<button class="chip" onclick="showStoredRoute(${state.logs.indexOf(l)})">Ver trajeto</button>` : ""}</div>`,
    )
    .join("");
}
