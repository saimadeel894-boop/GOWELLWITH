# GoWellWith (Paired) — Social-Commerce MVP

A suggestion-driven social commerce marketplace where creators pair outfits, sellers fulfill orders, and Stripe Connect automatically splits payments three ways at checkout.

---

## Live Website & Architecture

- **Live URL:** [https://gowellwith.netlify.app/](https://gowellwith.netlify.app/)
- **Hosting:** Netlify (Static Assets + Serverless Functions via `netlify.toml`)
- **Backend:** Node.js Express server (`server.js`) for local development & API services
- **Payment Provider:** Stripe Connect (Custom/Express architecture with 3-way marketplace fee splits)

---

## 3-Way Marketplace Split Structure

Every transaction is calculated transparently server-side:

| Pool | Platform Fee (GoWellWith) | Referral Fee (Creator / Suggester) | Seller Payout (Disbursed) | Total Charged |
| :--- | :--- | :--- | :--- | :--- |
| **Open Pool** (Initial) | 5% | 6% | 89% | 100% |
| **Verified Pool** (After Review) | 12% | 8% | 80% | 100% |

- **Escrow & Disbursements:** Funds are charged via Stripe PaymentIntents with `application_fee_amount` and `transfer_data[destination]` directed to the seller's connected Stripe account. The referral fee is credited to the suggesting creator's connected payout account.

---

## Key Pages & Flows

1. **Prototype Directory (`/index.html`):** Central dashboard linking to all customer, seller, and platform flows.
2. **Buyer Flow (`/feed-and-checkout.html`):**
   - Browse outfit feed posts (e.g. `@ellbie.wears`)
   - Toggle between Phase 1 (Open tagging) and Phase 2 (Verified sellers)
   - Inspect **Product Details Modal** (Images, Description, Creator attribution, Seller profile, Quantity selector)
   - **Checkout Drawer & Summary** (Order items, 3-way split preview, currency, Pay Now button)
   - **Interactive Payment Testing** (Instant Success receipt or simulated card decline with "Try Again" recovery)
3. **Seller Dashboard (`/seller-dashboard.html`):**
   - Active seller selector (Studio No.9, Atelier Roh, Small Shop Co, Boutique Collective)
   - **Stripe Connect Card:** Toggle and test all 3 states:
     - `Not Connected`: Action required button to connect bank account.
     - `Onboarding`: "Stripe onboarding is in progress" with resume link.
     - `Connected`: "Stripe account connected successfully" with Account ID, charges enabled, payouts enabled.
   - Payout balance, order counts, product catalog, and transaction feed.
4. **Seller Onboarding (`/seller-onboarding.html`):** 3-step wizard (Business details, Stripe Connect payout setup, Fee agreement).
5. **Claim Your Sale (`/seller-claim-sale.html`):** Lightweight time-boxed invite for an open-pool seller to connect Stripe and claim pending escrowed sale.
6. **Suggester Onboarding (`/referrer-onboarding.html`):** Creator setup to receive 6-8% referral cuts for outfit pairings.
7. **Platform Ledger & Webhook Monitor (`/transactions.html`):** Real-time order ledger and HMAC-verified Stripe webhook event stream.

---

## Running Locally

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start the local server:
   ```bash
   npm start
   ```

3. Open your browser:
   ```
   http://localhost:3000
   ```

4. Run the automated test suite:
   ```bash
   node test-api.js
   ```

---

## Stripe Configuration (Test Mode vs Demo Mode)

By default, the application runs in **high-fidelity Demo Payment Mode**, allowing full end-to-end evaluation of:
- Checkout & Pay Now processing states
- Success receipts with realistic Order IDs and Stripe references
- Error handling & card decline recovery flows
- All 3 Stripe Connect onboarding states

To activate **real Stripe Connect Test Mode**:
1. Copy `.env.example` to `.env`:
   ```bash
   cp .env.example .env
   ```
2. Insert your Stripe Test keys from your Stripe Dashboard:
   ```env
   STRIPE_SECRET_KEY=sk_test_...
   STRIPE_PUBLISHABLE_KEY=pk_test_...
   STRIPE_WEBHOOK_SECRET=whsec_...
   ```
3. Restart the server. The application will detect the keys and automatically switch to live Stripe Test Mode.

---

## Netlify Deployment

The project is structured for 100% zero-configuration Netlify deployment:
- `netlify.toml` specifies `public` as the publish directory and sets up clean URL rewrites.
- `netlify/functions/api.js` serves serverless API routes on Netlify.
- Security headers (`X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`) are configured.
