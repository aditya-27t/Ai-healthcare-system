/**
 * Main Application Controller for MedAssist AI
 * Orchestrates routing, RBAC navigation, assessment workflow, modals, and state updates.
 */
(function () {
  'use strict';

  const Storage = window.MedAssistStorage;
  const Auth = window.MedAssistAuth;
  const Knowledge = window.MedAssistKnowledge;
  const AI = window.MedAssistAI;
  const Admin = window.MedAssistAdmin;
  const Views = window.MedAssistViews;
  const Tests = window.MedAssistTests;
  const esc = window.MedAssistCrypto.escapeHtml;

  const state = {
    authTab: 'login',
    currentView: 'dashboard',
    activeAssessmentId: null,
    lastTestRun: null,
    draft: null
  };

  function createEmptyDraft(user) {
    const profile = (user && user.profile) || {};
    return {
      age: profile.age !== undefined && profile.age !== '' ? profile.age : '',
      gender: profile.gender || 'Male',
      temperatureC: '',
      existingConditions: profile.chronicConditions || '',
      allergies: profile.allergies || '',
      searchQuery: '',
      symptoms: [],
      validationErrors: []
    };
  }

  function showToast(message, type = 'info') {
    const root = document.getElementById('toast-root');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'error' ? 'toast--error' : type === 'success' ? 'toast--success' : ''}`;
    toast.textContent = message;
    root.appendChild(toast);
    setTimeout(() => {
      toast.remove();
    }, 3600);
  }

  function openModal(html) {
    const root = document.getElementById('modal-root');
    root.innerHTML = `<div class="modal-card">${html}</div>`;
    root.classList.remove('hidden');
  }

  function closeModal() {
    const root = document.getElementById('modal-root');
    root.classList.add('hidden');
    root.innerHTML = '';
  }

  function getNavItemsForRole(role) {
    const pendingCount = Storage.getReports().filter((r) => r.status === 'PENDING_REVIEW').length;
    const items = [
      { id: 'dashboard', label: 'Dashboard', section: 'General' },
      { id: 'assess', label: 'New Assessment', section: 'General' },
      { id: 'results', label: 'Latest Results', section: 'General' },
      { id: 'history', label: 'Assessment History', section: 'General' },
      { id: 'profile', label: 'My Profile & Security', section: 'General' }
    ];

    if (role === Auth.ROLES.HEALTHCARE_REVIEWER || role === Auth.ROLES.SYSTEM_ADMIN) {
      items.push({ id: 'reviewer', label: 'Clinical Review Queue', section: 'Governance', badge: pendingCount || null });
    }
    if (role === Auth.ROLES.AIML_MAINTAINER || role === Auth.ROLES.SYSTEM_ADMIN) {
      items.push({ id: 'models', label: 'AI Model Management', section: 'Governance' });
    }
    if (role === Auth.ROLES.SYSTEM_ADMIN) {
      items.push({ id: 'admin', label: 'System Admin & Logs', section: 'Governance' });
    }

    items.push({ id: 'tests', label: 'Verification Tests', section: 'Documentation' });
    items.push({ id: 'help', label: 'Help & SRS Docs', section: 'Documentation' });
    return items;
  }

  const VIEW_META = {
    dashboard: { title: 'Dashboard', subtitle: 'Overview of your preliminary health assessments and system status' },
    assess: { title: 'Symptom & Health Data Entry', subtitle: 'Enter symptoms, duration, severity, and basic health information' },
    results: { title: 'Assessment Results & Guidance', subtitle: 'Preliminary possible conditions, explainability, and safety disclaimer' },
    history: { title: 'Assessment History', subtitle: 'Review previous preliminary assessments according to access permissions' },
    profile: { title: 'User Profile & Security', subtitle: 'Manage health context and salted-hash account credentials' },
    reviewer: { title: 'Healthcare Reviewer Console', subtitle: 'Inspect flagged assessments and verify clinical knowledge base' },
    models: { title: 'AI/ML Model Governance', subtitle: 'Manage model versions, evaluate metrics, disable faulty or restore approved models' },
    admin: { title: 'System Administration & Audit Logs', subtitle: 'User access control, system settings, and security event logs' },
    tests: { title: 'Verification & Quality Testing', subtitle: 'Automated unit, integration, security, and performance verification (NFR-QUAL-05)' },
    help: { title: 'Help, Safety & SRS Documentation', subtitle: 'User manual, privacy guide, and SRS requirements traceability matrix' }
  };

  function render() {
    Storage.ensureInitialized();
    const user = Auth.getCurrentUser();
    const authView = document.getElementById('auth-view');
    const workspaceView = document.getElementById('workspace-view');

    if (!user) {
      authView.classList.remove('hidden');
      workspaceView.classList.add('hidden');
      authView.innerHTML = Views.renderAuthView(state.authTab);
      bindAuthForms();
      return;
    }

    authView.classList.add('hidden');
    workspaceView.classList.remove('hidden');

    if (!state.draft) {
      state.draft = createEmptyDraft(user);
    }

    // Sidebar user card
    document.getElementById('sidebar-user-card').innerHTML = `
      <div class="user-card__name">${esc(user.name)}</div>
      <div class="user-card__role">${esc(Auth.ROLE_LABELS[user.role])}</div>
    `;

    // Model pill in topbar
    const activeModel = AI.getActiveModel();
    const settings = Storage.getSettings();
    const modelPill = document.getElementById('model-status-pill');
    if (settings.simulateAiFailure || !activeModel) {
      modelPill.className = 'pill pill--danger';
      modelPill.textContent = 'AI Engine: Safe Offline';
    } else {
      modelPill.className = 'pill pill--info mono';
      modelPill.textContent = `Model: ${activeModel.version}`;
    }

    // Navigation
    const navItems = getNavItemsForRole(user.role);
    if (!navItems.some((i) => i.id === state.currentView)) {
      state.currentView = 'dashboard';
    }

    let lastSection = '';
    document.getElementById('nav-links').innerHTML = navItems.map((item) => {
      const sectionHeader = item.section !== lastSection
        ? `<div class="nav-section-label">${esc(item.section)}</div>`
        : '';
      lastSection = item.section;
      return `
        ${sectionHeader}
        <button type="button" class="nav-item ${state.currentView === item.id ? 'active' : ''}" data-action="navigate" data-view="${item.id}">
          <span>${esc(item.label)}</span>
          ${item.badge ? `<span class="nav-item__badge">${item.badge}</span>` : ''}
        </button>
      `;
    }).join('');

    // Page title & content
    const meta = VIEW_META[state.currentView] || VIEW_META.dashboard;
    document.getElementById('page-title').textContent = meta.title;
    document.getElementById('page-subtitle').textContent = meta.subtitle;

    const mainEl = document.getElementById('main-content');
    if (state.currentView === 'dashboard') {
      mainEl.innerHTML = Views.renderDashboardView(user);
    } else if (state.currentView === 'assess') {
      mainEl.innerHTML = Views.renderAssessmentFormView(user, state.draft);
      bindAssessmentFormHandlers(user);
    } else if (state.currentView === 'results') {
      const accessible = Auth.getAccessibleAssessments();
      const target = state.activeAssessmentId
        ? Auth.getAssessmentById(state.activeAssessmentId)
        : (accessible[0] ? { ok: true, assessment: accessible[0] } : { ok: false });
      mainEl.innerHTML = Views.renderResultsView(target.ok ? target.assessment : null, user);
    } else if (state.currentView === 'history') {
      mainEl.innerHTML = Views.renderHistoryView(user);
    } else if (state.currentView === 'profile') {
      mainEl.innerHTML = Views.renderProfileView(user);
      bindProfileForms();
    } else if (state.currentView === 'reviewer') {
      mainEl.innerHTML = Views.renderReviewerView(user);
    } else if (state.currentView === 'models') {
      mainEl.innerHTML = Views.renderModelManagementView(user);
      bindModelControls();
    } else if (state.currentView === 'admin') {
      mainEl.innerHTML = Views.renderAdminView(user);
      bindAdminControls();
    } else if (state.currentView === 'tests') {
      mainEl.innerHTML = Views.renderTestsView(state.lastTestRun);
    } else if (state.currentView === 'help') {
      mainEl.innerHTML = Views.renderHelpDocsView();
    }
  }

  function bindAuthForms() {
    const loginForm = document.getElementById('login-form');
    if (loginForm) {
      loginForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(loginForm);
        const res = Auth.login({ email: fd.get('email'), password: fd.get('password') });
        if (!res.ok) {
          const err = document.getElementById('auth-error');
          err.textContent = res.error;
          err.classList.remove('hidden');
          return;
        }
        state.draft = createEmptyDraft(res.user);
        state.currentView = 'dashboard';
        showToast(`Welcome back, ${res.user.name}`, 'success');
        render();
      });
    }

    const regForm = document.getElementById('register-form');
    if (regForm) {
      regForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(regForm);
        const res = Auth.register({
          name: fd.get('name'),
          email: fd.get('email'),
          password: fd.get('password'),
          age: fd.get('age'),
          gender: fd.get('gender')
        });
        if (!res.ok) {
          const err = document.getElementById('auth-error');
          err.textContent = res.error;
          err.classList.remove('hidden');
          return;
        }
        state.draft = createEmptyDraft(res.user);
        state.currentView = 'dashboard';
        showToast('Account created successfully!', 'success');
        render();
      });
    }
  }

  function syncDraftHeaderInputs() {
    const ageEl = document.getElementById('asm-age');
    const genderEl = document.getElementById('asm-gender');
    const tempEl = document.getElementById('asm-temp');
    const condEl = document.getElementById('asm-conditions');
    const allergyEl = document.getElementById('asm-allergies');
    if (ageEl) state.draft.age = ageEl.value;
    if (genderEl) state.draft.gender = genderEl.value;
    if (tempEl) state.draft.temperatureC = tempEl.value;
    if (condEl) state.draft.existingConditions = condEl.value;
    if (allergyEl) state.draft.allergies = allergyEl.value;
  }

  function bindAssessmentFormHandlers(user) {
    const searchEl = document.getElementById('symptom-search');
    if (searchEl) {
      searchEl.addEventListener('input', (e) => {
        syncDraftHeaderInputs();
        state.draft.searchQuery = e.target.value;
        render();
        const nextSearch = document.getElementById('symptom-search');
        if (nextSearch) {
          nextSearch.focus();
          nextSearch.setSelectionRange(nextSearch.value.length, nextSearch.value.length);
        }
      });
    }

    const form = document.getElementById('assessment-form');
    if (form) {
      form.addEventListener('change', (e) => {
        const target = e.target;
        if (target.dataset.symptomField) {
          const idx = Number(target.dataset.index);
          const field = target.dataset.symptomField;
          if (state.draft.symptoms[idx]) {
            state.draft.symptoms[idx][field] = field === 'durationDays' ? target.value : target.value;
          }
        } else {
          syncDraftHeaderInputs();
        }
      });

      form.addEventListener('submit', (e) => {
        e.preventDefault();
        syncDraftHeaderInputs();
        state.draft.validationErrors = [];

        const result = AI.runAssessment({
          age: state.draft.age,
          gender: state.draft.gender,
          temperatureC: state.draft.temperatureC,
          existingConditions: state.draft.existingConditions,
          allergies: state.draft.allergies,
          symptoms: state.draft.symptoms
        }, user);

        if (!result.ok) {
          if (result.errorType === 'VALIDATION_ERROR') {
            state.draft.validationErrors = result.errors;
            showToast('Please fix the highlighted form errors.', 'error');
            render();
            return;
          }
          // FR-AI-07 / NFR-SAFE-05 safe outage message modal
          openModal(`
            <h2 class="card__title" style="color: var(--danger);">AI Diagnostic Service Safely Paused</h2>
            <p style="margin-top: 10px; color: var(--text-secondary);">${esc(result.safeMessage)}</p>
            <div style="display:flex; justify-content:flex-end; margin-top:16px;">
              <button type="button" class="btn btn--primary" data-action="close-modal">Understood</button>
            </div>
          `);
          return;
        }

        state.activeAssessmentId = result.assessment.id;
        state.currentView = 'results';
        state.draft = createEmptyDraft(user);
        showToast('Preliminary assessment generated.', 'success');
        render();
      });
    }
  }

  function bindProfileForms() {
    const profileForm = document.getElementById('profile-form');
    if (profileForm) {
      profileForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(profileForm);
        const res = Auth.updateProfile({
          name: fd.get('name'),
          age: fd.get('age'),
          gender: fd.get('gender'),
          bloodGroup: fd.get('bloodGroup'),
          emergencyContact: fd.get('emergencyContact'),
          allergies: fd.get('allergies'),
          chronicConditions: fd.get('chronicConditions'),
          medications: fd.get('medications')
        });
        if (!res.ok) {
          showToast(res.error, 'error');
          return;
        }
        showToast('Profile saved.', 'success');
        render();
      });
    }

    const pwdForm = document.getElementById('password-form');
    if (pwdForm) {
      pwdForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const fd = new FormData(pwdForm);
        const res = Auth.changePassword({
          currentPassword: fd.get('currentPassword'),
          newPassword: fd.get('newPassword')
        });
        if (!res.ok) {
          showToast(res.error, 'error');
          return;
        }
        pwdForm.reset();
        showToast('Password updated securely.', 'success');
      });
    }
  }

  function bindModelControls() {
    const simEl = document.getElementById('toggle-simulate-failure');
    if (simEl) {
      simEl.addEventListener('change', (e) => {
        const res = Admin.updateSystemSettings({ simulateAiFailure: e.target.checked });
        if (!res.ok) {
          showToast(res.error, 'error');
          return;
        }
        showToast(e.target.checked ? 'Simulated AI outage enabled.' : 'AI diagnostic service restored.', 'info');
        render();
      });
    }
  }

  function bindAdminControls() {
    const emEl = document.getElementById('toggle-emergency-rules');
    if (emEl) {
      emEl.addEventListener('change', (e) => {
        Admin.updateSystemSettings({ emergencyRulesEnabled: e.target.checked });
        showToast('Emergency triage setting updated.', 'info');
        render();
      });
    }
    const simAdminEl = document.getElementById('toggle-simulate-failure-admin');
    if (simAdminEl) {
      simAdminEl.addEventListener('change', (e) => {
        Admin.updateSystemSettings({ simulateAiFailure: e.target.checked });
        showToast('AI outage simulation setting updated.', 'info');
        render();
      });
    }
  }

  function handlePreset(presetName) {
    syncDraftHeaderInputs();
    if (presetName === 'flu') {
      state.draft.age = state.draft.age || 28;
      state.draft.temperatureC = '38.7';
      state.draft.symptoms = [
        { id: 'fever', name: 'Fever', durationDays: 3, severity: 'moderate' },
        { id: 'body_aches', name: 'Body / Muscle Aches', durationDays: 3, severity: 'moderate' },
        { id: 'fatigue', name: 'Fatigue / Weakness', durationDays: 3, severity: 'moderate' },
        { id: 'cough', name: 'Cough', durationDays: 2, severity: 'mild' }
      ];
    } else if (presetName === 'migraine') {
      state.draft.age = state.draft.age || 26;
      state.draft.temperatureC = '';
      state.draft.symptoms = [
        { id: 'throbbing_headache', name: 'One-Sided Throbbing Headache', durationDays: 1, severity: 'severe' },
        { id: 'light_sensitivity', name: 'Sensitivity to Light or Sound', durationDays: 1, severity: 'moderate' },
        { id: 'nausea', name: 'Nausea', durationDays: 1, severity: 'mild' }
      ];
    } else if (presetName === 'emergency') {
      state.draft.age = 54;
      state.draft.temperatureC = '';
      state.draft.symptoms = [
        { id: 'chest_pain', name: 'Chest Pain or Tightness', durationDays: 1, severity: 'severe', redFlag: true },
        { id: 'shortness_of_breath', name: 'Shortness of Breath', durationDays: 1, severity: 'moderate', redFlag: true },
        { id: 'sweating', name: 'Profuse Sweating', durationDays: 1, severity: 'moderate', redFlag: true }
      ];
    }
    state.draft.validationErrors = [];
    render();
  }

  // Global delegated click / change handlers
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;

    const action = el.dataset.action;
    const sidebar = document.getElementById('sidebar');

    if (action === 'switch-auth-tab') {
      state.authTab = el.dataset.tab;
      render();
    } else if (action === 'demo-login') {
      const res = Auth.login({ email: el.dataset.email, password: el.dataset.pass });
      if (res.ok) {
        state.draft = createEmptyDraft(res.user);
        state.currentView = 'dashboard';
        showToast(`Signed in as ${res.user.name} (${Auth.ROLE_LABELS[res.user.role]})`, 'success');
        render();
      } else {
        showToast(res.error, 'error');
      }
    } else if (action === 'navigate') {
      state.currentView = el.dataset.view;
      if (sidebar) sidebar.classList.remove('open');
      render();
    } else if (action === 'view-assessment') {
      const res = Auth.getAssessmentById(el.dataset.id);
      if (!res.ok) {
        showToast(res.error, 'error');
        return;
      }
      state.activeAssessmentId = el.dataset.id;
      state.currentView = 'results';
      render();
    } else if (action === 'toggle-symptom') {
      syncDraftHeaderInputs();
      const symId = el.dataset.symptomId;
      const idx = state.draft.symptoms.findIndex((s) => s.id === symId);
      if (idx >= 0) {
        state.draft.symptoms.splice(idx, 1);
      } else {
        const meta = Knowledge.SYMPTOMS.find((s) => s.id === symId);
        if (meta) {
          state.draft.symptoms.push({
            id: meta.id,
            name: meta.name,
            durationDays: 2,
            severity: 'moderate',
            redFlag: meta.redFlag
          });
        }
      }
      render();
    } else if (action === 'add-custom-symptom') {
      syncDraftHeaderInputs();
      const customEl = document.getElementById('custom-symptom-input');
      const val = customEl ? customEl.value.trim() : '';
      if (!val || val.length < 2) {
        showToast('Enter a valid symptom name (at least 2 characters).', 'error');
        return;
      }
      if (/^\d+$/.test(val)) {
        showToast('Numeric-only symptom descriptions are invalid (FR-DATA-05).', 'error');
        return;
      }
      state.draft.symptoms.push({
        id: `custom_${Date.now()}`,
        name: val,
        durationDays: 1,
        severity: 'moderate',
        redFlag: false
      });
      render();
    } else if (action === 'remove-symptom') {
      syncDraftHeaderInputs();
      state.draft.symptoms.splice(Number(el.dataset.index), 1);
      render();
    } else if (action === 'load-preset') {
      handlePreset(el.dataset.preset);
    } else if (action === 'clear-draft') {
      state.draft = createEmptyDraft(Auth.getCurrentUser());
      render();
    } else if (action === 'print-report') {
      window.print();
    } else if (action === 'open-flag-modal') {
      const asmId = el.dataset.id;
      openModal(`
        <h2 class="card__title">Report Potentially Incorrect or Unsafe Result (NFR-SAFE-06)</h2>
        <p style="font-size:0.86rem; color:var(--text-secondary); margin-top:4px;">Flagged reports are routed to a Healthcare Reviewer for inspection.</p>
        <form id="flag-report-form" style="margin-top:14px;">
          <input type="hidden" name="assessmentId" value="${esc(asmId)}" />
          <div class="form-group">
            <label class="form-label" for="flag-reason">Primary Concern *</label>
            <select class="select" id="flag-reason" name="reason" required>
              <option value="Unexpected condition ranking">Unexpected condition ranking</option>
              <option value="Missing emergency or safety warning">Missing emergency or safety warning</option>
              <option value="Unclear explanation or guidance">Unclear explanation or guidance</option>
              <option value="Other clinical safety concern">Other clinical safety concern</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" for="flag-details">Additional Notes</label>
            <textarea class="textarea" id="flag-details" name="details" rows="3" placeholder="Describe what looked inaccurate or unsafe..."></textarea>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button type="button" class="btn btn--ghost" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn btn--danger">Submit Safety Report</button>
          </div>
        </form>
      `);
      document.getElementById('flag-report-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const res = Admin.submitSafetyReport({
          assessmentId: fd.get('assessmentId'),
          reason: fd.get('reason'),
          details: fd.get('details')
        });
        closeModal();
        if (!res.ok) {
          showToast(res.error, 'error');
          return;
        }
        showToast('Safety report submitted for Healthcare Reviewer inspection.', 'success');
        render();
      });
    } else if (action === 'resolve-report') {
      const reportId = el.dataset.reportId;
      const status = el.dataset.status;
      openModal(`
        <h2 class="card__title">Clinical Review Decision</h2>
        <p style="font-size:0.86rem; color:var(--text-secondary);">Status: <strong>${esc(status)}</strong></p>
        <form id="resolve-report-form" style="margin-top:12px;">
          <div class="form-group">
            <label class="form-label" for="rev-notes">Reviewer Notes</label>
            <textarea class="textarea" id="rev-notes" name="notes" rows="3" placeholder="Document clinical evaluation or model feedback..."></textarea>
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button type="button" class="btn btn--ghost" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn btn--primary">Save Review</button>
          </div>
        </form>
      `);
      document.getElementById('resolve-report-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const res = Admin.resolveSafetyReport({
          reportId,
          status,
          reviewerNotes: fd.get('notes')
        });
        closeModal();
        showToast(res.ok ? 'Clinical review saved.' : res.error, res.ok ? 'success' : 'error');
        render();
      });
    } else if (action === 'disable-model') {
      const version = el.dataset.version;
      openModal(`
        <h2 class="card__title" style="color:var(--danger);">Disable Faulty AI Model Version (FR-ADM-04)</h2>
        <p style="font-size:0.86rem; color:var(--text-secondary);">Disabling <strong class="mono">${esc(version)}</strong> will prevent it from serving assessments. If it is currently active and no other model is activated, fail-safe protection will block inference.</p>
        <form id="disable-model-form" style="margin-top:12px;">
          <div class="form-group">
            <label class="form-label" for="fault-reason">Fault / Disable Reason *</label>
            <input class="input" id="fault-reason" name="reason" required value="Clinical validation anomaly detected" />
          </div>
          <div style="display:flex; justify-content:flex-end; gap:8px;">
            <button type="button" class="btn btn--ghost" data-action="close-modal">Cancel</button>
            <button type="submit" class="btn btn--danger">Disable Model</button>
          </div>
        </form>
      `);
      document.getElementById('disable-model-form').addEventListener('submit', (ev) => {
        ev.preventDefault();
        const fd = new FormData(ev.target);
        const res = Admin.disableModelVersion(version, fd.get('reason'));
        closeModal();
        showToast(res.ok ? `Disabled ${version}.` : res.error, res.ok ? 'info' : 'error');
        render();
      });
    } else if (action === 'restore-model') {
      const res = Admin.restoreModelVersion(el.dataset.version);
      showToast(res.ok ? `Restored and activated ${el.dataset.version}.` : res.error, res.ok ? 'success' : 'error');
      render();
    } else if (action === 'toggle-user-active') {
      const res = Admin.updateUserRoleOrStatus({
        targetUserId: el.dataset.userId,
        active: el.dataset.active === 'true'
      });
      showToast(res.ok ? 'Account status updated.' : res.error, res.ok ? 'success' : 'error');
      render();
    } else if (action === 'reset-demo-data') {
      Storage.resetAllData();
      AI.clearCache();
      showToast('Demo database reset to initial SRS seed state.', 'info');
      render();
    } else if (action === 'run-test-suite') {
      state.lastTestRun = Tests.runAllTests();
      showToast(
        `Tests complete: ${state.lastTestRun.passed}/${state.lastTestRun.total} passed`,
        state.lastTestRun.failed === 0 ? 'success' : 'error'
      );
      render();
    } else if (action === 'close-modal') {
      closeModal();
    }
  });

  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset && el.dataset.action === 'change-user-role') {
      const res = Admin.updateUserRoleOrStatus({
        targetUserId: el.dataset.userId,
        role: el.value
      });
      showToast(res.ok ? 'User role updated.' : res.error, res.ok ? 'success' : 'error');
      render();
    }
  });

  document.getElementById('logout-btn').addEventListener('click', () => {
    Auth.logout();
    state.draft = null;
    state.activeAssessmentId = null;
    showToast('Signed out safely.', 'info');
    render();
  });

  document.getElementById('mobile-menu-btn').addEventListener('click', () => {
    document.getElementById('sidebar').classList.toggle('open');
  });

  document.getElementById('modal-root').addEventListener('click', (e) => {
    if (e.target.id === 'modal-root') {
      closeModal();
    }
  });

  window.addEventListener('DOMContentLoaded', render);
})();
