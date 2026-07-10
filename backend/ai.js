// ── AI Gateway client (Bifrost / OpenAI-compatible) ────────────────────────────
// All calls happen server-side. The API key never reaches the browser.

const GATEWAY = process.env.AI_GATEWAY_URL || 'https://gateway-buildathon.ltl.sh/v1/chat/completions';
const API_KEY  = process.env.AI_API_KEY || '';
const MODEL    = process.env.AI_MODEL || 'openai/gpt-4o';

const aiEnabled = () => !!API_KEY;

async function chat(messages, { maxTokens = 1200, temperature = 0.2, json = false } = {}) {
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

// Build a compact, token-safe profile.
// The frontend strips PII/ID columns before sending — we trust the column list.
function buildProfile({ columns = [], sampleRows = [], rowCount = 0, aggregates = {} }) {
  const colLines = columns.map(c => {
    const agg = aggregates[c.name];
    if (c.type === 'number' && agg) {
      return `- ${c.name} (number): count=${agg.count}, sum=${agg.sum}, avg=${agg.avg}, min=${agg.min}, max=${agg.max}`;
    }
    if ((c.type === 'text' || c.type === 'boolean') && agg) {
      const top = (agg.top5 || []).map(t => `${t.value}(${t.count})`).join(', ');
      return `- ${c.name} (${c.type}): ${agg.uniqueCount} unique, top: ${top}`;
    }
    if (c.type === 'date' && agg) {
      return `- ${c.name} (date): ${agg.count} values, ${agg.min} → ${agg.max}`;
    }
    return `- ${c.name} (${c.type})`;
  }).join('\n');

  const preview = sampleRows.slice(0, 12).map(r => JSON.stringify(r)).join('\n');
  return `Dataset: ${rowCount} rows, ${columns.length} analysable columns.\n\nColumn statistics (from all ${rowCount} rows):\n${colLines}\n\nSample rows:\n${preview}`;
}

// ── SUMMARIZE + DASHBOARD PLAN ─────────────────────────────────────────────────
async function summarize(payload) {
  const profile = buildProfile(payload);
  const focus   = (payload.requirement || '').trim();
  const colNames = (payload.columns || []).map(c => c.name);

  const system = `You are a senior data analyst. You will receive statistics pre-computed from a real dataset.

Return STRICT JSON (no markdown) with EXACTLY this shape:
{
  "domain": "short label e.g. 'HR & People Analytics'",
  "domainIcon": "one emoji",
  "summary": "2-3 sentences describing what this data is, its shape, and key characteristics. Use real column names and numbers.",
  "observations": ["3-5 specific insights with real numbers from the statistics, e.g. 'Average salary is 72,000 with a max of 2,10,000'"],
  "suggestions": ["3-4 plain-English questions the analyst should explore"],
  "keyMetrics": ["ordered list of the most analytically valuable NUMERIC column names — most important first, max 5"],
  "keyDimensions": ["ordered list of the most useful CATEGORICAL/TEXT column names for grouping — max 4"],
  "keyDateCol": "the best DATE column name for trend analysis, or null if none",
  "charts": [
    {
      "type": "bar",
      "xCol": "a categorical column name from the data",
      "yCol": "a numeric column name from the data",
      "agg": "avg or sum or count",
      "title": "chart title"
    }
  ]
}

CHART RULES — include 4-6 charts. Each chart must use ONLY column names that exist in the dataset.
Allowed chart types and their required fields:
- "histogram": { "col": numeric_col, "title": "..." }             — distribution of one numeric col
- "bar":        { "xCol": text_col, "yCol": numeric_col, "agg": "avg"|"sum"|"count", "title": "..." }  — grouped bar
- "donut":      { "col": text_col, "title": "..." }                — count breakdown of a category
- "timeseries": { "dateCol": date_col, "valueCol": numeric_col, "title": "..." } — trend over time
- "scatter":    { "xCol": numeric_col, "yCol": numeric_col, "title": "..." }     — two metrics correlated
- "boxplot":    { "col": numeric_col, "title": "..." }             — distribution + outliers

STRICT RULES:
- Only use column names that appear in the dataset profile provided.
- keyMetrics / keyDimensions / keyDateCol must only reference real column names.
- Observations must cite specific numbers from the aggregates.
- Do not invent columns, values, or percentages not in the profile.`;

  const user = focus
    ? `${profile}\n\nUser's focus: "${focus}". Prioritise this in keyMetrics, keyDimensions, charts, and observations.`
    : profile;

  const content = await chat(
    [{ role: 'system', content: system }, { role: 'user', content: user }],
    { maxTokens: 1400, temperature: 0.2, json: true }
  );

  const result = safeParse(content);

  // Validate: remove any chart referencing columns not in the dataset
  if (Array.isArray(result.charts)) {
    result.charts = result.charts.filter(ch => {
      const cols = [ch.col, ch.xCol, ch.yCol, ch.dateCol, ch.valueCol].filter(Boolean);
      return cols.every(c => colNames.includes(c));
    });
  }
  // Validate keyMetrics / keyDimensions / keyDateCol
  if (Array.isArray(result.keyMetrics)) result.keyMetrics = result.keyMetrics.filter(c => colNames.includes(c));
  if (Array.isArray(result.keyDimensions)) result.keyDimensions = result.keyDimensions.filter(c => colNames.includes(c));
  if (result.keyDateCol && !colNames.includes(result.keyDateCol)) result.keyDateCol = null;

  return result;
}

// ── ASK (natural-language Q&A with conversation history) ──────────────────────
async function ask(payload) {
  const profile  = buildProfile(payload);
  const question = (payload.question || '').trim();
  const history  = Array.isArray(payload.history) ? payload.history : [];

  const system = `You are a data analyst assistant. Answer questions about the dataset using ONLY the statistics and sample rows provided below.

Rules:
- Cite specific numbers from the column statistics (count, sum, avg, min, max, top values).
- If the answer cannot be determined from the provided data, say so clearly — do not guess.
- Keep answers concise (2-5 sentences) unless a detailed breakdown is requested.
- When a chart would help, name the specific columns: e.g. "Plot Revenue (y) by Region (x) as a bar chart."
- For follow-up questions, use the conversation history to maintain context.
- Do not fabricate values not present in the profile.

${profile}`;

  const messages = [
    { role: 'system', content: system },
    ...history.slice(-8),
    { role: 'user', content: question },
  ];

  const content = await chat(messages, { maxTokens: 700, temperature: 0.2 });
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
