# IFC Dashboard - Nghiên cứu kiến trúc & Kế hoạch phát triển

> **Ngày:** 2026-03-05
> **Trạng thái:** Nghiên cứu - Chưa triển khai
> **Mục tiêu:** Nâng cấp IFCDashboard thành nền tảng CDE phù hợp ISO 19650

---

## Mục lục

1. [Phân tích ThatOpen Ecosystem](#1-phân-tích-thatopen-ecosystem)
2. [Kết hợp React + ThatOpen (Bi-link Dashboard)](#2-kết-hợp-react--thatopen-bi-link-dashboard)
3. [Tích hợp buildingSMART Community](#3-tích-hợp-buildingsmart-community)
4. [Quy trình BIM theo ISO 19650](#4-quy-trình-bim-theo-iso-19650)
5. [Database Layer với PostgreSQL](#5-database-layer-với-postgresql)
6. [Kiến trúc đề xuất: CQRS + Background Workers + Event-driven](#6-kiến-trúc-đề-xuất-cqrs--background-workers--event-driven)
7. [Kế hoạch triển khai](#7-kế-hoạch-triển-khai)

---

## 1. Phân tích ThatOpen Ecosystem

**GitHub:** https://github.com/ThatOpen

ThatOpen là hệ sinh thái open-source để phát triển phần mềm BIM trên nền web, xây dựng trên Three.js và WebAssembly.

### Các repository chính

| Repo | Stars | Công dụng | License |
|---|---|---|---|
| `engine_web-ifc` | 899 | Parse IFC bằng WASM, tốc độ native | MPL-2.0 |
| `engine_fragment` | 167 | Định dạng `.frag` tối ưu hiển thị (IFC 2GB → ~80MB, load 10x nhanh hơn) | MIT |
| `engine_components` | 600 | Bộ tool BIM: IfcLoader, Classifier, Clipper, Plans, BCFTopics, Highlighter | MIT |
| `engine_ui-components` | 41 | Web Components UI cho ứng dụng BIM (framework-agnostic) | MIT |
| `engine_clay` | 70 | Engine mô hình hóa BIM (authoring: extrusions, sweeps, booleans) | MIT |
| `web-ifc-three` | 576 | IFC Loader cho Three.js (legacy, ngừng cập nhật 04/2024) | MIT |
| `engine_templates` | 49 | CLI scaffolding: `npm create bim-app@latest` | MIT |

### Kiến trúc stack

```
Ứng dụng BIM (React)
    ↓
@thatopen/components + @thatopen/components-front
    ↓
@thatopen/fragments (định dạng .frag)
    ↓
web-ifc (WASM parser)
    ↓
Three.js → WebGL / WebAssembly
```

### Luồng dữ liệu

1. File IFC → `web-ifc` (parse bằng WASM) → Geometry + Properties
2. Geometry → `engine_fragment` (chuyển .frag, tiling) → Hiển thị nhanh
3. `engine_components` cung cấp tools tương tác (clipper, classifier, plans)
4. `engine_ui-components` cung cấp giao diện
5. `engine_clay` cho phép tạo mới geometry BIM

---

## 2. Kết hợp React + ThatOpen (Bi-link Dashboard)

### Bi-directional link là gì?

- **3D → Data**: Click phần tử 3D → highlight dòng trong bảng, highlight bar/slice trong chart
- **Data → 3D**: Click chart/bảng → highlight/isolate phần tử trong 3D viewer

### Hiện trạng dự án

Dự án đã có nền tảng bi-link qua `SelectionContext.jsx`:

```
IfcViewer.jsx ←── filterExpressIDs ──── Dashboard.jsx
              ←── filterGlobalIds ───── ElementTable.jsx
              ────► selectedExpressID ──►
```

### Cải tiến có thể làm

| Tính năng | Cơ chế |
|---|---|
| **Hover sync** | Thêm `hoveredExpressID` vào SelectionContext |
| **Multi-selection** | Checkbox trong table ↔ Ctrl+Click trong 3D |
| **Zoom-to-fit** | Click chart → filter 3D → camera auto zoom |
| **Property panel sync** | Click 3D → panel chi tiết properties |

---

## 3. Tích hợp buildingSMART Community

**GitHub:** https://github.com/buildingsmart-community

### Các tài nguyên có thể tích hợp

#### 3.1 ifcJSON - Export/Import JSON chuẩn

- Repo: https://github.com/buildingsmart-community/ifcJSON
- Cung cấp schema chuẩn quốc tế để biểu diễn IFC dưới dạng JSON
- Ứng dụng: export dashboard data ra `.ifcjson`, import nhẹ hơn parse IFC gốc

#### 3.2 bSDD API - Từ điển dữ liệu xây dựng (GIÁ TRỊ CAO NHẤT)

- API: https://technical.buildingsmart.org/services/bsdd/
- API miễn phí chứa hàng triệu định nghĩa vật liệu, phân loại, thuộc tính
- Ứng dụng:
  - Map elements sang **Uniclass, OmniClass, CCI**
  - Enrich properties với mô tả, đơn vị, giá trị cho phép
  - Hiển thị thông số kỹ thuật chi tiết từ bSDD

```
GET https://api.bsdd.buildingsmart.org/api/Class/v1
    ?namespaceUri=https://identifier.buildingsmart.org/uri/buildingsmart/ifc/4.3
    &searchText=IfcWall
```

#### 3.3 IDS Validation - Kiểm tra chất lượng mô hình

- Spec: https://www.buildingsmart.org/standards/bsi-standards/information-delivery-specification-ids/
- IDS 1.0 became official standard June 2024
- Ứng dụng: Tab "Quality Check" - validate model theo EIR requirements
- Click rule fail → highlight elements vi phạm trong 3D (bi-link)

#### 3.4 BCF - Quản lý Issue/Comment

- Spec: https://technical.buildingsmart.org/standards/bcf/
- ThatOpen đã có `BCFTopics` component
- Ứng dụng: panel Issues, capture viewpoint + screenshot, export `.bcfzip`
- Tương thích Revit, Navisworks, Solibri, BIMcollab

#### 3.5 Community-Sample-Test-Files

- Repo: https://github.com/buildingsmart-community/Community-Sample-Test-Files
- Bộ test files đa dạng: IFC2x3, IFC4, IFC4.3, BCF, IDS

### Ma trận tích hợp

| Resource | Giá trị | Độ khó | Ưu tiên |
|---|---|---|---|
| bSDD API | ⭐⭐⭐⭐⭐ | Dễ (REST API) | 1 |
| IDS Validation | ⭐⭐⭐⭐ | Trung bình | 2 |
| BCF | ⭐⭐⭐⭐ | Trung bình-Khó | 3 |
| ifcJSON | ⭐⭐⭐ | Trung bình | 4 |
| Classification | ⭐⭐⭐⭐ | Trung bình | 5 |
| Sample Files | ⭐⭐⭐ | Dễ | 6 |

---

## 4. Quy trình BIM theo ISO 19650

### ISO 19650 gồm 6 phần

| Part | Nội dung |
|---|---|
| Part 1 | Khái niệm & nguyên tắc |
| Part 2 | Giai đoạn giao dự án (Design → Handover) |
| Part 3 | Giai đoạn vận hành (O&M) |
| Part 4 | Trao đổi thông tin (Information Exchange) |
| Part 5 | Bảo mật thông tin |
| Part 6 | Thông tin ATVSLĐ (Health & Safety) - 2025 |

### CDE Workflow (4 trạng thái)

```
WIP (S0-Draft) → Shared (S1-S4) → Published (A-Approved) → Archived
```

### Mapping công nghệ → ISO 19650

| Yêu cầu ISO 19650 | ifcopenshell | ThatOpen | buildingSMART | React | PostgreSQL |
|---|:---:|:---:|:---:|:---:|:---:|
| CDE Workflow | | | | UI + API | State + Audit |
| EIR/BEP Validation | IDS validate | | IDS spec | Report UI | Store results |
| LOIN Checking | Property check | | bSDD enrich | Heatmap | Query JSONB |
| 3D Model Viewing | | Viewer | | React wrapper | |
| BCF Collaboration | | BCFTopics | BCF spec | Issue panel | Store topics |
| Classification | Read/Write | Classifier | bSDD + Uniclass | Charts | Query/Index |
| Naming Convention | | | Spec | Validation form | Store metadata |
| Information Exchange | Parse/Export | Fragment | ifcJSON | Exchange UI | Version control |
| Audit Trail | | | | Activity log | Full history |

### Cần bổ sung (không có trong stack hiện tại)

- Database (PostgreSQL) cho CDE, audit trail, versioning
- Authentication & Authorization (JWT, role-based)
- File storage cho nhiều revisions (MinIO / S3)
- Real-time collaboration (WebSocket)
- PDF report generation
- Digital signature cho approval

---

## 5. Database Layer với PostgreSQL

### Vấn đề hiện tại

Backend hoàn toàn stateless - mỗi lần upload IFC parse xong trả JSON, không lưu gì.

```
Upload IFC → Parse 15s → JSON response → Mất khi reload
Upload lại → Parse 15s → lặp lại
```

### PostgreSQL giải quyết

| Vấn đề | Giải pháp |
|---|---|
| Parse lại mỗi lần | Parse 1 lần, query DB ~50ms |
| Không truy vấn properties | JSONB + GIN index, query sâu |
| Không so sánh revisions | JOIN 2 revision, hiện diff |
| Không CDE workflow | State machine + audit trail |
| Không user management | Roles, permissions |
| Không cross-model search | SQL queries across models |

### Database Schema chính

**8 bảng cốt lõi:**

1. `organizations` - Tổ chức (originator code: ARC, STR, MEP)
2. `users` - Người dùng (role: admin, author, checker, approver, viewer)
3. `projects` - Dự án (code, phase, eir_config, loin_config, naming_rules)
4. `models` - Information containers (CDE status, revision, IFC metadata)
5. `elements` - IFC products (JSONB: property_sets, materials, quantities, classification)
6. `cde_transitions` - Lịch sử chuyển trạng thái CDE
7. `validation_runs` + `validation_failures` - Kết quả IDS validation
8. `bcf_topics` + `bcf_comments` - BCF issues
9. `activity_log` - Audit trail

**Indexing strategy:**

- B-Tree: ifc_type, storey, model_id, status, timestamps
- GIN: property_sets, materials, classification, quantities (JSONB deep queries)
- BRIN: activity_log.created_at (time-ordered, append-only)
- Partial: active models only, open issues only

---

## 6. Kiến trúc đề xuất: CQRS + Background Workers + Event-driven

### Tại sao CQRS?

BIM data có đặc điểm:
- **Write ít** (upload vài lần/ngày), **Read nhiều** (dashboard hàng trăm lần/ngày)
- **Write nặng** (parse IFC 15-30s), **Read cần nhanh** (< 500ms)
→ Tách riêng Write path và Read path

### Kiến trúc tổng thể

```
React Frontend
    │
    ├── COMMANDS (write) ────────────────── QUERIES (read)
    │                                        │
    ▼                                        ▼
WRITE API (FastAPI)                    READ API (FastAPI)
    │                                        │
    ▼                                        ▼
Background Workers                     Materialized Views
(ARQ / Celery)                         + Redis Cache
    │                                        │
    ├── parse_ifc_task                       │
    ├── validate_ids_task                    │
    ├── enrich_bsdd_task                     │
    │                                        │
    ▼                                        │
Event Bus ───────────────────────────────────┘
    │
    ├── model.parsed → refresh views, auto-validate, notify frontend
    ├── model.transitioned → log audit, notify approver
    └── validation.completed → alert if pass_rate < 80%
    │
    ▼
PostgreSQL
    ├── Write tables: models, elements, cde_transitions, ...
    ├── Read views: mv_dashboard_summary, mv_material_distribution, ...
    └── GIN indexes on JSONB columns
```

### So sánh với kiến trúc layered truyền thống

| Khía cạnh | Layered (trước) | CQRS + Events (sau) |
|---|---|---|
| Upload UX | Block 15-30s | Return ngay 202, progress qua WebSocket |
| Dashboard speed | ~50ms (JSONB on models) | **< 5ms** (materialized view) |
| Data consistency | Pre-computed JSONB (out-of-sync risk) | Views derive từ source-of-truth |
| Code complexity | 5 layers, ~25 files | 3 layers, ~18 files |
| Thêm tính năng | Sửa 3 files (repo + service + router) | Thêm 2 files (event handler + query) |
| Coupling | Service gọi trực tiếp repos | Event-driven, loose coupling |

### Cấu trúc thư mục Backend

```
backend/
├── alembic/                    # Database migrations
│   └── versions/
├── app/
│   ├── config.py               # Settings from .env
│   ├── database.py             # Engine, session, Base
│   ├── dependencies.py         # get_session, get_current_user
│   ├── events.py               # Event bus (emit/on)
│   ├── event_handlers.py       # All event handlers
│   ├── main.py                 # FastAPI app, mount routers
│   │
│   ├── models/                 # SQLAlchemy ORM
│   │   ├── user.py, project.py, model.py, element.py
│   │   ├── bcf.py, validation.py, job.py, activity.py
│   │
│   ├── schemas/                # Pydantic request/response
│   │
│   ├── routers/
│   │   ├── commands.py         # All write endpoints
│   │   └── queries.py          # All read endpoints
│   │
│   ├── services/               # Business logic
│   │   ├── ifc_parser.py       # ifcopenshell (extracted from main.py)
│   │   ├── cde_machine.py      # State machine
│   │   ├── bsdd_client.py      # External bSDD API
│   │   └── validators.py       # IDS validation
│   │
│   ├── queries/                # Read-optimized query functions
│   │   ├── dashboard.py, elements.py, analytics.py, bcf.py
│   │
│   └── workers/                # Background tasks
│       ├── parse_worker.py, validate_worker.py, enrich_worker.py
│
├── migrations/                 # SQL materialized views
│   ├── mv_model_dashboard.sql
│   ├── mv_material_distribution.sql
│   └── mv_storey_breakdown.sql
│
├── requirements.txt
└── .env
```

### Materialized Views (thay vì pre-computed JSONB)

```sql
CREATE MATERIALIZED VIEW mv_model_dashboard AS
SELECT
    m.id AS model_id,
    m.project_id,
    COUNT(e.id) AS total_elements,
    jsonb_object_agg(e.ifc_type, type_counts.cnt) AS summary,
    COUNT(DISTINCT e.storey) AS storey_count
FROM models m
LEFT JOIN elements e ON e.model_id = m.id
LEFT JOIN (
    SELECT model_id, ifc_type, COUNT(*) AS cnt
    FROM elements GROUP BY model_id, ifc_type
) type_counts ON type_counts.model_id = m.id
GROUP BY m.id;

-- Refresh triggered by event after model.parsed
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_model_dashboard;
```

### CDE State Machine

```python
VALID_TRANSITIONS = {
    ("wip",       "shared"):    "author",
    ("shared",    "wip"):       "checker",     # rejected
    ("shared",    "published"): "approver",
    ("published", "archived"):  "manager",
    ("wip",       "archived"):  "manager",     # cancelled
}
```

### Tech Stack hoàn chỉnh

```
Frontend:  React 19 + Recharts + ThatOpen Components
Backend:   FastAPI + SQLAlchemy 2.0 (async) + ifcopenshell + ifctester
Database:  PostgreSQL 16+ (JSONB + GIN indexes) + PostGIS (optional)
Workers:   ARQ (async task queue) hoặc Celery
Cache:     Redis (optional, cho dashboard hot data)
Storage:   Local disk / MinIO / S3 (.ifc, .frag, .bcfzip, .ids)
```

### Dependencies bổ sung (requirements.txt)

```
sqlalchemy[asyncio]
asyncpg
alembic
python-jose[cryptography]
passlib[bcrypt]
ifctester
httpx
arq
redis
```

---

## 7. Kế hoạch triển khai

### Phase 1: Database Foundation
- [ ] Setup PostgreSQL + config
- [ ] SQLAlchemy models (users, projects, models, elements)
- [ ] Alembic migrations
- [ ] Tách ifc_parser.py từ main.py
- [ ] API: upload → parse → store (vẫn đồng bộ trước)
- [ ] API: get dashboard data từ DB (instant)

### Phase 2: Background Workers + Events
- [ ] Setup ARQ task queue
- [ ] Chuyển IFC parsing sang background worker
- [ ] WebSocket notification khi parse xong
- [ ] Event system (model.parsed, model.transitioned)
- [ ] Job tracking (progress bar frontend)

### Phase 3: CDE Workflow (ISO 19650)
- [ ] CDE state machine (WIP → Shared → Published → Archived)
- [ ] User authentication (JWT)
- [ ] Role-based access control
- [ ] Audit trail (activity_log)
- [ ] Naming convention validation

### Phase 4: Validation & Enrichment
- [ ] IDS validation integration (ifctester)
- [ ] bSDD API enrichment
- [ ] LOIN checking
- [ ] Materialized views for dashboard
- [ ] Quality Check tab (frontend)

### Phase 5: Collaboration
- [ ] BCF topics/comments (CRUD + import/export .bcfzip)
- [ ] Model revision comparison (diff 2 versions)
- [ ] Classification (Uniclass/OmniClass via bSDD)
- [ ] Advanced analytics & reporting

### Quy mô khuyến nghị

| Quy mô | Kiến trúc |
|---|---|
| MVP / 1-2 người | main.py hiện tại + SQLite |
| Team nhỏ (3-10) | **CQRS + Workers (khuyến nghị)** |
| Doanh nghiệp (50+) | + Redis + RabbitMQ + microservices |

---

## Tham khảo

- ThatOpen: https://github.com/ThatOpen
- ThatOpen Docs: https://docs.thatopen.com/
- buildingSMART Community: https://github.com/buildingsmart-community
- bSDD API: https://technical.buildingsmart.org/services/bsdd/
- IDS Spec: https://www.buildingsmart.org/standards/bsi-standards/information-delivery-specification-ids/
- BCF Spec: https://technical.buildingsmart.org/standards/bcf/
- ISO 19650: https://www.iso19650.org/
- ifcJSON: https://github.com/buildingsmart-community/ifcJSON
