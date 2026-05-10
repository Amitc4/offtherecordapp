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
            content: `You are a professional vinyl record condition grader. You will receive up to 8 high-quality photos of a single vinyl record: 4 quarters of Side A and 4 quarters of Side B. Each quarter photo includes the center label so you can confirm all photos are of the SAME physical record.

First, verify all photos depict the same record (matching center label, color, pressing). If they clearly show different records or the photos are not of a vinyl playing surface, set score to null and explain in the summary.

Otherwise, analyze the combined surface condition across all quarters and grade with a precise DECIMAL SCORE from 0.0 to 10.0 (one decimal place), where:
- 10.0 = absolutely perfect, no flaws whatsoever
- 9.5–9.9 = nearly perfect, only the most minor manufacturing marks
- 9.0–9.4 = excellent, minimal handling marks, no scratches
- 8.0–8.9 = very good, light scuffs/scratches, plays cleanly
- 7.0–7.9 = good, some visible scratches, light surface noise expected
- 5.5–6.9 = okay, moderate scratches/marks, audible noise
- 3.5–5.4 = poor, heavy wear, significant noise
- 0.0–3.4 = damaged: deep scratches, chips, warping

Use the worst-affected area to anchor the score; be honest and accurate.

CRITICAL — IGNORE REFLECTIONS AND LIGHTING ARTIFACTS: Vinyl is a glossy black surface and will almost always show specular highlights, light glare, lamp/window reflections, the photographer's silhouette, rainbow/holographic sheens, and broad bright bands from overhead light. These are NOT defects and MUST NOT affect the grade or appear in defects_per_photo. Distinguish a real defect (a physical mark on the surface) from a reflection by these cues:
- Reflections are bright, soft-edged, often white/blue/rainbow, and follow the curvature of the disc; they shift smoothly across the surface and have no sharp linear edge.
- Real scratches/scuffs are usually thin, sharp-edged lines or hazy patches that follow the groove direction or cut across grooves; they remain visible inside both highlight and shadow zones.
- If you are uncertain whether a mark is a reflection or a real defect, treat it as a reflection and omit it.
Mentally "subtract" the reflections before grading and look for marks that persist in the darker, non-reflective regions of the disc. Grade the underlying surface, not the lighting.

For EACH photo, identify visible imperfections (scratches, scuffs, chips, warps, marks). For each defect, return its location as NORMALIZED coordinates relative to that photo's bounding box (x and y between 0.0 and 1.0, where 0,0 is top-left and 1,1 is bottom-right), plus a small bounding circle radius (0.02–0.15 of image width). Only mark genuinely visible defects — do NOT invent flaws and do NOT mark reflections, glare, or rainbow sheens. If a photo has no visible defects, return an empty array for that photo.

Respond ONLY with valid JSON in this exact format:
{
  "score": 8.7,
  "confidence": 85,
  "summary": "Brief 1-2 sentence summary of condition across both sides",
  "details": {
    "scratches": "none/light/moderate/heavy",
    "scuffs": "none/light/moderate/heavy",
    "warping": "none/slight/moderate/severe",
    "chips": "none/minor/significant",
    "surface_noise_estimate": "none/minimal/moderate/heavy"
  },
  "notes": "Any additional observations, including any difference between Side A and Side B",
  "defects_per_photo": [
    [ { "x": 0.42, "y": 0.31, "radius": 0.05, "type": "scratch", "severity": "light", "description": "Short hairline scratch near outer groove" } ],
    [],
    ...
  ]
}
The "defects_per_photo" array MUST have exactly one entry per provided photo, in the same order as the photos were given.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analyze and grade this vinyl. ${signedUrls.length} photo(s) provided. Confirm all show the same record (center label) before grading.`,
              },
              ...signedUrls.flatMap((url, i) => ([
                { type: "text", text: quarterLabels[i] || `Photo ${i + 1}` },
                { type: "image_url", image_url: { url } },
              ])),
            ],
          },
        ],
        max_tokens: 800,
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
