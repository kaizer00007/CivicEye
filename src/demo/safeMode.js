/**
 * Safe Mode & Demo Cache Engine (src/demo/safeMode.js).
 * Protects presentations against Wi-Fi dropouts and Gemini API rate-limits.
 * 
 * - When Safe Mode is ON: returns cached JSON responses instantly with a [Cached] badge.
 * - When Safe Mode is OFF: calls real Gemini, with an automatic 8-second timeout fallback
 *   to cached response so the live demo NEVER freezes or stalls.
 * - Supports recording real Gemini responses directly into Firestore demo_cache/{scenarioId}.
 */
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { triageCivicIssue, verifyResolutionProof } from '../lib/gemini';
import { loadDemoImage } from './imageLoader';
import defaultCache from './cachedResponses.json';

// In-memory cache holding Firestore overrides + default JSON
const dynamicCache = { ...defaultCache };

/**
 * Timeout helper for Gemini calls during demo presentations (default 8s).
 */
function withTimeout(promise, timeoutMs = 8000) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`Gemini API timed out after ${timeoutMs / 1000}s`)), timeoutMs)
    ),
  ]);
}

/**
 * Loads recorded scenario caches from Firestore demo_cache collection into memory.
 */
export async function loadDemoCacheFromFirestore() {
  const keys = Object.keys(defaultCache);
  for (const key of keys) {
    try {
      const snap = await getDoc(doc(db, 'demo_cache', key));
      if (snap.exists()) {
        const data = snap.data();
        if (data.payload) {
          dynamicCache[key] = data.payload;
        }
      }
    } catch (err) {
      // Offline or permission fallback, ignore
    }
  }
  return dynamicCache;
}

/**
 * Records a real Gemini response to Firestore demo_cache/{key} for future Safe Mode runs.
 */
export async function recordDemoCacheToFirestore(cacheKey, payload) {
  dynamicCache[cacheKey] = payload;
  try {
    await setDoc(doc(db, 'demo_cache', cacheKey), {
      payload,
      recordedAt: serverTimestamp(),
    });
  } catch (err) {
    console.warn(`[SafeMode] Failed to save demo_cache/${cacheKey}:`, err.message);
  }
}

/**
 * Calls Gemini triage with Safe Mode awareness and 8-second timeout protection.
 * 
 * @param {string} imageData Base64 JPEG data URL
 * @param {string} note Optional citizen text/voice note
 * @param {boolean} isSafeMode 
 * @param {string} cacheKey Key in cachedResponses.json
 * @returns {Promise<any & { _isCached: boolean, _cacheReason?: string }>}
 */
export async function callGeminiTriageWithSafeMode(
  imageData,
  note = '',
  isSafeMode = false,
  cacheKey = 'scenario_1_triage'
) {
  if (isSafeMode) {
    const cached = dynamicCache[cacheKey] || defaultCache[cacheKey];
    return {
      ...cached,
      _isCached: true,
      _cacheReason: 'Safe Mode enabled by presenter',
    };
  }

  // Attempt real Gemini call with 8-second timeout
  try {
    const realResult = await withTimeout(triageCivicIssue(imageData, note), 8000);
    // If Gemini returned fallback because of missing key or API failure, use cached demo data instead
    if (!realResult.aiAnalyzed) {
      throw new Error('Gemini returned unanalyzed fallback');
    }
    return {
      ...realResult,
      _isCached: false,
    };
  } catch (err) {
    console.warn(`[SafeMode] Live Gemini triage failed (${err.message}). Using cached scenario payload.`);
    const fallback = dynamicCache[cacheKey] || defaultCache[cacheKey];
    return {
      ...fallback,
      _isCached: true,
      _cacheReason: `Fallback: ${err.message}`,
    };
  }
}

/**
 * Calls Gemini resolution verification with Safe Mode and 8-second timeout protection.
 * 
 * @param {string} beforeData 
 * @param {string} afterData 
 * @param {string} issueType 
 * @param {boolean} isSafeMode 
 * @param {string} cacheKey 
 * @returns {Promise<any & { _isCached: boolean, _cacheReason?: string }>}
 */
