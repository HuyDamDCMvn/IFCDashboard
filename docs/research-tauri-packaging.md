# Nghiên cứu đóng gói IFC Dashboard với Tauri v2

> Ngày: 2026-03-06
> Trạng thái: Research — chưa triển khai

---

## 1. Tổng quan kiến trúc

Ứng dụng hiện tại gồm 2 phần chạy riêng biệt:

| Layer | Công nghệ | Port |
|-------|-----------|------|
| Frontend | React + Vite + Three.js + web-ifc (WASM) | 3000 |
| Backend | Python FastAPI + ifcopenshell | 8000 |

Với Tauri, kiến trúc sẽ trở thành:

```
┌─────────────────────────────────────┐
│         Tauri Desktop App           │
│  ┌───────────────────────────────┐  │
│  │  Native WebView (WebView2)    │  │
│  │  ┌─────────────────────────┐  │  │
│  │  │  React + Three.js       │  │  │
│  │  │  + web-ifc WASM         │  │  │
│  │  │  + Fragment Worker      │  │  │
│  │  └─────────────────────────┘  │  │
│  └───────────────────────────────┘  │
│                                     │
│  ┌───────────────────────────────┐  │
│  │  Rust Core (src-tauri/)       │  │
│  │  - Window management          │  │
│  │  - File system access         │  │
│  │  - Spawn sidecar              │  │
│  └───────────┬───────────────────┘  │
│              │ spawn                │
│  ┌───────────▼───────────────────┐  │
│  │  Python Sidecar (PyInstaller) │  │
│  │  FastAPI + ifcopenshell       │  │
│  │  localhost:PORT               │  │
│  └───────────────────────────────┘  │
└─────────────────────────────────────┘
```

---

## 2. Cấu trúc thư mục đề xuất

```
IFCDashboard/
├── frontend/                    # (giữ nguyên)
│   ├── src/
│   ├── public/
│   │   ├── web-ifc.wasm
│   │   ├── web-ifc-mt.wasm
│   │   └── Worker/worker.mjs
│   └── package.json
├── backend/                     # (giữ nguyên)
│   ├── main.py
│   ├── server_entry.py          # MỚI — PyInstaller entry point
│   ├── element_utils.py
│   ├── diff_engine.py
│   ├── ids_service.py
│   ├── edit_session.py
│   └── requirements.txt
├── src-tauri/                   # MỚI — Tauri core
│   ├── src/
│   │   └── main.rs
│   ├── binaries/
│   │   └── api-server-x86_64-pc-windows-msvc.exe
│   ├── capabilities/
│   │   └── default.json
│   ├── tauri.conf.json
│   ├── Cargo.toml
│   └── build.rs
├── scripts/
│   ├── build-all.ps1
│   └── copy-wasm.js
└── package.json                 # Root: Tauri CLI scripts
```

---

## 3. Đóng gói Python backend (PyInstaller → Sidecar)

### 3.1. Dependency map

```
fastapi ─────────── starlette, pydantic, anyio
uvicorn[standard] ── httptools, websockets, uvloop (Unix only)
ifcopenshell ─────── C++ bindings (.pyd/.so), schema files (.exp)
ifctester ────────── lxml, ifcopenshell (sub-dependency)
python-multipart ─── pure Python
numpy ────────────── C extensions (.pyd/.so)
```

### 3.2. Các vấn đề cụ thể từng dependency

#### ifcopenshell (Rủi ro: CAO)

| Vấn đề | Chi tiết | Ảnh hưởng |
|---------|----------|-----------|
| Native bindings | `.pyd` file chứa C++ bindings, PyInstaller có thể miss | `ImportError` khi khởi động |
| Schema files | `.exp` files trong `ifcopenshell/express/` không được auto-include | Không parse được IFC |
| Dynamic imports | `ifcopenshell.util.element`, `ifcopenshell.api` load dynamically | `ModuleNotFoundError` khi dùng tính năng cụ thể |
| `api.run()` pattern | `edit_session.py:96` gọi `ifcopenshell.api.run("pset.edit_pset", ...)` — import module theo tên string tại runtime | Edit session crash |

**Phòng ngừa**: Dùng `--collect-all ifcopenshell` hoặc include thủ công toàn bộ package qua `datas` trong spec file.

#### ifctester (Rủi ro: TRUNG BÌNH)

- `ids_service.py` line 12 dùng `try/except ImportError` — nếu bundle sai, IDS silently disabled
- Lazy import `from ifctester.facet import Restriction` tại line 25

**Phòng ngừa**: `--collect-all ifctester`, thêm hidden imports cho `lxml.etree`, `lxml._elementpath`.

#### uvicorn (Rủi ro: TRUNG BÌNH)

Nhiều submodule load theo string. Cần hidden imports:

