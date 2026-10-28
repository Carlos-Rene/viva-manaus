function renderEvents() {
  const list = document.getElementById("eventList");
  if (!list) return;
  document.getElementById("eventFilters").innerHTML = [
    "Todos",
    "Corrida",
    "Atletismo",
    "Bike",
    "Caminhada",
    "Atividade em grupo",
  ]
    .map(
      (t) =>
        `<button class="chip ${t === eventType ? "selected" : ""}" onclick="eventType='${t}';renderEvents()">${t}</button>`,
    )
    .join("");
  const todayManaus = new Date().toLocaleDateString("sv-SE", {
    timeZone: "America/Manaus",
  });
  const events = state.events
    .filter(
      (e) =>
        [
          "Bike",
          "Caminhada",
          "Corrida",
          "Atletismo",
          "Atividade em grupo",
        ].includes(e.type) &&
        e.published &&
        (eventType === "Todos" || e.type === eventType) &&
        normalizeSearch(e.name + " " + e.place).includes(
          normalizeSearch(eventSearch),
        ) &&
        (!e.date || e.date >= todayManaus),
    )
    .sort((a, b) => (a.date || "9999").localeCompare(b.date || "9999"));
  list.innerHTML =
    events
      .map(
        (e) =>
          `<article class="event-card"><span class="eyebrow">${htmlEscape(e.type)} · ${e.demo ? "EXEMPLO, NÃO É EVENTO REAL" : "LISTAGEM COM FONTE"}</span><h2>${htmlEscape(e.name)}</h2><div class="event-date">${e.date ? e.date.split("-").reverse().join("/") : "Data a definir"} ${htmlEscape(e.time || "")}</div><p>⌖ ${htmlEscape(e.place)}</p><p>${htmlEscape(e.description)}</p>${!e.demo && httpUrl(e.url) ? `<a class="btn event-source" href="${httpUrl(e.url)}" target="_blank" rel="noopener">Ver fonte / participar com organizador ↗</a>` : ""}<button class="btn ghost" onclick="toggleInterest('${e.id}')">${(state.eventInterests || []).includes(e.id) ? "✓ Salvo nos meus interesses" : "Tenho interesse"}</button><p class="sub">${e.demo ? "Interesse demonstrativo; não é inscrição." : "Salvar interesse não faz inscrição nem confirma vaga."}</p></article>`,
      )
      .join("") ||
    '<div class="notice">Nenhum evento futuro publicado nesta categoria. A equipe pode cadastrar novos eventos no painel.</div>';
}

function toggleInterest(id) {
  state.eventInterests ??= [];
  state.eventInterests = state.eventInterests.includes(id)
    ? state.eventInterests.filter((x) => x !== id)
    : [...state.eventInterests, id];
  persist();
  renderEvents();
}

function addEventFromForm(e) {
  e.preventDefault();
  let data = structuredClone(editorData());
  data.events.push({
    id: "event-" + Date.now(),
    name: document.getElementById("newEventName").value.trim(),
    type: document.getElementById("newEventType").value,
    date: document.getElementById("newEventDate").value,
    time: document.getElementById("newEventTime").value,
    place: document.getElementById("newEventPlace").value.trim(),
    description: document.getElementById("newEventDescription").value.trim(),
    url: document.getElementById("newEventUrl").value.trim(),
    demo: document.getElementById("newEventDemo").checked,
    published: true,
  });
  saveEditorData(data);
}
