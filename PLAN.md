# Paperless-Lexoffice Middleware – Architekturplan

> **Motto:** Einmal planen, einmal bauen, einmal fertig.

## 1. Vision

Eine Docker-basierte Middleware, die **Paperless-ngx** (Dokumentenmanagement) mit **Lexoffice/Lexware Office** (Buchhaltung) verbindet. Über eine grafische Oberfläche können Benutzer Workflows definieren, die Dokumente automatisch zwischen beiden Systemen synchronisieren.

**Kommerzielle Eignung:** Modularer Aufbau mit austauschbaren Konnektoren – weitere Systeme (DATEV, sevDesk, etc.) können als Plugins hinzugefügt werden.

---

## 2. Systemarchitektur

```mermaid
graph TB
    subgraph "Docker Environment"
        subgraph "Frontend"
            UI[React SPA<br/>Workflow Designer]
            MV[Mermaid Viewer<br/>Workflow Visualisierung]
        end

        subgraph "Backend"
            API[FastAPI<br/>REST API Gateway]
            WE[Workflow Engine<br/>Regelbasierte Automatisierung]
            SC[Scheduler<br/>Zeitgesteuerte Jobs]
        end

        subgraph "Konnektoren"
            PC[Paperless Connector<br/>REST Client]
            LC[Lexoffice Connector<br/>REST Client]
        end

        subgraph "Datenhaltung"
            DB[(PostgreSQL<br/>Konfiguration & State)]
            RD[(Redis<br/>Queue & Cache)]
        end
    end

    subgraph "Externe Systeme"
        PL[Paperless-ngx<br/>API + Webhooks]
        LO[Lexoffice<br/>API + Event Subscriptions]
    end

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

---

## 3. Komponentenübersicht

```mermaid
graph LR
    subgraph "Kern-Module"
        A[API Gateway] --> B[Auth & Config]
        A --> C[Workflow Engine]
        A --> D[Webhook Receiver]
        C --> E[Action Runner]
        E --> F[Konnektoren]
    end

    subgraph "Konnektoren"
        F --> G[Paperless Client]
        F --> H[Lexoffice Client]
        F --> I[Plugin Interface<br/>für Erweiterungen]
    end

    subgraph "Frontend"
        J[Dashboard] --> K[Workflow Designer]
        J --> L[Mermaid Viewer]
        J --> M[Log & Monitoring]
        J --> N[Einstellungen]
    end
```

---

## 4. Workflow-Ideen

### 4.1 Eingangsrechnung: Paperless → Lexoffice

```mermaid
sequenceDiagram
    participant S as Scanner/Mail
    participant P as Paperless-ngx
    participant MW as Middleware
    participant L as Lexoffice

    S->>P: Dokument einliefern
    P->>P: OCR & Klassifikation
    P->>MW: Webhook: "Dokument hinzugefügt"<br/>Tag: "Rechnung"
    MW->>P: Dokument-Details & PDF abrufen
    MW->>MW: Daten extrahieren<br/>(Betrag, Lieferant, Datum)
    MW->>L: Kontakt suchen/anlegen
    MW->>L: Voucher erstellen
    MW->>L: PDF als Beleg anhängen
    MW->>P: Status-Tag setzen:<br/>"In Lexoffice gebucht"
    MW->>MW: Log: Workflow erfolgreich
```

### 4.2 Ausgangsrechnung: Lexoffice → Paperless

```mermaid
sequenceDiagram
    participant L as Lexoffice
    participant MW as Middleware
    participant P as Paperless-ngx

    L->>MW: Event: "Rechnung finalisiert"
    MW->>L: Rechnung & PDF abrufen
    MW->>P: Korrespondent suchen/anlegen<br/>(aus Lexoffice-Kontakt)
    MW->>P: Dokument hochladen<br/>mit Metadaten
    MW->>P: Tags setzen:<br/>"Ausgangsrechnung", "2024"
    MW->>P: Custom Fields setzen:<br/>Rechnungsnr, Betrag
    MW->>MW: Log: Archivierung erfolgreich
```

### 4.3 Kontakt-Synchronisation

```mermaid
sequenceDiagram
    participant P as Paperless-ngx
    participant MW as Middleware
    participant L as Lexoffice

    Note over MW: Periodischer Sync (z.B. stündlich)
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

### 4.4 Belegerfassung: Quittungen & Belege

