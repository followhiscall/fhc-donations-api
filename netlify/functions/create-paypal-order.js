// ✅ FOLLOW HIS CALL — PayPal Order Creation (mit CORS-Schutz)

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

  // Preflight-Check (für Browser)
  if (event.httpMethod === 'OPTIONS') {
    return json(200, { ok: true }, origin);
  }

  if (event.httpMethod !== 'POST') {
    return json(405, { error: 'Method not allowed' }, origin);
  }

  try {
    const { amount, mode } = JSON.parse(event.body || '{}');
    const amt = Math.round(Number(amount || 0));
    if (!amt || amt < 1)
      return json(400, { error: 'Invalid amount' }, origin);

    if (mode === 'monthly') {
      return json(400, {
        error:
          'PayPal monthly needs Subscriptions. Use Stripe for monthly.'
      }, origin);
    }

    const LIVE = (process.env.PAYPAL_ENV || 'sandbox') === 'live';
    const BASE = LIVE
      ? 'https://api-m.paypal.com'
      : 'https://api-m.sandbox.paypal.com';

    // 1️⃣ Access Token
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

    // 2️⃣ Order erstellen
    const orderRes = await fetch(`${BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            amount: { currency_code: 'EUR', value: String(amt) },
            description: 'Spende Follow His Call'
          }
        ],
        application_context: {
          brand_name: 'Follow His Call',
          user_action: 'PAY_NOW',
          return_url: process.env.PAYPAL_RETURN_URL,
          cancel_url: process.env.PAYPAL_CANCEL_URL
        }
      })
    });

    const orderJson = await orderRes.json();
    if (!orderRes.ok)
      throw new Error(orderJson.message || 'Create order failed');

    const approveUrl = orderJson.links?.find(
      (l) => l.rel === 'approve'
    )?.href;
    if (!approveUrl) throw new Error('Approve URL not found');

    return json(200, { approveUrl, orderId: orderJson.id }, origin);
  } catch (e) {
    console.error('[create-paypal-order]', e);
    return json(400, { error: e.message || 'Unknown error' }, origin);
  }
};
