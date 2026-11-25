/**
 * Curated Medical Knowledge Base (SRS TBD-01, FR-RES-03, FR-RES-04, NFR-SAFE-03, NFR-SAFE-04)
 * Note: Structured clinical decision-support knowledge for preliminary screening only.
 * Not a replacement for qualified medical evaluation.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.MedAssistKnowledge = factory();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  const SYMPTOMS = [
    // Systemic / General
    { id: 'fever', name: 'Fever', category: 'General & Systemic', aliases: ['high temperature', 'pyrexia', 'febrile'], redFlag: false },
    { id: 'chills', name: 'Chills / Rigors', category: 'General & Systemic', aliases: ['shivering', 'cold sweats'], redFlag: false },
    { id: 'fatigue', name: 'Fatigue / Weakness', category: 'General & Systemic', aliases: ['tiredness', 'exhaustion', 'lethargy'], redFlag: false },
    { id: 'body_aches', name: 'Body / Muscle Aches', category: 'General & Systemic', aliases: ['myalgia', 'joint pain', 'muscle pain'], redFlag: false },
    { id: 'sweating', name: 'Profuse Sweating', category: 'General & Systemic', aliases: ['diaphoresis', 'cold sweat'], redFlag: true },

    // Respiratory
    { id: 'cough', name: 'Cough', category: 'Respiratory', aliases: ['dry cough', 'wet cough', 'productive cough'], redFlag: false },
    { id: 'shortness_of_breath', name: 'Shortness of Breath', category: 'Respiratory', aliases: ['dyspnea', 'difficulty breathing', 'breathlessness'], redFlag: true },
    { id: 'wheezing', name: 'Wheezing', category: 'Respiratory', aliases: ['whistling breath', 'tight airways'], redFlag: false },
    { id: 'chest_congestion', name: 'Chest Congestion / Sputum', category: 'Respiratory', aliases: ['phlegm', 'mucus'], redFlag: false },

    // ENT (Ear, Nose, Throat)
    { id: 'sore_throat', name: 'Sore Throat', category: 'ENT (Ear, Nose & Throat)', aliases: ['throat pain', 'pharyngitis'], redFlag: false },
    { id: 'runny_nose', name: 'Runny or Stuffy Nose', category: 'ENT (Ear, Nose & Throat)', aliases: ['nasal congestion', 'rhinorrhea', 'blocked nose'], redFlag: false },
    { id: 'sneezing', name: 'Frequent Sneezing', category: 'ENT (Ear, Nose & Throat)', aliases: ['sneeze'], redFlag: false },
    { id: 'facial_pressure', name: 'Sinus / Facial Pressure', category: 'ENT (Ear, Nose & Throat)', aliases: ['sinus pain', 'forehead pressure'], redFlag: false },
    { id: 'loss_of_smell', name: 'Loss of Taste or Smell', category: 'ENT (Ear, Nose & Throat)', aliases: ['anosmia', 'ageusia'], redFlag: false },
    { id: 'itchy_eyes', name: 'Itchy or Watery Eyes', category: 'ENT (Ear, Nose & Throat)', aliases: ['red eyes', 'allergic eyes'], redFlag: false },

    // Cardiovascular
    { id: 'chest_pain', name: 'Chest Pain or Tightness', category: 'Cardiovascular', aliases: ['chest pressure', 'angina', 'chest discomfort'], redFlag: true },
    { id: 'palpitations', name: 'Rapid or Irregular Heartbeat', category: 'Cardiovascular', aliases: ['tachycardia', 'heart racing'], redFlag: true },
    { id: 'radiating_arm_jaw_pain', name: 'Pain Radiating to Arm, Neck, or Jaw', category: 'Cardiovascular', aliases: ['left arm pain', 'jaw pain'], redFlag: true },

    // Neurological
    { id: 'headache', name: 'Headache', category: 'Neurological', aliases: ['head pain', 'migraine pain'], redFlag: false },
    { id: 'throbbing_headache', name: 'One-Sided Throbbing Headache', category: 'Neurological', aliases: ['unilateral headache', 'pulsating headache'], redFlag: false },
    { id: 'light_sensitivity', name: 'Sensitivity to Light or Sound', category: 'Neurological', aliases: ['photophobia', 'phonophobia'], redFlag: false },
    { id: 'dizziness', name: 'Dizziness / Lightheadedness', category: 'Neurological', aliases: ['vertigo', 'fainting feeling'], redFlag: false },
    { id: 'confusion', name: 'Confusion or Altered Mental State', category: 'Neurological', aliases: ['disorientation', 'delirium'], redFlag: true },
    { id: 'neck_stiffness', name: 'Severe Neck Stiffness', category: 'Neurological', aliases: ['stiff neck'], redFlag: true },
    { id: 'slurred_speech_weakness', name: 'Slurred Speech or One-Sided Weakness', category: 'Neurological', aliases: ['facial droop', 'numbness one side'], redFlag: true },

    // Gastrointestinal
    { id: 'nausea', name: 'Nausea', category: 'Gastrointestinal', aliases: ['queasy', 'feeling sick'], redFlag: false },
    { id: 'vomiting', name: 'Vomiting', category: 'Gastrointestinal', aliases: ['throwing up'], redFlag: false },
    { id: 'diarrhea', name: 'Diarrhea', category: 'Gastrointestinal', aliases: ['loose stools', 'watery stool'], redFlag: false },
    { id: 'abdominal_pain', name: 'Abdominal / Stomach Pain', category: 'Gastrointestinal', aliases: ['stomach cramps', 'belly pain'], redFlag: false },
    { id: 'heartburn', name: 'Heartburn / Acid Reflux', category: 'Gastrointestinal', aliases: ['acid indigestion', 'chest burning after meals'], redFlag: false },

    // Urinary & Dermatological
    { id: 'painful_urination', name: 'Burning or Painful Urination', category: 'Urinary & Skin', aliases: ['dysuria', 'burning pee'], redFlag: false },
    { id: 'frequent_urination', name: 'Frequent / Urgent Urination', category: 'Urinary & Skin', aliases: ['urinary urgency'], redFlag: false },
    { id: 'rash_hives', name: 'Skin Rash or Hives', category: 'Urinary & Skin', aliases: ['urticaria', 'itchy welts'], redFlag: false },
    { id: 'facial_throat_swelling', name: 'Facial, Lip, or Throat Swelling', category: 'Urinary & Skin', aliases: ['angioedema', 'swollen tongue'], redFlag: true }
  ];

  const CONDITIONS = [
    {
      id: 'common_cold',
      name: 'Common Cold (Viral Upper Respiratory Infection)',
      category: 'Respiratory / ENT',
      prior: 0.16,
      symptomWeights: {
        runny_nose: 0.92,
        sneezing: 0.85,
        sore_throat: 0.78,
        cough: 0.65,
        fatigue: 0.45,
        headache: 0.35,
        fever: 0.25
      },
      typicalDurationRange: [2, 10],
      severityPreference: 'mild',
      overview: 'A mild, self-limiting viral infection affecting the nose and throat, commonly caused by rhinoviruses.',
      guidance: [
        'Rest adequately and maintain steady fluid intake (water, warm broth, herbal tea).',
        'Saline nasal sprays or steam inhalation may ease nasal congestion.',
        'Monitor symptoms; seek care if high fever develops or symptoms worsen after 7–10 days.'
      ]
    },
    {
      id: 'influenza',
      name: 'Influenza (Seasonal Flu)',
      category: 'Respiratory / Systemic',
      prior: 0.11,
      symptomWeights: {
        fever: 0.92,
        body_aches: 0.90,
        chills: 0.82,
        fatigue: 0.88,
        cough: 0.76,
        headache: 0.70,
        sore_throat: 0.50,
        runny_nose: 0.40
      },
      typicalDurationRange: [2, 10],
      severityPreference: 'moderate',
      overview: 'An acute viral respiratory illness characterized by sudden onset fever, prominent body aches, and fatigue.',
      guidance: [
        'Prioritize bed rest, hydration, and fever monitoring.',
        'High-risk individuals (elderly, pregnant, chronic lung/heart disease) should consult a clinician early for antiviral evaluation.',
        'Seek prompt care if breathing difficulty, persistent chest pain, or confusion occurs.'
      ]
    },
    {
      id: 'viral_covid_like',
      name: 'Viral Respiratory Syndrome (COVID-19-like Pattern)',
      category: 'Respiratory / Systemic',
      prior: 0.09,
      symptomWeights: {
        fever: 0.78,
        cough: 0.84,
        loss_of_smell: 0.95,
        fatigue: 0.82,
        shortness_of_breath: 0.62,
        sore_throat: 0.60,
        body_aches: 0.65,
        headache: 0.55
      },
      typicalDurationRange: [2, 14],
      severityPreference: 'moderate',
      overview: 'A contagious viral respiratory pattern that may include fever, cough, fatigue, and altered taste or smell.',
      guidance: [
        'Consider standardized antigen or PCR diagnostic testing to confirm.',
        'Isolate from vulnerable individuals and monitor oxygen levels if respiratory symptoms progress.',
        'Seek urgent medical care if shortness of breath or chest tightness develops.'
      ]
    },
    {
      id: 'allergic_rhinitis',
      name: 'Seasonal Allergic Rhinitis',
      category: 'Allergy / ENT',
      prior: 0.12,
      symptomWeights: {
        sneezing: 0.92,
        itchy_eyes: 0.94,
        runny_nose: 0.88,
        facial_pressure: 0.42,
        fatigue: 0.30
      },
      typicalDurationRange: [3, 60],
      severityPreference: 'mild',
      overview: 'An immune-mediated nasal and ocular response to airborne allergens such as pollen, dust mites, or pet dander.',
      guidance: [
        'Minimize exposure to suspected environmental triggers (pollen, dust).',
        'Rinsing nasal passages with sterile saline can reduce allergen burden.',
        'Discuss non-drowsy antihistamines or intranasal options with a pharmacist or physician.'
      ]
    },
    {
      id: 'acute_sinusitis',
      name: 'Acute Sinusitis',
      category: 'ENT',
      prior: 0.08,
      symptomWeights: {
        facial_pressure: 0.94,
        runny_nose: 0.82,
        headache: 0.78,
        cough: 0.45,
        fever: 0.45,
        fatigue: 0.50
      },
      typicalDurationRange: [4, 21],
      severityPreference: 'moderate',
      overview: 'Inflammation of the paranasal sinus cavities causing facial pressure, nasal blockage, and headache.',
      guidance: [
        'Warm facial compresses, hydration, and steam inhalation help promote sinus drainage.',
        'Consult a doctor if symptoms persist beyond 10 days, worsen after initial improvement, or involve high fever.'
      ]
    },
    {
      id: 'acute_bronchitis',
      name: 'Acute Bronchitis',
      category: 'Respiratory',
      prior: 0.08,
      symptomWeights: {
        cough: 0.95,
        chest_congestion: 0.90,
        wheezing: 0.65,
        fatigue: 0.65,
        shortness_of_breath: 0.45,
        sore_throat: 0.40,
        fever: 0.35
      },
      typicalDurationRange: [5, 25],
      severityPreference: 'moderate',
      overview: 'Temporary inflammation of the bronchial airways causing persistent cough with or without sputum.',
      guidance: [
        'Avoid tobacco smoke and airborne irritants; use humidified air and stay hydrated.',
        'Most cases are viral; consult a clinician if cough lasts over 3 weeks, fever is high, or breathing is labored.'
      ]
    },
    {
      id: 'pneumonia_risk',
      name: 'Lower Respiratory Infection / Pneumonia Risk',
      category: 'Respiratory (Higher Risk)',
      prior: 0.05,
      symptomWeights: {
        fever: 0.88,
        cough: 0.88,
        chest_congestion: 0.82,
        shortness_of_breath: 0.85,
        chills: 0.78,
        chest_pain: 0.62,
        fatigue: 0.80
      },
      typicalDurationRange: [2, 21],
      severityPreference: 'severe',
      ageRiskBoost: (age) => (age >= 60 || age <= 5 ? 0.25 : 0),
      overview: 'A potentially serious lung infection causing inflammation of the air sacs; requires clinical evaluation and imaging.',
      guidance: [
        'Arrange prompt evaluation by a healthcare provider for chest examination and possible chest X-ray.',
        'Seek emergency care immediately if experiencing rapid breathing, severe chest pain, or confusion.'
      ]
    },
    {
      id: 'asthma_exacerbation',
      name: 'Asthma / Reactive Airway Flare-up',
      category: 'Respiratory',
      prior: 0.06,
      symptomWeights: {
        wheezing: 0.95,
        shortness_of_breath: 0.90,
        cough: 0.72,
        chest_pain: 0.55
      },
      typicalDurationRange: [1, 14],
      severityPreference: 'moderate',
      overview: 'Airway narrowing and inflammation leading to wheezing, cough, and chest tightness.',
      guidance: [
        'Follow your prescribed asthma action plan if previously diagnosed.',
        'Avoid cold dry air, smoke, and allergen triggers.',
        'Seek urgent emergency care if breathing does not improve or speaking full sentences becomes difficult.'
      ]
    },
    {
      id: 'migraine',
      name: 'Migraine Headache',
      category: 'Neurological',
      prior: 0.09,
      symptomWeights: {
        throbbing_headache: 0.95,
        headache: 0.88,
        light_sensitivity: 0.92,
        nausea: 0.76,
        vomiting: 0.52,
        dizziness: 0.48
      },
      typicalDurationRange: [1, 4],
      severityPreference: 'moderate',
      overview: 'A recurring neurological headache disorder often characterized by throbbing pain, light/sound sensitivity, and nausea.',
      guidance: [
        'Rest in a quiet, darkened room and maintain hydration.',
        'Track potential triggers (sleep changes, dehydration, stress, specific foods).',
        'Seek emergency evaluation for a sudden "thunderclap" headache or neurological deficits.'
      ]
    },
    {
      id: 'tension_headache',
      name: 'Tension-Type Headache',
      category: 'Neurological',
      prior: 0.12,
      symptomWeights: {
        headache: 0.94,
        fatigue: 0.55,
        body_aches: 0.40,
        dizziness: 0.25
      },
      typicalDurationRange: [1, 7],
      severityPreference: 'mild',
      overview: 'Common mild-to-moderate band-like headache often linked to muscle tension, eye strain, or stress.',
      guidance: [
        'Take regular screen breaks, practice gentle neck stretches, and ensure adequate sleep and hydration.',
        'Consult a clinician if headaches become frequent or interfere with daily function.'
      ]
    },
    {
      id: 'gastroenteritis',
      name: 'Acute Gastroenteritis',
      category: 'Gastrointestinal',
      prior: 0.10,
      symptomWeights: {
        diarrhea: 0.92,
        nausea: 0.88,
        vomiting: 0.84,
        abdominal_pain: 0.86,
        fever: 0.52,
        fatigue: 0.60
      },
      typicalDurationRange: [1, 7],
      severityPreference: 'moderate',
      overview: 'Irritation or infection of the digestive tract causing cramping, nausea, vomiting, and loose stools.',
      guidance: [
        'Focus on oral rehydration solutions (electrolytes and clean fluids) in small, frequent sips.',
        'Gradually reintroduce bland foods as tolerated.',
        'Seek medical attention if unable to keep fluids down for 24 hours, or if signs of severe dehydration appear.'
      ]
    },
    {
      id: 'gerd_gastritis',
      name: 'Acid Reflux (GERD) / Gastritis Pattern',
      category: 'Gastrointestinal',
      prior: 0.08,
      symptomWeights: {
        heartburn: 0.96,
        abdominal_pain: 0.72,
        nausea: 0.60,
        chest_pain: 0.40
      },
      typicalDurationRange: [1, 30],
      severityPreference: 'mild',
      overview: 'Upper digestive irritation or stomach acid reflux causing burning discomfort in the upper abdomen or lower chest.',
      guidance: [
        'Eat smaller meals, avoid lying down within 2–3 hours after eating, and limit spicy or acidic triggers.',
        'Because chest discomfort can overlap with cardiac conditions, seek urgent care if chest pain is squeezing, radiates, or accompanies breathlessness.'
      ]
    },
    {
      id: 'uti',
      name: 'Urinary Tract Infection (UTI)',
      category: 'Urinary',
      prior: 0.07,
      symptomWeights: {
        painful_urination: 0.96,
        frequent_urination: 0.92,
        abdominal_pain: 0.52,
        fever: 0.42
      },
      typicalDurationRange: [1, 10],
      severityPreference: 'moderate',
      overview: 'A bacterial infection of the lower urinary tract causing burning urination and increased urinary urgency.',
      guidance: [
        'Schedule a primary care or urgent care visit for a urine test and targeted treatment.',
        'Drink plenty of water; seek prompt care if flank/back pain, high fever, or chills develop.'
      ]
    },
    {
      id: 'cardiac_vascular_alert',
      name: 'Acute Cardiopulmonary Risk Pattern (Urgent Evaluation)',
      category: 'Cardiovascular (High Risk)',
      prior: 0.03,
      symptomWeights: {
        chest_pain: 0.96,
        shortness_of_breath: 0.88,
        radiating_arm_jaw_pain: 0.95,
        sweating: 0.82,
        palpitations: 0.78,
        dizziness: 0.70
      },
      typicalDurationRange: [1, 3],
      severityPreference: 'severe',
      ageRiskBoost: (age) => (age >= 45 ? 0.30 : 0),
      overview: 'Symptom pattern potentially associated with acute cardiac or cardiopulmonary strain requiring immediate professional assessment.',
      guidance: [
        'DO NOT delay: seek immediate emergency medical evaluation (call 911 / 112 / 108 or go to the nearest Emergency Department).',
        'Do not drive yourself to the hospital if experiencing chest pain or dizziness.'
      ]
    }
  ];

  // Configured High-Risk Symptom Rules (FR-RES-04, NFR-SAFE-03)
  const EMERGENCY_RULES = [
    {
      id: 'CARDIAC_RED_FLAG',
      title: 'Possible Cardiac / Acute Chest Emergency',
      condition: 'Chest pain/tightness combined with shortness of breath, radiating pain, sweating, or severe severity',
      guidance: 'Call emergency medical services (911 / 112 / 108) immediately. Stop physical activity, sit or rest comfortably, and do not drive yourself.',
      match: (input) => {
        const ids = new Set(input.symptoms.map((s) => s.id));
        const chest = input.symptoms.find((s) => s.id === 'chest_pain');
        if (!chest) return false;
        return (
          ids.has('shortness_of_breath') ||
          ids.has('radiating_arm_jaw_pain') ||
          ids.has('sweating') ||
          ids.has('dizziness') ||
          chest.severity === 'severe'
        );
      }
    },
    {
      id: 'NEURO_STROKE_MENINGITIS',
      title: 'Urgent Neurological Red Flag',
      condition: 'Confusion, slurred speech / one-sided weakness, or headache with severe neck stiffness',
      guidance: 'Seek immediate emergency hospital care. Sudden neurological symptoms require urgent time-critical medical assessment.',
      match: (input) => {
        const ids = new Set(input.symptoms.map((s) => s.id));
        return (
          ids.has('slurred_speech_weakness') ||
          ids.has('confusion') ||
          (ids.has('neck_stiffness') && (ids.has('fever') || ids.has('headache')))
        );
      }
    },
    {
      id: 'ANAPHYLAXIS_AIRWAY',
      title: 'Potential Severe Allergic Reaction / Airway Risk',
      condition: 'Facial, lip, or throat swelling combined with breathing difficulty or hives',
      guidance: 'Seek emergency medical attention immediately. Airway swelling can progress rapidly.',
      match: (input) => {
        const ids = new Set(input.symptoms.map((s) => s.id));
        return ids.has('facial_throat_swelling') && (ids.has('shortness_of_breath') || ids.has('rash_hives') || ids.has('wheezing'));
      }
    },
    {
      id: 'SEVERE_RESPIRATORY_DISTRESS',
      title: 'Severe Respiratory Distress Indicator',
      condition: 'Severe shortness of breath or rapid heartbeat with breathing difficulty',
      guidance: 'Seek urgent medical or emergency evaluation promptly to check oxygen saturation and lung function.',
      match: (input) => {
        const sob = input.symptoms.find((s) => s.id === 'shortness_of_breath');
        const ids = new Set(input.symptoms.map((s) => s.id));
        return Boolean(sob && (sob.severity === 'severe' || (ids.has('fever') && ids.has('palpitations'))));
      }
    }
  ];

  return {
    SYMPTOMS,
    CONDITIONS,
    EMERGENCY_RULES
  };
}));
