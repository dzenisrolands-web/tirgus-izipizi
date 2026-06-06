-- Migration 0024: Editable email templates
-- Allows admin to edit email text without code deploy.
-- Templates use {{variable}} syntax for dynamic content.

CREATE TABLE IF NOT EXISTS email_templates (
  id          text PRIMARY KEY,
  subject     text NOT NULL,
  body_html   text NOT NULL,
  variables   text[] NOT NULL DEFAULT '{}',
  updated_at  timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE email_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS email_templates_select_all ON email_templates;
CREATE POLICY email_templates_select_all ON email_templates FOR SELECT USING (true);

-- Seed templates with current hardcoded content

INSERT INTO email_templates (id, subject, body_html, variables) VALUES

('order-buyer',
 'Pasūtījums {{orderNumber}} apmaksāts — tirgus.izipizi.lv',
 '<h1 style="margin:0 0 8px 0;font-size:22px;font-weight:800;">Paldies par pasūtījumu, {{buyerName}}!</h1>
<p style="margin:0 0 20px 0;color:#555;font-size:14px;line-height:1.6;">
  Pasūtījums <strong>{{orderNumber}}</strong> ir saņemts un apmaksāts.
  Drīzumā saņemsi paziņojumu, kad ražotājs to apstiprinās un sagatavos.
</p>
{{itemsTable}}
<div style="background:#f6f7f8;border-radius:12px;padding:16px;margin:16px 0;">
  <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#888;margin-bottom:6px;">Piegāde</div>
  <div style="font-weight:600;">{{deliveryLabel}}</div>
  <div style="margin-top:4px;color:#555;font-size:13px;">{{deliveryDetails}}</div>
</div>
<p style="margin:24px 0 0 0;color:#555;font-size:13px;line-height:1.6;">
  Statusu vari sekot <a href="{{siteUrl}}/cart/success?order={{orderNumber}}" style="color:#AD47FF;font-weight:600;">savā pasūtījumu sadaļā</a>.
</p>',
 ARRAY['buyerName','orderNumber','itemsTable','total','deliveryLabel','deliveryDetails','siteUrl']),

('order-seller',
 'Jauns pasūtījums {{orderNumber}} — tirgus.izipizi.lv',
 '<h1 style="margin:0 0 8px 0;font-size:22px;font-weight:800;">🛒 Jauns apmaksāts pasūtījums!</h1>
<p style="margin:0 0 20px 0;color:#555;font-size:14px;line-height:1.6;">
  Sveiki, <strong>{{sellerName}}</strong>!<br>
  Pircējs <strong>{{buyerName}}</strong> ir apmaksājis pasūtījumu <strong>{{orderNumber}}</strong>.
  Lūdzu apstipriniet un sagatavojiet to nosūtīšanai.
</p>
{{itemsTable}}
<div style="background:#f6f7f8;border-radius:12px;padding:16px;margin:16px 0;">
  <div style="font-size:12px;text-transform:uppercase;letter-spacing:0.05em;color:#888;margin-bottom:6px;">Piegāde</div>
  <div style="font-weight:600;">{{deliveryLabel}}</div>
  <div style="margin-top:4px;color:#555;font-size:13px;">{{deliveryDetails}}</div>
</div>
<div style="text-align:center;margin:24px 0 0 0;">
  <a href="{{siteUrl}}/dashboard/pasutijumi" style="display:inline-block;background:linear-gradient(90deg,#53F3A4,#AD47FF);color:#192635;padding:12px 32px;border-radius:9999px;font-weight:700;text-decoration:none;font-size:14px;">Apskatīt pasūtījumus →</a>
</div>',
 ARRAY['sellerName','buyerName','orderNumber','itemsTable','total','deliveryLabel','deliveryDetails','siteUrl']),

('order-admin',
 '[Admin] Jauns pasūtījums {{orderNumber}} · {{total}}€',
 '<h1 style="margin:0 0 8px 0;font-size:18px;font-weight:800;">Jauns pasūtījums {{orderNumber}}</h1>
<p style="margin:0 0 12px 0;color:#555;font-size:14px;line-height:1.6;">
  <strong>Pircējs:</strong> {{buyerName}} ({{buyerEmail}})<br>
  <strong>Piegāde:</strong> {{deliveryLabel}} — {{deliveryDetails}}<br>
  <strong>Summa:</strong> {{total}}€
</p>
<p style="margin:0;color:#555;font-size:13px;line-height:1.8;">
  <strong>Preces:</strong><br>{{itemsList}}
</p>',
 ARRAY['buyerName','buyerEmail','orderNumber','itemsList','total','deliveryLabel','deliveryDetails']),

('seller-reminder',
 'Aizpildi trūkstošo informāciju — tirgus.izipizi.lv',
 '<h1 style="margin:0 0 12px 0;font-size:22px;font-weight:800;">Sveiks, {{sellerName}}!</h1>
<p style="margin:0 0 16px 0;color:#555;font-size:14px;line-height:1.6;">
  Lai mēs varētu apstiprināt tavu profilu un sākt nogādāt pircējiem tavus produktus,
  lūdzu, papildini sekojošo informāciju savā tirgotāja profilā:
</p>
{{customMessage}}
<ol style="margin:16px 0;padding-left:20px;color:#192635;font-size:14px;line-height:1.7;">
  {{missingItems}}
</ol>
<div style="text-align:center;margin:24px 0 0 0;">
  <a href="{{siteUrl}}/dashboard/profils" style="display:inline-block;padding:12px 24px;background:linear-gradient(90deg,#53F3A4,#AD47FF);color:#192635;text-decoration:none;font-weight:700;border-radius:9999px;">
    Aizpildīt profilu →
  </a>
</div>
<p style="margin:24px 0 0 0;color:#888;font-size:12px;">
  Ja ir jautājumi, atbildi uz šo e-pastu vai raksti uz info@izipizi.lv.
</p>',
 ARRAY['sellerName','missingItems','customMessage','siteUrl']),

('invitation',
 'Uzaicinājums pievienoties tirgus.izipizi.lv',
 '<h1 style="margin:0 0 24px;font-size:26px;font-weight:700;">Tu esi uzaicināts pievienoties</h1>
<p style="margin:0 0 20px;font-size:16px;">{{greeting}}</p>
<p style="margin:0 0 20px;font-size:16px;">
  <strong>Temperatūras režīma pakomāti, piegāde un tirgotāju mārketplace</strong> — šie ir rīki, ko mēs būvējam tieši priekš Tevis!
</p>
<p style="margin:0 0 20px;font-size:16px;">
  Piedāvā savu produktu <strong>tirgus.izipizi.lv</strong> — Latvijas ražotāju tirdzniecības platformā, kur svaiga pārtika no ražotāja nonāk līdz pircējam pakomātā vai mājās.
</p>
<div style="background:#f8f8fb;border-radius:12px;padding:20px 24px;margin:24px 0;">
  <span style="display:inline-block;background:#1a1a2e;color:#53F3A4;font-weight:800;font-size:18px;padding:6px 16px;border-radius:20px;">15%</span>
  <span style="color:#2d2d3f;font-size:15px;margin-left:10px;">komisija par plūsmas vadību un maksājumu apkalpošanu</span>
</div>
<p style="margin:0 0 24px;font-size:15px;color:#5a5a6e;font-style:italic;">
  Reģistrācija ir bez maksas — komisijas maksa tiek ieturēta tikai pēc veiksmīga pirkuma.
</p>
<div style="margin:16px 0;font-size:15px;color:#2d2d3f;">
  <p>✓ Pats ievieto savus produktus — ātri un vienkārši</p>
  <p>✓ Apskati pasūtījumus reālajā laikā</p>
  <p>✓ Temperatūras režīma pakomāti</p>
  <p>✓ Temperatūras režīma un ekspres piegāde</p>
</div>
<div style="text-align:center;margin:32px 0;">
  <a href="{{registerUrl}}" style="display:inline-block;background:linear-gradient(90deg,#53F3A4,#AD47FF);color:#1a1a2e;padding:16px 40px;border-radius:99px;font-weight:800;text-decoration:none;font-size:16px;">
    Pieņemt uzaicinājumu →
  </a>
</div>',
 ARRAY['greeting','registerUrl','siteUrl'])

ON CONFLICT (id) DO NOTHING;
