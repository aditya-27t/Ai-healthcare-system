/**
 * View Rendering Module for MedAssist AI
 * Implements all UI screens specified in SRS Sections 2.6, 3.1, 4.1-4.5, and 5.
 */
(function (root, factory) {
  root.MedAssistViews = factory(
    root.MedAssistKnowledge,
    root.MedAssistCrypto,
    root.MedAssistStorage,
    root.MedAssistAuth,
    root.MedAssistAI,
    root.MedAssistAdmin
  );
}(typeof self !== 'undefined' ? self : this, function (Knowledge, Crypto, Storage, Auth, AI, Admin) {
  'use strict';

  const esc = Crypto.escapeHtml;

  function formatDate(iso) {
    if (!iso) return '—';
    try {
      return new Date(iso).toLocaleString();
    } catch (_e) {
      return iso;
    }
  }

  function renderAuthView(authTab = 'login') {
    return `
      <section class="auth-hero">
        <span class="auth-hero__tag">CS3CO40(P) SRS Implementation &bull; Decision-Support Screening</span>
        <h1>AI-Based Health Diagnosis &amp; Preliminary Screening System</h1>
        <p>
          Collect symptoms, duration, severity, and relevant health context to receive an AI-supported
          preliminary assessment with transparent explainability, safety guardrails, and emergency triage.
        </p>

        <div class="auth-feature-list">
          <div class="auth-feature-item">
            <strong>Preliminary Screening, Never a Final Diagnosis</strong>
            <span>Clear medical disclaimers, curated non-fabricated knowledge, and fail-safe handling (FR-AI-06, NFR-SAFE-01..05).</span>
          </div>
          <div class="auth-feature-item">
            <strong>Explainable AI &amp; High-Risk Triage</strong>
            <span>Shows contributing symptom weights and triggers urgent emergency alerts for red-flag combinations (NFR-QUAL-07, FR-RES-04).</span>
          </div>
          <div class="auth-feature-item">
            <strong>Role-Based Security &amp; Model Governance</strong>
            <span>Salted SHA-256 password hashing, strict record isolation, audit logs, and model version rollback (NFR-SEC-01..07, FR-ADM-01..05).</span>
          </div>
        </div>
      </section>

      <section class="auth-card">
        <div class="tabs" role="tablist">
          <button type="button" class="tab-btn ${authTab === 'login' ? 'active' : ''}" data-action="switch-auth-tab" data-tab="login">Sign In</button>
          <button type="button" class="tab-btn ${authTab === 'register' ? 'active' : ''}" data-action="switch-auth-tab" data-tab="register">Create Account</button>
        </div>

        ${authTab === 'login' ? `
          <form id="login-form" novalidate>
            <div class="form-group">
              <label class="form-label" for="login-email">Email Address</label>
              <input class="input" id="login-email" name="email" type="email" required placeholder="you@example.com" autocomplete="username" />
            </div>
            <div class="form-group">
              <label class="form-label" for="login-password">Password</label>
              <input class="input" id="login-password" name="password" type="password" required placeholder="Enter password" autocomplete="current-password" />
            </div>
            <div id="auth-error" class="form-error hidden"></div>
            <button type="submit" class="btn btn--primary btn--full" style="margin-top: 10px;">Sign In Securely</button>
          </form>

          <div class="demo-box">
            <div class="demo-box__title">Quick Demo Role Sign-In (SRS 2.3 User Classes)</div>
            <div class="demo-btns">
              <button type="button" class="btn btn--outline btn--sm" data-action="demo-login" data-email="patient@medassist.demo" data-pass="Patient@123">General User</button>
              <button type="button" class="btn btn--outline btn--sm" data-action="demo-login" data-email="reviewer@medassist.demo" data-pass="Reviewer@123">Healthcare Reviewer</button>
              <button type="button" class="btn btn--outline btn--sm" data-action="demo-login" data-email="admin@medassist.demo" data-pass="Admin@123">System Admin</button>
              <button type="button" class="btn btn--outline btn--sm" data-action="demo-login" data-email="mlops@medassist.demo" data-pass="Mlops@123">AI/ML Maintainer</button>
            </div>
          </div>
        ` : `
          <form id="register-form" novalidate>
            <div class="form-group">
              <label class="form-label" for="reg-name">Full Name</label>
              <input class="input" id="reg-name" name="name" type="text" required placeholder="e.g. Riya Sharma" />
            </div>
            <div class="form-group">
              <label class="form-label" for="reg-email">Email Address</label>
              <input class="input" id="reg-email" name="email" type="email" required placeholder="riya@example.com" />
            </div>
            <div class="grid grid--2">
              <div class="form-group">
                <label class="form-label" for="reg-age">Age</label>
                <input class="input" id="reg-age" name="age" type="number" min="1" max="120" placeholder="25" />
              </div>
              <div class="form-group">
                <label class="form-label" for="reg-gender">Gender</label>
                <select class="select" id="reg-gender" name="gender">
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                  <option value="Prefer not to say">Prefer not to say</option>
                </select>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="reg-password">Password (min 8 characters)</label>
              <input class="input" id="reg-password" name="password" type="password" required placeholder="Minimum 8 characters" />
              <div class="form-hint">Stored using salted SHA-256 hashing — never in plaintext (NFR-SEC-05).</div>
            </div>
            <div id="auth-error" class="form-error hidden"></div>
            <button type="submit" class="btn btn--primary btn--full" style="margin-top: 10px;">Register Account</button>
          </form>
        `}
      </section>
    `;
  }

  function renderDashboardView(user) {
    const assessments = Auth.getAccessibleAssessments().filter((a) => a.userId === user.id);
    const activeModel = AI.getActiveModel();
    const settings = Storage.getSettings();
    const pendingReports = Storage.getReports().filter((r) => r.status === 'PENDING_REVIEW').length;

    return `
      <div class="alert alert--info">
        <div class="alert__title">Welcome, ${esc(user.name)} (${esc(Auth.ROLE_LABELS[user.role])})</div>
        <div>
          This platform provides AI-assisted <strong>preliminary symptom screening</strong>. Always consult a licensed physician for clinical diagnosis and treatment.
        </div>
      </div>

      ${settings.simulateAiFailure ? `
        <div class="alert alert--danger">
          <div class="alert__title">AI Diagnostic Service Simulation Active (FR-AI-07 / NFR-SAFE-05)</div>
          <div>Simulated AI failure mode is enabled in System Settings. New assessments will safely return an unavailable notice without false predictions.</div>
        </div>
      ` : ''}

      <div class="grid grid--4" style="margin-bottom: 18px;">
        <div class="stat-card">
          <div class="stat-card__label">Your Assessments</div>
          <div class="stat-card__value">${assessments.length}</div>
          <div class="stat-card__hint">Stored securely under RBAC</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Active AI Model</div>
          <div class="stat-card__value" style="font-size: 1.05rem; margin-top: 10px;">${activeModel ? esc(activeModel.version) : 'None Active'}</div>
          <div class="stat-card__hint">${activeModel ? `Accuracy ${(activeModel.metrics.accuracy * 100).toFixed(1)}%` : 'Fail-safe active'}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Emergency Triage</div>
          <div class="stat-card__value" style="font-size: 1.15rem; margin-top: 10px;">${settings.emergencyRulesEnabled ? 'Enabled' : 'Disabled'}</div>
          <div class="stat-card__hint">4 high-risk clinical rules</div>
        </div>
        <div class="stat-card">
          <div class="stat-card__label">Pending Safety Flags</div>
          <div class="stat-card__value">${pendingReports}</div>
          <div class="stat-card__hint">Reviewer feedback queue</div>
        </div>
      </div>

      <div class="grid grid--2">
        <div class="card">
          <div class="card__header">
            <div>
              <h2 class="card__title">Start a Preliminary Health Assessment</h2>
              <p class="card__subtitle">Enter symptoms, duration, severity, and health context (NFR-QUAL-02)</p>
            </div>
          </div>
          <p style="font-size: 0.9rem; color: var(--text-secondary);">
            Our AI engine preprocesses your symptoms, checks for emergency red-flag combinations, and ranks possible conditions with explainable factors in under 5 seconds.
          </p>
          <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-top: 14px;">
            <button class="btn btn--primary" type="button" data-action="navigate" data-view="assess">New Symptom Assessment</button>
            <button class="btn btn--outline" type="button" data-action="navigate" data-view="help">Quick-Start &amp; Safety Guide</button>
          </div>
        </div>

        <div class="card">
          <div class="card__header">
            <div>
              <h2 class="card__title">Recent Assessments</h2>
              <p class="card__subtitle">Your latest screening records (FR-RES-05)</p>
            </div>
            <button class="btn btn--ghost btn--sm" type="button" data-action="navigate" data-view="history">View All</button>
          </div>
          ${assessments.length === 0 ? `
            <p style="color: var(--text-muted); font-size: 0.88rem;">No assessments recorded yet. Click "New Symptom Assessment" to begin.</p>
          ` : `
            <div class="table-wrap">
              <table>
                <thead>
                  <tr><th>Date</th><th>Top Condition</th><th>Model</th><th></th></tr>
                </thead>
                <tbody>
                  ${assessments.slice(0, 4).map((a) => `
                    <tr>
                      <td>${esc(formatDate(a.createdAt))}</td>
                      <td>${a.predictions && a.predictions[0] ? esc(a.predictions[0].name) : esc(a.status)}</td>
                      <td><span class="pill pill--neutral mono">${esc(a.modelVersion)}</span></td>
                      <td><button class="btn btn--outline btn--sm" type="button" data-action="view-assessment" data-id="${esc(a.id)}">Open</button></td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          `}
        </div>
      </div>
    `;
  }

  function renderAssessmentFormView(user, draft) {
    const grouped = {};
    Knowledge.SYMPTOMS.forEach((s) => {
      if (!grouped[s.category]) grouped[s.category] = [];
      grouped[s.category].push(s);
    });

    const selectedIds = new Set(draft.symptoms.map((s) => s.id || s.name.toLowerCase()));
    const query = (draft.searchQuery || '').toLowerCase().trim();

    return `
      <div class="alert alert--warning">
        <div class="alert__title">Symptom-Entry Guidance (Section 2.6 &amp; 4.2)</div>
        <div>Select all applicable symptoms, enter accurate duration (days) and severity, and provide your age and gender. All fields are validated before AI inference.</div>
      </div>

      <div class="card">
        <div class="card__header">
          <div>
            <h2 class="card__title">Quick Clinical Presets (For Demonstration)</h2>
            <p class="card__subtitle">Load sample symptom profiles or enter your own below</p>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button type="button" class="btn btn--outline btn--sm" data-action="load-preset" data-preset="flu">Flu-Like Symptoms</button>
            <button type="button" class="btn btn--outline btn--sm" data-action="load-preset" data-preset="migraine">Migraine Pattern</button>
            <button type="button" class="btn btn--outline btn--sm" data-action="load-preset" data-preset="emergency">High-Risk Cardiac Alert</button>
            <button type="button" class="btn btn--ghost btn--sm" data-action="clear-draft">Clear Form</button>
          </div>
        </div>
      </div>

      <form id="assessment-form" novalidate>
        <div class="card">
          <div class="card__header">
            <div>
              <h2 class="card__title">1. Patient Demographics &amp; Health Context</h2>
              <p class="card__subtitle">Required basic health information (SRS 3.1)</p>
            </div>
          </div>

          <div class="grid grid--3">
            <div class="form-group">
              <label class="form-label" for="asm-age">Age (Years) *</label>
              <input class="input" id="asm-age" name="age" type="number" min="0" max="120" value="${esc(draft.age)}" placeholder="e.g. 28" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="asm-gender">Gender *</label>
              <select class="select" id="asm-gender" name="gender">
                ${['Male', 'Female', 'Other', 'Prefer not to say'].map((g) => `<option value="${g}" ${draft.gender === g ? 'selected' : ''}>${g}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" for="asm-temp">Body Temperature (°C, optional)</label>
              <input class="input" id="asm-temp" name="temperatureC" type="number" step="0.1" min="33" max="43" value="${esc(draft.temperatureC)}" placeholder="e.g. 38.2" />
            </div>
          </div>

          <div class="grid grid--2">
            <div class="form-group">
              <label class="form-label" for="asm-conditions">Existing Medical Conditions (optional)</label>
              <input class="input" id="asm-conditions" name="existingConditions" type="text" value="${esc(draft.existingConditions)}" placeholder="e.g. Asthma, Hypertension, None" />
            </div>
            <div class="form-group">
              <label class="form-label" for="asm-allergies">Known Allergies (optional)</label>
              <input class="input" id="asm-allergies" name="allergies" type="text" value="${esc(draft.allergies)}" placeholder="e.g. Penicillin, Pollen, None" />
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card__header">
            <div>
              <h2 class="card__title">2. Select or Enter Symptoms (FR-DATA-01)</h2>
              <p class="card__subtitle">Click symptom chips to add them, or type a custom symptom below</p>
            </div>
          </div>

          <div class="grid grid--2" style="margin-bottom: 14px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" for="symptom-search">Filter Symptom Catalog</label>
              <input class="input" id="symptom-search" type="search" value="${esc(draft.searchQuery || '')}" placeholder="Search e.g. fever, cough, headache, chest..." />
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" for="custom-symptom-input">Add Custom Symptom</label>
              <div style="display: flex; gap: 8px;">
                <input class="input" id="custom-symptom-input" type="text" placeholder="Type another symptom name" />
                <button type="button" class="btn btn--outline" data-action="add-custom-symptom">Add</button>
              </div>
            </div>
          </div>

          ${Object.keys(grouped).map((cat) => {
            const filtered = grouped[cat].filter((s) =>
              !query ||
              s.name.toLowerCase().includes(query) ||
              s.aliases.some((a) => a.toLowerCase().includes(query))
            );
            if (filtered.length === 0) return '';
            return `
              <div class="symptom-category">
                <div class="symptom-category__title">${esc(cat)}</div>
                <div class="chip-pool">
                  ${filtered.map((s) => {
                    const isSelected = selectedIds.has(s.id);
                    return `<button type="button" class="symptom-chip ${isSelected ? 'selected' : ''}" data-action="toggle-symptom" data-symptom-id="${esc(s.id)}">${esc(s.name)}${s.redFlag ? ' &#9888;' : ''}</button>`;
                  }).join('')}
                </div>
              </div>
            `;
          }).join('')}
        </div>

        <div class="card">
          <div class="card__header">
            <div>
              <h2 class="card__title">3. Symptom Duration &amp; Severity (FR-DATA-02)</h2>
              <p class="card__subtitle">${draft.symptoms.length} symptom(s) currently selected</p>
            </div>
          </div>

          ${draft.symptoms.length === 0 ? `
            <p style="color: var(--text-muted); font-size: 0.88rem;">No symptoms selected yet. Select at least one symptom above to configure duration and severity.</p>
          ` : draft.symptoms.map((sym, idx) => `
            <div class="selected-symptom-row">
              <div>
                <strong>${esc(sym.name)}</strong>
                ${sym.redFlag ? '<span class="pill pill--danger" style="margin-left:6px;">Red Flag</span>' : ''}
              </div>
              <div>
                <label class="form-label" style="font-size: 0.74rem; margin-bottom: 2px;">Duration (Days)</label>
                <input class="input" type="number" min="1" max="365" value="${esc(sym.durationDays)}" data-symptom-field="durationDays" data-index="${idx}" />
              </div>
              <div>
                <label class="form-label" style="font-size: 0.74rem; margin-bottom: 2px;">Severity</label>
                <select class="select" data-symptom-field="severity" data-index="${idx}">
                  <option value="mild" ${sym.severity === 'mild' ? 'selected' : ''}>Mild</option>
                  <option value="moderate" ${sym.severity === 'moderate' ? 'selected' : ''}>Moderate</option>
                  <option value="severe" ${sym.severity === 'severe' ? 'selected' : ''}>Severe</option>
                </select>
              </div>
              <button type="button" class="btn btn--ghost btn--sm" data-action="remove-symptom" data-index="${idx}" aria-label="Remove symptom">&times; Remove</button>
            </div>
          `).join('')}

          <div id="assessment-validation-errors" class="alert alert--danger ${draft.validationErrors && draft.validationErrors.length ? '' : 'hidden'}" style="margin-top: 12px;">
            <div class="alert__title">Please correct the following input errors (FR-DATA-03..05):</div>
            <ul style="margin: 6px 0 0 18px; padding: 0;">
              ${(draft.validationErrors || []).map((e) => `<li>${esc(e)}</li>`).join('')}
            </ul>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px; margin-top: 16px;">
            <button type="submit" class="btn btn--primary">Run AI Preliminary Assessment</button>
          </div>
        </div>
      </form>
    `;
  }

  function renderResultsView(assessment) {
    if (!assessment) {
      return `<div class="alert alert--warning"><div class="alert__title">No Assessment Selected</div><p>Start a new assessment or open one from History.</p></div>`;
    }

    return `
      <!-- Prominent Disclaimer (FR-AI-06, FR-RES-02, NFR-SAFE-01/02) -->
      <div class="alert alert--warning">
        <div class="alert__title">Medical Disclaimer: Preliminary Screening Only — NOT a Confirmed Diagnosis</div>
        <div>
          The conditions listed below are statistical AI-supported possibilities based on your reported symptoms. They do <strong>not</strong> confirm any medical diagnosis or replace evaluation by a qualified healthcare professional.
        </div>
      </div>

      <!-- Emergency High-Risk Warnings (FR-RES-04, NFR-SAFE-03) -->
      ${assessment.emergencyAlerts && assessment.emergencyAlerts.length > 0 ? assessment.emergencyAlerts.map((alert) => `
        <div class="alert alert--danger">
          <div class="alert__title">&#9888; URGENT EMERGENCY GUIDANCE: ${esc(alert.title)}</div>
          <div><strong>Trigger:</strong> ${esc(alert.condition)}</div>
          <div style="margin-top: 6px;"><strong>Recommended Immediate Action:</strong> ${esc(alert.guidance)}</div>
        </div>
      `).join('') : ''}

      <div class="card">
        <div class="card__header">
          <div>
            <h2 class="card__title">Assessment Summary &amp; Telemetry</h2>
            <p class="card__subtitle">Assessment ID: <span class="mono">${esc(assessment.id)}</span> &bull; ${esc(formatDate(assessment.createdAt))}</p>
          </div>
          <div style="display: flex; gap: 8px; flex-wrap: wrap;" class="no-print">
            <button type="button" class="btn btn--outline btn--sm" data-action="print-report">Print / Save PDF</button>
            <button type="button" class="btn btn--outline btn--sm" data-action="open-flag-modal" data-id="${esc(assessment.id)}">Report Incorrect / Unsafe Result</button>
            <button type="button" class="btn btn--primary btn--sm" data-action="navigate" data-view="assess">New Assessment</button>
          </div>
        </div>

        <div class="grid grid--4">
          <div class="stat-card">
            <div class="stat-card__label">Patient Profile</div>
            <div class="stat-card__value" style="font-size: 1.05rem;">Age ${esc(assessment.input.age)} &bull; ${esc(assessment.input.gender)}</div>
            <div class="stat-card__hint">${assessment.input.temperatureC ? `Temp: ${esc(assessment.input.temperatureC)} °C` : 'Temp not provided'}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__label">AI Model Version (FR-AI-05)</div>
            <div class="stat-card__value mono" style="font-size: 0.95rem;">${esc(assessment.modelVersion)}</div>
            <div class="stat-card__hint">Recorded for auditability</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__label">Inference Speed (NFR-PERF-01)</div>
            <div class="stat-card__value">${esc(assessment.latencyMs)} ms</div>
            <div class="stat-card__hint">${assessment.cacheHit ? 'Cache hit (NFR-PERF-04)' : 'Fresh inference (<5s SLA)'}</div>
          </div>
          <div class="stat-card">
            <div class="stat-card__label">Reported Symptoms</div>
            <div class="stat-card__value">${assessment.input.symptoms.length}</div>
            <div class="stat-card__hint">Validated &amp; preprocessed</div>
          </div>
        </div>

        <div style="margin-top: 14px;">
          <strong>Submitted Symptoms:</strong>
          <div class="explain-factors">
            ${assessment.input.symptoms.map((s) => `<span class="pill pill--neutral">${esc(s.name)} (${esc(s.severity)}, ${esc(s.durationDays)}d)</span>`).join('')}
          </div>
        </div>
      </div>

      ${assessment.status === 'INSUFFICIENT_INFO' ? `
        <div class="card">
          <h2 class="card__title">Insufficient Information for Reliable Screening (FR-AI-04)</h2>
          <p style="color: var(--text-secondary); margin-top: 8px;">${esc(assessment.insufficientReason)}</p>
          <button type="button" class="btn btn--primary" data-action="navigate" data-view="assess">Add More Specific Symptoms</button>
        </div>
      ` : `
        <div class="card">
          <div class="card__header">
            <div>
              <h2 class="card__title">Ranked Possible Health Conditions (FR-AI-03, FR-RES-01)</h2>
              <p class="card__subtitle">Ordered by preliminary symptom likelihood score — includes explainability factors (NFR-QUAL-07)</p>
            </div>
          </div>

          ${assessment.predictions.map((pred, idx) => {
            const pct = Math.round(pred.probability * 100);
            return `
              <div class="condition-card ${idx === 0 ? 'condition-card--top' : ''}">
                <div class="condition-card__head">
                  <div>
                    <span class="pill ${idx === 0 ? 'pill--info' : 'pill--neutral'}">Possible Condition #${idx + 1} &bull; ${esc(pred.category)}</span>
                    <h3 style="margin: 8px 0 4px; font-size: 1.08rem;">${esc(pred.name)}</h3>
                  </div>
                  <div style="text-align: right;">
                    <div style="font-size: 1.35rem; font-weight: 800; color: var(--brand-primary);">${pct}%</div>
                    <div style="font-size: 0.74rem; color: var(--text-muted);">Preliminary Match Score</div>
                  </div>
                </div>

                <div class="progress-track" aria-label="Confidence ${pct}%">
                  <div class="progress-fill" style="width: ${pct}%;"></div>
                </div>

                <p style="font-size: 0.89rem; color: var(--text-secondary); margin: 8px 0;">${esc(pred.overview)}</p>

                <div class="explain-box">
                  <strong>Why the AI ranked this condition (Explainability — NFR-QUAL-07):</strong>
                  <ul style="margin: 6px 0 0 18px; padding: 0;">
                    ${pred.factors.map((f) => `<li>${esc(f)}</li>`).join('')}
                  </ul>
                </div>

                <div style="margin-top: 10px;">
                  <strong style="font-size: 0.85rem;">General Health Information &amp; Next Steps (FR-RES-03):</strong>
                  <ul style="margin: 4px 0 0 18px; padding: 0; font-size: 0.86rem; color: var(--text-secondary);">
                    ${pred.guidance.map((g) => `<li>${esc(g)}</li>`).join('')}
                  </ul>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      `}
    `;
  }

  function renderHistoryView(user) {
    const records = Auth.getAccessibleAssessments();
    const isReviewerOrAdmin = user.role === Auth.ROLES.HEALTHCARE_REVIEWER || user.role === Auth.ROLES.SYSTEM_ADMIN;

    return `
      <div class="card">
        <div class="card__header">
          <div>
            <h2 class="card__title">Assessment History (FR-RES-05, FR-AUTH-04)</h2>
            <p class="card__subtitle">
              ${isReviewerOrAdmin
                ? 'Showing assessments accessible under your Reviewer/Admin RBAC permissions.'
                : 'Showing only your personal health assessments. Access to other users\' records is strictly blocked.'}
            </p>
          </div>
          <button type="button" class="btn btn--primary btn--sm" data-action="navigate" data-view="assess">+ New Assessment</button>
        </div>

        ${records.length === 0 ? `
          <p style="color: var(--text-muted);">No assessment history found.</p>
        ` : `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  ${isReviewerOrAdmin ? '<th>User</th>' : ''}
                  <th>Symptoms</th>
                  <th>Top Possibility</th>
                  <th>Risk Flag</th>
                  <th>Model Version</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                ${records.map((r) => `
                  <tr>
                    <td>${esc(formatDate(r.createdAt))}</td>
                    ${isReviewerOrAdmin ? `<td>${esc(r.userName)}</td>` : ''}
                    <td>${esc(r.input.symptoms.map((s) => s.name).join(', '))}</td>
                    <td>${r.predictions && r.predictions[0] ? `${esc(r.predictions[0].name)} (${Math.round(r.predictions[0].probability * 100)}%)` : esc(r.status)}</td>
                    <td>${r.emergencyAlerts && r.emergencyAlerts.length > 0 ? '<span class="pill pill--danger">Emergency Flag</span>' : '<span class="pill pill--secure">Standard</span>'}</td>
                    <td><span class="pill pill--neutral mono">${esc(r.modelVersion)}</span></td>
                    <td><button type="button" class="btn btn--outline btn--sm" data-action="view-assessment" data-id="${esc(r.id)}">View Results</button></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }

  function renderProfileView(user) {
    const p = user.profile || {};
    return `
      <div class="grid grid--2">
        <div class="card">
          <div class="card__header">
            <div>
              <h2 class="card__title">Personal &amp; Health Information Profile (SRS 3.1)</h2>
              <p class="card__subtitle">Pre-populates your future symptom assessments</p>
            </div>
          </div>
          <form id="profile-form">
            <div class="form-group">
              <label class="form-label" for="prof-name">Full Name</label>
              <input class="input" id="prof-name" name="name" type="text" value="${esc(user.name)}" required />
            </div>
            <div class="grid grid--2">
              <div class="form-group">
                <label class="form-label" for="prof-age">Age</label>
                <input class="input" id="prof-age" name="age" type="number" min="0" max="120" value="${esc(p.age)}" />
              </div>
              <div class="form-group">
                <label class="form-label" for="prof-gender">Gender</label>
                <select class="select" id="prof-gender" name="gender">
                  ${['Male', 'Female', 'Other', 'Prefer not to say'].map((g) => `<option value="${g}" ${p.gender === g ? 'selected' : ''}>${g}</option>`).join('')}
                </select>
              </div>
            </div>
            <div class="grid grid--2">
              <div class="form-group">
                <label class="form-label" for="prof-blood">Blood Group</label>
                <input class="input" id="prof-blood" name="bloodGroup" type="text" value="${esc(p.bloodGroup)}" placeholder="e.g. O+" />
              </div>
              <div class="form-group">
                <label class="form-label" for="prof-ec">Emergency Contact</label>
                <input class="input" id="prof-ec" name="emergencyContact" type="text" value="${esc(p.emergencyContact)}" placeholder="Name / Phone" />
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="prof-allergies">Known Allergies</label>
              <input class="input" id="prof-allergies" name="allergies" type="text" value="${esc(p.allergies)}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="prof-chronic">Chronic Conditions</label>
              <input class="input" id="prof-chronic" name="chronicConditions" type="text" value="${esc(p.chronicConditions)}" />
            </div>
            <div class="form-group">
              <label class="form-label" for="prof-meds">Current Medications</label>
              <input class="input" id="prof-meds" name="medications" type="text" value="${esc(p.medications)}" />
            </div>
            <button type="submit" class="btn btn--primary">Save Profile</button>
          </form>
        </div>

        <div class="card">
          <div class="card__header">
            <div>
              <h2 class="card__title">Account Security &amp; Password (NFR-SEC-05)</h2>
              <p class="card__subtitle">Role: ${esc(Auth.ROLE_LABELS[user.role])} &bull; Email: ${esc(user.email)}</p>
            </div>
          </div>
          <form id="password-form">
            <div class="form-group">
              <label class="form-label" for="pwd-current">Current Password</label>
              <input class="input" id="pwd-current" name="currentPassword" type="password" required />
            </div>
            <div class="form-group">
              <label class="form-label" for="pwd-new">New Password (min 8 chars)</label>
              <input class="input" id="pwd-new" name="newPassword" type="password" required />
            </div>
            <button type="submit" class="btn btn--outline">Update Password</button>
          </form>
        </div>
      </div>
    `;
  }

  function renderReviewerView() {
    const res = Admin.getReports();
    if (!res.ok) {
      return `<div class="alert alert--danger"><div class="alert__title">Access Denied</div><div>${esc(res.error)}</div></div>`;
    }
    const reports = res.reports;

    return `
      <div class="card">
        <div class="card__header">
          <div>
            <h2 class="card__title">Healthcare Reviewer Queue — Flagged Results (SRS 2.3, NFR-SAFE-06)</h2>
            <p class="card__subtitle">Review user-reported potentially incorrect or unsafe AI screening outputs</p>
          </div>
        </div>

        ${reports.length === 0 ? `<p style="color: var(--text-muted);">No flagged reports at this time.</p>` : `
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Reported</th>
                  <th>Reporter</th>
                  <th>Reason &amp; Details</th>
                  <th>Status</th>
                  <th>Clinical Review Actions</th>
                </tr>
              </thead>
              <tbody>
                ${reports.map((r) => `
                  <tr>
                    <td>${esc(formatDate(r.createdAt))}<br><span class="mono" style="font-size:0.74rem; color:var(--text-muted);">${esc(r.assessmentId)}</span></td>
                    <td>${esc(r.reportedByName)}</td>
                    <td>
                      <strong>${esc(r.reason)}</strong>
                      <div style="font-size:0.82rem; color:var(--text-secondary);">${esc(r.details)}</div>
                      ${r.reviewerNotes ? `<div style="margin-top:4px; font-size:0.8rem; color:var(--brand-primary);">Reviewer note (${esc(r.reviewedBy)}): ${esc(r.reviewerNotes)}</div>` : ''}
                    </td>
                    <td>
                      <span class="pill ${r.status === 'PENDING_REVIEW' ? 'pill--warning' : r.status === 'ESCALATED_TO_MLOPS' ? 'pill--danger' : 'pill--secure'}">${esc(r.status)}</span>
                    </td>
                    <td>
                      <div style="display:flex; gap:6px; flex-wrap:wrap;">
                        <button type="button" class="btn btn--outline btn--sm" data-action="view-assessment" data-id="${esc(r.assessmentId)}">Inspect Case</button>
                        <button type="button" class="btn btn--primary btn--sm" data-action="resolve-report" data-report-id="${esc(r.id)}" data-status="REVIEWED_VERIFIED">Verify</button>
                        <button type="button" class="btn btn--danger btn--sm" data-action="resolve-report" data-report-id="${esc(r.id)}" data-status="ESCALATED_TO_MLOPS">Escalate</button>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>

      <div class="card">
        <div class="card__header">
          <div>
            <h2 class="card__title">Curated Clinical Knowledge Base (${Knowledge.CONDITIONS.length} Conditions, ${Knowledge.SYMPTOMS.length} Symptoms)</h2>
            <p class="card__subtitle">Verified non-fabricated medical reference data (NFR-SAFE-04)</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Condition</th><th>Category</th><th>Key Weighted Symptoms</th></tr></thead>
            <tbody>
              ${Knowledge.CONDITIONS.map((c) => `
                <tr>
                  <td><strong>${esc(c.name)}</strong></td>
                  <td>${esc(c.category)}</td>
                  <td>${esc(Object.keys(c.symptomWeights).join(', '))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderModelManagementView(user) {
    const models = Admin.getModels();
    const settings = Storage.getSettings();
    const canManage = user.role === Auth.ROLES.AIML_MAINTAINER || user.role === Auth.ROLES.SYSTEM_ADMIN;

    return `
      ${!canManage ? `<div class="alert alert--danger"><div class="alert__title">Access Restricted</div><div>Only AI/ML Maintainers or System Administrators can modify model versions (FR-ADM-01).</div></div>` : ''}

      <div class="card">
        <div class="card__header">
          <div>
            <h2 class="card__title">AI/ML Model Version Registry (FR-ADM-02, FR-ADM-04, FR-ADM-05, NFR-QUAL-04)</h2>
            <p class="card__subtitle">Evaluate metrics, disable faulty models, or restore approved previous versions without system redesign</p>
          </div>
          <label style="display:flex; align-items:center; gap:8px; font-size:0.86rem; font-weight:600;">
            <input type="checkbox" id="toggle-simulate-failure" ${settings.simulateAiFailure ? 'checked' : ''} ${!canManage ? 'disabled' : ''} />
            Simulate AI Inference Outage (Test FR-AI-07 / NFR-SAFE-05)
          </label>
        </div>

        <div class="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Model Version</th>
                <th>Status</th>
                <th>Validation Metrics</th>
                <th>Release / Fault Notes</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              ${models.map((m) => `
                <tr>
                  <td>
                    <strong class="mono">${esc(m.version)}</strong>
                    <div style="font-size:0.8rem; color:var(--text-secondary);">${esc(m.displayName)}</div>
                    <div style="font-size:0.75rem; color:var(--text-muted);">${esc(m.algorithm)}</div>
                  </td>
                  <td>
                    <span class="pill ${m.status === 'ACTIVE' ? 'pill--secure' : m.status === 'APPROVED_STANDBY' ? 'pill--info' : 'pill--danger'}">${esc(m.status)}</span>
                  </td>
                  <td style="font-size:0.82rem;">
                    Accuracy: <strong>${(m.metrics.accuracy * 100).toFixed(1)}%</strong><br>
                    Precision: ${(m.metrics.precision * 100).toFixed(1)}% &bull; Recall: ${(m.metrics.recall * 100).toFixed(1)}%<br>
                    Avg Latency: ${m.metrics.avgLatencyMs} ms
                  </td>
                  <td style="font-size:0.82rem; color:var(--text-secondary);">
                    ${esc(m.releaseNotes)}
                    ${m.faultReason ? `<div style="color:var(--danger); margin-top:4px;"><strong>Fault Note:</strong> ${esc(m.faultReason)}</div>` : ''}
                  </td>
                  <td>
                    ${canManage ? `
                      <div style="display:flex; gap:6px; flex-direction:column;">
                        ${m.status !== 'ACTIVE' ? `<button type="button" class="btn btn--primary btn--sm" data-action="restore-model" data-version="${esc(m.version)}">Activate / Restore</button>` : ''}
                        ${m.status !== 'DISABLED_FAULTY' ? `<button type="button" class="btn btn--danger btn--sm" data-action="disable-model" data-version="${esc(m.version)}">Disable Faulty</button>` : ''}
                      </div>
                    ` : '—'}
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderAdminView() {
    const usersRes = Admin.getAllUsersAdmin();
    const logsRes = Admin.getAuditLogs();
    const settings = Storage.getSettings();

    if (!usersRes.ok) {
      return `<div class="alert alert--danger"><div class="alert__title">Access Denied</div><div>${esc(usersRes.error)}</div></div>`;
    }

    return `
      <div class="card">
        <div class="card__header">
          <div>
            <h2 class="card__title">User &amp; Role-Based Access Management (FR-ADM-01, NFR-SEC-03/07)</h2>
            <p class="card__subtitle">Manage registered accounts, roles, and account activation status</p>
          </div>
          <button type="button" class="btn btn--outline btn--sm" data-action="reset-demo-data">Reset Demo Database</button>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>User</th><th>Email</th><th>Role</th><th>Status</th><th>Controls</th></tr></thead>
            <tbody>
              ${usersRes.users.map((u) => `
                <tr>
                  <td><strong>${esc(u.name)}</strong></td>
                  <td class="mono" style="font-size:0.82rem;">${esc(u.email)}</td>
                  <td>
                    <select class="select" data-action="change-user-role" data-user-id="${esc(u.id)}" style="padding:4px 8px; font-size:0.82rem;">
                      ${Object.keys(Auth.ROLES).map((r) => `<option value="${r}" ${u.role === r ? 'selected' : ''}>${esc(Auth.ROLE_LABELS[r])}</option>`).join('')}
                    </select>
                  </td>
                  <td><span class="pill ${u.active ? 'pill--secure' : 'pill--danger'}">${u.active ? 'Active' : 'Disabled'}</span></td>
                  <td>
                    <button type="button" class="btn btn--outline btn--sm" data-action="toggle-user-active" data-user-id="${esc(u.id)}" data-active="${!u.active}">
                      ${u.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="card">
        <div class="card__header">
          <div>
            <h2 class="card__title">Safety &amp; Engine Configuration</h2>
          </div>
        </div>
        <div style="display:flex; gap:18px; flex-wrap:wrap;">
          <label style="display:flex; align-items:center; gap:8px; font-size:0.88rem;">
            <input type="checkbox" id="toggle-emergency-rules" ${settings.emergencyRulesEnabled ? 'checked' : ''} />
            High-Risk Emergency Triage Rules Enabled (FR-RES-04)
          </label>
          <label style="display:flex; align-items:center; gap:8px; font-size:0.88rem;">
            <input type="checkbox" id="toggle-simulate-failure-admin" ${settings.simulateAiFailure ? 'checked' : ''} />
            Simulate AI Service Outage (FR-AI-07)
          </label>
        </div>
      </div>

      <div class="card">
        <div class="card__header">
          <div>
            <h2 class="card__title">Audit &amp; Security Event Log (FR-ADM-03, NFR-SEC-06)</h2>
            <p class="card__subtitle">Latest ${logsRes.logs.length} security, inference, and administrative events</p>
          </div>
        </div>
        <div class="table-wrap" style="max-height: 360px; overflow-y: auto;">
          <table>
            <thead><tr><th>Timestamp</th><th>Category</th><th>Severity</th><th>Actor</th><th>Action &amp; Details</th></tr></thead>
            <tbody>
              ${logsRes.logs.slice(0, 60).map((l) => `
                <tr>
                  <td style="white-space:nowrap; font-size:0.78rem;">${esc(formatDate(l.timestamp))}</td>
                  <td><span class="pill pill--neutral">${esc(l.category)}</span></td>
                  <td><span class="pill ${l.severity === 'HIGH' || l.severity === 'ERROR' ? 'pill--danger' : l.severity === 'WARN' ? 'pill--warning' : 'pill--info'}">${esc(l.severity)}</span></td>
                  <td style="font-size:0.82rem;">${esc(l.actorName)}<br><span style="color:var(--text-muted); font-size:0.74rem;">${esc(l.actorRole)}</span></td>
                  <td style="font-size:0.82rem;"><strong class="mono">${esc(l.action)}</strong><br>${esc(l.details)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderHelpDocsView() {
    const matrix = [
      ['FR-AUTH-01..04', 'Registration, salted SHA-256 login, logout, and strict per-user health record isolation', 'authService.js, cryptoService.js'],
      ['FR-DATA-01..05', 'Multi-symptom selection/custom entry, duration & severity capture, required/invalid input rejection', 'validationService.js, Symptom Form'],
      ['FR-AI-01..07', 'Preprocessing, active model inference, ranked conditions, insufficient-info guard, model version logging, no confirmed diagnosis claim, safe failure', 'aiEngine.js'],
      ['FR-RES-01..05', 'Possible conditions display, prominent disclaimer, general guidance, emergency red-flag alerts, RBAC-scoped history', 'aiEngine.js, views.js'],
      ['FR-ADM-01..05', 'Role-based admin panel, AI model version registry, audit logs, disable faulty model, restore approved previous model', 'adminService.js'],
      ['NFR-PERF-01..04', 'Sub-50ms deterministic assessment (<5s SLA), pre-inference validation, request deduplication cache', 'aiEngine.js, validationService.js'],
      ['NFR-SAFE-01..06', 'Preliminary disclaimers, emergency triage rules, curated non-fabricated knowledge, fail-safe errors, safety reporting queue', 'medicalKnowledge.js, adminService.js'],
      ['NFR-SEC-01..07', 'Auth gate, encrypted transport indicator, RBAC, salted SHA-256 passwords, security event audit logging', 'authService.js, cryptoService.js'],
      ['NFR-QUAL-01..07', 'Responsive UI, reproducible results, swappable model strategies, built-in test suite, explainability factor breakdown', 'main.css, aiEngine.js, testSuite.js']
    ];

    return `
      <div class="grid grid--2">
        <div class="card">
          <h2 class="card__title">Quick-Start Guide &amp; User Manual (SRS 2.6)</h2>
          <ol style="padding-left: 18px; color: var(--text-secondary); font-size: 0.9rem;">
            <li><strong>Sign In or Register:</strong> Create an account or use one of the four demo roles.</li>
            <li><strong>Symptom Entry:</strong> Open <em>New Assessment</em>, enter age &amp; gender, select symptoms from the catalog or type custom symptoms, and set duration &amp; severity.</li>
            <li><strong>Result Interpretation:</strong> Review the ranked <em>possible conditions</em>, read the explainability factors, and follow general health or emergency guidance.</li>
            <li><strong>Flagging &amp; History:</strong> Revisit past results under <em>Assessment History</em> or report questionable outputs for Healthcare Reviewer inspection.</li>
          </ol>
        </div>

        <div class="card">
          <h2 class="card__title">Privacy, Security &amp; Safety Information</h2>
          <ul style="padding-left: 18px; color: var(--text-secondary); font-size: 0.9rem;">
            <li><strong>Password Protection:</strong> Passwords are hashed using iterative salted SHA-256 and never stored in plaintext.</li>
            <li><strong>Record Isolation:</strong> General Users cannot access another user's health assessments.</li>
            <li><strong>Non-Diagnostic Scope:</strong> This system is a preliminary screening aid, not a substitute for professional medical care.</li>
            <li><strong>Team (SRS 6.1):</strong> Aditya Narayan Sharma (PM / Frontend), Aditya Singh (Backend / DB), Akshat Gupta (AI/ML &amp; QA).</li>
          </ul>
        </div>
      </div>

      <div class="card">
        <div class="card__header">
          <div>
            <h2 class="card__title">SRS Requirements Traceability Matrix</h2>
            <p class="card__subtitle">Mapping CS3CO40(P) Experiment 2 requirements directly to implemented modules</p>
          </div>
        </div>
        <div class="table-wrap">
          <table>
            <thead><tr><th>SRS ID(s)</th><th>Implemented Behavior</th><th>Module(s)</th></tr></thead>
            <tbody>
              ${matrix.map((row) => `
                <tr>
                  <td><span class="pill pill--info mono">${esc(row[0])}</span></td>
                  <td>${esc(row[1])}</td>
                  <td class="mono" style="font-size:0.8rem;">${esc(row[2])}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function renderTestsView(lastRun) {
    return `
      <div class="card">
        <div class="card__header">
          <div>
            <h2 class="card__title">Automated Test &amp; Verification Suite (NFR-QUAL-05)</h2>
            <p class="card__subtitle">Executes Unit, Integration, Security/RBAC, Safety/Fail-Safe, and Performance tests in an isolated snapshot</p>
          </div>
          <button type="button" class="btn btn--primary" data-action="run-test-suite">Run All SRS Verification Tests</button>
        </div>

        ${!lastRun ? `
          <p style="color: var(--text-muted);">Click "Run All SRS Verification Tests" to execute automated assertions across all modules.</p>
        ` : `
          <div class="alert ${lastRun.failed === 0 ? 'alert--success' : 'alert--danger'}">
            <div class="alert__title">Test Run Complete: ${lastRun.passed} / ${lastRun.total} Passed (${lastRun.failed} Failed)</div>
            <div>Your active session and saved data were preserved via automatic snapshot restoration.</div>
          </div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Category</th><th>SRS Req</th><th>Test Case</th><th>Duration</th><th>Result</th></tr></thead>
              <tbody>
                ${lastRun.results.map((r) => `
                  <tr>
                    <td>${esc(r.category)}</td>
                    <td><span class="pill pill--neutral mono">${esc(r.reqId)}</span></td>
                    <td>${esc(r.name)}${r.error ? `<div style="color:var(--danger); font-size:0.8rem;">${esc(r.error)}</div>` : ''}</td>
                    <td>${r.durationMs} ms</td>
                    <td><span class="pill ${r.passed ? 'pill--secure' : 'pill--danger'}">${r.passed ? 'PASS' : 'FAIL'}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        `}
      </div>
    `;
  }

  return {
    renderAuthView,
    renderDashboardView,
    renderAssessmentFormView,
    renderResultsView,
    renderHistoryView,
    renderProfileView,
    renderReviewerView,
    renderModelManagementView,
    renderAdminView,
    renderHelpDocsView,
    renderTestsView
  };
}));
