// ✅ FOLLOW HIS CALL — PayPal Capture (mit CORS-Schutz)

// -----------------------------
// 1️⃣ Erlaubte Domains
// -----------------------------
const ALLOWED_ORIGINS = [
  'https://fhc---2025.webflow.io/' // ← dein Webflow Preview Domain
];

// -----------------------------
// 2️⃣ Helper für JSON-Response mit CORS
// -----------------------------
const json = (status, data, origin = '') => ({
  statusCode: status,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin)
      ? origin
      : 'https://www.followhiscall.com',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  },
  body: JSON.stringify(data)
});

// -----------------------------
// 3️⃣ Hauptfunktion
// -----------------------------
exports.handler = async (event) => {
  const origin = event.headers.origin || '';

  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true }, origin);
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' }, origin);
  }

  try {
    const { orderId } = JSON.parse(event.body || '{}');
    if (!orderId)
      return json(400, { error: 'Missing orderId' }, origin);

    const LIVE = (process.env.PAYPAL_ENV || 'sandbox') === 'live';
    const BASE = LIVE
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    // Access Token
    const tokenRes = await fetch(`${BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization:
          'Basic ' +
          Buffer.from(
            `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`
          ).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });

    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok)
      throw new Error(tokenJson.error_description || 'Auth failed');
    const token = tokenJson.access_token;

    // Zahlung finalisieren
    const capRes = await fetch(
      `${BASE}/v2/checkout/orders/${orderId}/capture`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const capJson = await capRes.json();
    if (!capRes.ok)
      throw new Error(capJson.message || 'Capture failed');

    return json(200, { status: 'captured', details: capJson }, origin);
  } catch (e) {
    console.error('[capture-paypal-order]', e);
    return json(400, { error: e.message || 'Unknown error' }, origin);
  }
};
