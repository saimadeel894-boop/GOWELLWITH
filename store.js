// Data store for GoWellWith (Paired) Social-Commerce MVP
// Provides realistic initial data and in-memory transactional persistence for orders, products, sellers, and webhook events.

const sellers = {
  's-studio-9': {
    id: 's-studio-9',
    name: 'Studio No.9',
    email: 'hello@studionine.com',
    category: 'Fashion',
    country: 'South Korea',
    pool: 'verified', // 'verified' | 'open'
    stripeAccountId: 'acct_1N_demo_studio9',
    stripeStatus: 'connected', // 'not_connected' | 'onboarding' | 'connected'
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

const creators = {
  '@haewon.k': {
    tag: '@haewon.k',
    name: 'Haewon Kim',
    role: 'Style Curator',
    earningsTotal: 112.40,
    pendingBalance: 14.80,
    stripeAccountId: 'acct_1N_demo_haewon',
    stripeStatus: 'connected'
  },
  '@marcoo': {
    tag: '@marcoo',
    name: 'Marco Ortiz',
    role: 'Denim & Streetwear',
    earningsTotal: 84.10,
    pendingBalance: 8.64,
    stripeAccountId: 'acct_1N_demo_marco',
    stripeStatus: 'connected'
  },
  '@juno_style': {
    tag: '@juno_style',
    name: 'Juno Park',
    role: 'Minimalist Wardrobe',
    earningsTotal: 42.00,
    pendingBalance: 4.08,
    stripeAccountId: null,
    stripeStatus: 'onboarding'
  },
  '@ellbie.wears': {
    tag: '@ellbie.wears',
    name: 'Ellbie',
    role: 'Fashion Blogger / Post Creator',
    earningsTotal: 0,
    pendingBalance: 0,
    stripeAccountId: null,
    stripeStatus: 'not_connected'
  }
};

const products = [
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

// In-memory orders/transactions
const orders = [
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
    platformFee: 8.16, // 12% for verified pool
    referralFee: 5.44, // 8% for verified pool
    sellerPayout: 54.40, // 80% for verified pool
    paymentStatus: 'successful',
    paymentProvider: 'stripe_connect',
    transactionId: 'pi_3P_demo_7104a98f12',
    stripeChargeId: 'ch_3P_demo_7104_ch',
    stripeTransferId: 'tr_3P_demo_studio9_tr',
    createdAt: new Date(Date.now() - 3600000 * 4).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 4 + 12000).toISOString()
  },
  {
    orderId: 'ORD-6980',
    customerId: 'usr_buyer_sarah',
    customerName: 'Sarah M.',
    sellerId: 's-small-shop',
    sellerName: 'Linked from a small shop',
    creatorTag: '@juno_style',
    productId: 's3',
    productName: 'Ivory ribbed knit tank',
    quantity: 1,
    unitPrice: 22.00,
    amount: 22.00,
    currency: 'USD',
    platformFee: 1.10, // 5% for open pool
    referralFee: 1.32, // 6% for open pool
    sellerPayout: 19.58, // 89% for open pool
    paymentStatus: 'successful',
    paymentProvider: 'stripe_connect',
    transactionId: 'pi_3P_demo_6980bc44e1',
    stripeChargeId: 'ch_3P_demo_6980_ch',
    stripeTransferId: 'tr_3P_demo_smallshop_tr',
    createdAt: new Date(Date.now() - 3600000 * 26).toISOString(),
    updatedAt: new Date(Date.now() - 3600000 * 26 + 18000).toISOString()
  }
];

const webhookLogs = [
  {
    id: 'evt_demo_init_01',
    type: 'payment_intent.succeeded',
    orderId: 'ORD-7104',
    created: new Date(Date.now() - 3600000 * 4 + 10000).toISOString(),
    verified: true,
    data: {
      id: 'pi_3P_demo_7104a98f12',
      amount: 6800,
      currency: 'usd',
      status: 'succeeded',
      transfer_data: {
        destination: 'acct_1N_demo_studio9',
        amount: 5440
      }
    }
  }
];

// Calculate transparent 3-way marketplace fee split
function calculateSplit(price, verified) {
  // Open pool: 5% platform, 6% referral, 89% seller
  // Verified pool: 12% platform, 8% referral, 80% seller
  const platformRate = verified ? 0.12 : 0.05;
  const referralRate = verified ? 0.08 : 0.06;
  const platform = +(price * platformRate).toFixed(2);
  const referral = +(price * referralRate).toFixed(2);
  const seller = +(price - platform - referral).toFixed(2);
  return { platform, referral, seller, platformRate, referralRate };
}

module.exports = {
  sellers,
  creators,
  products,
  orders,
  webhookLogs,
  calculateSplit
};
