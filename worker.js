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

      const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.8-flash:generateContent?key=${apiKey.trim()}`;

      const payload = {
        contents: [
          {
            role: "user",
            parts: [{ text: `You are the helpful AI support assistant for 'Anima Clip', a 2D animation mobile app by Incrible Studio. Answer helpfully and concisely.\n\nUser Question: ${question}` }]
          }
        ]
      };

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await response.json();

      if (data.error) {
        return new Response(JSON.stringify({ reply: `API Error: ${data.error.message}` }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const reply = data.candidates?.[0]?.content?.parts?.[0]?.text || "No response text was generated.";

      return new Response(JSON.stringify({ reply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    } catch (err) {
      return new Response(JSON.stringify({ reply: "Worker error: " + err.message }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
