const STORAGE_KEY = "lorehub-data-v2";

const state = loadState();

const elements = {
  tabButtons: Array.from(document.querySelectorAll(".tab-button")),
  tabContents: Array.from(document.querySelectorAll(".tab-content")),
  documentForm: document.getElementById("document-form"),
  relationForm: document.getElementById("relation-form"),
  eventForm: document.getElementById("event-form"),
  documentsList: document.getElementById("documents-list"),
  relationsList: document.getElementById("relations-list"),
  eventsList: document.getElementById("events-list"),
  timelineEventForm: document.getElementById("timeline-event-form"),
  timelineDocumentForm: document.getElementById("timeline-document-form"),
  timelineEventSelect: document.getElementById("timeline-event-select"),
  timelineDocumentSelect: document.getElementById("timeline-document-select"),
  timelineScale: document.getElementById("timeline-scale"),
  timelineClear: document.getElementById("timeline-clear"),
  timelineCanvas: document.getElementById("timeline-canvas"),
  emptyTemplate: document.getElementById("empty-state-template"),
};

wireHandlers();
renderAll();

function wireHandlers() {
  elements.tabButtons.forEach((button) => {
    button.addEventListener("click", () => switchTab(button.dataset.tab));
  });

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

    if (!fromId || !toId || fromId === toId || !label) return;

    state.relations.push({ id: crypto.randomUUID(), fromId, toId, label });
    persistState();
    elements.relationForm.reset();
    renderAll();
  });

  elements.eventForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const formData = new FormData(elements.eventForm);
    const start = String(formData.get("start"));
    const end = String(formData.get("end"));

    const eventItem = {
      id: crypto.randomUUID(),
      documentId: String(formData.get("documentId")),
      name: String(formData.get("name")).trim(),
      start,
      end: end || start,
      details: String(formData.get("details")).trim(),
    };

    if (!eventItem.documentId || !eventItem.name || !eventItem.start) return;

    state.events.push(eventItem);
    persistState();
    elements.eventForm.reset();
    renderAll();
  });

  elements.timelineEventForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const eventId = elements.timelineEventSelect.value;
    if (!eventId) return;
    addEventToTimeline(eventId);
    renderTimeline();
  });

  elements.timelineDocumentForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const documentId = elements.timelineDocumentSelect.value;
    if (!documentId) return;

    state.events
      .filter((item) => item.documentId === documentId)
      .forEach((item) => addEventToTimeline(item.id));

    renderTimeline();
  });

  elements.timelineScale.addEventListener("change", () => {
    state.timeline.scale = elements.timelineScale.value;
    persistState();
    renderTimeline();
  });

  elements.timelineClear.addEventListener("click", () => {
    state.timeline.selectedEventIds = [];
    persistState();
    renderTimeline();
  });
}

function switchTab(tabId) {
  elements.tabButtons.forEach((btn) => btn.classList.toggle("active", btn.dataset.tab === tabId));
  elements.tabContents.forEach((tab) => tab.classList.toggle("active", tab.id === tabId));
}

function renderAll() {
  renderDocumentSelectors();
  renderDocuments();
  renderRelations();
  renderEvents();
  renderTimelineMenu();
  renderTimeline();
}

