/**
 * Symptom & Health Data Validation Service
 * SRS: FR-DATA-01..05, NFR-PERF-02
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MedAssistValidation = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const VALID_SEVERITIES = ['mild', 'moderate', 'severe'];
  const VALID_GENDERS = ['Male', 'Female', 'Other', 'Prefer not to say'];

  function validateAssessmentInput(input) {
    const errors = [];
    const fieldErrors = {};

    if (!input || typeof input !== 'object') {
      return { valid: false, errors: ['Assessment payload is missing.'], fieldErrors };
    }

    // Age validation (FR-DATA-03, FR-DATA-04, FR-DATA-05)
    if (input.age === '' || input.age === null || input.age === undefined) {
      fieldErrors.age = 'Age is required.';
      errors.push('Age is required.');
    } else {
      const age = Number(input.age);
      if (Number.isNaN(age) || !Number.isFinite(age) || age < 0 || age > 120) {
        fieldErrors.age = 'Invalid age: must be a number between 0 and 120.';
        errors.push('Age must be between 0 and 120 years.');
      }
    }

    // Gender validation
    if (!input.gender || !VALID_GENDERS.includes(input.gender)) {
      fieldErrors.gender = 'Please select a valid gender option.';
      errors.push('Gender selection is required.');
    }

    // Optional body temperature validation (if provided, must be physiologically plausible)
    if (input.temperatureC !== '' && input.temperatureC !== null && input.temperatureC !== undefined) {
      const temp = Number(input.temperatureC);
      if (Number.isNaN(temp) || temp < 33.0 || temp > 43.0) {
        fieldErrors.temperatureC = 'Body temperature must be between 33.0 °C and 43.0 °C.';
        errors.push('Body temperature is outside valid clinical range (33.0–43.0 °C).');
      }
    }

    // Symptoms validation (FR-DATA-01, FR-DATA-02, FR-DATA-05)
    if (!Array.isArray(input.symptoms) || input.symptoms.length === 0) {
      fieldErrors.symptoms = 'Please select or enter at least one symptom.';
      errors.push('At least one symptom is required.');
    } else {
      input.symptoms.forEach((sym, idx) => {
        const label = sym && sym.name ? sym.name.trim() : `Symptom #${idx + 1}`;
        if (!sym || !sym.name || sym.name.trim().length < 2) {
          errors.push(`Symptom #${idx + 1}: name is missing or too short.`);
        } else if (/^\d+$/.test(sym.name.trim())) {
          errors.push(`"${sym.name}" is not a valid symptom description (numbers-only rejected).`);
        }

        const dur = Number(sym && sym.durationDays);
        if (sym.durationDays === '' || sym.durationDays === null || sym.durationDays === undefined) {
          errors.push(`${label}: duration (in days) is required.`);
        } else if (Number.isNaN(dur) || dur < 1 || dur > 365) {
          errors.push(`${label}: duration must be between 1 and 365 days.`);
        }

        if (!sym.severity || !VALID_SEVERITIES.includes(sym.severity)) {
          errors.push(`${label}: severity must be mild, moderate, or severe.`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
      fieldErrors
    };
  }

  return {
    VALID_SEVERITIES,
    VALID_GENDERS,
    validateAssessmentInput
  };
}));