```python
hiddenimports=[
    'uvicorn.logging', 'uvicorn.loops.auto', 'uvicorn.loops.asyncio',
    'uvicorn.protocols.http.auto', 'uvicorn.protocols.http.h11_impl',
    'uvicorn.protocols.http.httptools_impl',
    'uvicorn.protocols.websockets.auto',
    'uvicorn.lifespan.on', 'uvicorn.lifespan.off',
]
```

#### numpy (Rủi ro: THẤP)

PyInstaller 6.x xử lý tốt. Nếu lỗi: `--collect-all numpy`.

### 3.3. Entry point cho sidecar

Cần file riêng thay vì dùng `main.py` trực tiếp:

```python
# backend/server_entry.py
import sys, os
os.environ.setdefault("PYTHONIOENCODING", "utf-8")
os.environ.setdefault("PYTHONUTF8", "1")

import uvicorn
from main import app

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8000
    uvicorn.run(app, host="127.0.0.1", port=port, log_level="info")
```

Lý do: UTF-8 fix cho Windows, dynamic port, no `--reload`.

### 3.4. Kích thước sidecar ước tính

| Component | Size |
|-----------|------|
| Python interpreter | ~15 MB |
| ifcopenshell + C++ | ~80-120 MB |
| numpy | ~30-50 MB |
| ifctester + lxml | ~15-20 MB |
| FastAPI + uvicorn | ~5-10 MB |
| **Tổng (onefile, compressed)** | **~80-120 MB** |

### 3.5. Test cases bắt buộc sau khi build

Chạy trên máy **không có Python installed**:

1. `/api/parse-ifc` — IFC2x3, IFC4, IFC4x3
2. `/api/edit-session/open` → `/edit` → `/export` (test `ifcopenshell.api.run`)
3. `/api/health` — verify `ifctester: true`
4. `/api/validate-ids` (test ifctester)
5. `/api/diff-ifc` (test diff_engine, numpy)

---

## 4. Frontend trong Tauri WebView

### 4.1. WASM files (web-ifc.wasm)

`IfcViewer.jsx` dùng `wasm: { path: "/", absolute: true }` → fetches `/web-ifc.wasm`.

Trong Tauri production, URL = `http://tauri.localhost/web-ifc.wasm` (Windows). Tauri serve từ embedded frontend dist.

**Rủi ro**: MIME type có thể sai → WASM instantiate fail.
**Phòng ngừa**: Test sớm với `npx tauri dev`. Nếu lỗi, dùng Tauri localhost plugin.

### 4.2. Fragment Worker

```javascript
const workerResp = await fetch("/Worker/worker.mjs");
const workerBlob = await workerResp.blob();
const workerUrl = URL.createObjectURL(workerFile);
fragments.init(workerUrl);
```

**Rủi ro**: Blob URL worker trong WebView2 — cần verify.
**Phòng ngừa**: WebView2 dùng Chromium engine → Blob URL workers được hỗ trợ. Test sớm.

### 4.3. Three.js / WebGL

WebView2 dùng Chromium engine → WebGL 2.0 đầy đủ. Performance tương đương Chrome/Edge.

Project đã có fallback `SimpleRenderer` khi `PostproductionRenderer` fail — tốt.

### 4.4. SharedArrayBuffer

