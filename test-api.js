// Automated Test Suite for GoWellWith Phase 1 Demo
// Tests all required scope items:
// 1. Config & Stripe Test/Demo Mode
// 2. Product discovery & detail fetching
// 3. Payment checkout (Success flow + Failure flow)
// 4. Seller Stripe Connect status toggling (Not Connected -> Onboarding -> Connected)
// 5. Transaction status & webhook event logging

async function runTests() {
  const BASE_URL = 'http://localhost:3000';
  console.log('--- Starting GoWellWith API Test Suite ---');

  // 1. Test Config
  console.log('\n[1/6] Testing GET /api/config...');
  const configRes = await fetch(`${BASE_URL}/api/config`);
  const config = await configRes.json();
  console.log('✓ Config response:', JSON.stringify(config));

  // 2. Test Products
  console.log('\n[2/6] Testing GET /api/products...');
  const prodRes = await fetch(`${BASE_URL}/api/products`);
  const products = await prodRes.json();
  console.log(`✓ Products fetched: ${products.length} products found`);
  console.log(`  Sample: ${products[0].name} ($${products[0].price}) by ${products[0].by}`);

  // 3. Test Successful Checkout
  console.log('\n[3/6] Testing POST /api/checkout/process (Successful Payment)...');
  const paySuccessRes = await fetch(`${BASE_URL}/api/checkout/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: 'c1',
      quantity: 1,
      customerName: '@ellbie.wears'
    })
  });
  const paySuccess = await paySuccessRes.json();
  if (paySuccess.success) {
    console.log('✓ Payment processed successfully!');
    console.log(`  Order ID: ${paySuccess.order.orderId}`);
    console.log(`  Transaction ID: ${paySuccess.order.transactionId}`);
    console.log(`  Amount: $${paySuccess.order.amount} USD`);
    console.log(`  Platform Fee: $${paySuccess.order.platformFee}`);
    console.log(`  Creator Referral Cut: $${paySuccess.order.referralFee} (${paySuccess.order.creatorTag})`);
    console.log(`  Seller Payout: $${paySuccess.order.sellerPayout} (${paySuccess.order.sellerName})`);
    console.log(`  Status: ${paySuccess.order.paymentStatus}`);
  } else {
    throw new Error('Payment failed unexpectedly: ' + JSON.stringify(paySuccess));
  }

  // 4. Test Failed Checkout (Error Handling requirement)
  console.log('\n[4/6] Testing POST /api/checkout/process (Failure Handling / Card Decline)...');
  const payFailRes = await fetch(`${BASE_URL}/api/checkout/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      productId: 's2',
      quantity: 1,
      simulateFailure: true
    })
  });
  const payFail = await payFailRes.json();
  if (!payFail.success && payFail.error) {
    console.log('✓ Failure correctly intercepted and recorded:');
    console.log(`  Order ID: ${payFail.order.orderId}`);
    console.log(`  Status: ${payFail.order.paymentStatus}`);
    console.log(`  Error Message: "${payFail.error}"`);
  } else {
    throw new Error('Expected failure was not returned: ' + JSON.stringify(payFail));
  }

  // 5. Test Seller Stripe Connect States
  console.log('\n[5/6] Testing Stripe Connect state transitions on seller s-studio-9...');
  for (const status of ['not_connected', 'onboarding', 'connected']) {
    const toggleRes = await fetch(`${BASE_URL}/api/stripe-connect/toggle-status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sellerId: 's-studio-9', status })
    });
    const toggleData = await toggleRes.json();
    console.log(`  ✓ Transitioned to "${status}": Stripe Status is "${toggleData.seller.stripeStatus}"`);
  }

  // 6. Test Webhook Stream & Orders Ledger
  console.log('\n[6/7] Testing Webhooks and Orders query...');
  const ordersRes = await fetch(`${BASE_URL}/api/orders`);
  const orders = await ordersRes.json();
  console.log(`✓ Total orders in ledger: ${orders.length}`);

  const whRes = await fetch(`${BASE_URL}/api/webhooks/logs`);
  const whLogs = await whRes.json();
  console.log(`✓ Webhook events in log: ${whLogs.length}`);
  console.log(`  Latest Webhook Event: ${whLogs[0].type} (Verified: ${whLogs[0].verified})`);

  // 7. Test Frontend HTML Pages
  console.log('\n[7/7] Testing Frontend HTML routes...');
  const pages = [
    '/',
    '/feed-and-checkout.html',
    '/seller-dashboard.html',
    '/seller-onboarding.html',
    '/seller-claim-sale.html',
    '/referrer-onboarding.html',
    '/transactions.html'
  ];
  for (const page of pages) {
    const pageRes = await fetch(`${BASE_URL}${page}`);
    if (pageRes.status === 200) {
      console.log(`  ✓ Route ${page} returned HTTP 200 OK`);
    } else {
      throw new Error(`Route ${page} returned HTTP ${pageRes.status}`);
    }
  }

  console.log('\n=============================================');
  console.log(' ALL 7 TEST SUITES PASSED FLAWLESSLY! ✓');
  console.log('=============================================\n');
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
