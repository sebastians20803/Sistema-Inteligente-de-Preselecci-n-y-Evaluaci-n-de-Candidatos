/* ================================================================
   CONFIGURACIÓN — esto es lo único que Sebastián necesita editar
   ================================================================
   LECTURA (igual que en el dashboard de métricas):
   1. SPREADSHEET_ID: lo sacas de la URL de tu Sheet.
   2. SHEET_RANGE: pestaña + rango, ej. "Sheet1!A1:O".
   3. API_KEY: clave de Google Sheets API (solo lectura pública).

   ESCRITURA (nuevo):
   4. N8N_WEBHOOK_URL: la URL del nodo Webhook que vas a crear en n8n
      para recibir los cambios de estado. Este flujo recibe un POST
      con este body:

        {
          "id_candidato": "TF-2026-0001",
          "estado_actual": "PENDIENTE_REVISION",
          "nuevo_estado": "ENTREVISTA"
        }

      Del lado de n8n necesitas, como mínimo:
        Webhook (POST)
          → Google Sheets: "Update row"
              - Buscar la fila donde id_candidato == {{ $json.body.id_candidato }}
              - Escribir estado = {{ $json.body.nuevo_estado }}
          → Respond to Webhook (para que esta página sepa si funcionó)

      Si quieres, luego podemos armar ese flujo paso a paso.
================================================================= */
const CONFIG = {
  SPREADSHEET_ID: "15RaLJXQQVScoHlA3nbpNBHHt_HYXXsP1sMUkeoH9VKk",
  SHEET_RANGE: "Sheet1!A1:O",
  API_KEY: "AIzaSyBD6rJ97katnCJv5nL5g6P_AoCAmpf6siI",
  N8N_WEBHOOK_URL: "https://sebastian20803.app.n8n.cloud/webhook/55df4b75-293c-4fe9-9c65-2402732f8cc8",
  REFRESH_MS: 30000
};

/* Catálogo de estados posibles. "auto" = los asigna la IA al analizar
   el CV; el resto los define RRHH manualmente desde esta página.
   Cambia esto si tu flujo de n8n usa otros nombres de estado. */
const ESTADOS = [
  { value: "RECIBIDO",              label: "Recibido",               cls: "neutral" },
  { value: "PENDIENTE_REVISION",    label: "Pendiente de revisión",  cls: "baja"    },
  { value: "REVISION_MANUAL",       label: "Revisión manual",        cls: "media"   },
  { value: "REVISION_PRIORITARIA",  label: "Revisión prioritaria",   cls: "alta"    },
  { value: "PRESELECCIONADO",       label: "Preseleccionado",        cls: "info"    },
  { value: "ENTREVISTA",            label: "Entrevista",             cls: "info"    },
  { value: "FINALIZADO",            label: "Finalizado",             cls: "alta"    },
  { value: "DESCARTADO",            label: "Descartado",             cls: "baja"    }
];

const PAGE_SIZE = 8;

let allCandidatos = [];
let currentPage = 1;
let searchTerm = "";
let filtroVacante = "";
let filtroEstado = "";
let openStampFor = null; // id_candidato con el popover de estado abierto

/* ---------- utilidades ---------- */

function normalizeHeader(h) {
  return (h || "").toString().trim().toLowerCase();
}

function rowsToObjects(values) {
  if (!values || values.length < 2) return [];
  const headers = values[0].map(normalizeHeader);
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ""; });
    return obj;
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str == null ? "" : String(str);
  return div.innerHTML;
}

function estadoInfo(valor) {
  const v = (valor || "").toUpperCase();
  return ESTADOS.find(e => e.value === v) || { value: v || "SIN_ESTADO", label: v || "Sin estado", cls: "neutral" };
}

function showToast(message, type = "success") {
  const toast = document.getElementById("toast");
  toast.textContent = message;
  toast.className = `toast show ${type}`;
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => { toast.className = "toast"; }, 3200);
}

/* ---------- lectura desde Google Sheets ---------- */

