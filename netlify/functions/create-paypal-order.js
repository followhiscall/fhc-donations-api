// FOLLOW HIS CALL — PayPal Order (One-Time) mit CORS

const ALLOWED_ORIGINS = [
  'https://www.followhiscall.com',
  'https://followhiscall.com',
  'https://fhc---2025.webflow.io', // Webflow Preview (genau so, mit 3 Bindestrichen!)
  'https://fhc.webflow.io'         // optional
];

const json = (status, data, origin = '') => {
  const allowed = ALLOWED_ORIGINS.includes(origin) ? origin : null;
  return {
    statusCode: allowed ? status : 403,
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': allowed || 'https://www.followhiscall.com',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Vary': 'Origin'
    },
    body: JSON.stringify(allowed ? data : { error: 'Origin not allowed' })
  };
};

exports.handler = async (event) => {
  const origin = event.headers.origin || '';
  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true }, origin);
  if (event.httpMethod !== 'POST')   return json(405, { error: 'Method not allowed' }, origin);

  try {
    const { amount, mode } = JSON.parse(event.body || '{}');
    const amt = Math.round(Number(amount || 0));
    if (!amt || amt < 1) return json(400, { error: 'Invalid amount' }, origin);

    // Hinweis: mode wird nur geloggt, Einmalzahlung hier immer CAPTURE
    const LIVE = (process.env.PAYPAL_ENV || 'sandbox') === 'live';
    const BASE = LIVE ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

    // Access Token
    const tRes = await fetch(`${BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    const tJson = await tRes.json();
    if (!tRes.ok) throw new Error(tJson.error_description || 'Auth failed');
    const token = tJson.access_token;

    // Order erstellen
    const oRes = await fetch(`${BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
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
    const oJson = await oRes.json();
    if (!oRes.ok) throw new Error(oJson.message || 'Create order failed');

    const approveUrl = oJson.links?.find(l => l.rel === 'approve')?.href;
    if (!approveUrl) throw new Error('Approve URL not found');

    return json(200, { approveUrl, orderId: oJson.id }, origin);
  } catch (e) {
    console.error('[create-paypal-order]', e);
    return json(400, { error: e.message || 'Unknown error' }, origin);
  }
};
