// Runs once in Jest's main process, before any test worker starts, so every
// worker inherits it. Some attendance code builds Date objects from local-time
// strings, which makes results depend on the server timezone; pinning it keeps
// unit tests (and the attendance snapshots) identical on developer machines
// and in CI. Europe/Moscow is UTC+3 with no DST.
module.exports = async () => {
  process.env.TZ = 'Europe/Moscow';
};
