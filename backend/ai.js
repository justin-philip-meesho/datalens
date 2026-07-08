// ── AI Gateway client (Bifrost / OpenAI-compatible) ────────────────────────────
// All calls happen server-side so the API key never reaches the browser.

const GATEWAY = process.env.AI_GATEWAY_URL || 'https://gateway-buildathon.ltl.sh/v1/chat/completions';
const API_KEY = process.env.AI_API_KEY || '';
const MODEL   = process.env.AI_MODEL || 'openai/gpt-4o';

const aiEnabled = () => !!API_KEY;

async function chat(messages, { maxTokens = 900, temperature = 0.3, json = false } = {}) {
  if (!API_KEY) throw new Error('AI_API_KEY not configured');
  const body = {
    model: MODEL,
    messages,
    max_tokens: maxTokens,
    temperature,
  };
  if (json) body.response_format = { type: 'json_object' };

  const res = await fetch(GATEWAY, {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (data.error) {
    const msg = data.error.message || data.error.error || 'AI gateway error';
    throw new Error(msg);
  }
  return data.choices?.[0]?.message?.content || '';
}

// Build a compact, token-safe profile of the dataset to send to the model.
function buildProfile({ columns = [], sampleRows = [], rowCount = 0 }) {
  const cols = columns.map(c => {
    const values = sampleRows.map(r => r[c.name]).filter(v => v !== '' && v != null);
    const uniq = new Set(values.map(String)).size;
    let extra = '';
    if (c.type === 'number') {
      const nums = values.map(Number).filter(v => !isNaN(v));
      if (nums.length) {
        const min = Math.min(...nums), max = Math.max(...nums);
        const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
        extra = ` range=[${round(min)}, ${round(max)}] avg=${round(avg)}`;
      }
    } else {
      const top = topValues(values, 4);
      extra = top.length ? ` topValues=[${top.join(', ')}]` : '';
    }
    return `- ${c.name} (${c.type}): ${uniq} unique${extra}`;
  }).join('\n');

  const preview = sampleRows.slice(0, 8)
    .map(r => JSON.stringify(r))
    .join('\n');

  return `Dataset: ${rowCount} rows, ${columns.length} columns.\n\nColumns:\n${cols}\n\nSample rows (first 8):\n${preview}`;
}

function round(n) {
  if (!isFinite(n)) return n;
  if (Math.abs(n) >= 1000) return Math.round(n);
  return Math.round(n * 100) / 100;
}

function topValues(values, n) {
  const freq = {};
  values.forEach(v => { const k = String(v); freq[k] = (freq[k] || 0) + 1; });
  return Object.entries(freq).sort((a, b) => b[1] - a[1]).slice(0, n).map(e => `${e[0]} (${e[1]})`);
}

// ── SUMMARIZE ──────────────────────────────────────────────────────────────────
async function summarize(payload) {
  const profile = buildProfile(payload);
  const focus = (payload.requirement || '').trim();

  const system = `You are a senior data analyst. You are given a profile of a tabular dataset. ` +
    `Return STRICT JSON (no markdown) with this exact shape:
{
  "domain": "short label for what this dataset is about, e.g. 'E-Commerce Orders'",
  "domainIcon": "a single emoji that fits the domain",
  "summary": "2-3 sentence natural-language description of what the data contains and its shape",
  "observations": ["3-5 specific, quantified insights grounded ONLY in the profile numbers"],
  "suggestions": ["3-4 concrete analysis questions the user could explore, phrased as short prompts"],
  "recommendedCharts": ["2-4 specific chart ideas, e.g. 'Revenue over time by Region'"]
}
Be specific and use real column names and numbers from the profile. Do not invent columns.`;

  const user = focus
    ? `${profile}\n\nThe user is specifically interested in: "${focus}". Tailor observations, suggestions, and recommendedCharts toward this.`
    : profile;

  const content = await chat(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    { maxTokens: 900, temperature: 0.4, json: true }
  );
  return safeParse(content);
}

// ── ASK (natural-language Q&A about the data) ──────────────────────────────────
async function ask(payload) {
  const profile = buildProfile(payload);
  const question = (payload.question || '').trim();

  const system = `You are a data analyst assistant. Answer the user's question about their dataset ` +
    `using ONLY the profile provided. Be concise (2-4 sentences), quantified, and honest about ` +
    `what the sample can and cannot tell you. If a chart would help, mention which columns to plot. ` +
    `Do not fabricate values beyond what the profile supports.`;

  const content = await chat(
    [
      { role: 'system', content: system },
      { role: 'user', content: `${profile}\n\nQuestion: ${question}` },
    ],
    { maxTokens: 500, temperature: 0.3 }
  );
  return { answer: content.trim() };
}

function safeParse(text) {
  try { return JSON.parse(text); }
  catch (e) {
    // strip markdown fences if the model added them
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch (e2) {} }
    throw new Error('AI returned unparseable response');
  }
}

module.exports = { aiEnabled, summarize, ask, MODEL };
