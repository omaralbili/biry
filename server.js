/**
 * بيري | Berry Chatbot — Gemini Backend
 *
 * Gemini API configuration:
 * - API key name: Gemini API Key
 * - Project name: projects/1016357323308
 * - Project number: 1016357323308
 *
 * SECURITY:
 * The Gemini API key is read from .env on the server only.
 * It must NEVER be placed in app.js or any browser-visible file.
 */

const http = require('http');
const fs = require('fs');
const path = require('path');

loadDotEnv(path.join(__dirname, '.env'));

const PORT = Number(process.env.PORT || 4000);
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-3.6-flash';

const PROGRAM_CONTEXT = `
أنت "بيري"، مساعد ذكي لبرنامج إعداد أخصائي تكنولوجيا التعليم لذوي الاحتياجات الخاصة
بكلية التربية النوعية - جامعة المنصورة.

معلومات موثوقة عن البرنامج:
- يقبل البرنامج طلاب الثانوية العامة (علمي - أدبي) وطلاب الشهادات الفنية نظام الخمس سنوات.
- من مجالات البرنامج: تكنولوجيا التعليم، تصميم وإنتاج البرامج والمحتوى التعليمي،
  التقنيات المساعدة، الإتاحة الرقمية، التعليم الإلكتروني، والذكاء الاصطناعي.
- يهتم البرنامج بإنتاج برامج تعليمية وحلول رقمية تساعد على تعليم الطلاب ذوي الاحتياجات الخاصة.
- من مجالات العمل الممكنة: تصميم وتطوير المحتوى التعليمي الرقمي، التطبيقات والمواقع الميسرة،
  التقنيات المساعدة، تكنولوجيا التعليم والتعلم الإلكتروني، والتدريب على التكنولوجيا.
- لا تخترع شروطًا أو رسومًا أو مواعيد أو قرارات رسمية غير موجودة في السياق.
- إذا كان السؤال عامًا ولا يتعلق بالبرنامج، أجب عنه بصورة مفيدة وطبيعية، واذكر عند الحاجة
  أن الإجابة العامة ليست معلومة رسمية صادرة عن البرنامج.
- أجب بالعربية عندما يكون السؤال بالعربية، وبنفس لغة السؤال عندما تكون لغة السؤال مختلفة.
- كن واضحًا ومختصرًا ومنظمًا، ويمكن استخدام عناوين ونقاط.
`;

function loadDotEnv(file) {
  try {
    if (!fs.existsSync(file)) return;
    for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const i = t.indexOf('=');
      if (i < 1) continue;
      const key = t.slice(0, i).trim();
      let value = t.slice(i + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) ||
          (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
      if (!process.env[key]) process.env[key] = value;
    }
  } catch (err) { console.error('Could not read .env:', err.message); }
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
  });
  res.end(JSON.stringify(data));
}

function sendFile(res, filePath) {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8'
  };
  fs.readFile(filePath, (err, data) => {
    if (err) return sendJson(res, 404, { error: 'File not found' });
    res.writeHead(200, { 'Content-Type': types[path.extname(filePath)] || 'application/octet-stream' });
    res.end(data);
  });
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 100000) reject(new Error('Request too large'));
    });
    req.on('end', () => {
      try { resolve(JSON.parse(body || '{}')); }
      catch { reject(new Error('Invalid JSON')); }
    });
    req.on('error', reject);
  });
}

async function askGemini(message, mode) {
  if (!GEMINI_API_KEY) throw new Error('GEMINI_API_KEY is not configured on the server');

  const instruction = mode === 'more'
    ? 'قدّم شرحًا أعمق وأكثر فائدة للسؤال، مع أمثلة عملية عند الحاجة.'
    : 'أجب عن السؤال مباشرة وبمعلومات مفيدة.';

  const prompt = `${PROGRAM_CONTEXT}\n\n${instruction}\n\nسؤال المستخدم:\n${message}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(GEMINI_MODEL)}:generateContent`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 1200 }
      })
    }
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    console.error('Gemini API error:', response.status, data);
    throw new Error(data?.error?.message || `Gemini API error (${response.status})`);
  }

  const reply = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
  if (!reply) throw new Error('Gemini returned no text');
  return reply;
}

const server = http.createServer(async (req, res) => {
  try {
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      });
      return res.end();
    }

    if (req.method === 'POST' && req.url === '/api/ai-response') {
      const body = await readBody(req);
      const message = String(body.message || '').trim();
      const mode = body.mode === 'more' ? 'more' : 'answer';
      if (!message) return sendJson(res, 400, { error: 'الرسالة فارغة.' });
      if (message.length > 5000) return sendJson(res, 400, { error: 'السؤال طويل جدًا.' });

      return sendJson(res, 200, { reply: await askGemini(message, mode) });
    }

    const requestPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const relative = requestPath === '/' ? 'index.html' : requestPath.replace(/^\/+/, '');
    const filePath = path.normalize(path.join(__dirname, relative.startsWith('biry/') ? relative : `biry/${relative}`));
    const root = path.normalize(__dirname);
    if (!filePath.startsWith(root + path.sep)) return sendJson(res, 403, { error: 'Forbidden' });
    return sendFile(res, filePath);
  } catch (err) {
    console.error(err);
    return sendJson(res, 500, { error: err.message || 'Server error' });
  }
});

server.listen(PORT, () => console.log(`Berry is running at http://localhost:${PORT}`));
