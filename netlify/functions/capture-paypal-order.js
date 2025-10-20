// Netlify Function: POST → finalisiert (capture) nach Return von PayPal
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { orderId } = JSON.parse(event.body || '{}');
    if (!orderId) return { statusCode: 400, body: JSON.stringify({ error: 'Missing orderId' }) };

    const LIVE = (process.env.PAYPAL_ENV || 'sandbox') === 'live';
    const BASE = LIVE ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

    const tokenRes = await fetch(`${BASE}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString('base64'),
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: 'grant_type=client_credentials'
    });
    const tokenJson = await tokenRes.json();
    if (!tokenRes.ok) throw new Error(tokenJson.error_description || 'Auth failed');
    const token = tokenJson.access_token;

    const capRes = await fetch(`${BASE}/v2/checkout/orders/${orderId}/capture`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }
    });
    const capJson = await capRes.json();
    if (!capRes.ok) throw new Error(capJson.message || 'Capture failed');

    return { statusCode: 200, body: JSON.stringify({ status: 'captured', details: capJson }) };
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: e.message || 'Unknown error' }) };
  }
};
