// SeWalk AI — Netlify Edge Function
// Updated: added multimodal image support for Gemini
const ALLOWED_ORIGINS = [
  'https://sewalk-ai-app.netlify.app',
  'https://sewalk-ai-0e0188.netlify.app',
  'https://sewalk-ai.vercel.app',
  'https://sewalk-ai-c05935.netlify.app',
  'https://sewalk-ai.netlify.app',
  'https://genuine-otter-85f43c.netlify.app',
  'http://localhost:3000',
  'http://localhost:8888'
];
const CORS_HEADERS = (origin) => ({
  'Access-Control-Allow-Origin': origin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
});
export default async (request) => {
  const origin = request.headers.get('origin') || '';
  const isAllowed = ALLOWED_ORIGINS.includes(origin);
  // --- Handle CORS preflight (OPTIONS) ---
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: CORS_HEADERS(isAllowed ? origin : ALLOWED_ORIGINS[0]),
    });
  }
  // --- Only allow POST ---
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  // --- Origin check ---
  if (!isAllowed) {
    return new Response('Forbidden', { status: 403 });
  }
  try {
    const body = await request.json();
    const apiKey = Deno.env.get('GEMINI_API_KEY');
    if (!apiKey) {
      throw new Error('GEMINI_API_KEY is not set in Netlify environment variables.');
    }

    // Build conversation history
    const contents = (body.messages || [])
      .filter(msg => msg.role !== 'system')
      .map(msg => ({
        role: msg.role === 'assistant' ? 'model' : 'user',
        parts: [{ text: msg.content }],
      }));

    // If image is attached, replace the last user message with multimodal content
    if (body.image && body.image.base64) {
      const imagePart = {
        inline_data: {
          mime_type: body.image.mime || 'image/jpeg',
          data: body.image.base64
        }
      };
      const textPart = { text: body.imageText || 'Please analyse this image.' };
      // Replace last user turn with image + text
      if (contents.length > 0 && contents[contents.length - 1].role === 'user') {
        contents[contents.length - 1].parts = [imagePart, textPart];
      } else {
        contents.push({ role: 'user', parts: [imagePart, textPart] });
      }
    }

    const MODEL = 'gemini-3.1-flash-lite-preview';
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: body.system || 'You are a helpful assistant.' }],
          },
          contents: contents,
          generationConfig: {
            maxOutputTokens: 1024,
            temperature: 0.7,
          },
        }),
      }
    );
    const data = await geminiResponse.json();
    if (!geminiResponse.ok || data?.error) {
      const errMsg = data?.error?.message || `Gemini API error ${geminiResponse.status}`;
      throw new Error(errMsg);
    }
    const text =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      'Sorry, I could not generate a response.';
    return new Response(
      JSON.stringify({ content: [{ type: 'text', text }] }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS(origin),
        },
      }
    );
  } catch (err) {
    console.error('SeWalk AI chat error:', err.message);
    return new Response(
      JSON.stringify({
        content: [{ type: 'text', text: `⚠️ Server error: ${err.message}` }],
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS(origin),
        },
      }
    );
  }
};
