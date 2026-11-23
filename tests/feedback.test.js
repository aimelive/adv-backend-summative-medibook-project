const http = require('http');
const express = require('express');
const feedbackRoutes = require('../src/routes/feedbackRoutes');

let server;
let base;

beforeAll(async () => {
  const app = express();
  app.use('/feedback', feedbackRoutes);
  server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

afterAll(() => new Promise((resolve) => server.close(resolve)));

const post = (body) =>
  fetch(`${base}/feedback`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

test('GET form contains hidden lang field', async () => {
  const html = await (await fetch(`${base}/feedback?lang=fr`)).text();
  expect(html).toContain('<input type="hidden" name="lang" value="fr">');
});

test('POST /feedback in English', async () => {
  const res = await post('lang=en&q1=hello');
  const html = await res.text();
  expect(res.status).toBe(200);
  expect(html).toContain('Thank you for your feedback');
  expect(html).toContain('href="/feedback?lang=en"');
});

test('POST /feedback in French', async () => {
  const res = await post('lang=fr&q1=bonjour');
  const html = await res.text();
  expect(res.status).toBe(200);
  expect(html).toContain('Merci pour vos commentaires');
  expect(html).toContain('href="/feedback?lang=fr"');
});

test('POST /feedback with unsupported or missing lang falls back to English', async () => {
  expect(await (await post('lang=xx')).text()).toContain('Thank you for your feedback');
  expect(await (await post('q1=a')).text()).toContain('Thank you for your feedback');
});
