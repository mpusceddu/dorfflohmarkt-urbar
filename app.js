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
  const bounds = [];

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
          iconSize: [32, 32],
          iconAnchor: [16, 16]
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

  function escapeHtml(value) {
    const element = document.createElement("span");
    element.textContent = String(value);
    return element.innerHTML;
  }
})();
