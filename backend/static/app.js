"use strict";

const $ = (id) => document.getElementById(id);

async function postJSON(url, body) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await resp.json().catch(() => ({}));
  return { ok: resp.ok, status: resp.status, data };
}

function showError(msg) {
  const el = $("error");
  el.textContent = msg;
  el.hidden = !msg;
}

async function verify() {
  const title = $("title").value.trim();
  showError("");
  if (!title) {
    showError("Please enter a title.");
    return;
  }

  const btn = $("verify-btn");
  btn.disabled = true;
  btn.innerHTML = 'Verifying<span class="spinner"></span>';

  const { ok, data } = await postJSON("/verify-title", { title });
  btn.disabled = false;
  btn.textContent = "Verify";

  if (!ok) {
    showError(data.error || "Verification failed.");
    $("result").hidden = true;
    return;
  }
  render(data);
}

function render(r) {
  const badge = $("status-badge");
  badge.textContent = r.status;
  badge.className = "badge " + r.status;

  $("probability").textContent = r.verification_probability + "%";
  $("closest").textContent = (r.top_conflicts && r.top_conflicts.length)
    ? r.top_conflicts.join(", ")
    : "—";
  $("closest-status").textContent = r.closest_match_status || "—";
  $("candidate-count").textContent = String(r.candidate_count);
  $("from-cache").textContent = r.from_cache ? "yes" : "no";

  const reasons = $("reasons");
  reasons.innerHTML = "";
  (r.reasons || []).forEach((t) => {
    const li = document.createElement("li");
    li.textContent = t;
    reasons.appendChild(li);
  });

  const b = r.closest_match_breakdown;
  const breakdown = $("breakdown");
  if (b) {
    $("b-edit").textContent = b.edit_similarity;
    $("b-phonetic").textContent = b.phonetic_similarity;
    $("b-semantic").textContent = b.semantic_similarity;
    $("b-combined").textContent = b.combined_similarity;
    breakdown.hidden = false;
  } else {
    breakdown.hidden = true;
  }

  // Pending-registration available only for non-rejected outcomes.
  $("pending-btn").hidden = r.status === "REJECTED";
  $("result").hidden = false;
}

async function registerPending() {
  const title = $("title").value.trim();
  showError("");
  const btn = $("pending-btn");
  btn.disabled = true;

  const { ok, status, data } = await postJSON("/register-pending", {
    title,
    language: $("language").value.trim(),
    state: $("state").value.trim(),
    periodicity: $("periodicity").value.trim(),
  });
  btn.disabled = false;

  if (!ok) {
    showError(data.error || `Registration failed (${status}).`);
    return;
  }
  showError("");
  $("pending-btn").hidden = true;
  // Refresh the result to reflect the new pending record in the corpus.
  data.closest_match_status = data.closest_match_status;
  alert("Registered as pending (id " + data.id + ").");
}

$("verify-btn").addEventListener("click", verify);
$("pending-btn").addEventListener("click", registerPending);
$("title").addEventListener("keydown", (e) => {
  if (e.key === "Enter") verify();
});