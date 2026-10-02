require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const { sellers, creators, products, orders, webhookLogs } = require('./store');
const stripeService = require('./stripeService');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

// Webhook endpoint needs raw body for Stripe signature verification
app.post(
  '/api/webhooks/stripe',
  express.raw({ type: 'application/json' }),
  (req, res) => {
    const signature = req.headers['stripe-signature'];
    const { verified, event, error, isDemo } = stripeService.verifyWebhookSignature(req.body, signature);

    if (!verified) {
      console.warn('[Webhook] Signature verification failed:', error);
      return res.status(400).json({ error: `Webhook signature verification failed: ${error}` });
    }

    let eventData;
    let eventType;

    try {
      if (isDemo) {
        const bodyStr = req.body.toString('utf8');
        const parsed = JSON.parse(bodyStr || '{}');
        eventType = parsed.type || 'payment_intent.succeeded';
        eventData = parsed.data || parsed;
      } else {
        eventType = event.type;
        eventData = event.data.object;
      }

      stripeService.recordWebhookEvent(eventType, eventData, true);
      console.log(`[Webhook] Processed event ${eventType}`);
      res.json({ received: true, type: eventType });
    } catch (err) {
      console.error('[Webhook] Processing error:', err);
      res.status(500).json({ error: err.message });
    }
  }
);

// Standard JSON body parsing for all other routes
app.use(express.json());

// Serve static frontend files from /public and root
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));

// ==================== API ROUTES ====================

// System configuration & Stripe mode
app.get('/api/config', (req, res) => {
  res.json({
    appName: 'GoWellWith (Paired) Social-Commerce',
    version: '1.0.0',
    phase: 'Phase 1 MVP',
    stripe: stripeService.getStripeMode()
  });
});

// Products
app.get('/api/products', (req, res) => {
  const { stage } = req.query;
  if (stage) {
    return res.json(products.filter(p => p.stage === stage));
  }
  res.json(products);
});

app.get('/api/products/:id', (req, res) => {
  const product = products.find(p => p.id === req.params.id);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  const seller = sellers[product.sellerId] || null;
  res.json({ ...product, sellerDetails: seller });
});

// Sellers
app.get('/api/sellers', (req, res) => {
  res.json(Object.values(sellers));
});

app.get('/api/sellers/:id', async (req, res) => {
  try {
    const status = await stripeService.getAccountStatus(req.params.id);
    const seller = sellers[req.params.id];
    const sellerProducts = products.filter(p => p.sellerId === req.params.id);
    const sellerOrders = orders.filter(o => o.sellerId === req.params.id);

    res.json({
      ...seller,
      stripeStatusDetails: status,
      products: sellerProducts,
      orders: sellerOrders
    });
  } catch (err) {
    res.status(404).json({ error: err.message });
  }
});

// Stripe Connect: Create account
app.post('/api/stripe-connect/create-account', async (req, res) => {
  try {
    const { sellerId, email, businessName, country } = req.body;
    if (!sellerId) {
      return res.status(400).json({ error: 'sellerId is required' });
    }
    const result = await stripeService.createConnectedAccount({ sellerId, email, businessName, country });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stripe Connect: Create Account Link
app.post('/api/stripe-connect/account-link', async (req, res) => {
  try {
    const { sellerId, refreshUrl, returnUrl } = req.body;
    if (!sellerId) {
      return res.status(400).json({ error: 'sellerId is required' });
    }
    const result = await stripeService.createAccountLink({ sellerId, refreshUrl, returnUrl });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stripe Connect: Toggle Status (Demo convenience method)
app.post('/api/stripe-connect/toggle-status', (req, res) => {
  try {
    const { sellerId, status } = req.body;
    if (!sellerId || !status) {
      return res.status(400).json({ error: 'sellerId and status are required' });
    }
    const updated = stripeService.updateSellerStatus(sellerId, status);
    res.json({ success: true, seller: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Checkout / Payment Processing
app.post('/api/checkout/process', async (req, res) => {
  try {
    const { productId, quantity, customerName, customerEmail, simulateFailure, paymentMethodType } = req.body;
    if (!productId) {
      return res.status(400).json({ error: 'productId is required' });
    }

    const result = await stripeService.processCheckout({
      productId,
      quantity,
      customerName,
      customerEmail,
      simulateFailure: Boolean(simulateFailure),
      paymentMethodType
    });

    res.json(result);
  } catch (err) {
    console.error('[Checkout Error]', err);
    res.status(500).json({ error: err.message });
  }
});

// Orders & Transactions
app.get('/api/orders', (req, res) => {
  const { sellerId, creatorTag, status } = req.query;
  let filtered = [...orders];

  if (sellerId) {
    filtered = filtered.filter(o => o.sellerId === sellerId);
  }
  if (creatorTag) {
    filtered = filtered.filter(o => o.creatorTag === creatorTag);
  }
  if (status) {
    filtered = filtered.filter(o => o.paymentStatus === status);
  }

  res.json(filtered);
});

app.get('/api/orders/:orderId', (req, res) => {
  const order = orders.find(o => o.orderId === req.params.orderId);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }
  res.json(order);
});

// Webhook Logs & Simulation
app.get('/api/webhooks/logs', (req, res) => {
  res.json(webhookLogs);
});

app.post('/api/webhooks/simulate', (req, res) => {
  const { type, orderId, data } = req.body;
  const event = stripeService.recordWebhookEvent(type || 'payment_intent.succeeded', {
    orderId,
    ...data
  });
  res.json({ success: true, event });
});

// Creators list
app.get('/api/creators', (req, res) => {
  res.json(Object.values(creators));
});

// SPA fallback for HTML routes
app.get('*', (req, res, next) => {
  // If request contains a file extension or is an API route, pass through
  if (req.path.includes('.') || req.path.startsWith('/api')) {
    return next();
  }
  const cleanPath = req.path.replace(/^\//, '');
  const htmlFile = path.join(__dirname, 'public', `${cleanPath}.html`);
  res.sendFile(htmlFile, (err) => {
    if (err) {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
  });
});

app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(` GoWellWith (Paired) Social-Commerce MVP`);
  console.log(` Server running on http://localhost:${PORT}`);
  console.log(` Stripe Status: ${stripeService.getStripeMode().mode}`);
  console.log(`====================================================`);
});
