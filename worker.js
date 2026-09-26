// Dynamic origin checking to support your updated domain (incriblestudio.github.io)
function getCorsHeaders(request) {
  const origin = request.headers.get("Origin") || "";
  const allowedOrigins = [
    "https://incriblestudio.github.io",
    "https://hossainsarowar001-cmd.github.io",
    "https://01-cmd.github.io"
  ];

  const allowOrigin = allowedOrigins.includes(origin) || origin.endsWith(".github.io") 
    ? origin 
    : "https://incriblestudio.github.io";

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export default {
  async fetch(request, env) {
    const corsHeaders = getCorsHeaders(request);

    // 1. Handle CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), { 
        status: 405, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      });
    }

    try {
      const body = await request.json();
      const question = body?.question?.trim();

      if (!question) {
        return new Response(JSON.stringify({ error: "No question provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        return new Response(JSON.stringify({ reply: "Error: GEMINI_API_KEY is missing in Cloudflare settings." }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Priority list of Gemini Flash models
      const models = [
        "gemini-3.8-flash",
        "gemini-3.7-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite",
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash"
      ];

      const promptText = `You are the official in-app community assistant named 'Anima Clip Bot' for 'Anima Clip', a 2D animation mobile app by Incrible Studio.
Answer helpfully, naturally, and concisely like a human animator in the community forum.
- Do NOT use markdown symbols like asterisks (**bold** or *italic*). Output clean, regular text.
- If giving steps, use simple numbering (1., 2., 3.).
- Keep the answer direct and under 3-4 steps. No generic welcome or closing boilerplate.
- Finish all thoughts and sentences completely.

User Question: ${question}
Assistant:`;

      const payload = {
        contents: [
          {
            role: "user",
            parts: [{ text: promptText }]
          }
        ],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 1000
        }
      };

      let finalReply = null;
      let lastErrorMessage = "";

      for (const model of models) {
        try {
          const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
          const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const errData = await response.text();
            lastErrorMessage = `Model ${model} returned status ${response.status}: ${errData}`;
            continue;
          }

          const data = await response.json();
          let rawOutput = data.candidates?.[0]?.content?.parts?.[0]?.text;

          if (rawOutput) {
            // Strip markdown asterisks, hashes, and unwanted leading colons/dashes
            finalReply = rawOutput
              .replace(/\*\*/g, "")
              .replace(/\*/g, "")
              .replace(/#{1,6}\s?/g, "")
              .replace(/^[:\s-]+/, "")
              .trim();
            break;
          }

          if (data.error) {
            lastErrorMessage = data.error.message || JSON.stringify(data.error);
          }
        } catch (err) {
          lastErrorMessage = err.message;
        }
      }

      // Resilient fallback if upstream models are temporarily busy
      if (!finalReply) {
        finalReply = "To work with layers, audio, or frames in Anima Clip, open your canvas and tap the tool icons in the bottom menu. If you experience an issue, make sure app permissions for storage are enabled.";
      }

      return new Response(JSON.stringify({ reply: finalReply }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ error: "Worker internal failure: " + err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
