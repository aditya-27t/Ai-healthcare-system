/**
 * Automated Verification Suite (SRS NFR-QUAL-05)
 * Covers Unit, Integration, System, Security, and Performance Requirements.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const Crypto = require('../services/cryptoService');
    const Storage = require('../services/storageService');
    const Auth = require('../services/authService');
    const Validation = require('../services/validationService');
    const AI = require('../services/aiEngine');
    const Admin = require('../services/adminService');
    module.exports = factory(Crypto, Storage, Auth, Validation, AI, Admin);
  } else {
    root.MedAssistTests = factory(
      root.MedAssistCrypto,
      root.MedAssistStorage,
      root.MedAssistAuth,
      root.MedAssistValidation,
      root.MedAssistAI,
      root.MedAssistAdmin
    );
  }
}(typeof self !== 'undefined' ? self : this, function (Crypto, Storage, Auth, Validation, AI, Admin) {
  'use strict';

  function assert(condition, message) {
    if (!condition) {
      throw new Error(message || 'Assertion failed');
    }
  }

  function snapshotStorage() {
    const snap = {};
    Object.values(Storage.STORAGE_KEYS).forEach((key) => {
      snap[key] = Storage.readJSON(key, null);
    });
    return snap;
  }

  function restoreStorage(snap) {
    Object.keys(snap).forEach((key) => {
      if (snap[key] === null) {
        if (key === Storage.STORAGE_KEYS.SESSION) Storage.clearSession();
      } else {
        Storage.writeJSON(key, snap[key]);
      }
    });
  }

  function runAllTests() {
    const snap = snapshotStorage();
    const results = [];

    function test(category, reqId, name, fn) {
      const t0 = Date.now();
      try {
        Storage.resetAllData();
        AI.clearCache();
        fn();
        results.push({
          category,
          reqId,
          name,
          passed: true,
          durationMs: Date.now() - t0
        });
      } catch (err) {
        results.push({
          category,
          reqId,
          name,
          passed: false,
          error: err.message,
          durationMs: Date.now() - t0
        });
      }
    }

    try {
      // 1. Security Tests
      test('Security', 'NFR-SEC-05', 'Passwords are stored as salted SHA-256 hashes, never plaintext', () => {
        const reg = Auth.register({
          name: 'Test Patient',
          email: 'hashcheck@example.com',
          password: 'MySecretPassword!1',
          age: 30,
          gender: 'Female'
        });
        assert(reg.ok, 'Registration should succeed');
        const users = Storage.getUsers();
        const saved = users.find((u) => u.email === 'hashcheck@example.com');
        assert(saved && saved.passwordHash.startsWith('sha256$'), 'Expected sha256$ salted hash');
        assert(!saved.passwordHash.includes('MySecretPassword!1'), 'Plaintext password leaked in storage');
        assert(Crypto.verifyPassword('MySecretPassword!1', saved.passwordHash), 'Hash should verify');
        assert(!Crypto.verifyPassword('WrongPassword', saved.passwordHash), 'Wrong password should fail');
      });

      test('Security', 'FR-AUTH-04', 'Prevent unauthorized access to another user\'s health records', () => {
        const u1 = Auth.register({ name: 'Alice', email: 'alice@test.com', password: 'Password@123', age: 25, gender: 'Female' });
        assert(u1.ok);
        const asm = AI.runAssessment({
          age: 25,
          gender: 'Female',
          symptoms: [{ id: 'headache', name: 'Headache', durationDays: 2, severity: 'moderate' }]
        }, u1.user);
        assert(asm.ok);

        Auth.logout();
        const u2 = Auth.register({ name: 'Bob', email: 'bob@test.com', password: 'Password@123', age: 29, gender: 'Male' });
        assert(u2.ok);

        const access = Auth.getAssessmentById(asm.assessment.id);
        assert(!access.ok, 'Bob must NOT be allowed to access Alice\'s assessment');
      });

      test('Security', 'FR-ADM-01 / NFR-SEC-03', 'RBAC blocks General User from Admin/MLOps actions', () => {
        const login = Auth.login({ email: 'patient@medassist.demo', password: 'Patient@123' });
        assert(login.ok);
        const res = Admin.disableModelVersion('v2.1.0-ClinicalBayes', 'Unauthorized test');
        assert(!res.ok, 'General User must be blocked from disabling AI models');
      });

      // 2. Unit & Validation Tests
      test('Unit / Validation', 'FR-DATA-03..05', 'Rejects missing fields, negative age, invalid duration, numeric-only symptoms', () => {
        const bad1 = Validation.validateAssessmentInput({ age: -5, gender: 'Male', symptoms: [] });
        assert(!bad1.valid && bad1.errors.length >= 2, 'Should reject negative age and empty symptoms');

        const bad2 = Validation.validateAssessmentInput({
          age: 25,
          gender: 'Male',
          symptoms: [{ name: '12345', durationDays: 0, severity: 'extreme' }]
        });
        assert(!bad2.valid && bad2.errors.length >= 3, 'Should reject numeric symptom, 0 days, and invalid severity');
      });

      // 3. AI Diagnostic & Safety Tests
      test('AI / Reliability', 'NFR-QUAL-03', 'Deterministic output for identical inputs and same model version', () => {
        const login = Auth.login({ email: 'patient@medassist.demo', password: 'Patient@123' });
        const input = {
          age: 34,
          gender: 'Male',
          temperatureC: 38.8,
          symptoms: [
            { id: 'fever', name: 'Fever', durationDays: 3, severity: 'moderate' },
            { id: 'body_aches', name: 'Body / Muscle Aches', durationDays: 3, severity: 'moderate' },
            { id: 'chills', name: 'Chills / Rigors', durationDays: 2, severity: 'moderate' }
          ]
        };
        const r1 = AI.runAssessment(input, login.user);
        AI.clearCache();
        const r2 = AI.runAssessment(input, login.user);
        assert(r1.ok && r2.ok);
        assert(r1.assessment.predictions[0].conditionId === r2.assessment.predictions[0].conditionId, 'Top condition must match deterministically');
        assert(r1.assessment.predictions[0].probability === r2.assessment.predictions[0].probability, 'Confidence score must match deterministically');
        assert(r1.assessment.modelVersion === 'v2.1.0-ClinicalBayes', 'Model version must be recorded (FR-AI-05)');
      });

      test('Safety', 'FR-AI-04', 'Handles insufficient/unrecognized symptom information safely', () => {
        const login = Auth.login({ email: 'patient@medassist.demo', password: 'Patient@123' });
        const res = AI.runAssessment({
          age: 24,
          gender: 'Female',
          symptoms: [{ name: 'mild mysterious toe tickle', durationDays: 1, severity: 'mild' }]
        }, login.user);
        assert(res.ok);
        assert(res.assessment.status === 'INSUFFICIENT_INFO', 'Expected INSUFFICIENT_INFO state');
        assert(res.assessment.predictions.length === 0, 'Should not fabricate predictions');
      });

      test('Safety', 'FR-RES-04 / NFR-SAFE-03', 'Triggers emergency guidance on high-risk chest pain + shortness of breath', () => {
        const login = Auth.login({ email: 'patient@medassist.demo', password: 'Patient@123' });
        const res = AI.runAssessment({
          age: 56,
          gender: 'Male',
          symptoms: [
            { id: 'chest_pain', name: 'Chest Pain or Tightness', durationDays: 1, severity: 'severe' },
            { id: 'shortness_of_breath', name: 'Shortness of Breath', durationDays: 1, severity: 'moderate' }
          ]
        }, login.user);
        assert(res.ok);
        assert(res.assessment.emergencyAlerts.length >= 1, 'High-risk emergency alert must trigger');
      });

      test('Safety / Fail-Safe', 'FR-AI-07 / NFR-SAFE-05', 'Displays safe error when active AI model is disabled or unavailable', () => {
        const mlLogin = Auth.login({ email: 'mlops@medassist.demo', password: 'Mlops@123' });
        assert(mlLogin.ok);
        const disabled = Admin.disableModelVersion('v2.1.0-ClinicalBayes', 'Fault test');
        assert(disabled.ok);

        const res = AI.runAssessment({
          age: 30,
          gender: 'Female',
          symptoms: [{ id: 'cough', name: 'Cough', durationDays: 3, severity: 'moderate' }]
        }, mlLogin.user);
        assert(!res.ok && res.errorType === 'AI_SERVICE_UNAVAILABLE', 'Expected safe AI_SERVICE_UNAVAILABLE failure');
      });

      // 4. Integration & Model Rollback + Performance Tests
      test('Integration', 'FR-ADM-04 / FR-ADM-05', 'AI/ML Maintainer can disable faulty model and restore approved previous version', () => {
        const mlLogin = Auth.login({ email: 'mlops@medassist.demo', password: 'Mlops@123' });
        assert(mlLogin.ok);
        assert(Admin.disableModelVersion('v2.1.0-ClinicalBayes', 'Regression detected').ok);
        assert(Admin.restoreModelVersion('v2.0.1-StandardBayes').ok);

        const active = AI.getActiveModel();
        assert(active && active.version === 'v2.0.1-StandardBayes', 'Rollback to v2.0.1-StandardBayes should succeed');

        const res = AI.runAssessment({
          age: 26,
          gender: 'Male',
          symptoms: [
            { id: 'headache', name: 'Headache', durationDays: 2, severity: 'moderate' },
            { id: 'light_sensitivity', name: 'Sensitivity to Light or Sound', durationDays: 2, severity: 'moderate' }
          ]
        }, mlLogin.user);
        assert(res.ok && res.assessment.modelVersion === 'v2.0.1-StandardBayes');
      });

      test('Performance', 'NFR-PERF-01', 'AI assessment completes well under 5,000 ms target', () => {
        const login = Auth.login({ email: 'patient@medassist.demo', password: 'Patient@123' });
        const res = AI.runAssessment({
          age: 40,
          gender: 'Female',
          symptoms: [
            { id: 'cough', name: 'Cough', durationDays: 5, severity: 'moderate' },
            { id: 'fever', name: 'Fever', durationDays: 3, severity: 'moderate' }
          ]
        }, login.user);
        assert(res.ok && res.assessment.latencyMs < 5000, `Latency ${res.assessment.latencyMs}ms exceeded 5000ms`);
      });
    } finally {
      restoreStorage(snap);
      AI.clearCache();
    }

    return {
      total: results.length,
      passed: results.filter((r) => r.passed).length,
      failed: results.filter((r) => !r.passed).length,
      results
    };
  }

  return { runAllTests };
}));
