"use client";

import Link from "next/link";
import { CheckCircle2, CreditCard, MapPin, Store } from "lucide-react";
import { useState } from "react";
import { useShop } from "@/components/shop-provider";
import { formatPrice } from "@/data/catalog";

type FulfilmentMethod = "delivery" | "pickup";

export default function CheckoutPage() {
  const { cart, cartMrpTotal, cartSavings, cartTotal } = useShop();
  const [placed, setPlaced] = useState(false);
  const [fulfilment, setFulfilment] = useState<FulfilmentMethod>("delivery");
  const isPickup = fulfilment === "pickup";

  if (placed) {
    return (
      <section className="section">
        <div className="shell success-card">
          <CheckCircle2 />
          <span className="kicker">Demo order confirmed</span>
          <h1>Thank you! Your order preview is ready.</h1>
          <p>This is a static frontend demonstration. A real order and payment will be created after the backend and Razorpay integration are approved.</p>
          <b>Demo order VBD-2026-1042</b>
          <Link className="button primary" href="/orders">View order</Link>
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="page-hero compact-hero">
        <div className="shell">
          <div className="breadcrumbs"><Link href="/cart">Cart</Link><span>/</span><span>Checkout</span></div>
          <h1>Checkout</h1>
          <p>A simple, clear path from address to secure payment.</p>
        </div>
      </section>
      <section className="section">
        <div className="shell checkout-layout">
          <div className="checkout-form">
            <section>
              <div className="form-section-title"><span>1</span><div><h2>Contact information</h2><p>We will use this to share order updates.</p></div></div>
              <div className="form-grid">
                <label>Full name<input placeholder="Your full name" /></label>
                <label>Mobile number<input placeholder="+91 00000 00000" /></label>
                <label className="full">Email address<input type="email" placeholder="you@example.com" /></label>
              </div>
            </section>
            <section>
              <div className="form-section-title"><span>2</span><div><h2>How would you like your order?</h2><p>Choose delivery or store pickup.</p></div></div>
              <div className="choice-grid">
                <label>
                  <input type="radio" name="method" value="delivery" checked={fulfilment === "delivery"} onChange={() => setFulfilment("delivery")} />
                  <MapPin />
                  <span><strong>Home delivery</strong><small>Delivery fee calculated after address</small></span>
                </label>
                <label>
                  <input type="radio" name="method" value="pickup" checked={fulfilment === "pickup"} onChange={() => setFulfilment("pickup")} />
                  <Store />
                  <span><strong>Store pickup</strong><small>Collect when your order is ready</small></span>
                </label>
              </div>
              {!isPickup && (
                <div className="form-grid">
                  <label className="full">Address<input placeholder="House number, street and area" /></label>
                  <label>City<input placeholder="City" /></label>
                  <label>PIN code<input placeholder="000000" /></label>
                </div>
              )}
            </section>
            <section>
              <div className="form-section-title"><span>3</span><div><h2>Payment</h2><p>Secure online payment through Razorpay after integration.</p></div></div>
              <div className="payment-preview"><CreditCard /><div><strong>Online payment</strong><p>UPI, cards, net banking and supported wallets</p></div><span>Secure</span></div>
            </section>
          </div>
          <aside className="order-summary">
            <h2>Your order</h2>
            {cart.length ? cart.map((line) => (
              <div className="checkout-product-line" key={line.product.slug}>
                <span>{line.product.name} x {line.quantity}</span>
                <strong>{formatPrice(line.product.price * line.quantity)}</strong>
              </div>
            )) : (
              <p className="muted-copy">Your cart is empty. This button still demonstrates the static success screen.</p>
            )}
            <div className="summary-break"><span>MRP subtotal</span><strong>{formatPrice(cartMrpTotal)}</strong></div>
            <div><span>Product discount</span><strong className="saving">&minus; {formatPrice(cartSavings)}</strong></div>
            <div><span>{isPickup ? "Store pickup" : "Delivery"}</span><strong>{isPickup ? "Free" : "Calculated after address"}</strong></div>
            <div className="summary-total"><span>{isPickup ? "Order total" : "Total before delivery"}</span><strong>{formatPrice(cartTotal)}</strong></div>
            {cartSavings > 0 && <p className="order-saving-note">You save {formatPrice(cartSavings)} on products in this order.</p>}
            <button className="button primary" onClick={() => setPlaced(true)}>Place demo order</button>
            <small className="demo-note">No payment will be collected in this static preview.</small>
          </aside>
        </div>
      </section>
    </>
  );
}
