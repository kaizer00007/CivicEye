/**
 * Gemini AI integration using the official @google/genai SDK.
 * Handles issue triage and proof resolution verification.
 * Always requests application/json, strips markdown fences, and uses safe fallbacks.
 */
import { GoogleGenAI } from '@google/genai';
import { CRITICAL_SEVERITY_THRESHOLD, ISSUE_TYPES, DEPARTMENTS } from '../config';

const apiKey = import.meta.env.VITE_GEMINI_KEY || '';
const modelName = import.meta.env.VITE_GEMINI_MODEL || 'gemini-2.0-flash';

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
  // Remove markdown code fences if present
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  return cleaned.trim();
}

/**
 * Fallback response when AI triage fails or is unreachable.
 */
export const TRIAGE_FALLBACK = {
  issue_type: 'other',
  severity: 5,
  description: 'Civic issue reported by citizen. AI automated triage unavailable.',
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
    const ai = getAiClient();
    if (!apiKey) {
      console.warn('[CivicEye] Using triage fallback because VITE_GEMINI_KEY is not configured');
      return { ...TRIAGE_FALLBACK, aiAnalyzed: false };
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

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
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
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const rawText = response.text || '';
    const cleaned = cleanJsonText(rawText);
    const parsed = JSON.parse(cleaned);

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
    console.error('[CivicEye] Gemini triage call error:', err.message);
    return {
      ...TRIAGE_FALLBACK,
      description: `Analysis notice: ${err.message || 'Gemini triage unavailable'}. You can specify details manually.`,
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
  explanation: 'AI verification service was unreachable or an error occurred. Sent to admin queue.',
  red_flags: ['ai_error'],
};

/**
 * Verifies resolution proof against original report photo.
 * Used in Phase 5 when officer submits completion evidence.
 * 
 * @param {string} beforeDataUrl 
 * @param {string} afterDataUrl 
 * @param {string} issueType 
 * @returns {Promise<typeof VERIFY_FALLBACK>}
 */
export async function verifyResolutionProof(beforeDataUrl, afterDataUrl, issueType) {
  try {
    const ai = getAiClient();
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

    const response = await ai.models.generateContent({
      model: modelName,
      contents: [
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
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const raw = response.text || '';
    const cleaned = cleanJsonText(raw);
    const parsed = JSON.parse(cleaned);

    return {
      same_location: Boolean(parsed.same_location),
      issue_resolved: Boolean(parsed.issue_resolved),
      confidence: Math.max(0, Math.min(100, parseInt(parsed.confidence, 10) || 0)),
      explanation: parsed.explanation || 'Verification completed by Gemini vision.',
      red_flags: Array.isArray(parsed.red_flags) ? parsed.red_flags : [],
    };
  } catch (err) {
    console.error('[CivicEye] Gemini verification error:', err.message);
    return {
      ...VERIFY_FALLBACK,
      explanation: `Verification check error: ${err.message}`,
    };
  }
}
