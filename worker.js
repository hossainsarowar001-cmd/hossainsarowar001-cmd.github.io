export default {
  async fetch(request, env) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
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

      const models = [
        "gemini-3.8-flash",
        "gemini-3.7-flash",
        "gemini-3.6-flash",
        "gemini-3.5-flash",
        "gemini-3.5-flash-lite"
      ];

      const promptDirective = `
You are the official AI Support Assistant for 'Anima Clip', a 2D animation Android mobile app created by Incrible Studio.

Your Search & Answering Procedure:
1. Search across Google, YouTube tutorials, Google Play Store listings, community forums, and social posts for information specifically regarding:
   - "Anima Clip" animation app
   - "Incrible Studio"
   - Features, how-tos, video imports, frame rates, export formats, or fixes for Anima Clip.
2. If YouTube tutorials, demo videos, or online documentation mention Anima Clip, extract and prioritize that exact process for the user's question.
3. If specific Anima Clip data is unavailable or not yet published online:
   - Search how top 2D animation tools (such as FlipaClip, RoughAnimator, Pencil2D, or standard Android frame-by-frame animation software) handle this exact task.
   - Provide a practical, accurate walkthrough tailored to standard 2D mobile animation workflows.
4. Formatting requirements:
   - Provide clear, numbered step-by-step instructions where applicable.
   - Maintain a helpful, polite tone.
   - Do NOT say "I searched YouTube" or "Based on my Google search"—present the guidance directly as the app assistant.

User Question: ${question}
`;

      const payload = {
        contents: [
          {
            role: "user",
            parts: [{ text: promptDirective }]
          }
        ],
        tools: [
          {
            googleSearch: {}
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
            finalReply = data.candidates[0].content.parts[0].text;
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
        return new Response(JSON.stringify({ reply: `All models busy. Last error: ${lastErrorMessage}` }), {
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
