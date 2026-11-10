// Extends app.json with build-time settings.
// EXPO_BASE_URL lets the web build live under a sub-path, e.g. "/asligibidir"
// for GitHub Pages project sites; leave it unset to serve from the domain root.
module.exports = ({ config }) => ({
  ...config,
  experiments: {
    ...config.experiments,
    ...(process.env.EXPO_BASE_URL ? { baseUrl: process.env.EXPO_BASE_URL } : {}),
  },
});
