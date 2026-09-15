/* =========================================================
   DIGITALVAULT
   Supabase-powered shared file vault
   ========================================================= */

(() => {
  "use strict";

  const CONFIG = window.DIGITALVAULT_CONFIG || {};

  const SUPABASE_URL = CONFIG.SUPABASE_URL;
  const SUPABASE_KEY =
    CONFIG.SUPABASE_ANON_KEY || CONFIG.SUPABASE_PUBLISHABLE_KEY;

  const BUCKET = "files";
  const TABLE = "files";
  const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

  let client = null;
  let allFiles = [];
  let selectedFiles = [];

  /* ---------------------------------------------------------
     DOM helpers
     --------------------------------------------------------- */

  const $ = (id) => document.getElementById(id);

  function firstElement(...ids) {
    for (const id of ids) {
      const element = $(id);
      if (element) return element;
    }
    return null;
  }

  const uploadInput = firstElement(
    "fileInput",
    "uploadInput",
    "file-input",
    "file-upload"
  );

  const uploadButton = firstElement(
    "uploadBtn",
    "uploadButton",
    "upload-button"
  );

  const dropZone = firstElement(
    "dropZone",
    "uploadPanel",
    "dropzone",
    "drop-area"
  );

  const filesContainer = firstElement(
    "filesGrid",
    "fileGrid",
    "files",
    "fileList",
    "uploads",
    "vault"
  );

  const searchInput = firstElement(
    "searchInput",
    "search",
    "searchBox"
  );

  const sortSelect = firstElement(
    "sortSelect",
    "sort"
  );

  const statusElement = firstElement(
    "status",
    "storageStatus",
    "connectionStatus"
  );

  /* ---------------------------------------------------------
     Status
     --------------------------------------------------------- */

  function setStatus(message, type = "") {
    if (!statusElement) return;

    statusElement.textContent = message;

    statusElement.classList.remove(
      "success",
      "error",
      "loading",
      "warning"
    );

    if (type) {
      statusElement.classList.add(type);
    }
  }

  /* ---------------------------------------------------------
     Supabase
     --------------------------------------------------------- */

  function initSupabase() {
    if (!SUPABASE_URL || !SUPABASE_KEY) {
      setStatus("Supabase configuration missing", "error");

      console.error(
        "DigitalVault: SUPABASE_URL or SUPABASE_ANON_KEY is missing."
      );

      return false;
    }

    if (!window.supabase || !window.supabase.createClient) {
      setStatus("Supabase library failed to load", "error");

      console.error(
        "DigitalVault: Supabase JS library is not available."
      );

      return false;
    }

    client = window.supabase.createClient(
      SUPABASE_URL,
      SUPABASE_KEY
    );

    return true;
  }

  /* ---------------------------------------------------------
     Utilities
     --------------------------------------------------------- */

  function escapeHTML(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function formatBytes(bytes) {
    if (!Number.isFinite(Number(bytes)) || Number(bytes) <= 0) {
      return "0 B";
    }

    const units = ["B", "KB", "MB", "GB", "TB"];
    const index = Math.min(
      Math.floor(Math.log(bytes) / Math.log(1024)),
      units.length - 1
    );

    const value = bytes / Math.pow(1024, index);

    return `${value.toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
  }

  function formatDate(date) {
    if (!date) return "Unknown date";

    const parsed = new Date(date);

    if (Number.isNaN(parsed.getTime())) {
      return "Unknown date";
    }

    return parsed.toLocaleDateString(undefined, {
      day: "numeric",
      month: "short",
      year: "numeric"
    });
  }

  function getFileIcon(mime, name) {
    const type = String(mime || "").toLowerCase();
    const extension = String(name || "")
      .split(".")
      .pop()
      .toLowerCase();

    if (type.startsWith("image/")) return "🖼️";
    if (type.startsWith("video/")) return "🎬";
    if (type.startsWith("audio/")) return "🎵";
    if (type.includes("pdf") || extension === "pdf") return "📕";
    if (
      type.includes("zip") ||
      type.includes("rar") ||
      type.includes("7z") ||
      ["zip", "rar", "7z"].includes(extension)
    ) {
      return "📦";
    }

    if (
      type.includes("text") ||
      ["txt", "md", "json", "xml", "csv"].includes(extension)
    ) {
      return "📄";
    }

    if (
      type.includes("javascript") ||
      ["js", "ts", "html", "css"].includes(extension)
    ) {
      return "💻";
    }

    return "📁";
  }

  function getPreviewType(file) {
    const mime = String(file.mime_type || "").toLowerCase();

    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";

    return "generic";
  }

  /* ---------------------------------------------------------
     Uploader name
     --------------------------------------------------------- */

  function getUploaderName() {
    let name = localStorage.getItem("digitalvault_uploader");

    if (name) {
      return name;
    }

    name = window.prompt(
      "What name should be shown as the uploader?"
    );

    if (!name || !name.trim()) {
      name = "Anonymous";
    }

    name = name.trim().slice(0, 40);

    localStorage.setItem(
      "digitalvault_uploader",
      name
    );

    return name;
  }

  /* ---------------------------------------------------------
     Load files
     --------------------------------------------------------- */

  async function loadFiles() {
    if (!client) return;

    setStatus("Loading uploads…", "loading");

    const { data, error } = await client
      .from(TABLE)
      .select(
        "id,name,storage_path,size,mime_type,uploader_name,created_at"
      )
      .order("created_at", {
        ascending: false
      });

    if (error) {
      console.error(
        "DigitalVault database error:",
        error
      );

      setStatus(
        `Database error: ${error.message}`,
        "error"
      );

      renderEmpty(
        "Couldn't load uploads",
        error.message
      );

      return;
    }

    allFiles = Array.isArray(data) ? data : [];

    renderFiles();

    setStatus(
      `${allFiles.length} upload${allFiles.length === 1 ? "" : "s"} available`,
      "success"
    );
  }

  /* ---------------------------------------------------------
     Render
     --------------------------------------------------------- */

  function renderEmpty(title = "No uploads yet", message = "Upload something to get started.") {
    if (!filesContainer) return;

    filesContainer.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">☁️</div>
        <h3>${escapeHTML(title)}</h3>
        <p>${escapeHTML(message)}</p>
      </div>
    `;
  }

  function getFilteredFiles() {
    let files = [...allFiles];

    const query = searchInput
      ? searchInput.value.trim().toLowerCase()
      : "";

    if (query) {
      files = files.filter((file) => {
        return (
          String(file.name || "")
            .toLowerCase()
            .includes(query) ||
          String(file.uploader_name || "")
            .toLowerCase()
            .includes(query) ||
          String(file.mime_type || "")
            .toLowerCase()
            .includes(query)
        );
      });
    }

    const sort = sortSelect ? sortSelect.value : "newest";

    if (sort === "oldest") {
      files.sort(
        (a, b) =>
          new Date(a.created_at) -
          new Date(b.created_at)
      );
    }

    if (sort === "name") {
      files.sort((a, b) =>
        String(a.name).localeCompare(
          String(b.name)
        )
      );
    }

    if (sort === "largest") {
      files.sort(
        (a, b) =>
          Number(b.size || 0) -
          Number(a.size || 0)
      );
    }

    if (sort === "smallest") {
      files.sort(
        (a, b) =>
          Number(a.size || 0) -
          Number(b.size || 0)
      );
    }

    return files;
  }

  function renderFiles() {
    if (!filesContainer) {
      console.error(
        "DigitalVault: Couldn't find the file container."
      );
      return;
    }

    const files = getFilteredFiles();

    if (!files.length) {
      if (allFiles.length) {
        renderEmpty(
          "No matching uploads",
          "Try a different search."
        );
      } else {
        renderEmpty();
      }

      return;
    }

    filesContainer.innerHTML = files
      .map(renderFileCard)
      .join("");

    filesContainer
      .querySelectorAll("[data-download]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          downloadFile(button.dataset.download);
        });
      });

    filesContainer
      .querySelectorAll("[data-preview]")
      .forEach((button) => {
        button.addEventListener("click", () => {
          previewFile(button.dataset.preview);
        });
      });
  }

  function renderFileCard(file) {
    const previewType = getPreviewType(file);

    const { data } = client.storage
      .from(BUCKET)
      .getPublicUrl(file.storage_path);

    const publicUrl = data?.publicUrl || "#";

    let previewHTML = `
      <div class="file-preview generic-preview">
        <span>${getFileIcon(file.mime_type, file.name)}</span>
      </div>
    `;

    if (previewType === "image") {
      previewHTML = `
        <div class="file-preview image-preview">
          <img
            src="${escapeHTML(publicUrl)}"
            alt="${escapeHTML(file.name)}"
            loading="lazy"
            onerror="this.style.display='none'"
          >
        </div>
      `;
    }

    if (previewType === "video") {
      previewHTML = `
        <div class="file-preview video-preview">
          <video
            src="${escapeHTML(publicUrl)}"
            muted
            preload="metadata"
          ></video>
          <span class="preview-overlay">▶</span>
        </div>
      `;
    }

    if (previewType === "audio") {
      previewHTML = `
        <div class="file-preview audio-preview">
          <span>🎵</span>
        </div>
      `;
    }

    return `
      <article class="file-card">

        ${previewHTML}

        <div class="file-card-body">

          <div class="file-card-title" title="${escapeHTML(file.name)}">
            ${escapeHTML(file.name)}
          </div>

          <div class="file-card-meta">
            <span>${formatBytes(Number(file.size || 0))}</span>
            <span>•</span>
            <span>${formatDate(file.created_at)}</span>
          </div>

          <div class="file-card-uploader">
            👤 ${escapeHTML(file.uploader_name || "Anonymous")}
          </div>

          <div class="file-card-actions">

            <button
              type="button"
              class="file-action"
              data-download="${escapeHTML(file.id)}"
            >
              Download
            </button>

            ${
              previewType !== "generic"
                ? `
                  <button
                    type="button"
                    class="file-action secondary"
                    data-preview="${escapeHTML(file.id)}"
                  >
                    Preview
                  </button>
                `
                : ""
            }

          </div>

        </div>

      </article>
    `;
  }

  /* ---------------------------------------------------------
     Public URL
     --------------------------------------------------------- */

  function getPublicUrl(file) {
    const { data } = client.storage
      .from(BUCKET)
      .getPublicUrl(file.storage_path);

    return data?.publicUrl || null;
  }

  /* ---------------------------------------------------------
     Download
     --------------------------------------------------------- */

  async function downloadFile(id) {
    const file = allFiles.find(
      (item) => String(item.id) === String(id)
    );

    if (!file) {
      alert("File not found.");
      return;
    }

    const url = getPublicUrl(file);

    if (!url) {
      alert("Couldn't generate the download URL.");
      return;
    }

    const link = document.createElement("a");

    link.href = url;
    link.download = file.name;
    link.target = "_blank";
    link.rel = "noopener";

    document.body.appendChild(link);
    link.click();
    link.remove();
  }

  /* ---------------------------------------------------------
     Preview
     --------------------------------------------------------- */

  function previewFile(id) {
    const file = allFiles.find(
      (item) => String(item.id) === String(id)
    );

    if (!file) return;

    const url = getPublicUrl(file);

    if (!url) return;

    const type = getPreviewType(file);

    if (type === "image") {
      window.open(url, "_blank", "noopener");
      return;
    }

    if (type === "video") {
      showPreviewModal(`
        <video
          controls
          autoplay
          style="max-width:100%;max-height:75vh;border-radius:16px"
          src="${escapeHTML(url)}"
        ></video>
      `);

      return;
    }

    if (type === "audio") {
      showPreviewModal(`
        <div style="padding:30px;text-align:center">
          <div style="font-size:60px">🎵</div>
          <h3>${escapeHTML(file.name)}</h3>
          <audio
            controls
            autoplay
            style="width:100%;margin-top:20px"
            src="${escapeHTML(url)}"
          ></audio>
        </div>
      `);
    }
  }

  function showPreviewModal(content) {
    let modal = document.getElementById(
      "digitalvault-preview-modal"
    );

    if (!modal) {
      modal = document.createElement("div");

      modal.id = "digitalvault-preview-modal";

      Object.assign(modal.style, {
        position: "fixed",
        inset: "0",
        zIndex: "99999",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "30px",
        background: "rgba(0,0,0,.82)",
        backdropFilter: "blur(15px)"
      });

      document.body.appendChild(modal);

      modal.addEventListener("click", (event) => {
        if (event.target === modal) {
          modal.remove();
        }
      });
    }

    modal.innerHTML = `
      <div style="position:relative;max-width:1000px;width:100%">
        <button
          type="button"
          id="digitalvault-close-preview"
          style="
            position:absolute;
            right:0;
            top:-45px;
            border:0;
            background:rgba(255,255,255,.12);
            color:white;
            border-radius:10px;
            padding:8px 13px;
            cursor:pointer;
            font-size:18px;
          "
        >
          ×
        </button>

        ${content}
      </div>
    `;

    document
      .getElementById("digitalvault-close-preview")
      ?.addEventListener("click", () => {
        modal.remove();
      });
  }

  /* ---------------------------------------------------------
     Upload
     --------------------------------------------------------- */

  async function uploadFiles(files) {
    if (!client) {
      alert("Supabase isn't connected.");
      return;
    }

    const fileArray = Array.from(files || []);

    if (!fileArray.length) {
      return;
    }

    const uploaderName = getUploaderName();

    setStatus(
      `Uploading ${fileArray.length} file${fileArray.length === 1 ? "" : "s"}…`,
      "loading"
    );

    let successful = 0;

    for (const file of fileArray) {
      try {
        if (file.size > MAX_FILE_SIZE) {
          throw new Error(
            `${file.name} is larger than 100 MB.`
          );
        }

        /*
         * Unique path prevents two users uploading files
         * with the same filename from colliding.
         */
        const safeName = file.name
          .replace(/[^\w.\-() ]+/g, "_")
          .replace(/\s+/g, "_");

        const randomPart =
          crypto.randomUUID
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()
                .toString(36)
                .slice(2)}`;

        const storagePath =
          `${randomPart}-${safeName}`;

        /* Upload actual file */
        const { error: uploadError } =
          await client.storage
            .from(BUCKET)
            .upload(
              storagePath,
              file,
              {
                cacheControl: "3600",
                contentType:
                  file.type ||
                  "application/octet-stream",
                upsert: false
              }
            );

        if (uploadError) {
          throw new Error(
            `Storage upload failed: ${uploadError.message}`
          );
        }

        /* Insert metadata */
        const { error: databaseError } =
          await client
            .from(TABLE)
            .insert({
              name: file.name,
              storage_path: storagePath,
              size: file.size,
              mime_type:
                file.type ||
                "application/octet-stream",
              uploader_name: uploaderName
            });

        if (databaseError) {
          /*
           * If the database insert fails after the Storage
           * upload succeeded, clean up the orphaned file.
           */
          await client.storage
            .from(BUCKET)
            .remove([storagePath]);

          throw new Error(
            `Database insert failed: ${databaseError.message}`
          );
        }

        successful++;

      } catch (error) {
        console.error(
          `DigitalVault upload error for ${file.name}:`,
          error
        );

        alert(
          `Couldn't upload "${file.name}".\n\n${error.message}`
        );
      }
    }

    selectedFiles = [];

    if (uploadInput) {
      uploadInput.value = "";
    }

    await loadFiles();

    if (successful) {
      setStatus(
        `${successful} file${successful === 1 ? "" : "s"} uploaded successfully`,
        "success"
      );
    }
  }

  /* ---------------------------------------------------------
     Drag & Drop
     --------------------------------------------------------- */

  function setupDragAndDrop() {
    if (!dropZone) return;

    ["dragenter", "dragover"].forEach((eventName) => {
      dropZone.addEventListener(
        eventName,
        (event) => {
          event.preventDefault();
          event.stopPropagation();

          dropZone.classList.add("dragging");
        }
      );
    });

    ["dragleave", "drop"].forEach((eventName) => {
      dropZone.addEventListener(
        eventName,
        (event) => {
          event.preventDefault();
          event.stopPropagation();

          dropZone.classList.remove("dragging");
        }
      );
    });

    dropZone.addEventListener(
      "drop",
      (event) => {
        const files = event.dataTransfer?.files;

        if (files?.length) {
          uploadFiles(files);
        }
      }
    );
  }

  /* ---------------------------------------------------------
     File input
     --------------------------------------------------------- */

  function setupUploadInput() {
    if (uploadButton && uploadInput) {
      uploadButton.addEventListener(
        "click",
        () => {
          uploadInput.click();
        }
      );
    }

    if (uploadInput) {
      uploadInput.addEventListener(
        "change",
        () => {
          if (uploadInput.files?.length) {
            uploadFiles(uploadInput.files);
          }
        }
      );
    }

    /*
     * Makes the whole upload panel clickable if there
     * isn't a dedicated upload button.
     */
    if (
      dropZone &&
      uploadInput &&
      !uploadButton
    ) {
      dropZone.addEventListener(
        "click",
        (event) => {
          if (
            event.target.closest("button") ||
            event.target.closest("input")
          ) {
            return;
          }

          uploadInput.click();
        }
      );
    }
  }

  /* ---------------------------------------------------------
     Search / sorting
     --------------------------------------------------------- */

  function setupFilters() {
    if (searchInput) {
      searchInput.addEventListener(
        "input",
        renderFiles
      );
    }

    if (sortSelect) {
      sortSelect.addEventListener(
        "change",
        renderFiles
      );
    }
  }

  /* ---------------------------------------------------------
     Start
     --------------------------------------------------------- */

  async function start() {
    console.log("DigitalVault starting…");

    if (!initSupabase()) {
      return;
    }

    setupUploadInput();
    setupDragAndDrop();
    setupFilters();

    await loadFiles();

    console.log("DigitalVault ready.");
  }

  if (
    document.readyState === "loading"
  ) {
    document.addEventListener(
      "DOMContentLoaded",
      start
    );
  } else {
    start();
  }

})();
