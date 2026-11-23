const fs = require('fs');
const path = require('path');

const DEFAULT_LANG = 'en';
const LOCALES_DIR = path.join(__dirname, '..', '..', 'locales');

// Loaded once at startup (module load), never inside a request handler.
const locales = {};
for (const file of fs.readdirSync(LOCALES_DIR)) {
  if (file.endsWith('.json')) {
    locales[path.basename(file, '.json')] = JSON.parse(
      fs.readFileSync(path.join(LOCALES_DIR, file), 'utf8')
    );
  }
}

function getLocale(lang) {
  const code = typeof lang === 'string' && Object.hasOwn(locales, lang) ? lang : DEFAULT_LANG;
  return { code, strings: locales[code] };
}

module.exports = { getLocale };
