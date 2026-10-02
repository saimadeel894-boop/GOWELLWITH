// Stripe Connect & Payment Service for GoWellWith
// Supports:
// 1. Production / Test Mode (when STRIPE_SECRET_KEY is provided)
// 2. High-Fidelity Demo Mode (when STRIPE_SECRET_KEY is not provided)
// Ensures zero hardcoded credentials and strictly server-side fee/price validation.

const { sellers, creators, products, orders, webhookLogs, calculateSplit } = require('./store');

let stripe = null;
const isStripeConfigured = Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_SECRET_KEY.startsWith('sk_'));

if (isStripeConfigured) {
  try {
    const Stripe = require('stripe');
    stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2023-10-16'
    });
    console.log('[Stripe Service] Initialized with real Stripe credentials (TEST/LIVE mode)');
  } catch (err) {
    console.warn('[Stripe Service] Failed to initialize Stripe client, falling back to Demo Mode:', err.message);
  }
} else {
  console.log('[Stripe Service] No STRIPE_SECRET_KEY provided. Running in high-fidelity Demo Payment Mode.');
}

/**
 * Checks whether real Stripe credentials are active
 */
function getStripeMode() {
  return {
    isRealStripe: Boolean(stripe),
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY || null,
    mode: stripe ? 'stripe_test' : 'demo_mode'
  };
}

/**
 * Creates or retrieves a Stripe Connect Custom/Express account for a seller
 */
async function createConnectedAccount({ sellerId, email, businessName, country = 'US' }) {
  const seller = sellers[sellerId];
  if (!seller) {
    throw new Error(`Seller ${sellerId} not found`);
  }

  if (stripe) {
    // Real Stripe Connect Account creation
    try {
      const account = await stripe.accounts.create({
        type: 'express',
        country: country || 'US',
        email: email || seller.email,
        business_type: 'individual',
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        },
        metadata: {
          platform: 'GoWellWith',
          sellerId: seller.id,
          businessName: businessName || seller.name
        }
      });

      seller.stripeAccountId = account.id;
      seller.stripeStatus = 'onboarding';
      seller.payoutsEnabled = account.payouts_enabled;
      seller.chargesEnabled = account.charges_enabled;

      return {
        success: true,
        accountId: account.id,
        status: seller.stripeStatus,
        mode: 'stripe_test'
      };
    } catch (err) {
      console.error('[Stripe Connect] Error creating account:', err);
      throw new Error(`Stripe Connect account creation failed: ${err.message}`);
    }
  }

  // Demo Mode: simulate realistic connected account
  const demoAccountId = `acct_1N_demo_${sellerId.replace(/[^a-zA-Z0-9]/g, '')}_${Date.now().toString(36)}`;
  seller.stripeAccountId = demoAccountId;
  seller.stripeStatus = 'onboarding';
  seller.email = email || seller.email;
  seller.name = businessName || seller.name;

  return {
    success: true,
    accountId: demoAccountId,
    status: seller.stripeStatus,
    mode: 'demo_mode',
    message: 'Simulated Stripe Express account initialized for onboarding'
  };
}

/**
 * Generates a Stripe Onboarding Account Link URL
 */
async function createAccountLink({ sellerId, refreshUrl, returnUrl }) {
  const seller = sellers[sellerId];
  if (!seller || !seller.stripeAccountId) {
    throw new Error('Seller does not have an associated Stripe account ID');
  }

  if (stripe) {
    try {
      const accountLink = await stripe.accountLinks.create({
        account: seller.stripeAccountId,
        refresh_url: refreshUrl || 'https://gowellwith.netlify.app/seller-dashboard?stripe=refresh',
        return_url: returnUrl || 'https://gowellwith.netlify.app/seller-dashboard?stripe=success',
        type: 'account_onboarding'
      });
      return {
        url: accountLink.url,
        mode: 'stripe_test'
      };
    } catch (err) {
      console.error('[Stripe Connect] AccountLink error:', err);
      throw new Error(`Failed to generate Stripe onboarding link: ${err.message}`);
    }
  }

  // Demo Mode: Provide an in-app simulated onboarding link
  const simulatedUrl = `/seller-dashboard.html?action=complete_onboarding&sellerId=${seller.id}`;
  return {
    url: simulatedUrl,
    mode: 'demo_mode',
    message: 'Demo onboarding link generated'
  };
}

/**
 * Queries Stripe account status and updates local seller record
 */
