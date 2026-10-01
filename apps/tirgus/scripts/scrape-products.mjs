/**
 * Scrapes all products from tirgus.izipizi.lv and writes to lib/real-products.json
 * Run: node scripts/scrape-products.mjs
 */
import https from "https";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, "../lib/real-products.json");
const BASE = "https://business.izipizi.lv/images/marketplace/products/";
const LOGO = "https://business.izipizi.lv/images/marketplace/logos/";
const HOST = "tirgus.izipizi.lv";
const IP = "85.31.101.215";

const SELLER_IDS = [7, 8, 9, 12, 13, 14];

function fetch(sellerId) {
  return new Promise((resolve, reject) => {
    const opts = {
      hostname: IP,
      path: `/razotajs/${sellerId}`,
      method: "GET",
      headers: { Host: HOST },
      rejectUnauthorized: false,
    };
    const req = https.request(opts, (res) => {
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => resolve(data));
    });
    req.on("error", reject);
    req.end();
  });
}

function parseProducts(html, sellerId) {
  // Extract seller name
  const nameMatch = html.match(/<h1>([^<]+)<\/h1>/);
  const sellerName = nameMatch ? nameMatch[1].trim() : `Seller ${sellerId}`;

  // Extract seller logo
  const logoMatch = html.match(/class='img'[^>]*style='background-image:url\(([^)]+logos\/[^)]+)\)/);
  const logoAlt = html.match(/<img src='(https:\/\/business\.izipizi\.lv\/images\/marketplace\/logos\/[^']+)'/);
  const logo = (logoMatch?.[1] || logoAlt?.[1] || "").trim();

  // Extract seller description (short)
  const descMatch = html.match(/class='textLeft razotajsDescShort'[^>]*>\s*([\s\S]*?)<label/);
  const sellerDesc = descMatch ? descMatch[1].replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim() : "";

  // Extract minimum order
  const minOrderMatch = html.match(/Minimāl[^<]+\d+[.,]\d+\s*Eur/);
  const minOrder = minOrderMatch ? minOrderMatch[0].trim() : null;

  // Extract product name+price pairs from cart listing section
  // Format: "Product name - 9.00&euro; X"
  const cartPairs = [];
  const cartRe = /([^<>\n]+?)\s*-\s*(\d+[.,]\d+)&euro;\s*X/g;
  let m;
  while ((m = cartRe.exec(html)) !== null) {
    const rawName = m[1].trim();
    const price = parseFloat(m[2].replace(",", "."));
    if (rawName && price > 0) {
      cartPairs.push({ rawName, price });
    }
  }

  // Extract product images in carousel order
  const imgRe = /class='productsCarouselItem[^']*'>\s*<div class='img' style='background-image:url\(([^)]+)\)'/g;
  const images = [];
  while ((m = imgRe.exec(html)) !== null) {
    images.push(m[1].trim());
  }

  // Extract h3 product names in order (first set = carousel order)
  const h3Re = /<h3>([^<]+)<\/h3>/g;
  const h3names = [];
  while ((m = h3Re.exec(html)) !== null) {
    h3names.push(m[1].trim());
  }
  // h3 names are duplicated (carousel + modal), take first half
  const uniqueH3 = h3names.slice(0, Math.ceil(h3names.length / 2));

  // Extract per-product descriptions from modal detail sections
  // Each product modal has: <img src='...'> then description text then <br style='display:block; clear:both;'>
  const modalRe = /<img src='(https:\/\/business\.izipizi\.lv\/images\/marketplace\/products\/[^']+)'[^>]*>([\s\S]*?)(?=<img src='https:\/\/business\.izipizi\.lv\/images\/marketplace\/products\/|<\/main>)/g;
  const modals = [];
  while ((m = modalRe.exec(html)) !== null) {
    const imgUrl = m[1];
    const block = m[2];
    const rawDesc = block
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^\s*X?\s*/, "");
    modals.push({ imgUrl, rawDesc });
  }

  // Build product list: match h3 names with images and cart prices
  const products = [];
  for (let i = 0; i < uniqueH3.length; i++) {
    const name = uniqueH3[i];
    const img = images[i] || null;

    // Find price from cartPairs — try exact match first, then startsWith
    let priceEntry = cartPairs.find((p) => p.rawName === name);
    if (!priceEntry) {
      priceEntry = cartPairs.find((p) => p.rawName.startsWith(name) || name.startsWith(p.rawName.split("-")[0].trim()));
    }
    const price = priceEntry?.price ?? null;

    // Find description from modals matching the image
    const modal = img ? modals.find((md) => md.imgUrl === img) : null;
    const description = modal?.rawDesc || null;

    products.push({
      id: `${sellerId}_${i + 1}`,
      name,
      price,
      image: img,
      description: description || null,
    });
  }

  return {
    id: sellerId,
    name: sellerName,
    logo,
    description: sellerDesc,
    minOrder,
    products,
  };
}

async function main() {
  const result = {};
  for (const id of SELLER_IDS) {
    console.log(`Fetching seller ${id}...`);
    try {
      const html = await fetch(id);
      const seller = parseProducts(html, id);
      result[id] = seller;
      console.log(`  ✓ ${seller.name} — ${seller.products.length} products`);
    } catch (e) {
      console.error(`  ✗ seller ${id}: ${e.message}`);
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  fs.writeFileSync(OUT, JSON.stringify(result, null, 2), "utf8");
  console.log(`\nSaved to ${OUT}`);

  // Print summary
  let total = 0;
  for (const [id, s] of Object.entries(result)) {
    console.log(`  ${s.name}: ${s.products.length} products`);
    total += s.products.length;
  }
  console.log(`Total: ${total} products`);
}

main().catch(console.error);
