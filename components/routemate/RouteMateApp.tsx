"use client";

import Image from "next/image";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";
import {
  deleteRouteAction,
  duplicateRouteAction,
  loadRouteAction,
  optimizeRouteAction,
  removeGoogleApiKeyAction,
  saveRouteAction,
  signOutAction,
} from "@/app/actions";
import { formatDistance, formatDuration, formatSavingsCents, todayIsoDate } from "@/lib/routemate/format";
import type {
  GoogleConnectionStatus,
  RouteInput,
  RouteStopInput,
  RouteWithStops,
  SavedRoute,
  TravelMode,
} from "@/lib/routemate/types";

type RouteMateAppProps = {
  userEmail: string;
  googleStatus: GoogleConnectionStatus;
  initialRoutes: SavedRoute[];
  initialRoutesError?: string | null;
};

type BuilderMode = "editing" | "optimizing" | "optimized";
type AppView = "routes" | "builder" | "settings";
type AddressVerification = {
  confidence?: "high" | "medium" | "low";
  formattedAddress?: string;
  status: "idle" | "checking" | "valid" | "invalid";
  message?: string;
};
type AddressSuggestion = {
  description: string;
  mainText: string;
  secondaryText: string;
  placeId: string;
};
type DirectionsResultWithPath = {
  routes?: Array<{
    overview_path?: unknown[];
  }>;
};

type GoogleMapsWindow = Window & {
  gm_authFailure?: () => void;
  google?: {
    maps: {
      Animation?: { DROP: number };
      ControlPosition?: { TOP_LEFT: number };
      LatLngBounds: new () => {
        extend: (latLng: unknown) => void;
      };
      OverlayView: new () => {
        draw(): void;
        getProjection(): {
          fromLatLngToContainerPixel?: (latLng: unknown) => { x: number; y: number } | null;
          fromLatLngToDivPixel: (latLng: unknown) => { x: number; y: number } | null;
        };
        onAdd(): void;
        onRemove(): void;
        setMap(map: unknown | null): void;
      };
      Map: new (
        element: HTMLElement,
        options: Record<string, unknown>,
      ) => {
        fitBounds: (bounds: unknown, padding?: number) => void;
        setMapTypeId: (type: string) => void;
      };
      Marker: new (options: Record<string, unknown>) => unknown;
      Polyline: new (options: Record<string, unknown>) => {
        setMap: (map: unknown) => void;
        setOptions: (options: Record<string, unknown>) => void;
      };
      Geocoder: new () => {
        geocode: (
          request: { address: string },
          callback: (results: Array<{ geometry: { location: unknown } }> | null, status: string) => void,
        ) => void;
      };
      DirectionsRenderer: new (options: Record<string, unknown>) => {
        setMap: (map: unknown) => void;
        setDirections: (directions: unknown) => void;
      };
      DirectionsService: new () => {
        route: (
          request: Record<string, unknown>,
          callback: (result: unknown, status: string) => void,
        ) => void;
      };
      Point: new (x: number, y: number) => unknown;
      Size: new (width: number, height: number) => unknown;
      SymbolPath?: { CIRCLE: number; FORWARD_CLOSED_ARROW?: number };
      event: { clearInstanceListeners: (instance: unknown) => void };
      geometry?: {
        encoding: {
          decodePath: (encoded: string) => unknown[];
        };
      };
    };
  };
};

const blankStop = (): RouteStopInput => ({
  address: "",
  notes: "",
  serviceWindowStart: "",
  serviceWindowEnd: "",
  status: "pending",
});

const blankRoute = (): RouteInput => ({
  name: "Today's route",
  routeDate: todayIsoDate(),
  travelMode: "driving",
  departureTime: "",
  stopDurationMinutes: 20,
  startAddress: "",
  endAddress: "",
  stops: [blankStop(), blankStop()],
});