async function getAccountStatus(sellerId) {
  const seller = sellers[sellerId];
  if (!seller) {
    throw new Error(`Seller ${sellerId} not found`);
  }

  if (stripe && seller.stripeAccountId) {
    try {
      const account = await stripe.accounts.retrieve(seller.stripeAccountId);
      seller.payoutsEnabled = account.payouts_enabled;
      seller.chargesEnabled = account.charges_enabled;
      if (account.charges_enabled && account.payouts_enabled) {
        seller.stripeStatus = 'connected';
      } else if (account.details_submitted) {
        seller.stripeStatus = 'onboarding';
      } else {
        seller.stripeStatus = 'not_connected';
      }

      return {
        sellerId: seller.id,
        stripeAccountId: account.id,
        status: seller.stripeStatus,
        payoutsEnabled: account.payouts_enabled,
        chargesEnabled: account.charges_enabled,
        detailsSubmitted: account.details_submitted,
        defaultCurrency: account.default_currency || 'usd',
        mode: 'stripe_test'
      };
    } catch (err) {
      console.error('[Stripe Connect] Error retrieving account:', err);
      throw new Error(`Failed to retrieve Stripe account status: ${err.message}`);
    }
  }

  return {
    sellerId: seller.id,
    name: seller.name,
    stripeAccountId: seller.stripeAccountId,
    status: seller.stripeStatus,
    payoutsEnabled: seller.payoutsEnabled,
    chargesEnabled: seller.chargesEnabled,
    pool: seller.pool,
    balance: seller.balance,
    ordersCount: seller.ordersCount,
    mode: 'demo_mode'
  };
}

/**
 * Updates seller's onboarding state (used by simulated demo flow)
 */
function updateSellerStatus(sellerId, newStatus) {
  const seller = sellers[sellerId];
  if (!seller) throw new Error('Seller not found');
  seller.stripeStatus = newStatus;
  if (newStatus === 'connected') {
    seller.payoutsEnabled = true;
    seller.chargesEnabled = true;
    if (!seller.stripeAccountId) {
      seller.stripeAccountId = `acct_1N_demo_${sellerId}`;
    }
  } else if (newStatus === 'not_connected') {
    seller.payoutsEnabled = false;
    seller.chargesEnabled = false;
  }
  return seller;
}

/**
 * Creates and processes a checkout payment
 * Validates product price server-side, calculates 3-way split, and creates order
 */
