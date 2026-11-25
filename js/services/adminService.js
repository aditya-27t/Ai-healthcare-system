/**
 * Administration, AI/ML Model Management & Healthcare Review Service
 * SRS: FR-ADM-01..05, NFR-SAFE-06, NFR-SEC-06/07
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const Storage = require('./storageService');
    const Auth = require('./authService');
    const Crypto = require('./cryptoService');
    module.exports = factory(Storage, Auth, Crypto);
  } else {
    root.MedAssistAdmin = factory(root.MedAssistStorage, root.MedAssistAuth, root.MedAssistCrypto);
  }
}(typeof self !== 'undefined' ? self : this, function (Storage, Auth, Crypto) {
  'use strict';

  const { ROLES } = Auth;

  // ---- Safety Reporting (NFR-SAFE-06) ----
  function submitSafetyReport({ assessmentId, reason, details }) {
    const user = Auth.getCurrentUser();
    if (!user) return { ok: false, error: 'Authentication required.' };
    if (!assessmentId || !reason || !reason.trim()) {
      return { ok: false, error: 'A report reason is required.' };
    }

    const access = Auth.getAssessmentById(assessmentId);
    if (!access.ok) return access;

    const reports = Storage.getReports();
    const newReport = {
      id: Crypto.generateId('rep'),
      assessmentId,
      reportedByUserId: user.id,
      reportedByName: user.name,
      reason: reason.trim(),
      details: (details || '').trim(),
      status: 'PENDING_REVIEW',
      reviewerNotes: '',
      reviewedBy: null,
      createdAt: new Date().toISOString(),
      reviewedAt: null
    };

    reports.unshift(newReport);
    Storage.saveReports(reports);

    Storage.appendLog({
      category: 'SAFETY',
      severity: 'WARN',
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'SAFETY_REPORT_SUBMITTED',
      details: `Flagged assessment ${assessmentId} for clinical review: ${reason.trim()}`
    });

    return { ok: true, report: newReport };
  }

  function getReports() {
    const auth = Auth.requireRole([ROLES.HEALTHCARE_REVIEWER, ROLES.SYSTEM_ADMIN, ROLES.AIML_MAINTAINER]);
    if (!auth.ok) return { ok: false, error: auth.error, reports: [] };
    return { ok: true, reports: Storage.getReports() };
  }

  function resolveSafetyReport({ reportId, status, reviewerNotes }) {
    const auth = Auth.requireRole([ROLES.HEALTHCARE_REVIEWER, ROLES.SYSTEM_ADMIN]);
    if (!auth.ok) return auth;

    const allowedStatuses = ['REVIEWED_VERIFIED', 'ESCALATED_TO_MLOPS', 'DISMISSED'];
    if (!allowedStatuses.includes(status)) {
      return { ok: false, error: 'Invalid review resolution status.' };
    }

    const reports = Storage.getReports();
    const idx = reports.findIndex((r) => r.id === reportId);
    if (idx === -1) return { ok: false, error: 'Report not found.' };

    reports[idx].status = status;
    reports[idx].reviewerNotes = (reviewerNotes || '').trim();
    reports[idx].reviewedBy = auth.user.name;
    reports[idx].reviewedAt = new Date().toISOString();
    Storage.saveReports(reports);

    Storage.appendLog({
      category: 'CLINICAL_REVIEW',
      severity: 'INFO',
      actorId: auth.user.id,
      actorName: auth.user.name,
      actorRole: auth.user.role,
      action: 'SAFETY_REPORT_REVIEWED',
      details: `Report ${reportId} marked as ${status}.`
    });

    return { ok: true, report: reports[idx] };
  }

  // ---- AI Model Version Management (FR-ADM-02, FR-ADM-04, FR-ADM-05) ----
  function getModels() {
    return Storage.getModels();
  }

  function disableModelVersion(version, reason) {
    const auth = Auth.requireRole([ROLES.AIML_MAINTAINER, ROLES.SYSTEM_ADMIN]);
    if (!auth.ok) return auth;

    const models = Storage.getModels();
    const idx = models.findIndex((m) => m.version === version);
    if (idx === -1) return { ok: false, error: 'Model version not found.' };

    models[idx].status = 'DISABLED_FAULTY';
    models[idx].approved = false;
    models[idx].faultReason = (reason || 'Disabled by authorized maintainer due to faulty behavior.').trim();
    models[idx].updatedAt = new Date().toISOString();
    models[idx].updatedBy = auth.user.name;

    Storage.saveModels(models);

    Storage.appendLog({
      category: 'MODEL_MANAGEMENT',
      severity: 'HIGH',
      actorId: auth.user.id,
      actorName: auth.user.name,
      actorRole: auth.user.role,
      action: 'MODEL_VERSION_DISABLED',
      details: `Disabled faulty model ${version}. Reason: ${models[idx].faultReason}`
    });

    return { ok: true, models };
  }

  function restoreModelVersion(version) {
    const auth = Auth.requireRole([ROLES.AIML_MAINTAINER, ROLES.SYSTEM_ADMIN]);
    if (!auth.ok) return auth;

    const models = Storage.getModels();
    const target = models.find((m) => m.version === version);
    if (!target) return { ok: false, error: 'Model version not found.' };

    const now = new Date().toISOString();
    const updated = models.map((m) => {
      if (m.version === version) {
        return {
          ...m,
          status: 'ACTIVE',
          approved: true,
          faultReason: null,
          updatedAt: now,
          updatedBy: auth.user.name
        };
      }
      if (m.status === 'ACTIVE') {
        return {
          ...m,
          status: m.approved ? 'APPROVED_STANDBY' : 'DISABLED_FAULTY',
          updatedAt: now
        };
      }
      return m;
    });

    Storage.saveModels(updated);

    Storage.appendLog({
      category: 'MODEL_MANAGEMENT',
      severity: 'INFO',
      actorId: auth.user.id,
      actorName: auth.user.name,
      actorRole: auth.user.role,
      action: 'MODEL_VERSION_ACTIVATED',
      details: `Restored/activated approved AI model version ${version}.`
    });

    return { ok: true, models: updated };
  }

  // ---- System Administration (FR-ADM-01, FR-ADM-03, NFR-SEC-06/07) ----
  function getAllUsersAdmin() {
    const auth = Auth.requireRole([ROLES.SYSTEM_ADMIN]);
    if (!auth.ok) return { ok: false, error: auth.error, users: [] };
    const users = Storage.getUsers().map(({ passwordHash, ...safe }) => safe);
    return { ok: true, users };
  }

  function updateUserRoleOrStatus({ targetUserId, role, active }) {
    const auth = Auth.requireRole([ROLES.SYSTEM_ADMIN]);
    if (!auth.ok) return auth;

    const users = Storage.getUsers();
    const idx = users.findIndex((u) => u.id === targetUserId);
    if (idx === -1) return { ok: false, error: 'Target user not found.' };

    if (targetUserId === auth.user.id && active === false) {
      return { ok: false, error: 'You cannot deactivate your own active administrator account.' };
    }

    if (role && Object.values(ROLES).includes(role)) {
      users[idx].role = role;
    }
    if (typeof active === 'boolean') {
      users[idx].active = active;
    }

    Storage.saveUsers(users);
    Storage.appendLog({
      category: 'ADMIN',
      severity: 'WARN',
      actorId: auth.user.id,
      actorName: auth.user.name,
      actorRole: auth.user.role,
      action: 'USER_ACCESS_UPDATED',
      details: `Updated user ${users[idx].email}: role=${users[idx].role}, active=${users[idx].active}.`
    });

    return { ok: true };
  }

  function updateSystemSettings(partial) {
    const auth = Auth.requireRole([ROLES.SYSTEM_ADMIN, ROLES.AIML_MAINTAINER]);
    if (!auth.ok) return auth;

    const current = Storage.getSettings();
    const next = {
      ...current,
      ...partial
    };
    Storage.saveSettings(next);

    Storage.appendLog({
      category: 'ADMIN',
      severity: 'INFO',
      actorId: auth.user.id,
      actorName: auth.user.name,
      actorRole: auth.user.role,
      action: 'SYSTEM_SETTINGS_UPDATED',
      details: `Updated system settings: ${JSON.stringify(partial)}`
    });

    return { ok: true, settings: next };
  }

  function getAuditLogs() {
    const auth = Auth.requireRole([ROLES.SYSTEM_ADMIN, ROLES.AIML_MAINTAINER, ROLES.HEALTHCARE_REVIEWER]);
    if (!auth.ok) return { ok: false, error: auth.error, logs: [] };
    return { ok: true, logs: Storage.getLogs() };
  }

  return {
    submitSafetyReport,
    getReports,
    resolveSafetyReport,
    getModels,
    disableModelVersion,
    restoreModelVersion,
    getAllUsersAdmin,
    updateUserRoleOrStatus,
    updateSystemSettings,
    getAuditLogs
  };
}));
