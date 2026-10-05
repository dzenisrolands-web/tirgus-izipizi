-- Migration 0026: Seller order confirmation tracking + status change emails
-- Run in Supabase SQL Editor.

-- 1. Add seller confirmation tracking to orders
-- JSONB map: { "seller-uuid": { "confirmed_at": "ISO", "viewed_at": "ISO" } }
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS seller_confirmations jsonb DEFAULT '{}'::jsonb;

-- 2. Status change email templates for buyer notifications
INSERT INTO email_templates (id, subject, body_html, variables) VALUES

('order-processing',
 'Ražotājs apstiprināja pasūtījumu {{orderNumber}} — tirgus.izipizi.lv',
 '<h1 style="margin:0 0 8px 0;font-size:22px;font-weight:800;">👨‍🍳 Tavs pasūtījums tiek gatavots!</h1>
<p style="margin:0 0 20px 0;color:#555;font-size:14px;line-height:1.6;">
  Sveiks, <strong>{{buyerName}}</strong>!<br>
  Ražotājs ir apstiprinājis pasūtījumu <strong>{{orderNumber}}</strong> un sāk to sagatavot.
  Drīz paziņosim, kad tas būs gatavs saņemšanai.
</p>
<div style="background:#f0f7ff;border-radius:12px;padding:16px;margin:16px 0;border-left:4px solid #3b82f6;">
  <p style="margin:0;font-size:14px;color:#1e40af;font-weight:600;">Statuss: Apstrādē</p>
  <p style="margin:4px 0 0;font-size:13px;color:#555;">Ražotājs gatavo tavu pasūtījumu nosūtīšanai.</p>
</div>
<div style="text-align:center;margin:24px 0;">
  <a href="{{siteUrl}}/profils/pasutijumi" style="display:inline-block;background:linear-gradient(90deg,#53F3A4,#AD47FF);color:#192635;padding:12px 32px;border-radius:9999px;font-weight:700;text-decoration:none;font-size:14px;">Skatīt pasūtījumu →</a>
</div>',
 ARRAY['buyerName','orderNumber','siteUrl']),

('order-shipped',
 'Pasūtījums {{orderNumber}} ir gatavs saņemšanai! — tirgus.izipizi.lv',
 '<h1 style="margin:0 0 8px 0;font-size:22px;font-weight:800;">📦 Tavs pasūtījums gaida tevi!</h1>
<p style="margin:0 0 20px 0;color:#555;font-size:14px;line-height:1.6;">
  Sveiks, <strong>{{buyerName}}</strong>!<br>
  Pasūtījums <strong>{{orderNumber}}</strong> ir ievietots pakomātā un gatavs saņemšanai.
</p>
<div style="background:#f0fdf4;border-radius:12px;padding:16px;margin:16px 0;border-left:4px solid #22c55e;">
  <p style="margin:0;font-size:14px;color:#166534;font-weight:600;">{{deliveryLabel}}</p>
  <p style="margin:4px 0 0;font-size:13px;color:#555;">{{deliveryDetails}}</p>
  {{lockerCode}}
</div>
<div style="text-align:center;margin:24px 0;">
  <a href="{{siteUrl}}/profils/pasutijumi" style="display:inline-block;background:linear-gradient(90deg,#53F3A4,#AD47FF);color:#192635;padding:12px 32px;border-radius:9999px;font-weight:700;text-decoration:none;font-size:14px;">Skatīt pasūtījumu →</a>
</div>
<p style="margin:24px 0 0;color:#888;font-size:12px;">
  Saņem pasūtījumu 48h laikā. Ja nepaspēj — sazinies ar mums.
</p>',
 ARRAY['buyerName','orderNumber','deliveryLabel','deliveryDetails','lockerCode','siteUrl']),

('order-delivered',
 'Paldies par pasūtījumu {{orderNumber}}! — tirgus.izipizi.lv',
 '<h1 style="margin:0 0 8px 0;font-size:22px;font-weight:800;">✅ Pasūtījums saņemts!</h1>
<p style="margin:0 0 20px 0;color:#555;font-size:14px;line-height:1.6;">
  Sveiks, <strong>{{buyerName}}</strong>!<br>
  Pasūtījums <strong>{{orderNumber}}</strong> ir veiksmīgi saņemts. Paldies, ka iepērcies no vietējiem ražotājiem!
</p>
<div style="background:#fefce8;border-radius:12px;padding:16px;margin:16px 0;border-left:4px solid #eab308;">
  <p style="margin:0;font-size:14px;color:#854d0e;font-weight:600;">⭐ Kā Tev patika?</p>
  <p style="margin:4px 0 0;font-size:13px;color:#555;">Atstāj atsauksmi — palīdzi citiem pircējiem izvēlēties!</p>
</div>
<div style="text-align:center;margin:24px 0;">
  <a href="{{siteUrl}}/profils/pasutijumi" style="display:inline-block;background:linear-gradient(90deg,#53F3A4,#AD47FF);color:#192635;padding:12px 32px;border-radius:9999px;font-weight:700;text-decoration:none;font-size:14px;">Atstāt atsauksmi →</a>
</div>',
 ARRAY['buyerName','orderNumber','siteUrl'])

ON CONFLICT (id) DO NOTHING;
