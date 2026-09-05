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
  const searchInput = document.querySelector("#stand-search");
  const searchStatus = document.querySelector("#search-status");
  const printMapButton = document.querySelector("#print-map-button");
  const photoConfig = window.FOTO_UPLOAD_CONFIG || {};
  const standAccordion = document.querySelector(".map-accordion");
  const bounds = [];
  const standLayer = L.layerGroup().addTo(map);
  const locationEntries = [];
  let userMarker = null;
  let accuracyCircle = null;
  let printAccordionState = [];

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

  const locationMarkerOffsets = getOverlappingLocationOffsets(locations);

  locations.forEach((location, locationIndex) => {
    const standCount = location.staende.length;
    const isGroup = standCount > 1;
    const markerText = isGroup ? `${standCount}×` : location.staende[0].nummer;
    const locationName = location.name || location.adresse;
    const typeLabel = getLocationTypeLabel(location, standCount);
    const markerOffset = locationMarkerOffsets[locationIndex];

    const icon = L.divIcon({
      className: "",
      html: `<span class="marker-number${isGroup ? " marker-group" : ""}" aria-hidden="true">${markerText}</span>`,
      iconSize: [38, 38],
      iconAnchor: [19 - markerOffset.x, 19 - markerOffset.y]
    });

    const marker = L.marker([location.lat, location.lng], {
      icon,
      title: isGroup
        ? `${locationName}: ${standCount} Stände`
        : `Stand ${location.staende[0].nummer}: ${locationName}`
    });

    marker.bindPopup(renderLocationPopup(location, typeLabel));
    bounds.push([location.lat, location.lng]);

    const item = document.createElement("li");
    item.className = "location-card";
    item.tabIndex = 0;
    item.innerHTML = renderLocationCard(location, typeLabel);

    const entry = { location, marker, item, typeLabel };
    locationEntries.push(entry);

    const openMarker = () => {
      showLocation(entry);
    };

    item.addEventListener("click", (event) => {
      if (event.target.closest("a")) return;
      openMarker();
    });
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
      `${totalStands} Stände an ${locations.length} ${locations.length === 1 ? "Ort" : "Orten"} · ${servicePoints.length} Orientierungspunkte`;
  }

  if (bounds.length > 1) {
    map.fitBounds(bounds, { padding: [40, 40] });
  } else if (bounds.length === 1) {
    map.setView(bounds[0], 17);
  }

  renderStandMarkers();
  map.on("zoomend", renderStandMarkers);
  loadApprovedPhotos();

  searchInput.addEventListener("input", applySearch);
  searchInput.addEventListener("search", applySearch);
  printMapButton.addEventListener("click", () => {
    preparePrint();
    window.setTimeout(() => window.print(), 150);
  });
  window.addEventListener("beforeprint", preparePrint);
  window.addEventListener("afterprint", restoreAfterPrint);

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

  function renderStandMarkers() {
    standLayer.clearLayers();
    const visibleEntries = locationEntries.filter((entry) => !entry.item.hidden);
    const zoom = map.getZoom();

    if (zoom >= 16 || visibleEntries.length <= 8) {
      visibleEntries.forEach((entry) => entry.marker.addTo(standLayer));
      return;
    }

    const cellSize = zoom <= 13 ? 120 : zoom === 14 ? 90 : 70;
    const clusters = new Map();

    visibleEntries.forEach((entry) => {
      const point = map.project([entry.location.lat, entry.location.lng], zoom);
      const key = `${Math.floor(point.x / cellSize)},${Math.floor(point.y / cellSize)}`;
      if (!clusters.has(key)) clusters.set(key, []);
      clusters.get(key).push(entry);
    });

    clusters.forEach((entries) => {
      if (entries.length === 1) {
        entries[0].marker.addTo(standLayer);
        return;
      }

      const standCount = entries.reduce(
        (total, entry) => total + entry.location.staende.length,
        0
      );
      const center = entries.reduce(
        (result, entry) => [
          result[0] + entry.location.lat / entries.length,
          result[1] + entry.location.lng / entries.length
        ],
        [0, 0]
      );
      const icon = L.divIcon({
        className: "",
        html: `<span class="marker-cluster" aria-hidden="true">${standCount}</span>`,
        iconSize: [48, 48],
        iconAnchor: [24, 24]
      });
      const clusterMarker = L.marker(center, {
        icon,
        title: `${standCount} Stände in diesem Bereich`
      }).addTo(standLayer);

      clusterMarker.on("click", () => {
        map.setView(center, Math.min(17, zoom + 2));
      });
    });
  }

  function applySearch() {
    const query = searchInput.value.trim().toLocaleLowerCase("de-DE");
    const numericQuery = /^\d+$/.test(query) ? Number(query) : null;
    let matchingStands = 0;
    let matchingLocations = 0;

    locationEntries.forEach((entry) => {
      const location = entry.location;
      const matches = query === "" || (numericQuery !== null
        ? location.staende.some((stand) => stand.nummer === numericQuery)
        : `${location.name || ""} ${location.adresse}`
            .toLocaleLowerCase("de-DE")
            .includes(query));

      entry.item.hidden = !matches;
      if (matches) {
        matchingLocations += 1;
        matchingStands += numericQuery !== null
          ? location.staende.filter((stand) => stand.nummer === numericQuery).length
          : location.staende.length;
      }
    });

    if (query === "") {
      searchStatus.textContent = `Alle ${totalStands} Stände werden angezeigt.`;
    } else if (matchingStands === 0) {
      searchStatus.textContent = "Kein passender Stand gefunden.";
    } else {
      searchStatus.textContent = `${matchingStands} ${matchingStands === 1 ? "Stand" : "Stände"} an ${matchingLocations} ${matchingLocations === 1 ? "Ort" : "Orten"} gefunden.`;
      standAccordion.open = true;
    }

    renderStandMarkers();

    const visibleEntries = locationEntries.filter((entry) => !entry.item.hidden);
    if (query && visibleEntries.length === 1) {
      showLocation(visibleEntries[0]);
    }
  }

  function showLocation(entry) {
    map.setView(entry.marker.getLatLng(), 17);
    renderStandMarkers();
    window.setTimeout(() => entry.marker.openPopup(), 0);
  }

  function preparePrint() {
    const accordions = [...document.querySelectorAll(".map-accordion")];
    if (printAccordionState.length === 0) {
      printAccordionState = accordions.map((details) => details.open);
    }
    accordions.forEach((details) => { details.open = true; });
    map.invalidateSize();
  }

  function restoreAfterPrint() {
    const accordions = [...document.querySelectorAll(".map-accordion")];
    accordions.forEach((details, index) => {
      details.open = printAccordionState[index] ?? details.open;
    });
    printAccordionState = [];
    map.invalidateSize();
  }

  function isValidStand(stand) {
    return (
      stand &&
      Number.isInteger(stand.nummer) &&
      stand.nummer >= 1 &&
      stand.nummer <= 91
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

  function getOverlappingLocationOffsets(items) {
    const groups = new Map();

    items.forEach((location, index) => {
      const key = `${location.lat.toFixed(6)},${location.lng.toFixed(6)}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(index);
    });

    const offsets = items.map(() => ({ x: 0, y: 0 }));

    groups.forEach((indices) => {
      if (indices.length < 2) return;

      const spacing = 44;
      indices.forEach((itemIndex, groupIndex) => {
        offsets[itemIndex] = {
          x: (groupIndex - (indices.length - 1) / 2) * spacing,
          y: 0
        };
      });
    });

    return offsets;
  }

  function getLocationTypeLabel(location, standCount) {
    if (standCount > 1) return "Standort mit mehreren Ständen";
    if (location.typ === "privat") return "Privatadresse";
    return "Öffentlicher Standort";
  }

  function renderLocationPopup(location, typeLabel, imageUrl = "") {
    const heading = location.name || location.adresse;
    const stands = location.staende
      .map((stand) => `<li>${renderStand(stand, false)}</li>`)
      .join("");

    return [
      `<div class="location-popup">`,
      `<strong class="location-popup-title">${escapeHtml(heading)}</strong>`,
      location.name ? `<span>${escapeHtml(location.adresse)}</span>` : "",
      `<span class="place-type place-type-${location.typ === "mehrfach" ? "group" : "private"}">${typeLabel} · ${location.staende.length} ${location.staende.length === 1 ? "Stand" : "Stände"}</span>`,
      `<ul class="popup-stands">${stands}</ul>`,
      imageUrl ? `<img class="stand-photo stand-photo-popup" src="${escapeHtml(imageUrl)}" alt="Standfoto für ${escapeHtml(heading)}">` : "",
      renderLocationActions(location),
      `</div>`
    ].join("");
  }

  function renderLocationCard(location, typeLabel) {
    const heading = location.name || location.adresse;
    const stands = location.staende
      .map((stand) => `<li>${renderStand(stand, true)}</li>`)
      .join("");

    return [
      `<div class="location-card-heading">`,
      `<strong>${escapeHtml(heading)}</strong>`,
      `<span class="place-type place-type-${location.typ === "mehrfach" ? "group" : "private"}">${typeLabel} · ${location.staende.length} ${location.staende.length === 1 ? "Stand" : "Stände"}</span>`,
      `</div>`,
      location.name ? `<span class="location-address">${escapeHtml(location.adresse)}</span>` : "",
      `<ul class="location-stands">${stands}</ul>`,
      renderLocationActions(location)
    ].join("");
  }

  function renderStand(stand) {
    return `<span class="stand-line"><strong>Stand ${stand.nummer}</strong></span>`;
  }

  function renderLocationActions(location) {
    return [
      `<div class="location-actions">`,
      `<a class="location-action" href="${escapeHtml(getRouteUrl(location))}" target="_blank" rel="noopener">Route starten</a>`,
      `<a class="location-action location-action-photo" href="foto.html?ort=${encodeURIComponent(location.id)}">Foto hochladen</a>`,
      `</div>`
    ].join("");
  }

  async function loadApprovedPhotos() {
    if (!photoConfig.apiUrl) return;

    try {
      const apiUrl = photoConfig.apiUrl.replace(/\/$/, "");
      const response = await fetch(`${apiUrl}/api/photos`, {
        headers: { "Accept": "application/json" }
      });
      if (!response.ok) return;
      const result = await response.json();
      const approvedIds = new Set(Array.isArray(result.locationIds) ? result.locationIds : []);

      locationEntries.forEach((entry) => {
        if (!approvedIds.has(entry.location.id)) return;
        const imageUrl = `${apiUrl}/api/photos/${encodeURIComponent(entry.location.id)}`;
        const image = document.createElement("img");
        image.className = "stand-photo";
        image.src = imageUrl;
        image.alt = `Standfoto für ${entry.location.name || entry.location.adresse}`;
        image.loading = "lazy";
        const actions = entry.item.querySelector(".location-actions");
        entry.item.insertBefore(image, actions);
        entry.marker.setPopupContent(renderLocationPopup(entry.location, entry.typeLabel, imageUrl));
      });
    } catch {
      // Die Karte bleibt auch dann vollständig nutzbar, wenn der Fotodienst ausfällt.
    }
  }

  function getRouteUrl(location) {
    const destination = `${location.lat},${location.lng}`;
    const useAppleMaps = /iPad|iPhone|iPod|Macintosh/.test(navigator.userAgent);
    return useAppleMaps
      ? `https://maps.apple.com/?daddr=${destination}&dirflg=w`
      : `https://www.google.com/maps/dir/?api=1&destination=${destination}&travelmode=walking`;
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
