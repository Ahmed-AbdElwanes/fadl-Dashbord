/* =========================================================
   Configuration
   ========================================================= */

const API_URL =
  "https://fadl-back-li70ls69k-wesos-projects-cc9e630c.vercel.app/api";

const MAX_IMAGES = 20;

const VERIFY_INTERVAL = 60_000;

/* =========================================================
   Categories
   ========================================================= */

const CATEGORIES = [
  "Print",
  "Social Media",
  "Logo & Branding Design",
  "Motion Graphics videos",
  "Social Media Reels",
  "2D Animation",
  "3D Modeling",
  "3D Animation Video"
];

/* =========================================================
   Available Tools
   The API will receive lowercase values.
   ========================================================= */

const TOOLS = [
  ["photoshop", "Photoshop"],
  ["illustrator", "Illustrator"],
  ["after effects", "After Effects"],
  ["indesign", "InDesign"],
  ["cinema 4d", "Cinema 4D"],
  ["arnold render", "Arnold Render"]
];

/* =========================================================
   State
   ========================================================= */

let selectedImages = [];

let verifyTimer = null;
let sessionTimer = null;
let messageTimer = null;

/* =========================================================
   DOM Helper
   ========================================================= */

const $ = (id) => document.getElementById(id);

/* =========================================================
   Authentication
   ========================================================= */

function getToken() {
  return localStorage.getItem("token");
}

function clearToken() {
  localStorage.removeItem("token");
}

/*
  Decode JWT payload without requiring an external library.
*/

function decodeJwt(token) {
  try {
    const payload = token.split(".")[1];

    if (!payload) {
      return null;
    }

    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");

    return JSON.parse(
      decodeURIComponent(
        atob(normalized)
          .split("")
          .map(
            (char) => "%" + ("00" + char.charCodeAt(0).toString(16)).slice(-2)
          )
          .join("")
      )
    );
  } catch {
    return null;
  }
}

function getTokenExpiry(token = getToken()) {
  const payload = token ? decodeJwt(token) : null;

  if (!payload?.exp) {
    return null;
  }

  return payload.exp * 1000;
}

function isTokenExpired(token = getToken()) {
  const expiry = getTokenExpiry(token);

  return expiry !== null && expiry <= Date.now();
}

/* =========================================================
   Authentication UI
   ========================================================= */

function showLogin() {
  $("loginSection").classList.remove("hidden");

  $("adminSection").classList.add("hidden");

  $("projectsSection").classList.add("hidden");

  $("sessionStatus").classList.add("hidden");
}

function showDashboard() {
  $("loginSection").classList.add("hidden");

  $("adminSection").classList.remove("hidden");

  $("projectsSection").classList.remove("hidden");

  $("sessionStatus").classList.remove("hidden");

  updateSessionStatus();
}

function logout(message = "تم تسجيل الخروج.") {
  clearToken();

  stopSessionMonitor();

  showLogin();

  showMessage("loginMessage", message, "success");
}

/*
  Called automatically when API returns 401 / 403.
*/

function handleUnauthorized() {
  logout("انتهت جلسة تسجيل الدخول. يرجى تسجيل الدخول مرة أخرى.");
}

/* =========================================================
   API Helper
   ========================================================= */

