/* ================================================================
   CONFIGURACIÓN — esto es lo único que Sebastián necesita editar
   ================================================================
   1. SPREADSHEET_ID: lo sacas de la URL de tu Sheet:
      https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit
   2. SHEET_RANGE: nombre de la pestaña + rango de columnas.
      Si tu pestaña se llama "Sheet1" y usas hasta la columna O:
      "Sheet1!A1:O"
   3. API_KEY: creada en Google Cloud Console
      (APIs & Services > Credenciales > Crear credenciales > Clave de API)
      con la "Google Sheets API" habilitada en ese proyecto.
   4. La hoja debe estar compartida como "Cualquier persona con el
      enlace puede ver" — una API key sola NO hereda tus permisos
      privados, solo puede leer lo que sea público. Si te preocupa
      exponer datos de candidatos, considera restringir la API key
      por dominio/referrer en Google Cloud Console y publicar este
      dashboard solo en un sitio controlado.
================================================================= */
const CONFIG = {
  SPREADSHEET_ID: "15RaLJXQQVScoHlA3nbpNBHHt_HYXXsP1sMUkeoH9VKk",
  SHEET_RANGE: "Sheet1!A1:O",
  API_KEY: "AIzaSyBD6rJ97katnCJv5nL5g6P_AoCAmpf6siI",
  REFRESH_MS: 30000 // cada 30 segundos
};

document.getElementById('footerInterval').textContent = Math.round(CONFIG.REFRESH_MS/1000);

/* ---------- utilidades ---------- */

function normalizeHeader(h){
  return (h || "").toString().trim().toLowerCase();
}

// Convierte las filas crudas de la API (arreglo de arreglos) en
// objetos {campo: valor} usando la primera fila como encabezado.
function rowsToObjects(values){
  if(!values || values.length < 2) return [];
  const headers = values[0].map(normalizeHeader);
  return values.slice(1).map(row => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = row[i] !== undefined ? row[i] : ""; });
    return obj;
  });
}

function scoreBucket(score){
  const n = Number(score);
  if(isNaN(n)) return null;
  if(n >= 80) return "alta";
  if(n >= 60) return "media";
  return "baja";
}

function bucketLabel(b){
  return { alta: "Alta", media: "Media", baja: "Baja" }[b] || "N/D";
}

/* ---------- fetch a la API de Sheets ---------- */

