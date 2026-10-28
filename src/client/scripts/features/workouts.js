function videoFormPlan() {
  return document.getElementById("ytMode").value === "time"
    ? {
        mode: "time",
        seconds: Number(document.getElementById("ytSeconds").value),
        focus: document.getElementById("ytFocus").value.trim(),
      }
    : {
        mode: "reps",
        sets: Number(document.getElementById("ytSets").value),
        reps: Number(document.getElementById("ytReps").value),
        rest: Number(document.getElementById("ytRest").value),
        focus: document.getElementById("ytFocus").value.trim(),
      };
}

function toggleVideoPlanFields() {
  const reps = document.getElementById("ytMode").value === "reps";
  document.getElementById("ytTimeFields").classList.toggle("hidden", reps);
  document.getElementById("ytRepsFields").classList.toggle("hidden", !reps);
}

function planLabel(p) {
  return p.mode === "reps"
    ? `${p.sets} séries de ${p.reps} repetições · ${p.rest}s de descanso`
    : p.seconds % 60 === 0
      ? `${p.seconds / 60} minuto${p.seconds === 60 ? "" : "s"}`
      : `${p.seconds} segundos`;
}

function configureWorkout(i) {
  const w = exampleWorkouts[i];
  modal(
    `<h2>${w.title}</h2><p>${w.steps}</p>${w.plan.mode === "reps" ? `<div class="workout-row"><div><label for="practiceSets">Séries</label><input id="practiceSets" type="number" min="1" max="10" value="${w.plan.sets}"></div><div><label for="practiceReps">Repetições</label><input id="practiceReps" type="number" min="1" max="100" value="${w.plan.reps}"></div><div><label for="practiceRest">Descanso (s)</label><input id="practiceRest" type="number" min="0" max="300" value="${w.plan.rest}"></div></div>` : `<label for="practiceSeconds">Tempo total (segundos)</label><input id="practiceSeconds" type="number" min="10" max="600" value="${w.plan.seconds}">`}<button class="btn" style="margin-top:20px" onclick="startConfiguredWorkout(${i})">Começar prática</button><p class="sub">Adapte a quantidade ao seu conforto. Faça menos se estiver começando.</p>`,
  );
}

function startConfiguredWorkout(i) {
  const w = exampleWorkouts[i],
    plan =
      w.plan.mode === "reps"
        ? {
            mode: "reps",
            sets: Number(document.getElementById("practiceSets").value),
            reps: Number(document.getElementById("practiceReps").value),
            rest: Number(document.getElementById("practiceRest").value),
          }
        : {
            mode: "time",
            seconds: Number(document.getElementById("practiceSeconds").value),
          };
  if (!validWorkoutPlan(plan)) {
    notify("Confira os valores da prática.");
    return;
  }
  closeModal();
  beginWorkout(w.title, plan, w.steps);
}

function beginVideoWorkout(i) {
  const v = state.youtube[i];
  beginWorkout(
    v.title,
    v.plan || { mode: "time", seconds: 60 },
    v.plan?.focus
      ? "Foco: " + v.plan.focus
      : "Acompanhe o movimento demonstrado pelo vídeo.",
  );
}

function beginWorkout(title, plan, instructions) {
  if (workout) {
    notify("Conclua ou cancele a prática em andamento.");
    return;
  }
  workout = {
    title,
    plan,
    instructions,
    completed: 0,
    phase: "work",
    started: performance.now(),
    phaseStarted: performance.now(),
    phaseAccum: 0,
    paused: false,
    pausedAt: 0,
    totalPaused: 0,
  };
  document.getElementById("activeWorkout").classList.remove("hidden");
  clearInterval(workoutTick);
  workoutTick = setInterval(renderWorkout, 200);
  renderWorkout();
  document
    .getElementById("activeWorkout")
    .scrollIntoView({ behavior: "smooth", block: "start" });
}

function workoutPhaseMs() {
  return workout
    ? workout.phaseAccum +
        (workout.paused ? 0 : performance.now() - workout.phaseStarted)
    : 0;
}

