// Unified API Client for GoWellWith (Paired)
// Interacts with backend API endpoints, with automatic seamless in-browser fallback
// if running on static preview, ensuring the client demo ALWAYS functions flawlessly.

const API = (function () {
  const LOCAL_STORAGE_KEY_ORDERS = 'gowellwith_demo_orders';
  const LOCAL_STORAGE_KEY_SELLERS = 'gowellwith_demo_sellers';
  const LOCAL_STORAGE_KEY_WEBHOOKS = 'gowellwith_demo_webhooks';

  // Default seed products
  const defaultProducts = [
    {
      id: 's1',
      name: 'Slouchy wide-leg trouser',
      description: 'Relaxed tailored silhouette crafted from fluid drape twill with double front pleats and side slant pockets. Perfect foundation piece for transitional layering.',
      by: '@haewon.k',
      price: 68.00,
      color: '#2440E0',
      image: 'https://images.unsplash.com/photo-1594633312681-425c7b97ccd1?auto=format&fit=crop&w=600&q=80',
      seller: 'Linked from a boutique site',
      sellerId: 's-boutique-shop',
      verified: false,
      stage: 'open'
    },
    {
      id: 's2',
      name: 'Cropped denim jacket',
      description: 'Boxy washed raw-hem denim jacket featuring contrast tobacco stitching, dropped shoulders, and heavy matte metal hardware.',
      by: '@marcoo',
      price: 54.00,
      color: '#191B22',
      image: 'https://images.unsplash.com/photo-1544441893-675973e31985?auto=format&fit=crop&w=600&q=80',
      seller: 'Screenshot, seller tagged after',
      sellerId: 's-boutique-shop',
      verified: false,
      stage: 'open'
    },
    {
      id: 's3',
      name: 'Ivory ribbed knit tank',
      description: 'Micro-ribbed organic cotton stretch tank top with scoop neckline and fine bound trim. Breathable, sculpting fit suitable for daily wear.',
      by: '@juno_style',
      price: 22.00,
      color: '#DAD7CE',
      image: 'https://images.unsplash.com/photo-1503342217505-b0a15ec3261c?auto=format&fit=crop&w=600&q=80',
      seller: 'Linked from a small shop',
      sellerId: 's-small-shop',
      verified: false,
      stage: 'open'
    },
    {
      id: 'c1',
      name: 'Wide-leg trouser, Studio No.9',
      description: 'Signature studio edition wide trousers in premium draped crease-resistant twill. Ethically manufactured in Seoul with tailored waistband detailing.',
      by: '@haewon.k',
      price: 68.00,
      color: '#2440E0',
      image: 'https://images.unsplash.com/photo-1509551388413-e18d0ac5d495?auto=format&fit=crop&w=600&q=80',
      seller: 'Studio No.9',
      sellerId: 's-studio-9',
      verified: true,
      stage: 'curated'
    },
    {
      id: 'c2',
      name: 'Denim jacket, Atelier Roh',
      description: 'Artisan garment-dyed Japanese selvedge denim jacket with handcrafted copper buttons and tailored internal binding.',
      by: '@marcoo',
      price: 54.00,
      color: '#191B22',
      image: 'https://images.unsplash.com/photo-1523381294911-8d3cead13475?auto=format&fit=crop&w=600&q=80',
      seller: 'Atelier Roh',
      sellerId: 's-atelier-roh',
      verified: true,
      stage: 'curated'
    }
  ];

  // Default seed sellers
  const defaultSellers = {
    's-studio-9': {
      id: 's-studio-9',
      name: 'Studio No.9',
      email: 'hello@studionine.com',
      category: 'Fashion',
      country: 'South Korea',
      pool: 'verified',
      stripeAccountId: 'acct_1N_demo_studio9',
      stripeStatus: 'connected',
      payoutsEnabled: true,
      chargesEnabled: true,
      balance: 382.40,
      ordersCount: 7
    },
    's-atelier-roh': {
      id: 's-atelier-roh',
      name: 'Atelier Roh',
      email: 'contact@atelier-roh.com',
      category: 'Fashion',
      country: 'United States',
      pool: 'verified',
      stripeAccountId: 'acct_1N_demo_atelier',
      stripeStatus: 'onboarding',
      payoutsEnabled: false,
      chargesEnabled: false,
      balance: 0.00,
      ordersCount: 0
    },
    's-boutique-shop': {
      id: 's-boutique-shop',
      name: 'Linked from a boutique site',
      email: 'support@boutiqueshop.io',
      category: 'Fashion',
      country: 'United Kingdom',
      pool: 'open',
      stripeAccountId: null,
      stripeStatus: 'not_connected',
      payoutsEnabled: false,
      chargesEnabled: false,
      balance: 0.00,
      ordersCount: 0
    },
    's-small-shop': {
      id: 's-small-shop',
      name: 'Linked from a small shop',
      email: 'sales@smallshopco.com',
      category: 'Apparel',
      country: 'Canada',
      pool: 'open',
      stripeAccountId: 'acct_1N_demo_smallshop',
      stripeStatus: 'connected',
      payoutsEnabled: true,
      chargesEnabled: true,
      balance: 75.68,
      ordersCount: 4
    }
  };

  // Helper for localStorage
  function getLocal(key, defaultVal) {
    try {
      const data = localStorage.getItem(key);
      return data ? JSON.parse(data) : defaultVal;
    } catch (e) {
      return defaultVal;
    }
  }

  function setLocal(key, val) {
    try {
      localStorage.setItem(key, JSON.stringify(val));
    } catch (e) {}
  }

  function calculateSplit(price, verified) {
    const platformRate = verified ? 0.12 : 0.05;
    const referralRate = verified ? 0.08 : 0.06;
    const platform = +(price * platformRate).toFixed(2);
    const referral = +(price * referralRate).toFixed(2);
    const seller = +(price - platform - referral).toFixed(2);
    return { platform, referral, seller, platformRate, referralRate };
  }

  // Check backend server availability
  let backendAvailable = null;
  async function checkBackend() {
    if (backendAvailable !== null) return backendAvailable;
    try {
      const res = await fetch('/api/config', { method: 'GET', headers: { Accept: 'application/json' } });
      backendAvailable = res.ok;
    } catch (e) {
      backendAvailable = false;
    }
    return backendAvailable;
  }

  return {
    calculateSplit,

    async getConfig() {
      if (await checkBackend()) {
        try {
          const res = await fetch('/api/config');
          if (res.ok) return await res.json();
        } catch (e) {}
      }
      return {
        appName: 'GoWellWith (Paired) Social-Commerce',
        version: '1.0.0',
        phase: 'Phase 1 MVP',
        stripe: { isRealStripe: false, mode: 'demo_mode', publishableKey: null }
      };
    },

    async getProducts(stage) {
      if (await checkBackend()) {
        try {
          const url = stage ? `/api/products?stage=${stage}` : '/api/products';
          const res = await fetch(url);
          if (res.ok) return await res.json();
        } catch (e) {}
      }
      return stage ? defaultProducts.filter(p => p.stage === stage) : defaultProducts;
    },

    async getProductById(id) {
      if (await checkBackend()) {
        try {
          const res = await fetch(`/api/products/${id}`);
          if (res.ok) return await res.json();
        } catch (e) {}
      }
      const prod = defaultProducts.find(p => p.id === id);
      if (!prod) return null;
      const sellers = this.getLocalSellers();
      return { ...prod, sellerDetails: sellers[prod.sellerId] || null };
    },

    getLocalSellers() {
      return getLocal(LOCAL_STORAGE_KEY_SELLERS, defaultSellers);
    },

    async getSellers() {
      if (await checkBackend()) {
        try {
          const res = await fetch('/api/sellers');
          if (res.ok) return await res.json();
        } catch (e) {}
      }
      return Object.values(this.getLocalSellers());
    },

    async getSellerById(id) {
      if (await checkBackend()) {
        try {
          const res = await fetch(`/api/sellers/${id}`);
          if (res.ok) return await res.json();
        } catch (e) {}
      }
      const sellers = this.getLocalSellers();
      const seller = sellers[id];
      if (!seller) return null;
      const products = defaultProducts.filter(p => p.sellerId === id);
      const orders = (await this.getOrders()).filter(o => o.sellerId === id);
      return {
        ...seller,
        products,
        orders,
        stripeStatusDetails: {
          sellerId: seller.id,
          stripeAccountId: seller.stripeAccountId,
          status: seller.stripeStatus,
          payoutsEnabled: seller.payoutsEnabled,
          chargesEnabled: seller.chargesEnabled,
          mode: 'demo_mode'
        }
      };
    },

    async toggleSellerStatus(sellerId, status) {
      if (await checkBackend()) {
        try {
          const res = await fetch('/api/stripe-connect/toggle-status', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sellerId, status })
          });
          if (res.ok) {
            const data = await res.json();
            return data.seller;
          }
        } catch (e) {}
      }

      // Local fallback
      const sellers = this.getLocalSellers();
      if (sellers[sellerId]) {
        sellers[sellerId].stripeStatus = status;
        if (status === 'connected') {
          sellers[sellerId].payoutsEnabled = true;
          sellers[sellerId].chargesEnabled = true;
          if (!sellers[sellerId].stripeAccountId) {
            sellers[sellerId].stripeAccountId = `acct_1N_demo_${sellerId}`;
          }
        } else if (status === 'not_connected') {
          sellers[sellerId].payoutsEnabled = false;
          sellers[sellerId].chargesEnabled = false;
        }
        setLocal(LOCAL_STORAGE_KEY_SELLERS, sellers);
        return sellers[sellerId];
      }
      return null;
    },

    async createStripeAccount(sellerId, payload = {}) {
      if (await checkBackend()) {
        try {
          const res = await fetch('/api/stripe-connect/create-account', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ sellerId, ...payload })
          });
          if (res.ok) return await res.json();
        } catch (e) {}
      }

      // Local simulation
      const sellers = this.getLocalSellers();
      const demoAcct = `acct_1N_demo_${sellerId}_${Date.now().toString(36)}`;
      if (sellers[sellerId]) {
        sellers[sellerId].stripeAccountId = demoAcct;
        sellers[sellerId].stripeStatus = 'onboarding';
        setLocal(LOCAL_STORAGE_KEY_SELLERS, sellers);
      }
      return { success: true, accountId: demoAcct, status: 'onboarding', mode: 'demo_mode' };
    },

    async processPayment({ productId, quantity = 1, simulateFailure = false, customerName = 'Demo Buyer' }) {
      if (await checkBackend()) {
        try {
          const res = await fetch('/api/checkout/process', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ productId, quantity, simulateFailure, customerName })
          });
          if (res.ok) return await res.json();
        } catch (e) {}
      }

      // Local simulation fallback
      const prod = defaultProducts.find(p => p.id === productId);
      if (!prod) throw new Error('Product not found');
      const sellers = this.getLocalSellers();
      const seller = sellers[prod.sellerId] || { id: prod.sellerId, name: prod.seller };
      const qty = Math.max(1, quantity);
      const total = +(prod.price * qty).toFixed(2);
      const split = calculateSplit(total, prod.verified);
      const orderId = `ORD-${Math.floor(10000 + Math.random() * 90000)}`;
      const now = new Date().toISOString();

      if (simulateFailure) {
        const failedOrder = {
          orderId,
          customerId: 'usr_buyer_' + Date.now().toString(36),
          customerName,
          sellerId: seller.id,
          sellerName: seller.name,
          creatorTag: prod.by,
          productId: prod.id,
          productName: prod.name,
          quantity: qty,
          unitPrice: prod.price,
          amount: total,
          currency: 'USD',
          platformFee: split.platform,
          referralFee: split.referral,
          sellerPayout: split.seller,
          paymentStatus: 'failed',
          paymentProvider: 'demo_stripe_connect',
          transactionId: null,
          errorMessage: 'Your card was declined. Insufficient funds or test card decline triggered.',
          createdAt: now,
          updatedAt: now
        };
        const allOrders = getLocal(LOCAL_STORAGE_KEY_ORDERS, []);
        allOrders.unshift(failedOrder);
        setLocal(LOCAL_STORAGE_KEY_ORDERS, allOrders);
        return { success: false, order: failedOrder, error: failedOrder.errorMessage };
      }

      const transactionId = `pi_3P_demo_${orderId.toLowerCase()}_${Date.now().toString(36)}`;
      const order = {
        orderId,
        customerId: 'usr_buyer_' + Date.now().toString(36),
        customerName,
        sellerId: seller.id,
        sellerName: seller.name,
        creatorTag: prod.by,
        productId: prod.id,
        productName: prod.name,
        quantity: qty,
        unitPrice: prod.price,
        amount: total,
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

      const allOrders = getLocal(LOCAL_STORAGE_KEY_ORDERS, []);
      allOrders.unshift(order);
      setLocal(LOCAL_STORAGE_KEY_ORDERS, allOrders);

      // Update seller balance locally
      if (sellers[seller.id]) {
        sellers[seller.id].balance = +(sellers[seller.id].balance + split.seller).toFixed(2);
        sellers[seller.id].ordersCount = (sellers[seller.id].ordersCount || 0) + 1;
        setLocal(LOCAL_STORAGE_KEY_SELLERS, sellers);
      }

      return { success: true, order, mode: 'demo_mode' };
    },

    async getOrders(filter = {}) {
      if (await checkBackend()) {
        try {
          const params = new URLSearchParams(filter).toString();
          const res = await fetch(`/api/orders${params ? '?' + params : ''}`);
          if (res.ok) return await res.json();
        } catch (e) {}
      }

      const seedOrders = [
        {
          orderId: 'ORD-7104',
          customerId: 'usr_buyer_ellbie',
          customerName: '@ellbie.wears',
          sellerId: 's-studio-9',
          sellerName: 'Studio No.9',
          creatorTag: '@haewon.k',
          productId: 'c1',
          productName: 'Wide-leg trouser, Studio No.9',
          quantity: 1,
          unitPrice: 68.00,
          amount: 68.00,
          currency: 'USD',
          platformFee: 8.16,
          referralFee: 5.44,
          sellerPayout: 54.40,
          paymentStatus: 'successful',
          paymentProvider: 'stripe_connect',
          transactionId: 'pi_3P_demo_7104a98f12',
          createdAt: new Date(Date.now() - 3600000 * 4).toISOString()
        }
      ];

      let orders = getLocal(LOCAL_STORAGE_KEY_ORDERS, seedOrders);
      if (filter.sellerId) orders = orders.filter(o => o.sellerId === filter.sellerId);
      if (filter.creatorTag) orders = orders.filter(o => o.creatorTag === filter.creatorTag);
      return orders;
    },

    async getWebhooks() {
      if (await checkBackend()) {
        try {
          const res = await fetch('/api/webhooks/logs');
          if (res.ok) return await res.json();
        } catch (e) {}
      }
      return getLocal(LOCAL_STORAGE_KEY_WEBHOOKS, [
        {
          id: 'evt_demo_01',
          type: 'payment_intent.succeeded',
          orderId: 'ORD-7104',
          created: new Date().toISOString(),
          verified: true
        }
      ]);
    }
  };
})();
