import { createClient } from "https://esm.sh/@supabase/supabase-js@2.95.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const DISCOGS_CONSUMER_KEY = Deno.env.get("DISCOGS_CONSUMER_KEY")!;
const DISCOGS_CONSUMER_SECRET = Deno.env.get("DISCOGS_CONSUMER_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

async function searchDiscogs(query: string, perPage = 10): Promise<any[]> {
  const resp = await fetch(
    `https://api.discogs.com/database/search?q=${encodeURIComponent(query)}&type=release&per_page=${perPage}&key=${DISCOGS_CONSUMER_KEY}&secret=${DISCOGS_CONSUMER_SECRET}`,
    { headers: { "User-Agent": "OffTheRecordApp/1.0" } }
  );
  const data = await resp.json();
  return (data.results || []).map((r: any) => ({
    id: r.id,
    title: r.title,
    year: parseInt(r.year) || null,
    cover_image: r.cover_image || r.thumb || null,
    format: r.format?.join(", ") || null,
  }));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();

    let imageContent: { type: string; image_url: { url: string } };

    if (body.image_base64 && body.mime_type) {
      const dataUrl = `data:${body.mime_type};base64,${body.image_base64}`;
      imageContent = { type: "image_url", image_url: { url: dataUrl } };
    } else if (body.file_path) {
      const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const adminClient = createClient(SUPABASE_URL, serviceRoleKey);
      const { data: signedData, error: signedError } = await adminClient.storage
        .from("record-photos")
        .createSignedUrl(body.file_path, 300);
      if (signedError || !signedData?.signedUrl) {
        return new Response(JSON.stringify({ error: "Failed to access uploaded photo" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      imageContent = { type: "image_url", image_url: { url: signedData.signedUrl } };
    } else {
      return new Response(JSON.stringify({ error: "image_base64 + mime_type or file_path required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 1: AI identification — ask for multiple guesses ranked by visual confidence
    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: `You are a vinyl record identification expert. Your PRIMARY method is VISUAL recognition of the cover artwork — match the imagery, colors, design, layout, and artistic style to known album covers. Only if you cannot identify it visually, read any visible text (album title, artist name, label).

Respond ONLY with valid JSON in this exact format:
{
  "guesses": [
    {"title": "Album Title", "artist": "Artist Name", "confidence": "high"},
    {"title": "Second Guess", "artist": "Artist Name", "confidence": "medium"}
  ]
}

Rules:
- Return 1-3 guesses, ordered by visual confidence (high, medium, low).
- The first guess should be your best match based on cover art recognition.
- If you cannot identify the record at all, return: {"guesses": [], "error": "Could not identify the record"}
- Do not include any text outside the JSON.`,
          },
          {
            role: "user",
            content: [
              { type: "text", text: "Identify this vinyl record. What is the album title and artist? Prioritize visual cover art matching." },
              imageContent,
            ],
          },
        ],
        max_tokens: 400,
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", errText);
      return new Response(JSON.stringify({ error: "AI identification failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";

    let cleanContent = aiContent.trim();
    if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }

    let parsed: { guesses?: { title: string; artist: string; confidence: string }[]; error?: string };
    try {
      parsed = JSON.parse(cleanContent);
    } catch {
      console.error("Failed to parse AI response:", aiContent);
      return new Response(JSON.stringify({
        error: "Could not identify the record from this photo. Try a clearer photo of the cover art.",
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const guesses = parsed.guesses || [];
    if (guesses.length === 0) {
      return new Response(JSON.stringify({
        error: parsed.error || "Could not identify the record",
        identification: null,
        results: [],
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Step 2: Search Discogs for each guess, prioritizing the highest confidence guess.
    // Deduplicate by Discogs release ID, keeping order (best guesses first).
    const seenIds = new Set<number>();
    const allResults: any[] = [];

    for (const guess of guesses) {
      // Search with artist + title for precision
      const precise = await searchDiscogs(`${guess.artist} ${guess.title}`, 8);
      for (const r of precise) {
        if (!seenIds.has(r.id)) {
          seenIds.add(r.id);
          allResults.push(r);
        }
      }

      // If the precise search returned few results, broaden to just title
      if (precise.length < 3) {
        const broader = await searchDiscogs(guess.title, 5);
        for (const r of broader) {
          if (!seenIds.has(r.id)) {
            seenIds.add(r.id);
            allResults.push(r);
          }
        }
      }
    }

    // Use the top guess as the primary identification shown to the user
    const topGuess = guesses[0];

    return new Response(JSON.stringify({
      identification: { title: topGuess.title, artist: topGuess.artist },
      results: allResults.slice(0, 15),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Identify record error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
