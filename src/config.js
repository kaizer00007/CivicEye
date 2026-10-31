/**
 * CivicEye configuration constants.
 * All tunable values live here so they can be adjusted without touching logic.
 */

// ── Map defaults ──
// Set DEFAULT_CENTER to your city's [lat, lng].
export const DEFAULT_CENTER = [20.5937, 78.9629]; // India center; change to your city
export const DEFAULT_ZOOM = 13;

// ── Radius options for area explorer (meters) ──
export const RADIUS_OPTIONS = [250, 500, 1000, 2000];

// ── Deadline by urgency (milliseconds) ──
export const DEADLINES = {
  critical: 24 * 60 * 60 * 1000,   // 24 hours
  high:     72 * 60 * 60 * 1000,   // 72 hours
  medium:   7 * 24 * 60 * 60 * 1000, // 7 days
  low:      14 * 24 * 60 * 60 * 1000, // 14 days
};

// ── Officer limits ──
export const MAX_ACTIVE_ISSUES = 10;

// ── Rating deltas ──
export const RATING_DELTAS = {
  resolved_early:         +0.3,
  resolved_critical_fast: +0.5,
  positive_feedback:      +0.1,
  streak_bonus:           +0.2,
  missed_deadline:        -0.5,
  missed_critical:        -1.0,
  negative_feedback:      -0.3,
  no_update_48h:          -0.2,
};

// ── Rating thresholds ──
export const RATING_MIN = 0;
export const RATING_MAX = 5;
export const RATING_FLAGGED = 3.0;              // Admin warning
export const RATING_RESTRICTED_CRITICAL = 2.5;  // Can't get critical issues
export const RATING_REVIEW = 2.0;               // Admin review, can reassign

// ── Streaks ──
export const STREAK_THRESHOLD = 3; // Every N consecutive on-time resolutions

// ── New officer starting rating ──
export const DEFAULT_OFFICER_RATING = 3.5;

// ── Duplicate detection ──
export const DUPLICATE_RADIUS_METERS = 50;

// ── Anti-cheat ──
export const MAX_PROOF_DISTANCE_METERS = 100;

// ── Citizen confirmation timeout (ms) ──
export const CITIZEN_CONFIRM_TIMEOUT = 48 * 60 * 60 * 1000; // 48 hours

// ── No-update penalty threshold (ms) ──
export const NO_UPDATE_THRESHOLD = 48 * 60 * 60 * 1000; // 48 hours

// ── Escalation gaps (ms from deadline) ──
export const ESCALATION_GAP = 24 * 60 * 60 * 1000; // 24 hours between levels

// ── Image compression ──
export const IMAGE_MAX_WIDTH = 800;
export const IMAGE_JPEG_QUALITY = 0.7;
export const MAX_DOC_SIZE_BYTES = 900 * 1024; // 900 KB

// ── Severity → urgency override ──
export const CRITICAL_SEVERITY_THRESHOLD = 8; // severity >= this ⇒ urgency "critical"

// ── Verification confidence thresholds ──
export const VERIFICATION_AUTO_APPROVE = 75;
export const VERIFICATION_BORDERLINE = 50;

// ── Departments ──
export const DEPARTMENTS = [
  'public_works',
  'water_board',
  'electrical',
  'sanitation',
  'environment',
  'traffic',
  'other',
];

// ── Issue types ──
export const ISSUE_TYPES = [
  'pothole',
  'road_damage',
  'water_leak',
  'sewage_overflow',
  'garbage_dump',
  'electrical_hazard',
  'broken_streetlight',
  'bridge_damage',
  'pollution',
  'illegal_construction',
  'fallen_tree',
  'flooding',
  'other',
];

// ── Zones ──
export const ZONES = ['zone_1', 'zone_2', 'zone_3'];

// ── Status colors ──
export const STATUS_COLORS = {
  submitted:  { bg: 'bg-gray-100',   text: 'text-gray-700',   dot: '#6b7280' },
  assigned:   { bg: 'bg-blue-100',   text: 'text-blue-700',   dot: '#2563eb' },
  in_progress:{ bg: 'bg-yellow-100', text: 'text-yellow-700', dot: '#ca8a04' },
  resolved:   { bg: 'bg-green-100',  text: 'text-green-700',  dot: '#16a34a' },
  escalated:  { bg: 'bg-red-100',    text: 'text-red-700',    dot: '#dc2626' },
};

// ── Urgency colors for map markers ──
export const URGENCY_COLORS = {
  critical: '#dc2626',
  high:     '#ea580c',
  medium:   '#ca8a04',
  low:      '#3b82f6',
};

// ── Nice labels ──
export const DEPARTMENT_LABELS = {
  public_works: 'Public Works',
  water_board:  'Water Board',
  electrical:   'Electrical',
  sanitation:   'Sanitation',
  environment:  'Environment',
  traffic:      'Traffic',
  other:        'Other',
};

export const URGENCY_LABELS = {
  critical: 'Critical',
  high:     'High',
  medium:   'Medium',
  low:      'Low',
};

export const STATUS_LABELS = {
  submitted:   'Submitted',
  assigned:    'Assigned',
  in_progress: 'In Progress',
  resolved:    'Resolved',
  escalated:   'Escalated',
};
