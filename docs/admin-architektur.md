# Architektur der Standverwaltung

## Entscheidung

Die öffentliche Website bleibt als statische GitHub-Pages-Seite unter
`https://dorfflohmarkt-urbar.de/` bestehen. Die veröffentlichten Stände liegen
ausschließlich in `data/staende.json`.

Die Redaktion wird als getrennte Cloudflare-Worker-Anwendung betrieben. Die
Anmeldung erfolgt über Cloudflare Access mit individuellen, freigegebenen
E-Mail-Adressen und zeitlich begrenzten Sitzungen. Redakteure benötigen weder
GitHub- noch Cloudflare-Zugang.

## Komponenten

- **GitHub Pages:** öffentliche Website und öffentliche JSON-Daten
- **Cloudflare Worker:** Admin-Oberfläche und serverseitige API
- **Cloudflare Access:** Anmeldung und E-Mail-Freigaben
- **Cloudflare D1:** Entwürfe, Benutzerrollen, Veröffentlichungsprotokoll und
  begrenzte Rate-Limits
- **GitHub App:** schreibt ausschließlich in das Repository
  `mpusceddu/dorfflohmarkt-urbar`

Ein eng begrenzter Fine-grained Personal Access Token kann ersatzweise als
serverseitiges Secret verwendet werden. Er ist nicht die bevorzugte Lösung.

## Sicherheitsgrenze

Der Zielpfad `data/staende.json` ist im Worker fest programmiert. Die API nimmt
keinen Repositorynamen, Branch oder Dateipfad vom Browser entgegen. Vor jeder
Veröffentlichung werden alle Datensätze serverseitig erneut validiert.

Secrets liegen ausschließlich in Cloudflare Worker Secrets. Das öffentliche
Repository, die Admin-Dateien und Browserantworten enthalten keine Schlüssel.

## Rollen

- **Redaktion:** Entwurf lesen und bearbeiten, Vorschau, Import und Export
- **Veröffentlichen:** zusätzlich geprüfte Entwürfe veröffentlichen
- **Administration:** zusätzlich Benutzer freischalten und sperren

## Datenfluss

1. Die Redaktion meldet sich über Cloudflare Access an.
2. Änderungen werden als Entwurf in D1 gespeichert.
3. Browser und Server validieren die Daten unabhängig voneinander.
4. Eine Vorschau zeigt Liste, Marker, Zähler und Fehler.
5. Eine berechtigte Person bestätigt die Veröffentlichungszusammenfassung.
6. Der Worker schreibt nur `data/staende.json` über die GitHub-API.
7. GitHub Pages veröffentlicht den neuen Commit.
8. D1 protokolliert Benutzerkennung, Zeitpunkt, betroffene Standnummern,
   Ergebnis und Commit-ID.

## Geocodierung

Adressabfragen laufen ausschließlich über das Backend. Sie werden einzeln
ausgelöst, begrenzt und zwischengespeichert. Koordinaten bleiben manuell
korrigierbar. Der konkrete Geocoding-Dienst wird erst nach Prüfung seiner
Nutzungsbedingungen aktiviert.

## Datenschutz

In das öffentliche Repository gelangen nur freigegebene Standnummern,
Adressen, Angebote, Koordinaten, Status und zur Darstellung erforderliche
Standortangaben. Kontaktdaten und interne Notizen sind im öffentlichen Schema
technisch nicht zulässig.