export async function callGeminiVerifyWithSafeMode(
  beforeData,
  afterData,
  issueType,
  isSafeMode = false,
  cacheKey = 'scenario_1_verify'
) {
  if (isSafeMode) {
    const cached = dynamicCache[cacheKey] || defaultCache[cacheKey];
    return {
      ...cached,
      _isCached: true,
      _cacheReason: 'Safe Mode enabled by presenter',
    };
  }

  try {
    const realResult = await withTimeout(
      verifyResolutionProof(beforeData, afterData, issueType),
      8000
    );

    // If verification gave ai_error red flag (unreachable SDK), fall back
    if (realResult.red_flags?.includes('ai_error')) {
      throw new Error('Gemini verification returned ai_error');
    }

    return {
      ...realResult,
      _isCached: false,
    };
  } catch (err) {
    console.warn(`[SafeMode] Live Gemini verify failed (${err.message}). Using cached scenario payload.`);
    const fallback = dynamicCache[cacheKey] || defaultCache[cacheKey];
    return {
      ...fallback,
      _isCached: true,
      _cacheReason: `Fallback: ${err.message}`,
    };
  }
}

/**
 * Executes live Gemini calls for all primary scenarios and persists responses
 * into Firestore demo_cache/{scenarioKey} for rock-solid offline Safe Mode.
 * 
 * @param {(msg: string) => void} [onProgress]
 */
export async function recordAllDemoResponses(onProgress = () => {}) {
  onProgress('Loading demo images for recording session...');
  const potholeBefore = await loadDemoImage('pothole_before.jpg');
  const potholeAfter = await loadDemoImage('pothole_after.jpg');
  const fakeFix = await loadDemoImage('fake_fix_other_place.jpg');
  const garbageBefore = await loadDemoImage('garbage_before.jpg');
  const garbageAfter = await loadDemoImage('garbage_after_partial.jpg');
  const waterleak = await loadDemoImage('waterleak_before.jpg');

  // 1. Scenario 1 Triage
  onProgress('1/5 Calling Gemini Triage: Pothole report...');
  try {
    const r1 = await triageCivicIssue(potholeBefore.dataUrl, 'Large pothole in fast lane.');
    await recordDemoCacheToFirestore('scenario_1_triage', r1);
    onProgress('✓ Saved scenario_1_triage');
  } catch (err) {
    onProgress(`✕ Failed scenario_1_triage: ${err.message}`);
  }

  // 2. Scenario 1 Verify
  onProgress('2/5 Calling Gemini Verify: Pothole complete repair...');
  try {
    const r2 = await verifyResolutionProof(potholeBefore.dataUrl, potholeAfter.dataUrl, 'pothole');
    await recordDemoCacheToFirestore('scenario_1_verify', r2);
    onProgress('✓ Saved scenario_1_verify');
  } catch (err) {
    onProgress(`✕ Failed scenario_1_verify: ${err.message}`);
  }

  // 3. Scenario 2 Verify (Fake fix)
  onProgress('3/5 Calling Gemini Verify: Fake fix anti-cheat...');
  try {
    const r3 = await verifyResolutionProof(potholeBefore.dataUrl, fakeFix.dataUrl, 'pothole');
    await recordDemoCacheToFirestore('scenario_2_verify', r3);
    onProgress('✓ Saved scenario_2_verify');
  } catch (err) {
    onProgress(`✕ Failed scenario_2_verify: ${err.message}`);
  }

  // 4. Scenario 3 Verify (Partial fix)
  onProgress('4/5 Calling Gemini Verify: Borderline garbage clean...');
  try {
    const r4 = await verifyResolutionProof(garbageBefore.dataUrl, garbageAfter.dataUrl, 'garbage_dump');
    await recordDemoCacheToFirestore('scenario_3_verify', r4);
    onProgress('✓ Saved scenario_3_verify');
  } catch (err) {
    onProgress(`✕ Failed scenario_3_verify: ${err.message}`);
  }

  // 5. Scenario 4 Triage (Water leak)
  onProgress('5/5 Calling Gemini Triage: Critical water main burst...');
  try {
    const r5 = await triageCivicIssue(waterleak.dataUrl, 'Major water distribution pipe burst.');
    await recordDemoCacheToFirestore('scenario_4_triage', r5);
    onProgress('✓ Saved scenario_4_triage');
  } catch (err) {
    onProgress(`✕ Failed scenario_4_triage: ${err.message}`);
  }

  onProgress('🎉 All demo responses recorded and stored in Firestore demo_cache!');
}
