const assert = require('assert');
const fs = require('fs');
const path = require('path');

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function countMatches(text, pattern) {
  return (text.match(pattern) || []).length;
}

function main() {
  const root = path.resolve(__dirname, '..', '..');
  const sidebar = read(path.join(root, 'frontend', 'src', 'components', 'Sidebar.js'));
  const app = read(path.join(root, 'frontend', 'src', 'App.js'));
  const translations = JSON.parse(read(path.join(root, 'frontend', 'src', 'data', 'trackerTranslations.json')));

  assert.strictEqual(countMatches(sidebar, /\/live-tracker/g), 0, 'sidebar should not contain /live-tracker links');
  assert.strictEqual(countMatches(sidebar, /\/flight-tracker/g), 1, 'sidebar should contain one canonical tracker link');
  assert.strictEqual(countMatches(sidebar, /Flight Radar/g), 0, 'sidebar should not contain duplicate tracker branding');
  assert.strictEqual(countMatches(sidebar, /Live Radar/g), 0, 'sidebar should not contain duplicate tracker branding');
  assert(app.includes('<Navigate to={`/flight-tracker${location.search || \'\'}`} replace />'), 'app should redirect /live-tracker to /flight-tracker');
  assert(translations.en && translations.ar && translations.de, 'tracker translations should include en/ar/de');
  assert(translations.en.tracker && translations.en.tracker.pageTitle, 'English tracker copy should be present');
  assert(translations.de.tracker && translations.de.tracker.pageTitle, 'German tracker copy should be present');
  assert(translations.ar.tracker && translations.ar.tracker.pageTitle, 'Arabic tracker copy should be present');
  assert.strictEqual(translations.ar.dir, 'rtl', 'Arabic tracker copy should be RTL');

  console.log('Tracker UI smoke tests passed');
}

main();
