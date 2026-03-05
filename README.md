# IFC Dashboard

A browser-based platform for viewing, analyzing, validating, and editing IFC building models — powered by [That Open Engine](https://github.com/ThatOpen), [IfcOpenShell](https://github.com/IfcOpenShell/IfcOpenShell), and [buildingSMART](https://www.buildingsmart.org/) open standards.

![IFC2x3](https://img.shields.io/badge/IFC2x3-supported-blue)
![IFC4](https://img.shields.io/badge/IFC4-supported-blue)
![IFC4x3](https://img.shields.io/badge/IFC4x3-supported-blue)
![React 19](https://img.shields.io/badge/React-19-61DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-009688)

---

## Features

### 3D Viewer
- Real-time IFC rendering via **That Open Engine** (tile-based fragments + Three.js)
- Click-to-select elements with property inspection
- Three isolation modes: **Highlight**, **Isolate**, **X-Ray**
- Bi-directional linking — click a chart bar → viewer highlights matching elements, and vice versa

### Multi-Model Federation
- Load multiple IFC files simultaneously from different disciplines (Architecture, Structure, MEP, Infrastructure)
- Unified dashboard merges data across all loaded models
- Per-model visibility toggle, color coding, and discipline auto-detection
- Works across IFC2x3, IFC4, and IFC4x3 schemas

### Interactive Dashboard
- **Bar charts**: Element count by IFC class, by storey, by predefined type
- **Pie charts**: Material breakdown, class distribution
- **Element table**: Searchable, filterable, paginated — with inline property expansion
- **Stat cards**: Total elements, classes, storeys, materials at a glance
- Click any chart segment to filter/highlight the corresponding elements in 3D

### IDS Builder (Information Delivery Specifications)
- Visual editor for [buildingSMART IDS 1.0](https://technical.buildingsmart.org/projects/information-delivery-specification-ids/) — no XML knowledge required
- Create specifications with Entity, Property, Attribute, Classification, Material, and PartOf facets
- Full restriction support: enumeration, pattern, bounds, length
- Validate IFC models against IDS specs with detailed pass/fail reports
- Import/export IDS XML files, XML preview, built-in templates
- 3D integration: failed elements are highlighted directly in the viewer

### IFC Diff (Model Comparison)
- Compare two IFC files to detect **added**, **deleted**, and **changed** elements
- Custom **hash+placement** diff algorithm — faster and more accurate than default `ifcdiff`
- Detects changes in: attributes, placement (matrix comparison via NumPy), property sets (hash-first, detail on mismatch), type assignments, and spatial containers
- **Schema validation gate** — both files must share the same IFC schema (IFC4 vs IFC4x3 rejected with clear error)
- Summary charts: pie chart (overview), bar chart (changes by IFC type), change category breakdown
- Expandable detail view for each changed element showing old → new values
- File size limit (300 MB) and result cap (2,000 elements/category) to prevent memory issues
- Frontend pagination for large result sets

### IFC Data Editor (Non-Geometry)
- Edit element **attributes** (Name, Description, ObjectType, PredefinedType) and **property set values** directly from the browser
- Backend-powered by **IfcOpenShell** — full IFC schema compliance, no data corruption
- **Stateful sessions**: upload once, edit multiple elements, export when done
- Auto-cleanup sessions after 30 minutes of inactivity
- Export the modified `.ifc` file — geometry untouched, only data changes

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌─────────┐ ┌────────┐│
│  │ IfcViewer│ │Dashboard │ │IDS Build.│ │IFC Edit │ │IFC Diff││
│  │(ThatOpen)│ │(Recharts)│ │ (Modal)  │ │ (Modal) │ │(Modal) ││
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬────┘ └───┬───┘│
│       │            │            │             │          │    │
│  ┌────┴────────────┴────────────┴─────────────┴──────────┴─┐ │
│  │              React Context (shared state)               │ │
│  │  SelectionContext · ModelRegistry · IfcEditContext       │ │
│  │              · IdsBuilderContext · IfcDiffContext        │ │
│  └───────────────────────┬───────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────┘
                           │  REST API (axios)
┌──────────────────────────┼──────────────────────────────────┐
│                     FastAPI Backend                          │
│  ┌─────────────┐ ┌──────────┐ ┌──────────────┐ ┌──────────┐ │
│  │ /parse-ifc  │ │ /edit-*  │ │ /build-ids   │ │/diff-ifc │ │
│  │ /health     │ │ sessions │ │ /parse-ids   │ │          │ │
│  │             │ │          │ │ /validate-ids│ │          │ │
│  └──────┬──────┘ └─────┬────┘ └──────┬───────┘ └─────┬────┘ │
│          │                │                    │             │
│  ┌───────┴────────────────┴────────────────────┴──────────┐  │
│  │              ifcopenshell + ifctester                   │  │
│  └────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

### Data Flow

```
User uploads .ifc
       │
       ├──► Frontend: ThatOpen loads fragments → 3D render
       │
       └──► Backend: ifcopenshell parses → JSON metadata
                │
                ▼
       Dashboard, Table, Charts populated
                │
                ▼
       User clicks chart/element
                │
                ├──► SelectionContext.toggleFilter()
                │         │
                │         ├──► Viewer: Highlighter/Hider isolates elements
                │         └──► Dashboard: chart segment highlighted
                │
                ├──► User clicks "Edit" on element
                │         │
                │         ▼
                │    IfcEditContext.openElementEditor()
                │         │
                │         ▼
                │    PropertyEditor modal opens
                │         │
                │         ▼
                │    User modifies Name/Description/Properties
                │         │
                │         ▼
                │    POST /api/edit-session/{id}/edit
                │         │
                │         ▼
                │    ifcopenshell applies changes (geometry untouched)
                │         │
                │         ▼
                │    GET /api/edit-session/{id}/export → download .ifc
                │
                ├──► User opens IDS Builder
                │         │
                │         ▼
                │    Build specs visually → Validate against model
                │         │
                │         ▼
                │    Failed elements highlighted in 3D viewer
                │
                └──► User opens IFC Diff
                          │
                          ▼
                     Upload Old + New IFC → Schema check
                          │
                          ▼
                     POST /api/diff-ifc → hash+placement comparison
                          │
                          ▼
                     Summary charts + added/deleted/changed element lists
```

### Edit Session Flow

```
"Edit Mode" clicked
       │
       ▼
POST /api/edit-session/open  (upload .ifc, ifcopenshell holds in RAM)
       │
       ▼
User edits Element A  ──►  POST /edit  ──►  ifcopenshell.api.run("pset.edit_pset")
User edits Element B  ──►  POST /edit  ──►  setattr(entity, "Name", ...)
User edits Element C  ──►  POST /edit  ──►  ...
       │
       ▼
"Export IFC" clicked
       │
       ▼
GET /export  ──►  ifc.write()  ──►  download model_edited.ifc
       │
       ▼
Session closed  ──►  DELETE /api/edit-session/{id}  ──►  memory freed
```

---

## Tech Stack

| Layer | Technology | Role |
|-------|-----------|------|
| **3D Engine** | That Open Engine (`@thatopen/components`, `@thatopen/fragments`) | Tile-based IFC rendering, highlighting, isolation |
| **IFC Parser (WASM)** | `web-ifc` 0.0.76 | Browser-side IFC geometry loading |
| **IFC Parser (Python)** | `ifcopenshell` | Server-side IFC parsing, property editing, export |
| **IDS Validation** | `ifctester` | buildingSMART IDS 1.0 compliance checking |
| **Frontend** | React 19 + Vite 7 | UI framework |
| **3D Rendering** | Three.js 0.183 | WebGL rendering |
| **Charts** | Recharts 3 | Interactive data visualization |
| **Layout** | react-resizable-panels | Resizable viewer/dashboard split |
| **Numerical** | NumPy | Placement matrix comparison for IFC diff |
| **Backend** | FastAPI + Uvicorn | REST API server |

---

## Project Structure

```
IFCDashboard/
├── backend/
│   ├── main.py                         # FastAPI: parse, edit, IDS, diff endpoints
│   ├── benchmark_diff.py               # Diff algorithm benchmark suite
│   └── requirements.txt
├── frontend/
│   ├── public/
│   │   ├── Worker/worker.mjs           # FragmentsManager web worker
│   │   ├── web-ifc.wasm                # WASM binary (single-thread)
│   │   └── web-ifc-mt.wasm             # WASM binary (multi-thread)
│   └── src/
│       ├── components/
│       │   ├── IfcViewer.jsx           # 3D viewer (That Open engine)
│       │   ├── IfcDiffPanel.jsx        # IFC diff comparison UI
│       │   ├── Dashboard.jsx           # Charts, stats, element table
│       │   ├── DashboardPanel.jsx      # Collapsible panel wrapper
│       │   ├── ElementTable.jsx        # Searchable element table
│       │   ├── SelectedElement.jsx     # Selected element properties
│       │   ├── ModelManager.jsx        # Multi-model sidebar
│       │   ├── StatCard.jsx            # Dashboard stat cards
│       │   ├── ifc-editor/
│       │   │   ├── PropertyEditor.jsx  # Modal: edit attributes + psets
│       │   │   ├── AttributeEditor.jsx # Name/Description/Type fields
│       │   │   ├── EditHistory.jsx     # Change history overlay
│       │   │   └── ExportButton.jsx    # Download edited IFC
│       │   └── ids-builder/
│       │       ├── IdsBuilder.jsx      # Main IDS editor modal
│       │       ├── IdsSpecList.jsx     # Specification list
│       │       ├── IdsSpecEditor.jsx   # Specification editor
│       │       ├── IdsFacetEditor.jsx  # Facet editor
│       │       ├── IdsValueEditor.jsx  # Restriction/value editor
│       │       ├── IdsInfoPanel.jsx    # IDS metadata panel
│       │       ├── IdsXmlPreview.jsx   # XML preview
│       │       ├── IdsTemplates.jsx    # Built-in templates
│       │       └── IdsValidationReport.jsx  # Validation results
│       ├── contexts/
│       │   ├── SelectionContext.jsx     # Selection, filter, isolation state
│       │   ├── ModelRegistryContext.jsx # Loaded models, federation merge
│       │   ├── IfcEditContext.jsx       # Edit session management
│       │   ├── IfcDiffContext.jsx       # Diff state management
│       │   └── IdsBuilderContext.jsx    # IDS document state
│       ├── lib/
│       │   ├── ifc-filter-core.js      # Pure JS: filtering, color maps
│       │   ├── ifc-viewer-bridge.js    # That Open highlight/isolate API
│       │   ├── ifc-edit-api.js         # HTTP client for edit endpoints
│       │   ├── ifc-diff-api.js         # HTTP client for diff endpoint
│       │   ├── useIfcFilter.js         # React hook: filter logic
│       │   ├── useIfcHighlighter.js    # React hook: 3D highlight sync
│       │   ├── ids-constants.js        # IFC entity/type constants for IDS
│       │   └── index.js                # Public API re-exports
│       ├── App.jsx                     # Root layout, providers, header
│       ├── main.jsx                    # React entry point
│       └── index.css                   # Global styles
├── TestIFC/                            # buildingSMART sample IFC files
└── README.md
```

---

## Quick Start

### Prerequisites

- **Node.js** 18+
- **Python** 3.10+
- **pip** (Python package manager)

### 1. Backend

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000** in your browser.

> The Vite dev server proxies `/api` requests to `localhost:8000` automatically.

---

## API Reference

### IFC Parsing

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/parse-ifc` | Upload IFC file, returns full element metadata (types, properties, materials, storeys) |
| `GET`  | `/api/health` | Health check, reports ifctester availability |

### IFC Edit Sessions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/edit-session/open` | Upload IFC, create session (holds model in RAM) |
| `POST` | `/api/edit-session/{id}/edit` | Apply batch edits: `{ edits: [{ globalId, Name, psetEdits: {...} }] }` |
| `GET`  | `/api/edit-session/{id}/element/{globalId}` | Get current data for one element |
| `GET`  | `/api/edit-session/{id}/history` | Get all changes made in this session |
| `GET`  | `/api/edit-session/{id}/export` | Download the modified `.ifc` file |
| `DELETE` | `/api/edit-session/{id}` | Close session, free memory |

### IDS (Information Delivery Specifications)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/build-ids` | Convert JSON IDS definition to IDS XML |
| `POST` | `/api/parse-ids` | Parse IDS XML file to JSON for the editor |
| `POST` | `/api/validate-ids` | Validate an IFC file against IDS specifications |

### IFC Diff (Model Comparison)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/diff-ifc` | Compare two IFC files — returns added, deleted, changed elements with detailed change breakdown |

---

## What Makes This Different

| Capability | IFC Dashboard | Typical BIM Viewers |
|-----------|---------------|---------------------|
| **Edit IFC data in browser** | Attributes + PropertySets via IfcOpenShell | Read-only or requires desktop software |
| **IDS validation** | Built-in visual editor + validation | Separate tools (ifctester CLI, etc.) |
| **Multi-model federation** | Load N files, unified dashboard | Usually single model |
| **Bi-directional selection** | Chart → 3D and 3D → Chart | One-way or none |
| **No cloud dependency** | Runs fully local (localhost) | Often requires cloud accounts |
| **Open standards** | IFC2x3/4/4x3, IDS 1.0, buildingSMART | Proprietary formats |
| **Geometry untouched** | Edit data only, export clean IFC | Risk of geometry corruption |
| **Session-based editing** | Edit many elements, export once | Re-upload per change |
| **Model comparison** | Hash+placement diff with schema gate | Geometry tessellation (slow) or text diff (inaccurate) |

---

## Supported IFC Schemas

- **IFC2x3** — Legacy building models (with type normalization: `IfcWallStandardCase` → `IfcWall`)
- **IFC4** — Current standard for buildings
- **IFC4x3** — Infrastructure extensions (roads, bridges, railways, alignments, earthworks)

---

## License

This project uses open-source libraries under their respective licenses:
- [That Open Engine](https://github.com/ThatOpen) — MIT
- [IfcOpenShell](https://github.com/IfcOpenShell/IfcOpenShell) — LGPL-3.0
- [web-ifc](https://github.com/ThatOpen/engine_web-ifc) — Mozilla Public License 2.0
