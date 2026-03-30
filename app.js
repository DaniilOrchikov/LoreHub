const STORAGE_KEY = "lorehub-data-v2";

const state = loadState();

const elements = {
  tabs: Array.from(document.querySelectorAll(".tab-button")),
  tabContents: Array.from(document.querySelectorAll(".tab-content")),
  documentForm: document.getElementById("document-form"),
  relationForm: document.getElementById("relation-form"),
  eventForm: document.getElementById("event-form"),
  documentsList: document.getElementById("documents-list"),
  relationsList: document.getElementById("relations-list"),
  eventsList: document.getElementById("events-list"),
  timelineAddMode: document.getElementById("timeline-add-mode"),
  timelineEventSelect: document.getElementById("timeline-event-select"),
  timelineDocumentSelect: document.getElementById("timeline-document-select"),
  timelineScale: document.getElementById("timeline-scale"),
  timelineAddButton: document.getElementById("timeline-add-button"),
  timelineClearButton: document.getElementById("timeline-clear-button"),
  timelineBoard: document.getElementById("timeline-board"),
  emptyTemplate: document.getElementById("empty-state-template"),
};

let dragState = {
  draggedId: null,
};

wireHandlers();
renderAll();

function wireHandlers() {
  elements.tabs.forEach((tabButton) => {
    tabButton.addEventListener("click", () => {
      const target = tabButton.dataset.tab;
      switchTab(target);
    });
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

  elements.timelineAddMode.addEventListener("change", () => {
    updateTimelineAddControls();
  });

  elements.timelineScale.addEventListener("change", () => {
    state.timelineScale = elements.timelineScale.value;
    persistState();
    renderTimelineBoard();
  });

  elements.timelineAddButton.addEventListener("click", () => {
    addItemsToTimeline();
  });

  elements.timelineClearButton.addEventListener("click", () => {
    state.timelineItems = [];
    persistState();
    renderTimelineBoard();
  });
}

function switchTab(targetTab) {
  elements.tabs.forEach((tabButton) => {
    tabButton.classList.toggle("active", tabButton.dataset.tab === targetTab);
  });

  elements.tabContents.forEach((content) => {
    content.classList.toggle("active", content.dataset.tabContent === targetTab);
  });
}

function renderAll() {
  renderDocumentSelectors();
  renderDocuments();
  renderRelations();
  renderEvents();
  renderTimelineSelectors();
  renderTimelineBoard();
  updateTimelineAddControls();
}

function renderDocumentSelectors() {
  const documentOptions = state.documents
    .map((doc) => `<option value="${doc.id}">${escapeHtml(doc.title)} (${escapeHtml(doc.kind)})</option>`)
    .join("");

  [elements.relationForm.fromId, elements.relationForm.toId, elements.eventForm.documentId].forEach((select) => {
    select.innerHTML = documentOptions;
  });
}

function renderTimelineSelectors() {
  elements.timelineEventSelect.innerHTML = state.events
    .map((eventItem) => {
      const doc = findDocument(eventItem.documentId);
      const docLabel = doc ? doc.title : "Неизвестный документ";
      return `<option value="${eventItem.id}">${escapeHtml(eventItem.name)} · ${escapeHtml(docLabel)}</option>`;
    })
    .join("");

  elements.timelineDocumentSelect.innerHTML = state.documents
    .map((doc) => `<option value="${doc.id}">${escapeHtml(doc.title)} (${escapeHtml(doc.kind)})</option>`)
    .join("");

  elements.timelineScale.value = state.timelineScale;
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

function renderTimelineBoard() {
  const timelineEvents = buildTimelineEvents();

  if (!timelineEvents.length) {
    elements.timelineBoard.innerHTML = '<div class="empty">На таймлайн пока ничего не добавлено.</div>';
    return;
  }

  const unitRange = getUnitRange(timelineEvents, state.timelineScale);

  elements.timelineBoard.innerHTML = `
    <div class="timeline-grid">
      <div class="timeline-header">События (перетаскивайте порядок)</div>
      <div class="timeline-header">Временная шкала · ${scaleLabel(state.timelineScale)}</div>
      ${timelineEvents
        .map((item, index) => {
          const startUnit = toScaleUnit(item.start, state.timelineScale);
          const endUnit = toScaleUnit(item.end, state.timelineScale);
          const startPercent = toPercent(startUnit, unitRange.min, unitRange.max);
          const endPercent = toPercent(endUnit, unitRange.min, unitRange.max);
          const barWidth = Math.max(endPercent - startPercent, 0);

          return `
            <div
              class="timeline-event-card"
              draggable="true"
              data-timeline-id="${item.timelineId}"
              data-row-index="${index}"
            >
              <strong>${escapeHtml(item.name)}</strong>
              <small>${escapeHtml(item.documentTitle)} · ${formatDate(item.start)} → ${formatDate(item.end)}</small>
            </div>
            <div class="timeline-track-row" data-row-index="${index}">
              <div class="timeline-track-line"></div>
              <div class="timeline-point start" style="left:${startPercent}%"></div>
              <div class="timeline-segment" style="left:${startPercent}%;width:${barWidth}%"></div>
              <div class="timeline-point end" style="left:${endPercent}%"></div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  bindTimelineDragAndDrop();
}

function addItemsToTimeline() {
  const mode = elements.timelineAddMode.value;

  if (mode === "event") {
    const eventId = elements.timelineEventSelect.value;
    if (!eventId) return;
    addEventToTimeline(eventId);
    return;
  }

  const documentId = elements.timelineDocumentSelect.value;
  if (!documentId) return;

  state.events
    .filter((eventItem) => eventItem.documentId === documentId)
    .forEach((eventItem) => {
      addEventToTimeline(eventItem.id, true);
    });

  persistState();
  renderTimelineBoard();
}

function addEventToTimeline(eventId, skipRender = false) {
  if (state.timelineItems.some((timelineItem) => timelineItem.eventId === eventId)) {
    return;
  }

  state.timelineItems.push({
    id: crypto.randomUUID(),
    eventId,
  });

  if (!skipRender) {
    persistState();
    renderTimelineBoard();
  }
}

function buildTimelineEvents() {
  return state.timelineItems
    .map((timelineItem) => {
      const eventItem = state.events.find((eventEntry) => eventEntry.id === timelineItem.eventId);
      if (!eventItem) return null;
      const documentItem = findDocument(eventItem.documentId);
      return {
        timelineId: timelineItem.id,
        eventId: eventItem.id,
        name: eventItem.name,
        documentTitle: documentItem ? documentItem.title : "Неизвестный документ",
        start: eventItem.start,
        end: eventItem.end,
      };
    })
    .filter(Boolean);
}

function bindTimelineDragAndDrop() {
  const cards = Array.from(document.querySelectorAll(".timeline-event-card"));

  cards.forEach((card) => {
    card.addEventListener("dragstart", () => {
      dragState.draggedId = card.dataset.timelineId;
      card.classList.add("dragging");
    });

    card.addEventListener("dragend", () => {
      dragState.draggedId = null;
      card.classList.remove("dragging");
      document.querySelectorAll(".drag-over").forEach((el) => el.classList.remove("drag-over"));
    });

    card.addEventListener("dragover", (event) => {
      event.preventDefault();
      card.classList.add("drag-over");
    });

    card.addEventListener("dragleave", () => {
      card.classList.remove("drag-over");
    });

    card.addEventListener("drop", (event) => {
      event.preventDefault();
      card.classList.remove("drag-over");
      moveTimelineItem(dragState.draggedId, card.dataset.timelineId);
    });
  });
}

function moveTimelineItem(sourceId, targetId) {
  if (!sourceId || !targetId || sourceId === targetId) return;

  const sourceIndex = state.timelineItems.findIndex((item) => item.id === sourceId);
  const targetIndex = state.timelineItems.findIndex((item) => item.id === targetId);

  if (sourceIndex < 0 || targetIndex < 0) return;

  const [item] = state.timelineItems.splice(sourceIndex, 1);
  state.timelineItems.splice(targetIndex, 0, item);

  persistState();
  renderTimelineBoard();
}

function updateTimelineAddControls() {
  const mode = elements.timelineAddMode.value;
  elements.timelineEventSelect.disabled = mode !== "event";
  elements.timelineDocumentSelect.disabled = mode !== "document";
}

function findDocument(id) {
  return state.documents.find((doc) => doc.id === id);
}

function getUnitRange(items, scale) {
  const units = items.flatMap((item) => [toScaleUnit(item.start, scale), toScaleUnit(item.end, scale)]);
  const min = Math.min(...units);
  const max = Math.max(...units);
  return { min, max: max === min ? min + 1 : max };
}

function toScaleUnit(dateValue, scale) {
  const date = new Date(dateValue);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth();
  const day = date.getUTCDate();

  if (scale === "year") return year;
  if (scale === "month") return year * 12 + month;
  return Math.floor(Date.UTC(year, month, day) / 86400000);
}

function toPercent(value, min, max) {
  const normalized = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, normalized));
}

function scaleLabel(scale) {
  if (scale === "day") return "день";
  if (scale === "month") return "месяц";
  return "год";
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    return {
      documents: [],
      relations: [],
      events: [],
      timelineItems: [],
      timelineScale: "day",
    };
  }

  try {
    const parsed = JSON.parse(raw);
    return {
      documents: Array.isArray(parsed.documents) ? parsed.documents : [],
      relations: Array.isArray(parsed.relations) ? parsed.relations : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      timelineItems: Array.isArray(parsed.timelineItems) ? parsed.timelineItems : [],
      timelineScale: ["day", "month", "year"].includes(parsed.timelineScale) ? parsed.timelineScale : "day",
    };
  } catch {
    return {
      documents: [],
      relations: [],
      events: [],
      timelineItems: [],
      timelineScale: "day",
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

function renderEmpty(target) {
  target.innerHTML = "";
  target.append(elements.emptyTemplate.content.cloneNode(true));
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
