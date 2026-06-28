"use client";

import { useRef } from "react";
import { Printer, Package, Snowflake, Thermometer, MapPin, X } from "lucide-react";
import type { LabelData } from "@/lib/shipping";

/**
 * Printable shipping label.
 * Shows sender, recipient, locker/address, size, temp, QR code.
 * "Drukāt" button opens the browser print dialog for just the label.
 */
export function ShippingLabel({ label, onClose }: { label: LabelData; onClose: () => void }) {
  const labelRef = useRef<HTMLDivElement>(null);

  function handlePrint() {
    if (!labelRef.current) return;
    const html = labelRef.current.innerHTML;
    const win = window.open("", "_blank", "width=420,height=600");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Leibls ${label.shipmentNumber}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:-apple-system,'Segoe UI',Roboto,Helvetica,sans-serif;color:#192635;padding:12px;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  @media print{body{padding:0}@page{margin:8mm}}
</style></head><body>${html}</body></html>`);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 300);
  }

  const isCold = label.size === "L";
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=120x120&data=${encodeURIComponent(label.shipmentNumber)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        {/* Toolbar */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
          <h3 className="font-bold text-gray-900 text-sm">Sūtījuma leibls</h3>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 rounded-lg bg-[#192635] px-4 py-2 text-xs font-bold text-white hover:bg-[#243647] transition">
              <Printer size={13} /> Drukāt
            </button>
            <button onClick={onClose} className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100">
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Printable label content */}
        <div ref={labelRef} className="p-5">
          <div style={{ border: "2px solid #192635", borderRadius: "12px", overflow: "hidden", fontFamily: "-apple-system,'Segoe UI',Roboto,sans-serif" }}>
            {/* Header */}
            <div style={{ background: "#192635", color: "#fff", padding: "12px 16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "-0.01em" }}>IziPizi</div>
                <div style={{ fontSize: "10px", color: "#53F3A4", fontWeight: 600 }}>pārtikas sūtījums</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: "14px", fontWeight: 700, fontFamily: "monospace" }}>{label.shipmentNumber}</div>
                <div style={{ fontSize: "10px", color: "#9fb4c4" }}>{label.orderNumber}</div>
              </div>
            </div>

            {/* Body */}
            <div style={{ padding: "14px 16px" }}>
              {/* Sender → Recipient */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8696a0", marginBottom: "4px" }}>Sūtītājs</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#192635" }}>{label.senderName}</div>
                  <div style={{ fontSize: "11px", color: "#5d6f78" }}>{label.senderAddress}</div>
                </div>
                <div>
                  <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#8696a0", marginBottom: "4px" }}>Saņēmējs</div>
                  <div style={{ fontSize: "13px", fontWeight: 700, color: "#192635" }}>{label.recipientName}</div>
                  <div style={{ fontSize: "11px", color: "#5d6f78" }}>{label.recipientPhone}</div>
                </div>
              </div>

              {/* Route: FROM locker → TO locker (for courier to see both) */}
              {label.fromLockerName && (
                <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", padding: "10px 12px", marginBottom: "8px" }}>
                  <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#1d4ed8", marginBottom: "4px" }}>
                    📥 NO — paņemšanas pakomāts
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "#192635" }}>{label.fromLockerName}</div>
                  <div style={{ fontSize: "11px", color: "#3b82f6" }}>
                    {label.fromLockerCity}{label.fromLockerAddress ? ` · ${label.fromLockerAddress}` : ""}
                  </div>
                </div>
              )}
              <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "10px 12px", marginBottom: "14px" }}>
                <div style={{ fontSize: "9px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", color: "#15803d", marginBottom: "4px" }}>
                  {label.deliveryType === "locker" ? "📦 UZ — piegādes pakomāts" : "🚚 Kurjers uz adresi"}
                </div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "#192635" }}>
                  {label.toLockerName ?? label.courierAddress ?? "—"}
                </div>
                <div style={{ fontSize: "12px", color: "#166534" }}>
                  {label.toLockerCity ?? label.courierCity ?? ""}
                  {label.toLockerAddress ? ` · ${label.toLockerAddress}` : ""}
                </div>
              </div>

              {/* Size + Temp + Code */}
              <div style={{ display: "flex", gap: "8px", marginBottom: "14px" }}>
                <div style={{ flex: 1, background: "#f6f7f8", borderRadius: "8px", padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: "9px", fontWeight: 700, color: "#8696a0", textTransform: "uppercase" }}>Izmērs</div>
                  <div style={{ fontSize: "22px", fontWeight: 800, color: "#192635" }}>{label.size}</div>
                </div>
                <div style={{ flex: 1, background: isCold ? "#f0e6fb" : "#e6efea", borderRadius: "8px", padding: "10px 12px", textAlign: "center" }}>
                  <div style={{ fontSize: "9px", fontWeight: 700, color: isCold ? "#AD47FF" : "#192635", textTransform: "uppercase" }}>Temperatūra</div>
                  <div style={{ fontSize: "16px", fontWeight: 800, color: isCold ? "#AD47FF" : "#192635" }}>{label.tempMode}</div>
                </div>
                {label.lockerCode && (
                  <div style={{ flex: 1, background: "#192635", borderRadius: "8px", padding: "10px 12px", textAlign: "center", color: "#fff" }}>
                    <div style={{ fontSize: "9px", fontWeight: 700, color: "#53F3A4", textTransform: "uppercase" }}>Kods</div>
                    <div style={{ fontSize: "18px", fontWeight: 800, letterSpacing: "2px", fontFamily: "monospace" }}>{label.lockerCode}</div>
                  </div>
                )}
              </div>

              {/* QR code + date */}
              <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="QR" width={90} height={90} style={{ borderRadius: "8px", border: "1px solid #dde7e1" }} />
                <div style={{ flex: 1, minWidth: 0, textAlign: "center" }}>
                  <div style={{ fontSize: "10px", color: "#8696a0" }}>
                    {new Date(label.createdAt).toLocaleDateString("lv-LV", { day: "numeric", month: "short", year: "numeric" })}
                  </div>
                  <div style={{ fontSize: "9px", color: "#8696a0", marginTop: "4px" }}>Skenē QR lai izsekotu sūtījumu</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
