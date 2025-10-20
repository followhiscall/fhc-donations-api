// ✅ FOLLOW HIS CALL — PayPal Subscriptions (monatlich, fixe Beträge) mit CORS

const ALLOWED_ORIGINS = [
  'https://fhc---2025.webflow.io/' // ggf. anpassen
];

const json = (status, data, origin = '') => ({
  statusCode: status,
  headers: {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': ALLOWED_ORIGINS.includes(origin) ? origin : 'https://www.followhiscall.com',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Vary': 'Origin'
  },
  body: JSON.stringify(data)
});

exports.handler = async (event) => {
  const origin = event.headers.origin || '';

  if (event.httpMethod === 'OPTIONS') return json(200, { ok: true }, origin);
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' }, origin);

  try {
    const { planAmount } = JSON.parse(event.body || '{}'); // 25 | 50 | 100
    const allowed = [25, 50, 100];
    if (!allowed.includes(Number(planAmount))) {
      return json(400, { error: 'Invalid plan amount. Allowed: 25, 50, 100.' }, origin);
    }

    // plan_id aus Env wählen
    const planMap = {
      25: process.env.PAYPAL_PLAN_25,
      50: process.env.PAYPAL_PLAN_50,
      100: process.env.PAYPAL_PLAN_100
    };
    const plan_id = planMap[Number(planAmount)];
    if (!plan_id) return json(500, { error: 'Missing PayPal plan_id env var for this amount.' }, origin);

    const LIVE = (process.env.PAYPAL_ENV || 'sandbox') === 'live';
    const BASE = LIVE ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

    // Access Token
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

    // Subscription anlegen
    const subRes = await fetch(`${BASE}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        plan_id,
        application_context: {
          brand_name: 'Follow His Call',
          shipping_preference: 'NO_SHIPPING',
          user_action: 'SUBSCRIBE_NOW',
          return_url: process.env.PAYPAL_RETURN_URL,
          cancel_url: process.env.PAYPAL_CANCEL_URL
        }
      })
    });

    const subJson = await subRes.json();
    if (!subRes.ok) throw new Error(subJson.message || 'Create subscription failed');

    const approveUrl = subJson.links?.find(l => l.rel === 'approve')?.href;
    if (!approveUrl) throw new Error('Approve URL not found');

    return json(200, { approveUrl, subscriptionId: subJson.id }, origin);
  } catch (e) {
    console.error('[create-paypal-subscription]', e);
    return json(400, { error: e.message || 'Unknown error' }, origin);
  }
};
