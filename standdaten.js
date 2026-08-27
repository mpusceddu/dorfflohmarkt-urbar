/*
 * Datenmodell:
 * Ein ORT besitzt eine Adresse, Koordinaten, einen Typ und einen oder mehrere Stände.
 *
 * typ:
 * - "privat"       = privates Grundstück mit in der Regel einem Stand
 * - "sammelplatz"  = öffentlicher Ort mit einem oder mehreren Ständen
 *
 * Ein Stand benötigt eine eindeutige nummer.
 * angebot und besonderheiten sind optional.
 *
 * Beispiel für einen Kuchenhinweis:
 * {
 *   nummer: 17,
 *   angebot: "Hausrat und Bücher",
 *   besonderheiten: ["Kuchen"]
 * }
 *
 * Keine unbekannten Standdaten ergänzen. Nummern, Angebote und Besonderheiten
 * werden erst nach Freigabe der endgültigen Liste eingetragen.
 */
const ORTSDATEN = [
  {
    id: "buergerhaus-urbar",
    name: "Bürgerhaus Urbar",
    adresse: "Bornstraße 25, 56182 Urbar",
    typ: "sammelplatz",
    lat: 50.3798707,
    lng: 7.6249404,
    staende: [
      {
        nummer: 1
      }
    ]
  },
  {
    id: "am-rheineck-30",
    adresse: "Am Rheineck 30, 56182 Urbar",
    typ: "privat",
    lat: 50.3780683,
    lng: 7.6222659,
    staende: [
      {
        nummer: 2
      }
    ]
  }
];