async function fetchCandidatos() {
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(CONFIG.SHEET_RANGE)}?key=${CONFIG.API_KEY}`;
  const res = await fetch(url);
  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`Sheets API respondió ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = await res.json();
  return rowsToObjects(data.values || []);
}

/* ---------- escritura hacia n8n ---------- */

async function actualizarEstado(candidato, nuevoEstado) {
  const res = await fetch(CONFIG.N8N_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id_candidato: candidato.id_candidato,
      estado_actual: candidato.estado || "",
      nuevo_estado: nuevoEstado
    })
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`n8n respondió ${res.status}${detail ? `: ${detail.slice(0, 200)}` : ""}`);
  }
}

/* ---------- filtros ---------- */

function poblarFiltros(candidatos) {
  const vacanteSelect = document.getElementById("filtroVacante");
  const estadoSelect = document.getElementById("filtroEstado");

  const vacantesActuales = new Set(Array.from(vacanteSelect.options).map(o => o.value));
  const vacantes = [...new Set(candidatos.map(c => (c.vacante || "").trim()).filter(Boolean))].sort();
  vacantes.forEach(v => {
    if (!vacantesActuales.has(v)) {
      const opt = document.createElement("option");
      opt.value = v;
      opt.textContent = v;
      vacanteSelect.appendChild(opt);
    }
  });

  if (estadoSelect.options.length <= 1) {
    ESTADOS.forEach(e => {
      const opt = document.createElement("option");
      opt.value = e.value;
      opt.textContent = e.label;
      estadoSelect.appendChild(opt);
    });
  }
}

