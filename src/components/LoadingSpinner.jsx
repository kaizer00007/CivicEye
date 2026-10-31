/**
 * Loading spinner — used throughout the app for loading states.
 */
export default function LoadingSpinner({ size = 'md', text = '' }) {
  const sizes = {
    sm: 'h-5 w-5',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-3 py-8">
      <div
        className={`${sizes[size] || sizes.md} animate-spin rounded-full
          border-4 border-gray-200 border-t-blue-600`}
      />
      {text && <p className="text-sm text-gray-500">{text}</p>}
    </div>
  );
}

/**
 * Full-page centered loading state.
 */
export function FullPageSpinner({ text = 'Loading...' }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <LoadingSpinner size="lg" text={text} />
    </div>
  );
}
