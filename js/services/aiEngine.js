/**
 * AI/ML Diagnostic & Risk Assessment Engine
 * SRS: FR-AI-01..07, FR-RES-04, NFR-PERF-01/04, NFR-SAFE-03/05, NFR-QUAL-03/04/07
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    const Knowledge = require('../data/medicalKnowledge');
    const Validation = require('./validationService');
    const Storage = require('./storageService');
    const Crypto = require('./cryptoService');
    module.exports = factory(Knowledge, Validation, Storage, Crypto);
  } else {
    root.MedAssistAI = factory(
      root.MedAssistKnowledge,
      root.MedAssistValidation,
      root.MedAssistStorage,
      root.MedAssistCrypto
    );
  }
}(typeof self !== 'undefined' ? self : this, function (Knowledge, Validation, Storage, Crypto) {
  'use strict';

  const SEVERITY_WEIGHTS = {
    mild: 0.72,
    moderate: 1.0,
    severe: 1.42
  };

  // Request deduplication cache (NFR-PERF-04)
  const inferenceCache = new Map();

  function getActiveModel() {
    const models = Storage.getModels();
    return models.find((m) => m.status === 'ACTIVE') || null;
  }

  /**
   * FR-AI-01: Preprocess & normalize input symptoms, custom text aliases, and vitals.
   */
  function preprocessInput(rawInput) {
    const normalizedSymptoms = [];
    const unrecognizedSymptoms = [];

    for (const item of rawInput.symptoms) {
      const cleanName = item.name.trim();
      const lower = cleanName.toLowerCase();

      // Match by exact ID, name, or clinical alias
      let matched = Knowledge.SYMPTOMS.find(
        (s) =>
          s.id === item.id ||
          s.name.toLowerCase() === lower ||
          (s.aliases && s.aliases.some((alias) => lower.includes(alias) || alias.includes(lower)))
      );

      // Fuzzy token overlap fallback for custom entered symptoms
      if (!matched) {
        matched = Knowledge.SYMPTOMS.find((s) => {
          const tokens = s.name.toLowerCase().split(/[\s/,]+/).filter((t) => t.length > 3);
          return tokens.some((tok) => lower.includes(tok));
        });
      }

      if (matched) {
        const existing = normalizedSymptoms.find((ns) => ns.id === matched.id);
        if (!existing) {
          normalizedSymptoms.push({
            id: matched.id,
            name: matched.name,
            originalLabel: cleanName,
            durationDays: Number(item.durationDays),
            severity: item.severity,
            severityWeight: SEVERITY_WEIGHTS[item.severity] || 1.0,
            redFlag: matched.redFlag
          });
        }
      } else {
        unrecognizedSymptoms.push({
          name: cleanName,
          durationDays: Number(item.durationDays),
          severity: item.severity
        });
      }
    }

    // Automatic fever inference if elevated temperature >= 38.0 C is provided
    const tempC = rawInput.temperatureC !== '' && rawInput.temperatureC !== undefined && rawInput.temperatureC !== null
      ? Number(rawInput.temperatureC)
      : null;

    if (tempC !== null && tempC >= 38.0 && !normalizedSymptoms.some((s) => s.id === 'fever')) {
      normalizedSymptoms.push({
        id: 'fever',
        name: 'Fever',
        originalLabel: `Measured Temperature (${tempC.toFixed(1)} °C)`,
        durationDays: normalizedSymptoms[0] ? normalizedSymptoms[0].durationDays : 1,
        severity: tempC >= 39.2 ? 'severe' : 'moderate',
        severityWeight: tempC >= 39.2 ? SEVERITY_WEIGHTS.severe : SEVERITY_WEIGHTS.moderate,
        redFlag: false,
        inferredFromVitals: true
      });
    }

    return {
      age: Number(rawInput.age),
      gender: rawInput.gender,
      temperatureC: tempC,
      existingConditions: (rawInput.existingConditions || '').trim(),
      allergies: (rawInput.allergies || '').trim(),
      symptoms: normalizedSymptoms,
      unrecognizedSymptoms
    };
  }

  /**
   * Swappable Model Inference Strategies (NFR-QUAL-04)
   * Deterministic scoring ensures identical inputs + same version produce identical results (NFR-QUAL-03).
   */
  const MODEL_STRATEGIES = {
    'v2.1.0-ClinicalBayes': function scoreClinicalBayesV21(processed) {
      return scoreConditions(processed, {
        useDurationAlignment: true,
        useAgeRiskBoost: true,
        useSeverityCalibration: true,
        priorInfluence: 0.35
      });
    },
    'v2.0.1-StandardBayes': function scoreStandardBayesV20(processed) {
      return scoreConditions(processed, {
        useDurationAlignment: false,
        useAgeRiskBoost: false,
        useSeverityCalibration: true,
        priorInfluence: 0.45
      });
    },
    'v1.9.0-ExperimentalLinear': function scoreLegacyV19(processed) {
      return scoreConditions(processed, {
        useDurationAlignment: false,
        useAgeRiskBoost: false,
        useSeverityCalibration: false,
        priorInfluence: 0.2
      });
    }
  };

  function scoreConditions(processed, opts) {
    const rawScores = [];

    for (const cond of Knowledge.CONDITIONS) {
      const weights = cond.symptomWeights;
      let matchedWeightSum = 0;
      let totalPossibleWeight = 0;
      const factors = [];

      Object.keys(weights).forEach((wKey) => {
        totalPossibleWeight += weights[wKey];
      });

      for (const sym of processed.symptoms) {
        const w = weights[sym.id];
        if (w) {
          const sevFactor = opts.useSeverityCalibration ? sym.severityWeight : 1.0;
          let durFactor = 1.0;

          if (opts.useDurationAlignment && cond.typicalDurationRange) {
            const [minD, maxD] = cond.typicalDurationRange;
            if (sym.durationDays >= minD && sym.durationDays <= maxD) {
              durFactor = 1.12;
            } else if (sym.durationDays > maxD * 1.5) {
              durFactor = 0.85;
            }
          }

          const contribution = w * sevFactor * durFactor;
          matchedWeightSum += contribution;

          factors.push(
            `Matched ${sym.name} (${sym.severity}, ${sym.durationDays}d) — relevance ${(w * 100).toFixed(0)}%`
          );
        }
      }

      if (matchedWeightSum <= 0) continue;

      // Normalized symptom coverage + clinical prior
      const coverageRatio = matchedWeightSum / Math.max(totalPossibleWeight * 0.55, 1);
      let score = coverageRatio * (1 + cond.prior * opts.priorInfluence);

      if (opts.useAgeRiskBoost && typeof cond.ageRiskBoost === 'function') {
        const boost = cond.ageRiskBoost(processed.age);
        if (boost > 0) {
          score *= 1 + boost;
          factors.push(`Age risk modifier applied (Age ${processed.age})`);
        }
      }

      if (processed.temperatureC !== null && processed.temperatureC >= 38.0 && weights.fever) {
        score *= 1.1;
        factors.push(`Elevated body temperature (${processed.temperatureC.toFixed(1)} °C) supports febrile pattern`);
      }

      // Bonus for multiple corroborating symptoms
      if (factors.length >= 3) {
        score *= 1.15;
      }

      rawScores.push({
        condition: cond,
        rawScore: score,
        matchedCount: processed.symptoms.filter((s) => Boolean(weights[s.id])).length,
        factors
      });
    }

    rawScores.sort((a, b) => b.rawScore - a.rawScore);

    const topRaw = rawScores.slice(0, 5);
    const totalScore = topRaw.reduce((acc, r) => acc + r.rawScore, 0);

    return topRaw.map((item) => {
      // Softmax-style proportional confidence capped conservatively at 92% (preliminary screening)
      const normalized = totalScore > 0 ? (item.rawScore / totalScore) : 0;
      const calibratedConfidence = Math.min(0.92, Math.max(0.08, Number((normalized * 0.94).toFixed(2))));

      return {
        conditionId: item.condition.id,
        name: item.condition.name,
        category: item.condition.category,
        probability: calibratedConfidence,
        rawSignal: Number(item.rawScore.toFixed(3)),
        matchedCount: item.matchedCount,
        overview: item.condition.overview,
        guidance: item.condition.guidance,
        factors: item.factors
      };
    });
  }

  function evaluateEmergencyRules(processed, settings) {
    if (settings && settings.emergencyRulesEnabled === false) return [];
    const alerts = [];
    for (const rule of Knowledge.EMERGENCY_RULES) {
      if (rule.match(processed)) {
        alerts.push({
          ruleId: rule.id,
          title: rule.title,
          condition: rule.condition,
          guidance: rule.guidance
        });
      }
    }
    return alerts;
  }

  function buildCacheKey(processed, modelVersion) {
    const symKey = processed.symptoms
      .map((s) => `${s.id}:${s.severity}:${s.durationDays}`)
      .sort()
      .join('|');
    return `${modelVersion}::${processed.age}::${processed.gender}::${processed.temperatureC || ''}::${symKey}`;
  }

  /**
   * Executes the full preliminary assessment pipeline and persists it when authorized.
   */
  function runAssessment(rawInput, currentUser) {
    const startMs = Date.now();
    const settings = Storage.getSettings();

    // 1. Validate inputs before touching AI model (FR-DATA-03..05, NFR-PERF-02)
    const validation = Validation.validateAssessmentInput(rawInput);
    if (!validation.valid) {
      return {
        ok: false,
        errorType: 'VALIDATION_ERROR',
        errors: validation.errors,
        fieldErrors: validation.fieldErrors
      };
    }

    // 2. Check active AI model availability & fail-safe conditions (FR-AI-07, NFR-SAFE-05)
    const activeModel = getActiveModel();
    if (settings.simulateAiFailure || !activeModel || activeModel.status !== 'ACTIVE' || !activeModel.approved) {
      Storage.appendLog({
        category: 'AI_INFERENCE',
        severity: 'ERROR',
        actorId: currentUser ? currentUser.id : 'system',
        actorName: currentUser ? currentUser.name : 'System',
        actorRole: currentUser ? currentUser.role : 'SYSTEM',
        action: 'AI_INFERENCE_FAIL_SAFE_TRIGGERED',
        details: settings.simulateAiFailure
          ? 'Simulated AI service outage active; returned safe error message without false diagnosis.'
          : 'No healthy approved AI model version is currently active.'
      });

      return {
        ok: false,
        errorType: 'AI_SERVICE_UNAVAILABLE',
        safeMessage:
          'The AI diagnostic engine is temporarily unavailable or undergoing maintenance. No assessment results were generated. Please consult a qualified healthcare professional or seek urgent care if you have severe symptoms.'
      };
    }

    const strategy = MODEL_STRATEGIES[activeModel.version] || MODEL_STRATEGIES['v2.1.0-ClinicalBayes'];

    // 3. Preprocess inputs (FR-AI-01)
    const processed = preprocessInput(rawInput);

    // 4. Emergency high-risk triage (FR-RES-04, NFR-SAFE-03)
    const emergencyAlerts = evaluateEmergencyRules(processed, settings);

    // 5. Check request deduplication cache (NFR-PERF-04)
    const cacheKey = buildCacheKey(processed, activeModel.version);
    let predictions;
    let cacheHit = false;

    if (inferenceCache.has(cacheKey)) {
      predictions = JSON.parse(JSON.stringify(inferenceCache.get(cacheKey)));
      cacheHit = true;
    } else {
      predictions = strategy(processed);
      inferenceCache.set(cacheKey, JSON.parse(JSON.stringify(predictions)));
    }

    const latencyMs = Math.max(4, Date.now() - startMs);

    // 6. Insufficient information check (FR-AI-04)
    const topSignal = predictions.length > 0 ? predictions[0].rawSignal : 0;
    const minScore = typeof settings.minInsufficientScore === 'number' ? settings.minInsufficientScore : 0.28;
    const isInsufficient =
      processed.symptoms.length === 0 ||
      predictions.length === 0 ||
      (processed.symptoms.length === 1 &&
        processed.symptoms[0].severity === 'mild' &&
        topSignal < minScore &&
        emergencyAlerts.length === 0);

    const status = isInsufficient ? 'INSUFFICIENT_INFO' : 'COMPLETED';
    const maxDisplayed = settings.maxResultsDisplayed || 4;
    const finalPredictions = isInsufficient ? [] : predictions.slice(0, maxDisplayed);

    const record = {
      id: Crypto.generateId('asm'),
      userId: currentUser ? currentUser.id : 'anonymous',
      userName: currentUser ? currentUser.name : 'Anonymous',
      createdAt: new Date().toISOString(),
      modelVersion: activeModel.version,
      modelDisplayName: activeModel.displayName,
      latencyMs,
      cacheHit,
      status,
      input: {
        age: processed.age,
        gender: processed.gender,
        temperatureC: processed.temperatureC,
        existingConditions: processed.existingConditions,
        allergies: processed.allergies,
        symptoms: processed.symptoms.map((s) => ({
          id: s.id,
          name: s.name,
          durationDays: s.durationDays,
          severity: s.severity
        })),
        unrecognizedSymptoms: processed.unrecognizedSymptoms
      },
      emergencyAlerts,
      predictions: finalPredictions,
      insufficientReason: isInsufficient
        ? 'The provided symptoms are either outside our verified clinical symptom vocabulary or too mild/nonspecific to generate a reliable preliminary ranking. Please add more specific symptoms, duration, or clinical context.'
        : null,
      disclaimer:
        'PRELIMINARY ASSESSMENT ONLY: This AI-generated output is a decision-support screening tool and is NOT a confirmed medical diagnosis. Always consult a qualified healthcare professional.'
    };

    if (currentUser) {
      const allAssessments = Storage.getAssessments();
      allAssessments.unshift(record);
      Storage.saveAssessments(allAssessments);

      Storage.appendLog({
        category: 'AI_INFERENCE',
        severity: emergencyAlerts.length > 0 ? 'WARN' : 'INFO',
        actorId: currentUser.id,
        actorName: currentUser.name,
        actorRole: currentUser.role,
        action: 'ASSESSMENT_GENERATED',
        details: `Assessment ${record.id} completed using ${activeModel.version} in ${latencyMs}ms (status: ${status}, emergencyFlags: ${emergencyAlerts.length}).`
      });
    }

    return {
      ok: true,
      assessment: record
    };
  }

  function clearCache() {
    inferenceCache.clear();
  }

  return {
    getActiveModel,
    preprocessInput,
    runAssessment,
    clearCache
  };
}));
