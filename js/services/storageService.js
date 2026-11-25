/**
 * Storage & Database Service (SRS 2.1 Database, FR-ADM-02, FR-ADM-03, NFR-SEC-05/06)
 * Uses localStorage in browser environments with an in-memory fallback for automated tests.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const Crypto = require('./cryptoService');
    module.exports = factory(Crypto);
  } else {
    root.MedAssistStorage = factory(root.MedAssistCrypto);
  }
}(typeof self !== 'undefined' ? self : this, function (Crypto) {
  'use strict';

  const STORAGE_KEYS = {
    USERS: 'ai_hds_users_v1',
    SESSION: 'ai_hds_session_v1',
    ASSESSMENTS: 'ai_hds_assessments_v1',
    MODELS: 'ai_hds_models_v1',
    LOGS: 'ai_hds_logs_v1',
    REPORTS: 'ai_hds_reports_v1',
    SETTINGS: 'ai_hds_settings_v1'
  };

  const memoryStore = {};

  function getBackend() {
    try {
      if (typeof localStorage !== 'undefined') {
        const testKey = '__ai_hds_probe__';
        localStorage.setItem(testKey, '1');
        localStorage.removeItem(testKey);
        return localStorage;
      }
    } catch (_err) {
      // Fallback to in-memory store
    }
    return {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(memoryStore, k) ? memoryStore[k] : null),
      setItem: (k, v) => { memoryStore[k] = String(v); },
      removeItem: (k) => { delete memoryStore[k]; }
    };
  }

  function readJSON(key, fallback) {
    const raw = getBackend().getItem(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw);
    } catch (_err) {
      return fallback;
    }
  }

  function writeJSON(key, value) {
    getBackend().setItem(key, JSON.stringify(value));
  }

  function ensureInitialized() {
    const users = readJSON(STORAGE_KEYS.USERS, null);
    if (users && Array.isArray(users) && users.length > 0) {
      return;
    }

    const now = new Date().toISOString();

    // Seed all 4 SRS User Classes with salted SHA-256 hashed passwords (never plaintext)
    const seededUsers = [
      {
        id: 'usr_patient_demo',
        name: 'Aarav Patel',
        email: 'patient@medassist.demo',
        passwordHash: Crypto.hashPassword('Patient@123'),
        role: 'GENERAL_USER',
        active: true,
        profile: {
          age: 28,
          gender: 'Male',
          bloodGroup: 'O+',
          allergies: 'Dust pollen',
          chronicConditions: 'None',
          medications: 'None',
          emergencyContact: '+91-98765-43210'
        },
        createdAt: now
      },
      {
        id: 'usr_reviewer_demo',
        name: 'Dr. Meera Nair',
        email: 'reviewer@medassist.demo',
        passwordHash: Crypto.hashPassword('Reviewer@123'),
        role: 'HEALTHCARE_REVIEWER',
        active: true,
        profile: {
          age: 39,
          gender: 'Female',
          bloodGroup: 'A+',
          allergies: 'None',
          chronicConditions: 'None',
          medications: 'None',
          emergencyContact: 'Clinical Review Desk'
        },
        createdAt: now
      },
      {
        id: 'usr_admin_demo',
        name: 'Aditya Narayan Sharma',
        email: 'admin@medassist.demo',
        passwordHash: Crypto.hashPassword('Admin@123'),
        role: 'SYSTEM_ADMIN',
        active: true,
        profile: {
          age: 22,
          gender: 'Male',
          bloodGroup: 'B+',
          allergies: 'None',
          chronicConditions: 'None',
          medications: 'None',
          emergencyContact: 'System Operations'
        },
        createdAt: now
      },
      {
        id: 'usr_mlops_demo',
        name: 'Akshat Gupta',
        email: 'mlops@medassist.demo',
        passwordHash: Crypto.hashPassword('Mlops@123'),
        role: 'AIML_MAINTAINER',
        active: true,
        profile: {
          age: 22,
          gender: 'Male',
          bloodGroup: 'AB+',
          allergies: 'None',
          chronicConditions: 'None',
          medications: 'None',
          emergencyContact: 'AI/ML Engineering'
        },
        createdAt: now
      }
    ];

    const seededModels = [
      {
        version: 'v2.1.0-ClinicalBayes',
        displayName: 'Clinical Weighted Naive Bayes Ensemble v2.1',
        algorithm: 'Calibrated Log-Likelihood + Severity/Duration/Age Risk Fusion',
        status: 'ACTIVE',
        approved: true,
        metrics: { accuracy: 0.914, precision: 0.896, recall: 0.921, f1: 0.908, avgLatencyMs: 14 },
        releaseNotes: 'Improved differential weighting for respiratory vs allergic conditions and age-stratified cardiopulmonary risk calibration.',
        updatedAt: now,
        updatedBy: 'Akshat Gupta'
      },
      {
        version: 'v2.0.1-StandardBayes',
        displayName: 'Standard Clinical Bayes Classifier v2.0.1',
        algorithm: 'Multinomial Naive Bayes (Baseline)',
        status: 'APPROVED_STANDBY',
        approved: true,
        metrics: { accuracy: 0.872, precision: 0.858, recall: 0.869, f1: 0.863, avgLatencyMs: 9 },
        releaseNotes: 'Verified stable baseline release approved for instant rollback (FR-ADM-05).',
        updatedAt: now,
        updatedBy: 'Akshat Gupta'
      },
      {
        version: 'v1.9.0-ExperimentalLinear',
        displayName: 'Experimental Linear Scorer v1.9.0',
        algorithm: 'Unweighted Linear Symptom Matcher',
        status: 'DISABLED_FAULTY',
        approved: false,
        faultReason: 'Under-weighted fever/chills combination in influenza screening; disabled per FR-ADM-04.',
        metrics: { accuracy: 0.745, precision: 0.720, recall: 0.761, f1: 0.740, avgLatencyMs: 7 },
        releaseNotes: 'Deprecated prototype retained in registry for audit traceability.',
        updatedAt: now,
        updatedBy: 'Akshat Gupta'
      }
    ];

    const seededAssessments = [
      {
        id: 'asm_demo_001',
        userId: 'usr_patient_demo',
        userName: 'Aarav Patel',
        createdAt: new Date(Date.now() - 86400000 * 3).toISOString(),
        modelVersion: 'v2.1.0-ClinicalBayes',
        latencyMs: 12,
        status: 'COMPLETED',
        input: {
          age: 28,
          gender: 'Male',
          temperatureC: 37.4,
          existingConditions: 'None',
          allergies: 'Dust pollen',
          symptoms: [
            { id: 'runny_nose', name: 'Runny or Stuffy Nose', durationDays: 3, severity: 'moderate' },
            { id: 'sneezing', name: 'Frequent Sneezing', durationDays: 3, severity: 'moderate' },
            { id: 'itchy_eyes', name: 'Itchy or Watery Eyes', durationDays: 2, severity: 'mild' }
          ]
        },
        emergencyAlerts: [],
        predictions: [
          {
            conditionId: 'allergic_rhinitis',
            name: 'Seasonal Allergic Rhinitis',
            category: 'Allergy / ENT',
            probability: 0.68,
            overview: 'An immune-mediated nasal and ocular response to airborne allergens such as pollen, dust mites, or pet dander.',
            guidance: [
              'Minimize exposure to suspected environmental triggers (pollen, dust).',
              'Rinsing nasal passages with sterile saline can reduce allergen burden.'
            ],
            factors: [
              'Matched symptom: Itchy or Watery Eyes (mild, 2d)',
              'Matched symptom: Frequent Sneezing (moderate, 3d)',
              'Matched symptom: Runny or Stuffy Nose (moderate, 3d)',
              'Duration profile (3 days) aligns with allergic presentation'
            ]
          },
          {
            conditionId: 'common_cold',
            name: 'Common Cold (Viral Upper Respiratory Infection)',
            category: 'Respiratory / ENT',
            probability: 0.24,
            overview: 'A mild, self-limiting viral infection affecting the nose and throat.',
            guidance: ['Rest adequately and maintain steady fluid intake.'],
            factors: [
              'Matched symptom: Runny or Stuffy Nose (moderate, 3d)',
              'Matched symptom: Frequent Sneezing (moderate, 3d)'
            ]
          }
        ]
      }
    ];

    const seededReports = [
      {
        id: 'rep_demo_001',
        assessmentId: 'asm_demo_001',
        reportedByUserId: 'usr_patient_demo',
        reportedByName: 'Aarav Patel',
        reason: 'Low confidence vs mild fever question',
        details: 'Wanted to check whether mild temperature (37.4 C) alters allergy vs cold ranking.',
        status: 'PENDING_REVIEW',
        reviewerNotes: '',
        reviewedBy: null,
        createdAt: new Date(Date.now() - 86400000 * 2).toISOString(),
        reviewedAt: null
      }
    ];

    const seededLogs = [
      {
        id: 'log_init_001',
        timestamp: now,
        category: 'SYSTEM',
        severity: 'INFO',
        actorId: 'system',
        actorName: 'System Bootstrap',
        actorRole: 'SYSTEM',
        action: 'SYSTEM_INITIALIZED',
        details: 'Initialized database with hashed credentials, clinical model registry (v2.1.0 active), and audit trail.'
      }
    ];

    const seededSettings = {
      simulateAiFailure: false,
      emergencyRulesEnabled: true,
      minInsufficientScore: 0.28,
      maxResultsDisplayed: 4,
      requireHttpsNotice: true
    };

    writeJSON(STORAGE_KEYS.USERS, seededUsers);
    writeJSON(STORAGE_KEYS.MODELS, seededModels);
    writeJSON(STORAGE_KEYS.ASSESSMENTS, seededAssessments);
    writeJSON(STORAGE_KEYS.REPORTS, seededReports);
    writeJSON(STORAGE_KEYS.LOGS, seededLogs);
    writeJSON(STORAGE_KEYS.SETTINGS, seededSettings);
  }

  function resetAllData() {
    Object.values(STORAGE_KEYS).forEach((k) => getBackend().removeItem(k));
    ensureInitialized();
  }

  function appendLog(entry) {
    ensureInitialized();
    const logs = readJSON(STORAGE_KEYS.LOGS, []);
    logs.unshift({
      id: Crypto.generateId('log'),
      timestamp: new Date().toISOString(),
      category: entry.category || 'SECURITY',
      severity: entry.severity || 'INFO',
      actorId: entry.actorId || 'anonymous',
      actorName: entry.actorName || 'Anonymous',
      actorRole: entry.actorRole || 'GUEST',
      action: entry.action || 'EVENT',
      details: entry.details || ''
    });
    // Keep most recent 300 entries
    if (logs.length > 300) logs.length = 300;
    writeJSON(STORAGE_KEYS.LOGS, logs);
  }

  return {
    STORAGE_KEYS,
    ensureInitialized,
    resetAllData,
    readJSON,
    writeJSON,
    appendLog,
    getUsers: () => { ensureInitialized(); return readJSON(STORAGE_KEYS.USERS, []); },
    saveUsers: (users) => writeJSON(STORAGE_KEYS.USERS, users),
    getSession: () => readJSON(STORAGE_KEYS.SESSION, null),
    saveSession: (session) => writeJSON(STORAGE_KEYS.SESSION, session),
    clearSession: () => getBackend().removeItem(STORAGE_KEYS.SESSION),
    getAssessments: () => { ensureInitialized(); return readJSON(STORAGE_KEYS.ASSESSMENTS, []); },
    saveAssessments: (list) => writeJSON(STORAGE_KEYS.ASSESSMENTS, list),
    getModels: () => { ensureInitialized(); return readJSON(STORAGE_KEYS.MODELS, []); },
    saveModels: (models) => writeJSON(STORAGE_KEYS.MODELS, models),
    getLogs: () => { ensureInitialized(); return readJSON(STORAGE_KEYS.LOGS, []); },
    getReports: () => { ensureInitialized(); return readJSON(STORAGE_KEYS.REPORTS, []); },
    saveReports: (reports) => writeJSON(STORAGE_KEYS.REPORTS, reports),
    getSettings: () => { ensureInitialized(); return readJSON(STORAGE_KEYS.SETTINGS, {}); },
    saveSettings: (settings) => writeJSON(STORAGE_KEYS.SETTINGS, settings)
  };
}));
