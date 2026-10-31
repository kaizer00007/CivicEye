/**
 * ReportPage — Citizen Issue Submission Flow.
 * Features:
 * - Photo capture/upload with client-side compression (max 800px, quality 0.7, <900KB)
 * - Animated AI analysis "wow moment" scanning preview
 * - Editable classification, severity & department
 * - GPS detection + Leaflet manual pin drop + Nominatim reverse geocoding
 * - Voice notes via Web Speech API (en-IN / hi-IN)
 * - 50m duplicate detection with upvote fallback
 * - Auto-assignment and Firestore save
 */
import { useState, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';
import { compressImage } from '../lib/imageUtils';
import { getZoneForLocation } from '../lib/geoUtils';
import { triageCivicIssue } from '../lib/gemini';
import { autoAssignReport } from '../lib/assign';
import { findDuplicateReports, upvoteReport } from '../lib/duplicateCheck';
import {
  DEFAULT_CENTER,
  ISSUE_TYPES,
  DEPARTMENTS,
  DEPARTMENT_LABELS,
  URGENCY_LABELS,
  URGENCY_COLORS,
} from '../config';
import LocationPickerMap from '../components/LocationPickerMap';
import VoiceNoteRecorder from '../components/VoiceNoteRecorder';
import LoadingSpinner from '../components/LoadingSpinner';

export default function ReportPage() {
  const { user } = useAuth();
  const { show } = useToast();
  const navigate = useNavigate();
  const fileInputRef = useRef(null);

  // Form State
  const [imageFile, setImageFile] = useState(null);
  const [imageData, setImageData] = useState('');
  const [imageHash, setImageHash] = useState('');
  const [imageSizeKb, setImageSizeKb] = useState(0);

  const [location, setLocation] = useState({
    lat: DEFAULT_CENTER[0],
    lng: DEFAULT_CENTER[1],
    address: '',
  });

  const [voiceNote, setVoiceNote] = useState('');
  const [citizenNote, setCitizenNote] = useState('');

  // AI Analysis State
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState('');

  // Form field overrides (citizen can edit after AI analysis)
  const [issueType, setIssueType] = useState('pothole');
  const [department, setDepartment] = useState('public_works');
  const [severity, setSeverity] = useState(5);
  const [urgency, setUrgency] = useState('medium');
  const [description, setDescription] = useState('');
  const [safetyRisk, setSafetyRisk] = useState(false);
  const [affectsTraffic, setAffectsTraffic] = useState(false);
  const [estimatedFixDays, setEstimatedFixDays] = useState(7);

  // Duplicate Check Modal State
  const [submitting, setSubmitting] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState([]);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  // 1. Handle Photo Selection and Compression
  const handlePhotoSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      show('Compressing image for submission...', 'info', 2000);
      const compressed = await compressImage(file);
      setImageFile(file);
      setImageData(compressed.dataUrl);
      setImageHash(compressed.hash);
      setImageSizeKb(Math.round(compressed.sizeBytes / 1024));
      setAiResult(null); // reset analysis on new photo
    } catch (err) {
      show(err.message, 'error');
    }
  };

  // 2. Trigger Gemini AI Analysis
  const handleAnalyzeWithAi = async () => {
    if (!imageData) {
      show('Please upload or snap a photo first', 'warning');
      return;
    }

    setAnalyzing(true);
    setAiError('');

    try {
      const combinedNote = [citizenNote, voiceNote].filter(Boolean).join('. ');
      const result = await triageCivicIssue(imageData, combinedNote);

      setAiResult(result);
      setIssueType(result.issue_type);
      setDepartment(result.department);
      setSeverity(result.severity);
      setUrgency(result.urgency);
      setDescription(result.description);
      setSafetyRisk(result.safety_risk);
      setAffectsTraffic(result.affects_traffic);
      setEstimatedFixDays(result.estimated_fix_days);

      if (result.aiAnalyzed) {
        show('AI classification complete! Review and adjust if needed.', 'success');
      } else {
        setAiError('AI analysis is temporarily unavailable, you can enter the details manually');
        show('AI analysis is temporarily unavailable, you can enter the details manually', 'warning');
      }
    } catch (err) {
      console.error('[CivicEye] AI analysis technical error:', err);
      setAiError('AI analysis is temporarily unavailable, you can enter the details manually');
      show('AI analysis is temporarily unavailable, you can enter the details manually', 'warning');
    } finally {
      setAnalyzing(false);
    }
  };

  // 3. Initiate Submit (checks duplicates first)
  const handleFormSubmit = async (e) => {
    e.preventDefault();

    if (!imageData) {
      show('Please provide a photo of the civic issue.', 'warning');
      return;
    }
    if (!location.address) {
      show('Please select a valid location on the map.', 'warning');
      return;
    }

    setSubmitting(true);

    try {
      // Step A: Duplicate check within 50 meters
      const duplicates = await findDuplicateReports(issueType, location.lat, location.lng);

      if (duplicates.length > 0) {
        setDuplicateMatches(duplicates);
        setShowDuplicateModal(true);
        setSubmitting(false);
        return;
      }

      // Step B: Direct save if no duplicates
      await saveReportAndFinish();
    } catch (err) {
      console.error('Submit error:', err);
      show(`Submission failed: ${err.message}`, 'error');
      setSubmitting(false);
    }
  };

  // 4. Save to Firestore with Auto-Assignment
  const saveReportAndFinish = async (duplicateOfId = null) => {
    setSubmitting(true);
    try {
      const zone = getZoneForLocation(location.lat, location.lng);

      // Run auto-assignment
      const assignResult = await autoAssignReport(department, zone, urgency);

      const finalDescription = [
        description || 'Civic infrastructure report.',
        citizenNote ? `Citizen note: ${citizenNote}` : '',
        voiceNote ? `Voice note: ${voiceNote}` : '',
      ]
        .filter(Boolean)
        .join('\n\n');

      const newReport = {
        citizenId: user?.uid || 'anonymous',
        citizenName: user?.name || user?.email || 'Citizen',
        imageData,
        imageHash,
        location: {
          lat: location.lat,
          lng: location.lng,
          address: location.address,
        },
        aiClassification: issueType,
        aiSeverity: Number(severity),
        aiUrgency: urgency,
        aiDescription: finalDescription,
        aiEstimatedFixDays: Number(estimatedFixDays),
        safetyRisk: Boolean(safetyRisk),
        affectsTraffic: Boolean(affectsTraffic),
        voiceNote: voiceNote || '',
        status: assignResult.status,
        department,
        zone,
        assignedOfficerId: assignResult.officerId,
        assignedOfficerName: assignResult.officerName,
        deadline: assignResult.deadline,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
        resolvedAt: null,
        upvotes: 0,
        upvotedBy: [],
        escalationLevel: 0,
        duplicateOf: duplicateOfId,
        resolution: {
          proofData: null,
          proofHash: null,
          proofLocation: null,
          submittedAt: null,
          aiResult: null,
          verificationState: 'none',
          adminNote: null,
        },
        citizenFeedback: {
          resolved: null,
          rating: null,
          at: null,
        },
        flags: {
          penalizedMissedDeadline: false,
          penalizedMissedCritical: false,
          penalizedNoUpdate: false,
          resolutionRatingApplied: false,
        },
      };

      const docRef = await addDoc(collection(db, 'reports'), newReport);

      show(
        assignResult.assigned
          ? `Report submitted & assigned to ${assignResult.officerName}!`
          : 'Report submitted! Awaiting officer dispatch.',
        'success',
        5000
      );

      navigate('/my-reports');
    } catch (err) {
      console.error('Save error:', err);
      show(`Save failed: ${err.message}`, 'error');
    } finally {
      setSubmitting(false);
      setShowDuplicateModal(false);
    }
  };

  // Upvote duplicate instead of submitting new
  const handleUpvoteDuplicate = async (dupId) => {
    try {
      await upvoteReport(dupId, user?.uid);
      show('Thank you! You upvoted this existing report to increase priority.', 'success');
      setShowDuplicateModal(false);
      navigate('/my-reports');
    } catch (err) {
      show('Failed to upvote: ' + err.message, 'error');
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Title */}
      <div className="mb-6">
        <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight flex items-center gap-3">
          <span>📸</span> Report a Civic Issue
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Upload photo &bull; AI auto-detects issue, urgency and assigns the municipal officer.
        </p>
      </div>

      <form onSubmit={handleFormSubmit} className="space-y-6">
        {/* Section 1: Photo & AI Scanner */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="text-blue-600">Step 1:</span> Photo Evidence
            </h2>
            {imageSizeKb > 0 && (
              <span className="text-xs font-mono bg-green-50 text-green-700 px-2 py-0.5 rounded-full border border-green-200">
                Compressed: {imageSizeKb} KB (&lt;900 KB)
              </span>
            )}
          </div>

          {/* Photo Dropzone / Preview */}
          <div className="relative">
            {imageData ? (
              <div className="relative rounded-xl overflow-hidden border border-gray-300 bg-black aspect-video max-h-80 flex items-center justify-center group">
                <img
                  src={imageData}
                  alt="Issue preview"
                  className="w-full h-full object-contain"
                />

                {/* Animated Scanner Effect during AI analysis */}
                {analyzing && (
                  <div className="absolute inset-0 bg-blue-900/30 backdrop-blur-[2px] flex flex-col items-center justify-center text-white">
                    <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_15px_#22d3ee] animate-[scan_2s_ease-in-out_infinite]" />
                    <div className="relative bg-black/60 px-5 py-3 rounded-xl border border-cyan-400/50 flex items-center gap-3 shadow-lg">
                      <LoadingSpinner size="sm" />
                      <div>
                        <p className="font-semibold text-cyan-300 text-sm">Gemini AI Inspecting...</p>
                        <p className="text-[11px] text-gray-300">Classifying defect &amp; evaluating safety risk</p>
                      </div>
                    </div>
                  </div>
                )}

                {!analyzing && (
                  <div className="absolute top-3 right-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3 py-1.5 bg-white/90 hover:bg-white text-gray-800 text-xs font-semibold rounded-lg shadow backdrop-blur transition"
                    >
                      Change Photo
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-gray-300 hover:border-blue-500 rounded-2xl p-8 text-center cursor-pointer transition bg-gray-50 hover:bg-blue-50/30"
              >
                <div className="w-16 h-16 mx-auto mb-3 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-2xl shadow-inner">
                  📷
                </div>
                <p className="text-base font-semibold text-gray-800">
                  Take a photo or upload an image
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  JPG, PNG up to 10 MB (automatically compressed under 800px &amp; 900 KB)
                </p>
                <button
                  type="button"
                  className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition shadow-sm"
                >
                  Browse Device / Camera
                </button>
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handlePhotoSelect}
              className="hidden"
            />
          </div>

          {/* AI Analysis Trigger Button (The Demo's Wow Moment) */}
          {imageData && (
            <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleAnalyzeWithAi}
                disabled={analyzing}
                className="flex items-center gap-2.5 px-6 py-2.5 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg disabled:opacity-50 transition transform active:scale-95"
              >
                {analyzing ? (
                  <>
                    <LoadingSpinner size="sm" />
                    <span>Analyzing with Gemini...</span>
                  </>
                ) : (
                  <>
                    <span>✨</span>
                    <span>Analyze with AI</span>
                  </>
                )}
              </button>

              {aiResult && (
                <span className="text-xs text-green-700 font-semibold flex items-center gap-1.5 bg-green-50 px-3 py-1.5 rounded-lg border border-green-200">
                  <span>✓</span> AI Classification Ready
                </span>
              )}
            </div>
          )}

          {aiError && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 flex items-center justify-between gap-2 shadow-sm">
              <div className="flex items-center gap-2">
                <span>⚠️</span>
                <span>{aiError}</span>
              </div>
              <button
                type="button"
                onClick={handleAnalyzeWithAi}
                className="px-3 py-1 bg-amber-200/80 hover:bg-amber-200 rounded-lg font-bold text-amber-900 transition text-xs shrink-0"
              >
                Retry
              </button>
            </div>
          )}
        </div>

        {/* Section 2: AI Classification & Details (Editable) */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-5">
          <div className="flex items-center justify-between border-b pb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="text-blue-600">Step 2:</span> Classification &amp; Details
            </h2>
            <span className="text-xs text-gray-500 italic">Citizen may edit before confirming</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Issue Type */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                Issue Category <span className="text-red-500">*</span>
              </label>
              <select
                value={issueType}
                onChange={(e) => setIssueType(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition capitalize"
              >
                {ISSUE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type.replace(/_/g, ' ')}
                  </option>
                ))}
              </select>
            </div>

            {/* Department */}
            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
                Department
              </label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
              >
                {DEPARTMENTS.map((dept) => (
                  <option key={dept} value={dept}>
                    {DEPARTMENT_LABELS[dept] || dept}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Severity & Urgency */}
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600">
                  Severity: <span className="text-base font-bold text-gray-900">{severity}/10</span>
                </label>
                <p className="text-[11px] text-gray-500">10 = Life threatening, 1 = Minor issue</p>
              </div>

              {/* Urgency Badge */}
              <div className="text-right">
                <span className="text-[11px] text-gray-500 block uppercase font-medium">Urgency</span>
                <span
                  className="inline-block px-3 py-1 rounded-full text-xs font-extrabold uppercase tracking-wide text-white shadow-sm"
                  style={{ backgroundColor: URGENCY_COLORS[urgency] || '#3b82f6' }}
                >
                  {URGENCY_LABELS[urgency] || urgency}
                  {severity >= 8 && ' (Mandatory Critical)'}
                </span>
              </div>
            </div>

            <input
              type="range"
              min="1"
              max="10"
              value={severity}
              onChange={(e) => {
                const val = Number(e.target.value);
                setSeverity(val);
                if (val >= 8) {
                  setUrgency('critical');
                }
              }}
              className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
            />

            {/* Toggles */}
            <div className="flex flex-wrap gap-4 pt-1">
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={safetyRisk}
                  onChange={(e) => setSafetyRisk(e.target.checked)}
                  className="rounded border-gray-300 text-red-600 focus:ring-red-500 w-4 h-4"
                />
                ⚠️ Poses Safety Risk to Public
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700">
                <input
                  type="checkbox"
                  checked={affectsTraffic}
                  onChange={(e) => setAffectsTraffic(e.target.checked)}
                  className="rounded border-gray-300 text-amber-600 focus:ring-amber-500 w-4 h-4"
                />
                🚗 Impedes or Blocks Traffic
              </label>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
              Description / AI Observation
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Detailed description of the issue..."
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
          </div>

          {/* Citizen Note */}
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-600 mb-1">
              Additional Citizen Note
            </label>
            <input
              type="text"
              value={citizenNote}
              onChange={(e) => setCitizenNote(e.target.value)}
              placeholder="e.g. Near the bus stop, happening since yesterday morning"
              className="w-full px-3.5 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition"
            />
          </div>

          {/* Voice Note Component */}
          <VoiceNoteRecorder
            onTranscript={(text) => setVoiceNote(text)}
            initialValue={voiceNote}
          />
        </div>

        {/* Section 3: Location on Map */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-4">
          <div className="border-b pb-3">
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <span className="text-blue-600">Step 3:</span> Location &amp; Pin Drop
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Detected by GPS or drop a pin directly on the Leaflet map.
            </p>
          </div>

          <LocationPickerMap
            location={location}
            onLocationChange={(loc) => setLocation(loc)}
            className="h-72"
          />
        </div>

        {/* Final Submission Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 pt-2">
          <Link
            to="/"
            className="px-5 py-2.5 text-sm font-semibold text-gray-600 hover:text-gray-900 transition"
          >
            Cancel
          </Link>

          <button
            type="submit"
            disabled={submitting || analyzing || !imageData}
            className="flex items-center gap-2 px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-base shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed transition transform active:scale-95"
          >
            {submitting ? (
              <>
                <LoadingSpinner size="sm" />
                <span>Checking &amp; Assigning...</span>
              </>
            ) : (
              <>
                <span>🚀</span>
                <span>Submit &amp; Dispatch Officer</span>
              </>
            )}
          </button>
        </div>
      </form>

      {/* Duplicate Detection Dialog Modal */}
      {showDuplicateModal && (
        <div className="fixed inset-0 z-[9999] bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-amber-200 space-y-4 animate-scale-in">
            <div className="flex items-center gap-3 text-amber-600">
              <span className="text-3xl">⚠️</span>
              <div>
                <h3 className="text-lg font-bold text-gray-900">Similar Report Already Exists</h3>
                <p className="text-xs text-gray-500">
                  A report of type "{issueType.replace(/_/g, ' ')}" was found within 50 meters of your pin.
                </p>
              </div>
            </div>

            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 space-y-3 max-h-60 overflow-y-auto">
              {duplicateMatches.map((dup) => (
                <div
                  key={dup.id}
                  className="bg-white p-3 rounded-lg border border-amber-100 shadow-sm flex items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <p className="font-semibold text-gray-900 capitalize">
                      {dup.aiClassification?.replace(/_/g, ' ')}
                    </p>
                    <p className="text-gray-500 text-[11px] truncate max-w-[200px]">
                      {dup.location?.address || 'Near selected location'}
                    </p>
                    <p className="text-amber-700 font-medium text-[11px]">
                      📍 ~{dup.distanceMeters}m away &bull; {dup.upvotes || 0} upvotes &bull; Status: {dup.status}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleUpvoteDuplicate(dup.id)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-xs shadow transition whitespace-nowrap"
                  >
                    👍 Upvote (+1)
                  </button>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-600">
              Upvoting brings existing issues to higher priority faster without cluttering duplicate tickets for municipal field crews.
            </p>

            <div className="flex items-center justify-between pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowDuplicateModal(false)}
                className="px-4 py-2 text-xs font-semibold text-gray-500 hover:text-gray-800"
              >
                Back to Edit
              </button>
              <button
                type="button"
                onClick={() => saveReportAndFinish(duplicateMatches[0]?.id || null)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-semibold transition"
              >
                File New Report Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
