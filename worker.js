/**
 * Anima Clip Assistant - Cloudflare Worker Proxy
 * Features: Web grounding fallback, natural community tone, plain text numbering (no asterisks).
 */

const ALLOWED_ORIGIN = "https://hossainsarowar001-cmd.github.io";

const SYSTEM_INSTRUCTION = `
You are the official in-app community assistant for "Anima Clip" (developed by Incrible Studio).
You are writing a helpful answer directly on a public community thread, NOT drafting a robotic technical manual or corporate email.

STRICT TONE & FORMATTING RULES:
1. NO generic greetings: Never say "Hello! Welcome to Anima Clip support by Incrible Studio..." or similar fluff. Start directly with the answer.
2. NO MARKDOWN ASTERISKS: Never use asterisks for bolding or italics (Do NOT write "**Step 1:**" or "**Layers**"). Output clean, regular text.
3. STRUCTURE: If a step-by-step procedure is needed, use clear numbered lines without asterisks:
   1. Open Project: Launch Anima Clip and open your project canvas.
   2. Layers Panel: Tap the Layers icon in the corner.
   3. Import Image: Choose your image from your gallery.
4. BREVITY: Keep answers concise (under 4-5 numbered points or 1-2 short paragraphs).
5. NO robotic sign-offs: Omit boilerplate phrases like "Happy animating!" or "Let me know if you need anything else!". Wrap up naturally.
6. DOMAIN FOCUS: Prioritize Anima Clip features, workflows, frame manipulation, and 2D animation practices.
`;

export default {
  async fetch(request, env) {
    // 1. Handle CORS Preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        headers: {
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
          "Access-Control-Max-Age": "86400",
        },
      });
    }

    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method not allowed" }), {
        status: 405,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        },
      });
    }

    try {
      const { question } = await request.json();
      if (!question || typeof question !== "string" || question.trim().length === 0) {
        return new Response(JSON.stringify({ error: "Missing valid question string" }), {
          status: 400,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          },
        });
      }

      const apiKey = env.GEMINI_API_KEY;
      if (!apiKey) {
        return new Response(JSON.stringify({ error: "API key unconfigured on server" }), {
          status: 500,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          },
        });
      }

      // Models list with fallback support
      const models = [
        "gemini-2.5-flash",
        "gemini-2.0-flash",
        "gemini-1.5-flash"
      ];

      let lastError = null;

      for (const model of models) {
        try {
          const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

          const payload = {
            system_instruction: {
              parts: [{ text: SYSTEM_INSTRUCTION }]
            },
            contents: [
              {
                role: "user",
                parts: [{ text: `Question regarding Anima Clip: ${question}` }]
              }
            ],
            tools: [
              {
                google_search: {} // Live search grounding
              }
            ],
            generationConfig: {
              temperature: 0.5,
              maxOutputTokens: 350
            }
          };

          const response = await fetch(endpoint, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
          });

          if (!response.ok) {
            const errBody = await response.text();
            lastError = `Model ${model} failed (${response.status}): ${errBody}`;
            continue; // Cycle to next fallback model
          }

          const data = await response.json();
          let replyText = data.candidates?.[0]?.content?.parts?.[0]?.text;

          if (replyText) {
            // Safety sanitization: remove any accidental remaining asterisks or markdown headings
            replyText = replyText
              .replace(/\*\*(.*?)\*\*/g, "$1")
              .replace(/\*(.*?)\*/g, "$1")
              .replace(/#{1,6}\s?/g, "")
              .trim();

            return new Response(JSON.stringify({ reply: replyText }), {
              status: 200,
              headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
              },
            });
          }
        } catch (err) {
          lastError = err.message;
        }
      }

      // Fallback if all models hit rate-limit or temporary outage
      return new Response(
        JSON.stringify({
          reply: "To import or manage elements in Anima Clip, open your project, tap the Layers icon, and select your action from the tools menu. If you run into issues, try re-saving your project file or check that your media permissions are enabled."
        }),
        {
          status: 200,
          headers: {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
          },
        }
      );

    } catch (globalErr) {
      return new Response(JSON.stringify({ error: globalErr.message }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
        },
      });
    }
  }
};