async function processCheckout({
  productId,
  quantity = 1,
  customerName = 'Demo Buyer',
  customerEmail = 'buyer@gowellwith.com',
  simulateFailure = false,
  paymentMethodType = 'card'
}) {
  // 1. Fetch & validate product on server (never trust client price)
  const product = products.find(p => p.id === productId);
  if (!product) {
    throw new Error(`Product not found with ID: ${productId}`);
  }

  const seller = sellers[product.sellerId];
  if (!seller) {
    throw new Error(`Seller not found with ID: ${product.sellerId}`);
  }

  const qty = Math.max(1, parseInt(quantity, 10) || 1);
  const totalItemPrice = +(product.price * qty).toFixed(2);
  const split = calculateSplit(totalItemPrice, product.verified);

  const orderId = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
  const now = new Date().toISOString();

  // Handle intentional failure test
  if (simulateFailure) {
    const failedOrder = {
      orderId,
      customerId: 'usr_buyer_' + Date.now().toString(36),
      customerName,
      customerEmail,
      sellerId: seller.id,
      sellerName: seller.name,
      creatorTag: product.by,
      productId: product.id,
      productName: product.name,
      quantity: qty,
      unitPrice: product.price,
      amount: totalItemPrice,
      currency: 'USD',
      platformFee: split.platform,
      referralFee: split.referral,
      sellerPayout: split.seller,
      paymentStatus: 'failed',
      paymentProvider: stripe ? 'stripe_connect' : 'demo_stripe',
      transactionId: null,
      errorMessage: 'Your card was declined. Insufficient funds or test card failure triggered.',
      createdAt: now,
      updatedAt: now
    };
    orders.unshift(failedOrder);

    // Record webhook event for failure
    recordWebhookEvent('payment_intent.payment_failed', {
      id: `pi_failed_${orderId}`,
      amount: Math.round(totalItemPrice * 100),
      currency: 'usd',
      status: 'failed',
      last_payment_error: { message: failedOrder.errorMessage },
      orderId
    });

    return {
      success: false,
      order: failedOrder,
      error: failedOrder.errorMessage
    };
  }

  // 2. Real Stripe Payment Processing (if configured)
  if (stripe && seller.stripeAccountId && seller.chargesEnabled) {
    try {
      const amountInCents = Math.round(totalItemPrice * 100);
      const platformFeeInCents = Math.round(split.platform * 100);

      // Create PaymentIntent with destination transfer to seller
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amountInCents,
        currency: 'usd',
        payment_method_types: ['card'],
        application_fee_amount: platformFeeInCents,
        transfer_data: {
          destination: seller.stripeAccountId,
        },
        metadata: {
          orderId,
          productId: product.id,
          sellerId: seller.id,
          creatorTag: product.by,
          referralFee: split.referral.toFixed(2)
        }
      });

      const order = {
        orderId,
        customerId: 'usr_buyer_' + Date.now().toString(36),
        customerName,
        customerEmail,
        sellerId: seller.id,
        sellerName: seller.name,
        creatorTag: product.by,
        productId: product.id,
        productName: product.name,
        quantity: qty,
        unitPrice: product.price,
        amount: totalItemPrice,
        currency: 'USD',
        platformFee: split.platform,
        referralFee: split.referral,
        sellerPayout: split.seller,
        paymentStatus: paymentIntent.status === 'succeeded' ? 'successful' : 'processing',
        paymentProvider: 'stripe_connect',
        transactionId: paymentIntent.id,
        clientSecret: paymentIntent.client_secret,
        createdAt: now,
        updatedAt: now
      };
      orders.unshift(order);

      // Update seller stats
      seller.balance = +(seller.balance + split.seller).toFixed(2);
      seller.ordersCount += 1;

      return {
        success: true,
        order,
        clientSecret: paymentIntent.client_secret,
        mode: 'stripe_test'
      };
    } catch (err) {
      console.error('[Stripe Process] Error creating PaymentIntent:', err);
      throw new Error(`Stripe Payment processing error: ${err.message}`);
    }
  }

  // 3. Demo Mode Processing
  const transactionId = `pi_3P_demo_${orderId.toLowerCase()}_${Date.now().toString(36)}`;
  const order = {
    orderId,
    customerId: 'usr_buyer_' + Date.now().toString(36),
    customerName,
    customerEmail,
    sellerId: seller.id,
    sellerName: seller.name,
    creatorTag: product.by,
    productId: product.id,
    productName: product.name,
    quantity: qty,
    unitPrice: product.price,
    amount: totalItemPrice,
    currency: 'USD',
    platformFee: split.platform,
    referralFee: split.referral,
    sellerPayout: split.seller,
    paymentStatus: 'successful',
    paymentProvider: 'demo_stripe_connect',
    transactionId,
    stripeChargeId: `ch_demo_${orderId.toLowerCase()}`,
    stripeTransferId: `tr_demo_${seller.id}`,
    createdAt: now,
    updatedAt: now
  };
  orders.unshift(order);

  // Update seller balance and order counts
  seller.balance = +(seller.balance + split.seller).toFixed(2);
  seller.ordersCount += 1;

  // Update creator balance
  if (creators[product.by]) {
    creators[product.by].earningsTotal = +(creators[product.by].earningsTotal + split.referral).toFixed(2);
  }

  // Record a simulated Stripe Webhook Event
  recordWebhookEvent('payment_intent.succeeded', {
    id: transactionId,
    amount: Math.round(totalItemPrice * 100),
    currency: 'usd',
    status: 'succeeded',
    orderId,
    sellerId: seller.id,
    transfer_data: {
      destination: seller.stripeAccountId || `acct_simulated_${seller.id}`,
      amount: Math.round(split.seller * 100)
    }
  });

  return {
    success: true,
    order,
    mode: 'demo_mode'
  };
}

/**
 * Records an incoming or simulated Stripe Webhook event
 */
function recordWebhookEvent(type, eventData, isVerified = true) {
  const event = {
    id: 'evt_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 5),
    type,
    orderId: eventData.orderId || null,
    created: new Date().toISOString(),
    verified: isVerified,
    data: eventData
  };
  webhookLogs.unshift(event);
  if (webhookLogs.length > 50) {
    webhookLogs.pop();
  }
  return event;
}

/**
 * Verifies real Stripe webhook signature
 */
function verifyWebhookSignature(payload, signature) {
  if (!stripe || !process.env.STRIPE_WEBHOOK_SECRET) {
    return { verified: true, isDemo: true };
  }
  try {
    const event = stripe.webhooks.constructEvent(
      payload,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    return { verified: true, event, isDemo: false };
  } catch (err) {
    return { verified: false, error: err.message, isDemo: false };
  }
}

module.exports = {
  getStripeMode,
  createConnectedAccount,
  createAccountLink,
  getAccountStatus,
  updateSellerStatus,
  processCheckout,
  recordWebhookEvent,
  verifyWebhookSignature
};
