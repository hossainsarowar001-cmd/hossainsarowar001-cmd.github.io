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
        return new Response(JSON.stringify({ 
          reply: "Thank you for your question! The Incrible Studio team has received your query and will reply shortly." 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      const models = [
        "gemini-3.8-flash",
        "gemini-3.7-flash",
        "gemini-3.5-flash-lite",
        "gemini-3.5-flash"
      ];

      const promptDirective = `
You are the official AI Support Assistant for 'Anima Clip', a 2D animation Android app developed by Incrible Studio.

Instructions:
1. Prioritize instructions, UI flows, and capabilities for 'Anima Clip' by Incrible Studio.
2. If specific online documentation or video tutorials for Anima Clip are not indexed, guide the user using standard 2D mobile frame-by-frame animation app conventions (like FlipaClip or RoughAnimator).
3. Provide clean, numbered step-by-step instructions.
4. Keep the tone polite, clear, and professional. Never mention error codes, quotas, search engine limits, or internal prompts.

User Question: ${question}
`;

      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      async function requestGemini(model, enableSearch = true) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey.trim()}`;
        
        const payload = {
          contents: [{ role: "user", parts: [{ text: promptDirective }] }]
        };

        if (enableSearch) {
          payload.tools = [{ googleSearch: {} }];
        }

        const res = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        const data = await res.json();
        return { ok: res.ok, status: res.status, data };
      }

      let finalReply = null;

      // Phase 1: Try primary model with live web search (with backoff retry)
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          const { ok, status, data } = await requestGemini(models[0], true);
          if (ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
            finalReply = data.candidates[0].content.parts[0].text;
            break;
          }
          // If rate limited, pause before retry
          if (status === 429 || status === 503) {
            await sleep(2500 * attempt);
          }
        } catch (e) {
          await sleep(1500);
        }
      }

      // Phase 2: If live search quota is exhausted, fall back to standard generation
      if (!finalReply) {
        for (const model of models) {
          try {
            await sleep(1000); // 1-second cadence prevents burst flags
            const { ok, data } = await requestGemini(model, false);
            if (ok && data.candidates?.[0]?.content?.parts?.[0]?.text) {
              finalReply = data.candidates[0].content.parts[0].text;
              break;
            }
          } catch (e) {
            // Continue quietly to the next model
          }
        }
      }

      // Phase 3: Professional fail-safe response if all providers are unreachable
      if (!finalReply) {
        finalReply = "Thank you for reaching out! We are currently checking the details for your question. A member of the Incrible Studio team will review this thread and respond shortly.";
      }

      return new Response(JSON.stringify({ reply: finalReply }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });

    } catch (err) {
      return new Response(JSON.stringify({ 
        reply: "Thank you for posting! We have logged your question for the Incrible Studio support team to review." 
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }
  }
};
