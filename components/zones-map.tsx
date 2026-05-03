"use client";

import { useEffect, useRef, useState } from "react";

const RIGA: [number, number] = [56.9496, 24.1052];

// Hand-drawn approximate zone polygons (lat, lng pairs).
// Stylized to evoke izipizi.lv public delivery map look — concentric regions
// around Rīga + regional city markers + "rest of Latvia" backdrop.

// Zone 0 — Rīgas centrs (small irregular polygon around Vecrīga/centrs)
const ZONE_0_POLYGON: [number, number][] = [
  [56.969, 24.083], [56.973, 24.108], [56.971, 24.130], [56.962, 24.142],
  [56.952, 24.143], [56.940, 24.135], [56.933, 24.118], [56.934, 24.097],
  [56.940, 24.082], [56.954, 24.075], [56.969, 24.083],
];

// Zone 1 — mikrorajoni + tuvākā Pierīga
const ZONE_1_POLYGON: [number, number][] = [
  [57.020, 24.000], [57.030, 24.060], [57.030, 24.150], [57.010, 24.230],
  [56.980, 24.270], [56.940, 24.290], [56.890, 24.280], [56.860, 24.255],
  [56.840, 24.220], [56.840, 24.150], [56.850, 24.060], [56.880, 23.990],
  [56.920, 23.945], [56.965, 23.945], [57.000, 23.965], [57.020, 24.000],
];

// Zone 2 — tālākā Pierīga (Mārupe/Olaine/Saulkrasti/Ādaži)
const ZONE_2_POLYGON: [number, number][] = [
  [57.290, 23.970], [57.290, 24.250], [57.260, 24.460], [57.180, 24.540],
  [57.060, 24.560], [56.940, 24.530], [56.820, 24.500], [56.720, 24.420],
  [56.680, 24.300], [56.660, 24.150], [56.680, 23.980], [56.720, 23.870],
  [56.810, 23.770], [56.910, 23.730], [57.020, 23.760], [57.130, 23.810],
  [57.220, 23.870], [57.290, 23.970],
];

// Zone 3 markers — regional cities served by courier
const ZONE_3_CITIES: { name: string; lat: number; lng: number; codes: string }[] = [
  { name: "Jelgava",    lat: 56.6511, lng: 23.7214, codes: "2008–2016" },
  { name: "Tukums",     lat: 56.9678, lng: 23.1530, codes: "2105" },
  { name: "Ogre",       lat: 56.8167, lng: 24.6052, codes: "5001–5071" },
  { name: "Cēsis",      lat: 57.3128, lng: 25.2700, codes: "5041" },
  { name: "Daugavpils", lat: 55.8783, lng: 26.5363, codes: "5070–5071" },
  { name: "Valmiera",   lat: 57.5413, lng: 25.4264, codes: "5060" },
  { name: "Liepāja",    lat: 56.5074, lng: 21.0136, codes: "5041" },
  { name: "Ventspils",  lat: 57.3955, lng: 21.5774, codes: "5052" },
];

// IziPizi pakomāti
const LOCKERS: { id: string; name: string; lat: number; lng: number; address: string; hours: string }[] = [
  { id: "brivibas",   name: "Brīvības 253",     lat: 56.9716, lng: 24.1404, address: "Brīvības iela 253 / NESTE",   hours: "24/7" },
  { id: "agenskalna", name: "Āgenskalna tirgus", lat: 56.9377, lng: 24.0859, address: "Nometņu iela 64 / Tirgus",    hours: "24/7" },
  { id: "salaspils",  name: "Salaspils",         lat: 56.8651, lng: 24.3526, address: "Zviedru iela 1C / NESTE",     hours: "24/7" },
  { id: "ikskile",    name: "Ikšķile",           lat: 56.8359, lng: 24.5026, address: "Daugavas iela 63 / Labumu bode", hours: "10:00–20:00" },
  { id: "tukums",     name: "Tukuma tirgus",     lat: 56.9692, lng: 23.1611, address: "J. Raiņa iela 30 / Tirgus",   hours: "24/7" },
  { id: "dundaga",    name: "Dundagas tirgus",   lat: 57.5074, lng: 22.3506, address: "Pils 3B / Tirgus",            hours: "24/7" },
];

