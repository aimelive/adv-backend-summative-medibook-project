const { getLocale } = require('../models/feedbackModel');

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function renderPage(code, t) {
  const today = new Intl.DateTimeFormat(code, { dateStyle: 'full' }).format(new Date());
  const questions = t.questions
    .map(
      (q, i) => `    <div class="q">
      <label for="q${i + 1}">${i + 1}. ${escapeHtml(q)}</label>
      <textarea id="q${i + 1}" name="q${i + 1}" rows="4"></textarea>
    </div>`
    )
    .join('\n');

  return `<!DOCTYPE html>
<html lang="${escapeHtml(t.htmlLang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(t.title)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 680px; margin: 2rem auto; padding: 0 1rem; color: #222; }
    .date { color: #666; font-size: .9rem; }
    .q { margin: 1.25rem 0; }
    label { display: block; font-weight: 600; margin-bottom: .4rem; }
    textarea { width: 100%; box-sizing: border-box; padding: .5rem; font: inherit; }
    button { padding: .6rem 1.2rem; font: inherit; cursor: pointer; }
  </style>
</head>
<body>
  <h1>${escapeHtml(t.title)}</h1>
  <p class="date">${escapeHtml(t.dateLabel)}: ${escapeHtml(today)}</p>
  <p>${escapeHtml(t.instructions)}</p>
  <form method="post" action="/feedback">
    <input type="hidden" name="lang" value="${escapeHtml(code)}">
${questions}
    <button type="submit">${escapeHtml(t.submit)}</button>
  </form>
</body>
</html>`;
}

function renderThanks(code, t) {
  return `<!DOCTYPE html>
<html lang="${escapeHtml(t.htmlLang)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(t.thankYouTitle)}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 680px; margin: 2rem auto; padding: 0 1rem; color: #222; }
  </style>
</head>
<body>
  <h1>${escapeHtml(t.thankYouMessage)}</h1>
  <p><a href="/feedback?lang=${encodeURIComponent(code)}">${escapeHtml(t.backLink)}</a></p>
</body>
</html>`;
}

// Answers are intentionally not stored; only the language is read.
exports.submit = (req, res) => {
  const { code, strings } = getLocale(req.body?.lang);
  res.type('html').send(renderThanks(code, strings));
};

exports.show =(req, res) => {
  const { code, strings } = getLocale(req.query.lang);
  res.type('html').send(renderPage(code, strings));
};
