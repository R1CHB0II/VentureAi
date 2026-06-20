// netlify/functions/validate-idea.js
//
// This runs on Netlify’s servers, NOT in the user’s browser.
// The API key lives only here, as an environment variable — it is
// never sent to or visible from the website itself.

exports.handler = async function (event) {
// Only allow POST requests
if (event.httpMethod !== “POST”) {
return {
statusCode: 405,
body: JSON.stringify({ error: “Method not allowed” })
};
}

// Basic CORS headers (safe to allow, since the API key never leaves this function)
const headers = {
“Access-Control-Allow-Origin”: “*”,
“Access-Control-Allow-Headers”: “Content-Type”,
“Access-Control-Allow-Methods”: “POST, OPTIONS”,
“Content-Type”: “application/json”
};

try {
const body = JSON.parse(event.body || “{}”);
const { idea, market, budget, background } = body;

```
// Server-side validation — never trust the client alone
if (!idea || typeof idea !== "string" || idea.trim().length < 20) {
  return {
    statusCode: 400,
    headers,
    body: JSON.stringify({ error: "Please provide a more detailed business idea (at least a sentence or two)." })
  };
}

const apiKey = process.env.ANTHROPIC_API_KEY;
if (!apiKey) {
  return {
    statusCode: 500,
    headers,
    body: JSON.stringify({ error: "Server is not configured correctly. Missing API key." })
  };
}

const budgetMap = {
  bootstrap: "£0–£1,000",
  seed: "£1,000–£10,000",
  funded: "£10,000–£100,000",
  vc: "£100,000+"
};
const budgetLabel = budgetMap[budget] || "Not specified";

const prompt = `You are a senior venture capital analyst. Produce an honest, specific, investor-grade business validation report.
```

IDEA: ${idea.trim().slice(0, 2000)}
TARGET MARKET: ${(market || “Not specified”).toString().slice(0, 300)}
STARTING BUDGET: ${budgetLabel}
FOUNDER BACKGROUND: ${(background || “Not specified”).toString().slice(0, 300)}

Respond ONLY with valid JSON, no markdown fences, no preamble:

{
“title”: “4-6 word punchy name for this concept”,
“score”: <integer 0-100>,
“scoreVerdict”: “one of: Weak Concept | Needs Work | Promising | Strong | Exceptional”,
“summary”: “3-4 sentences: honest exec summary — what it is, why it could work, the single biggest challenge. Be specific.”,
“metrics”: [
{“val”: “£Xk–£Xm”, “key”: “Year 1 Revenue”},
{“val”: “£Xm–£Xm”, “key”: “5-Year Potential”},
{“val”: “X–X months”, “key”: “Breakeven”},
{“val”: “£XX”, “key”: “Customer LTV”}
],
“marketAnalysis”: “3-4 sentences: TAM in £, key trends for/against, 2-3 named competitors.”,
“risks”: [
{“level”: “high”, “text”: “specific risk — brief mitigation”},
{“level”: “high”, “text”: “specific risk — brief mitigation”},
{“level”: “mid”, “text”: “specific risk — brief mitigation”},
{“level”: “mid”, “text”: “specific risk — brief mitigation”},
{“level”: “low”, “text”: “specific risk — brief mitigation”}
],
“actions”: [
“Week 1–2: specific action”,
“Week 3–4: specific action”,
“Month 2: specific action”,
“Month 2–3: specific action”,
“Month 3: specific action”,
“Month 3 end: specific milestone”
],
“moat”: “2-3 sentences on defensible advantage given this founder’s background and budget.”
}`;

```
const response = await fetch("https://api.anthropic.com/v1/messages", {
  method: "POST",
  headers: {
    "x-api-key": apiKey,
    "anthropic-version": "2023-06-01",
    "content-type": "application/json"
  },
  body: JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [{ role: "user", content: prompt }]
  })
});

if (!response.ok) {
  const errText = await response.text();
  console.error("Anthropic API error:", response.status, errText);
  return {
    statusCode: 502,
    headers,
    body: JSON.stringify({ error: "The AI service returned an error. Please try again in a moment." })
  };
}

const data = await response.json();
const rawText = (data.content || [])
  .map((block) => block.text || "")
  .join("");

const clean = rawText.replace(/```json|```/g, "").trim();

let report;
try {
  report = JSON.parse(clean);
} catch (parseErr) {
  console.error("Failed to parse model output as JSON:", clean);
  return {
    statusCode: 502,
    headers,
    body: JSON.stringify({ error: "Could not generate a structured report. Please try again." })
  };
}

return {
  statusCode: 200,
  headers,
  body: JSON.stringify(report)
};
```

} catch (err) {
console.error(“Unexpected error in validate-idea function:”, err);
return {
statusCode: 500,
headers,
body: JSON.stringify({ error: “Something went wrong on our end. Please try again.” })
};
}
};