```mermaid
sequenceDiagram
    participant U as Benutzer
    participant P as Paperless-ngx
    participant MW as Middleware
    participant L as Lexoffice

    U->>P: Quittung scannen/fotografieren
    P->>P: OCR-Verarbeitung
    P->>MW: Webhook: Tag "Beleg"
    MW->>P: Dokument abrufen
    MW->>MW: Betrag & Kategorie erkennen
    MW->>L: Voucher erstellen<br/>(Kategorie: Bewirtung/Reise/etc.)
    MW->>L: Beleg-PDF anhängen
    MW->>P: Tag: "Gebucht" setzen
```

### 4.5 Dokumenten-Lifecycle (Gesamtübersicht)

```mermaid
graph TD
    A[Dokument eingang] --> B{Klassifikation}
    B -->|Eingangsrechnung| C[→ Lexoffice Voucher]
    B -->|Quittung/Beleg| D[→ Lexoffice Beleg]
    B -->|Vertrag| E[→ Nur Archivierung]
    B -->|Angebot| F[→ Lexoffice Quotation]

    C --> G[PDF anhängen]
    D --> G
    F --> G

    G --> H[Status-Update in Paperless]
    H --> I[Monitoring & Logs]

    J[Lexoffice Event] --> K{Typ}
    K -->|Rechnung erstellt| L[→ Paperless Archiv]
    K -->|Kontakt geändert| M[→ Korrespondent sync]

    L --> N[Tags & Metadaten setzen]
    N --> I
    M --> I
```

---

## 5. Datenmodell

```mermaid
erDiagram
    WORKFLOW {
        uuid id PK
        string name
        string description
        string mermaid_definition
        boolean enabled
        datetime created_at
        datetime updated_at
    }

    TRIGGER {
        uuid id PK
        uuid workflow_id FK
        string source "paperless|lexoffice|schedule"
        string event_type
        json conditions
        int sort_order
    }

    ACTION {
        uuid id PK
        uuid workflow_id FK
        string target "paperless|lexoffice"
        string action_type
        json parameters
        int sort_order
    }

    CONNECTOR_CONFIG {
        uuid id PK
        string connector_type "paperless|lexoffice"
        string base_url
        string api_key_encrypted
        json settings
        boolean active
    }

    CONTACT_MAPPING {
        uuid id PK
        string paperless_correspondent_id
        string lexoffice_contact_id
        datetime last_synced
    }

    WORKFLOW_LOG {
        uuid id PK
        uuid workflow_id FK
        string status "success|error|skipped"
        json input_data
        json output_data
        string error_message
        datetime executed_at
    }

    WORKFLOW ||--o{ TRIGGER : "hat"
    WORKFLOW ||--o{ ACTION : "hat"
    WORKFLOW ||--o{ WORKFLOW_LOG : "erzeugt"
```

---

## 6. Tech-Stack

| Komponente | Technologie | Begründung |
|---|---|---|
| **Backend** | Python 3.12 + FastAPI | Async-fähig, gut dokumentiert, Industrie-Standard |
| **Frontend** | React 18 + TypeScript + Vite | Schnell, typsicher, großes Ökosystem |
| **Workflow-Visualisierung** | Mermaid.js | Deklarativ, vielseitig, in Frontend integrierbar |
| **Datenbank** | PostgreSQL 16 | Robust, JSON-Support, produktionsreif |
| **Queue/Cache** | Redis 7 | Job-Queue für async Workflows, Caching |
| **Task Queue** | Celery / ARQ | Hintergrund-Verarbeitung der Workflows |
| **ORM** | SQLAlchemy 2.0 + Alembic | Migration-Support, async-kompatibel |
| **Container** | Docker + Docker Compose | Einfache Installation, reproduzierbar |
| **API Docs** | Swagger/OpenAPI (auto) | FastAPI generiert automatisch |

---

## 7. Projektstruktur

