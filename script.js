/* ============================================================
   CONFIGURACIÓN — TalentFlow AI
   Reemplaza esta URL por la de tu nodo Webhook de n8n.
   En n8n: agrega un nodo "Webhook", método POST, y copia aquí
   la "Production URL" (o la "Test URL" mientras pruebas).
   Ejemplo: https://tu-instancia.app.n8n.cloud/webhook/postulaciones
   ============================================================ */
const N8N_WEBHOOK_URL = "https://sebastian20803.app.n8n.cloud/webhook-test/62c792b5-294e-4760-a292-2cc7835e01da";

const MAX_FILE_MB = 5;
let tecnologias = [];

/* ---------- Catálogo de tecnologías sugeridas ----------
   Lista curada de las tecnologías más buscadas en vacantes de
   desarrollo/datos/devops. Si el candidato escribe algo que no
   está aquí, igual puede agregarlo libremente (Enter o coma). */
const TECH_CATALOG = [
  "JavaScript", "TypeScript", "Python", "Java", "C#", "C++", "C", "PHP", "Go", "Rust",
  "Kotlin", "Swift", "Ruby", "Dart", "Scala", "R", "MATLAB", "SQL", "Bash", "PowerShell",

  "HTML", "CSS", "Sass", "Tailwind CSS", "Bootstrap", "React", "Next.js", "Vue.js",
  "Nuxt.js", "Angular", "Svelte", "jQuery", "Redux", "Vite", "Webpack",

  "Node.js", "Express.js", "NestJS", "Spring Boot", "Django", "Flask", "FastAPI",
  "Laravel", "Ruby on Rails", ".NET", "ASP.NET Core",

  "REST API", "GraphQL", "gRPC", "WebSockets", "Microservicios",

  "MySQL", "PostgreSQL", "SQL Server", "Oracle", "MongoDB", "Redis", "SQLite",
  "Firebase", "DynamoDB", "Elasticsearch", "Supabase",

  "Git", "GitHub", "GitLab", "Bitbucket", "Docker", "Kubernetes", "Jenkins",
  "GitHub Actions", "CI/CD", "Terraform", "Ansible", "Linux", "Nginx",

  "AWS", "Azure", "Google Cloud", "Heroku", "Vercel", "Netlify",

  "Power BI", "Tableau", "Looker Studio", "Excel avanzado", "Google Sheets",
  "Pandas", "NumPy", "Apache Spark", "Airflow", "ETL",

  "Machine Learning", "Deep Learning", "TensorFlow", "PyTorch", "scikit-learn",
  "OpenAI API", "LangChain", "n8n", "Zapier", "Make",

  "Android", "iOS", "Flutter", "React Native", "Ionic",

  "Figma", "Adobe XD", "Photoshop", "Jira", "Trello", "Notion", "Scrum", "Kanban",
  "Postman", "Selenium", "Cypress", "Jest", "JUnit",

  "Metodologías ágiles", "Trabajo en equipo", "Comunicación efectiva", "Liderazgo"
];

document.addEventListener("DOMContentLoaded", () => {
  setupTagInput();
  setupFileDrop();
  setupFormSubmit();
});

