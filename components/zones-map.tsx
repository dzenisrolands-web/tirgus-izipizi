"use client";

import { useEffect, useRef } from "react";

// Riga center (Vecrīga area)
const RIGA: [number, number] = [56.9496, 24.1052];

// Zone 3 — major regional cities served by courier
const ZONE_3_CITIES: { name: string; lat: number; lng: number; codes: string }[] = [
  { name: "Jelgava", lat: 56.6511, lng: 23.7214, codes: "3000–3008" },
  { name: "Tukums", lat: 56.9678, lng: 23.1530, codes: "3100–3104" },
  { name: "Bauska", lat: 56.4076, lng: 24.1953, codes: "3901" },
  { name: "Ogre", lat: 56.8167, lng: 24.6052, codes: "5001–5045" },
  { name: "Sigulda", lat: 57.1538, lng: 24.8530, codes: "2150" },
  { name: "Cēsis", lat: 57.3128, lng: 25.2700, codes: "4100" },
  { name: "Limbaži", lat: 57.5155, lng: 24.7142, codes: "4001" },
  { name: "Daugavpils", lat: 55.8783, lng: 26.5363, codes: "5401–5417" },
  { name: "Valmiera", lat: 57.5413, lng: 25.4264, codes: "4201" },
];

export function ZonesMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Dynamic import — leaflet uses window, can't SSR
      const L = (await import("leaflet")).default;
      // CSS must be imported on client too
      await import("leaflet/dist/leaflet.css");

      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: RIGA,
        zoom: 9,
        scrollWheelZoom: false,
      });
      mapRef.current = map;

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: "&copy; OpenStreetMap contributors",
        maxZoom: 18,
      }).addTo(map);

      // Zone 2 — outer (drawn first so smaller circles appear on top)
      L.circle(RIGA, {
        radius: 30_000,
        color: "#f59e0b",
        weight: 2,
        fillColor: "#fde68a",
        fillOpacity: 0.18,
      })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:system-ui">
            <strong>Zona 2 · Tālākā Pierīga</strong><br/>
            <small>Mārupe · Olaine · Ādaži · Saulkrasti</small><br/>
            <span style="color:#0891b2">1 temp:</span> <strong>9.08 €</strong> ·
            <span style="color:#1d4ed8">2 temp:</span> <strong>11.25 €</strong>
          </div>`
        );

      // Zone 1
      L.circle(RIGA, {
        radius: 12_000,
        color: "#3b82f6",
        weight: 2,
        fillColor: "#bfdbfe",
        fillOpacity: 0.22,
      })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:system-ui">
            <strong>Zona 1 · Mikrorajoni + Pierīga</strong><br/>
            <small>Imanta · Pļavnieki · Salaspils · Jugla</small><br/>
            <span style="color:#0891b2">1 temp:</span> <strong>6.66 €</strong> ·
            <span style="color:#1d4ed8">2 temp:</span> <strong>8.83 €</strong>
          </div>`
        );

      // Zone 0 — center
      L.circle(RIGA, {
        radius: 4_000,
        color: "#16a34a",
        weight: 3,
        fillColor: "#86efac",
        fillOpacity: 0.4,
      })
        .addTo(map)
        .bindPopup(
          `<div style="font-family:system-ui">
            <strong>Zona 0 · Rīgas centrs</strong><br/>
            <small>1001–1050 (centrālie indeksi)</small><br/>
            <span style="color:#0891b2">1 temp:</span> <strong>5.45 €</strong> ·
            <span style="color:#1d4ed8">2 temp:</span> <strong>8.83 €</strong>
          </div>`
        );

      // Zone 3 — city markers
      const zone3Icon = L.divIcon({
        className: "",
        html: '<div style="width:14px;height:14px;border-radius:50%;background:#a855f7;border:2px solid white;box-shadow:0 0 0 1px #a855f7"></div>',
        iconSize: [14, 14],
        iconAnchor: [7, 7],
      });

      for (const c of ZONE_3_CITIES) {
        L.marker([c.lat, c.lng], { icon: zone3Icon })
          .addTo(map)
          .bindPopup(
            `<div style="font-family:system-ui">
              <strong>${c.name}</strong> · Zona 3<br/>
              <small>${c.codes}</small><br/>
              <span style="color:#0891b2">1 temp:</span> <strong>10.77 €</strong> ·
              <span style="color:#1d4ed8">2 temp:</span> <strong>13.19 €</strong>
            </div>`
          );
      }

      // Fit bounds to include all zone 3 cities + Riga area
      const bounds = L.latLngBounds([
        [55.6, 22.5], // SW corner (Daugavpils area)
        [57.8, 27.0], // NE corner (north of Daugavpils)
      ]);
      map.fitBounds(bounds, { padding: [20, 20] });
    })();

    return () => {
      cancelled = true;
      const m = mapRef.current as { remove?: () => void } | null;
      if (m && typeof m.remove === "function") m.remove();
      mapRef.current = null;
    };
  }, []);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="h-[500px] w-full rounded-2xl overflow-hidden shadow"
        style={{ zIndex: 0 }}
      />
      {/* Legend */}
      <div className="absolute bottom-4 right-4 z-[400] rounded-xl bg-white/95 px-3 py-2 text-xs shadow-lg backdrop-blur-sm">
        <p className="mb-1.5 font-bold text-gray-900">Zonas</p>
        <div className="space-y-1">
          {[
            { color: "#16a34a", label: "Zona 0 · Rīgas centrs" },
            { color: "#3b82f6", label: "Zona 1 · Pierīga" },
            { color: "#f59e0b", label: "Zona 2 · Tālākā Pierīga" },
            { color: "#a855f7", label: "Zona 3 · Reģionālā Latvija" },
          ].map((z) => (
            <div key={z.label} className="flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: z.color }}
              />
              <span className="text-gray-700">{z.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
