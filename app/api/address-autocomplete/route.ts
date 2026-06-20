import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/routemate/crypto";

type PlaceSuggestion = {
  placePrediction?: {
    place?: string;
    placeId?: string;
    text?: {
      text?: string;
    };
    structuredFormat?: {
      mainText?: { text?: string };
      secondaryText?: { text?: string };
    };
  };
};

export async function POST(request: Request) {
  const { input } = (await request.json()) as { input?: string };
  const trimmed = input?.trim() ?? "";

  if (trimmed.length < 3) {
    return NextResponse.json({ ok: true, suggestions: [] });
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { ok: false, message: "Sign in before searching addresses." },
      { status: 401 },
    );
  }

  const { data, error } = await supabase
    .from("routemate_user_settings")
    .select("google_maps_api_key_encrypted, google_maps_connected")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !data?.google_maps_connected || !data.google_maps_api_key_encrypted) {
    return NextResponse.json(
      { ok: false, message: "Connect Google Maps before searching addresses." },
      { status: 404 },
    );
  }

  const response = await fetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": decryptSecret(data.google_maps_api_key_encrypted),
      "X-Goog-FieldMask":
        "suggestions.placePrediction.placeId,suggestions.placePrediction.text,suggestions.placePrediction.structuredFormat",
    },
    body: JSON.stringify({
      includedRegionCodes: ["us"],
      input: trimmed,
    }),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message =
      payload?.error?.message ??
      "Google Places could not return address suggestions. Enable Places API for this key.";
    return NextResponse.json({ ok: false, message }, { status: 400 });
  }

  const suggestions = ((payload.suggestions ?? []) as PlaceSuggestion[])
    .map((suggestion) => suggestion.placePrediction)
    .filter(Boolean)
    .map((prediction) => ({
      description: prediction?.text?.text ?? "",
      mainText: prediction?.structuredFormat?.mainText?.text ?? prediction?.text?.text ?? "",
      secondaryText: prediction?.structuredFormat?.secondaryText?.text ?? "",
      placeId: prediction?.placeId ?? prediction?.place ?? "",
    }))
    .filter((suggestion) => suggestion.description);

  return NextResponse.json({ ok: true, suggestions });
}
