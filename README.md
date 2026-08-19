# PRGI Periodical & Publication Title Verification System

An intelligent, local-first decision-support platform that verifies proposed periodical/publication titles against registered titles and pending applications. Built with **Flask**, **SQLite (WAL + FTS5 Trigram)**, **Phonetic & Semantic AI Similarity Engines** (`LaBSE` / `Sentence-Transformers`), **React**, **Vite**, and **Tailwind CSS**.

---

## 🏗️ Architecture Overview

The system consists of three main components:

1. **`frontend/`** — React 19 + Vite 8 + Tailwind CSS + Framer Motion user interface with real-time title verification UI, search breakdown, and interactive visual feedback.
2. **`backend/`** — Python 3.10+ Flask API with an SQLite FTS5 trigram database, Soundex + Double Metaphone phonetic matching, string similarity algorithms (Levenshtein + Jaro-Winkler), and `LaBSE` transformer embeddings for semantic evaluation.
3. **`scrapper/`** — Playwright Node.js web scraper utility for acquiring registered titles data directly from the official PRGI portal.

---

## ⚡ Quick Start

### Prerequisites
- **Node.js**: v18.0.0 or higher
- **Python**: v3.10 or higher
- **Git**

---

### Step 1: Run the Backend Service

1. Open a terminal and navigate to the `backend` folder:
   ```bash
   cd backend
   ```

2. Install Python dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Start the Flask backend server:
   ```bash
   python app.py
   ```
   > The API server will start at **`http://127.0.0.1:5000`**.

---

### Step 2: Run the Frontend Application

1. Open a second terminal and navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```

2. Install Node dependencies:
   ```bash
   npm install
   ```

3. Start the Vite development server:
   ```bash
   npm run dev
   ```
   > Access the Web UI in your browser at **`http://localhost:5173`**.

---

## 🛠️ Detailed Component Usage

### 📦 Backend (`backend/`)

#### 1. Test a Title via CLI
You can run title verification directly from your command line without starting the web server:
```bash
cd backend
python -m src.verify "Daily Samachar"
```

#### 2. Re-ingest / Reset Corpus Database
If you modify `data/prgi_titles.csv` or want to rebuild the SQLite database from scratch:
```bash
python -m src.ingest --csv data/prgi_titles.csv --reset
```

#### 3. Audit Dataset
Generates an audit report detailing title count, unicode scripts, duplicates, and metadata completeness:
```bash
python -m src.audit_dataset --csv data/prgi_titles.csv
```

#### 4. Run Pytest Suite
```bash
python -m pytest -q
```

---

### 🎨 Frontend (`frontend/`)

- **Development Mode**: `npm run dev` (starts dev server with hot module replacement)
- **Production Build**: `npm run build` (compiles TypeScript & bundles into `dist/`)
- **Preview Production**: `npm run preview`

---

### 🕷️ Data Scrapper (`scrapper/`)

The scraper automatically extracts registered publication titles from the PRGI portal using Playwright.

1. Navigate to the `scrapper` directory:
   ```bash
   cd scrapper
   ```
2. Install dependencies:
   ```bash
   npm install
   npx playwright install chromium
   ```
3. Run scraper:
   ```bash
   npm run scrape
   ```

---

## 📡 API Endpoints Summary

| Endpoint | Method | Description |
|---|---|---|
| `/verify-title` | `POST` | Accepts `{"title": "..."}` → Returns status (`LIKELY_APPROVED`, `REVIEW`, `REJECTED`), probability score, reasons, match breakdown, and candidate details. |
| `/register-pending` | `POST` | Accepts `{"title", "language", "state", "periodicity"}` → Registers non-rejected titles into the pending applications database. |
| `/health` | `GET` | Health check endpoint returning database readiness and title counts. |

---

## 📁 Repository Structure

```
SIH_Demo/
├── backend/                  # Python Flask API & Title Engine
│   ├── app.py                # Flask Server entrypoint
│   ├── data/                 # SQLite database & CSV corpus
│   ├── src/                  # Core verification engine (phonetics, similarity, ML)
│   ├── tests/                # Test suite & fixtures
│   └── requirements.txt      # Python dependencies
├── frontend/                 # React + Vite Web UI
│   ├── src/                  # Components, pages & API service
│   ├── package.json          # Frontend dependencies & scripts
│   └── vite.config.ts        # Vite configuration
├── scrapper/                 # Playwright Node.js dataset scraper
│   ├── scrape-prgi.js        # Scraper logic
│   └── package.json          # Scraper dependencies
├── .gitignore                # Global git ignore rules
└── README.md                 # Project Documentation
```

---

## 📜 Disclaimer
This system provides an automated *preliminary* decision-support assessment. Final verification and official approval of any publication title remain the sole responsibility of the Press Registrar General of India (PRGI).
