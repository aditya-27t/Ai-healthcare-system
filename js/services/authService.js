/**
 * Authentication & Role-Based Access Control Service
 * SRS: FR-AUTH-01..04, FR-RES-05, FR-ADM-01, NFR-SEC-01, NFR-SEC-03..07
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const Crypto = require('./cryptoService');
    const Storage = require('./storageService');
    module.exports = factory(Crypto, Storage);
  } else {
    root.MedAssistAuth = factory(root.MedAssistCrypto, root.MedAssistStorage);
  }
}(typeof self !== 'undefined' ? self : this, function (Crypto, Storage) {
  'use strict';

  const ROLES = {
    GENERAL_USER: 'GENERAL_USER',
    HEALTHCARE_REVIEWER: 'HEALTHCARE_REVIEWER',
    SYSTEM_ADMIN: 'SYSTEM_ADMIN',
    AIML_MAINTAINER: 'AIML_MAINTAINER'
  };

  const ROLE_LABELS = {
    GENERAL_USER: 'General User',
    HEALTHCARE_REVIEWER: 'Healthcare Reviewer',
    SYSTEM_ADMIN: 'System Administrator',
    AIML_MAINTAINER: 'AI/ML Maintainer'
  };

  function sanitizeUser(user) {
    if (!user) return null;
    const { passwordHash, ...safeUser } = user;
    return safeUser;
  }

  function getCurrentUser() {
    const session = Storage.getSession();
    if (!session || !session.userId) return null;
    const users = Storage.getUsers();
    const found = users.find((u) => u.id === session.userId && u.active);
    if (!found) {
      Storage.clearSession();
      return null;
    }
    return sanitizeUser(found);
  }

  function register({ name, email, password, age, gender }) {
    Storage.ensureInitialized();
    const trimmedName = (name || '').trim();
    const normalizedEmail = (email || '').trim().toLowerCase();

    if (trimmedName.length < 2) {
      return { ok: false, error: 'Full name must be at least 2 characters.' };
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return { ok: false, error: 'Please enter a valid email address.' };
    }
    if (!password || password.length < 8) {
      return { ok: false, error: 'Password must be at least 8 characters long.' };
    }

    const parsedAge = Number(age);
    if (age !== undefined && age !== '' && (Number.isNaN(parsedAge) || parsedAge < 1 || parsedAge > 120)) {
      return { ok: false, error: 'Age must be between 1 and 120.' };
    }

    const users = Storage.getUsers();
    if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
      return { ok: false, error: 'An account with this email already exists.' };
    }

    const newUser = {
      id: Crypto.generateId('usr'),
      name: trimmedName,
      email: normalizedEmail,
      passwordHash: Crypto.hashPassword(password), // Never plaintext (NFR-SEC-05)
      role: ROLES.GENERAL_USER, // Self-registration always grants least-privilege General User
      active: true,
      profile: {
        age: parsedAge || '',
        gender: gender || 'Prefer not to say',
        bloodGroup: '',
        allergies: '',
        chronicConditions: '',
        medications: '',
        emergencyContact: ''
      },
      createdAt: new Date().toISOString()
    };

    users.push(newUser);
    Storage.saveUsers(users);

    Storage.appendLog({
      category: 'SECURITY',
      severity: 'INFO',
      actorId: newUser.id,
      actorName: newUser.name,
      actorRole: newUser.role,
      action: 'USER_REGISTERED',
      details: `New account registered (${normalizedEmail}) with hashed credentials.`
    });

    Storage.saveSession({
      token: Crypto.generateId('tok'),
      userId: newUser.id,
      role: newUser.role,
      issuedAt: new Date().toISOString()
    });

    return { ok: true, user: sanitizeUser(newUser) };
  }

  function login({ email, password }) {
    Storage.ensureInitialized();
    const normalizedEmail = (email || '').trim().toLowerCase();
    if (!normalizedEmail || !password) {
      return { ok: false, error: 'Email and password are required.' };
    }

    const users = Storage.getUsers();
    const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);

    if (!user || !Crypto.verifyPassword(password, user.passwordHash)) {
      Storage.appendLog({
        category: 'SECURITY',
        severity: 'WARN',
        actorId: user ? user.id : 'unknown',
        actorName: normalizedEmail,
        actorRole: user ? user.role : 'GUEST',
        action: 'LOGIN_FAILED',
        details: `Invalid login attempt for email "${normalizedEmail}".`
      });
      return { ok: false, error: 'Invalid email or password.' };
    }

    if (!user.active) {
      Storage.appendLog({
        category: 'SECURITY',
        severity: 'WARN',
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'LOGIN_BLOCKED_INACTIVE',
        details: 'Attempted login to deactivated account.'
      });
      return { ok: false, error: 'This account has been deactivated. Contact a System Administrator.' };
    }

    Storage.saveSession({
      token: Crypto.generateId('tok'),
      userId: user.id,
      role: user.role,
      issuedAt: new Date().toISOString()
    });

    Storage.appendLog({
      category: 'SECURITY',
      severity: 'INFO',
      actorId: user.id,
      actorName: user.name,
      actorRole: user.role,
      action: 'USER_LOGIN',
      details: 'Authenticated successfully.'
    });

    return { ok: true, user: sanitizeUser(user) };
  }

  function logout() {
    const current = getCurrentUser();
    if (current) {
      Storage.appendLog({
        category: 'SECURITY',
        severity: 'INFO',
        actorId: current.id,
        actorName: current.name,
        actorRole: current.role,
        action: 'USER_LOGOUT',
        details: 'User signed out and cleared session token.'
      });
    }
    Storage.clearSession();
    return { ok: true };
  }

  function requireRole(allowedRoles) {
    const user = getCurrentUser();
    if (!user) {
      return { ok: false, error: 'Authentication required (NFR-SEC-01).' };
    }
    if (!allowedRoles.includes(user.role)) {
      Storage.appendLog({
        category: 'SECURITY',
        severity: 'HIGH',
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'UNAUTHORIZED_ACCESS_BLOCKED',
        details: `Role ${user.role} blocked from operation requiring [${allowedRoles.join(', ')}].`
      });
      return { ok: false, error: 'Access denied: insufficient role privileges (NFR-SEC-03).' };
    }
    return { ok: true, user };
  }

  /**
   * FR-AUTH-04 & FR-RES-05: Strict assessment access control.
   * General Users and AI/ML Maintainers can only view their own assessments.
   * Healthcare Reviewers & System Admins can inspect assessments for clinical review/audit.
   */
  function canAccessAssessment(user, assessment) {
    if (!user || !assessment) return false;
    if (assessment.userId === user.id) return true;
    if (user.role === ROLES.HEALTHCARE_REVIEWER || user.role === ROLES.SYSTEM_ADMIN) {
      return true;
    }
    return false;
  }

  function getAccessibleAssessments() {
    const user = getCurrentUser();
    if (!user) return [];
    const all = Storage.getAssessments();
    return all.filter((a) => canAccessAssessment(user, a));
  }

  function getAssessmentById(assessmentId) {
    const user = getCurrentUser();
    if (!user) {
      return { ok: false, error: 'Authentication required.' };
    }
    const all = Storage.getAssessments();
    const record = all.find((a) => a.id === assessmentId);
    if (!record) {
      return { ok: false, error: 'Assessment record not found.' };
    }
    if (!canAccessAssessment(user, record)) {
      Storage.appendLog({
        category: 'SECURITY',
        severity: 'HIGH',
        actorId: user.id,
        actorName: user.name,
        actorRole: user.role,
        action: 'UNAUTHORIZED_RECORD_ACCESS_BLOCKED',
        details: `Blocked attempt by ${user.email} to access assessment ${assessmentId} belonging to another user.`
      });
      return { ok: false, error: 'Access denied: you are not authorized to view another user\'s health record (FR-AUTH-04).' };
    }
    return { ok: true, assessment: record };
  }

  function updateProfile(updates) {
    const user = getCurrentUser();
    if (!user) return { ok: false, error: 'Authentication required.' };

    const ageNum = updates.age === '' || updates.age === null || updates.age === undefined ? '' : Number(updates.age);
    if (ageNum !== '' && (Number.isNaN(ageNum) || ageNum < 0 || ageNum > 120)) {
      return { ok: false, error: 'Age must be between 0 and 120.' };
    }

    const users = Storage.getUsers();
    const idx = users.findIndex((u) => u.id === user.id);
    if (idx === -1) return { ok: false, error: 'User not found.' };

    if (updates.name && updates.name.trim().length >= 2) {
      users[idx].name = updates.name.trim();
    }

    users[idx].profile = {
      ...users[idx].profile,
      age: ageNum,
      gender: updates.gender || users[idx].profile.gender,
      bloodGroup: (updates.bloodGroup || '').trim(),
      allergies: (updates.allergies || '').trim(),
      chronicConditions: (updates.chronicConditions || '').trim(),
      medications: (updates.medications || '').trim(),
      emergencyContact: (updates.emergencyContact || '').trim()
    };

    Storage.saveUsers(users);
    Storage.appendLog({
      category: 'ACCOUNT',
      severity: 'INFO',
      actorId: user.id,
      actorName: users[idx].name,
      actorRole: user.role,
      action: 'PROFILE_UPDATED',
      details: 'Updated personal health profile.'
    });

    return { ok: true, user: sanitizeUser(users[idx]) };
  }

  function changePassword({ currentPassword, newPassword }) {
    const sessionUser = getCurrentUser();
    if (!sessionUser) return { ok: false, error: 'Authentication required.' };
    if (!newPassword || newPassword.length < 8) {
      return { ok: false, error: 'New password must be at least 8 characters.' };
    }

    const users = Storage.getUsers();
    const idx = users.findIndex((u) => u.id === sessionUser.id);
    if (idx === -1) return { ok: false, error: 'User not found.' };

    if (!Crypto.verifyPassword(currentPassword, users[idx].passwordHash)) {
      return { ok: false, error: 'Current password is incorrect.' };
    }

    users[idx].passwordHash = Crypto.hashPassword(newPassword);
    Storage.saveUsers(users);

    Storage.appendLog({
      category: 'SECURITY',
      severity: 'INFO',
      actorId: sessionUser.id,
      actorName: sessionUser.name,
      actorRole: sessionUser.role,
      action: 'PASSWORD_CHANGED',
      details: 'Password updated and stored as salted SHA-256 hash.'
    });

    return { ok: true };
  }

  return {
    ROLES,
    ROLE_LABELS,
    getCurrentUser,
    register,
    login,
    logout,
    requireRole,
    canAccessAssessment,
    getAccessibleAssessments,
    getAssessmentById,
    updateProfile,
    changePassword
  };
}));
