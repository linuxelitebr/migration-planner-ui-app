const assert = require("node:assert");
const webpack = require("webpack");

assert(
  process.env.MIGRATION_PLANNER_API_BASE_URL,
  "MIGRATION_PLANNER_API_BASE_URL is required",
);

/** @type {import('@redhat-cloud-services/frontend-components-config').FecWebpackConfiguration} */
module.exports = {
  appUrl: "/openshift/migration-advisor-dev",
  debug: true,
  useProxy: true,
  proxyVerbose: true,
  sassPrefix: ".assisted-migration-app, .assistedMigrationApp",
  interceptChromeConfig: false,
  plugins: [
    new webpack.DefinePlugin({
      "process.env.MIGRATION_PLANNER_API_BASE_URL": JSON.stringify(
        process.env.MIGRATION_PLANNER_API_BASE_URL,
      ),
      "process.env.MIGRATION_PLANNER_UI_GIT_COMMIT": JSON.stringify(
        process.env.MIGRATION_PLANNER_UI_GIT_COMMIT,
      ),
      "process.env.MIGRATION_PLANNER_UI_VERSION": JSON.stringify(
        process.env.MIGRATION_PLANNER_UI_VERSION,
      ),
    }),
    // Prevent EMFILE (too many open files) by excluding node_modules from
    // webpack's file-system watcher.  The FEC-generated config sets no
    // watchOptions, so without this patch watchpack opens OS-level watchers
    // for every file in node_modules.
    {
      apply(compiler) {
        compiler.options.watchOptions = {
          ...compiler.options.watchOptions,
          ignored: ["**/node_modules/**", "**/build-tools/**"],
        };
      },
    },
  ],
  hotReload: process.env.HOT === "true",
  moduleFederation: {
    exposes: {
      "./RootApp": "./src/MainApp",
    },
    exclude: ["react-router-dom"],
    shared: [
      {
        "react-router-dom": {
          singleton: true,
          import: false,
          version: "^6.3.0",
        },
      },
    ],
  },
};
