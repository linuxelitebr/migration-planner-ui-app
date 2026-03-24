/**
 * The app slug used by the Insights Chrome to mount this microfrontend.
 * Matches `appUrl` in `fec.config.js`.
 */
const APP_SLUG = "/openshift/migration-advisor-dev";

let lastLoggedBasename: string | null = null;

/**
 * Resolve the app's base path at runtime.
 *
 * - **Standalone (dev) mode** — `BrowserRouter` has `basename="/"` and the
 *   app is mounted at the root. Returns `""` so every route is root-relative.
 *
 * - **Microfrontend (stage) mode** — The Chrome's `BrowserRouter` has
 *   `basename="/"` and mounts the app inside a nested `<Route>` at
 *   `APP_SLUG`. Absolute `navigate()` / `<Link to>` calls must therefore
 *   include the full mount path, otherwise React Router resolves them from
 *   the router root and the URL ends up outside the app.
 *
 * Detection: if the current URL contains the app slug, we're in stage mode.
 * This is called dynamically each time routes are accessed to avoid module-load
 * timing issues with federated modules.
 */
function resolveAppBasename(): string {
  try {
    // Strip known Chrome preview/beta prefixes before matching
    const pathname = window.location.pathname.replace(/^\/(preview|beta)/, "");
    const basename = pathname.startsWith(APP_SLUG) ? APP_SLUG : "";

    // Log only when basename changes or on first detection (to track production issues)
    if (process.env.NODE_ENV !== "test" && lastLoggedBasename !== basename) {
      console.info("[Routes] Basename detected:", {
        mode: basename ? "microfrontend" : "standalone",
        basename: basename || "(root)",
        currentPathname: window.location.pathname,
        timestamp: new Date().toISOString(),
      });
      lastLoggedBasename = basename;
    }

    return basename;
  } catch {
    return ""; // SSR / test environment without DOM
  }
}

/**
 * Get the app's mount-path prefix dynamically.
 * - `""` in standalone (dev) mode
 * - `"/openshift/migration-assessment"` in stage mode
 *
 * This is computed on each access to avoid caching stale values during
 * module hot-reloading or federated module initialization.
 */
function getAppBasename(): string {
  return resolveAppBasename();
}

/**
 * The app's mount-path prefix.
 * - `""` in standalone (dev) mode
 * - `"/openshift/migration-assessment"` in stage mode
 *
 * @deprecated This is a snapshot at module-load time and may be stale.
 * Prefer using the `routes` object which dynamically resolves the basename.
 */
export const APP_BASENAME = getAppBasename();

/**
 * Centralized route map with dynamic basename resolution.
 *
 * Each route property is a getter that computes the full path at access time,
 * ensuring the basename is always current even during HMR or federated module
 * initialization.
 */
export const routes = {
  get root() {
    const base = getAppBasename();
    return base || "/";
  },
  get assessments() {
    return `${getAppBasename()}/assessments`;
  },
  assessmentById: (id: string) => `${getAppBasename()}/assessments/${id}`,
  assessmentReport: (id: string) =>
    `${getAppBasename()}/assessments/${id}/report`,
  get assessmentCreate() {
    return `${getAppBasename()}/assessments/create`;
  },
  get exampleReport() {
    return `${getAppBasename()}/assessments/example-report`;
  },
  get environments() {
    return `${getAppBasename()}/environments`;
  },
} as const;
