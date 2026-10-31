/**
 * Gemini AI integration using the official @google/genai SDK.
 * Handles issue triage and proof resolution verification.
 * Always requests application/json, strips markdown fences, and uses safe fallbacks.
 * 
 * Includes automated multi-model fallback on 404/NOT_FOUND errors:
 * VITE_GEMINI_MODEL -> gemini-3.8-flash -> gemini-3.7-flash -> gemini-3.6-flash -> gemini-3.5-flash
 */
import { GoogleGenAI } from '@google/genai';
import { CRITICAL_SEVERITY_THRESHOLD, ISSUE_TYPES, DEPARTMENTS } from '../config.js';

const apiKey =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_GEMINI_KEY) ||
  '';
const configuredModel =
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GEMINI_MODEL) ||
  (typeof process !== 'undefined' && process.env?.VITE_GEMINI_MODEL) ||
  'gemini-3.8-flash';

// Priority model list: VITE_GEMINI_MODEL first, followed by fallbacks
const FALLBACK_MODELS = [
  configuredModel,
  'gemini-3.8-flash',
  'gemini-3.7-flash',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
];

// Deduplicate model names preserving order
const MODEL_LIST = Array.from(new Set(FALLBACK_MODELS.filter(Boolean)));

// Remember the first working model across calls
let activeModel = MODEL_LIST[0];

// Lazily initialized SDK instance
let aiClient = null;
function getAiClient() {
  if (!aiClient) {
    if (!apiKey) {
      console.warn('[CivicEye] Gemini API key is missing. Set VITE_GEMINI_KEY in .env');
    }
    aiClient = new GoogleGenAI({ apiKey });
  }
  return aiClient;
}

/**
 * Strips markdown code blocks (```json ... ```) from Gemini text responses.
 * @param {string} raw 
 * @returns {string} Clean JSON string
 */
export function cleanJsonText(raw) {
  if (!raw) return '{}';
  let cleaned = raw.trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

/**
 * Checks whether an error indicates a 404 / NOT_FOUND / retired model.
 */
export function isNotFoundError(err) {
  if (!err) return false;
  const msg = String(err.message || '').toLowerCase();
  const status = err.status || err.statusCode || (err.error && err.error.code);
  return (
    status === 404 ||
    status === 503 ||
    msg.includes('404') ||
    msg.includes('503') ||
    msg.includes('not_found') ||
    msg.includes('not found') ||
    msg.includes('no longer available') ||
    msg.includes('unsupported model') ||
    msg.includes('is not found') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('timed out')
  );
}

function withTimeout(promise, timeoutMs = 12000) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`Model timed out after ${timeoutMs / 1000}s`)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * Executes a Gemini generateContent call with structured JSON parsing.
 * Tries models in priority order on 404 / NOT_FOUND errors and remembers
 * the working model for subsequent calls.
 * 
 * @param {Array} contents 
 * @param {Object} [config={}] 
 * @returns {Promise<any>} Parsed JSON response
 */
export async function callJson(contents, config = {}) {
  const ai = getAiClient();
  if (!apiKey) {
    throw new Error('VITE_GEMINI_KEY is not configured');
  }

  // Build candidate models order starting with the known working activeModel
  const candidateModels = [
    activeModel,
    ...MODEL_LIST.filter((m) => m !== activeModel),
  ];

  let lastError = null;

  for (const model of candidateModels) {
    try {
      const response = await withTimeout(
        ai.models.generateContent({
          model,
          contents,
          config: {
            responseMimeType: 'application/json',
            ...config,
          },
        }),
        12000
      );

      // Remember the working model for future calls
      if (model !== activeModel) {
        console.info(`[CivicEye] Active Gemini model switched to working model: "${model}"`);
        activeModel = model;
      }

      const rawText = response.text || '';
      const cleaned = cleanJsonText(rawText);
      return JSON.parse(cleaned);
    } catch (err) {
      lastError = err;
      if (isNotFoundError(err)) {
        console.warn(`[CivicEye] Model "${model}" is unavailable (${err.message}). Trying next fallback model...`);
        continue;
      } else {
        // Non-404 error (rate limit, network issue, or bad response)
        console.error(`[CivicEye] Error on model "${model}":`, err.message);
        throw err;
      }
    }
  }

  console.error('[CivicEye] All Gemini models in fallback list failed:', lastError?.message);
  throw lastError || new Error('All Gemini fallback models exhausted');
}

/**
 * Fallback response when AI triage fails or is unreachable.
 */
export const TRIAGE_FALLBACK = {
  issue_type: 'other',
  severity: 5,
  description: 'AI analysis is temporarily unavailable, you can enter the details manually',
  department: 'other',
  urgency: 'medium',
  estimated_fix_days: 7,
  safety_risk: false,
  affects_traffic: false,
};

/**
 * Analyzes a civic issue image using Gemini.
 * Returns classification, severity, urgency, department, description, and safety risk.
 * 
 * @param {string} base64DataUrl Full data URL (data:image/jpeg;base64,...)
 * @param {string} [citizenNote=''] Optional citizen notes / voice transcription
 * @returns {Promise<typeof TRIAGE_FALLBACK & { aiAnalyzed: boolean }>}
 */
