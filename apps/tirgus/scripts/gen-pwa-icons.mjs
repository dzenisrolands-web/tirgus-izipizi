// One-shot icon generator for PWA install assets.
// Source: public/izipizi-logo.png (transparent, 800×800).
// Outputs: public/icon-192.png, icon-512.png, icon-512-maskable.png,
//          apple-touch-icon.png, favicon.ico
import sharp from "sharp";
import { writeFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const src = resolve(root, "public/izipizi-logo.png");
const SPLASH = "#192635"; // brand dark navy — matches PWA theme/splash

const out = (name) => resolve(root, "public", name);

// Transparent any-purpose icons (Android/desktop with rounded mask)
await sharp(src).resize(192, 192, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png().toFile(out("icon-192.png"));
await sharp(src).resize(512, 512, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png().toFile(out("icon-512.png"));

// Maskable: full-bleed brand bg with logo at 70% (safe zone for round masks)
const maskableLogo = await sharp(src).resize(360, 360, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: SPLASH },
})
  .composite([{ input: maskableLogo, gravity: "center" }])
  .png().toFile(out("icon-512-maskable.png"));

// Apple touch icon (iOS doesn't support transparency — solid bg required)
const appleLogo = await sharp(src).resize(140, 140, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
await sharp({
  create: { width: 180, height: 180, channels: 4, background: SPLASH },
})
  .composite([{ input: appleLogo, gravity: "center" }])
  .png().toFile(out("apple-touch-icon.png"));

// Favicon (32×32 PNG renamed to .ico — modern browsers accept it)
await sharp(src).resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png().toFile(out("favicon.png"));

// Write favicon.ico as a copy of favicon.png — Chrome/Firefox/Safari accept PNG inside .ico
const png32 = await sharp(src).resize(32, 32, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png().toBuffer();
await writeFile(out("favicon.ico"), png32);

console.log("PWA icons generated:");
console.log("  - icon-192.png");
console.log("  - icon-512.png");
console.log("  - icon-512-maskable.png");
console.log("  - apple-touch-icon.png");
console.log("  - favicon.png + favicon.ico");
