/**
 * @file grade-vinyl edge function — AI-powered record condition grading.
 *
 * Accepts one or more photos of a vinyl record (cover and/or disc surface)
 * from an authenticated user and sends them to Google Gemini 2.5 Flash via
 * the Lovable AI Gateway. The model inspects the images for scratches,
 * scuffs, ring-wear, seam splits, and other visible defects, then returns
 * a structured grade on the project's condition scale (GEM / M / NM / G /
 * OK / F) together with a short rationale. Results are persisted to the
 * `grading_history` table for the user's records.
 *
 * Images are sent inline as base64 data-URLs and are never stored by this
 * function — only the resulting grade and notes are kept.
 */
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

    // ============================================================
    // DUAL-PASS GRADING
    // Pass 1 (balanced): Gemini 2.5 Pro — primary grader, reflection-aware.
    // Pass 2 (harsh inspector): GPT-5 — adversarial QC, assumes flaws exist.
    // We then reconcile: take the LOWER (harsher) score, union defects.
    // ============================================================

    const balancedSystemPrompt = `You are a professional vinyl record condition grader. You will receive up to 8 high-quality photos of a single vinyl record: 4 quarters of Side A and 4 quarters of Side B. Each quarter photo includes the center label so you can confirm all photos are of the SAME physical record.

First, verify all photos depict the same record (matching center label, color, pressing). If they clearly show different records or the photos are not of a vinyl playing surface, set score to null and explain in the summary.

If you cannot grade because one or more specific photos are unusable (blurry, too dark, severe glare covering most of the surface, wrong subject, missing center label, finger covering the disc, or duplicates of another quarter), list those photo indices (0-based, in the order provided) in "bad_photo_indices" so the user can retake them. If grading succeeds normally, return an empty array for "bad_photo_indices". If you must set score to null because photos are unusable, "bad_photo_indices" MUST list every problematic photo.

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

REFLECTIONS vs REAL DEFECTS — be balanced. Vinyl is glossy and shows specular highlights, lamp/window reflections, and rainbow sheens that follow the disc curvature. These are NOT defects. But do NOT overcorrect: real scratches/scuffs are common and MUST be reported.
- Reflections: bright, soft-edged, follow curvature, shift with lighting, no sharp linear edge.
- Real scratches: thin, sharp-edged lines (radial or circumferential) visible in BOTH highlights and shadows, often appearing in the same spot across angles.

For EACH photo, identify visible imperfections. For each defect, return its location as NORMALIZED coordinates (x,y in 0..1, top-left origin), plus radius (0.02–0.15). If a photo has no defects, return an empty array for that photo.

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
  "bad_photo_indices": [],
  "defects_per_photo": [
    [ { "x": 0.42, "y": 0.31, "radius": 0.05, "type": "scratch", "severity": "light", "description": "Short hairline scratch near outer groove" } ],
    []
  ]
}
The "defects_per_photo" array MUST have exactly one entry per provided photo. "bad_photo_indices" MUST be an array.`;

    const harshSystemPrompt = `You are a HARSH, adversarial vinyl record QC inspector working on behalf of a buyer. Your job is to find every single imperfection a seller might be hiding. Assume the record HAS flaws until proven otherwise. You will receive up to 8 photos: 4 quarters of Side A and 4 quarters of Side B.

Your bias: when uncertain whether a mark is a reflection or a real scratch, lean toward CALLING IT A DEFECT. It is far worse to miss a scratch than to over-report one. Examine grooves carefully for hairlines, spider-web scuffs, fingerprint smudges, pressing flaws, edge wear, label damage, and any haziness that dulls the gloss.

Use this STRICTER scoring scale (be tougher than a typical grader):
- 10.0 = literally flawless, sealed-grade
- 9.0–9.9 = near mint, only the faintest manufacturing marks
- 8.0–8.9 = very good, clearly visible light scuffs
- 7.0–7.9 = good, multiple visible scratches/scuffs
- 5.5–6.9 = okay, moderate to heavy wear
- 3.5–5.4 = poor
- 0.0–3.4 = damaged

Anchor your score to the WORST quarter. Round DOWN when between two grades.

If photos are unusable (blurry, dark, heavy glare, wrong subject), set score to null and list the bad indices in "bad_photo_indices".

For EACH photo, mark every flaw you can see with normalized coords (x,y 0..1, radius 0.02–0.15). Be exhaustive.

Respond ONLY with valid JSON in this format:
{
  "score": 7.5,
  "confidence": 80,
  "summary": "Harsh QC summary",
  "details": {
    "scratches": "none/light/moderate/heavy",
    "scuffs": "none/light/moderate/heavy",
    "warping": "none/slight/moderate/severe",
    "chips": "none/minor/significant",
    "surface_noise_estimate": "none/minimal/moderate/heavy"
  },
  "notes": "Specific concerns a buyer should know about",
  "bad_photo_indices": [],
  "defects_per_photo": [ [], [] ]
}
"defects_per_photo" MUST have exactly one entry per provided photo.`;

    const userContent = [
      {
        type: "text",
        text: `Analyze and grade this vinyl. ${signedUrls.length} photo(s) provided. Confirm all show the same record (center label) before grading.`,
      },
      ...signedUrls.flatMap((url, i) => ([
        { type: "text", text: quarterLabels[i] || `Photo ${i + 1}` },
        { type: "image_url", image_url: { url } },
      ])),
    ];

    async function callGrader(model: string, systemPrompt: string) {
      const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userContent },
          ],
          max_tokens: 4000,
          temperature: 0.1,
        }),
      });
      return resp;
    }

    // Run both graders in parallel
    const [balancedResp, harshResp] = await Promise.all([
      callGrader("google/gemini-2.5-pro", balancedSystemPrompt),
      callGrader("openai/gpt-5", harshSystemPrompt),
    ]);

    // If the primary balanced grader fails hard, surface the error.
    if (!balancedResp.ok) {
      const errText = await balancedResp.text();
      console.error("Balanced grader error:", errText);

      if (balancedResp.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      if (balancedResp.status === 402) {
        return new Response(JSON.stringify({ error: "AI service unavailable. Please try again later." }), {
          status: 402, headers: { ...cors, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI grading failed" }), {
        status: 500, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    function parseGrading(content: string): any | null {
      let clean = content.trim();
      if (clean.startsWith("```")) {
        clean = clean.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
      }
      try { return JSON.parse(clean); } catch { return null; }
    }

    const balancedData = await balancedResp.json();
    const balanced = parseGrading(balancedData.choices?.[0]?.message?.content || "");

    if (!balanced) {
      console.error("Failed to parse balanced grading response");
      return new Response(JSON.stringify({
        error: "Could not grade the record from these photos. Please retake the highlighted photos with clearer focus and lighting.",
        bad_photo_indices: filePaths.map((_, i) => i),
      }), {
        status: 200, headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    let harsh: any | null = null;
    if (harshResp.ok) {
      const harshData = await harshResp.json();
      harsh = parseGrading(harshData.choices?.[0]?.message?.content || "");
    } else {
      console.warn("Harsh grader unavailable, falling back to balanced only:", harshResp.status);
    }

    // Normalize bad_photo_indices for a grading object
    function normalizeBadIndices(g: any) {
      if (!Array.isArray(g.bad_photo_indices)) g.bad_photo_indices = [];
      g.bad_photo_indices = g.bad_photo_indices
        .filter((n: unknown) => typeof n === "number" && n >= 0 && n < filePaths.length)
        .map((n: number) => Math.floor(n));
      if (g.score === null && g.bad_photo_indices.length === 0) {
        g.bad_photo_indices = filePaths.map((_, i) => i);
      }
    }
    normalizeBadIndices(balanced);
    if (harsh) normalizeBadIndices(harsh);

    // ============================================================
    // RECONCILE — favor harsher result for honest grading
    // ============================================================
    const sevRank: Record<string, number> = {
      none: 0, minimal: 0, slight: 0, minor: 0,
      light: 1,
      moderate: 2,
      heavy: 3, severe: 3, significant: 3,
    };
    function harsherSeverity(a: string, b: string): string {
      const ra = sevRank[a?.toLowerCase()] ?? 0;
      const rb = sevRank[b?.toLowerCase()] ?? 0;
      return ra >= rb ? a : b;
    }

    let grading: any;
    if (harsh && typeof harsh.score === "number" && typeof balanced.score === "number") {
      // Weighted blend favoring the harsher pass (60% harsh, 40% balanced),
      // and never above the harsher score.
      const blended = Math.min(
        harsh.score,
        Math.round((harsh.score * 0.6 + balanced.score * 0.4) * 10) / 10
      );

      // Union defects per photo
      const photoCount = filePaths.length;
      const balDefects = Array.isArray(balanced.defects_per_photo) ? balanced.defects_per_photo : [];
      const harshDefects = Array.isArray(harsh.defects_per_photo) ? harsh.defects_per_photo : [];
      const merged: any[][] = [];
      for (let i = 0; i < photoCount; i++) {
        merged.push([...(balDefects[i] || []), ...(harshDefects[i] || [])]);
      }

      // Merge details (take harsher severity per category)
      const details: any = {};
      const keys = ["scratches", "scuffs", "warping", "chips", "surface_noise_estimate"];
      for (const k of keys) {
        details[k] = harsherSeverity(balanced.details?.[k] ?? "none", harsh.details?.[k] ?? "none");
      }

      // Union bad photo indices
      const badSet = new Set<number>([...balanced.bad_photo_indices, ...harsh.bad_photo_indices]);

      grading = {
        score: blended,
        confidence: Math.round(((balanced.confidence ?? 70) + (harsh.confidence ?? 70)) / 2),
        summary: balanced.summary,
        details,
        notes: [balanced.notes, harsh.notes ? `Strict inspector: ${harsh.notes}` : null]
          .filter(Boolean).join(" "),
        bad_photo_indices: Array.from(badSet).sort((a, b) => a - b),
        defects_per_photo: merged,
        passes: {
          balanced: { score: balanced.score, confidence: balanced.confidence },
          harsh: { score: harsh.score, confidence: harsh.confidence },
        },
      };
    } else {
      grading = balanced;
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