export async function triageCivicIssue(base64DataUrl, citizenNote = '') {
  try {
    if (!apiKey) {
      console.warn('[CivicEye] Using triage fallback because VITE_GEMINI_KEY is not configured');
      return {
        ...TRIAGE_FALLBACK,
        description: 'AI analysis is temporarily unavailable, you can enter the details manually',
        aiAnalyzed: false,
      };
    }

    // Extract base64 without prefix
    const base64Data = base64DataUrl.includes(',')
      ? base64DataUrl.split(',')[1]
      : base64DataUrl;

    const promptText = `
You are an expert municipal infrastructure inspector analyzing a civic issue photo reported by a citizen.
${citizenNote ? `Citizen note: "${citizenNote}"` : ''}

Classify this image and return a JSON object with EXACTLY these fields:
- "issue_type": One of [${ISSUE_TYPES.map((t) => `"${t}"`).join(', ')}]
- "severity": integer from 1 to 10 (10 = imminent life threatening danger, 1 = minor cosmetic)
- "description": 2-3 concise sentences describing the problem visible in the photo and potential hazards
- "department": One of [${DEPARTMENTS.map((d) => `"${d}"`).join(', ')}]
- "urgency": "critical", "high", "medium", or "low".
  IMPORTANT RULE: If severity >= 8, urgency MUST be "critical".
- "estimated_fix_days": realistic number of days to repair (e.g. 1, 3, 7, 14)
- "safety_risk": boolean (true if pedestrians or motorists could be injured)
- "affects_traffic": boolean (true if blocking or slowing vehicle/pedestrian movement)

Return ONLY valid JSON matching this structure.
`;

    const parsed = await callJson([
      {
        role: 'user',
        parts: [
          { text: promptText },
          {
            inlineData: {
              mimeType: 'image/jpeg',
              data: base64Data,
            },
          },
        ],
      },
    ]);

    // Validate and sanitize response
    const issue_type = ISSUE_TYPES.includes(parsed.issue_type) ? parsed.issue_type : 'other';
    const department = DEPARTMENTS.includes(parsed.department) ? parsed.department : 'other';
    let severity = Math.max(1, Math.min(10, parseInt(parsed.severity, 10) || 5));
    let urgency = ['critical', 'high', 'medium', 'low'].includes(parsed.urgency)
      ? parsed.urgency
      : 'medium';

    // Strict constraint enforcement: severity >= 8 => urgency "critical"
    if (severity >= CRITICAL_SEVERITY_THRESHOLD) {
      urgency = 'critical';
    }

    return {
      issue_type,
      severity,
      description: parsed.description || 'Civic infrastructure issue observed.',
      department,
      urgency,
      estimated_fix_days: parseInt(parsed.estimated_fix_days, 10) || 7,
      safety_risk: Boolean(parsed.safety_risk),
      affects_traffic: Boolean(parsed.affects_traffic),
      aiAnalyzed: true,
    };
  } catch (err) {
    console.error('[CivicEye] Gemini triage technical error:', err.message);
    return {
      ...TRIAGE_FALLBACK,
      description: 'AI analysis is temporarily unavailable, you can enter the details manually',
      aiAnalyzed: false,
    };
  }
}

/**
 * Fallback verification result on error.
 */
export const VERIFY_FALLBACK = {
  same_location: false,
  issue_resolved: false,
  confidence: 0,
  explanation: 'AI verification service is temporarily unavailable. Sent to admin queue.',
  red_flags: ['ai_error'],
};

/**
 * Verifies resolution proof against original report photo.
 * Used when officer submits completion evidence.
 * 
 * @param {string} beforeDataUrl 
 * @param {string} afterDataUrl 
 * @param {string} issueType 
 * @returns {Promise<typeof VERIFY_FALLBACK>}
 */
export async function verifyResolutionProof(beforeDataUrl, afterDataUrl, issueType) {
  try {
    if (!apiKey) {
      return VERIFY_FALLBACK;
    }

    const beforeBase64 = beforeDataUrl.includes(',') ? beforeDataUrl.split(',')[1] : beforeDataUrl;
    const afterBase64 = afterDataUrl.includes(',') ? afterDataUrl.split(',')[1] : afterDataUrl;

    const promptText = `
Image 1 is the original report photo for issue type: "${issueType}".
Image 2 is the claimed fix submitted by the municipal officer.

Verify the work by checking:
(1) Is Image 2 taken at the exact same physical location as Image 1? (Look at background landmarks, pavement patterns, building lines, foliage, curbs).
(2) Was the specific reported problem actually fixed, repaired, or cleaned, rather than hidden, photographed from an angle that obscures it, or only partially done?
(3) Does Image 2 look like a genuine, live camera photo of the real site, not a stock image, recycled photo, screenshot, or photo taken of a digital computer/phone screen?

Return a JSON object with EXACTLY:
- "same_location": boolean
- "issue_resolved": boolean
- "confidence": integer from 0 to 100
- "explanation": 2-3 sentences explaining your visual evidence and reasoning
- "red_flags": array of string identifiers (e.g. ["photo_of_screen", "unrelated_location", "issue_still_visible", "poor_lighting", "stock_photo"] or empty array [] if clean)

Return ONLY valid JSON.
`;

    const parsed = await callJson([
      {
        role: 'user',
        parts: [
          { text: promptText },
          { text: 'Image 1 (Original Report):' },
          { inlineData: { mimeType: 'image/jpeg', data: beforeBase64 } },
          { text: 'Image 2 (Claimed Fix):' },
          { inlineData: { mimeType: 'image/jpeg', data: afterBase64 } },
        ],
      },
    ]);

    return {
      same_location: Boolean(parsed.same_location),
      issue_resolved: Boolean(parsed.issue_resolved),
      confidence: Math.max(0, Math.min(100, parseInt(parsed.confidence, 10) || 0)),
      explanation: parsed.explanation || 'Verification completed by Gemini vision.',
      red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags : [],
    };
  } catch (err) {
    console.error('[CivicEye] Gemini verification technical error:', err.message);
    return {
      ...VERIFY_FALLBACK,
      explanation: 'AI verification service is temporarily unavailable. Sent to admin queue.',
    };
  }
}
