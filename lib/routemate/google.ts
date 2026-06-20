import "server-only";
import type { RouteMetrics, TravelMode } from "./types";

const ROUTES_ENDPOINT = "https://routes.googleapis.com/directions/v2:computeRoutes";

function googleTravelMode(mode: TravelMode) {
  return mode === "walking" ? "WALK" : "DRIVE";
}

function durationToSeconds(duration: string | undefined) {
  if (!duration) return 0;
  return Number.parseInt(duration.replace("s", ""), 10) || 0;
}

function buildRouteRequest(points: string[], mode: TravelMode, optimize: boolean, departureTime?: string | null) {
  const [origin, ...rest] = points;
  const destination = rest.at(-1);
  const intermediates = rest.slice(0, -1);

  const request: Record<string, unknown> = {
    origin: { address: origin },
    destination: { address: destination },
    intermediates: intermediates.map((address) => ({ address })),
    languageCode: "en-US",
    regionCode: "US",
    travelMode: googleTravelMode(mode),
    optimizeWaypointOrder: optimize && intermediates.length > 1,
  };

  if (mode === "driving") {
    request.routingPreference = "TRAFFIC_AWARE_OPTIMAL";
    request.trafficModel = "BEST_GUESS";
    if (departureTime) request.departureTime = departureTime;
  }

  return request;
}

export async function computeRouteMetrics(
  apiKey: string,
  points: string[],
  mode: TravelMode,
  optimize: boolean,
  departureTime?: string | null,
): Promise<RouteMetrics> {
  if (points.length < 2) {
    return {
      distanceMeters: 0,
      durationSeconds: 0,
      optimizedIntermediateIndexes: [],
      encodedPolyline: null,
    };
  }

  const response = await fetch(ROUTES_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask":
        "routes.distanceMeters,routes.duration,routes.polyline.encodedPolyline,routes.optimizedIntermediateWaypointIndex",
    },
    body: JSON.stringify(buildRouteRequest(points, mode, optimize, departureTime)),
  });

  const payload = await response.json();

  if (!response.ok) {
    const message = payload?.error?.message ?? "Google Routes API rejected the request.";
    const details = Array.isArray(payload?.error?.details)
      ? payload.error.details
          .map((detail: { reason?: string; message?: string }) => detail.reason ?? detail.message)
          .filter(Boolean)
          .join(", ")
      : "";
    const hint = message.includes("API has not been used") || message.includes("disabled")
      ? " Enable Routes API for this Google Cloud project."
      : message.includes("API key") || message.includes("permission")
        ? " Check that the key is allowed to use Routes API."
        : "";
    throw new Error(`${message}${details ? ` (${details})` : ""}${hint}`);
  }

  const route = payload?.routes?.[0];
  if (!route) {
    throw new Error("Google did not return a route for those addresses.");
  }

  return {
    distanceMeters: route.distanceMeters ?? 0,
    durationSeconds: durationToSeconds(route.duration),
    optimizedIntermediateIndexes: route.optimizedIntermediateWaypointIndex ?? [],
    encodedPolyline: route.polyline?.encodedPolyline ?? null,
  };
}

export async function testGoogleRoutesKey(apiKey: string) {
  await computeRouteMetrics(
    apiKey,
    ["350 5th Ave, New York, NY", "Times Square, New York, NY"],
    "driving",
    false,
  );
}

export function buildGoogleMapsUrl(
  startAddress: string,
  stops: string[],
  endAddress: string,
  mode: TravelMode,
) {
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("origin", startAddress);
  url.searchParams.set("destination", endAddress);
  url.searchParams.set("travelmode", mode);

  const waypoints = stops.filter((stop) => stop !== endAddress);
  if (waypoints.length) {
    url.searchParams.set("waypoints", waypoints.join("|"));
  }

  return url.toString();
}