function renderWorkout() {
  if (!workout) return;
  const w = workout,
    p = w.plan,
    elapsed = workoutPhaseMs();
  if (p.mode === "time" && elapsed >= p.seconds * 1000) {
    w.phase = "done";
    w.finishedAt = performance.now();
    clearInterval(workoutTick);
  }
  if (w.phase === "rest" && elapsed >= p.rest * 1000) {
    w.phase = "work";
    w.phaseAccum = 0;
    w.phaseStarted = performance.now();
  }
  const timeLeft =
    p.mode === "time"
      ? Math.max(0, Math.ceil(p.seconds - elapsed / 1000))
      : Math.max(0, Math.ceil(p.rest - elapsed / 1000));
  let status =
    w.phase === "done"
      ? "Prática concluída"
      : w.phase === "rest"
        ? "Descanso entre séries"
        : p.mode === "time"
          ? "Alongue sem forçar"
          : `Série ${w.completed + 1} de ${p.sets}`;
  const display =
    w.phase === "done"
      ? "Concluído ✓"
      : p.mode === "time" || w.phase === "rest"
        ? `${Math.floor(timeLeft / 60)}:${String(timeLeft % 60).padStart(2, "0")}`
        : `${p.reps} repetições`;
  document.getElementById("activeWorkout").innerHTML =
    `<span class="eyebrow">${htmlEscape(status)}</span><h2>${htmlEscape(w.title)}</h2><span class="prescription">${planLabel(p)}</span><p>${htmlEscape(w.instructions)}</p><div class="workout-big">${display}</div>${p.mode === "time" && p.seconds === 60 && w.title === "Alongamento de panturrilhas" && w.phase !== "done" ? `<p class="sub">${elapsed < 30000 ? "Primeiro lado · troque após 30 segundos" : "Segundo lado · termine com conforto"}</p>` : ""}<div class="workout-progress"><i style="width:${p.mode === "time" ? Math.min(100, elapsed / (p.seconds * 10)) : (w.completed / p.sets) * 100}%"></i></div><div class="workout-controls">${w.phase === "done" ? '<button class="btn" onclick="saveWorkout()">Concluir e registrar</button>' : `<button class="btn ghost" onclick="pauseWorkout()">${w.paused ? "Continuar" : "Pausar"}</button>${p.mode === "reps" && w.phase === "work" ? `<button class="btn" onclick="completeWorkoutSet()" ${w.paused ? "disabled" : ""}>Concluí esta série</button>` : ""}`}<button class="chip" onclick="cancelWorkout()">Cancelar prática</button></div>`;
}

function completeWorkoutSet() {
  if (
    !workout ||
    workout.paused ||
    workout.phase !== "work" ||
    workout.plan.mode !== "reps"
  )
    return;
  workout.completed++;
  workout.phase =
    workout.completed === workout.plan.sets
      ? "done"
      : workout.plan.rest
        ? "rest"
        : "work";
  workout.phaseAccum = 0;
  workout.phaseStarted = performance.now();
  if (workout.phase === "done") {
    workout.finishedAt = performance.now();
    clearInterval(workoutTick);
  }
  renderWorkout();
}

function pauseWorkout() {
  if (!workout || workout.phase === "done") return;
  if (!workout.paused) {
    workout.phaseAccum = workoutPhaseMs();
    workout.paused = true;
    workout.pausedAt = performance.now();
  } else {
    workout.totalPaused += performance.now() - workout.pausedAt;
    workout.paused = false;
    workout.phaseStarted = performance.now();
  }
  renderWorkout();
}

function cancelWorkout() {
  clearInterval(workoutTick);
  workout = null;
  document.getElementById("activeWorkout").classList.add("hidden");
}

function saveWorkout() {
  if (!workout || workout.phase !== "done") return;
  const elapsed = Math.max(
    1,
    Math.round(
      ((workout.finishedAt || performance.now()) -
        workout.started -
        workout.totalPaused) /
        6000,
    ) / 10,
  );
  state.logs.push({
    name: workout.title + " · " + planLabel(workout.plan),
    minutes: elapsed,
    date: today(),
  });
  persist();
  cancelWorkout();
  notify("Prática registrada em Meu ritmo.");
}