Tauri không hỗ trợ enable COOP/COEP headers (issue #5320: "not planned").

**Ảnh hưởng**: `web-ifc-mt.wasm` (multi-thread) không dùng được → giống hiện tại, single-thread.

---

## 5. Giao tiếp Frontend ↔ Backend

### 5.1. API URL — vấn đề chính

4 nơi define base URL:

| File | Biến | Giá trị |
|------|-------|---------|
| `App.jsx:19` | `API_URL` | `""` |
| `ifc-edit-api.js:8` | `BASE` | `""` |
| `ifc-diff-api.js:7` | `BASE` | `""` |
| `IdsBuilder.jsx` (4 chỗ) | hardcoded | `"/api/..."` |

Trong Tauri production không có Vite proxy → tất cả fail.

**Giải pháp**: Tạo centralized config:

```javascript
// frontend/src/lib/api-config.js
const IS_TAURI = typeof window !== 'undefined' && window.__TAURI_INTERNALS__;
export const API_BASE = IS_TAURI ? 'http://127.0.0.1:PORT' : '';
```

Cập nhật 4 files trên import từ `api-config.js`.

### 5.2. Dynamic port allocation

Rust side tìm port trống, truyền cho sidecar qua command args, frontend lấy port qua `invoke('get_api_port')`.

### 5.3. Sidecar startup timing

PyInstaller exe cần 1-8 giây để start. Frontend cần health check polling:

```javascript
export async function waitForBackend(maxRetries = 30, delayMs = 500) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(`${API_BASE}/api/health`, { signal: AbortSignal.timeout(1000) });
      if (res.ok) return true;
    } catch {}
    await new Promise(r => setTimeout(r, delayMs));
  }
  throw new Error('Backend failed to start');
}
```

---

## 6. Tauri Rust Core

### 6.1. Sidecar lifecycle

- Spawn sidecar trong `setup()` hook
- Store `CommandChild` handle cho cleanup
- Kill sidecar trong `CloseRequested` window event
- Orphan process prevention: Python sidecar tự thoát nếu parent chết (dùng `psutil`)

### 6.2. CSP configuration

```json
{
  "security": {
    "csp": "default-src 'self' 'unsafe-inline' 'unsafe-eval'; connect-src 'self' http://127.0.0.1:* http://localhost:*; worker-src 'self' blob:; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob:; style-src 'self' 'unsafe-inline'"
  }
}
```

| Directive | Lý do |
|-----------|-------|
| `unsafe-eval` | WASM instantiation |
| `connect-src http://127.0.0.1:*` | API calls tới sidecar |
| `worker-src blob:` | Fragment worker pattern |

---

## 7. Edge cases và failure modes

| Scenario | Ảnh hưởng | Phòng ngừa |
|----------|-----------|------------|
| WebView2 không có | App không mở | NSIS installer tự cài WebView2 bootstrapper |
| Antivirus block sidecar | API fails | Code signing, `--onedir` ít bị flag hơn `--onefile` |
| Port conflict | Backend không start | Dynamic port allocation |
| Orphan process | Port bị chiếm lần sau | Kill on close + Python parent watcher |
| Firewall blocks localhost | API fails | Dùng `127.0.0.1` thay `localhost` |
| Large IFC + memory | High RAM | Hiển thị warning, backend là process riêng nên isolated |

---

## 8. So sánh Tauri vs alternatives

| Tiêu chí | Tauri v2 | Electron | PyWebView |
|-----------|----------|----------|-----------|
| App size (core) | ~3-5 MB | ~150-200 MB | ~15 MB |
| RAM idle | ~30-50 MB | ~300-500 MB | ~50-80 MB |
| Installer size (ước tính) | ~60-100 MB | ~250-400 MB | ~200-300 MB |
| WASM/WebGL | Tốt (Chromium) | Tốt nhất (Chromium) | Hạn chế |
| Learning curve | Cao (Rust) | Trung bình (Node.js) | Thấp (Python) |
| Cross-platform | Win/Mac/Linux | Win/Mac/Linux | Win/Mac/Linux |

---

## 9. Kích thước installer ước tính

| Component | Size |
|-----------|------|
| Tauri core (Rust binary) | ~3-5 MB |
| Frontend dist (JS/CSS/HTML) | ~5-10 MB |
| WASM files (web-ifc) | ~15-25 MB |
| Fragment Worker | ~1.3 MB |
| Python sidecar (onefile) | ~80-120 MB |
| **NSIS installer (compressed)** | **~60-100 MB** |

---

## 10. Checklist triển khai

### Phase 1 — Validation (1-2 ngày)

- [ ] 1.1 PyInstaller bundle backend standalone
- [ ] 1.2 Test ifcopenshell với IFC2x3, IFC4, IFC4x3
- [ ] 1.3 Test ifctester (IDS validation)
- [ ] 1.4 Test edit session (`ifcopenshell.api.run`)

### Phase 2 — Tauri Init (1 ngày)

- [ ] 2.1 Init Tauri project, cấu hình tauri.conf.json
- [ ] 2.2 Verify frontend load trong WebView
- [ ] 2.3 Test WASM loading
- [ ] 2.4 Test Worker loading
- [ ] 2.5 Test Three.js/WebGL rendering

### Phase 3 — Integration (1-2 ngày)

- [ ] 3.1 Tạo api-config.js, cập nhật 4 files API
- [ ] 3.2 Sidecar spawn + lifecycle management
- [ ] 3.3 Dynamic port allocation
- [ ] 3.4 Health check polling + splash screen
- [ ] 3.5 CSP configuration

### Phase 4 — Polish (1-2 ngày)

- [ ] 4.1 Orphan process cleanup
- [ ] 4.2 Error handling: backend fail
- [ ] 4.3 App icon, installer branding
- [ ] 4.4 Build automation script

### Phase 5 — Testing (1-2 ngày)

- [ ] 5.1 Build production installer
- [ ] 5.2 Install trên clean machine
- [ ] 5.3 Antivirus test
- [ ] 5.4 Load test: large IFC files
- [ ] 5.5 All features e2e test

**Tổng thời gian ước tính**: 5-9 ngày.

**Khuyến nghị**: Bắt đầu từ Phase 1.1 (PyInstaller bundle) — rủi ro cao nhất, nếu fail sẽ ảnh hưởng toàn bộ kế hoạch.