function isoToDateTimeLocal(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function routeInputFromRoute(route: RouteWithStops): RouteInput {
  return {
    id: route.id,
    name: route.name,
    routeDate: route.route_date,
    travelMode: route.travel_mode,
    departureTime: isoToDateTimeLocal(route.departure_time),
    stopDurationMinutes: route.stop_duration_minutes ?? 20,
    startAddress: route.start_address,
    endAddress: route.end_address ?? "",
    stops: route.stops.map((stop) => ({
      id: stop.id,
      address: stop.address,
      notes: stop.notes ?? "",
      serviceWindowStart: stop.service_window_start ?? "",
      serviceWindowEnd: stop.service_window_end ?? "",
      status: stop.status,
    })),
  };
}

function Icon({ name }: { name: "route" | "key" | "car" | "walk" | "plus" | "copy" | "map" | "trash" | "drag" | "clock" }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    strokeWidth: 2,
  };

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4 shrink-0">
      {name === "route" && (
        <path {...common} d="M5 19a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM19 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM7.5 16h5a4.5 4.5 0 0 0 0-9H11" />
      )}
      {name === "key" && <path {...common} d="M15 7a4 4 0 1 1-1.2 2.86L4 19.66V22h3.2l1.2-1.2H11v-2.6h2.6l2.54-2.54A4 4 0 0 1 15 7Z" />}
      {name === "car" && <path {...common} d="M5 17h14M6 17v2M18 17v2M4 13l2-5h12l2 5M5 13h14v4H5v-4ZM7.5 15h.01M16.5 15h.01" />}
      {name === "walk" && <path {...common} d="M13 4a1.5 1.5 0 1 0 0 .01M10 22l2-6M16 22l-3-6-3-2 1-5 3 2 2 3h3M8 12l-3 2" />}
      {name === "plus" && <path {...common} d="M12 5v14M5 12h14" />}
      {name === "copy" && <path {...common} d="M8 8h11v11H8zM5 16H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h11a1 1 0 0 1 1 1v1" />}
      {name === "map" && <path {...common} d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2V6Zm6-2v14M15 6v14" />}
      {name === "trash" && <path {...common} d="M4 7h16M10 11v6M14 11v6M6 7l1 14h10l1-14M9 7V4h6v3" />}
      {name === "drag" && <path {...common} d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01" />}
      {name === "clock" && <path {...common} d="M12 8v5l3 2M21 12A9 9 0 1 1 3 12a9 9 0 0 1 18 0Z" />}
    </svg>
  );
}

const previewPoints = [
  { x: 14, y: 66 },
  { x: 24, y: 34 },
  { x: 43, y: 42 },
  { x: 58, y: 24 },
  { x: 76, y: 38 },
  { x: 69, y: 70 },
  { x: 47, y: 78 },
  { x: 27, y: 58 },
  { x: 84, y: 66 },
  { x: 36, y: 20 },
];

function RouteMapPreview({
  route,
  selectedRoute,
}: {
  route: RouteInput;
  selectedRoute: SavedRoute | null;
}) {
  const filledStops = route.stops.filter((stop) => stop.address.trim());
  const endLabel = route.endAddress.trim() ? "End" : "Return to start";
  const orderedLocations = [
    { label: "Start", short: "A", address: route.startAddress || "Start address", kind: "start" },
    ...filledStops.map((stop, index) => ({
      label: `Stop ${index + 1}`,
      short: String(index + 1),
      address: stop.address,
      kind: "stop",
    })),
    ...(route.endAddress.trim()
      ? [{ label: "End", short: "B", address: route.endAddress, kind: "end" }]
      : [{ label: "Return to start", short: "A", address: route.startAddress || "Start address", kind: "end" }]),
  ].slice(0, previewPoints.length);

  const points = orderedLocations.map((location, index) => ({
    ...location,
    ...previewPoints[index],
  }));

  const routePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  const ghostPath = points
    .slice()
    .sort((a, b) => a.y - b.y)
    .map((point, index) => `${index === 0 ? "M" : "L"} ${point.x} ${point.y}`)
    .join(" ");

  return (
    <div className="route-map-preview">
      <div className="route-grid" />
      <div className="map-block map-block-one" />
      <div className="map-block map-block-two" />
      <div className="map-block map-block-three" />
      <div className="map-block map-block-four" />
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="route-svg" aria-hidden="true">
        {ghostPath && <path d={ghostPath} className="route-path route-path-ghost" />}
        {routePath && <path d={routePath} className="route-path route-path-live" />}
      </svg>
      {points.map((point) => (
        <div
          key={`${point.label}-${point.address}`}
          className={`map-pin map-pin-${point.kind}`}
          style={{ left: `${point.x}%`, top: `${point.y}%` }}
          title={`${point.label}: ${point.address}`}
        >
          {point.short}
        </div>
      ))}
      <div className="map-route-card map-route-card-top">
        <span>{selectedRoute?.status === "optimized" ? "Optimized route" : "Route preview"}</span>
        <strong>{points.length ? `${points.length} locations` : "Add stops"}</strong>
      </div>
      <div className="map-route-card map-route-card-bottom">
        <span>{route.travelMode === "walking" ? "Walking route" : "Driving route"}</span>
        <strong>{endLabel}</strong>
      </div>
      <div className="map-legend">
        <span className="legend-current" />
        Current order
        <span className="legend-original" />
        Original
      </div>
    </div>
  );
}

function InteractiveRouteMap({
  route,
  routeInput,
}: {
  route: RouteWithStops | null;
  routeInput: RouteInput;
}) {
  const [mapType, setMapType] = useState<"roadmap" | "satellite" | "hybrid">("roadmap");
  const [mapStatus, setMapStatus] = useState("Loading Google Maps...");
  const mapId = useMemo(() => `google-map-${route?.id ?? "draft"}`, [route?.id]);
  const travelMode = routeInput.travelMode;
  const optimizedAddresses = useMemo(
    () => {
      const startAddress = routeInput.startAddress.trim();
      const explicitEndAddress = routeInput.endAddress.trim();

      return [
        startAddress,
        ...routeInput.stops.map((stop) => stop.address).filter(Boolean),
        explicitEndAddress || startAddress,
      ].filter(Boolean);
    },
    [routeInput.endAddress, routeInput.startAddress, routeInput.stops],
  );
  const originalAddresses = useMemo(() => {
    if (!route) return optimizedAddresses;
    const originalStops = [...route.stops].sort((a, b) => a.original_order - b.original_order);

    return [
      route.start_address,
      ...originalStops.map((stop) => stop.address).filter(Boolean),
      route.end_address || route.start_address,
    ].filter(Boolean);
  }, [optimizedAddresses, route]);
  const addressKey = `${optimizedAddresses.join("|")}::${originalAddresses.join("|")}`;

  useEffect(() => {
    let cancelled = false;
    let pulseOverlay: { setMap: (map: unknown | null) => void } | null = null;
    const timeout = window.setTimeout(() => {
      if (!cancelled) {
        setMapStatus(
          "Google Maps is taking too long to load. Check that Maps JavaScript API is enabled and allowed by this key.",
        );
      }
    }, 8000);

    async function loadMap() {
      const element = document.getElementById(mapId);
      if (!element) return;

      setMapStatus("Loading Google Maps...");
      const keyResponse = await fetch("/api/google-browser-key");
      const keyPayload = (await keyResponse.json()) as {
        ok: boolean;
        apiKey?: string;
        message?: string;
      };

      if (!keyPayload.ok || !keyPayload.apiKey) {
        setMapStatus(keyPayload.message ?? "Google Maps key unavailable.");
        return;
      }
      const browserKey = keyPayload.apiKey;

      const mapsWindow = window as GoogleMapsWindow;
      mapsWindow.gm_authFailure = () => {
        setMapStatus(
          "Google Maps rejected this key. Enable Maps JavaScript API and check API/domain restrictions.",
        );
      };
      if (!mapsWindow.google?.maps) {
        await new Promise<void>((resolve, reject) => {
          const existing = document.querySelector<HTMLScriptElement>(
            "script[data-routemate-google-maps]",
          );
          if (existing) {
            if (mapsWindow.google?.maps) {
              resolve();
              return;
            }
            existing.addEventListener("load", () => resolve(), { once: true });
            existing.addEventListener("error", () => reject(new Error("Google Maps failed to load.")), { once: true });
            return;
          }

          const script = document.createElement("script");
          script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(browserKey)}&libraries=geometry,places`;
          script.async = true;
          script.defer = true;
          script.dataset.routemateGoogleMaps = "true";
          script.onload = () => resolve();
          script.onerror = () => reject(new Error("Google Maps failed to load."));
          document.head.appendChild(script);
        });
      }

      if (cancelled || !mapsWindow.google?.maps) return;

      const google = mapsWindow.google;
      const map = new google.maps.Map(element, {
        center: { lat: 25.7617, lng: -80.1918 },
        clickableIcons: false,
        disableDefaultUI: false,
        fullscreenControl: false,
        mapTypeControl: false,
        mapTypeId: mapType,
        streetViewControl: true,
        zoom: 11,
      });
      const bounds = new google.maps.LatLngBounds();
      let boundsHasPoints = false;
      const directionsTravelMode = travelMode === "walking" ? "WALKING" : "DRIVING";
      const directionsService = new google.maps.DirectionsService();
      const drawDirections = (
        routeAddresses: string[],
        options: Record<string, unknown>,
        onFallback?: () => void,
        onPath?: (path: unknown[]) => void,
      ) => {
        if (routeAddresses.length <= 1) {
          onFallback?.();
          return;
        }
        directionsService.route(
          {
            destination: routeAddresses[routeAddresses.length - 1],
            origin: routeAddresses[0],
            travelMode: directionsTravelMode,
            waypoints: routeAddresses.slice(1, -1).map((address) => ({ location: address, stopover: true })),
          },
          (result, directionsStatus) => {
            if (directionsStatus === "OK" && result) {
              const renderer = new google.maps.DirectionsRenderer({
                markerOptions: { visible: false },
                preserveViewport: true,
                suppressMarkers: true,
                ...options,
              });
              renderer.setMap(map);
              renderer.setDirections(result);
              const overviewPath = (result as DirectionsResultWithPath).routes?.[0]?.overview_path;
              if (overviewPath?.length) onPath?.(overviewPath);
            } else {
              onFallback?.();
            }
          },
        );
      };
      const originalLineSymbol = {
        path: "M 0,-1 0,1",
        scale: 5,
        strokeColor: "#8b5cf6",
        strokeOpacity: 1,
        strokeWeight: 4,
      };
      const startRoutePulseOverlay = (path: unknown[]) => {
        const mapCanvas = element.parentElement;
        if (!mapCanvas || path.length < 2) return null;
        const mapCanvasElement = mapCanvas;

        class RoutePulseOverlay extends google.maps.OverlayView {
          private animationFrame: number | null = null;
          private readonly canvas = document.createElement("canvas");
          private readonly context = this.canvas.getContext("2d");
          private readonly startedAt = window.performance.now();

          onAdd() {
            Object.assign(this.canvas.style, {
              height: "100%",
              inset: "0",
              pointerEvents: "none",
              position: "absolute",
              width: "100%",
              zIndex: "4",
            });
            mapCanvasElement.appendChild(this.canvas);
            this.animate = this.animate.bind(this);
            this.animationFrame = window.requestAnimationFrame(this.animate);
          }

          draw() {
            this.render(window.performance.now());
          }

          onRemove() {
            if (this.animationFrame) window.cancelAnimationFrame(this.animationFrame);
            this.canvas.remove();
          }

          private animate(timestamp: number) {
            this.render(timestamp);
            this.animationFrame = window.requestAnimationFrame(this.animate);
          }

          private getProjectedPath() {
            const projection = this.getProjection();
            const project =
              projection.fromLatLngToContainerPixel?.bind(projection) ??
              projection.fromLatLngToDivPixel.bind(projection);

            return path
              .map((point) => project(point))
              .filter((point): point is { x: number; y: number } => Boolean(point));
          }

          private render(timestamp: number) {
            if (!this.context || !mapCanvasElement.clientWidth || !mapCanvasElement.clientHeight) return;
            const ratio = window.devicePixelRatio || 1;
            const width = mapCanvasElement.clientWidth;
            const height = mapCanvasElement.clientHeight;

            if (this.canvas.width !== Math.round(width * ratio) || this.canvas.height !== Math.round(height * ratio)) {
              this.canvas.width = Math.round(width * ratio);
              this.canvas.height = Math.round(height * ratio);
            }

            this.context.setTransform(ratio, 0, 0, ratio, 0, 0);
            this.context.clearRect(0, 0, width, height);

            const projectedPath = this.getProjectedPath();
            if (projectedPath.length < 2) return;

            const distances = [0];
            for (let index = 1; index < projectedPath.length; index += 1) {
              const previous = projectedPath[index - 1];
              const current = projectedPath[index];
              distances[index] = distances[index - 1] + Math.hypot(current.x - previous.x, current.y - previous.y);
            }

            const totalDistance = distances.at(-1) ?? 0;
            if (totalDistance <= 0) return;

            const sampleAt = (distance: number) => {
              const wrappedDistance = ((distance % totalDistance) + totalDistance) % totalDistance;
              const segmentIndex = distances.findIndex((segmentDistance) => segmentDistance >= wrappedDistance);
              const endIndex = Math.max(1, segmentIndex === -1 ? distances.length - 1 : segmentIndex);
              const startIndex = endIndex - 1;
              const segmentStart = distances[startIndex];
              const segmentLength = Math.max(1, distances[endIndex] - segmentStart);
              const progress = (wrappedDistance - segmentStart) / segmentLength;
              const start = projectedPath[startIndex];
              const end = projectedPath[endIndex];

              return {
                x: start.x + (end.x - start.x) * progress,
                y: start.y + (end.y - start.y) * progress,
              };
            };

            const loopDuration = 10500;
            const headDistance = (((timestamp - this.startedAt) % loopDuration) / loopDuration) * totalDistance;
            const tailDistance = totalDistance * 0.05;
            const tailSegments = 14;

            this.context.save();
            this.context.lineCap = "round";
            this.context.lineJoin = "round";
            this.context.globalCompositeOperation = "screen";

            for (let index = tailSegments; index > 0; index -= 1) {
              const farRatio = index / tailSegments;
              const nearRatio = (index - 1) / tailSegments;
              const start = sampleAt(headDistance - tailDistance * farRatio);
              const end = sampleAt(headDistance - tailDistance * nearRatio);
              const intensity = 1 - farRatio;

              this.context.beginPath();
              this.context.moveTo(start.x, start.y);
              this.context.lineTo(end.x, end.y);
              this.context.strokeStyle = `rgba(216, 255, 230, ${0.04 + intensity * 0.34})`;
              this.context.lineWidth = 2 + intensity * 3;
              this.context.shadowBlur = 4 + intensity * 8;
              this.context.shadowColor = "rgba(216, 255, 230, 0.48)";
              this.context.stroke();
            }

            const head = sampleAt(headDistance);
            const glow = this.context.createRadialGradient(head.x, head.y, 0, head.x, head.y, 12);
            glow.addColorStop(0, "rgba(255, 255, 255, 1)");
            glow.addColorStop(0.34, "rgba(220, 255, 232, 0.78)");
            glow.addColorStop(1, "rgba(220, 255, 232, 0)");
            this.context.fillStyle = glow;
            this.context.shadowBlur = 10;
            this.context.shadowColor = "rgba(220, 255, 232, 0.62)";
            this.context.beginPath();
            this.context.arc(head.x, head.y, 12, 0, Math.PI * 2);
            this.context.fill();

            this.context.fillStyle = "rgba(255, 255, 255, 0.98)";
            this.context.beginPath();
            this.context.arc(head.x, head.y, 3.5, 0, Math.PI * 2);
            this.context.fill();
            this.context.restore();
          }
        }

        const overlay = new RoutePulseOverlay();
        overlay.setMap(map);
        return overlay;
      };

      if (route?.original_polyline && google.maps.geometry?.encoding) {
        const originalPath = google.maps.geometry.encoding.decodePath(route.original_polyline);
        new google.maps.Polyline({
          geodesic: true,
          icons: [{ icon: originalLineSymbol, offset: "0", repeat: "24px" }],
          path: originalPath,
          strokeColor: "#8b5cf6",
          strokeOpacity: 0,
          strokeWeight: 7,
          zIndex: 3,
        }).setMap(map);
      } else if (route && originalAddresses.length > 1) {
        drawDirections(originalAddresses, {
          polylineOptions: {
            icons: [{ icon: originalLineSymbol, offset: "0", repeat: "24px" }],
            strokeColor: "#8b5cf6",
            strokeOpacity: 0,
            strokeWeight: 7,
            zIndex: 3,
          },
        });
      }

      const canUseStoredOptimizedPolyline = Boolean(
        route?.optimized_polyline && (route.end_address || route.original_polyline),
      );

      if (canUseStoredOptimizedPolyline && route?.optimized_polyline && google.maps.geometry?.encoding) {
        const path = google.maps.geometry.encoding.decodePath(route.optimized_polyline);
        new google.maps.Polyline({
          path,
          geodesic: true,
          strokeColor: "#2f674f",
          strokeOpacity: 0.96,
          strokeWeight: 6,
          zIndex: 2,
        }).setMap(map);
        pulseOverlay = startRoutePulseOverlay(path);
        path.forEach((point) => {
          bounds.extend(point);
          boundsHasPoints = true;
        });
      }

      const geocoder = new google.maps.Geocoder();
      const markerPath: unknown[] = [];
      await Promise.all(
        optimizedAddresses.map(
          (address, index) =>
            new Promise<void>((resolve) => {
              geocoder.geocode({ address }, (results, geocodeStatus) => {
                if (cancelled || geocodeStatus !== "OK" || !results?.[0]) {
                  resolve();
                  return;
                }
                const location = results[0].geometry.location;
                new google.maps.Marker({
                  animation: google.maps.Animation?.DROP,
                  label: index === 0 ? "A" : index === optimizedAddresses.length - 1 ? "B" : String(index),
                  map,
                  position: location,
                  title: address,
                });
                markerPath[index] = location;
                bounds.extend(location);
                boundsHasPoints = true;
                resolve();
              });
            }),
        ),
      );

      if (!canUseStoredOptimizedPolyline && optimizedAddresses.length > 1) {
        drawDirections(
          optimizedAddresses,
          {
            polylineOptions: {
              strokeColor: "#2f674f",
              strokeOpacity: 0.96,
              strokeWeight: 6,
              zIndex: 2,
            },
          },
          () => {
            const fallbackPath = markerPath.filter(Boolean);
            if (fallbackPath.length > 1) {
              new google.maps.Polyline({
                geodesic: true,
                path: fallbackPath,
                strokeColor: "#2f674f",
                strokeOpacity: 0.75,
                strokeWeight: 5,
                zIndex: 2,
              }).setMap(map);
              pulseOverlay = startRoutePulseOverlay(fallbackPath);
            }
          },
          (directionsPath) => {
            pulseOverlay = startRoutePulseOverlay(directionsPath);
            directionsPath.forEach((point) => bounds.extend(point));
          },
        );
      }

      if (boundsHasPoints) {
        map.fitBounds(bounds, 72);
        window.clearTimeout(timeout);
        setMapStatus("");
      } else {
        window.clearTimeout(timeout);
        setMapStatus("Add and optimize stops to draw the route on Google Maps.");
      }
    }

    loadMap().catch((error) => {
      window.clearTimeout(timeout);
      setMapStatus(error instanceof Error ? error.message : "Google Maps could not load.");
    });

    return () => {
      cancelled = true;
      const mapsWindow = window as GoogleMapsWindow;
      if (mapsWindow.gm_authFailure) delete mapsWindow.gm_authFailure;
      window.clearTimeout(timeout);
      pulseOverlay?.setMap(null);
    };
  }, [
    addressKey,
    optimizedAddresses,
    originalAddresses,
    mapId,
    mapType,
    route,
    route?.optimized_polyline,
    route?.original_polyline,
    travelMode,
  ]);

  return (
    <div className="google-map-shell">
      <div id={mapId} className="google-map-canvas" />
      <div className="google-map-toolbar">
        {(["roadmap", "satellite", "hybrid"] as const).map((type) => (
          <button
            key={type}
            className={mapType === type ? "active" : ""}
            onClick={() => setMapType(type)}
          >
            {type}
          </button>
        ))}
      </div>
      <div className="google-map-legend">
        <span className="legend-current" />
        Optimized
        <span className="legend-original" />
        Entered order
      </div>
      {mapStatus && <div className="google-map-status">{mapStatus}</div>}
    </div>
  );
}

function Onboarding({
  status,
  onConnected,
}: {
  status: GoogleConnectionStatus;
  onConnected: () => void;
}) {
  const [apiKey, setApiKey] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function saveKey() {
    setMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/google-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ apiKey }),
      });
      const result = (await response.json()) as { ok: boolean; message: string };
      setMessage(result.message);
      if (result.ok) {
        setApiKey("");
        onConnected();
      }
    });
  }

  return (
    <section className="grid min-h-[calc(100vh-2rem)] gap-6 rounded-[2rem] bg-[#f7f4ec] p-3 md:grid-cols-[1.04fr_.96fr] md:p-5">
      <div className="story-panel flex flex-col justify-between rounded-[1.5rem] bg-[#101820] p-6 text-white shadow-2xl md:p-10">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-sm text-white/80">
            <Icon name="key" />
            Secure onboarding
          </div>
          <h1 className="mt-6 max-w-xl text-4xl font-semibold leading-tight md:text-6xl">
            Bring your Google key. Keep every route in your account.
          </h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/70 md:text-lg">
            RouteMate validates your Google Maps API key, encrypts it on the server, and never shows it again after setup.
          </p>
        </div>
        <div className="story-proof-card">
          <span>Built for the field</span>
          <strong>Plan routes at the desk. Open them from the truck.</strong>
        </div>
        <div className="mt-10 grid gap-3 sm:grid-cols-3">
          {["Enable Routes API", "Restrict usage", "Set quotas"].map((item) => (
            <div key={item} className="rounded-2xl border border-white/10 bg-white/8 p-4">
              <div className="text-sm text-white/55">Step</div>
              <div className="mt-1 font-medium">{item}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="relative grid content-start gap-5 overflow-hidden rounded-[1.5rem] border border-[#edf1ea] bg-white p-5 shadow-xl md:p-8">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_88%_8%,rgba(212,147,47,.14),transparent_22%),radial-gradient(circle_at_8%_0%,rgba(47,103,79,.1),transparent_22%)]" />
        <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(16,24,32,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(16,24,32,.035)_1px,transparent_1px)] bg-[size:34px_34px] [mask-image:linear-gradient(to_bottom,black,transparent_72%)]" />

        <div className="relative">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#dfe7dd] bg-[#f8faf6] px-3 py-1.5 text-sm font-semibold text-[#405047]">
            <Icon name="key" />
            Secure Google setup
          </div>
          <h2 className="mt-5 text-3xl font-semibold tracking-tight text-[#101820] md:text-4xl">
            Connect Google Maps
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#65706a]">
            Enable Routes API, Maps JavaScript API, Geocoding API, and Places API, then paste the key here. RouteMate uses them for optimization, live maps, verified addresses, and autocomplete.
          </p>
        </div>

        <div className="relative grid gap-3 rounded-[1.35rem] border border-[#e2e9df] bg-[#fbfcf8]/90 p-3 shadow-sm">
          {[
            ["01", "Enable Routes API", "Required for route totals and optimized stop order."],
            ["02", "Enable Maps JavaScript", "Required for the interactive map, satellite view, and route overlay."],
            ["03", "Enable Places + Geocoding", "Required for autocomplete and verifying every address field."],
          ].map(([number, title, description]) => (
            <div key={number} className="flex gap-3 rounded-2xl bg-white p-3 shadow-sm ring-1 ring-[#eef2ec]">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#101820] text-sm font-black text-white">
                {number}
              </div>
              <div>
                <div className="font-semibold text-[#101820]">{title}</div>
                <div className="mt-1 text-sm leading-5 text-[#6a766e]">{description}</div>
              </div>
            </div>
          ))}
        </div>

        {status.setupError && (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            {status.setupError}
          </div>
        )}

        <div className="relative rounded-[1.35rem] border border-[#dfe7dd] bg-white/95 p-4 shadow-[0_22px_50px_rgba(16,24,32,.08)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h3 className="text-lg font-bold text-[#101820]">API key</h3>
                <p className="mt-1 max-w-xl text-sm leading-6 text-[#65706a]">
                RouteMate validates optimization access, encrypts the key, and only exposes it back to your signed-in browser to load Google Maps.
              </p>
            </div>
            <div className="inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full bg-[#101820] px-3 py-1 text-xs font-bold text-white">
              <Icon name="key" />
              Server-only
            </div>
          </div>
          <label className="mt-5 grid gap-2">
            <span className="text-sm font-medium text-[#25312b]">Google Maps API key</span>
            <input
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              type="password"
              placeholder="Paste your key"
              className="premium-input"
            />
          </label>
        </div>

        <div className="relative flex items-center gap-3 rounded-[1.25rem] border border-[#e2e9df] bg-[#f7f9f4] p-4">
          <div className="brand-mark small shrink-0">
            <Icon name="clock" />
          </div>
          <p className="text-sm leading-6 text-[#56645c]">
            This unlocks route optimization, verified addresses, mileage totals, time saved, Google Maps share links, and a live satellite/roadmap view.
          </p>
        </div>

        {message && <p className="text-sm text-[#405047]">{message}</p>}

        <button className="primary-button justify-center" onClick={saveKey} disabled={pending || !apiKey.trim()}>
          {pending ? "Testing connection..." : "Test and connect"}
        </button>
      </div>
    </section>
  );
}

function MetricCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-2xl border border-[#e2e9df] bg-white p-4 shadow-sm">
      <div className="text-sm text-[#728076]">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-[#101820]">{value}</div>
      {helper && <div className="mt-1 text-xs text-[#8a958f]">{helper}</div>}
    </div>
  );
}

function RouteMetricsGrid({
  fuelCostCents,
  route,
  savings,
}: {
  fuelCostCents: number | null;
  route: RouteWithStops | null;
  savings: { metersSaved: number; secondsSaved: number } | null;
}) {
  const metersSaved = savings?.metersSaved ?? 0;
  const secondsSaved = savings?.secondsSaved ?? 0;
  const optimizedWorkdaySeconds =
    route?.optimized_workday_duration_seconds ??
    ((route?.optimized_duration_seconds ?? 0) + (route?.stops.length ?? 0) * (route?.stop_duration_minutes ?? 20) * 60);
  const originalWorkdaySeconds =
    route?.original_workday_duration_seconds ??
    ((route?.original_duration_seconds ?? 0) + (route?.stops.length ?? 0) * (route?.stop_duration_minutes ?? 20) * 60);

  return (
    <div className="route-metrics-grid">
      <MetricCard
        label="Distance"
        value={formatDistance(route?.optimized_distance_meters)}
        helper={`Entered: ${formatDistance(route?.original_distance_meters)}`}
      />
      <MetricCard
        label="Drive time"
        value={formatDuration(route?.optimized_duration_seconds)}
        helper={`Entered: ${formatDuration(route?.original_duration_seconds)}`}
      />
      <MetricCard
        label="Workday time"
        value={formatDuration(optimizedWorkdaySeconds)}
        helper={`Entered: ${formatDuration(originalWorkdaySeconds)}`}
      />
      <MetricCard
        label="Stop time"
        value={formatDuration((route?.stops.length ?? 0) * (route?.stop_duration_minutes ?? 20) * 60)}
        helper={`${route?.stop_duration_minutes ?? 20} min average`}
      />
      <MetricCard
        label="Mileage impact"
        value={metersSaved > 0 ? formatDistance(metersSaved) : "No extra miles"}
        helper={metersSaved > 0 ? "Saved vs entered order" : "Entered order was close"}
      />
      <MetricCard
        label="Time saved"
        value={secondsSaved > 0 ? formatDuration(secondsSaved) : "0 min"}
        helper={secondsSaved > 0 ? "Saved vs entered order" : "No time cut"}
      />
      {route?.travel_mode === "driving" && (
        <>
          <MetricCard label="Fuel cost" value={formatSavingsCents(fuelCostCents)} helper="Estimated route cost" />
          <MetricCard
            label="Fuel savings"
            value={formatSavingsCents(route.estimated_fuel_savings_cents)}
            helper="Compared with entered order"
          />
        </>
      )}
    </div>
  );
}

function AddressVerifyControl({
  address,
  check,
  onVerify,
}: {
  address: string;
  check?: AddressVerification;
  onVerify: () => void;
}) {
  const valid = check?.status === "valid";
  const invalid = check?.status === "invalid";
  const checking = check?.status === "checking";

  return (
    <div className={`address-verify ${valid ? "valid" : invalid ? "invalid" : ""}`}>
      <button type="button" onClick={onVerify} disabled={checking || !address.trim()}>
        {checking ? "Checking..." : valid ? "Recheck" : "Verify"}
      </button>
      {check?.message && <span>{check.message}</span>}
    </div>
  );
}

function AddressAutocompleteField({
  helper,
  label,
  onChange,
  placeholder,
  value,
  verifyControl,
}: {
  helper?: string;
  label: string;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
  verifyControl: ReactNode;
}) {
  const [focused, setFocused] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [suggestions, setSuggestions] = useState<AddressSuggestion[]>([]);

  useEffect(() => {
    const query = value.trim();
    if (!focused || query.length < 3) {
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setMessage("");
      try {
        const response = await fetch("/api/address-autocomplete", {
          body: JSON.stringify({ input: query }),
          headers: { "Content-Type": "application/json" },
          method: "POST",
          signal: controller.signal,
        });
        const result = (await response.json()) as {
          ok: boolean;
          message?: string;
          suggestions?: AddressSuggestion[];
        };

        if (!result.ok) {
          setSuggestions([]);
          setMessage(result.message ?? "Address suggestions unavailable.");
          return;
        }

        setSuggestions(result.suggestions ?? []);
      } catch {
        if (!controller.signal.aborted) {
          setMessage("Address suggestions unavailable.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 275);

    return () => {
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [focused, value]);

  return (
    <label className="field address-autocomplete-field">
      <span>{label}</span>
      <input
        autoComplete="off"
        className="premium-input"
        onBlur={() => window.setTimeout(() => setFocused(false), 140)}
        onChange={(event) => {
          onChange(event.target.value);
          if (event.target.value.trim().length < 3) {
            setSuggestions([]);
            setMessage("");
          }
        }}
        onFocus={() => {
          setFocused(true);
          if (value.trim().length < 3) {
            setSuggestions([]);
            setMessage("");
          }
        }}
        placeholder={placeholder}
        value={value}
      />
      {helper && <p className="field-helper">{helper}</p>}
      {focused && (suggestions.length > 0 || loading || message) && (
        <div className="address-suggestions">
          {loading && <div className="address-suggestion muted">Searching Google Places...</div>}
          {!loading && message && <div className="address-suggestion muted">{message}</div>}
          {!loading &&
            suggestions.map((suggestion) => (
              <button
                key={`${suggestion.placeId}-${suggestion.description}`}
                className="address-suggestion"
                type="button"
                onMouseDown={(event) => {
                  event.preventDefault();
                  onChange(suggestion.description);
                  setSuggestions([]);
                  setFocused(false);
                }}
              >
                <strong>{suggestion.mainText}</strong>
                {suggestion.secondaryText && <span>{suggestion.secondaryText}</span>}
              </button>
            ))}
        </div>
      )}
      {verifyControl}
    </label>
  );
}

function RouteInsightPanel({
  route,
  savings,
}: {
  route: RouteWithStops | null;
  savings: { metersSaved: number; secondsSaved: number } | null;
}) {
  if (!route) {
    return (
      <div className="route-insight-panel empty">
        <p className="eyebrow">Route intelligence</p>
        <h2>Select a route</h2>
        <p>Choose a saved route to see the optimized order, total mileage, travel time, and Google Maps handoff.</p>
      </div>
    );
  }

  const stopCount = route.stops.length;
  const hasSavings = Boolean((savings?.metersSaved ?? 0) > 0 || (savings?.secondsSaved ?? 0) > 0);
  const routeFuelCostCents =
    route.travel_mode === "driving" && route.optimized_distance_meters
      ? Math.round(((route.optimized_distance_meters / 1609.344) / 22) * 3.6 * 100)
      : null;
  const optimizedWorkdaySeconds =
    route.optimized_workday_duration_seconds ??
    ((route.optimized_duration_seconds ?? 0) + route.stops.length * (route.stop_duration_minutes ?? 20) * 60);
  const timingLabel = route.departure_time
    ? `Starts ${new Date(route.departure_time).toLocaleString([], {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`
    : route.travel_mode === "driving"
      ? "Traffic-aware now"
      : "Leave now";

  return (
    <div className="route-insight-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="eyebrow">Route intelligence</p>
          <h2>{route.name}</h2>
          <p>{route.route_date} · {route.travel_mode} · {stopCount} stop{stopCount === 1 ? "" : "s"} · {timingLabel}</p>
        </div>
        <span className="status-pill">{route.status}</span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <span>Total route</span>
          <strong>{formatDistance(route.optimized_distance_meters)}</strong>
        </div>
        <div>
          <span>Workday total</span>
          <strong>{formatDuration(optimizedWorkdaySeconds)}</strong>
        </div>
      </div>
      <p className="mt-4 text-sm leading-6 text-[#65706a]">
        {hasSavings
            ? `RouteMate found ${formatDistance(savings?.metersSaved)} and ${formatDuration(savings?.secondsSaved)} of potential savings compared with the entered order. Estimated fuel cost is ${formatSavingsCents(routeFuelCostCents)}.`
            : route.travel_mode === "driving"
            ? `Estimated fuel cost is ${formatSavingsCents(routeFuelCostCents)} for this route using 22 MPG and $3.60/gal. The optimized route matches the entered-order mileage, so there are no extra miles to cut.`
            : "This route is saved in optimized order. If savings show as zero, Google found a similar best path for the entered stops."}
      </p>
    </div>
  );
}

function Dashboard({
  routes,
  onSelect,
  onDuplicate,
  onDelete,
}: {
  routes: SavedRoute[];
  onSelect: (id: string) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <section className="dashboard-panel">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="eyebrow">Route library</p>
          <h2 className="text-2xl font-semibold text-[#101820]">Saved daily routes</h2>
        </div>
        <div className="text-sm text-[#66746b]">{routes.length} route{routes.length === 1 ? "" : "s"}</div>
      </div>

      {!routes.length ? (
        <div className="mt-6 rounded-3xl border border-dashed border-[#cbd8ca] bg-[#f8faf6] p-6">
          <div className="max-w-lg">
            <h3 className="text-lg font-semibold text-[#101820]">Build your first route</h3>
            <p className="mt-2 text-sm leading-6 text-[#65706a]">
              Add a start point, choose driving or walking, list the stops, then optimize and open the final order in Google Maps.
            </p>
          </div>
        </div>
      ) : (
        <div className="mt-5 grid gap-3">
          {routes.map((route) => (
            <div key={route.id} className="route-row">
              <button className="min-w-0 text-left" onClick={() => onSelect(route.id)}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-[#101820]">{route.name}</span>
                  <span className="mode-pill">{route.travel_mode}</span>
                  <span className="status-pill">{route.status}</span>
                </div>
                <div className="mt-1 text-sm text-[#65706a]">
                  {route.route_date} · {formatDistance(route.optimized_distance_meters ?? route.original_distance_meters)} · {formatDuration(route.optimized_duration_seconds ?? route.original_duration_seconds)}
                </div>
              </button>
              <div className="flex gap-2">
                {route.google_maps_url && (
                  <a className="icon-button" href={route.google_maps_url} target="_blank" rel="noreferrer" aria-label="Open in Google Maps">
                    <Icon name="map" />
                  </a>
                )}
                <button className="icon-button" onClick={() => onDuplicate(route.id)} aria-label="Duplicate route">
                  <Icon name="copy" />
                </button>
                <button className="icon-button" onClick={() => onDelete(route.id)} aria-label="Delete route">
                  <Icon name="trash" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export function RouteMateApp({
  userEmail,
  googleStatus,
  initialRoutes,
  initialRoutesError,
}: RouteMateAppProps) {
  const [status, setStatus] = useState(googleStatus);
  const [routes, setRoutes] = useState(initialRoutes);
  const [route, setRoute] = useState<RouteInput>(blankRoute());
  const [selectedRoute, setSelectedRoute] = useState<RouteWithStops | null>(null);
  const [builderMode, setBuilderMode] = useState<BuilderMode>("editing");
  const [activeView, setActiveView] = useState<AppView>(initialRoutes.length ? "routes" : "builder");
  const [addressChecks, setAddressChecks] = useState<Record<string, AddressVerification>>({});
  const [toast, setToast] = useState(initialRoutesError ?? "");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const selectedFuelCostCents =
    selectedRoute?.travel_mode === "driving" && selectedRoute.optimized_distance_meters
      ? Math.round(((selectedRoute.optimized_distance_meters / 1609.344) / 22) * 3.6 * 100)
      : null;

  useEffect(() => {
    if (selectedRoute || !routes.length || activeView !== "routes") return;
    selectRoute(routes[0].id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routes.length, selectedRoute, activeView]);

  const savings = useMemo(() => {
    if (!selectedRoute) return null;
    const metersSaved = Math.max(
      0,
      (selectedRoute.original_distance_meters ?? 0) - (selectedRoute.optimized_distance_meters ?? 0),
    );
    const secondsSaved = Math.max(
      0,
      (selectedRoute.original_duration_seconds ?? 0) - (selectedRoute.optimized_duration_seconds ?? 0),
    );
    return { metersSaved, secondsSaved };
  }, [selectedRoute]);

  function updateStop(index: number, patch: Partial<RouteStopInput>) {
    setRoute((current) => ({
      ...current,
      stops: current.stops.map((stop, stopIndex) =>
        stopIndex === index ? { ...stop, ...patch } : stop,
      ),
    }));
  }

  function verificationKey(kind: "start" | "end" | "stop", index?: number) {
    return kind === "stop" ? `stop-${index}` : kind;
  }

  async function verifyAddress(kind: "start" | "end" | "stop", address: string, index?: number) {
    const key = verificationKey(kind, index);
    const trimmed = address.trim();

    if (!trimmed) {
      setAddressChecks((current) => ({
        ...current,
        [key]: { status: "invalid", message: "Enter an address first." },
      }));
      return;
    }

    setAddressChecks((current) => ({
      ...current,
      [key]: { status: "checking", message: "Checking address..." },
    }));

    const response = await fetch("/api/verify-address", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ address: trimmed }),
    });
    const result = (await response.json()) as {
      ok: boolean;
      confidence?: "high" | "medium" | "low";
      formattedAddress?: string;
      message?: string;
    };

    if (!result.ok) {
      setAddressChecks((current) => ({
        ...current,
        [key]: {
          status: "invalid",
          message: result.message ?? "Address could not be verified.",
        },
      }));
      return;
    }

    setAddressChecks((current) => ({
      ...current,
      [key]: {
        confidence: result.confidence,
        formattedAddress: result.formattedAddress,
        status: "valid",
        message: `${result.confidence === "high" ? "Verified" : "Matched"}: ${result.formattedAddress}`,
      },
    }));
  }

  function moveStop(from: number, to: number) {
    setRoute((current) => {
      const stops = [...current.stops];
      const [moved] = stops.splice(from, 1);
      stops.splice(to, 0, moved);
      return { ...current, stops };
    });
  }

  function saveRoute(thenOptimize = false) {
    setToast("");
    if (thenOptimize) setBuilderMode("optimizing");
    startTransition(async () => {
      const saved = await saveRouteAction(route);
      setToast(saved.message);
      if (!saved.ok || !saved.routeId) {
        setBuilderMode("editing");
        return;
      }
      setRoute((current) => ({ ...current, id: saved.routeId }));

      if (thenOptimize) {
        const optimized = await optimizeRouteAction(saved.routeId);
        setToast(optimized.message);
        if (!optimized.ok || !optimized.route) {
          setToast(optimized.message || "Optimization failed. Check your Google API setup and addresses.");
          setBuilderMode("editing");
          return;
        }
        const optimizedRoute = optimized.route;
        setSelectedRoute(optimizedRoute);
        setRoute(routeInputFromRoute(optimizedRoute));
        setRoutes((current) => [
          optimizedRoute,
          ...current.filter((item) => item.id !== optimizedRoute.id),
        ]);
        setBuilderMode("optimized");
        setActiveView("routes");
        return;
      }

      const loaded = await loadRouteAction(saved.routeId);
      if (loaded.route) {
        setSelectedRoute(loaded.route);
        setRoutes((current) => [
          loaded.route!,
          ...current.filter((item) => item.id !== loaded.route?.id),
        ]);
      }
    });
  }

  function selectRoute(id: string) {
    startTransition(async () => {
      const loaded = await loadRouteAction(id);
      if (!loaded.route) {
        setToast(loaded.error ?? "Could not load route.");
        return;
      }

      setSelectedRoute(loaded.route);
      setBuilderMode(loaded.route.status === "optimized" ? "optimized" : "editing");
      setRoute(routeInputFromRoute(loaded.route));
      setActiveView("routes");
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  function duplicateRoute(id: string) {
    startTransition(async () => {
      const result = await duplicateRouteAction(id);
      setToast(result.message);
      if (result.ok && result.routeId) {
        const loaded = await loadRouteAction(result.routeId);
        if (loaded.route) setRoutes((current) => [loaded.route!, ...current]);
      }
    });
  }

  function deleteRoute(id: string) {
    startTransition(async () => {
      const result = await deleteRouteAction(id);
      setToast(result.message);
      if (!result.ok) return;
      setRoutes((current) => current.filter((item) => item.id !== id));
      if (selectedRoute?.id === id) {
        setSelectedRoute(null);
        setRoute(blankRoute());
        setBuilderMode("editing");
        setActiveView("routes");
      }
    });
  }

  function removeKey() {
    startTransition(async () => {
      const result = await removeGoogleApiKeyAction();
      setToast(result.message);
      if (result.ok) setStatus({ connected: false, last4: null, validatedAt: null });
    });
  }

  if (!status.connected) {
    return <Onboarding status={status} onConnected={() => setStatus({ ...status, connected: true })} />;
  }

  return (
    <div className="min-h-screen bg-[#f7f4ec] p-3 text-[#101820] md:p-5">
      <div className="mx-auto grid max-w-7xl gap-5">
        <header className="app-header">
          <div className="flex min-w-0 items-center gap-3">
            <div className="brand-mark">
              <Icon name="route" />
            </div>
            <div className="min-w-0">
              <div className="text-xl font-semibold">RouteMate</div>
              <div className="truncate text-sm text-[#65706a]">{userEmail}</div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button className={`nav-button ${activeView === "routes" ? "active" : ""}`} onClick={() => setActiveView("routes")}>Routes</button>
            <button className={`nav-button ${activeView === "builder" ? "active" : ""}`} onClick={() => { setActiveView("builder"); setBuilderMode("editing"); }}>Builder</button>
            <button className={`nav-button ${activeView === "settings" ? "active" : ""}`} onClick={() => setActiveView("settings")}>Settings</button>
            <form action={signOutAction}>
              <button className="secondary-button">Sign out</button>
            </form>
          </div>
        </header>

        {activeView === "routes" && (
          <main className="grid gap-5">
            <section className="route-map-workspace">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <p className="eyebrow">Saved routes</p>
                  <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
                    Your optimized route map.
                  </h1>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-[#65706a]">
                    Select a saved route to review the optimized path, ordered stops, totals, and Google Maps handoff.
                  </p>
                </div>
                <button
                  className="primary-button justify-center"
                  onClick={() => {
                    setRoute(blankRoute());
                    setSelectedRoute(null);
                    setBuilderMode("editing");
                    setActiveView("builder");
                  }}
                >
                  <Icon name="plus" />
                  New route
                </button>
              </div>

              <div className="route-map-layout mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className="grid min-w-0 gap-5">
                  <InteractiveRouteMap
                    route={selectedRoute}
                    routeInput={selectedRoute ? routeInputFromRoute(selectedRoute) : route}
                  />

                  {selectedRoute ? (
                    <div className="optimized-route-list">
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="eyebrow">Optimized order</p>
                          <h2>{selectedRoute.name}</h2>
                        </div>
                        <span className="mode-pill">{selectedRoute.travel_mode}</span>
                      </div>
                      <div className="mt-4 grid gap-3">
                        {selectedRoute.stops.map((stop, index) => (
                          <div key={stop.id} className="optimized-stop-row">
                            <span>{index + 1}</span>
                            <div>
                              <strong>{stop.address}</strong>
                              {stop.notes && <p>{stop.notes}</p>}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-3xl border border-dashed border-[#cbd8ca] bg-white/70 p-6 text-sm leading-6 text-[#65706a]">
                      Select a saved route below or create a new one to see the optimized map here.
                    </div>
                  )}
                </div>
                <div className="route-map-sidebar grid min-w-0 content-start gap-3">
                  <RouteInsightPanel route={selectedRoute} savings={savings} />
                  {selectedRoute && (
                    <RouteMetricsGrid
                      fuelCostCents={selectedFuelCostCents}
                      route={selectedRoute}
                      savings={savings}
                    />
                  )}

                  {selectedRoute && (
                    <div className="grid content-start gap-3 pt-1">
                      <button className="secondary-button justify-center" onClick={() => { setRoute(routeInputFromRoute(selectedRoute)); setBuilderMode("editing"); setActiveView("builder"); }}>
                        Edit route
                      </button>
                      {selectedRoute.google_maps_url && (
                        <a className="primary-button justify-center" href={selectedRoute.google_maps_url} target="_blank" rel="noreferrer">
                          <Icon name="map" />
                          Open in Google Maps
                        </a>
                      )}
                      <button
                        className="secondary-button justify-center"
                        onClick={() => {
                          navigator.clipboard.writeText(selectedRoute.google_maps_url ?? "");
                          setToast("Google Maps link copied.");
                        }}
                        disabled={!selectedRoute.google_maps_url}
                      >
                        <Icon name="copy" />
                        Copy share link
                      </button>
                      <button className="secondary-button justify-center" onClick={() => deleteRoute(selectedRoute.id)} disabled={pending}>
                        <Icon name="trash" />
                        Delete route
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </section>

            <Dashboard routes={routes} onSelect={selectRoute} onDuplicate={duplicateRoute} onDelete={deleteRoute} />
          </main>
        )}

        {activeView === "settings" && (
          <main className="settings-panel">
            <div>
              <p className="eyebrow">Settings</p>
              <h1>Google Maps connection</h1>
              <p>Manage the encrypted Google Maps API key RouteMate uses to optimize your routes.</p>
            </div>
            <div className="settings-card">
              <div>
                <h2>Maps API key</h2>
                <p>{status.connected ? `Connected. Key ending ${status.last4 ?? "set"}.` : "Not connected."}</p>
              </div>
              <button className="secondary-button" onClick={removeKey} disabled={pending}>
                Remove key
              </button>
            </div>
            <div className="settings-card">
              <div>
                <h2>Account</h2>
                <p>{userEmail}</p>
              </div>
              <form action={signOutAction}>
                <button className="secondary-button">Sign out</button>
              </form>
            </div>
          </main>
        )}

        {activeView === "builder" && (
        <main className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_420px]">
          <section className="builder-panel">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="eyebrow">Route builder</p>
                <h1 className="text-3xl font-semibold tracking-tight md:text-5xl">
                  Plan the day, then let Google find the cleaner order.
                </h1>
              </div>
              <button className="secondary-button shrink-0" onClick={() => { setRoute(blankRoute()); setSelectedRoute(null); setBuilderMode("editing"); }}>
                New route
              </button>
            </div>

            {builderMode === "optimizing" && (
              <div className="optimization-state">
                <div className="optimization-visual">
                  <Image
                    alt=""
                    fill
                    priority
                    sizes="(min-width: 1280px) 420px, 100vw"
                    src="/brand/routemate-optimizing-map.png"
                  />
                  <div className="optimization-scan" />
                  <div className="optimization-live-chip">
                    <span />
                    Optimizing route
                  </div>
                </div>
                <div className="optimization-copy">
                  <div className="optimization-kicker">
                    <span className="eyebrow">Optimization engine</span>
                    <span className="status-pill">Live</span>
                  </div>
                  <h2>Finding the most efficient field route</h2>
                  <p>
                    RouteMate is comparing the entered order against Google travel time, mileage, service stops, and your selected travel mode.
                  </p>
                  <div className="optimization-progress" aria-hidden="true">
                    <span />
                  </div>
                  <div className="optimization-steps">
                    <span>Validate stops</span>
                    <span>Compare paths</span>
                    <span>Save route</span>
                  </div>
                </div>
              </div>
            )}

            {builderMode === "optimized" && selectedRoute && (
              <div className="optimized-result-card">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="eyebrow">Optimized route</p>
                    <h2 className="mt-2 text-3xl font-semibold text-[#101820]">{selectedRoute.name}</h2>
                    <p className="mt-2 text-sm leading-6 text-[#65706a]">
                      The stop list below is now saved in optimized order. Use Edit to adjust details, or open the route in Google Maps for turn-by-turn navigation.
                    </p>
                  </div>
                  <button className="secondary-button" onClick={() => setBuilderMode("editing")}>
                    Edit route
                  </button>
                </div>
                <div className="mt-5">
                  <InteractiveRouteMap route={selectedRoute} routeInput={route} />
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <MetricCard label="Distance" value={formatDistance(selectedRoute.optimized_distance_meters)} helper="Optimized" />
                  <MetricCard label="Drive time" value={formatDuration(selectedRoute.optimized_duration_seconds)} helper="Optimized" />
                  <MetricCard
                    label="Workday time"
                    value={formatDuration(
                      selectedRoute.optimized_workday_duration_seconds ??
                        ((selectedRoute.optimized_duration_seconds ?? 0) +
                          selectedRoute.stops.length * (selectedRoute.stop_duration_minutes ?? 20) * 60),
                    )}
                    helper="Includes stop time"
                  />
                  <MetricCard label="Miles saved" value={formatDistance(savings?.metersSaved)} />
                  <MetricCard label="Time saved" value={formatDuration(savings?.secondsSaved)} />
                </div>
                <div className="mt-5 grid gap-3">
                  {route.stops.map((stop, index) => (
                    <div key={`${stop.id}-${index}`} className="optimized-stop-row">
                      <span>{index + 1}</span>
                      <div>
                        <strong>{stop.address}</strong>
                        {stop.notes && <p>{stop.notes}</p>}
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-col gap-3 sm:flex-row">
                  {selectedRoute.google_maps_url && (
                    <a className="primary-button justify-center" href={selectedRoute.google_maps_url} target="_blank" rel="noreferrer">
                      <Icon name="map" />
                      Open in Google Maps
                    </a>
                  )}
                  <button
                    className="secondary-button justify-center"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedRoute.google_maps_url ?? "");
                      setToast("Google Maps link copied.");
                    }}
                    disabled={!selectedRoute.google_maps_url}
                  >
                    <Icon name="copy" />
                    Copy share link
                  </button>
                </div>
              </div>
            )}

            {builderMode === "editing" && (
              <>
            <div className="mt-7 grid gap-4 md:grid-cols-2">
              <label className="field">
                <span>Route name</span>
                <input className="premium-input" value={route.name} onChange={(event) => setRoute({ ...route, name: event.target.value })} />
              </label>
              <label className="field">
                <span>Date</span>
                <input className="premium-input" type="date" value={route.routeDate} onChange={(event) => setRoute({ ...route, routeDate: event.target.value })} />
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-[1fr_1fr]">
              <div className="field">
                <span>Travel mode</span>
                <div className="segmented-control">
                  {(["driving", "walking"] as TravelMode[]).map((mode) => (
                    <button
                      key={mode}
                      className={route.travelMode === mode ? "active" : ""}
                      onClick={() => setRoute({ ...route, travelMode: mode })}
                    >
                      <Icon name={mode === "driving" ? "car" : "walk"} />
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-[#e2e9df] bg-[#f8faf6] p-4 text-sm leading-6 text-[#5f6c64]">
                Driving routes show estimated fuel savings. Walking routes focus on time saved and less backtracking.
              </div>
            </div>

            <div className="smart-timing-panel mt-4">
              <div>
                <p className="eyebrow">Smart timing</p>
                <h2>Optimize around the workday</h2>
                <p>Leave start time blank to use current traffic. Average stop duration adds service time to the workday estimate.</p>
              </div>
              <label className="field">
                <span>Start time</span>
                <input
                  className="premium-input"
                  type="datetime-local"
                  value={route.departureTime}
                  onChange={(event) => setRoute({ ...route, departureTime: event.target.value })}
                />
                <p className="field-helper">Blank means leave now. Driving routes use traffic-aware timing.</p>
              </label>
              <label className="field">
                <span>Average stop duration</span>
                <div className="duration-input">
                  <input
                    className="premium-input"
                    min="0"
                    max="480"
                    type="number"
                    value={route.stopDurationMinutes}
                    onChange={(event) =>
                      setRoute({
                        ...route,
                        stopDurationMinutes: Math.max(0, Math.min(480, Number(event.target.value) || 0)),
                      })
                    }
                  />
                  <span>min</span>
                </div>
                <p className="field-helper">Used once per stop for total workday time.</p>
              </label>
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <AddressAutocompleteField
                label="Start address"
                value={route.startAddress}
                onChange={(value) => setRoute({ ...route, startAddress: value })}
                placeholder="Warehouse, office, or first location"
                verifyControl={<AddressVerifyControl
                  address={route.startAddress}
                  check={addressChecks[verificationKey("start")]}
                  onVerify={() => verifyAddress("start", route.startAddress)}
                />}
              />
              <AddressAutocompleteField
                label="End address"
                value={route.endAddress}
                onChange={(value) => setRoute({ ...route, endAddress: value })}
                placeholder="Leave blank to return to start"
                helper="If blank, RouteMate ends the route back at the start address."
                verifyControl={<AddressVerifyControl
                  address={route.endAddress}
                  check={addressChecks[verificationKey("end")]}
                  onVerify={() => verifyAddress("end", route.endAddress)}
                />}
              />
            </div>

            <div className="mt-8 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold">Stops</h2>
                <p className="text-sm text-[#65706a]">Drag rows to adjust the manual order before optimizing.</p>
              </div>
              <button className="secondary-button" onClick={() => setRoute({ ...route, stops: [...route.stops, blankStop()] })}>
                <Icon name="plus" />
                Add stop
              </button>
            </div>

            <div className="mt-4 grid gap-3">
              {route.stops.map((stop, index) => (
                <div
                  key={`${stop.id ?? "new"}-${index}`}
                  className="stop-card"
                  draggable
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragIndex !== null && dragIndex !== index) moveStop(dragIndex, index);
                    setDragIndex(null);
                  }}
                >
                  <div className="drag-handle" title="Drag to reorder">
                    <Icon name="drag" />
                  </div>
                  <div className="grid min-w-0 flex-1 gap-3">
                    <div className="grid gap-3 md:grid-cols-[1fr_160px_160px]">
                      <AddressAutocompleteField
                        label={`Stop ${index + 1} address`}
                        value={stop.address}
                        onChange={(value) => updateStop(index, { address: value })}
                        placeholder="Customer or site address"
                        verifyControl={<AddressVerifyControl
                          address={stop.address}
                          check={addressChecks[verificationKey("stop", index)]}
                          onVerify={() => verifyAddress("stop", stop.address, index)}
                        />}
                      />
                      <label className="field">
                        <span>Window start</span>
                        <input className="premium-input" type="time" value={stop.serviceWindowStart} onChange={(event) => updateStop(index, { serviceWindowStart: event.target.value })} />
                      </label>
                      <label className="field">
                        <span>Window end</span>
                        <input className="premium-input" type="time" value={stop.serviceWindowEnd} onChange={(event) => updateStop(index, { serviceWindowEnd: event.target.value })} />
                      </label>
                    </div>
                    <label className="field">
                      <span>Notes</span>
                      <textarea className="premium-input min-h-20 resize-y" value={stop.notes} onChange={(event) => updateStop(index, { notes: event.target.value })} placeholder="Gate code, service notes, contact info, parking details" />
                    </label>
                  </div>
                  <button
                    className="icon-button"
                    aria-label="Remove stop"
                    onClick={() => setRoute({ ...route, stops: route.stops.filter((_, stopIndex) => stopIndex !== index) })}
                  >
                    <Icon name="trash" />
                  </button>
                </div>
              ))}
            </div>

            {toast && <div className="mt-5 rounded-2xl border border-[#dfe7dd] bg-white p-4 text-sm text-[#405047]">{toast}</div>}

            <div className="sticky bottom-3 mt-6 flex flex-col gap-3 rounded-3xl border border-[#dfe7dd] bg-white/90 p-3 shadow-2xl backdrop-blur md:flex-row md:justify-end">
              <button className="secondary-button justify-center" onClick={() => saveRoute(false)} disabled={pending}>
                Save draft
              </button>
              <button className="primary-button justify-center md:w-auto" onClick={() => saveRoute(true)} disabled={pending}>
                {pending ? "Working..." : "Save and optimize"}
              </button>
            </div>
              </>
            )}
          </section>

          <aside className="grid gap-5">
            <section className="summary-panel">
              <RouteMapPreview route={route} selectedRoute={selectedRoute} />
              <div className="mt-5 flex items-start justify-between gap-3">
                <div>
                  <p className="eyebrow">Route summary</p>
                  <h2 className="text-2xl font-semibold">{selectedRoute?.name ?? route.name}</h2>
                </div>
                <span className="mode-pill">{route.travelMode}</span>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <MetricCard label="Distance" value={formatDistance(selectedRoute?.optimized_distance_meters)} helper="Optimized" />
                <MetricCard label="Drive time" value={formatDuration(selectedRoute?.optimized_duration_seconds)} helper="Optimized" />
                <MetricCard
                  label="Workday time"
                  value={formatDuration(
                    selectedRoute
                      ? selectedRoute.optimized_workday_duration_seconds ??
                          ((selectedRoute.optimized_duration_seconds ?? 0) +
                            selectedRoute.stops.length * (selectedRoute.stop_duration_minutes ?? 20) * 60)
                      : null,
                  )}
                  helper={selectedRoute ? "Includes stop time" : "After optimizing"}
                />
                <MetricCard label="Miles saved" value={formatDistance(savings?.metersSaved)} />
                <MetricCard label="Time saved" value={formatDuration(savings?.secondsSaved)} />
              </div>
              {route.travelMode === "driving" && (
                <div className="mt-3">
                  <MetricCard label="Fuel savings" value={formatSavingsCents(selectedRoute?.estimated_fuel_savings_cents)} helper="Uses 22 MPG and $3.60/gal defaults" />
                </div>
              )}
              {selectedRoute?.google_maps_url ? (
                <div className="mt-5 grid gap-3">
                  <a className="primary-button justify-center" href={selectedRoute.google_maps_url} target="_blank" rel="noreferrer">
                    <Icon name="map" />
                    Open in Google Maps
                  </a>
                  <button
                    className="secondary-button justify-center"
                    onClick={() => {
                      navigator.clipboard.writeText(selectedRoute.google_maps_url ?? "");
                      setToast("Google Maps link copied.");
                    }}
                  >
                    <Icon name="copy" />
                    Copy share link
                  </button>
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-[#e2e9df] bg-[#f8faf6] p-4 text-sm leading-6 text-[#65706a]">
                  Save and optimize to generate totals and a Google Maps share link.
                </div>
              )}
            </section>

            <Dashboard routes={routes} onSelect={selectRoute} onDuplicate={duplicateRoute} onDelete={deleteRoute} />
          </aside>
        </main>
        )}
      </div>
    </div>
  );
}
