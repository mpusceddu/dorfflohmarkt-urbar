/*
 * Datenmodell:
 * Ein ORT besitzt eine Adresse, Koordinaten, einen Typ und einen oder mehrere Stände.
 *
 * typ:
 * - "privat"    = privates Grundstück mit in der Regel einem Stand
 * - "mehrfach"  = öffentlicher Standort mit einem oder mehreren Ständen
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
    typ: "mehrfach",
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

/*
 * Orientierungspunkte werden unabhängig von den Flohmarktständen gepflegt.
 * Sie besitzen keine Standnummer und werden deshalb nicht zu den 82 Ständen
 * hinzugerechnet.
 *
 * typ:
 * - "verpflegung" = Foodstation oder anderer Versorgungspunkt
 * - "parkplatz"   = ausgewiesene Parkmöglichkeit
 */
const SERVICEPUNKTE = [
  {
    id: "foodstation-kita-peter-und-paul",
    name: "Foodstation",
    adresse: "Katholische Kita St. Peter und Paul, In den Büngerten 8, 56182 Urbar",
    typ: "verpflegung",
    lat: 50.3814375,
    lng: 7.6239305
  },
  {
    id: "parkplatz-besselicher-feld",
    name: "Parkplatz Besselicher Feld",
    adresse: "Urbarer Straße, 56182 Urbar",
    typ: "parkplatz",
    lat: 50.3849445,
    lng: 7.6230661
  },
  {
    id: "parkplatz-friedhof",
    name: "Parkplatz Friedhof",
    adresse: "Arenberger Straße / In der Hohl, 56182 Urbar",
    typ: "parkplatz",
    lat: 50.3784206,
    lng: 7.6270259
  },
  {
    id: "parkplatz-alter-kirchplatz",
    name: "Parkplatz Alter Kirchplatz",
    adresse: "Alter Kirchplatz / Hauptstraße, 56182 Urbar",
    typ: "parkplatz",
    lat: 50.3810522,
    lng: 7.6227592
  }
];
