// Vercel Serverless Function - /api/ai-invoice.js
// Place this file at: [project root]/api/ai-invoice.js

module.exports = async function (req, res) {
  // Allow CORS from your domain
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle preflight
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Parse body - Vercel auto-parses JSON
  const prompt = req.body && req.body.prompt;

  if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured on server' });
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 800,
        system: 'Extract invoice details from text. Return ONLY a valid JSON object with these keys: bizName (string), cliName (string), subject (string), items (array of objects with desc/qty/price keys), notes (string), taxRate (number). No markdown, no code blocks, ONLY the raw JSON object.',
        messages: [{ role: 'user', content: prompt.slice(0, 2000) }]
      })
    });

    if (!response.ok) {
      const errBody = await response.text();
      console.error('Anthropic API error:', response.status, errBody);
      return res.status(502).json({ error: 'AI service error: ' + response.status });
    }

    const data = await response.json();
    const text = data.content?.[0]?.text || '';

    // Parse JSON - handle markdown code blocks just in case
    const cleaned = text.replace(/```json|```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}/);
    if (!match) {
      return res.status(500).json({ error: 'AI returned unexpected format' });
    }

    const invoice = JSON.parse(match[0]);
    return res.status(200).json({ invoice });

  } catch (err) {
    console.error('Function error:', err.message);
    return res.status(500).json({ error: 'Internal error: ' + err.message });
  }
};
