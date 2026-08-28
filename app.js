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
  const serviceList = document.querySelector("#service-list");
  const emptyMessage = document.querySelector("#empty-message");
  const count = document.querySelector("#stand-count");
  const locateButton = document.querySelector("#locate-button");
  const locationStatus = document.querySelector("#location-status");
  const bounds = [];
  let userMarker = null;
  let accuracyCircle = null;

  const locations = Array.isArray(ORTSDATEN)
    ? ORTSDATEN
        .map((location) => ({
          ...location,
          staende: Array.isArray(location.staende)
            ? location.staende.filter(isValidStand)
            : []
        }))
        .filter((location) =>
          typeof location.adresse === "string" &&
          location.adresse.trim() !== "" &&
          Number.isFinite(location.lat) &&
          Number.isFinite(location.lng) &&
          location.staende.length > 0
        )
        .sort((a, b) => a.staende[0].nummer - b.staende[0].nummer)
    : [];

  const servicePoints = Array.isArray(SERVICEPUNKTE)
    ? SERVICEPUNKTE.filter(isValidServicePoint)
    : [];

  locations.forEach((location) => {
    const standCount = location.staende.length;
    const isGroup = standCount > 1;
    const markerText = isGroup ? `${standCount}×` : location.staende[0].nummer;
    const locationName = location.name || location.adresse;
    const typeLabel = getLocationTypeLabel(location, standCount);

    const icon = L.divIcon({
      className: "",
      html: `<span class="marker-number${isGroup ? " marker-group" : ""}" aria-hidden="true">${markerText}</span>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    const marker = L.marker([location.lat, location.lng], {
      icon,
      title: isGroup
        ? `${locationName}: ${standCount} Stände`
        : `Stand ${location.staende[0].nummer}: ${locationName}`
    }).addTo(map);

    marker.bindPopup(renderLocationPopup(location, typeLabel));
    bounds.push([location.lat, location.lng]);

    const item = document.createElement("li");
    item.className = "location-card";
    item.tabIndex = 0;
    item.innerHTML = renderLocationCard(location, typeLabel);

    const openMarker = () => {
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

  servicePoints.forEach((servicePoint) => {
    const isParking = servicePoint.typ === "parkplatz";
    const typeLabel = isParking ? "Parkplatz" : "Foodstation";
    const symbol = isParking ? "P" : "☕";

    const icon = L.divIcon({
      className: "",
      html: `<span class="service-marker service-marker-${servicePoint.typ}" aria-hidden="true">${symbol}</span>`,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    const marker = L.marker([servicePoint.lat, servicePoint.lng], {
      icon,
      title: `${typeLabel}: ${servicePoint.name}`
    }).addTo(map);

    marker.bindPopup(renderServicePopup(servicePoint, typeLabel));
    bounds.push([servicePoint.lat, servicePoint.lng]);

    const item = document.createElement("li");
    item.className = "service-card";
    item.tabIndex = 0;
    item.innerHTML = renderServiceCard(servicePoint, typeLabel, symbol);

    const openMarker = () => {
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

    serviceList.append(item);
  });

  const totalStands = locations.reduce(
    (total, location) => total + location.staende.length,
    0
  );

  if (totalStands > 0) {
    emptyMessage.hidden = true;
    count.textContent =
      `${totalStands} von 82 Ständen an ${locations.length} ${locations.length === 1 ? "Ort" : "Orten"} eingetragen · ${servicePoints.length} Orientierungspunkte`;
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

  function isValidStand(stand) {
    return (
      stand &&
      Number.isInteger(stand.nummer) &&
      stand.nummer >= 1 &&
      stand.nummer <= 82
    );
  }

  function isValidServicePoint(servicePoint) {
    return (
      servicePoint &&
      typeof servicePoint.name === "string" &&
      servicePoint.name.trim() !== "" &&
      typeof servicePoint.adresse === "string" &&
      servicePoint.adresse.trim() !== "" &&
      ["verpflegung", "parkplatz"].includes(servicePoint.typ) &&
      Number.isFinite(servicePoint.lat) &&
      Number.isFinite(servicePoint.lng)
    );
  }

  function getLocationTypeLabel(location, standCount) {
    if (standCount > 1) return "Standort mit mehreren Ständen";
    if (location.typ === "privat") return "Privatadresse";
    return "Öffentlicher Standort";
  }

  function renderLocationPopup(location, typeLabel) {
    const heading = location.name || location.adresse;
    const stands = location.staende
      .map((stand) => `<li>${renderStand(stand)}</li>`)
      .join("");

    return [
      `<div class="location-popup">`,
      `<strong class="location-popup-title">${escapeHtml(heading)}</strong>`,
      location.name ? `<span>${escapeHtml(location.adresse)}</span>` : "",
      `<span class="place-type place-type-${location.typ === "mehrfach" ? "group" : "private"}">${typeLabel} · ${location.staende.length} ${location.staende.length === 1 ? "Stand" : "Stände"}</span>`,
      `<ul class="popup-stands">${stands}</ul>`,
      `</div>`
    ].join("");
  }

  function renderLocationCard(location, typeLabel) {
    const heading = location.name || location.adresse;
    const stands = location.staende
      .map((stand) => `<li>${renderStand(stand)}</li>`)
      .join("");

    return [
      `<div class="location-card-heading">`,
      `<strong>${escapeHtml(heading)}</strong>`,
      `<span class="place-type place-type-${location.typ === "mehrfach" ? "group" : "private"}">${typeLabel} · ${location.staende.length} ${location.staende.length === 1 ? "Stand" : "Stände"}</span>`,
      `</div>`,
      location.name ? `<span class="location-address">${escapeHtml(location.adresse)}</span>` : "",
      `<ul class="location-stands">${stands}</ul>`
    ].join("");
  }

  function renderStand(stand) {
    const features = Array.isArray(stand.besonderheiten)
      ? stand.besonderheiten
      : [];
    const badges = features
      .map((feature) => {
        const cakeClass = feature.toLowerCase() === "kuchen" ? " feature-cake" : "";
        return `<span class="feature-badge${cakeClass}">${escapeHtml(feature)}</span>`;
      })
      .join("");

    return [
      `<span class="stand-line"><strong>Stand ${stand.nummer}</strong>`,
      stand.angebot ? `<span class="stand-offer">${escapeHtml(stand.angebot)}</span>` : "",
      badges ? `<span class="feature-list">${badges}</span>` : "",
      `</span>`
    ].join("");
  }

  function renderServicePopup(servicePoint, typeLabel) {
    return [
      `<div class="location-popup service-popup">`,
      `<strong class="location-popup-title">${escapeHtml(servicePoint.name)}</strong>`,
      `<span>${escapeHtml(servicePoint.adresse)}</span>`,
      `<span class="service-type service-type-${servicePoint.typ}">${typeLabel}</span>`,
      `</div>`
    ].join("");
  }

  function renderServiceCard(servicePoint, typeLabel, symbol) {
    return [
      `<span class="service-card-symbol service-card-symbol-${servicePoint.typ}" aria-hidden="true">${symbol}</span>`,
      `<span class="service-card-copy">`,
      `<strong>${escapeHtml(servicePoint.name)}</strong>`,
      `<span>${escapeHtml(servicePoint.adresse)}</span>`,
      `<span class="service-type service-type-${servicePoint.typ}">${typeLabel}</span>`,
      `</span>`
    ].join("");
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
    const isAppleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isChromeOnApple = /CriOS/.test(navigator.userAgent);
    const isAndroid = /Android/.test(navigator.userAgent);
    const permissionDeniedMessage = isAppleMobile
      ? isChromeOnApple
        ? "Standortzugriff ist ausgeschaltet. Prüfen Sie zuerst: Einstellungen → Datenschutz & Sicherheit → Ortungsdienste → Ein. Danach: Einstellungen → Apps → Chrome → Standort → Beim Verwenden der App. Kehren Sie anschließend zur Karte zurück."
        : "Standortzugriff ist ausgeschaltet. Prüfen Sie zuerst: Einstellungen → Datenschutz & Sicherheit → Ortungsdienste → Ein. Danach: Einstellungen → Apps → Safari → Standort → Fragen oder Erlauben. Kehren Sie anschließend zur Karte zurück."
      : isAndroid
        ? "Standortzugriff ist ausgeschaltet. Öffnen Sie: Einstellungen → Standort → Standort verwenden. Prüfen Sie danach in Chrome: ⋮ → Einstellungen → Website-Einstellungen → Standort. Kehren Sie anschließend zur Karte zurück."
        : "Standortzugriff ist blockiert. Bitte aktivieren Sie die Ortungsdienste Ihres Geräts und erlauben Sie anschließend den Standortzugriff in den Website-Einstellungen Ihres Browsers.";
    const messages = {
      1: permissionDeniedMessage,
      2: "Der Standort konnte gerade nicht ermittelt werden.",
      3: "Die Standortbestimmung hat zu lange gedauert. Bitte versuchen Sie es erneut."
    };

    locateButton.disabled = false;
    locateButton.removeAttribute("aria-busy");
    if (error.code === 1) {
      locateButton.innerHTML =
        '<span class="location-symbol" aria-hidden="true">◎</span> Standort erneut versuchen';
    }
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
