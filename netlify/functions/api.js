// Netlify Serverless Function for GoWellWith API
const fs = require('fs');
const path = require('path');
const { sellers, creators, products, orders, webhookLogs } = require('../../store');
const stripeService = require('../../stripeService');

const TMP_ORDERS_FILE = path.join('/tmp', 'gowellwith_orders.json');
const TMP_SELLERS_FILE = path.join('/tmp', 'gowellwith_sellers.json');

// Helper to load persistent orders across serverless invocations within container lifetime
function getPersistentOrders() {
  try {
    if (fs.existsSync(TMP_ORDERS_FILE)) {
      const data = fs.readFileSync(TMP_ORDERS_FILE, 'utf8');
      return JSON.parse(data);
    }
  } catch (e) {}
  return orders;
}

function savePersistentOrders(list) {
  try {
    fs.writeFileSync(TMP_ORDERS_FILE, JSON.stringify(list), 'utf8');
  } catch (e) {}
}

exports.handler = async (event, context) => {
  const path = event.path.replace(/^\/\.netlify\/functions\/api/, '').replace(/^\/api/, '');
  const method = event.httpMethod;

  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS'
  };

  if (method === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  try {
    // GET /config
    if (path === '/config' && method === 'GET') {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          appName: 'GoWellWith (Paired) Social-Commerce',
          version: '1.0.0',
          phase: 'Phase 1 MVP',
          stripe: stripeService.getStripeMode()
        })
      };
    }

    // GET /products
    if (path === '/products' && method === 'GET') {
      const stage = event.queryStringParameters && event.queryStringParameters.stage;
      const list = stage ? products.filter(p => p.stage === stage) : products;
      return { statusCode: 200, headers, body: JSON.stringify(list) };
    }

    // GET /products/:id
    if (path.startsWith('/products/') && method === 'GET') {
      const id = path.replace('/products/', '');
      const product = products.find(p => p.id === id);
      if (!product) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Product not found' }) };
      }
      return { statusCode: 200, headers, body: JSON.stringify({ ...product, sellerDetails: sellers[product.sellerId] || null }) };
    }

    // GET /sellers
    if (path === '/sellers' && method === 'GET') {
      return { statusCode: 200, headers, body: JSON.stringify(Object.values(sellers)) };
    }

    // GET /sellers/:id
    if (path.startsWith('/sellers/') && method === 'GET') {
      const id = path.replace('/sellers/', '');
      const seller = sellers[id];
      if (!seller) {
        return { statusCode: 404, headers, body: JSON.stringify({ error: 'Seller not found' }) };
      }
      const sellerProducts = products.filter(p => p.sellerId === id);
      const allOrders = getPersistentOrders();
      const sellerOrders = allOrders.filter(o => o.sellerId === id);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          ...seller,
          products: sellerProducts,
          orders: sellerOrders
        })
      };
    }

    // POST /stripe-connect/create-account
    if (path === '/stripe-connect/create-account' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await stripeService.createConnectedAccount(body);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // POST /stripe-connect/account-link
    if (path === '/stripe-connect/account-link' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await stripeService.createAccountLink(body);
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // POST /stripe-connect/toggle-status
    if (path === '/stripe-connect/toggle-status' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const updated = stripeService.updateSellerStatus(body.sellerId, body.status);
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, seller: updated }) };
    }

    // POST /checkout/process
    if (path === '/checkout/process' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const result = await stripeService.processCheckout({
        productId: body.productId,
        quantity: body.quantity,
        customerName: body.customerName,
        simulateFailure: Boolean(body.simulateFailure)
      });
      if (result.order) {
        const current = getPersistentOrders();
        current.unshift(result.order);
        savePersistentOrders(current);
      }
      return { statusCode: 200, headers, body: JSON.stringify(result) };
    }

    // GET /orders
    if (path === '/orders' && method === 'GET') {
      const allOrders = getPersistentOrders();
      const sellerId = event.queryStringParameters && event.queryStringParameters.sellerId;
      const filtered = sellerId ? allOrders.filter(o => o.sellerId === sellerId) : allOrders;
      return { statusCode: 200, headers, body: JSON.stringify(filtered) };
    }

    // POST /webhooks/stripe
    if (path === '/webhooks/stripe' && method === 'POST') {
      const sig = event.headers['stripe-signature'] || event.headers['Stripe-Signature'];
      const rawBody = event.isBase64Encoded ? Buffer.from(event.body, 'base64').toString('utf8') : event.body;
      const { verified, event: stripeEvt, error, isDemo } = stripeService.verifyWebhookSignature(rawBody, sig);
      if (!verified) {
        return { statusCode: 400, headers, body: JSON.stringify({ error: `Signature verification failed: ${error}` }) };
      }
      let eventType = 'payment_intent.succeeded';
      let eventData = {};
      try {
        const parsed = JSON.parse(rawBody || '{}');
        eventType = isDemo ? (parsed.type || 'payment_intent.succeeded') : stripeEvt.type;
        eventData = isDemo ? (parsed.data || parsed) : stripeEvt.data.object;
      } catch (e) {}
      stripeService.recordWebhookEvent(eventType, eventData, true);
      return { statusCode: 200, headers, body: JSON.stringify({ received: true, type: eventType }) };
    }

    // GET /webhooks/logs
    if (path === '/webhooks/logs' && method === 'GET') {
      return { statusCode: 200, headers, body: JSON.stringify(webhookLogs) };
    }

    // POST /webhooks/simulate
    if (path === '/webhooks/simulate' && method === 'POST') {
      const body = JSON.parse(event.body || '{}');
      const eventRecord = stripeService.recordWebhookEvent(body.type || 'payment_intent.succeeded', {
        orderId: body.orderId,
        ...body.data
      });
      return { statusCode: 200, headers, body: JSON.stringify({ success: true, event: eventRecord }) };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: 'Route not found' }) };
  } catch (err) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: err.message })
    };
  }
};