/* ---------- Tag input con búsqueda de tecnologías ---------- */
function setupTagInput() {
  const wrap = document.getElementById("tagInput");
  const input = document.getElementById("tech-input");
  const suggestionsList = document.getElementById("techSuggestions");

  const MAX_SUGERENCIAS = 8;
  let activeIndex = -1;
  let currentMatches = [];

  input.addEventListener("input", () => {
    renderSuggestions(input.value);
  });

  input.addEventListener("focus", () => {
    renderSuggestions(input.value);
  });

  input.addEventListener("keydown", (e) => {
    const isOpen = !suggestionsList.hidden;

    if (e.key === "ArrowDown") {
      if (isOpen && currentMatches.length) {
        e.preventDefault();
        setActiveIndex((activeIndex + 1) % currentMatches.length);
      }
      return;
    }

    if (e.key === "ArrowUp") {
      if (isOpen && currentMatches.length) {
        e.preventDefault();
        setActiveIndex((activeIndex - 1 + currentMatches.length) % currentMatches.length);
      }
      return;
    }

    if (e.key === "Escape") {
      closeSuggestions();
      return;
    }

    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (isOpen && activeIndex >= 0 && currentMatches[activeIndex]) {
        addTag(currentMatches[activeIndex]);
      } else {
        addTag(input.value);
      }
      input.value = "";
      closeSuggestions();
      return;
    }

    if (e.key === "Backspace" && input.value === "" && tecnologias.length) {
      removeTag(tecnologias.length - 1);
    }
  });

  input.addEventListener("blur", () => {
    // Pequeño retraso para permitir que el click en una sugerencia registre antes de cerrar.
    setTimeout(() => {
      if (input.value.trim()) {
        addTag(input.value);
        input.value = "";
      }
      closeSuggestions();
    }, 120);
  });

  function renderSuggestions(query) {
    const q = query.trim().toLowerCase();

    const disponibles = TECH_CATALOG.filter(
      (tech) => !tecnologias.some((t) => t.toLowerCase() === tech.toLowerCase())
    );

    currentMatches = q
      ? disponibles.filter((tech) => tech.toLowerCase().includes(q))
      : disponibles.slice(0, MAX_SUGERENCIAS);

    currentMatches = currentMatches.slice(0, MAX_SUGERENCIAS);

    if (!currentMatches.length) {
      closeSuggestions();
      return;
    }

    suggestionsList.innerHTML = currentMatches
      .map((tech, i) => `<li role="option" data-index="${i}" class="${i === 0 ? "active" : ""}">${highlightMatch(tech, q)}</li>`)
      .join("");

    activeIndex = 0;
    suggestionsList.hidden = false;
    input.setAttribute("aria-expanded", "true");

    suggestionsList.querySelectorAll("li").forEach((li) => {
      li.addEventListener("mousedown", (e) => {
        // mousedown (no click) para que dispare antes del blur del input.
        e.preventDefault();
        const idx = Number(li.dataset.index);
        addTag(currentMatches[idx]);
        input.value = "";
        input.focus();
        closeSuggestions();
      });
    });
  }

  function setActiveIndex(newIndex) {
    activeIndex = newIndex;
    suggestionsList.querySelectorAll("li").forEach((li, i) => {
      li.classList.toggle("active", i === activeIndex);
    });
    const activeEl = suggestionsList.querySelector("li.active");
    if (activeEl) activeEl.scrollIntoView({ block: "nearest" });
  }

  function closeSuggestions() {
    suggestionsList.hidden = true;
    suggestionsList.innerHTML = "";
    input.setAttribute("aria-expanded", "false");
    activeIndex = -1;
    currentMatches = [];
  }

  function highlightMatch(text, query) {
    if (!query) return escapeHtml(text);
    const idx = text.toLowerCase().indexOf(query);
    if (idx === -1) return escapeHtml(text);
    const before = escapeHtml(text.slice(0, idx));
    const match = escapeHtml(text.slice(idx, idx + query.length));
    const after = escapeHtml(text.slice(idx + query.length));
    return `${before}<mark>${match}</mark>${after}`;
  }

  function addTag(raw) {
    const value = raw.trim().replace(/,/g, "");
    if (!value) return;
    if (tecnologias.some(t => t.toLowerCase() === value.toLowerCase())) return;
    tecnologias.push(value);
    renderTags();
  }

  function removeTag(index) {
    tecnologias.splice(index, 1);
    renderTags();
  }

  function renderTags() {
    wrap.querySelectorAll(".tag-chip").forEach(chip => chip.remove());
    tecnologias.forEach((tech, i) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.innerHTML = `${escapeHtml(tech)} <button type="button" aria-label="Eliminar ${escapeHtml(tech)}">&times;</button>`;
      chip.querySelector("button").addEventListener("click", () => removeTag(i));
      wrap.insertBefore(chip, input);
    });
    clearError("tecnologias");
  }

  // Cierra el dropdown si se hace click fuera del campo de tecnologías.
  document.addEventListener("click", (e) => {
    if (!wrap.parentElement.contains(e.target)) {
      closeSuggestions();
    }
  });
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- File drop (hoja de vida) ---------- */
function setupFileDrop() {
  const dropZone = document.getElementById("fileDrop");
  const fileInput = document.getElementById("cv");
  const dropText = document.getElementById("fileDropText");

  fileInput.addEventListener("change", () => handleFile(fileInput.files[0]));

  ["dragover", "dragenter"].forEach(evt =>
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.add("drag-over");
    })
  );

  ["dragleave", "drop"].forEach(evt =>
    dropZone.addEventListener(evt, (e) => {
      e.preventDefault();
      dropZone.classList.remove("drag-over");
    })
  );

  dropZone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file) {
      fileInput.files = e.dataTransfer.files;
      handleFile(file);
    }
  });

  function handleFile(file) {
    if (!file) return;
    if (file.type !== "application/pdf") {
      setError("cv", "El archivo debe estar en formato PDF.");
      resetDropZone();
      return;
    }
    if (file.size > MAX_FILE_MB * 1024 * 1024) {
      setError("cv", `El archivo supera el límite de ${MAX_FILE_MB} MB.`);
      resetDropZone();
      return;
    }
    clearError("cv");
    dropZone.classList.add("has-file");
    dropText.textContent = `✓ ${file.name}`;
  }

  function resetDropZone() {
    dropZone.classList.remove("has-file");
    dropText.textContent = "Arrastra tu PDF aquí o haz clic para seleccionarlo";
    fileInput.value = "";
  }
}