async function fetchCandidatos(){
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${CONFIG.SPREADSHEET_ID}/values/${encodeURIComponent(CONFIG.SHEET_RANGE)}?key=${CONFIG.API_KEY}`;
  const res = await fetch(url);
  if(!res.ok){
    const detail = await res.text();
    throw new Error(`Sheets API respondió ${res.status}: ${detail.slice(0,200)}`);
  }
  const data = await res.json();
  return rowsToObjects(data.values || []);
}

/* ---------- render: hero ---------- */

function renderHero(candidatos){
  const total = candidatos.length;
  const pendientes = candidatos.filter(c => (c.estado || "").toUpperCase() === "PENDIENTE_REVISION").length;
  const entrevista = candidatos.filter(c => (c.estado || "").toUpperCase() === "ENTREVISTA").length;
  const scores = candidatos.map(c => Number(c.score_compatibilidad)).filter(n => !isNaN(n));
  const promedio = scores.length ? Math.round(scores.reduce((a,b)=>a+b,0)/scores.length) : null;

  const cells = [
    { big:true, num: total, label:"Total candidatos" },
    { num: pendientes, label:"Pendientes de revisión" },
    { num: entrevista, label:"En entrevista" },
    { num: promedio !== null ? `${promedio}%` : "—", label:"Score promedio" },
    { empty:true, label:"Tiempo promedio de revisión" },
  ];

  document.getElementById('heroStats').innerHTML = cells.map(c => `
    <div class="hero-cell ${c.big ? 'big' : ''}">
      ${c.empty
        ? `<div class="hero-empty">N/D</div>`
        : `<div class="hero-num">${c.num}</div>`}
      <div class="hero-label">${c.label}${c.empty ? ' · falta columna de fecha de revisión' : ''}</div>
    </div>
  `).join("");
}

/* ---------- render: candidatos por vacante ---------- */

function renderVacantes(candidatos){
  const counts = {};
  candidatos.forEach(c => {
    const v = (c.vacante || "Sin vacante").trim();
    counts[v] = (counts[v] || 0) + 1;
  });
  const entries = Object.entries(counts).sort((a,b) => b[1]-a[1]);
  const max = entries.length ? entries[0][1] : 1;

  document.getElementById('vacTotal').textContent = `${entries.length} vacantes activas`;

  const list = document.getElementById('vacanteList');
  if(!entries.length){
    list.innerHTML = `<p class="empty-state">Aún no hay postulaciones registradas en la hoja.</p>`;
    return;
  }
  list.innerHTML = entries.map(([nombre, count]) => `
    <div class="vac-row">
      <div class="vac-top">
        <span class="vac-name">${nombre}</span>
        <span class="vac-count">${count}</span>
      </div>
      <div class="vac-track"><div class="vac-fill" style="width:${(count/max*100).toFixed(0)}%"></div></div>
    </div>
  `).join("");
}

/* ---------- render: gráfica de fechas ---------- */

let chartFechas = null;
function renderChartFechas(candidatos){
  const counts = {};
  candidatos.forEach(c => {
    const raw = (c.fecha_postulacion || "").trim();
    if(!raw) return;
    // Toma solo la parte de fecha si viene con hora incluida
    const key = raw.split("T")[0].split(" ")[0];
    counts[key] = (counts[key] || 0) + 1;
  });
  const labels = Object.keys(counts).sort();
  const data = labels.map(l => counts[l]);

  const ctx = document.getElementById('chartFechas').getContext('2d');
  if(chartFechas) chartFechas.destroy();

  if(!labels.length){
    document.getElementById('chartFechas').parentElement.querySelector('canvas').style.display = 'none';
    return;
  }

  chartFechas = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        data,
        borderColor: '#c89b4a',
        backgroundColor: 'rgba(200,155,74,0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 3,
        pointBackgroundColor: '#c89b4a'
      }]
    },
    options: {
      plugins:{ legend:{ display:false } },
      scales:{
        x:{ ticks:{ color:'#8792a6', font:{family:'IBM Plex Mono', size:10} }, grid:{ color:'#2c3650' } },
        y:{ beginAtZero:true, ticks:{ color:'#8792a6', font:{family:'IBM Plex Mono', size:10}, precision:0 }, grid:{ color:'#2c3650' } }
      }
    }
  });
}

/* ---------- render: gráfica de score ---------- */

let chartScore = null;
function renderChartScore(candidatos){
  const buckets = { alta:0, media:0, baja:0 };
  candidatos.forEach(c => {
    const b = scoreBucket(c.score_compatibilidad);
    if(b) buckets[b]++;
  });

  const ctx = document.getElementById('chartScore').getContext('2d');
  if(chartScore) chartScore.destroy();
  chartScore = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: ['Alta (≥80)', 'Media (60–79)', 'Baja (<60)'],
      datasets: [{
        data: [buckets.alta, buckets.media, buckets.baja],
        backgroundColor: ['#6fa287', '#c89b4a', '#a8543f'],
        borderColor: '#1a2233',
        borderWidth: 3
      }]
    },
    options: {
      cutout: '68%',
      plugins:{
        legend:{ position:'bottom', labels:{ color:'#8792a6', font:{family:'IBM Plex Sans', size:11}, boxWidth:10 } }
      }
    }
  });
}

/* ---------- render: lista de candidatos (paginada) ---------- */

const PAGE_SIZE = 6;
let candidatePage = 1;

function renderPendingQueue(candidatos){
  // Más recientes primero cuando hay fecha; si no, se respeta el orden de la hoja.
  const ordenados = [...candidatos].sort((a, b) => {
    const fa = Date.parse((a.fecha_postulacion || "").trim());
    const fb = Date.parse((b.fecha_postulacion || "").trim());
    if(isNaN(fa) && isNaN(fb)) return 0;
    if(isNaN(fa)) return 1;
    if(isNaN(fb)) return -1;
    return fb - fa;
  });

  const totalPendientes = ordenados.filter(c => (c.estado || "").toUpperCase() === "PENDIENTE_REVISION").length;
  document.getElementById('pendCount').textContent = `${ordenados.length} en total · ${totalPendientes} pendientes`;

  const container = document.getElementById('pendingQueue');
  const pager = document.getElementById('pendingPagination');

  if(!ordenados.length){
    container.innerHTML = `<p class="empty-state">Aún no hay candidatos registrados en la hoja.</p>`;
    pager.innerHTML = "";
    return;
  }

  const totalPages = Math.max(1, Math.ceil(ordenados.length / PAGE_SIZE));
  if(candidatePage > totalPages) candidatePage = totalPages;
  if(candidatePage < 1) candidatePage = 1;

  const start = (candidatePage - 1) * PAGE_SIZE;
  const pageItems = ordenados.slice(start, start + PAGE_SIZE);

  container.innerHTML = pageItems.map(c => {
    const bucket = scoreBucket(c.score_compatibilidad) || "media";
    const score = c.score_compatibilidad || "—";
    const estado = (c.estado || "").toUpperCase();
    return `
      <div class="ticket">
        <div class="stamp ${bucket}">${score}</div>
        <div class="ticket-body">
          <p class="ticket-name">${c.nombre || "Sin nombre"}</p>
          <p class="ticket-meta">${c.vacante || "—"} · ${estado || "SIN ESTADO"}</p>
        </div>
        <div class="ticket-id">${c.id_candidato || ""}</div>
      </div>
    `;
  }).join("");

  renderPagination(pager, totalPages);
}

function renderPagination(pager, totalPages){
  if(totalPages <= 1){
    pager.innerHTML = "";
    return;
  }

  pager.innerHTML = `
    <button type="button" data-page="prev" ${candidatePage === 1 ? "disabled" : ""}>‹ Anterior</button>
    <span class="pagination-status">Página ${candidatePage} de ${totalPages}</span>
    <button type="button" data-page="next" ${candidatePage === totalPages ? "disabled" : ""}>Siguiente ›</button>
  `;

  pager.querySelector('[data-page="prev"]').addEventListener('click', () => {
    candidatePage--;
    renderPendingQueue(lastCandidatos);
  });
  pager.querySelector('[data-page="next"]').addEventListener('click', () => {
    candidatePage++;
    renderPendingQueue(lastCandidatos);
  });
}

/* ---------- ciclo principal ---------- */

let lastCandidatos = [];

async function loadDashboard(){
  const dot = document.getElementById('statusDot');
  const statusText = document.getElementById('statusText');
  try{
    const candidatos = await fetchCandidatos();
    lastCandidatos = candidatos;
    renderHero(candidatos);
    renderVacantes(candidatos);
    renderChartFechas(candidatos);
    renderChartScore(candidatos);
    renderPendingQueue(candidatos);

    dot.style.background = '#6fa287';
    statusText.textContent = `Actualizado — ${new Date().toLocaleTimeString('es-CO')}`;
  }catch(err){
    dot.style.background = '#a8543f';
    statusText.textContent = 'Error al conectar con Sheets';
    console.error(err);
    document.getElementById('heroStats').innerHTML = `
      <div class="hero-cell big" style="grid-column:1/-1;">
        <div class="hero-empty" style="color:#a8543f;">⚠ ${err.message}</div>
        <div class="hero-label">Revisa SPREADSHEET_ID, SHEET_RANGE y API_KEY en el bloque CONFIG, y que la hoja esté compartida como "cualquiera con el enlace puede ver".</div>
      </div>`;
  }
}

document.getElementById('refreshBtn').addEventListener('click', loadDashboard);

loadDashboard();
setInterval(loadDashboard, CONFIG.REFRESH_MS);