function renderDocumentSelectors() {
  const documentOptions = state.documents
    .map((doc) => `<option value="${doc.id}">${escapeHtml(doc.title)} (${escapeHtml(doc.kind)})</option>`)
    .join("");

  [elements.relationForm.fromId, elements.relationForm.toId, elements.eventForm.documentId].forEach((select) => {
    select.innerHTML = documentOptions;
  });
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
      const durationLabel =
        eventItem.start === eventItem.end
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

function renderTimelineMenu() {
  const eventOptions = [
    '<option value="">Выберите событие</option>',
    ...state.events.map((item) => {
      const documentItem = findDocument(item.documentId);
      const documentTitle = documentItem ? documentItem.title : "Неизвестный документ";
      return `<option value="${item.id}">${escapeHtml(item.name)} — ${escapeHtml(documentTitle)}</option>`;
    }),
  ].join("");

  const documentOptions = [
    '<option value="">Выберите документ</option>',
    ...state.documents.map((doc) => `<option value="${doc.id}">${escapeHtml(doc.title)} (${escapeHtml(doc.kind)})</option>`),
  ].join("");

  elements.timelineEventSelect.innerHTML = eventOptions;
  elements.timelineDocumentSelect.innerHTML = documentOptions;
  elements.timelineScale.value = state.timeline.scale;
}

function renderTimeline() {
  const selectedEvents = state.timeline.selectedEventIds
    .map((id) => state.events.find((eventItem) => eventItem.id === id))
    .filter(Boolean);

  if (!selectedEvents.length) {
    elements.timelineCanvas.innerHTML = '<div class="empty">Добавьте события в таймлайн через меню сверху.</div>';
    persistState();
    return;
  }

  const scale = state.timeline.scale;
  const minUnit = Math.min(...selectedEvents.map((item) => getUnit(item.start, scale)));
  const maxUnit = Math.max(...selectedEvents.map((item) => getUnit(item.end, scale)));
  const range = Math.max(1, maxUnit - minUnit);

  const rowsHtml = selectedEvents
    .map((item, index) => {
      const doc = findDocument(item.documentId);
      const startPos = ((getUnit(item.start, scale) - minUnit) / range) * 100;
      const endPos = ((getUnit(item.end, scale) - minUnit) / range) * 100;

      return `
        <div class="timeline-row" data-event-id="${item.id}">
          <article class="timeline-card" draggable="true" data-index="${index}">
            <div class="timeline-card-title">${escapeHtml(item.name)}</div>
            <small>${escapeHtml(doc ? doc.title : "Неизвестный документ")}</small>
            <small>${formatDate(item.start)} — ${formatDate(item.end)}</small>
          </article>
          <div class="timeline-track">
            <div class="timeline-line" style="left:${startPos}%; width:${Math.max(0.5, endPos - startPos)}%;"></div>
            <div class="timeline-dot start" style="left:${startPos}%;"></div>
            <div class="timeline-dot end" style="left:${endPos}%;"></div>
          </div>
        </div>
      `;
    })
    .join("");

  elements.timelineCanvas.innerHTML = `
    <div class="timeline-axis">
      <strong>Масштаб: ${scaleLabel(scale)}</strong>
      <span>${formatScalePoint(minUnit, scale)} → ${formatScalePoint(maxUnit, scale)}</span>
    </div>
    <div class="timeline-grid">${rowsHtml}</div>
  `;

  enableTimelineDnD();
  persistState();
}

function enableTimelineDnD() {
  const cards = Array.from(elements.timelineCanvas.querySelectorAll(".timeline-card"));
  let draggingIndex = null;

  cards.forEach((card) => {
    card.addEventListener("dragstart", (event) => {
      draggingIndex = Number(card.dataset.index);
      event.dataTransfer.effectAllowed = "move";
    });

    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      event.dataTransfer.dropEffect = "move";
    });

    card.addEventListener("drop", (event) => {
      event.preventDefault();
      const targetIndex = Number(card.dataset.index);
      if (Number.isNaN(draggingIndex) || Number.isNaN(targetIndex) || draggingIndex === targetIndex) return;

      const ids = [...state.timeline.selectedEventIds];
      const [moved] = ids.splice(draggingIndex, 1);
      ids.splice(targetIndex, 0, moved);
      state.timeline.selectedEventIds = ids;
      renderTimeline();
    });
  });
}

function addEventToTimeline(eventId) {
  if (!state.events.some((eventItem) => eventItem.id === eventId)) return;
  if (state.timeline.selectedEventIds.includes(eventId)) return;
  state.timeline.selectedEventIds.push(eventId);
  persistState();
}

function getUnit(dateValue, scale) {
  const date = new Date(dateValue);
  if (scale === "year") return date.getUTCFullYear();
  if (scale === "month") return date.getUTCFullYear() * 12 + date.getUTCMonth();
  return Math.floor(date.getTime() / 86400000);
}

function formatScalePoint(unit, scale) {
  if (scale === "year") return String(unit);
  if (scale === "month") {
    const year = Math.floor(unit / 12);
    const month = unit % 12;
    return new Date(Date.UTC(year, month, 1)).toLocaleDateString("ru-RU", { year: "numeric", month: "short" });
  }
  return new Date(unit * 86400000).toLocaleDateString("ru-RU", { year: "numeric", month: "short", day: "numeric" });
}

function scaleLabel(scale) {
  if (scale === "year") return "Год";
  if (scale === "month") return "Месяц";
  return "День";
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
    return { documents: [], relations: [], events: [], timeline: { selectedEventIds: [], scale: "day" } };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      relations: Array.isArray(parsed.relations) ? parsed.relations : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      timeline: {
        selectedEventIds: Array.isArray(parsed.timeline?.selectedEventIds) ? parsed.timeline.selectedEventIds : [],
        scale: ["day", "month", "year"].includes(parsed.timeline?.scale) ? parsed.timeline.scale : "day",
      },
    };
  } catch {
    return { documents: [], relations: [], events: [], timeline: { selectedEventIds: [], scale: "day" } };
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
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