/* ---------- Validación y envío ---------- */
function setupFormSubmit() {
  const form = document.getElementById("applicationForm");
  const submitBtn = document.getElementById("submitBtn");
  const submitText = document.getElementById("submitText");
  const status = document.getElementById("formStatus");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "";
    status.className = "form-status";

    if (!validateForm()) return;

    const formData = new FormData();
    formData.append("nombre", form.nombre.value.trim());
    formData.append("correo", form.correo.value.trim());
    formData.append("telefono", form.telefono.value.trim());
    formData.append("vacante", form.vacante.value);
    formData.append("experiencia_anios", form.experiencia.value);
    formData.append("tecnologias", tecnologias.join(", "));
    formData.append("consentimiento", form.consentimiento.checked ? "true" : "false");
    formData.append("cv", document.getElementById("cv").files[0]);
    formData.append("fecha_postulacion", new Date().toISOString());

    submitBtn.disabled = true;
    submitText.textContent = "Enviando...";

    try {
      const response = await fetch(N8N_WEBHOOK_URL, {
        method: "POST",
        body: formData
      });

      if (!response.ok) throw new Error(`Respuesta del servidor: ${response.status}`);

      status.textContent = "¡Postulación enviada! Revisaremos tu perfil y te contactaremos pronto.";
      status.classList.add("success");
      form.reset();
      tecnologias = [];
      document.querySelectorAll(".tag-chip").forEach(c => c.remove());
      document.getElementById("fileDrop").classList.remove("has-file");
      document.getElementById("fileDropText").textContent = "Arrastra tu PDF aquí o haz clic para seleccionarlo";

    } catch (err) {
      status.textContent = "No se pudo enviar la postulación. Intenta nuevamente en unos minutos.";
      status.classList.add("error");
      console.error("Error al enviar el formulario:", err);
    } finally {
      submitBtn.disabled = false;
      submitText.textContent = "Enviar postulación";
    }
  });

  function validateForm() {
    let valid = true;
    clearAllErrors();

    if (!form.nombre.value.trim()) { setError("nombre", "Ingresa tu nombre completo."); valid = false; }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(form.correo.value.trim())) { setError("correo", "Ingresa un correo válido."); valid = false; }

    if (form.telefono.value.trim().length < 7) { setError("telefono", "Ingresa un teléfono válido."); valid = false; }

    if (!form.vacante.value) { setError("vacante", "Selecciona una vacante."); valid = false; }

    if (form.experiencia.value === "" || Number(form.experiencia.value) < 0) {
      setError("experiencia", "Indica tus años de experiencia."); valid = false;
    }

    if (tecnologias.length === 0) { setError("tecnologias", "Agrega al menos una tecnología."); valid = false; }

    if (!document.getElementById("cv").files[0]) { setError("cv", "Adjunta tu hoja de vida en PDF."); valid = false; }

    if (!form.consentimiento.checked) {
      setError("consentimiento", "Debes aceptar el tratamiento de datos personales."); valid = false;
    }

    return valid;
  }
}

function setError(field, message) {
  const el = document.querySelector(`.field-error[data-for="${field}"]`);
  if (el) el.textContent = message;
}

function clearError(field) {
  const el = document.querySelector(`.field-error[data-for="${field}"]`);
  if (el) el.textContent = "";
}

function clearAllErrors() {
  document.querySelectorAll(".field-error").forEach(el => (el.textContent = ""));
}