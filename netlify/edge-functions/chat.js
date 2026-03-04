export default async (request) => {
  const origin = request.headers.get('origin') || '';
  const allowed = [
    'https://sewalk-ai.netlify.app',
    'https://genuine-otter-85f43c.netlify.app',
    'http://localhost:3000'
  ];

  // 1. Fix CORS Preflight (So the browser doesn't block you)
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': allowed.includes(origin) ? origin : allowed[0],
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    });
  }

  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  if (!allowed.includes(origin)) {
    return new Response('Forbidden', { status: 403 });
  }

  try {
    const body = await request.json();
    const apiKey = Deno.env.get('GEMINI_API_KEY');

    // 2. Filter history: Gemini 3.1 is strict. NO 'system' roles in 'contents'!
    const contents = body.messages
      .filter(msg => msg.role !== 'system') 
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }]
      }));

    // 3. Using the brand new Gemini 3.1 Flash-Lite (Released March 2026)
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: { 
            parts: [{ text: body.system || "You are a helpful assistant." }] 
          },
          contents: contents,
          generationConfig: {
            maxOutputTokens: 2048, // Bumped this up for ya
            temperature: 0.7
          }
        })
      }
    );

    const data = await geminiResponse.json();

    // 4. Robust Response Handling
    // If the model refuses or fails, we capture the reason instead of an empty screen
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text 
      || data?.error?.message 
      || (data?.candidates?.[0]?.finishReason ? `Model stopped: ${data.candidates[0].finishReason}` : "Unknown error");

    return new Response(JSON.stringify({
      content: [{ type: 'text', text: text }]
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin,
      }
    });

  } catch (err) {
    console.error("Server Crash:", err.message);
    return new Response(JSON.stringify({
      content: [{ type: 'text', text: 'Server Error: ' + err.message }]
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': origin 
      }
    });
  }
};

export const config = { path: '/api/chat' };