function candidatosFiltrados() {
  const q = searchTerm.trim().toLowerCase();
  return allCandidatos.filter(c => {
    if (filtroVacante && (c.vacante || "").trim() !== filtroVacante) return false;
    if (filtroEstado && (c.estado || "").toUpperCase() !== filtroEstado) return false;
    if (q) {
      const haystack = `${c.nombre || ""} ${c.correo || ""} ${c.id_candidato || ""}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });
}

/* ---------- render ---------- */

function render() {
  const filtrados = candidatosFiltrados();

  document.getElementById("resultCount").textContent =
    `${filtrados.length} de ${allCandidatos.length}`;

  const totalPages = Math.max(1, Math.ceil(filtrados.length / PAGE_SIZE));
  if (currentPage > totalPages) currentPage = totalPages;
  if (currentPage < 1) currentPage = 1;

  const start = (currentPage - 1) * PAGE_SIZE;
  const pageItems = filtrados.slice(start, start + PAGE_SIZE);

  const list = document.getElementById("candidateList");

  if (!filtrados.length) {
    list.innerHTML = allCandidatos.length
      ? `<p class="empty-state">Ningún candidato coincide con la búsqueda o los filtros actuales.</p>`
      : `<p class="empty-state">Aún no hay postulaciones registradas en la hoja.</p>`;
  } else {
    list.innerHTML = pageItems.map(c => renderCard(c)).join("");
    bindCardEvents(list);
  }

  renderPagination(totalPages);
}

function renderCard(c) {
  const estado = estadoInfo(c.estado);
  const isOpen = openStampFor === c.id_candidato;

  return `
    <article class="candidate-card" data-id="${escapeHtml(c.id_candidato)}">
      <div class="candidate-main">
        <p class="candidate-name">${escapeHtml(c.nombre) || "Sin nombre"}</p>
        <p class="candidate-meta">${escapeHtml(c.vacante) || "—"} · ${escapeHtml(c.correo) || "sin correo"}</p>
        <p class="candidate-ticket">${escapeHtml(c.id_candidato) || "—"}</p>
      </div>

      <div class="candidate-score">
        <span class="score-num">${escapeHtml(c.score_compatibilidad) || "—"}<small>%</small></span>
        <span class="score-label">Compatibilidad</span>
      </div>

      <div class="stamp-wrap">
        <button type="button" class="stamp-btn ${estado.cls}" data-action="toggle-stamp" aria-expanded="${isOpen}">
          ${escapeHtml(estado.label)}
        </button>
        <ul class="stamp-menu" ${isOpen ? "" : "hidden"}>
          ${ESTADOS.map(e => `
            <li>
              <button type="button" class="stamp-option ${e.cls}" data-action="set-estado" data-estado="${e.value}" ${e.value === estado.value ? "disabled" : ""}>
                ${escapeHtml(e.label)}
              </button>
            </li>
          `).join("")}
        </ul>
      </div>
    </article>
  `;
}

function bindCardEvents(list) {
  list.querySelectorAll('[data-action="toggle-stamp"]').forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const card = btn.closest(".candidate-card");
      const id = card.dataset.id;
      openStampFor = openStampFor === id ? null : id;
      render();
    });
  });

  list.querySelectorAll('[data-action="set-estado"]').forEach(btn => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const card = btn.closest(".candidate-card");
      const id = card.dataset.id;
      const nuevoEstado = btn.dataset.estado;
      const candidato = allCandidatos.find(c => c.id_candidato === id);
      if (!candidato) return;

      const estadoAnterior = candidato.estado;
      btn.disabled = true;
      card.classList.add("saving");

      try {
        await actualizarEstado(candidato, nuevoEstado);
        candidato.estado = nuevoEstado;
        openStampFor = null;
        showToast(`${candidato.nombre || "Candidato"} → ${estadoInfo(nuevoEstado).label}`, "success");
        render();
      } catch (err) {
        console.error("Error al actualizar estado:", err);
        candidato.estado = estadoAnterior;
        showToast(`No se pudo actualizar el estado: ${err.message}`, "error");
        card.classList.remove("saving");
        btn.disabled = false;
      }
    });
  });
}

function renderPagination(totalPages) {
  const pager = document.getElementById("pagination");
  if (totalPages <= 1) {
    pager.innerHTML = "";
    return;
  }

  pager.innerHTML = `
    <button type="button" data-page="prev" ${currentPage === 1 ? "disabled" : ""}>‹ Anterior</button>
    <span class="pagination-status">Página ${currentPage} de ${totalPages}</span>
    <button type="button" data-page="next" ${currentPage === totalPages ? "disabled" : ""}>Siguiente ›</button>
  `;

  pager.querySelector('[data-page="prev"]').addEventListener("click", () => {
    currentPage--;
    render();
  });
  pager.querySelector('[data-page="next"]').addEventListener("click", () => {
    currentPage++;
    render();
  });
}

/* Cierra el popover de estado si se hace click fuera de la tarjeta */
document.addEventListener("click", () => {
  if (openStampFor !== null) {
    openStampFor = null;
    render();
  }
});

/* ---------- ciclo principal ---------- */

async function loadCandidatos() {
  const dot = document.getElementById("statusDot");
  const statusText = document.getElementById("statusText");
  try {
    const candidatos = await fetchCandidatos();
    allCandidatos = candidatos;
    poblarFiltros(candidatos);
    render();

    dot.style.background = "var(--alta)";
    statusText.textContent = `Actualizado — ${new Date().toLocaleTimeString("es-CO")}`;
  } catch (err) {
    dot.style.background = "var(--baja)";
    statusText.textContent = "Error al conectar con Sheets";
    console.error(err);
    document.getElementById("candidateList").innerHTML = `
      <p class="empty-state">⚠ ${escapeHtml(err.message)}<br>
      Revisa SPREADSHEET_ID, SHEET_RANGE y API_KEY en el bloque CONFIG.</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("refreshBtn").addEventListener("click", loadCandidatos);

  document.getElementById("searchInput").addEventListener("input", (e) => {
    searchTerm = e.target.value;
    currentPage = 1;
    render();
  });

  document.getElementById("filtroVacante").addEventListener("change", (e) => {
    filtroVacante = e.target.value;
    currentPage = 1;
    render();
  });

  document.getElementById("filtroEstado").addEventListener("change", (e) => {
    filtroEstado = e.target.value;
    currentPage = 1;
    render();
  });

  loadCandidatos();
  setInterval(loadCandidatos, CONFIG.REFRESH_MS);
});
