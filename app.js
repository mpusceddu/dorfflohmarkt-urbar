(() => {
  "use strict";

  const URBAR_MITTE = [50.383, 7.626];
  const map = L.map("map", {
    zoomControl: true,
    scrollWheelZoom: false
  }).setView(URBAR_MITTE, 15);

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap-Mitwirkende</a>'
  }).addTo(map);

  const list = document.querySelector("#stand-list");
  const emptyMessage = document.querySelector("#empty-message");
  const count = document.querySelector("#stand-count");
  const locateButton = document.querySelector("#locate-button");
  const locationStatus = document.querySelector("#location-status");
  const bounds = [];
  let userMarker = null;
  let accuracyCircle = null;

  const validStands = Array.isArray(STANDDATEN)
    ? STANDDATEN.filter((stand) =>
        Number.isInteger(stand.nummer) &&
        stand.nummer >= 1 &&
        stand.nummer <= 82 &&
        typeof stand.adresse === "string" &&
        stand.adresse.trim() !== ""
      )
    : [];

  validStands
    .sort((a, b) => a.nummer - b.nummer)
    .forEach((stand) => {
      const hasCoordinates = Number.isFinite(stand.lat) && Number.isFinite(stand.lng);
      let marker = null;

      if (hasCoordinates) {
        const icon = L.divIcon({
          className: "",
          html: `<span class="marker-number" aria-hidden="true">${stand.nummer}</span>`,
          iconSize: [35, 35],
          iconAnchor: [17, 17]
        });

        marker = L.marker([stand.lat, stand.lng], {
          icon,
          title: `Stand ${stand.nummer}: ${stand.adresse}`
        }).addTo(map);

        const offer = stand.angebot
          ? `<br><span>${escapeHtml(stand.angebot)}</span>`
          : "";

        marker.bindPopup(
          `<strong>Stand ${stand.nummer}</strong><br>${escapeHtml(stand.adresse)}${offer}`
        );
        bounds.push([stand.lat, stand.lng]);
      }

      const item = document.createElement("li");
      item.className = "stand-card";
      item.tabIndex = 0;
      item.innerHTML = [
        `<strong>Stand ${stand.nummer}</strong>`,
        `<span>${escapeHtml(stand.adresse)}</span>`,
        stand.angebot ? `<span>${escapeHtml(stand.angebot)}</span>` : ""
      ].join("");

      const openMarker = () => {
        if (!marker) return;
        map.setView(marker.getLatLng(), 17);
        marker.openPopup();
      };

      item.addEventListener("click", openMarker);
      item.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openMarker();
        }
      });

      list.append(item);
    });

  if (validStands.length > 0) {
    emptyMessage.hidden = true;
    count.textContent = `${validStands.length} von 82 Ständen eingetragen`;
  }

  if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [40, 40] });
  } else if (bounds.length === 1) {
    map.setView(bounds[0], 17);
  }

  document.querySelectorAll('a[href="#karte"]').forEach((link) => {
    link.addEventListener("click", () => {
      window.setTimeout(() => map.invalidateSize(), 350);
    });
  });

  if (!("geolocation" in navigator)) {
    locateButton.disabled = true;
    locateButton.textContent = "Standort nicht verfügbar";
    setLocationStatus(
      "Dieses Gerät unterstützt keine Standortbestimmung.",
      "error"
    );
  } else {
    locateButton.addEventListener("click", locateUser);
  }

  function locateUser() {
    locateButton.disabled = true;
    locateButton.setAttribute("aria-busy", "true");
    setLocationStatus("Standort wird bestimmt …", "loading");

    navigator.geolocation.getCurrentPosition(
      showUserLocation,
      showLocationError,
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 30000
      }
    );
  }

  function showUserLocation(position) {
    const coordinates = [position.coords.latitude, position.coords.longitude];
    const accuracy = Math.max(position.coords.accuracy, 8);

    if (userMarker) map.removeLayer(userMarker);
    if (accuracyCircle) map.removeLayer(accuracyCircle);

    const userIcon = L.divIcon({
      className: "",
      html: '<span class="user-location-marker" aria-hidden="true"></span>',
      iconSize: [25, 25],
      iconAnchor: [12, 12]
    });

    accuracyCircle = L.circle(coordinates, {
      radius: accuracy,
      color: "#245f8b",
      weight: 1,
      fillColor: "#67a5c8",
      fillOpacity: 0.16,
      interactive: false
    }).addTo(map);

    userMarker = L.marker(coordinates, {
      icon: userIcon,
      title: "Ihr aktueller Standort",
      zIndexOffset: 1000
    })
      .addTo(map)
      .bindPopup(
        `<strong>Ihr Standort</strong><br>Genauigkeit: etwa ${formatAccuracy(accuracy)}`
      )
      .openPopup();

    map.setView(coordinates, zoomForAccuracy(accuracy), { animate: true });

    locateButton.disabled = false;
    locateButton.removeAttribute("aria-busy");
    locateButton.innerHTML =
      '<span class="location-symbol" aria-hidden="true">◎</span> Standort aktualisieren';
    setLocationStatus(
      `Standort gefunden. Genauigkeit etwa ${formatAccuracy(accuracy)}.`,
      "success"
    );
  }

  function showLocationError(error) {
    const messages = {
      1: "Standortfreigabe wurde abgelehnt. Sie können sie in den Browser-Einstellungen erlauben.",
      2: "Der Standort konnte gerade nicht ermittelt werden.",
      3: "Die Standortbestimmung hat zu lange gedauert. Bitte versuchen Sie es erneut."
    };

    locateButton.disabled = false;
    locateButton.removeAttribute("aria-busy");
    setLocationStatus(
      messages[error.code] || "Der Standort konnte nicht ermittelt werden.",
      "error"
    );
  }

  function setLocationStatus(message, state) {
    locationStatus.textContent = message;
    locationStatus.dataset.state = state;
  }

  function zoomForAccuracy(accuracy) {
    if (accuracy > 1000) return 13;
    if (accuracy > 300) return 14;
    if (accuracy > 80) return 15;
    return 17;
  }

  function formatAccuracy(accuracy) {
    if (accuracy >= 1000) {
      return `${(accuracy / 1000).toFixed(1).replace(".", ",")} km`;
    }
    return `${Math.round(accuracy)} m`;
  }

  function escapeHtml(value) {
    const element = document.createElement("span");
    element.textContent = String(value);
    return element.innerHTML;
  }
})();
