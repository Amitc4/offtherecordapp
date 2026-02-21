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
const DISCOGS_CONSUMER_KEY = Deno.env.get("DISCOGS_CONSUMER_KEY")!;
const DISCOGS_CONSUMER_SECRET = Deno.env.get("DISCOGS_CONSUMER_SECRET")!;
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

    // Verify user
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

    const { file_path } = await req.json();
    if (!file_path || typeof file_path !== "string") {
      return new Response(JSON.stringify({ error: "file_path required" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Generate a short-lived signed URL for the uploaded file
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const adminClient = createClient(SUPABASE_URL, serviceRoleKey);
    const { data: signedData, error: signedError } = await adminClient.storage
      .from("record-photos")
      .createSignedUrl(file_path, 300); // 5 minute expiry

    if (signedError || !signedData?.signedUrl) {
      return new Response(JSON.stringify({ error: "Failed to access uploaded photo" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const image_url = signedData.signedUrl;

    // Step 1: Ask AI to identify the vinyl record from the photo
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
            content: `You are a vinyl record identification expert. Your primary method is VISUAL recognition of the cover artwork itself — match the imagery, colors, design, and artistic style to known album covers before resorting to reading any text on the cover or label. First, try to recognize the album by its iconic cover art. Only if you cannot identify it visually, then read any visible text (album title, artist name, label info) to make your identification. Respond ONLY with valid JSON in this exact format: {"title": "Album Title", "artist": "Artist Name"}. If you cannot identify the record, respond with: {"title": "", "artist": "", "error": "Could not identify the record"}. Do not include any other text.`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Identify this vinyl record. What is the album title and artist?",
              },
              {
                type: "image_url",
                image_url: { url: image_url },
              },
            ],
          },
        ],
        max_tokens: 200,
        temperature: 0.1,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI gateway error:", errText);
      return new Response(JSON.stringify({ error: "AI identification failed" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const aiContent = aiData.choices?.[0]?.message?.content || "";
    
    // Parse AI response - handle markdown code blocks
    let cleanContent = aiContent.trim();
    if (cleanContent.startsWith("```")) {
      cleanContent = cleanContent.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
    }
    
    let identification: { title: string; artist: string; error?: string };
    try {
      identification = JSON.parse(cleanContent);
    } catch {
      console.error("Failed to parse AI response:", aiContent);
      return new Response(JSON.stringify({ 
        error: "Could not identify the record from this photo. Try a clearer photo of the cover art.",
        ai_raw: aiContent,
      }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    if (identification.error || (!identification.title && !identification.artist)) {
      return new Response(JSON.stringify({
        error: identification.error || "Could not identify the record",
        identification,
        results: [],
      }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    // Step 2: Search Discogs with the identified info
    const searchQuery = `${identification.artist} ${identification.title}`.trim();
    const discogsResp = await fetch(
      `https://api.discogs.com/database/search?q=${encodeURIComponent(searchQuery)}&type=release&per_page=10&key=${DISCOGS_CONSUMER_KEY}&secret=${DISCOGS_CONSUMER_SECRET}`,
      { headers: { "User-Agent": "OffTheRecordApp/1.0" } }
    );
    const discogsData = await discogsResp.json();
    const results = (discogsData.results || []).map((r: any) => ({
      id: r.id,
      title: r.title,
      year: parseInt(r.year) || null,
      cover_image: r.cover_image || r.thumb || null,
      format: r.format?.join(", ") || null,
    }));

    return new Response(JSON.stringify({
      identification,
      results,
    }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Identify record error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
