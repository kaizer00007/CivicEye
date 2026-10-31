/**
 * NarratorPanel Component (src/demo/NarratorPanel.jsx)
 * 
 * Step-by-step projection narrator for live hackathon presentations:
 * - Displays scenario progression: pending -> running -> done
 * - Live execution timestamps and durations
 * - Formatted metric badges for:
 *   - Gemini classification (type, severity, urgency, confidence)
 *   - Officer assignment & zone dispatch
 *   - Rating engine adjustments (+/- rating, streak, reason)
 *   - Anti-cheat detection flags & verification state
 * - Transparent [CACHED RESULT] badge for safe mode or fallback triggers
 * - Auto / Manual stepper controls & delay duration slider
 */
import LoadingSpinner from '../components/LoadingSpinner';

export default function NarratorPanel({
  scenario,
  stepStates = [],
  currentStepIndex = -1,
  isRunning = false,
  isAuto = true,
  setIsAuto,
  stepDelay = 2000,
  setStepDelay,
  onNextStep,
  onPrevStep,
  onRun,
  onReset,
  safeMode = false,
  presenterMode = false,
}) {
  if (!scenario) {
    return (
      <div className="h-full flex items-center justify-center p-8 text-center text-gray-400 bg-white rounded-3xl border border-gray-200">
        <div className="space-y-2">
          <span className="text-4xl block">🎬</span>
          <p className="text-sm font-semibold">Select a scenario to view the Narrator audit trail</p>
        </div>
      </div>
    );
  }

  const completedCount = stepStates.filter((s) => s?.status === 'done').length;
  const totalCount = scenario.steps.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);

  return (
    <div
      className={`flex flex-col h-full rounded-3xl border transition-all ${
        presenterMode
          ? 'bg-slate-950 text-white border-slate-800 shadow-2xl'
          : 'bg-white text-gray-900 border-gray-200 shadow-sm'
      }`}
    >
      {/* Panel Header */}
      <div
        className={`p-5 border-b ${
          presenterMode ? 'border-slate-800 bg-slate-900/50' : 'border-gray-100 bg-gray-50/50'
        } rounded-t-3xl space-y-3`}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xl">{scenario.icon}</span>
              <h3
                className={`font-black tracking-tight ${
                  presenterMode ? 'text-lg text-white' : 'text-base text-gray-900'
                }`}
              >
                {scenario.title}
              </h3>
            </div>
            <p
              className={`text-xs mt-1 ${
                presenterMode ? 'text-slate-300 font-medium' : 'text-gray-500'
              }`}
            >
              {scenario.subtitle}
            </p>
          </div>

          <div className="flex flex-col items-end gap-1 shrink-0">
            <span
              className={`text-xs font-mono font-bold px-2.5 py-1 rounded-full ${
                completedCount === totalCount
                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                  : 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              }`}
            >
              {completedCount} / {totalCount} Steps
            </span>

            {safeMode && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30">
                🛡️ Safe Mode
              </span>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full bg-gray-200 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Action Controls & Stepper */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {/* Auto / Manual Mode Toggle */}
          <div className="flex items-center gap-2 text-xs">
            <div className="inline-flex rounded-xl bg-gray-200 dark:bg-slate-800 p-0.5 font-bold">
              <button
                type="button"
                onClick={() => setIsAuto && setIsAuto(true)}
                className={`px-3 py-1 rounded-lg transition ${
                  isAuto
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Auto Play
              </button>
              <button
                type="button"
                onClick={() => setIsAuto && setIsAuto(false)}
                className={`px-3 py-1 rounded-lg transition ${
                  !isAuto
                    ? 'bg-blue-600 text-white shadow-sm'
                    : 'text-gray-500 hover:text-gray-900 dark:text-slate-400 dark:hover:text-white'
                }`}
              >
                Manual (→)
              </button>
            </div>

            {isAuto && (
              <select
                value={stepDelay}
                onChange={(e) => setStepDelay && setStepDelay(Number(e.target.value))}
                className={`text-[11px] font-semibold py-1 px-2 rounded-lg border ${
                  presenterMode
                    ? 'bg-slate-800 border-slate-700 text-white'
                    : 'bg-white border-gray-200 text-gray-700'
                }`}
              >
                <option value={1000}>1s pause</option>
                <option value={2000}>2s (Standard)</option>
                <option value={3500}>3.5s pause</option>
                <option value={5000}>5s pause</option>
              </select>
            )}
          </div>

          {/* Stepper buttons */}
          <div className="flex items-center gap-2">
            {!isAuto && (
              <>
                <button
                  type="button"
                  disabled={currentStepIndex <= 0 || isRunning}
                  onClick={onPrevStep}
                  title="Previous Step (Left Arrow)"
                  className="px-2.5 py-1 text-xs font-bold rounded-xl border border-gray-300 dark:border-slate-700 hover:bg-gray-100 dark:hover:bg-slate-800 disabled:opacity-30"
                >
                  ← Prev
                </button>
                <button
                  type="button"
                  disabled={currentStepIndex >= totalCount - 1 || isRunning}
                  onClick={onNextStep}
                  title="Next Step (Right Arrow)"
                  className="px-3 py-1 text-xs font-bold rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow disabled:opacity-30 flex items-center gap-1"
                >
                  <span>Next Step</span>
                  <span>→</span>
                </button>
              </>
            )}

            <button
              type="button"
              disabled={isRunning}
              onClick={onReset}
              title="Reset Scenario Data (R)"
              className="px-2.5 py-1 text-xs font-bold rounded-xl border border-rose-300 text-rose-600 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400 dark:hover:bg-rose-950/40 disabled:opacity-40"
            >
              Reset
            </button>

            <button
              type="button"
              disabled={isRunning}
              onClick={onRun}
              className="px-4 py-1 text-xs font-extrabold uppercase rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md transition disabled:opacity-50 flex items-center gap-1.5"
            >
              {isRunning ? (
                <>
                  <LoadingSpinner size="xs" />
                  <span>Running...</span>
                </>
              ) : (
                <>
                  <span>▶</span>
                  <span>Run</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Steps List */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {scenario.steps.map((st, idx) => {
          const state = stepStates[idx] || { status: 'pending' };
          const isDone = state.status === 'done';
          const isCurrent = state.status === 'running' || (currentStepIndex === idx && !isDone);
          const isError = state.status === 'error';

          return (
            <div
              key={st.id || idx}
              className={`p-4 rounded-2xl border transition-all ${
                isDone
                  ? presenterMode
                    ? 'bg-slate-900/60 border-emerald-500/30'
                    : 'bg-emerald-50/40 border-emerald-200'
                  : isCurrent
                  ? presenterMode
                    ? 'bg-indigo-950/50 border-indigo-500 shadow-md ring-1 ring-indigo-500'
                    : 'bg-blue-50 border-blue-300 shadow-sm ring-1 ring-blue-300'
                  : isError
                  ? presenterMode
                    ? 'bg-rose-950/50 border-rose-500'
                    : 'bg-rose-50 border-rose-300'
                  : presenterMode
                  ? 'bg-slate-900/20 border-slate-800/80 text-slate-500 opacity-60'
                  : 'bg-gray-50 border-gray-200 text-gray-400 opacity-70'
              }`}
            >
              {/* Step Title & Status */}
              <div className="flex items-start justify-between gap-3 mb-2">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                      isDone
                        ? 'bg-emerald-500 text-white'
                        : isCurrent
                        ? 'bg-blue-600 text-white animate-pulse'
                        : isError
                        ? 'bg-rose-500 text-white'
                        : presenterMode
                        ? 'bg-slate-800 text-slate-400'
                        : 'bg-gray-200 text-gray-600'
                    }`}
                  >
                    {isDone ? '✓' : isError ? '✕' : idx + 1}
                  </span>

                  <div>
                    <h4
                      className={`text-xs font-bold leading-tight ${
                        presenterMode ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {st.title}
                    </h4>
                    <p
                      className={`text-[11px] mt-0.5 ${
                        presenterMode ? 'text-slate-400' : 'text-gray-500'
                      }`}
                    >
                      {st.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {state.isCached && (
                    <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      Cached Result
                    </span>
                  )}

                  {state.timestamp && (
                    <span
                      className={`text-[10px] font-mono ${
                        presenterMode ? 'text-slate-400' : 'text-gray-400'
                      }`}
                    >
                      {new Date(state.timestamp).toLocaleTimeString()}
                    </span>
                  )}
                </div>
              </div>

              {/* Step Output / Results Display */}
              {isDone && state.result && (
                <div
                  className={`mt-3 pt-3 border-t text-xs space-y-2 ${
                    presenterMode ? 'border-slate-800' : 'border-gray-200'
                  }`}
                >
                  {/* Key Metrics Chips */}
                  <div className="flex flex-wrap gap-1.5">
                    {state.result.status && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold font-mono text-[11px]">
                        Status: {state.result.status}
                      </span>
                    )}

                    {state.result.officerName && (
                      <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-700 dark:text-blue-300 font-bold text-[11px]">
                        👮 {state.result.officerName}
                      </span>
                    )}

                    {state.result.ratingDelta !== undefined && (
                      <span
                        className={`px-2 py-0.5 rounded-md font-bold font-mono text-[11px] ${
                          state.result.ratingDelta >= 0
                            ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-300'
                            : 'bg-rose-500/20 text-rose-700 dark:text-rose-300'
                        }`}
                      >
                        Rating: {state.result.ratingDelta >= 0 ? '+' : ''}
                        {state.result.ratingDelta} ★
                        {state.result.ratingReason ? ` (${state.result.ratingReason})` : ''}
                      </span>
                    )}

                    {state.result.confidence !== undefined && (
                      <span className="px-2 py-0.5 rounded-md bg-indigo-500/20 text-indigo-700 dark:text-indigo-300 font-bold text-[11px]">
                        AI Confidence: {state.result.confidence}%
                      </span>
                    )}
                  </div>

                  {/* Summary / Narration text */}
                  {state.result.summary && (
                    <p
                      className={`text-xs ${
                        presenterMode ? 'text-slate-200' : 'text-gray-700'
                      }`}
                    >
                      {state.result.summary}
                    </p>
                  )}

                  {/* Anti-cheat flags (if any) */}
                  {state.result.redFlags && state.result.redFlags.length > 0 && (
                    <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-400 text-[11px] space-y-1">
                      <span className="font-bold flex items-center gap-1">
                        <span>🛡️</span>
                        <span>Anti-Cheat Rejection Flags:</span>
                      </span>
                      <ul className="list-disc list-inside">
                        {state.result.redFlags.map((rf, i) => (
                          <li key={i} className="font-mono">{rf}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Formatted JSON Accordion if detailed AI response */}
                  {state.result.aiDetails && (
                    <details className="mt-1">
                      <summary
                        className={`text-[10px] font-mono cursor-pointer uppercase ${
                          presenterMode ? 'text-slate-400' : 'text-gray-500'
                        }`}
                      >
                        Inspect Gemini Raw JSON &darr;
                      </summary>
                      <pre className="mt-1 p-2 rounded-lg bg-black/40 text-[10px] font-mono text-emerald-400 overflow-x-auto">
                        {JSON.stringify(state.result.aiDetails, null, 2)}
                      </pre>
                    </details>
                  )}
                </div>
              )}

              {/* Error Output */}
              {isError && (
                <div className="mt-2 p-2 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-300 text-xs font-mono">
                  Error: {state.error || 'Step execution failed'}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}