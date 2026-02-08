# Paperless-Lexoffice Middleware

<!-- Badges -->
[![Docker](https://img.shields.io/badge/Docker-Ready-2496ED?logo=docker&logoColor=white)](docker-compose.yml)
[![Python](https://img.shields.io/badge/Python-3.12+-3776AB?logo=python&logoColor=white)](backend/pyproject.toml)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](frontend/package.json)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688?logo=fastapi&logoColor=white)](backend/pyproject.toml)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-4169E1?logo=postgresql&logoColor=white)](docker-compose.yml)
[![License: MIT](https://img.shields.io/badge/Lizenz-MIT-yellow.svg)](LICENSE)

> **Eine Docker-basierte Middleware, die [Paperless-ngx](https://docs.paperless-ngx.com/) (Dokumentenmanagement) mit [Lexoffice/Lexware Office](https://www.lexoffice.de/) (Buchhaltung) verbindet.**

Ueber eine grafische Oberflaeche koennen Benutzer Workflows definieren, die Dokumente automatisch zwischen beiden Systemen synchronisieren -- von der Eingangsrechnung bis zur Kontakt-Synchronisation.

---

## Inhaltsverzeichnis

- [Architektur](#architektur)
- [Features](#features)
- [Voraussetzungen](#voraussetzungen)
- [Schnellstart](#schnellstart)
- [Konfiguration](#konfiguration)
- [Entwicklung](#entwicklung)
- [API-Dokumentation](#api-dokumentation)
- [Workflow-Beispiele](#workflow-beispiele)
- [Projektstruktur](#projektstruktur)
- [Beitragen](#beitragen)
- [Lizenz](#lizenz)

---

## Architektur

```mermaid
graph TB
    subgraph "Docker Environment"
        subgraph "Frontend"
            UI["React SPA<br/>Workflow Designer"]
            MV["Mermaid Viewer<br/>Workflow-Visualisierung"]
        end

        subgraph "Backend"
            API["FastAPI<br/>REST API Gateway"]
            WE["Workflow Engine<br/>Regelbasierte Automatisierung"]
            SC["Scheduler<br/>Zeitgesteuerte Jobs"]
        end

        subgraph "Konnektoren"
            PC["Paperless Connector<br/>REST Client"]
            LC["Lexoffice Connector<br/>REST Client"]
        end

        subgraph "Datenhaltung"
            DB[("PostgreSQL<br/>Konfiguration & State")]
            RD[("Redis<br/>Queue & Cache")]
        end

        NG["Nginx<br/>Reverse Proxy"]
    end

    subgraph "Externe Systeme"
        PL["Paperless-ngx<br/>API + Webhooks"]
        LO["Lexoffice<br/>API + Event Subscriptions"]
    end

    NG --> UI
    NG --> API
    UI --> API
    MV --> API
    API --> WE
    API --> SC
    WE --> PC
    WE --> LC
    PC --> PL
    LC --> LO
    PL -->|Webhook| API
    LO -->|Event Callback| API
    API --> DB
    API --> RD
    WE --> DB
    SC --> RD
```

### Komponentenuebersicht

| Komponente | Technologie | Aufgabe |
|---|---|---|
| **Frontend** | React 18 + TypeScript + Vite + Tailwind CSS | Workflow-Designer, Dashboard, Mermaid-Visualisierung |
| **Backend** | Python 3.12 + FastAPI + SQLAlchemy 2.0 | REST API, Workflow Engine, Konnektoren |
| **Datenbank** | PostgreSQL 16 | Konfiguration, Workflows, Mappings, Logs |
| **Cache/Queue** | Redis 7 | Job-Queue (ARQ), Caching, Pub/Sub |
| **Reverse Proxy** | Nginx 1.27 | Routing, Gzip, Security Headers, Rate Limiting |

---

## Features

- **Workflow-Automatisierung** -- Regelbasierte Workflows zwischen Paperless-ngx und Lexoffice
- **Visueller Workflow-Designer** -- Drag & Drop Erstellung von Automatisierungsregeln
- **Mermaid-Visualisierung** -- Echtzeit-Darstellung der Workflow-Logik als Diagramme
- **Bidirektionale Synchronisation** -- Dokumente und Kontakte in beide Richtungen
- **Webhook-Integration** -- Sofortige Reaktion auf Ereignisse in beiden Systemen
- **Zeitgesteuerte Jobs** -- Periodische Synchronisation (z.B. stuendlicher Kontakt-Sync)
- **Verschluesselte Speicherung** -- API-Keys werden mit Fernet in der Datenbank verschluesselt
- **Umfassende Logs** -- Vollstaendige Protokollierung aller Workflow-Ausfuehrungen
- **Docker-basiert** -- Ein-Befehl-Installation mit Docker Compose
- **REST API** -- Vollstaendige API mit automatischer OpenAPI-Dokumentation
- **Erweiterbar** -- Plugin-Interface fuer weitere Konnektoren (DATEV, sevDesk, etc.)

---

## Voraussetzungen

| Software | Mindestversion | Installation |
|---|---|---|
| **Docker** | 24.0+ | [docs.docker.com/get-docker](https://docs.docker.com/get-docker/) |
| **Docker Compose** | 2.20+ (V2) | Enthalten in Docker Desktop / `docker compose` |

> **Hinweis:** Docker Compose V2 ist als `docker compose` (ohne Bindestrich) verfuegbar. Falls du noch V1 verwendest (`docker-compose`), funktioniert das ebenfalls.

---

## Schnellstart

### 1. Repository klonen

```bash
git clone https://github.com/dein-benutzer/paperless-lexoffice-middleware.git
cd paperless-lexoffice-middleware
```

### 2. Umgebungsvariablen konfigurieren

```bash
# Beispiel-Konfiguration kopieren
cp .env.example .env

# Fernet-Schluessel generieren und in .env eintragen
python3 -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"

# Webhook-Secret generieren und in .env eintragen
python3 -c "import secrets; print(secrets.token_urlsafe(32))"
```

Oeffne `.env` und trage mindestens ein:
- `PAPERLESS_TOKEN` -- dein Paperless-ngx API-Token
- `LEXOFFICE_API_KEY` -- dein Lexoffice API-Key
- `ENCRYPTION_KEY` -- den generierten Fernet-Schluessel
- `WEBHOOK_SECRET` -- das generierte Webhook-Secret

### 3. Starten

```bash
docker compose up -d
```

Die Anwendung ist nun erreichbar:

| Dienst | URL |
|---|---|
| **Web-Oberflaeche** | [http://localhost](http://localhost) |
| **API-Dokumentation** | [http://localhost/docs](http://localhost/docs) |
| **Backend direkt** | [http://localhost:8000](http://localhost:8000) |
| **Frontend direkt** | [http://localhost:3000](http://localhost:3000) |

---

## Konfiguration

Alle Einstellungen werden ueber Umgebungsvariablen in der `.env`-Datei gesteuert.

### Datenbank

| Variable | Beschreibung | Standard |
|---|---|---|
| `DATABASE_URL` | PostgreSQL-Verbindungs-URL (asyncpg) | `postgresql+asyncpg://middleware:middleware@db:5432/middleware` |
| `POSTGRES_USER` | PostgreSQL-Benutzername | `middleware` |
| `POSTGRES_PASSWORD` | PostgreSQL-Passwort | `middleware` |
| `POSTGRES_DB` | PostgreSQL-Datenbankname | `middleware` |

### Redis

| Variable | Beschreibung | Standard |
|---|---|---|
| `REDIS_URL` | Redis-Verbindungs-URL | `redis://redis:6379/0` |

### Paperless-ngx

| Variable | Beschreibung | Standard |
|---|---|---|
| `PAPERLESS_URL` | URL der Paperless-ngx-Instanz | `http://paperless:8000` |
| `PAPERLESS_TOKEN` | API-Token aus Paperless-ngx | -- |

### Lexoffice

| Variable | Beschreibung | Standard |
|---|---|---|
| `LEXOFFICE_URL` | Lexoffice API-Basis-URL | `https://api.lexware.io` |
| `LEXOFFICE_API_KEY` | API-Key aus dem Lexoffice Developer Portal | -- |

### Sicherheit

| Variable | Beschreibung | Standard |
|---|---|---|
| `ENCRYPTION_KEY` | Fernet-Schluessel fuer DB-Verschluesselung | -- |
| `WEBHOOK_SECRET` | Secret fuer Webhook-Validierung (HMAC) | -- |

### Anwendung

| Variable | Beschreibung | Standard |
|---|---|---|
| `CORS_ORIGINS` | Erlaubte CORS-Origins (JSON-Array) | `["http://localhost:3000","http://localhost:5173"]` |
| `LOG_LEVEL` | Log-Level (DEBUG, INFO, WARNING, ERROR) | `INFO` |

### Ports (optional)

| Variable | Beschreibung | Standard |
|---|---|---|
| `NGINX_PORT` | Nginx-Port (Hauptzugang) | `80` |
| `BACKEND_PORT` | Backend-Port (direkt) | `8000` |
| `FRONTEND_PORT` | Frontend-Port (direkt) | `3000` |
| `POSTGRES_PORT` | PostgreSQL-Port | `5432` |
| `REDIS_PORT` | Redis-Port | `6379` |

---

## Entwicklung

### Lokales Backend-Setup (ohne Docker)

```bash
cd backend

# Virtuelle Umgebung erstellen
python3.12 -m venv .venv
source .venv/bin/activate

# Abhaengigkeiten installieren (inkl. Dev-Dependencies)
pip install -e ".[dev]"

# Umgebungsvariablen setzen (lokale DB/Redis erforderlich)
export DATABASE_URL="postgresql+asyncpg://middleware:middleware@localhost:5432/middleware"
export REDIS_URL="redis://localhost:6379/0"

# Server starten
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### Lokales Frontend-Setup (ohne Docker)

```bash
cd frontend

# Abhaengigkeiten installieren
npm install

# Entwicklungsserver starten
npm run dev
```

### Nur Infrastruktur mit Docker (DB + Redis)

Fuer lokale Entwicklung mit Backend/Frontend auf dem Host:

```bash
docker compose up -d db redis
```

### Logs anzeigen

```bash
# Alle Dienste
docker compose logs -f

# Nur Backend
docker compose logs -f backend

# Nur bestimmte Anzahl Zeilen
docker compose logs --tail 100 backend
```

### Datenbank zuruecksetzen

```bash
docker compose down -v   # Loescht alle Volumes (Daten gehen verloren!)
docker compose up -d
```

---

## API-Dokumentation

Die API-Dokumentation wird automatisch von FastAPI generiert und ist unter folgenden URLs verfuegbar:

| Format | URL | Beschreibung |
|---|---|---|
| **Swagger UI** | [http://localhost/docs](http://localhost/docs) | Interaktive API-Dokumentation |
| **ReDoc** | [http://localhost/redoc](http://localhost/redoc) | Alternative Darstellung |
| **OpenAPI JSON** | [http://localhost/openapi.json](http://localhost/openapi.json) | Maschinenlesbare Spezifikation |

### Wichtige API-Endpunkte

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/health` | Health Check |
| `GET/POST` | `/api/connectors` | Konnektoren verwalten |
| `POST` | `/api/connectors/{id}/test` | Verbindung testen |
| `GET/POST` | `/api/workflows` | Workflows CRUD |
| `PUT/DELETE` | `/api/workflows/{id}` | Workflow bearbeiten/loeschen |
| `POST` | `/api/workflows/{id}/execute` | Workflow manuell ausfuehren |
| `GET` | `/api/workflows/{id}/mermaid` | Mermaid-Diagramm generieren |
| `POST` | `/api/webhooks/paperless` | Paperless Webhook-Empfaenger |
| `POST` | `/api/webhooks/lexoffice` | Lexoffice Event-Empfaenger |
| `GET` | `/api/mappings/contacts` | Kontakt-Mappings anzeigen |
| `GET` | `/api/logs` | Workflow-Logs abrufen |
| `GET` | `/api/dashboard/stats` | Dashboard-Statistiken |

---

## Workflow-Beispiele

### Eingangsrechnung: Paperless --> Lexoffice

Dokumente, die in Paperless-ngx mit dem Tag "Rechnung" eingehen, werden automatisch als Voucher in Lexoffice erfasst.

```mermaid
sequenceDiagram
    participant S as Scanner/Mail
    participant P as Paperless-ngx
    participant MW as Middleware
    participant L as Lexoffice

    S->>P: Dokument einliefern
    P->>P: OCR & Klassifikation
    P->>MW: Webhook: "Dokument hinzugefuegt"<br/>Tag: "Rechnung"
    MW->>P: Dokument-Details & PDF abrufen
    MW->>MW: Daten extrahieren<br/>(Betrag, Lieferant, Datum)
    MW->>L: Kontakt suchen/anlegen
    MW->>L: Voucher erstellen
    MW->>L: PDF als Beleg anhaengen
    MW->>P: Status-Tag setzen:<br/>"In Lexoffice gebucht"
    MW->>MW: Log: Workflow erfolgreich
```

### Ausgangsrechnung: Lexoffice --> Paperless

Finalisierte Rechnungen aus Lexoffice werden automatisch in Paperless-ngx archiviert.

```mermaid
sequenceDiagram
    participant L as Lexoffice
    participant MW as Middleware
    participant P as Paperless-ngx

    L->>MW: Event: "Rechnung finalisiert"
    MW->>L: Rechnung & PDF abrufen
    MW->>P: Korrespondent suchen/anlegen<br/>(aus Lexoffice-Kontakt)
    MW->>P: Dokument hochladen<br/>mit Metadaten
    MW->>P: Tags setzen:<br/>"Ausgangsrechnung", Jahreszahl
    MW->>P: Custom Fields setzen:<br/>Rechnungsnr, Betrag
    MW->>MW: Log: Archivierung erfolgreich
```

### Kontakt-Synchronisation

Bidirektionale Synchronisation von Kontakten zwischen Paperless-ngx (Korrespondenten) und Lexoffice (Kontakte).

```mermaid
sequenceDiagram
    participant P as Paperless-ngx
    participant MW as Middleware
    participant L as Lexoffice

    Note over MW: Periodischer Sync (z.B. stuendlich)
    MW->>L: Alle Kontakte abrufen
    MW->>P: Alle Korrespondenten abrufen
    MW->>MW: Abgleich & Mapping
    alt Neuer Kontakt in Lexoffice
        MW->>P: Korrespondent anlegen
    end
    alt Neuer Korrespondent in Paperless
        MW->>L: Kontakt anlegen
    end
    MW->>MW: Mapping-Tabelle aktualisieren
```

### Dokumenten-Lifecycle (Gesamtuebersicht)

```mermaid
graph TD
    A[Dokument-Eingang] --> B{Klassifikation}
    B -->|Eingangsrechnung| C["Lexoffice Voucher"]
    B -->|Quittung/Beleg| D["Lexoffice Beleg"]
    B -->|Vertrag| E[Nur Archivierung]
    B -->|Angebot| F["Lexoffice Quotation"]

    C --> G[PDF anhaengen]
    D --> G
    F --> G

    G --> H[Status-Update in Paperless]
    H --> I[Monitoring & Logs]

    J[Lexoffice Event] --> K{Typ}
    K -->|Rechnung erstellt| L["Paperless Archiv"]
    K -->|Kontakt geaendert| M[Korrespondent-Sync]

    L --> N[Tags & Metadaten setzen]
    N --> I
    M --> I
```

---

## Projektstruktur

```
paperless-lexoffice-middleware/
├── docker-compose.yml          # Container-Orchestrierung
├── .env.example                # Vorlage fuer Umgebungsvariablen
├── .gitignore                  # Git-Ausschlussliste
├── .dockerignore               # Docker-Ausschlussliste (Root)
├── README.md                   # Diese Datei
├── PLAN.md                     # Detaillierter Architekturplan
│
├── backend/                    # Python FastAPI Backend
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── pyproject.toml          # Abhaengigkeiten & Projekt-Konfiguration
│   ├── alembic.ini             # Datenbank-Migrationen
│   ├── app/
│   │   ├── main.py             # FastAPI-Anwendung
│   │   ├── config.py           # Einstellungen (Pydantic Settings)
│   │   ├── database.py         # Datenbankverbindung
│   │   ├── api/                # REST-Endpunkte
│   │   ├── connectors/         # API-Clients (Paperless, Lexoffice)
│   │   ├── engine/             # Workflow Engine
│   │   ├── models/             # SQLAlchemy-Modelle
│   │   └── schemas/            # Pydantic-Schemas
│   └── tests/                  # Backend-Tests
│
├── frontend/                   # React TypeScript Frontend
│   ├── Dockerfile
│   ├── .dockerignore
│   ├── package.json            # Abhaengigkeiten
│   ├── tsconfig.json           # TypeScript-Konfiguration
│   ├── vite.config.ts          # Vite Build-Konfiguration
│   ├── public/                 # Statische Dateien
│   └── src/
│       ├── App.tsx             # Haupt-Komponente
│       ├── components/         # UI-Komponenten
│       ├── pages/              # Seiten (Dashboard, Workflows, etc.)
│       └── api/                # API-Client
│
└── nginx/
    └── nginx.conf              # Reverse-Proxy-Konfiguration
```

---

## Beitragen

Beitraege sind willkommen! So kannst du mitmachen:

1. **Fork** erstellen
2. **Feature-Branch** anlegen (`git checkout -b feature/mein-feature`)
3. **Aenderungen committen** (`git commit -m 'Feature: Beschreibung'`)
4. **Branch pushen** (`git push origin feature/mein-feature`)
5. **Pull Request** oeffnen

### Richtlinien

- Code-Stil: Backend folgt [Ruff](https://docs.astral.sh/ruff/), Frontend folgt ESLint
- Tests: Neue Features sollten mit Tests abgedeckt sein
- Commits: Aussagekraeftige Commit-Messages in Deutsch oder Englisch
- Dokumentation: API-Aenderungen in den Docstrings dokumentieren

### Entwicklungsumgebung einrichten

```bash
# Repository klonen
git clone https://github.com/dein-benutzer/paperless-lexoffice-middleware.git
cd paperless-lexoffice-middleware

# Infrastruktur starten
docker compose up -d db redis

# Backend einrichten
cd backend
python3.12 -m venv .venv
source .venv/bin/activate
pip install -e ".[dev]"

# Frontend einrichten
cd ../frontend
npm install

# Backend starten (Terminal 1)
cd backend && uvicorn app.main:app --reload

# Frontend starten (Terminal 2)
cd frontend && npm run dev
```

---

## Lizenz

Dieses Projekt steht unter der [MIT-Lizenz](LICENSE).

```
MIT License

Copyright (c) 2024 Paperless-Lexoffice Middleware

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
