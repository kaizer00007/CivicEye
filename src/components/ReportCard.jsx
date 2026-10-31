/**
 * ReportCard — compact card for the area explorer list.
 * Shows: issue type, status badge, severity, distance, upvotes, "Your report" tag.
 */
import { StatusBadge, UrgencyBadge, SeverityBadge, EscalationBadge } from './StatusBadge';
import { formatDistance } from '../lib/geoUtils';
import { DEPARTMENT_LABELS } from '../config';

export default function ReportCard({ report, distance, isOwn, onClick, isSelected }) {
  const issueLabel = (report.aiClassification || 'other').replace(/_/g, ' ');
  const dept = DEPARTMENT_LABELS[report.department] || report.department;

  return (
    <button
      onClick={onClick}
      className={`w-full text-left p-3 rounded-xl border transition-all hover:shadow-md ${
        isSelected
          ? 'border-blue-500 bg-blue-50 shadow-md ring-2 ring-blue-200'
          : 'border-gray-200 bg-white hover:border-gray-300'
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Thumbnail */}
        {report.imageData && (
          <img
            src={report.imageData}
            alt={issueLabel}
            className="w-14 h-14 rounded-lg object-cover flex-shrink-0 border border-gray-200"
          />
        )}

        <div className="flex-1 min-w-0 space-y-1">
          {/* Top row: type + badges */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-sm text-gray-900 capitalize truncate">
              {issueLabel}
            </span>
            {isOwn && (
              <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 text-[10px] font-bold rounded uppercase">
                Your report
              </span>
            )}
          </div>

          {/* Status + urgency row */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <StatusBadge status={report.status} />
            <UrgencyBadge urgency={report.aiUrgency} />
            <SeverityBadge severity={report.aiSeverity} />
            <EscalationBadge level={report.escalationLevel} />
          </div>

          {/* Meta row */}
          <div className="flex items-center gap-3 text-[11px] text-gray-500">
            <span className="truncate max-w-[140px]">🏢 {dept}</span>
            {typeof distance === 'number' && (
              <span>📍 {formatDistance(distance)}</span>
            )}
            {(report.upvotes || 0) > 0 && (
              <span>👍 {report.upvotes}</span>
            )}
          </div>
        </div>
      </div>
    </button>
  );
}