```
paperless-lexoffice-middleware/
├── docker-compose.yml
├── .env.example
├── README.md
├── PLAN.md
│
├── backend/
│   ├── Dockerfile
│   ├── pyproject.toml
│   ├── alembic.ini
│   ├── alembic/
│   │   └── versions/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                    # FastAPI App
│   │   ├── config.py                  # Settings
│   │   ├── database.py                # DB Connection
│   │   │
│   │   ├── api/                       # REST Endpoints
│   │   │   ├── __init__.py
│   │   │   ├── workflows.py
│   │   │   ├── connectors.py
│   │   │   ├── webhooks.py
│   │   │   ├── mappings.py
│   │   │   └── logs.py
│   │   │
│   │   ├── connectors/                # API-Clients
│   │   │   ├── __init__.py
│   │   │   ├── base.py                # Abstract Connector
│   │   │   ├── paperless.py           # Paperless Client
│   │   │   └── lexoffice.py           # Lexoffice Client
│   │   │
│   │   ├── engine/                    # Workflow Engine
│   │   │   ├── __init__.py
│   │   │   ├── executor.py            # Workflow Runner
│   │   │   ├── triggers.py            # Trigger Handler
│   │   │   ├── actions.py             # Action Handler
│   │   │   └── scheduler.py           # Cron/Schedule
│   │   │
│   │   ├── models/                    # SQLAlchemy Models
│   │   │   ├── __init__.py
│   │   │   ├── workflow.py
│   │   │   ├── connector.py
│   │   │   ├── mapping.py
│   │   │   └── log.py
│   │   │
│   │   └── schemas/                   # Pydantic Schemas
│   │       ├── __init__.py
│   │       ├── workflow.py
│   │       ├── connector.py
│   │       └── common.py
│   │
│   └── tests/
│       ├── __init__.py
│       ├── test_connectors.py
│       └── test_workflows.py
│
├── frontend/
│   ├── Dockerfile
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   ├── index.html
│   ├── public/
│   └── src/
│       ├── main.tsx
│       ├── App.tsx
│       ├── api/                       # API Client
│       │   └── client.ts
│       ├── components/
│       │   ├── Layout.tsx
│       │   ├── MermaidViewer.tsx       # Mermaid Renderer
│       │   ├── WorkflowDesigner.tsx
│       │   └── WorkflowCard.tsx
│       ├── pages/
│       │   ├── Dashboard.tsx
│       │   ├── Workflows.tsx
│       │   ├── Connections.tsx
│       │   └── Logs.tsx
│       └── styles/
│           └── globals.css
│
└── nginx/
    └── nginx.conf
```

---

## 8. API-Endpunkte (Middleware)

| Methode | Pfad | Beschreibung |
|---|---|---|
| `GET` | `/api/health` | Health Check |
| `GET/POST` | `/api/connectors` | Konnektoren verwalten |
| `POST` | `/api/connectors/{id}/test` | Verbindung testen |
| `GET/POST` | `/api/workflows` | Workflows CRUD |
| `PUT/DELETE` | `/api/workflows/{id}` | Workflow bearbeiten/löschen |
| `POST` | `/api/workflows/{id}/execute` | Workflow manuell ausführen |
| `GET` | `/api/workflows/{id}/mermaid` | Mermaid-Diagramm generieren |
| `POST` | `/api/webhooks/paperless` | Paperless Webhook Empfänger |
| `POST` | `/api/webhooks/lexoffice` | Lexoffice Event Empfänger |
| `GET` | `/api/mappings/contacts` | Kontakt-Mappings |
| `GET` | `/api/logs` | Workflow-Logs |
| `GET` | `/api/dashboard/stats` | Dashboard Statistiken |

---

## 9. Sicherheitskonzept

- **API-Keys** werden verschlüsselt in der DB gespeichert (Fernet)
- **Webhook-Validierung** via HMAC-Signatur (Lexoffice) / Secret Token (Paperless)
- **Rate Limiting** auf allen Endpunkten (Lexoffice erlaubt max. 2 req/s)
- **CORS** konfigurierbar für Frontend-Origin
- **Environment Variables** für sensible Konfiguration
- **Kein Default-Admin-Passwort** – wird beim Setup gesetzt

---

## 10. Umsetzungsplan

| Phase | Beschreibung | Dateien |
|---|---|---|
| **Phase 1** | Projekt-Setup, Docker, DB | docker-compose.yml, Dockerfiles, Models |
| **Phase 2** | Konnektoren (Paperless + Lexoffice) | connectors/*.py |
| **Phase 3** | Workflow Engine | engine/*.py |
| **Phase 4** | REST API | api/*.py |
| **Phase 5** | Frontend mit Mermaid | frontend/src/**/* |
| **Phase 6** | Integration & Tests | tests/, docker-compose |

---

## 11. Workflow-Typen (Vorkonfiguriert)

1. **Eingangsrechnung archivieren** – Paperless → Lexoffice Voucher
2. **Ausgangsrechnung archivieren** – Lexoffice → Paperless Archiv
3. **Kontakte synchronisieren** – Bidirektionaler Sync
4. **Belege erfassen** – Paperless → Lexoffice Beleg
5. **Angebote verfolgen** – Lexoffice Quotation → Paperless
6. **Mahnungen archivieren** – Lexoffice Dunning → Paperless
