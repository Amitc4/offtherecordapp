import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const allowedOrigins = [
  "https://offtherecordapp.lovable.app",
  "https://id-preview--cb001185-69e1-4b05-b54d-b8f03a2f28aa.lovable.app",
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": allowedOrigins.includes(origin) ? origin : allowedOrigins[0],
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

Deno.serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  try {
    // Require auth
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    // Accept either single `file_path` (legacy) or `file_paths` (8 quarter shots)
    const filePaths: string[] = Array.isArray(body.file_paths)
      ? body.file_paths
      : (body.file_path ? [body.file_path] : []);

    if (filePaths.length === 0) {
      return new Response(JSON.stringify({ error: "file_paths required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (filePaths.length > 8) {
      return new Response(JSON.stringify({ error: "Maximum 8 photos allowed" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    for (const p of filePaths) {
      if (typeof p !== "string" || !p.startsWith(`${user.id}/`)) {
        return new Response(JSON.stringify({ error: "Access denied" }), {
          status: 403,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
    }

    // Generate signed URLs for each photo
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(SUPABASE_URL, serviceRoleKey);
    const signedUrls: string[] = [];
    for (const p of filePaths) {
      const { data: signedData, error: signedError } = await adminClient.storage
        .from("record-photos")
        .createSignedUrl(p, 300);
      if (signedError || !signedData?.signedUrl) {
        return new Response(JSON.stringify({ error: "Failed to access uploaded photo" }), {
          status: 500,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      signedUrls.push(signedData.signedUrl);
    }

    // Quarter labels for the 8-photo workflow (Side A Q1-Q4, Side B Q1-Q4)
    const quarterLabels = [
      "Side A — Quarter 1 (top-right, including center)",
      "Side A — Quarter 2 (bottom-right, including center)",
      "Side A — Quarter 3 (bottom-left, including center)",
      "Side A — Quarter 4 (top-left, including center)",
      "Side B — Quarter 1 (top-right, including center)",
      "Side B — Quarter 2 (bottom-right, including center)",
      "Side B — Quarter 3 (bottom-left, including center)",
      "Side B — Quarter 4 (top-left, including center)",
    ];

    // Ask AI to grade the vinyl condition
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a professional vinyl record condition grader. Analyze the photo of a vinyl record's playing surface and assess its physical condition.

Grade using this scale:
- GEM (Gem Mint): Absolutely perfect, no flaws whatsoever
- M (Mint): Near perfect, may have very minor manufacturing marks
- NM (Near Mint): Nearly perfect, minimal signs of handling, no scratches
- G (Good): Light scratches or scuffs visible but would play with minimal noise
- OK (Okay): Moderate scratches, surface marks, some audible noise expected
- F (Damaged): Heavy scratches, chips, warping, or other significant damage

Respond ONLY with valid JSON in this exact format:
{
  "grade": "NM",
  "grade_label": "Near Mint",
  "confidence": 85,
  "summary": "Brief 1-2 sentence summary of condition",
  "details": {
    "scratches": "none/light/moderate/heavy",
    "scuffs": "none/light/moderate/heavy",
    "warping": "none/slight/moderate/severe",
    "chips": "none/minor/significant",
    "surface_noise_estimate": "none/minimal/moderate/heavy"
  },
  "notes": "Any additional observations about the vinyl's condition"
}

Be honest and accurate. If the photo doesn't clearly show a vinyl record surface, set grade to null and explain in the summary.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Analyze and grade the condition of this vinyl record based on visible scratches, chips, scuffs, warping, and overall surface condition.",
              },
              {
                type: "image_url",
                image_url: { url: image_url },
              },
            ],
          },
        ],
        max_tokens: 500,
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", errText);

      if (aiResponse.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (aiResponse.status === 402) {
        return new Response(JSON.stringify({ error: "AI service unavailable. Please try again later." }), {
          status: 402,
          headers: { ...cors, "Content-Type": "application/json" },
        });
      }

      return new Response(JSON.stringify({ error: "AI grading failed" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    // Parse AI response
    let cleanContent = aiContent.trim();
    if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }

    let grading;
    try {
      grading = JSON.parse(cleanContent);
    } catch {
      console.error("Failed to parse AI grading response:", aiContent);
      return new Response(JSON.stringify({
        error: "Could not grade the record from this photo. Make sure you're photographing the vinyl surface clearly.",
      }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ grading }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Grade vinyl error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
