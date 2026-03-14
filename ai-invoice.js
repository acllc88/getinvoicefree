// Vercel Serverless Function
// File location in your project: /api/ai-invoice.js
// This must be at the ROOT of your Vercel project (same level as index.html)

module.exports = async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let prompt;
  try {
    prompt = req.body && req.body.prompt;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid request body' });
  }

  if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
    return res.status(400).json({ error: 'Missing prompt' });
  }

  if (prompt.length > 3000) {
    return res.status(400).json({ error: 'Prompt too long' });
  }

  const API_KEY = process.env.ANTHROPIC_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'API key not configured' });
  }

  const systemPrompt = 'You extract invoice details from text descriptions. Return ONLY a valid JSON object with these exact keys: bizName (string), cliName (string), subject (string), items (array of {desc,qty,price}), notes (string), taxRate (number 0-100). No markdown, no explanation, just the JSON object.';

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
        system: systemPrompt,
        messages: [{
          role: 'user',
          content: 'Extract invoice details from: ' + prompt
        }]
      })
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error('Anthropic error:', response.status, errText);
      return res.status(502).json({ error: 'AI service unavailable' });
    }

    const data = await response.json();
    const text = (data.content && data.content[0] && data.content[0].text) || '';

    // Parse JSON from response
    let invoice;
    try {
      // Try direct parse first
      invoice = JSON.parse(text.trim());
    } catch (e) {
      // Extract JSON from text
      const match = text.match(/\{[\s\S]*\}/);
      if (!match) {
        return res.status(500).json({ error: 'Could not parse AI response' });
      }
      invoice = JSON.parse(match[0]);
    }

    return res.status(200).json({ invoice });

  } catch (error) {
    console.error('Handler error:', error.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
};
