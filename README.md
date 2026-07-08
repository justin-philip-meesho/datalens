# DataLens — Meesho Buildathon 2026

> Browser-based data analytics dashboard — upload any CSV/Excel/JSON and get instant interactive charts, pivot tables, data quality audits, box plots, trend lines, and more.

## Quick Start

### 1. Install dependencies

```bash
# Backend
cd backend && npm install

# Frontend
cd ../frontend && npm install
```

### 2. Run the app

Open **two terminals**:

**Terminal 1 — Backend (port 8290)**
```bash
cd backend
npm start
```

**Terminal 2 — Frontend (port 9280)**
```bash
cd frontend
npm run dev
```

Then open **http://localhost:9280** in your browser.

> **Note:** local dev runs on 9280 (frontend) / 8290 (backend) to avoid conflicts with other apps. The Buildathon submission build must use 9080 / 8090 — flip these back before packaging the final Docker image.

---

## Architecture

```
┌─────────────────────────┐       ┌──────────────────────────┐
│  React Frontend         │       │  Node.js Backend          │
│  Vite · port 9280       │──────▶│  Express · port 8290      │
│                         │  API  │  SQLite (better-sqlite3)  │
│  • DataLens dashboard   │       │                           │
│  • Cloud save/load UI   │       │  POST /api/dashboards     │
│                         │       │  GET  /api/dashboards     │
└─────────────────────────┘       │  GET  /api/dashboards/:id │
                                  │  DELETE /api/dashboards/:id│
                                  └──────────────────────────┘
```

## Features

| Feature | Description |
|---|---|
| File Upload | CSV, Excel (.xlsx/.xls), JSON, TSV |
| Sample Datasets | E-Commerce, HR Analytics, Sales Trends |
| Auto Charts | Histograms, bar/donut, time series, scatter |
| Box Plots | With outlier highlighting (IQR method) |
| Trend Lines | Linear regression with R² on charts |
| Correlation Heatmap | Pearson r across all numeric columns |
| Cross-filtering | Click any chart element to filter all others |
| Pivot Table | Drag-and-drop row/col/value/agg builder |
| Calculated Columns | `[Col]` formula syntax with SUM/AVG/IF |
| Data Quality Audit | Per-column score, fill rate, outlier count |
| Dark Mode | Persisted via localStorage |
| Cloud Save | Save & load dashboard state via SQLite API |
| CSV Export | Filtered data download |
| PDF Export | html2canvas + jsPDF screenshot |

## GitHub Pages (static)

The `docs/index.html` is the standalone single-file version — no backend needed.
Enable GitHub Pages on your repo → Source: `main` branch → `/docs` folder.
