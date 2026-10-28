let appTour = null;
function tourPoint(element) {
  if (!appTour || !element) return;
  const r = element.getBoundingClientRect();
  const cursor = document.getElementById("tutorialCursor");
  cursor.style.left = r.left + r.width * 0.6 - 11 + "px";
  cursor.style.top =
    Math.min(innerHeight - 105, Math.max(85, r.top + r.height * 0.5)) -
    11 +
    "px";
  cursor.classList.add("tap");
  setTimeout(() => cursor.classList.remove("tap"), 300);
}
function tourLook(selector, action) {
  const el = document.querySelector(selector);
  if (!el) return;
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  setTimeout(() => {
    if (!appTour) return;
    tourPoint(el);
    if (action) action(el);
  }, 650);
}
function tourCaption(text) {
  const label = document.getElementById("tutorialCaption");
  if (label) label.textContent = text;
}
function tourAt(ms, fn) {
  appTour.timers.push(
    setTimeout(() => {
      if (appTour) fn();
    }, ms),
  );
}
function startAppTutorial() {
  if (appTour) return;
  if (workout) cancelWorkout();
  if (minuteSession) cancelMinute();
  if (walkSession) {
    if (!walkSession.demo) {
      notify("Finalize sua caminhada antes de iniciar o tutorial.");
      return;
    }
    finishWalk();
  }
  appTour = { timers: [], started: performance.now() };
  document.body.classList.add("tutorial-running");
  const guide = document.createElement("div");
  guide.id = "tutorialGuide";
  guide.className = "tutorial-guide";
  guide.innerHTML =
    '<span id="tutorialCaption">Viva · veja como usar o app</span><button onclick="stopAppTutorial()">Fechar</button>';
  document.body.append(guide);
  const cursor = document.createElement("div");
  cursor.id = "tutorialCursor";
  cursor.className = "tutorial-cursor";
  cursor.style.left = "50%";
  cursor.style.top = "180px";
  document.body.append(cursor);
  go("home");
  tourAt(800, () => {
    tourCaption("Escolha uma opção para começar.");
    tourLook("#home .option");
  });
  tourAt(3000, () =>
    tourLook('nav [data-page="activities"]', (el) => el.click()),
  );
  tourAt(4500, () => {
    tourCaption("Informe seu ânimo, seu objetivo e o tempo disponível.");
    tourLook("#moods .mood:nth-child(2)", (el) => el.click());
  });
  tourAt(6300, () =>
    tourLook("#intentOptions .chip:nth-child(5)", (el) => el.click()),
  );
  tourAt(8100, () => tourLook("#times .chip:nth-child(2)", (el) => el.click()));
  tourAt(10000, () => {
    tourCaption("As sugestões mudam conforme suas escolhas.");
    tourLook("#resultsHeading");
  });
  tourAt(12000, () =>
    tourLook("#activityList .activity .btn", (el) => el.click()),
  );
  tourAt(14300, () => {
    closeModal();
    go("exercises");
    tourCaption("Treinos por séries; alongamentos por tempo.");
  });
  tourAt(15700, () =>
    tourLook("#workoutCards .workout-card:first-child .btn", (el) =>
      el.click(),
    ),
  );
  tourAt(18000, () => {
    tourPoint(document.querySelector("#practiceSets"));
  });
  tourAt(19500, () => {
    closeModal();
    tourLook("#workoutCards .workout-card:nth-child(2) .btn", (el) =>
      el.click(),
    );
  });
  tourAt(21400, () => {
    tourPoint(document.querySelector(".dialog .btn"));
    startConfiguredWorkout(1);
    tourCaption("Acompanhe o cronômetro, pause ou ajuste a prática.");
  });
  tourAt(24600, () => {
    if (workout) pauseWorkout();
    tourLook("#activeWorkout");
  });
  tourAt(26500, () => {
    cancelWorkout();
    go("nature");
    tourCaption("A câmera fica dentro do aplicativo.");
  });
  tourAt(28000, () => tourLook(".camera-actions"));
  tourAt(30100, () => {
    go("walk");
    tourCaption("Pesquise os parques de Manaus e abra a localização.");
  });
  tourAt(31200, () =>
    tourLook("#parkSearch", (el) => {
      el.value = "Jefferson";
      searchParks("Jefferson");
    }),
  );
  tourAt(32900, () => tourLook("#parksList .park-choice", (el) => el.click()));
  tourAt(35000, () => {
    const details = document.querySelector(".tracking-details");
    details.open = true;
    tourCaption(
      "Para km e trajeto, permita o GPS. Aqui usamos a demonstração.",
    );
    tourLook("#walkDemo", (el) => el.click());
  });
  tourAt(37400, () => tourLook("#routeDrawing"));
  tourAt(40200, () => {
    if (walkSession?.running) pauseWalk();
    tourLook("#walkTime");
  });
  tourAt(42000, () => {
    if (walkSession?.demo) finishWalk();
    go("events");
    tourCaption("Eventos de esportes e atividades físicas em grupo.");
  });
  tourAt(43500, () =>
    tourLook("#eventFilters .chip:nth-child(4)", (el) => el.click()),
  );
  tourAt(45300, () => tourLook("#eventList .event-card"));
  tourAt(47000, () => {
    go("routine");
    tourCaption("Registre seu bem-estar e acompanhe as metas.");
  });
  tourAt(48300, () => tourLook(".routine-extra:first-of-type"));
  tourAt(49800, () => tourLook("#dayMood"));
  tourAt(51500, () => tourLook("#weeklyMinutesGoal"));
  tourAt(53500, () => {
    go("about");
    tourCaption("No Sobre, veja para que serve cada função do Viva.");
    tourLook("#about h1");
  });
  tourAt(55700, () => {
    go("devlogin");
    tourCaption("O DEV só entra com conta autorizada no servidor.");
  });
  tourAt(57900, () => tourLook("#devlogin .login-anchor"));
  tourAt(60500, () => stopAppTutorial());
}
function stopAppTutorial() {
  if (!appTour) return;
  appTour.timers.forEach(clearTimeout);
  if (workout) cancelWorkout();
  if (walkSession?.demo) finishWalk();
  closeModal();
  appTour = null;
  document.body.classList.remove("tutorial-running");
  document.getElementById("tutorialGuide")?.remove();
  document.getElementById("tutorialCursor")?.remove();
  go("about");
}
