export default async (request) => {
  // Only allow POST requests
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  // Allow requests from your site only
  const origin = request.headers.get('origin') || '';
  const allowed = [
    'https://sewalk-ai.netlify.app',
    'https://genuine-otter-85f43c.netlify.app',
    'http://localhost:3000'
  ];
  if (!allowed.includes(origin)) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const body = await request.json();

    // Forward request to Anthropic — API key is secret here, never exposed
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'),
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 1024,
        system: body.system,
        messages: body.messages
      })
    });

    const data = await response.json();

    return new Response(JSON.stringify(data), {
      status: response.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
        'Access-Control-Allow-Methods': 'POST',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: { message: err.message } }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = { path: '/api/chat' };