const ZONE_STYLES = {
  0: { stroke: "#10b981", fill: "#34d399", fillOpacity: 0.55, name: "Rīgas centrs",          price: "5.45€" },
  1: { stroke: "#3b82f6", fill: "#60a5fa", fillOpacity: 0.40, name: "Mikrorajoni + Pierīga", price: "6.66€" },
  2: { stroke: "#a855f7", fill: "#c084fc", fillOpacity: 0.30, name: "Tālākā Pierīga",        price: "9.08€" },
  3: { stroke: "#ec4899", fill: "#f472b6", fillOpacity: 0.55, name: "Reģionālā Latvija",     price: "10.77€" },
  4: { stroke: "#94a3b8", fill: "#cbd5e1", fillOpacity: 0.20, name: "Pārējā Latvija",        price: "tikai pakomāts" },
};

export function ZonesMap() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<unknown>(null);
  const [tileMode, setTileMode] = useState<"light" | "dark">("light");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const L = (await import("leaflet")).default;
      await import("leaflet/dist/leaflet.css");

      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        center: RIGA,
        zoom: 8,
        scrollWheelZoom: false,
        zoomControl: true,
      });
      mapRef.current = map;

      const lightTiles = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
        { attribution: "&copy; OpenStreetMap &copy; CARTO", subdomains: "abcd", maxZoom: 19 }
      );
      const darkTiles = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png",
        { attribution: "&copy; OpenStreetMap &copy; CARTO", subdomains: "abcd", maxZoom: 19 }
      );
      const labelsTiles = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_only_labels/{z}/{x}/{y}{r}.png",
        { subdomains: "abcd", maxZoom: 19, pane: "shadowPane" }
      );
      const labelsDark = L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png",
        { subdomains: "abcd", maxZoom: 19, pane: "shadowPane" }
      );
      (tileMode === "dark" ? darkTiles : lightTiles).addTo(map);

      const popupStyle = `font-family:-apple-system,'Segoe UI',Roboto,sans-serif;font-size:13px;line-height:1.5`;

      // Zone 4 — "Pārējā Latvija" — light Latvia outline (large rectangle for visual hint)
      // Note: a full Latvia silhouette would need GeoJSON; a soft rect approximation works as backdrop
      L.polygon(
        [
          [57.95, 20.95], [58.10, 23.10], [58.05, 25.50], [57.65, 27.05],
          [56.95, 27.65], [56.30, 27.30], [55.65, 26.55], [55.65, 25.10],
          [56.10, 23.50], [56.30, 21.90], [56.85, 20.95], [57.50, 20.85],
          [57.95, 20.95],
        ],
        {
          color: ZONE_STYLES[4].stroke,
          weight: 1,
          fillColor: ZONE_STYLES[4].fill,
          fillOpacity: ZONE_STYLES[4].fillOpacity,
          dashArray: "3 4",
        }
      ).addTo(map).bindPopup(
        `<div style="${popupStyle}">
          <div style="font-weight:800;color:#475569;margin-bottom:4px">Pārējā Latvija</div>
          <div style="color:#64748b;font-size:11px;margin-bottom:6px">Vietas ārpus 4 zonām</div>
          <div style="font-size:12px"><b>Tikai pakomāts</b> · 3€ / skapītis<br/>Kurjers/ekspres šeit nav pieejams</div>
        </div>`
      );

      // Zone 2 — drawn before Zone 1 so smaller appears on top
      L.polygon(ZONE_2_POLYGON, {
        color: ZONE_STYLES[2].stroke,
        weight: 2.5,
        fillColor: ZONE_STYLES[2].fill,
        fillOpacity: ZONE_STYLES[2].fillOpacity,
      }).addTo(map).bindPopup(
        `<div style="${popupStyle}">
          <div style="font-weight:800;color:${ZONE_STYLES[2].stroke};margin-bottom:4px">Zona 2 · ${ZONE_STYLES[2].name}</div>
          <div style="color:#666;font-size:11px;margin-bottom:6px">Mārupe · Olaine · Ādaži · Saulkrasti · Babīte · Carnikava</div>
          <div style="display:flex;gap:8px;font-size:12px">
            <span><span style="color:#0891b2">1 temp</span> <b>9.08 €</b></span>
            <span><span style="color:#1d4ed8">2 temp</span> <b>11.25 €</b></span>
          </div>
        </div>`
      );

      L.polygon(ZONE_1_POLYGON, {
        color: ZONE_STYLES[1].stroke,
        weight: 2.5,
        fillColor: ZONE_STYLES[1].fill,
        fillOpacity: ZONE_STYLES[1].fillOpacity,
      }).addTo(map).bindPopup(
        `<div style="${popupStyle}">
          <div style="font-weight:800;color:${ZONE_STYLES[1].stroke};margin-bottom:4px">Zona 1 · ${ZONE_STYLES[1].name}</div>
          <div style="color:#666;font-size:11px;margin-bottom:6px">Imanta · Pļavnieki · Mežaparks · Salaspils · Jugla</div>
          <div style="display:flex;gap:8px;font-size:12px">
            <span><span style="color:#0891b2">1 temp</span> <b>6.66 €</b></span>
            <span><span style="color:#1d4ed8">2 temp</span> <b>8.83 €</b></span>
          </div>
        </div>`
      );

      L.polygon(ZONE_0_POLYGON, {
        color: ZONE_STYLES[0].stroke,
        weight: 3,
        fillColor: ZONE_STYLES[0].fill,
        fillOpacity: ZONE_STYLES[0].fillOpacity,
      }).addTo(map).bindPopup(
        `<div style="${popupStyle}">
          <div style="font-weight:800;color:${ZONE_STYLES[0].stroke};margin-bottom:4px">Zona 0 · ${ZONE_STYLES[0].name}</div>
          <div style="color:#666;font-size:11px;margin-bottom:6px">1001–1050 · Vecrīga, Centrs</div>
          <div style="display:flex;gap:8px;font-size:12px">
            <span><span style="color:#0891b2">1 temp</span> <b>5.45 €</b></span>
            <span><span style="color:#1d4ed8">2 temp</span> <b>8.83 €</b></span>
          </div>
        </div>`
      );

      // Zone 3 — pink markers
      const zone3Icon = L.divIcon({
        className: "",
        html: `<div style="display:flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:${ZONE_STYLES[3].fill};border:2.5px solid white;box-shadow:0 0 0 2px ${ZONE_STYLES[3].stroke},0 2px 6px rgba(0,0,0,0.25)"></div>`,
        iconSize: [18, 18],
        iconAnchor: [9, 9],
      });
      for (const c of ZONE_3_CITIES) {
        L.marker([c.lat, c.lng], { icon: zone3Icon }).addTo(map).bindPopup(
          `<div style="${popupStyle}">
            <div style="font-weight:800;color:${ZONE_STYLES[3].stroke};margin-bottom:4px">${c.name} · Zona 3</div>
            <div style="color:#666;font-size:11px;margin-bottom:6px">${c.codes}</div>
            <div style="display:flex;gap:8px;font-size:12px">
              <span><span style="color:#0891b2">1 temp</span> <b>10.77 €</b></span>
              <span><span style="color:#1d4ed8">2 temp</span> <b>13.19 €</b></span>
            </div>
          </div>`
        );
      }

      // Add labels layer on top of polygons
      (tileMode === "dark" ? labelsDark : labelsTiles).addTo(map);

      // Pakomāti — branded markers
      const lockerIcon = L.divIcon({
        className: "",
        html: `<div style="display:flex;align-items:center;justify-content:center;width:30px;height:30px;border-radius:9px;background:linear-gradient(135deg,#53F3A4,#AD47FF);border:2.5px solid white;box-shadow:0 4px 10px rgba(0,0,0,0.3)"><svg xmlns="http://www.w3.org/2000/svg" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="6" width="18" height="14" rx="2"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="9" y1="6" x2="9" y2="20"/><line x1="15" y1="6" x2="15" y2="20"/></svg></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      for (const l of LOCKERS) {
        L.marker([l.lat, l.lng], { icon: lockerIcon, zIndexOffset: 1000 }).addTo(map).bindPopup(
          `<div style="${popupStyle}">
            <div style="font-weight:800;color:#192635;margin-bottom:2px">📦 ${l.name}</div>
            <div style="color:#666;font-size:11px;margin-bottom:4px">${l.address}</div>
            <div><span style="display:inline-flex;align-items:center;gap:3px;background:#dcfce7;color:#15803d;padding:2px 6px;border-radius:9999px;font-size:10px;font-weight:600">⏱ ${l.hours}</span></div>
            <div style="margin-top:6px;font-size:11px;color:#192635;font-weight:600">3 € / skapītis · vienmēr</div>
          </div>`
        );
      }

      const bounds = L.latLngBounds([[55.6, 20.7], [58.1, 27.6]]);
      map.fitBounds(bounds, { padding: [10, 10] });
    })();

    return () => {
      cancelled = true;
      const m = mapRef.current as { remove?: () => void } | null;
      if (m && typeof m.remove === "function") m.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tileMode]);

  return (
    <div className="relative">
      <div
        ref={containerRef}
        className="h-[520px] w-full rounded-2xl overflow-hidden shadow-lg ring-1 ring-gray-200"
        style={{ zIndex: 0 }}
      />

      {/* Top: tile mode toggle */}
      <div className="absolute top-4 left-1/2 z-[400] -translate-x-1/2 rounded-full bg-white/95 p-1 shadow-lg backdrop-blur-sm ring-1 ring-gray-200">
        <button
          onClick={() => setTileMode("light")}
          className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
            tileMode === "light" ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"
          }`}
        >
          Gaišs
        </button>
        <button
          onClick={() => setTileMode("dark")}
          className={`rounded-full px-3 py-1 text-[11px] font-bold transition ${
            tileMode === "dark" ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-900"
          }`}
        >
          Tumšs
        </button>
      </div>

      {/* Bottom-right: legend */}
      <div className="absolute bottom-4 right-4 z-[400] rounded-2xl bg-white/95 px-4 py-3 text-xs shadow-xl backdrop-blur-sm ring-1 ring-gray-200">
        <p className="mb-2 text-[10px] font-extrabold uppercase tracking-widest text-gray-400">Piegādes zonas</p>
        <div className="space-y-1.5">
          {([0, 1, 2, 3] as const).map((zoneNum) => {
            const z = ZONE_STYLES[zoneNum];
            return (
              <div key={zoneNum} className="flex items-center gap-2">
                <span
                  className="inline-block h-3 w-3 rounded-full ring-2 ring-white"
                  style={{ background: z.fill, boxShadow: `0 0 0 1px ${z.stroke}` }}
                />
                <span className="font-semibold text-gray-700">Z{zoneNum}</span>
                <span className="text-gray-500">· {z.name}</span>
                <span className="ml-auto pl-2 font-mono text-[10px] text-gray-400">{z.price}</span>
              </div>
            );
          })}
          <div className="mt-2 flex items-center gap-2 border-t border-gray-100 pt-2">
            <span
              className="inline-block h-3 w-3 rounded-full ring-2 ring-white"
              style={{ background: ZONE_STYLES[4].fill, boxShadow: `0 0 0 1px ${ZONE_STYLES[4].stroke}` }}
            />
            <span className="font-semibold text-gray-700">Pārējā Latvija</span>
            <span className="ml-auto pl-2 font-mono text-[10px] text-gray-400">{ZONE_STYLES[4].price}</span>
          </div>
          <div className="flex items-center gap-2 pt-1">
            <span
              className="inline-block h-4 w-4 rounded-md ring-2 ring-white"
              style={{
                background: "linear-gradient(135deg,#53F3A4,#AD47FF)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
              }}
            />
            <span className="font-semibold text-gray-700">Pakomāts</span>
            <span className="ml-auto pl-2 font-mono text-[10px] text-gray-400">3€</span>
          </div>
        </div>
      </div>
    </div>
  );
}
