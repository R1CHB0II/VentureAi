exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  try {
    const { idea, market, budget, background } = JSON.parse(event.body || '{}');

    if (!idea || idea.trim().length < 20) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Please describe your idea in more detail.' }) };
    }

    const budgetMap = { bootstrap:'£0-£1,000', seed:'£1,000-£10,000', funded:'£10,000-£100,000', vc:'£100,000+' };

    const prompt = `You are a senior venture capital analyst. Produce an honest investor-grade business validation report.

IDEA: ${idea.trim()}
TARGET MARKET: ${market || 'Not specified'}
STARTING BUDGET: ${budgetMap[budget] || 'Not specified'}
FOUNDER BACKGROUND: ${background || 'Not specified'}

Respond ONLY with valid JSON, no markdown, no backticks:
{"title":"4-6 word name","score":75,"scoreVerdict":"Promising","summary":"3-4 sentence summary","metrics":[{"val":"£10k-£50k","key":"Year 1 Revenue"},{"val":"£500k-£1m","key":"5-Year Potential"},{"val":"6-12 months","key":"Breakeven"},{"val":"£200","key":"Customer LTV"}],"marketAnalysis":"3-4 sentences on market","risks":[{"level":"high","text":"risk 1"},{"level":"high","text":"risk 2"},{"level":"mid","text":"risk 3"},{"level":"mid","text":"risk 4"},{"level":"low","text":"risk 5"}],"actions":["Week 1-2: action","Week 3-4: action","Month 2: action","Month 2-3: action","Month 3: action","Month 3 end: milestone"],"moat":"2-3 sentences on competitive advantage"}`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('API error:', response.status, err);
      return { statusCode: 502, headers, body: JSON.stringify({ error: 'AI service error: ' + response.status }) };
    }

    const data = await response.json();
    const text = data.content.map(b => b.text || '').join('');
    const report = JSON.parse(text.replace(/```json|```/g, '').trim());

    return { statusCode: 200, headers, body: JSON.stringify(report) };

  } catch(err) {
    console.error('Function error:', err.message);
    return { statusCode: 500, headers, body: JSON.stringify({ error: 'Error: ' + err.message }) };
  }
};
