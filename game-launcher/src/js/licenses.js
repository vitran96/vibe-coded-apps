// The text of LICENSE (repo MIT plus every third-party notice), bundled into the app by Vite.
// Imported on demand so unit tests (plain Node) never load it.
export async function loadLicenseText() {
  return (await import('../../LICENSE?raw')).default;
}
