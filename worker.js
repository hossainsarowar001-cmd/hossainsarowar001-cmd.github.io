export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "https://hossainsarowar001-cmd.github.io",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
    }

    try {
      const { question } = await request.json();
      if (!question) {
        return new Response(JSON.stringify({ error: "No question provided" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        return new Response(JSON.stringify({ reply: "Error: GEMINI_API_KEY is missing." }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      // Gemini 3.x Flash series priority list
      const models = [
        "gemini-3.8-flash",
        "gemini-3.7-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite"
      ];

      const promptInstruction = `You are the official in-app community assistant for 'Anima Clip', a 2D animation mobile app by Incrible Studio.
Answer helpfully, naturally, and concisely like a human animator in the community forum.
- Do NOT use markdown symbols like asterisks (**bold** or *italic*). Output clean, regular text.
- If giving steps, use simple numbering (1., 2., 3.).
- Keep the answer direct and under 3-4 steps. No generic welcome or closing boilerplate.

User Question: ${question}`;

      const payload = {
        contents: [
          {
            role: "user",
            parts: [{ text: promptInstruction }]
          }
        ]
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

          const data = await response.json();

          if (data.candidates?.[0]?.content?.parts?.[0]?.text) {
            let cleanText = data.candidates[0].content.parts[0].text;
            // Remove any accidental leftover markdown characters
            cleanText = cleanText
              .replace(/\*\*/g, "")
              .replace(/\*/g, "")
              .replace(/#{1,6}\s?/g, "")
              .trim();

            finalReply = cleanText;
            break;
          }

          if (data.error) {
            lastErrorMessage = data.error.message || JSON.stringify(data.error);
          }
        } catch (err) {
          lastErrorMessage = err.message;
        }
      }

      if (!finalReply) {
        return new Response(JSON.stringify({ 
          reply: "To work with layers, audio, or frames in Anima Clip, open your project canvas and check the corresponding tool icons in the editor menu. If something isn't working as expected, verify your device permissions or restart the app." 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      return new Response(JSON.stringify({ reply: finalReply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ reply: "Worker error: " + err.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
