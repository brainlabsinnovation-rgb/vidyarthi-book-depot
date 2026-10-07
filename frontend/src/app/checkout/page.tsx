"use client";

import Link from "next/link";
import { CreditCard, MapPin, Store } from "lucide-react";
import { useState } from "react";
import { RequireCustomer } from "@/components/require-customer";
import { useCustomerAuth } from "@/components/customer-auth-provider";
import { useShop } from "@/components/shop-provider";
import { formatPrice } from "@/data/catalog";
import { useCartQuote } from "@/lib/use-cart-quote";

type FulfilmentMethod = "delivery" | "pickup";

export default function CheckoutPage() { return <RequireCustomer nextPath="/checkout"><CheckoutContent /></RequireCustomer>; }

function CheckoutContent() {
  const { user } = useCustomerAuth();
  const { cart } = useShop();
  const [fulfilment, setFulfilment] = useState<FulfilmentMethod>("delivery");
  const isPickup = fulfilment === "pickup";
  const { quote, error, verifying } = useCartQuote(fulfilment, true);

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
                <label>Full name<input defaultValue={user?.name} placeholder="Your full name" /></label>
                <label>Mobile number<input defaultValue={user?.phoneNumberVerified ? user.phoneNumber : ""} placeholder="+91 00000 00000" /></label>
                <label className="full">Email address<input type="email" defaultValue={user?.emailVerified ? user.email : ""} placeholder="you@example.com" /></label>
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
              <div className="form-section-title"><span>3</span><div><h2>Payment</h2><p>Online payment will be available after the shop’s Razorpay account is connected.</p></div></div>
              <div className="payment-preview"><CreditCard /><div><strong>Online payment</strong><p>UPI, cards, net banking and supported wallets</p></div><span>Secure</span></div>
            </section>
          </div>
          <aside className="order-summary">
            <h2>Your order</h2>
            {cart.length ? cart.map((line) => (
              <div className="checkout-product-line" key={line.product.slug}>
                <span>{line.product.name} x {line.quantity}</span>
                <strong>{formatPrice((quote?.items.find((item) => item.slug === line.product.slug)?.lineTotalPaise ?? line.product.price * line.quantity * 100) / 100)}</strong>
              </div>
            )) : (
              <p className="muted-copy">Your cart is empty. Add products before checking out.</p>
            )}
            <div className="summary-break"><span>MRP subtotal</span><strong>{quote ? formatPrice(quote.mrpSubtotalPaise / 100) : "Verifying…"}</strong></div>
            <div><span>Product discount</span><strong className="saving">{quote ? `− ${formatPrice(quote.productSavingsPaise / 100)}` : "—"}</strong></div>
            <div><span>{isPickup ? "Store pickup" : "Delivery"}</span><strong>{isPickup ? "Free" : "Calculated after address"}</strong></div>
            <div className="summary-total"><span>{isPickup ? "Order total" : "Total before delivery"}</span><strong>{quote ? formatPrice(quote.subtotalPaise / 100) : "—"}</strong></div>
            {quote && quote.productSavingsPaise > 0 && <p className="order-saving-note">You save {formatPrice(quote.productSavingsPaise / 100)} on products in this order.</p>}
            {error && <p className="demo-note" role="alert">{error}</p>}
            {verifying && <p className="demo-note">Verifying prices and availability…</p>}
            <button className="button primary" disabled>Online payment coming soon</button>
            <small className="demo-note">The Razorpay test account and delivery rules are needed before orders can be placed.</small>
          </aside>
        </div>
      </section>
    </>
  );
}
