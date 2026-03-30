const STORAGE_KEY = "lorehub-state-v1";

const state = loadState();

const documentForm = document.getElementById("document-form");
const relationForm = document.getElementById("relation-form");
const eventForm = document.getElementById("event-form");

const documentsList = document.getElementById("documents-list");
const relationsList = document.getElementById("relations-list");
const eventsList = document.getElementById("events-list");

const relationSourceSelect = document.getElementById("relation-source");
const relationTargetSelect = document.getElementById("relation-target");
const eventDocumentSelect = document.getElementById("event-document");

const timelineMode = document.getElementById("timeline-mode");
const timelineDocumentsSelect = document.getElementById("timeline-documents");
const renderTimelineButton = document.getElementById("render-timeline");
const timelineContainer = document.getElementById("timeline");
const timelineEmpty = document.getElementById("timeline-empty");

documentForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const document = {
    id: crypto.randomUUID(),
    title: document.getElementById("doc-title").value.trim(),
    type: document.getElementById("doc-type").value,
    description: document.getElementById("doc-description").value.trim(),
  };

  if (!document.title || !document.description) {
    return;
  }

  state.documents.push(document);
  persist();
  renderAll();
  documentForm.reset();
});

relationForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const relation = {
    id: crypto.randomUUID(),
    sourceId: relationSourceSelect.value,
    targetId: relationTargetSelect.value,
    type: document.getElementById("relation-type").value.trim(),
    note: document.getElementById("relation-note").value.trim(),
  };

  if (!relation.sourceId || !relation.targetId || !relation.type) {
    return;
  }

  state.relations.push(relation);
  persist();
  renderAll();
  relationForm.reset();
});

eventForm.addEventListener("submit", (event) => {
  event.preventDefault();

  const start = document.getElementById("event-start").value;
  const endRaw = document.getElementById("event-end").value;

  if (!start) {
    return;
  }

  const end = endRaw || start;

  if (new Date(end).getTime() < new Date(start).getTime()) {
    alert("Дата завершения не может быть раньше даты начала.");
    return;
  }

  const record = {
    id: crypto.randomUUID(),
    documentId: eventDocumentSelect.value,
    title: document.getElementById("event-title").value.trim(),
    description: document.getElementById("event-description").value.trim(),
    start,
    end,
  };

  if (!record.documentId || !record.title || !record.description) {
    return;
  }

  state.events.push(record);
  persist();
  renderAll();
  eventForm.reset();
});

renderTimelineButton.addEventListener("click", () => {
  renderTimeline();
});

