function youtubeId(raw) {
  try {
    const u = new URL(raw);
    const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
    let id;
    if (host === "youtu.be") id = u.pathname.split("/")[1];
    else if (host === "youtube.com" || host === "youtube-nocookie.com") {
      const parts = u.pathname.split("/");
      id =
        parts[1] === "watch"
          ? u.searchParams.get("v")
          : ["shorts", "embed", "live"].includes(parts[1])
            ? parts[2]
            : null;
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(id || "") ? id : null;
  } catch {
    return null;
  }
}

function renderYoutube() {
  document.getElementById("videoFilters").innerHTML = [
    "Todos",
    "Exercício",
    "Alongamento",
  ]
    .map(
      (v) =>
        `<button class="chip ${videoFilter === v ? "selected" : ""}" onclick="videoFilter='${v}';renderYoutube()">${v === "Exercício" ? "Treino" : v}</button>`,
    )
    .join("");
  document.getElementById("exerciseLessons").innerHTML =
    state.youtube
      .map((v, i) => ({ v, i }))
      .filter(({ v }) => videoFilter === "Todos" || v.type === videoFilter)
      .map(
        ({ v, i }) =>
          `<article class="lesson"><span class="eyebrow">${v.type === "Exercício" ? "TREINO" : "ALONGAMENTO"}</span><h2>${htmlEscape(v.title)}</h2><span class="prescription">${planLabel(v.plan || { mode: "time", seconds: 60 })}</span><div id="ytSlot${i}" class="yt-slot"><button class="play-yt" onclick="playYoutube(${i})">▷<span>Assistir no app</span></button></div><p>Trecho a partir de ${v.start}s. O vídeo original pode ser mais longo. O cronômetro de prática funciona separadamente.</p><a href="https://www.youtube.com/watch?v=${v.id}&t=${v.start}s" target="_blank" rel="noopener" class="text-link">Abrir no YouTube se o autor bloquear a reprodução ↗</a><button class="btn" onclick="beginVideoWorkout(${i})">Iniciar prática →</button><button class="chip admin-remove" onclick="removeYoutube(${i})">Remover vídeo</button></article>`,
      )
      .join("") ||
    '<div class="notice">Nenhum vídeo nesta categoria. Cole um link abaixo para adicionar.</div>';
}

function playYoutube(i) {
  renderYoutube();
  let v = state.youtube[i];
  const frame = document.createElement("iframe");
  frame.className = "youtube-frame";
  frame.title = v.title;
  frame.src = `https://www.youtube-nocookie.com/embed/${v.id}?start=${v.start}&end=${v.start + 60}&playsinline=1&rel=0`;
  frame.allow = "autoplay; encrypted-media; picture-in-picture; fullscreen";
  frame.allowFullscreen = true;
  frame.referrerPolicy = "strict-origin-when-cross-origin";
  document.getElementById("ytSlot" + i).replaceChildren(frame);
}

async function addYoutube(e) {
  e.preventDefault();
  if (!adminAllowed()) return;
  const id = youtubeId(document.getElementById("ytLink").value),
    title = document.getElementById("ytTitle").value.trim(),
    start = Number(document.getElementById("ytStart").value);
  if (!id || !title || !Number.isInteger(start) || start < 0 || start > 86400) {
    notify("Confira o link, o título e o início do vídeo.");
    return;
  }
  const data = structuredClone(editorData());
  const plan = videoFormPlan();
  if (!validWorkoutPlan(plan)) {
    notify("Confira tempo, séries, repetições e descanso.");
    return;
  }
  data.videos.push({
    id,
    title,
    type: document.getElementById("ytType").value,
    start,
    plan,
  });
  try {
    await publishCatalog(validateConfig(data));
    videoFilter = "Todos";
    renderYoutube();
    renderDeveloper();
    e.target.reset();
    toggleVideoPlanFields();
    notify("Vídeo publicado.");
  } catch (error) {
    notify(error.message);
  }
}

async function removeYoutube(i) {
  if (!adminAllowed()) return;
  const data = structuredClone(editorData());
  data.videos.splice(i, 1);
  try {
    await publishCatalog(data);
    renderYoutube();
    renderDeveloper();
    notify("Vídeo removido do catálogo.");
  } catch (e) {
    notify(e.message);
  }
}

function minuteElapsed() {
  return minuteSession
    ? Math.min(
        60000,
        minuteSession.accum +
          (minuteSession.running ? performance.now() - minuteSession.since : 0),
      )
    : 0;
}

function beginMinute(i) {
  if (minuteSession && minuteElapsed() < 60000) {
    notify("Conclua ou cancele a prática atual.");
    return;
  }
  minuteSession = {
    title: state.youtube[i].title,
    accum: 0,
    since: performance.now(),
    running: true,
  };
  document.getElementById("minutePanel").classList.remove("hidden");
  document.getElementById("minuteTitle").textContent = minuteSession.title;
  clearInterval(minuteInterval);
  minuteInterval = setInterval(renderMinute, 200);
  renderMinute();
  document.getElementById("minutePanel").scrollIntoView({ behavior: "smooth" });
}

function renderMinute() {
  if (!minuteSession) return;
  let left = Math.ceil((60000 - minuteElapsed()) / 1000);
  document.getElementById("minuteClock").textContent =
    String(Math.floor(left / 60)).padStart(2, "0") +
    ":" +
    String(left % 60).padStart(2, "0");
  document.getElementById("minutePause").textContent = minuteSession.running
    ? "Pausar"
    : "Continuar";
  document.getElementById("minuteSave").disabled = left > 0;
  if (left === 0) {
    minuteSession.running = false;
    minuteSession.accum = 60000;
    clearInterval(minuteInterval);
    document.getElementById("minuteMessage").textContent =
      "Seu minuto terminou. Registre se você realizou a atividade.";
  } else
    document.getElementById("minuteMessage").textContent =
      "Faça no seu ritmo. Você pode pausar ou cancelar.";
}

function pauseMinute() {
  if (!minuteSession || minuteElapsed() >= 60000) return;
  if (minuteSession.running) {
    minuteSession.accum = minuteElapsed();
    minuteSession.running = false;
  } else {
    minuteSession.running = true;
    minuteSession.since = performance.now();
  }
  renderMinute();
}

function cancelMinute() {
  clearInterval(minuteInterval);
  minuteSession = null;
  document.getElementById("minutePanel").classList.add("hidden");
}

function saveMinute() {
  if (!minuteSession || minuteElapsed() < 60000) return;
  state.logs.push({ name: minuteSession.title, minutes: 1, date: today() });
  persist();
  cancelMinute();
  notify("1 minuto registrado no seu bem-estar.");
}
