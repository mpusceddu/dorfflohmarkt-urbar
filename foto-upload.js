(() => {
  "use strict";

  const config = window.FOTO_UPLOAD_CONFIG || {};
  const form = document.querySelector("#photo-form");
  const locationSelect = document.querySelector("#location-id");
  const fileInput = document.querySelector("#photo-file");
  const rightsInput = document.querySelector("#photo-rights");
  const submitButton = document.querySelector("#photo-submit");
  const status = document.querySelector("#photo-status");
  const preview = document.querySelector("#photo-preview");
  const previewImage = document.querySelector("#photo-preview-image");
  const turnstileContainer = document.querySelector("#turnstile-container");
  let previewUrl = "";

  populateLocations();
  configureTurnstile();

  fileInput.addEventListener("change", showPreview);
  form.addEventListener("submit", submitPhoto);

  function populateLocations() {
    if (!Array.isArray(window.ORTSDATEN) && typeof ORTSDATEN === "undefined") {
      setStatus("Die Standorte konnten nicht geladen werden. Bitte laden Sie die Seite neu.", "error");
      submitButton.disabled = true;
      return;
    }

    const locations = typeof ORTSDATEN !== "undefined" ? ORTSDATEN : window.ORTSDATEN;
    locations
      .filter((location) => location && location.id && location.adresse && Array.isArray(location.staende))
      .sort((a, b) => a.staende[0].nummer - b.staende[0].nummer)
      .forEach((location) => {
        const numbers = location.staende.map((stand) => stand.nummer);
        const label = numbers.length === 1
          ? `Stand ${numbers[0]} · ${location.adresse}`
          : `Stände ${numbers.join(", ")} · ${location.name || location.adresse}`;
        const option = document.createElement("option");
        option.value = location.id;
        option.textContent = label;
        locationSelect.append(option);
      });

    const requestedLocation = new URLSearchParams(window.location.search).get("ort");
    if (requestedLocation && [...locationSelect.options].some((option) => option.value === requestedLocation)) {
      locationSelect.value = requestedLocation;
    }
  }

  function configureTurnstile() {
    if (!config.apiUrl) {
      submitButton.disabled = true;
      setStatus("Der Foto-Upload wird gerade vorbereitet und ist noch nicht freigeschaltet.", "loading");
      return;
    }

    if (config.turnstileSiteKey) {
      turnstileContainer.hidden = false;
      renderTurnstileWhenReady(0);
    }
  }

  function renderTurnstileWhenReady(attempt) {
    if (window.turnstile) {
      window.turnstile.render(turnstileContainer, {
        sitekey: config.turnstileSiteKey,
        language: "de",
        action: "standfoto"
      });
      return;
    }
    if (attempt < 50) window.setTimeout(() => renderTurnstileWhenReady(attempt + 1), 100);
  }

  function showPreview() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const file = fileInput.files[0];
    if (!file) {
      preview.dataset.visible = "false";
      previewImage.removeAttribute("src");
      return;
    }
    previewUrl = URL.createObjectURL(file);
    previewImage.src = previewUrl;
    preview.dataset.visible = "true";
  }

  async function submitPhoto(event) {
    event.preventDefault();
    clearStatus();

    if (!form.reportValidity()) return;
    const original = fileInput.files[0];
    if (!original) return;
    if (original.size > 15 * 1024 * 1024) {
      setStatus("Das ausgewählte Foto ist größer als 15 MB. Bitte wählen Sie ein kleineres Bild.", "error");
      return;
    }

    submitButton.disabled = true;
    setStatus("Das Foto wird vorbereitet und anschließend sicher übertragen …", "loading");

    try {
      const photo = await preparePhoto(original);
      const data = new FormData();
      data.append("locationId", locationSelect.value);
      data.append("rights", rightsInput.checked ? "yes" : "no");
      data.append("photo", photo, "standfoto.jpg");

      const turnstileToken = form.querySelector('[name="cf-turnstile-response"]')?.value;
      if (turnstileToken) data.append("turnstileToken", turnstileToken);

      const response = await fetch(`${config.apiUrl.replace(/\/$/, "")}/api/uploads`, {
        method: "POST",
        body: data,
        headers: { "Accept": "application/json" }
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(result.message || "Das Foto konnte nicht übertragen werden.");
      }

      form.reset();
      preview.dataset.visible = "false";
      previewImage.removeAttribute("src");
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setStatus("Vielen Dank! Das Foto wurde eingereicht und wird vor der Veröffentlichung geprüft.", "success");
      if (window.turnstile) window.turnstile.reset();
    } catch (error) {
      setStatus(error.message || "Das Foto konnte nicht übertragen werden. Bitte versuchen Sie es später erneut.", "error");
      if (window.turnstile) window.turnstile.reset();
    } finally {
      submitButton.disabled = false;
    }
  }

  async function preparePhoto(file) {
    try {
      const source = await decodeImage(file);
      const maxEdge = 1600;
      const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(source.width * scale));
      canvas.height = Math.max(1, Math.round(source.height * scale));
      const context = canvas.getContext("2d", { alpha: false });
      context.drawImage(source, 0, 0, canvas.width, canvas.height);
      if (typeof source.close === "function") source.close();
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.86));
      if (!blob) throw new Error("Konvertierung fehlgeschlagen");
      return blob;
    } catch {
      throw new Error("Dieses Bildformat kann auf dem Gerät nicht verarbeitet werden. Bitte verwenden Sie ein JPG-, PNG- oder WebP-Foto.");
    }
  }

  async function decodeImage(file) {
    if (typeof createImageBitmap === "function") {
      return createImageBitmap(file);
    }

    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    try {
      image.src = objectUrl;
      await image.decode();
      return image;
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  }

  function setStatus(message, state) {
    status.textContent = message;
    status.dataset.state = state;
  }

  function clearStatus() {
    status.textContent = "";
    delete status.dataset.state;
  }
})();
