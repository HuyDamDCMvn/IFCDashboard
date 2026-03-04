# IFC Dashboard

View IFC 3D models and explore building data through interactive charts and tables.

## Project Structure

```
IFCDashboard/
├── backend/          # FastAPI + ifcopenshell
│   ├── main.py
│   └── requirements.txt
└── frontend/         # React + Three.js + web-ifc
    └── src/
        ├── components/
        │   ├── IfcViewer.jsx      # 3D viewer
        │   ├── Dashboard.jsx      # Charts & stats
        │   ├── ElementTable.jsx   # Searchable table
        │   ├── StatCard.jsx       # Stat cards
        │   └── SelectedElement.jsx
        ├── utils/
        │   └── ifcLoader.js       # web-ifc geometry loader
        └── App.jsx
```

## Quick Start

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

Open http://localhost:3000

## Features

- **3D Viewer**: Load and render IFC models in the browser using web-ifc + Three.js
- **Click Selection**: Click on 3D elements to highlight and identify them
- **Dashboard**: Bar charts, pie charts, material breakdown, storey analysis
- **Element Table**: Search and filter all IFC elements, expand to see properties
- **Property Sets**: View all IFC property sets and quantities per element
