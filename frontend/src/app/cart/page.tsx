"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useCustomerAuth } from "@/components/customer-auth-provider";
import { verifiedUser } from "@/lib/customer-auth";
import { useShop } from "@/components/shop-provider";
import { formatPrice } from "@/data/catalog";
import { useCartQuote } from "@/lib/use-cart-quote";

export default function CartPage() {
  const {
    cart,
    cartMrpTotal,
    cartSavings,
    cartTotal,
    removeFromCart,
    updateQuantity,
  } = useShop();
  const { user, status } = useCustomerAuth();
  const { quote, error, verifying } = useCartQuote("pickup");
  const mrpTotal = quote ? quote.mrpSubtotalPaise / 100 : cartMrpTotal;
  const savings = quote ? quote.productSavingsPaise / 100 : cartSavings;
  const total = quote ? quote.subtotalPaise / 100 : cartTotal;

  return (
    <>
      <section className="page-hero">
        <div className="shell">
          <div className="breadcrumbs"><Link href="/">Home</Link><span>/</span><span>Cart</span></div>
          <h1>Your cart</h1>
          <p>Review your products before moving to checkout.</p>
        </div>
      </section>
      <section className="section">
        <div className="shell">
          {cart.length === 0 ? (
            <div className="empty-state">
              <ShoppingBag />
              <h2>Your cart is waiting for something good.</h2>
              <p>Explore everyday stationery, books and gifts, then add your favourites here.</p>
              <Link className="button primary" href="/shop">Start shopping</Link>
            </div>
          ) : (
            <div className="cart-layout">
              <div className="cart-list">
                {cart.map(({ product, quantity }) => {
                  const unitSaving = Math.max(0, product.mrp - product.price);
                  return (
                    <article className="cart-line" key={product.slug}>
                      <Image src={product.image} alt={product.name} width={130} height={130} />
                      <div className="cart-line-info">
                        <span>{product.category}</span>
                        <Link href={"/product/" + product.slug}><h3>{product.name}</h3></Link>
                        <div className="cart-unit-price">
                          <strong>{formatPrice(product.price)}</strong>
                          {unitSaving > 0 && <><del>{formatPrice(product.mrp)}</del><small>Save {formatPrice(unitSaving)} each</small></>}
                        </div>
                        <div className="cart-line-actions">
                          <div className="qty-control">
                            <button onClick={() => updateQuantity(product.slug, quantity - 1)} aria-label={"Decrease " + product.name + " quantity"}><Minus /></button>
                            <span>{quantity}</span>
                            <button onClick={() => updateQuantity(product.slug, quantity + 1)} aria-label={"Increase " + product.name + " quantity"}><Plus /></button>
                          </div>
                          <button className="remove-button" onClick={() => removeFromCart(product.slug)}><Trash2 /> Remove</button>
                        </div>
                      </div>
                      <b className="line-total">{formatPrice(product.price * quantity)}</b>
                    </article>
                  );
                })}
              </div>
              <aside className="order-summary">
                <h2>Order summary</h2>
                <div><span>MRP subtotal</span><strong>{formatPrice(mrpTotal)}</strong></div>
                <div><span>Product discount</span><strong className="saving">&minus; {formatPrice(savings)}</strong></div>
                <div><span>Delivery</span><strong>Calculated at checkout</strong></div>
                <div className="summary-total"><span>Total before delivery</span><strong>{formatPrice(total)}</strong></div>
                {savings > 0 && <p className="order-saving-note">You save {formatPrice(savings)} on products in this order.</p>}
                {error && <p className="demo-note" role="alert">{error}</p>}
                {verifying && <p className="demo-note">Verifying prices and availability…</p>}
                {quote && status !== "checking" ? <Link className="button primary" href={verifiedUser(user) ? "/checkout" : "/account?next=%2Fcheckout"}>{verifiedUser(user) ? "Continue to checkout" : "Sign in to checkout"}</Link> : <button className="button primary" disabled>Continue to checkout</button>}
                <Link className="continue-link" href="/shop">Continue shopping</Link>
              </aside>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
