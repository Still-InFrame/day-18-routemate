import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { decryptSecret } from "@/lib/routemate/crypto";

type GeocodeResult = {
  formatted_address?: string;
  geometry?: {
    location?: { lat: number; lng: number };
    location_type?: string;
  };
  place_id?: string;
  types?: string[];
};

export async function POST(request: Request) {
  const { address } = (await request.json()) as { address?: string };
  const trimmed = address?.trim() ?? "";

  if (trimmed.length < 6) {
    return NextResponse.json(
      { ok: false, message: "Enter a more complete address." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.json(
      { ok: false, message: "Sign in before verifying addresses." },
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
      { ok: false, message: "Connect Google Maps before verifying addresses." },
      { status: 404 },
    );
  }

  const url = new URL("https://maps.googleapis.com/maps/api/geocode/json");
  url.searchParams.set("address", trimmed);
  url.searchParams.set("region", "us");
  url.searchParams.set("key", decryptSecret(data.google_maps_api_key_encrypted));

  const response = await fetch(url);
  const payload = await response.json();

  if (!response.ok || payload.status !== "OK") {
    const message =
      payload.error_message ??
      (payload.status === "ZERO_RESULTS"
        ? "Google could not find that address."
        : `Google returned ${payload.status ?? "an error"}.`);
    const hint =
      message.includes("not authorized") || message.includes("API keys")
        ? " Enable Geocoding API and allow this key to use it."
        : "";

    return NextResponse.json(
      { ok: false, message: `${message}${hint}` },
      { status: 400 },
    );
  }

  const result = payload.results?.[0] as GeocodeResult | undefined;
  if (!result?.formatted_address || !result.geometry?.location) {
    return NextResponse.json(
      { ok: false, message: "Google did not return a usable address match." },
      { status: 400 },
    );
  }

  const locationType = result.geometry.location_type ?? "APPROXIMATE";
  const confidence =
    locationType === "ROOFTOP"
      ? "high"
      : locationType === "RANGE_INTERPOLATED"
        ? "medium"
        : "low";

  return NextResponse.json({
    ok: true,
    confidence,
    formattedAddress: result.formatted_address,
    lat: result.geometry.location.lat,
    lng: result.geometry.location.lng,
    locationType,
    placeId: result.place_id ?? null,
  });
}
