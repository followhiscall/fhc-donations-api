// Netlify Function: POST → erstellt PayPal-Order und liefert approveUrl
exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { amount, mode } = JSON.parse(event.body || '{}');
    const amt = Math.round(Number(amount || 0));
    if (!amt || amt < 1) return { statusCode: 400, body: JSON.stringify({ error: 'Invalid amount' }) };
    if (mode === 'monthly') {
      return { statusCode: 400, body: JSON.stringify({ error: 'PayPal monthly needs Subscriptions. Use Stripe monthly.' }) };
    }

    const LIVE = (process.env.PAYPAL_ENV || 'sandbox') === 'live';
    const BASE = LIVE ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

    // Access Token holen
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

    // Order erstellen
    const orderRes = await fetch(`${BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          amount: { currency_code: 'EUR', value: String(amt) },
          description: 'Spende Follow His Call'
        }],
        application_context: {
          brand_name: 'Follow His Call',
          user_action: 'PAY_NOW',
          return_url: process.env.PAYPAL_RETURN_URL,
          cancel_url: process.env.PAYPAL_CANCEL_URL
        }
      })
    });
    const orderJson = await orderRes.json();
    if (!orderRes.ok) throw new Error(orderJson.message || 'Create order failed');

    const approveUrl = orderJson.links?.find(l => l.rel === 'approve')?.href;
    if (!approveUrl) throw new Error('Approve URL not found');

    return { statusCode: 200, body: JSON.stringify({ approveUrl, orderId: orderJson.id }) };
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: e.message || 'Unknown error' }) };
  }
};
