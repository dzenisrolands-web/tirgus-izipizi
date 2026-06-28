/**
 * Shipping utilities for generating labels from marketplace orders.
 */

export type ShipmentSize = "M" | "L" | "XL";
export type TempMode = "chilled" | "frozen";

export const SIZES: { id: ShipmentSize; label: string; temp: string; dims: string; cold: boolean }[] = [
  { id: "M",  label: "M — Atdzesēts",  temp: "+2…+6 °C", dims: "39 × 35 × 18 cm", cold: false },
  { id: "XL", label: "L — Atdzesēts",  temp: "+2…+6 °C", dims: "39 × 35 × 58 cm", cold: false },
  { id: "L",  label: "Saldēts",         temp: "−18 °C",   dims: "39 × 35 × 38 cm", cold: true },
];

export type LabelData = {
  shipmentNumber: string;
  orderNumber: string;
  // Sender (seller)
  senderName: string;
  senderPhone: string;
  senderAddress: string;
  // Recipient (buyer)
  recipientName: string;
  recipientPhone: string;
  // Delivery
  deliveryType: "locker" | "courier";
  lockerName?: string;
  lockerAddress?: string;
  lockerCity?: string;
  courierAddress?: string;
  courierCity?: string;
  // Shipment
  size: ShipmentSize;
  tempMode: string;
  lockerCode?: string;
  // Meta
  createdAt: string;
  itemsSummary: string;
};

/** Generate shipment number: IZI-YYYYMMDD-XXXX */
export function generateShipmentNumber(): string {
  const d = new Date();
  const date = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `IZI-${date}-${rand}`;
}
