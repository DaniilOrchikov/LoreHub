const STORAGE_KEY = "lorehub-data-v1";

const state = loadState();

const elements = {
  documentForm: document.getElementById("document-form"),
  relationForm: document.getElementById("relation-form"),
  eventForm: document.getElementById("event-form"),
  documentsList: document.getElementById("documents-list"),
  relationsList: document.getElementById("relations-list"),
  eventsList: document.getElementById("events-list"),
  timeline: document.getElementById("timeline"),
  timelineFilter: document.getElementById("timeline-filter"),
  refreshTimeline: document.getElementById("refresh-timeline"),
  emptyTemplate: document.getElementById("empty-state-template"),
};

wireHandlers();
renderAll();

function wireHandlers() {
  elements.documentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(elements.documentForm);

    const documentItem = {
      id: crypto.randomUUID(),
      title: String(formData.get("title")).trim(),
      kind: String(formData.get("kind")),
      description: String(formData.get("description")).trim(),
    };

    if (!documentItem.title) return;

    state.documents.push(documentItem);
    persistState();
    elements.documentForm.reset();
    renderAll();
  });

  elements.relationForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(elements.relationForm);

    const fromId = String(formData.get("fromId"));
    const toId = String(formData.get("toId"));
    const label = String(formData.get("label")).trim();

    if (!fromId || !toId || !label || fromId === toId) return;

    state.relations.push({
      id: crypto.randomUUID(),
      fromId,
      toId,
      label,
    });

    persistState();
    elements.relationForm.reset();
    renderAll();
  });

  elements.eventForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(elements.eventForm);

    const start = String(formData.get("start"));
    const end = String(formData.get("end"));

    if (!start) return;

    const eventItem = {
      id: crypto.randomUUID(),
      documentId: String(formData.get("documentId")),
      name: String(formData.get("name")).trim(),
      start,
      end: end || start,
      details: String(formData.get("details")).trim(),
    };

    if (!eventItem.name || !eventItem.documentId) return;

    state.events.push(eventItem);
    persistState();
    elements.eventForm.reset();
    renderAll();
  });

  elements.refreshTimeline.addEventListener("click", () => {
    renderTimeline();
  });

  elements.timelineFilter.addEventListener("change", () => {
    renderTimeline();
  });
}

function renderAll() {
  renderDocumentSelectors();
  renderDocuments();
  renderRelations();
  renderEvents();
  renderTimeline();
}

function renderDocumentSelectors() {
  const documentOptions = state.documents
    .map((doc) => `<option value="${doc.id}">${escapeHtml(doc.title)} (${escapeHtml(doc.kind)})</option>`)
    .join("");

  [elements.relationForm.fromId, elements.relationForm.toId, elements.eventForm.documentId].forEach((select) => {
    select.innerHTML = documentOptions;
  });

  const timelineOptions = [
    '<option value="all">Все документы</option>',
    ...state.documents.map(
      (doc) => `<option value="${doc.id}">${escapeHtml(doc.title)} (${escapeHtml(doc.kind)})</option>`,
    ),
  ].join("");

  const selected = elements.timelineFilter.value;
  elements.timelineFilter.innerHTML = timelineOptions;

  if (selected && timelineOptions.includes(`value="${selected}"`)) {
    elements.timelineFilter.value = selected;
  }
}

function renderDocuments() {
  if (!state.documents.length) {
    renderEmpty(elements.documentsList);
    return;
  }

  elements.documentsList.innerHTML = state.documents
    .map(
      (doc) => `
      <li>
        <strong>${escapeHtml(doc.title)}</strong> · ${escapeHtml(doc.kind)}
        <small>${escapeHtml(doc.description || "Без описания")}</small>
      </li>
    `,
    )
    .join("");
}

function renderRelations() {
  if (!state.relations.length) {
    renderEmpty(elements.relationsList);
    return;
  }

  elements.relationsList.innerHTML = state.relations
    .map((relation) => {
      const from = findDocument(relation.fromId);
      const to = findDocument(relation.toId);
      if (!from || !to) return "";
      return `
        <li>
          <strong>${escapeHtml(from.title)}</strong>
          — ${escapeHtml(relation.label)} —
          <strong>${escapeHtml(to.title)}</strong>
        </li>
      `;
    })
    .join("");
}

function renderEvents() {
  if (!state.events.length) {
    renderEmpty(elements.eventsList);
    return;
  }

  elements.eventsList.innerHTML = state.events
    .map((eventItem) => {
      const documentItem = findDocument(eventItem.documentId);
      if (!documentItem) return "";

      const isInstant = eventItem.start === eventItem.end;
      const durationLabel = isInstant
        ? `Момент: ${formatDate(eventItem.start)}`
        : `Период: ${formatDate(eventItem.start)} — ${formatDate(eventItem.end)}`;

      return `
        <li>
          <strong>${escapeHtml(eventItem.name)}</strong>
          <small>${escapeHtml(documentItem.title)} · ${durationLabel}</small>
          <small>${escapeHtml(eventItem.details || "Без подробностей")}</small>
        </li>
      `;
    })
    .join("");
}

function renderTimeline() {
  const filterId = elements.timelineFilter.value;
  const events = state.events
    .filter((eventItem) => (filterId === "all" ? true : eventItem.documentId === filterId))
    .sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());

  if (!events.length) {
    elements.timeline.innerHTML = '<div class="empty">Нет событий для отображения.</div>';
    return;
  }

  elements.timeline.innerHTML = events
    .map((eventItem) => {
      const documentItem = findDocument(eventItem.documentId);
      const isInstant = eventItem.start === eventItem.end;
      return `
        <article class="timeline-row">
          <div class="timeline-date">${formatDate(eventItem.start)}</div>
          <div class="timeline-item-title">${escapeHtml(eventItem.name)}</div>
          <div class="timeline-duration">
            ${
              isInstant
                ? "Мгновенное событие"
                : `Длительность: ${formatDate(eventItem.start)} — ${formatDate(eventItem.end)}`
            }
          </div>
          <small>${escapeHtml(documentItem ? documentItem.title : "Неизвестный документ")}</small>
        </article>
      `;
    })
    .join("");
}

function renderEmpty(target) {
  target.innerHTML = "";
  target.append(elements.emptyTemplate.content.cloneNode(true));
}

function findDocument(id) {
  return state.documents.find((doc) => doc.id === id);
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      documents: [],
      relations: [],
      events: [],
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      relations: Array.isArray(parsed.relations) ? parsed.relations : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
    };
  } catch {
    return {
      documents: [],
      relations: [],
      events: [],
    };
  }
}

function persistState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function formatDate(dateValue) {
  return new Date(dateValue).toLocaleDateString("ru-RU", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
