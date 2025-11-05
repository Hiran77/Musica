import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const REPLICATE_API_KEY = Deno.env.get("REPLICATE_API_KEY");
    if (!REPLICATE_API_KEY) {
      throw new Error("REPLICATE_API_KEY is not configured");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      {
        global: {
          headers: { Authorization: req.headers.get("Authorization")! },
        },
      }
    );

    const {
      data: { user },
    } = await supabaseClient.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { audio, filename, splitType, instrument } = await req.json();

    if (!audio || !filename) {
      return new Response(
        JSON.stringify({ error: "Missing required fields: audio and filename" }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log(`Processing audio split for user ${user.id}, type: ${splitType}`);

    // Create audio splits record
    const { data: splitRecord, error: insertError } = await supabaseClient
      .from("audio_splits")
      .insert({
        user_id: user.id,
        original_filename: filename,
        split_type: splitType,
        status: "processing",
      })
      .select()
      .single();

    if (insertError) {
      console.error("Error creating split record:", insertError);
      throw insertError;
    }

    // Determine the Replicate model based on split type
    let model = "adefossez/htdemucs:9e5da03ab38d79e8e50b65f5a7a1c2e80d4e1a0f";
    let inputConfig: any = {
      audio: `data:audio/wav;base64,${audio}`,
    };

    if (splitType === "two-stems") {
      inputConfig.stem = "vocals";
    } else if (splitType === "four-stems") {
      inputConfig.stem = "all";
    } else if (splitType === "instrument" && instrument) {
      inputConfig.stem = instrument;
    }

    // Call Replicate API
    const response = await fetch("https://api.replicate.com/v1/predictions", {
      method: "POST",
      headers: {
        Authorization: `Token ${REPLICATE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        version: "9e5da03ab38d79e8e50b65f5a7a1c2e80d4e1a0f",
        input: inputConfig,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Replicate API error:", response.status, errorText);
      throw new Error(`Replicate API error: ${response.status}`);
    }

    const prediction = await response.json();
    console.log("Replicate prediction started:", prediction.id);

    // Update record with prediction ID
    const { error: updateError } = await supabaseClient
      .from("audio_splits")
      .update({
        status: "processing",
        result_urls: { prediction_id: prediction.id },
      })
      .eq("id", splitRecord.id);

    if (updateError) {
      console.error("Error updating split record:", updateError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        splitId: splitRecord.id,
        predictionId: prediction.id,
        status: prediction.status,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in split-audio function:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
