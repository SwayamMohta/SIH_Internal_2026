# SIH Demo

This repository is organized into two application folders:

- `frontend/` - React + Vite user interface.
- `backend/` - Python + Flask title verification service.

## Frontend

```bash
cd frontend
npm install
npm run dev
```

The Vite development server is configured for `http://localhost:5173`.

## Backend

```bash
cd backend
pip install -r requirements.txt
python app.py
```

The Flask service runs at `http://127.0.0.1:5000`.

Backend details, dataset commands, API endpoints, and tests are documented in
`backend/README.md`.
