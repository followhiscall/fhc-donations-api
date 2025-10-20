// FOLLOW HIS CALL — PayPal Capture (One-Time) mit CORS

const ALLOWED_ORIGINS = [
  'https://www.followhiscall.com',
  'https://followhiscall.com',
  'https://fhc---2025.webflow.io',
  'https://fhc.webflow.io'
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
    const { orderId } = JSON.parse(event.body || '{}');
    if (!orderId) return json(400, { error: 'Missing orderId' }, origin);

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

    // Capture
    const cRes = await fetch(`${BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const cJson = await cRes.json();
    if (!cRes.ok) throw new Error(cJson.message || 'Capture failed');

    return json(200, { status: 'captured', details: cJson }, origin);
  } catch (e) {
    console.error('[capture-paypal-order]', e);
    return json(400, { error: e.message || 'Unknown error' }, origin);
  }
};
