import { useNavigate, useLocation } from "react-router-dom";
import { ShieldOff, MoveLeft, Home } from "lucide-react";

export default function NotFound() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleGoBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/", { replace: true });
    }
  };

  return (
    <main className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-12 text-center">
      {/* Error icon */}
      <div className="relative mb-8" aria-hidden="true">
        <div className="absolute inset-0 scale-150 rounded-full bg-red-500/20 blur-2xl" />

        <div className="relative rounded-full border border-red-200 bg-red-50 p-6 dark:border-red-800 dark:bg-red-900/20">
          <ShieldOff className="h-14 w-14 text-red-500 dark:text-red-400" />
        </div>
      </div>

      {/* Error status */}
      <p className="mb-2 text-sm font-semibold uppercase tracking-widest text-red-500 dark:text-red-400">
        Error 404
      </p>

      {/* Page heading */}
      <h1 className="mb-3 text-3xl font-bold text-gray-900 sm:text-4xl dark:text-white">
        Page Not Found
      </h1>

      <p className="mb-3 max-w-xl text-sm leading-6 text-gray-600 sm:text-base dark:text-slate-400">
        Sorry, we couldn&apos;t find the page you&apos;re looking for.
      </p>

      {/* Requested path */}
      <p className="mb-2 max-w-full break-words text-sm text-gray-500 dark:text-slate-400">
        Requested path:
        <code className="mx-1 inline-block break-all rounded border border-gray-200 bg-gray-100 px-2 py-1 font-mono text-xs text-gray-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300">
          {location.pathname}
        </code>
      </p>

      <p className="mb-10 max-w-sm text-sm leading-6 text-gray-400 dark:text-slate-500">
        The page may have been moved, removed, or the link may be incorrect.
      </p>

      {/* Navigation actions */}
      <div className="flex w-full max-w-sm flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row">
        <button
          type="button"
          onClick={handleGoBack}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-gray-200 bg-white px-5 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700 dark:focus-visible:ring-offset-slate-900"
        >
          <MoveLeft className="h-4 w-4" aria-hidden="true" />
          Go Back
        </button>

        <button
          type="button"
          onClick={() => navigate("/", { replace: true })}
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-slate-900"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          Back to Dashboard
        </button>
      </div>
    </main>
  );
}
