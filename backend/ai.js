// ── AI Gateway client (Bifrost / OpenAI-compatible) ────────────────────────────
// All calls happen server-side. The API key never reaches the browser.

const GATEWAY = process.env.AI_GATEWAY_URL || 'https://gateway-buildathon.ltl.sh/v1/chat/completions';
const API_KEY  = process.env.AI_API_KEY || '';
const MODEL    = process.env.AI_MODEL || 'openai/gpt-4o';

const aiEnabled = () => !!API_KEY;

async function chat(messages, { maxTokens = 900, temperature = 0.2, json = false } = {}) {
  if (!API_KEY) throw new Error('AI_API_KEY not configured');
  const body = { model: MODEL, messages, max_tokens: maxTokens, temperature };
  if (json) body.response_format = { type: 'json_object' };

  const res = await fetch(GATEWAY, {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json();
  if (data.error) throw new Error(data.error.message || data.error.error || 'AI gateway error');
  return data.choices?.[0]?.message?.content || '';
}

// Build a compact, token-safe profile from what the frontend already computed.
// The frontend strips PII/ID columns before sending, so we trust the column list.
function buildProfile({ columns = [], sampleRows = [], rowCount = 0, aggregates = {} }) {
  const colLines = columns.map(c => {
    const agg = aggregates[c.name];
    if (c.type === 'number' && agg) {
      return `- ${c.name} (number): count=${agg.count}, sum=${agg.sum}, avg=${agg.avg}, min=${agg.min}, max=${agg.max}`;
    }
    if ((c.type === 'text' || c.type === 'boolean') && agg) {
      const top = (agg.top5 || []).map(t => `${t.value}(${t.count})`).join(', ');
      return `- ${c.name} (${c.type}): ${agg.uniqueCount} unique values, top: ${top}`;
    }
    if (c.type === 'date' && agg) {
      return `- ${c.name} (date): ${agg.count} values, range ${agg.min} → ${agg.max}`;
    }
    return `- ${c.name} (${c.type})`;
  }).join('\n');

  const preview = sampleRows.slice(0, 10).map(r => JSON.stringify(r)).join('\n');

  return `Dataset: ${rowCount} rows, ${columns.length} analysable columns.\n\nColumn statistics (pre-computed from all ${rowCount} rows):\n${colLines}\n\nSample rows (first 10):\n${preview}`;
}

// ── SUMMARIZE ──────────────────────────────────────────────────────────────────
async function summarize(payload) {
  const profile = buildProfile(payload);
  const focus   = (payload.requirement || '').trim();

  const system = `You are a senior data analyst. You are given statistics pre-computed from a real dataset.
Return STRICT JSON (no markdown fences) with EXACTLY this shape:
{
  "domain": "short label describing what this dataset is about",
  "domainIcon": "one emoji that fits the domain",
  "summary": "2-3 sentence description of what the data contains, its shape, and key characteristics — use the actual column names and numbers",
  "observations": ["3-5 specific, quantified insights drawn ONLY from the statistics provided — reference exact numbers"],
  "suggestions": ["3-4 analysis questions the user could explore, phrased as short plain-English prompts"],
  "recommendedCharts": ["2-4 specific chart ideas using the actual column names, e.g. 'Revenue by Category bar chart'"]
}
RULES:
- Use ONLY the statistics and sample rows provided. Never invent values or columns.
- If a number is not in the profile, do not state it.
- Observations must cite specific numbers from the aggregates (e.g. "avg salary is 72,000").`;

  const user = focus
    ? `${profile}\n\nUser is specifically interested in: "${focus}". Tailor observations, suggestions, and chart ideas toward this focus.`
    : profile;

  const content = await chat(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    { maxTokens: 1000, temperature: 0.2, json: true }
  );
  return safeParse(content);
}

// ── ASK (natural-language Q&A about the data) ──────────────────────────────────
async function ask(payload) {
  const profile  = buildProfile(payload);
  const question = (payload.question || '').trim();
  const history  = Array.isArray(payload.history) ? payload.history : [];

  const system = `You are a data analyst assistant. You answer questions about a dataset using ONLY the statistics and sample rows provided below — never invent data, percentages, or values that are not in the profile.

When answering:
- Cite specific numbers from the column statistics (counts, sums, averages, top values).
- If the question cannot be answered from the provided statistics, say so clearly and explain what additional data would be needed.
- Keep answers concise (2-5 sentences) unless a breakdown is explicitly requested.
- If a chart or table would help, name the specific columns to use.
- Do not make predictions or assumptions beyond what the data supports.

${profile}`;

  const messages = [
    { role: 'system', content: system },
    ...history,
    { role: 'user', content: question },
  ];

  const content = await chat(messages, { maxTokens: 600, temperature: 0.2 });
  return { answer: content.trim() };
}

function safeParse(text) {
  try { return JSON.parse(text); }
  catch {
    const m = text.match(/\{[\s\S]*\}/);
    if (m) { try { return JSON.parse(m[0]); } catch {} }
    throw new Error('AI returned unparseable response');
  }
}

module.exports = { aiEnabled, summarize, ask, MODEL };