function loadState() {
  const fallback = { documents: [], relations: [], events: [] };
  const raw = localStorage.getItem(STORAGE_KEY);

  if (!raw) {
    return fallback;
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      documents: parsed.documents || [],
      relations: parsed.relations || [],
      events: parsed.events || [],
    };
  } catch {
    return fallback;
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function renderAll() {
  renderDocuments();
  renderSelectors();
  renderRelations();
  renderEvents();
  renderTimeline();
}

function renderDocuments() {
  documentsList.innerHTML = "";

  if (state.documents.length === 0) {
    documentsList.innerHTML = `<li class="item">Пока нет документов.</li>`;
    return;
  }

  for (const doc of state.documents) {
    const item = document.createElement("li");
    item.className = "item";
    item.innerHTML = `
      <div class="item-title">${escapeHtml(doc.title)}</div>
      <div class="item-meta">Тип: ${escapeHtml(doc.type)}</div>
      <div>${escapeHtml(doc.description)}</div>
    `;

    const action = createDeleteButton(() => deleteDocument(doc.id));
    item.append(action);
    documentsList.append(item);
  }
}

function renderRelations() {
  relationsList.innerHTML = "";

  if (state.relations.length === 0) {
    relationsList.innerHTML = `<li class="item">Пока нет связей.</li>`;
    return;
  }

  for (const rel of state.relations) {
    const source = getDocument(rel.sourceId);
    const target = getDocument(rel.targetId);

    if (!source || !target) {
      continue;
    }

    const item = document.createElement("li");
    item.className = "item";
    item.innerHTML = `
      <div class="item-title">${escapeHtml(source.title)} → ${escapeHtml(target.title)}</div>
      <div class="item-meta">Связь: ${escapeHtml(rel.type)}</div>
      ${rel.note ? `<div>${escapeHtml(rel.note)}</div>` : ""}
    `;

    const action = createDeleteButton(() => deleteRelation(rel.id));
    item.append(action);
    relationsList.append(item);
  }
}

function renderEvents() {
  eventsList.innerHTML = "";

  if (state.events.length === 0) {
    eventsList.innerHTML = `<li class="item">Пока нет событий.</li>`;
    return;
  }

  const sorted = [...state.events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime(),
  );

  for (const event of sorted) {
    const doc = getDocument(event.documentId);

    if (!doc) {
      continue;
    }

    const item = document.createElement("li");
    item.className = "item";
    item.innerHTML = `
      <div class="item-title">${escapeHtml(event.title)}</div>
      <div class="item-meta">Документ: ${escapeHtml(doc.title)}</div>
      <div class="item-meta">${formatDate(event.start)} → ${formatDate(event.end)}</div>
      <div>${escapeHtml(event.description)}</div>
    `;

    const action = createDeleteButton(() => deleteEvent(event.id));
    item.append(action);
    eventsList.append(item);
  }
}

function renderSelectors() {
  const docOptions = state.documents.map(
    (doc) => `<option value="${doc.id}">${escapeHtml(doc.title)} (${escapeHtml(doc.type)})</option>`,
  );

  relationSourceSelect.innerHTML = docOptions.join("");
  relationTargetSelect.innerHTML = docOptions.join("");
  eventDocumentSelect.innerHTML = docOptions.join("");
  timelineDocumentsSelect.innerHTML = docOptions.join("");

  const hasDocuments = state.documents.length > 0;
  relationForm.querySelector("button").disabled = !hasDocuments;
  eventForm.querySelector("button").disabled = !hasDocuments;
}

function renderTimeline() {
  const mode = timelineMode.value;
  const selected = new Set(
    [...timelineDocumentsSelect.selectedOptions].map((option) => option.value),
  );

  const events = state.events
    .filter((event) => {
      if (mode === "all") {
        return true;
      }

      return selected.has(event.documentId);
    })
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  timelineContainer.innerHTML = "";

  if (events.length === 0) {
    timelineContainer.hidden = true;
    timelineEmpty.hidden = false;
    timelineEmpty.textContent =
      mode === "all"
        ? "Пока нет событий для отображения."
        : "Нет событий для выбранных документов.";
    return;
  }

  timelineContainer.hidden = false;
  timelineEmpty.hidden = true;

  const min = Math.min(...events.map((event) => new Date(event.start).getTime()));
  const max = Math.max(...events.map((event) => new Date(event.end).getTime()));
  const span = Math.max(1, max - min);

  for (const event of events) {
    const doc = getDocument(event.documentId);
    const start = new Date(event.start).getTime();
    const end = new Date(event.end).getTime();

    const left = ((start - min) / span) * 100;
    const width = Math.max(1.2, ((end - start) / span) * 100);

    const row = document.createElement("div");
    row.className = "timeline-row";

    const range = document.createElement("div");
    range.className = "timeline-range";

    const isPoint = start === end;

    if (isPoint) {
      const point = document.createElement("div");
      point.className = "timeline-point";
      point.style.left = `${left}%`;
      point.title = `${event.title} (${formatDate(event.start)})`;
      range.append(point);
    } else {
      const bar = document.createElement("div");
      bar.className = "timeline-bar";
      bar.style.left = `${left}%`;
      bar.style.width = `${width}%`;
      bar.textContent = event.title;
      bar.title = `${event.title}: ${formatDate(event.start)} → ${formatDate(event.end)}`;
      range.append(bar);
    }

    const caption = document.createElement("div");
    caption.className = "timeline-caption";
    caption.innerHTML = `
      <span>${escapeHtml(event.title)} · ${doc ? escapeHtml(doc.title) : "Без документа"}</span>
      <span>${formatDate(event.start)} → ${formatDate(event.end)}</span>
    `;

    row.append(range, caption);
    timelineContainer.append(row);
  }
}

function deleteDocument(id) {
  state.documents = state.documents.filter((doc) => doc.id !== id);
  state.relations = state.relations.filter(
    (rel) => rel.sourceId !== id && rel.targetId !== id,
  );
  state.events = state.events.filter((event) => event.documentId !== id);
  persist();
  renderAll();
}

function deleteRelation(id) {
  state.relations = state.relations.filter((rel) => rel.id !== id);
  persist();
  renderAll();
}

function deleteEvent(id) {
  state.events = state.events.filter((event) => event.id !== id);
  persist();
  renderAll();
}

function getDocument(id) {
  return state.documents.find((doc) => doc.id === id);
}

function createDeleteButton(onDelete) {
  const template = document.getElementById("item-actions-template");
  const fragment = template.content.cloneNode(true);
  const button = fragment.querySelector("button");
  button.addEventListener("click", onDelete);
  return fragment;
}

function formatDate(isoDateTime) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoDateTime));
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

renderAll();
