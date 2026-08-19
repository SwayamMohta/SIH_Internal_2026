"""Flask API + UI for PRGI title verification (local-first, single process)."""

from flask import Flask, jsonify, render_template, request

from src import config, db
from src.embeddings import model_is_loaded
from src.pending import register_pending
from src.verify import verify_title

app = Flask(__name__)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/verify-title", methods=["POST"])
def verify():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title is required"}), 400
    try:
        return jsonify(verify_title(title))
    except Exception as exc:  # never expose tracebacks to the client
        app.logger.error("verify failed: %s", exc)
        return jsonify({"error": "verification failed"}), 500


@app.route("/register-pending", methods=["POST"])
def register_pending_route():
    data = request.get_json(silent=True) or {}
    title = (data.get("title") or "").strip()
    if not title:
        return jsonify({"error": "title is required"}), 400
    try:
        result = register_pending(
            title,
            language=data.get("language") or None,
            state=data.get("state") or None,
            periodicity=data.get("periodicity") or None,
        )
    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        app.logger.error("register-pending failed: %s", exc)
        return jsonify({"error": "registration failed"}), 500

    if not result.get("registered"):
        return jsonify(result), 400
    return jsonify(result)


@app.route("/pending-applications", methods=["GET"])
def get_pending_applications():
    try:
        conn = db.connect()
        rows = conn.execute(
            "SELECT id, title_raw, title_normalized, language, state, periodicity, status, created_at "
            "FROM titles WHERE status='pending' ORDER BY id DESC LIMIT 100"
        ).fetchall()
        conn.close()
        results = [
            {
                "id": r["id"],
                "ref_number": f"PRGI-2026-PENDING-{r['id']:05d}",
                "title": r["title_raw"],
                "title_normalized": r["title_normalized"],
                "language": r["language"] or "N/A",
                "state": r["state"] or "N/A",
                "periodicity": r["periodicity"] or "N/A",
                "status": r["status"],
                "created_at": r["created_at"] or ""
            }
            for r in rows
        ]
        return jsonify({"success": True, "applications": results, "count": len(results)})
    except Exception as exc:
        app.logger.error("get_pending_applications failed: %s", exc)
        return jsonify({"error": "Failed to fetch pending applications", "applications": []}), 500


@app.route("/all-applications", methods=["GET"])
def get_all_applications():
    status_filter = (request.args.get("status") or "all").strip().lower()
    try:
        conn = db.connect()
        if status_filter in ["pending", "registered", "rejected"]:
            rows = conn.execute(
                "SELECT id, title_raw, title_normalized, language, state, periodicity, status, created_at "
                "FROM titles WHERE status=? ORDER BY id DESC LIMIT 200",
                (status_filter,)
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, title_raw, title_normalized, language, state, periodicity, status, created_at "
                "FROM titles ORDER BY id DESC LIMIT 200"
            ).fetchall()
        conn.close()
        results = [
            {
                "id": r["id"],
                "ref_number": f"PRGI-2026-REG-{r['id']:05d}" if r["status"] == "registered" else f"PRGI-2026-PENDING-{r['id']:05d}",
                "title": r["title_raw"],
                "title_normalized": r["title_normalized"],
                "language": r["language"] or "N/A",
                "state": r["state"] or "N/A",
                "periodicity": r["periodicity"] or "N/A",
                "status": r["status"],
                "created_at": r["created_at"] or ""
            }
            for r in rows
        ]
        return jsonify({"success": True, "applications": results, "count": len(results)})
    except Exception as exc:
        app.logger.error("get_all_applications failed: %s", exc)
        return jsonify({"error": "Failed to fetch applications", "applications": []}), 500


@app.route("/update-application-status", methods=["POST"])
def update_application_status():
    data = request.get_json() or {}
    app_id = data.get("id")
    ref_number = data.get("ref_number")
    new_status = (data.get("status") or "").strip().lower()

    if new_status not in ["pending", "registered", "rejected"]:
        return jsonify({"error": "Invalid status value"}), 400

    try:
        conn = db.connect()
        target_id = app_id
        if not target_id and ref_number:
            clean_q = ref_number.upper().replace("PRGI-2026-PENDING-", "").replace("PRGI-2026-REG-", "").replace("PRGI-", "").replace("#", "").strip()
            if clean_q.isdigit():
                target_id = int(clean_q)

        if target_id:
            conn.execute("UPDATE titles SET status = ? WHERE id = ?", (new_status, target_id))
            conn.commit()
        conn.close()
        return jsonify({"success": True, "id": target_id, "new_status": new_status})
    except Exception as exc:
        app.logger.error("update_application_status failed: %s", exc)
        return jsonify({"error": "Failed to update status"}), 500


@app.route("/track-application", methods=["GET"])
def track_application():
    query = (request.args.get("q") or "").strip()
    if not query:
        return jsonify({"error": "Search query parameter 'q' is required"}), 400

    try:
        conn = db.connect()
        clean_q = query.upper().replace("PRGI-2026-PENDING-", "").replace("PRGI-2026-REG-", "").replace("PRGI-", "").replace("#", "").strip()
        
        target_id = int(clean_q) if clean_q.isdigit() else None

        if target_id is not None:
            rows = conn.execute(
                "SELECT id, title_raw, title_normalized, language, state, periodicity, status, created_at "
                "FROM titles WHERE id = ? OR title_raw LIKE ? ORDER BY id DESC LIMIT 20",
                (target_id, f"%{query}%")
            ).fetchall()
        else:
            rows = conn.execute(
                "SELECT id, title_raw, title_normalized, language, state, periodicity, status, created_at "
                "FROM titles WHERE title_raw LIKE ? OR title_normalized LIKE ? ORDER BY id DESC LIMIT 20",
                (f"%{query}%", f"%{query.lower()}%")
            ).fetchall()

        conn.close()

        results = [
            {
                "id": r["id"],
                "ref_number": f"PRGI-2026-PENDING-{r['id']:05d}" if r["status"] == "pending" else f"PRGI-2026-REG-{r['id']:05d}",
                "title": r["title_raw"],
                "title_normalized": r["title_normalized"],
                "language": r["language"] or "N/A",
                "state": r["state"] or "N/A",
                "periodicity": r["periodicity"] or "N/A",
                "status": r["status"],
                "created_at": r["created_at"] or ""
            }
            for r in rows
        ]

        return jsonify({"success": True, "results": results, "count": len(results)})
    except Exception as exc:
        app.logger.error("track_application failed: %s", exc)
        return jsonify({"error": "Tracking query failed", "results": []}), 500


@app.route("/health")
def health():
    try:
        conn = db.connect()
        total = conn.execute("SELECT COUNT(*) FROM titles").fetchone()[0]
        registered = conn.execute(
            "SELECT COUNT(*) FROM titles WHERE status='registered'").fetchone()[0]
        pending = conn.execute(
            "SELECT COUNT(*) FROM titles WHERE status='pending'").fetchone()[0]
        conn.close()
        database_ready = True
    except Exception:
        total = registered = pending = 0
        database_ready = False

    return jsonify({
        "status": "ok" if database_ready else "degraded",
        "database_ready": database_ready,
        "total_titles": total,
        "registered_titles": registered,
        "pending_titles": pending,
        "embedding_model_loaded": model_is_loaded(),
        "embedding_dim": config.EMBEDDING_DIM,
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)