async function apiFetch(path, options = {}) {
  const headers = new Headers(options.headers || {});

  const currentToken = getToken();

  if (currentToken) {
    headers.set("Authorization", `Bearer ${currentToken}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers
  });

  /*
    Authentication failure.
  */

  if (response.status === 401 || response.status === 403) {
    handleUnauthorized();

    throw new Error("انتهت جلسة تسجيل الدخول.");
  }

  return response;
}

/* =========================================================
   API Response Parser
   ========================================================= */

async function readResponse(response) {
  const text = await response.text();

  if (!text) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return {
      message: text
    };
  }
}

/* =========================================================
   Session Monitoring
   ========================================================= */

function updateSessionStatus() {
  const currentToken = getToken();

  if (!currentToken) {
    return;
  }

  const expiry = getTokenExpiry(currentToken);

  const status = $("sessionStatus");

  if (!status) {
    return;
  }

  /*
    JWT has an expiration date.
  */

  if (expiry && expiry <= Date.now()) {
    handleUnauthorized();

    return;
  }

  if (expiry) {
    const date = new Intl.DateTimeFormat("en", {
      dateStyle: "medium",
      timeStyle: "short"
    }).format(expiry);

    status.textContent = `الجلسة فعالة • تنتهي في ${date}`;
  } else {
    status.textContent = "الجلسة فعالة • مدة الجلسة يحددها الخادم";
  }
}

/*
  Verify the token against the backend.
*/

async function verifyToken() {
  const currentToken = getToken();

  if (!currentToken) {
    showLogin();

    return false;
  }

  /*
    If JWT contains exp and it is expired,
    don't even make a request.
  */

  if (isTokenExpired(currentToken)) {
    handleUnauthorized();

    return false;
  }

  try {
    const response = await apiFetch("/projects");

    if (!response.ok) {
      throw new Error("تعذر التحقق من الجلسة.");
    }

    return true;
  } catch (error) {
    /*
      Network errors should NOT automatically
      log the admin out.

      401/403 are already handled by apiFetch().
    */

    if (getToken() && error.message !== "انتهت جلسة تسجيل الدخول.") {
      console.warn("Session verification failed:", error);
    }

    return false;
  }
}

function startSessionMonitor() {
  stopSessionMonitor();

  updateSessionStatus();

  /*
    Check the backend every minute.
  */

  verifyTimer = setInterval(async () => {
    updateSessionStatus();

    if (getToken()) {
      await verifyToken();
    }
  }, VERIFY_INTERVAL);

  /*
    Update visible expiration status.
  */

  sessionTimer = setInterval(updateSessionStatus, 1000);
}

function stopSessionMonitor() {
  clearInterval(verifyTimer);

  clearInterval(sessionTimer);

  verifyTimer = null;

  sessionTimer = null;
}

/* =========================================================
   Messages
   ========================================================= */

function showMessage(elementId, message, type = "error", duration = 5000) {
  const element = $(elementId);

  if (!element) {
    return;
  }

  clearTimeout(messageTimer);

  element.textContent = message;

  element.className = `message ${
    type === "success" ? "success-message" : "error-message"
  }`;

  if (duration > 0) {
    messageTimer = setTimeout(() => {
      element.textContent = "";
    }, duration);
  }
}

/* =========================================================
   Loading State
   ========================================================= */

function setLoading(button, loading, loadingText = "جاري التنفيذ...") {
  if (!button) {
    return;
  }

  if (!button.dataset.originalText) {
    button.dataset.originalText = button.textContent;
  }

  button.disabled = loading;

  button.textContent = loading ? loadingText : button.dataset.originalText;

  button.classList.toggle("opacity-60", loading);

  button.classList.toggle("cursor-not-allowed", loading);
}

/* =========================================================
   Escape HTML
   ========================================================= */

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

/* =========================================================
   Category Options
   ========================================================= */

function buildCategoryOptions(selected = "") {
  return `
    <option value="" disabled ${selected ? "" : "selected"}>
      اختر التصنيف
    </option>

    ${CATEGORIES.map(
      (category) => `
        <option
          value="${escapeHtml(category)}"
          ${category === selected ? "selected" : ""}
        >
          ${escapeHtml(category)}
        </option>
      `
    ).join("")}
  `;
}

/* =========================================================
   Tools
   ========================================================= */

function buildToolCheckboxes(selected = []) {
  const selectedSet = new Set(
    selected.map((value) => String(value).trim().toLowerCase())
  );

  return TOOLS.map(
    ([value, label]) => `
      <label class="tool-chip">

        <input
          type="checkbox"
          value="${escapeHtml(value)}"
          ${selectedSet.has(value) ? "checked" : ""}
        />

        <span>
          ${escapeHtml(label)}
        </span>

      </label>
    `
  ).join("");
}

/*
  Always send lowercase values to the API.
*/

function normalizeTools(values) {
  return [
    ...new Set(
      values.map((value) => String(value).trim().toLowerCase()).filter(Boolean)
    )
  ];
}

/* =========================================================
   Image Upload
   ========================================================= */

function validateImages(files) {
  const valid = [];

  for (const file of files) {
    if (!file.type.startsWith("image/")) {
      continue;
    }

    const duplicate = valid.some(
      (existing) =>
        existing.name === file.name &&
        existing.size === file.size &&
        existing.lastModified === file.lastModified
    );

    if (!duplicate) {
      valid.push(file);
    }
  }

  return valid;
}

function addImages(files) {
  const validFiles = validateImages(files);

  const remaining = MAX_IMAGES - selectedImages.length;

  if (remaining <= 0) {
    showMessage("createProjectMessage", `الحد الأقصى هو ${MAX_IMAGES} صورة.`);

    return;
  }

  const filesToAdd = validFiles.slice(0, remaining);

  selectedImages.push(...filesToAdd);

  if (validFiles.length > remaining) {
    showMessage(
      "createProjectMessage",
      `تمت إضافة ${remaining} صورة فقط. الحد الأقصى ${MAX_IMAGES}.`
    );
  }

  renderImagePreview();
}

function removeImage(index) {
  selectedImages.splice(index, 1);

  renderImagePreview();
}

function renderImagePreview() {
  const container = $("imagePreview");

  const count = $("imageCount");

  container.innerHTML = "";

  count.textContent = `${selectedImages.length} / ${MAX_IMAGES}`;

  selectedImages.forEach((file, index) => {
    const wrapper = document.createElement("div");

    wrapper.className = "preview-item";

    const image = document.createElement("img");

    image.src = URL.createObjectURL(file);

    image.alt = file.name;

    image.onload = () => {
      URL.revokeObjectURL(image.src);
    };

    const removeButton = document.createElement("button");

    removeButton.type = "button";

    removeButton.textContent = "×";

    removeButton.title = "Remove image";

    removeButton.addEventListener("click", () => removeImage(index));

    wrapper.append(image, removeButton);

    container.appendChild(wrapper);
  });
}

/* =========================================================
   Upload Zone
   ========================================================= */

function initUploadZone() {
  const zone = $("dropZone");

  const input = $("projectImages");

  ["dragenter", "dragover"].forEach((eventName) => {
    zone.addEventListener(eventName, (event) => {
      event.preventDefault();

      zone.classList.add("drag-active");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    zone.addEventListener(eventName, (event) => {
      event.preventDefault();

      zone.classList.remove("drag-active");
    });
  });

  zone.addEventListener("drop", (event) => {
    addImages([...event.dataTransfer.files]);
  });

  input.addEventListener("change", (event) => {
    addImages([...event.target.files]);

    /*
        Reset input so the same file
        can be selected again.
      */

    input.value = "";
  });
}

/* =========================================================
   Create Project
   ========================================================= */

function createFormData({ title, name, description, usedPrograms, images }) {
  const formData = new FormData();

  formData.append("title", title);

  formData.append("name", name);

  formData.append("description", description);

  /*
    Keep the exact API format
    used by the current backend.
  */

  formData.append("usedPrograms", JSON.stringify(usedPrograms));

  if (images) {
    images.forEach((image) => {
      formData.append("images", image);
    });
  }

  return formData;
}

function collectCreateData() {
  const title = $("projectTitle").value;

  const name = $("projectName").value.trim();

  const description = $("projectDescription").value.trim();

  const usedPrograms = normalizeTools(
    [...document.querySelectorAll("#projectTools input:checked")].map(
      (input) => input.value
    )
  );

  return {
    title,
    name,
    description,
    usedPrograms
  };
}

function clearCreateForm() {
  $("createProjectForm").reset();

  selectedImages = [];

  renderImagePreview();
}

async function createProject(event) {
  event.preventDefault();

  if (!getToken()) {
    handleUnauthorized();

    return;
  }

  const button = $("createProjectButton");

  const { title, name, description, usedPrograms } = collectCreateData();

  /* Validation */

  if (!title || !name || !description) {
    showMessage("createProjectMessage", "يرجى ملء جميع الحقول المطلوبة.");

    return;
  }

  if (!usedPrograms.length) {
    showMessage("createProjectMessage", "اختر برنامجًا واحدًا على الأقل.");

    return;
  }

  if (!selectedImages.length) {
    showMessage("createProjectMessage", "اختر صورة واحدة على الأقل.");

    return;
  }

  if (selectedImages.length > MAX_IMAGES) {
    showMessage("createProjectMessage", `الحد الأقصى ${MAX_IMAGES} صورة.`);

    return;
  }

  setLoading(button, true, "جاري رفع المشروع...");

  $("createLoader").classList.remove("hidden");

  try {
    const response = await apiFetch("/projects", {
      method: "POST",

      body: createFormData({
        title,
        name,
        description,
        usedPrograms,
        images: selectedImages
      })
    });

    const data = await readResponse(response);

    if (!response.ok) {
      throw new Error(data.message || "فشل إنشاء المشروع.");
    }

    showMessage(
      "createProjectMessage",
      "تم إنشاء المشروع ورفع الصور بنجاح.",
      "success",
      7000
    );

    clearCreateForm();

    await fetchProjects();
  } catch (error) {
    showMessage(
      "createProjectMessage",
      error.message || "حدث خطأ أثناء رفع المشروع."
    );
  } finally {
    $("createLoader").classList.add("hidden");

    setLoading(button, false);
  }
}

/* =========================================================
   Fetch Projects
   ========================================================= */

async function fetchProjects() {
  if (!getToken()) {
    showLogin();

    return;
  }

  const list = $("projectList");

  list.innerHTML = `
    <div class="loader-box">
      <div class="loader"></div>
      <span>
        جاري تحميل المشاريع...
      </span>
    </div>
  `;

  try {
    const response = await apiFetch("/projects");

    const projects = await readResponse(response);

    if (!response.ok) {
      throw new Error(projects.message || "فشل في جلب المشاريع.");
    }

    if (!Array.isArray(projects)) {
      throw new Error("تنسيق بيانات المشاريع غير صحيح.");
    }

    renderProjects(projects);
  } catch (error) {
    if (getToken()) {
      list.innerHTML = "";

      showMessage(
        "createProjectMessage",
        error.message || "تعذر تحميل المشاريع."
      );
    }
  }
}

/* =========================================================
   Render Projects
   ========================================================= */

function renderProjects(projects) {
  const list = $("projectList");

  list.innerHTML = "";

  if (!projects.length) {
    list.innerHTML = `
      <p class="text-gray-500">
        لا توجد مشاريع حتى الآن.
      </p>
    `;

    return;
  }

  projects.forEach((project) => {
    list.appendChild(createProjectCard(project));
  });
}

/* =========================================================
   Project Card
   ========================================================= */

function createProjectCard(project) {
  const card = document.createElement("article");

  card.className = "project-card";

  card.id = `project-${project._id}`;

  const programs = Array.isArray(project.usedPrograms)
    ? project.usedPrograms
    : [];

  const images = Array.isArray(project.imageUrls) ? project.imageUrls : [];

  /*
    Static structure only.

    User data is escaped before being inserted.
  */

  card.innerHTML = `

    <div class="project-grid">

      <div>

        <label>
          التصنيف
        </label>

        <select
          class="edit-title"
        >
          ${buildCategoryOptions(project.title || "")}
        </select>

      </div>


      <div>

        <label>
          اسم المشروع
        </label>

        <input
          class="edit-name"
          type="text"
          value="${escapeHtml(project.name || "")}"
        />

      </div>


      <div class="full">

        <label>
          الوصف
        </label>

        <textarea
          class="edit-description"
          rows="3"
        >${escapeHtml(project.description || "")}</textarea>

      </div>


      <div class="full">

        <label>
          البرامج المستخدمة
        </label>

        <div
          class="tools-grid edit-tools"
        >
          ${buildToolCheckboxes(programs)}
        </div>

      </div>

    </div>


    <div class="current-images">

      <div class="section-label">
        الصور الحالية
        (${images.length})
      </div>

      <div class="image-grid">

        ${
          images.length
            ? images
                .map(
                  (image, index) => `
                    <div
                      class="image-container"
                    >

                      <img
                        src="${escapeHtml(image)}"
                        alt="${escapeHtml(project.name || "Project image")}"
                        loading="lazy"
                      />

                      <span>
                        ${index + 1}
                      </span>

                    </div>
                  `
                )
                .join("")
            : `
              <p class="text-gray-500">
                لا توجد صور.
              </p>
            `
        }

      </div>

    </div>


    <div class="edit-upload">

      <label>
        استبدال الصور

        <span class="muted">
          (اختياري، 1-${MAX_IMAGES} صورة)
        </span>

      </label>

      <input
        class="edit-images"
        type="file"
        multiple
        accept="image/*"
      />

      <small>
        الصور الجديدة اختيارية.
      </small>

    </div>


    <div class="actions">

      <button
        type="button"
        class="update-btn"
      >
        حفظ التعديلات
      </button>


      <button
        type="button"
        class="delete-btn"
      >
        حذف المشروع
      </button>

    </div>


    <p class="project-message"></p>
  `;

  /* =======================================================
     Update
     ======================================================= */

  card
    .querySelector(".update-btn")
    .addEventListener("click", () => updateProject(project._id, card));

  /* =======================================================
     Delete
     ======================================================= */

  card
    .querySelector(".delete-btn")
    .addEventListener("click", () => deleteProject(project._id, card));

  /* =======================================================
     Edit Images Validation
     ======================================================= */

  card.querySelector(".edit-images").addEventListener("change", (event) => {
    const files = [...event.target.files];

    if (files.length > MAX_IMAGES) {
      event.target.value = "";

      showProjectMessage(card, `الحد الأقصى ${MAX_IMAGES} صورة.`);

      return;
    }

    const invalid = files.some((file) => !file.type.startsWith("image/"));

    if (invalid) {
      event.target.value = "";

      showProjectMessage(card, "يجب اختيار ملفات صور فقط.");
    }
  });

  return card;
}

/* =========================================================
   Project Message
   ========================================================= */

function showProjectMessage(card, message, success = false) {
  const element = card.querySelector(".project-message");

  element.textContent = message;

  element.className = `project-message ${
    success ? "success-message" : "error-message"
  }`;
}

/* =========================================================
   Update Project
   ========================================================= */

function collectEditData(card) {
  const title = card.querySelector(".edit-title").value;

  const name = card.querySelector(".edit-name").value.trim();

  const description = card.querySelector(".edit-description").value.trim();

  const usedPrograms = normalizeTools(
    [...card.querySelectorAll(".edit-tools input:checked")].map(
      (input) => input.value
    )
  );

  return {
    title,
    name,
    description,
    usedPrograms
  };
}

async function updateProject(projectId, card) {
  if (!getToken()) {
    handleUnauthorized();

    return;
  }

  const button = card.querySelector(".update-btn");

  const { title, name, description, usedPrograms } = collectEditData(card);

  const imageInput = card.querySelector(".edit-images");

  const images = [...imageInput.files];

  if (!title || !name || !description) {
    showProjectMessage(card, "يرجى ملء جميع الحقول المطلوبة.");

    return;
  }

  if (!usedPrograms.length) {
    showProjectMessage(card, "اختر برنامجًا واحدًا على الأقل.");

    return;
  }

  if (images.length > MAX_IMAGES) {
    showProjectMessage(card, `الحد الأقصى ${MAX_IMAGES} صورة.`);

    return;
  }

  setLoading(button, true, "جاري الحفظ...");

  try {
    const response = await apiFetch(
      `/projects/${encodeURIComponent(projectId)}`,
      {
        method: "PUT",

        body: createFormData({
          title,
          name,
          description,
          usedPrograms,
          images
        })
      }
    );

    const data = await readResponse(response);

    if (!response.ok) {
      throw new Error(data.message || "فشل تحديث المشروع.");
    }

    showProjectMessage(card, "تم تحديث المشروع بنجاح.", true);

    await fetchProjects();
  } catch (error) {
    showProjectMessage(card, error.message || "حدث خطأ أثناء تحديث المشروع.");
  } finally {
    setLoading(button, false);
  }
}

/* =========================================================
   Delete Project
   ========================================================= */

async function deleteProject(projectId, card) {
  if (!getToken()) {
    handleUnauthorized();

    return;
  }

  if (!confirm("هل أنت متأكد من حذف هذا المشروع؟")) {
    return;
  }

  const button = card.querySelector(".delete-btn");

  setLoading(button, true, "جاري الحذف...");

  try {
    const response = await apiFetch(
      `/projects/${encodeURIComponent(projectId)}`,
      {
        method: "DELETE"
      }
    );

    const data = await readResponse(response);

    if (!response.ok) {
      throw new Error(data.message || "فشل حذف المشروع.");
    }

    card.remove();

    showMessage("createProjectMessage", "تم حذف المشروع بنجاح.", "success");
  } catch (error) {
    showProjectMessage(card, error.message || "حدث خطأ أثناء حذف المشروع.");

    setLoading(button, false);
  }
}

/* =========================================================
   Update Admin
   ========================================================= */

async function updateAdmin() {
  if (!getToken()) {
    handleUnauthorized();

    return;
  }

  const button = $("updateAdminButton");

  const name = $("adminName").value.trim();

  const password = $("adminPassword").value;

  if (!name || !password) {
    showMessage("adminMessage", "يرجى إدخال الاسم وكلمة المرور الجديدين.");

    return;
  }

  setLoading(button, true, "جاري التحديث...");

  try {
    const response = await apiFetch("/admin", {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        name,
        password
      })
    });

    const data = await readResponse(response);

    if (!response.ok) {
      throw new Error(data.message || "فشل تحديث بيانات المسؤول.");
    }

    $("adminName").value = "";

    $("adminPassword").value = "";

    showMessage("adminMessage", "تم تحديث بيانات المسؤول بنجاح.", "success");
  } catch (error) {
    showMessage("adminMessage", error.message || "حدث خطأ أثناء التحديث.");
  } finally {
    setLoading(button, false);
  }
}

/* =========================================================
   Login
   ========================================================= */

async function login() {
  const button = $("loginButton");

  const name = $("loginName").value.trim();

  const password = $("loginPassword").value;

  if (!name || !password) {
    showMessage("loginMessage", "يرجى إدخال اسم المستخدم وكلمة المرور.");

    return;
  }

  setLoading(button, true, "جاري تسجيل الدخول...");

  try {
    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify({
        name,
        password
      })
    });

    const data = await readResponse(response);

    if (!response.ok || !data.token) {
      throw new Error(data.message || "فشل تسجيل الدخول.");
    }

    localStorage.setItem("token", data.token);

    showDashboard();

    startSessionMonitor();

    showMessage("loginMessage", "تم تسجيل الدخول بنجاح.", "success");

    await fetchProjects();
  } catch (error) {
    showMessage("loginMessage", error.message || "حدث خطأ أثناء تسجيل الدخول.");
  } finally {
    setLoading(button, false);
  }
}

/* =========================================================
   Initialization
   ========================================================= */

async function init() {
  /*
    Build category select.
  */

  $("projectTitle").innerHTML = buildCategoryOptions();

  /*
    Build tool selection.
  */

  $("projectTools").innerHTML = buildToolCheckboxes();

  /*
    Events.
  */

  $("loginButton").addEventListener("click", login);

  $("logoutButton").addEventListener("click", () => logout());

  $("updateAdminButton").addEventListener("click", updateAdmin);

  $("createProjectForm").addEventListener("submit", createProject);

  initUploadZone();

  renderImagePreview();

  /*
    Restore existing session.
  */

  const currentToken = getToken();

  if (!currentToken || isTokenExpired(currentToken)) {
    clearToken();

    showLogin();

    return;
  }

  const valid = await verifyToken();

  if (valid) {
    showDashboard();

    startSessionMonitor();

    await fetchProjects();
  }

  /*
    Re-check session when
    the user returns to the tab.
  */

  document.addEventListener("visibilitychange", async () => {
    if (document.visibilityState === "visible" && getToken()) {
      updateSessionStatus();

      await verifyToken();
    }
  });
}

/* =========================================================
   Start Application
   ========================================================= */

document.addEventListener("DOMContentLoaded", init);
