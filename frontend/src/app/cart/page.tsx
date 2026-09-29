"use client";

import Image from "next/image";
import Link from "next/link";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import { useShop } from "@/components/shop-provider";
import { formatPrice } from "@/data/catalog";

export default function CartPage() {
  const {
    cart,
    cartMrpTotal,
    cartSavings,
    cartTotal,
    removeFromCart,
    updateQuantity,
  } = useShop();

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
                <div><span>MRP subtotal</span><strong>{formatPrice(cartMrpTotal)}</strong></div>
                <div><span>Product discount</span><strong className="saving">&minus; {formatPrice(cartSavings)}</strong></div>
                <div><span>Delivery</span><strong>Calculated at checkout</strong></div>
                <div className="summary-total"><span>Total before delivery</span><strong>{formatPrice(cartTotal)}</strong></div>
                {cartSavings > 0 && <p className="order-saving-note">You save {formatPrice(cartSavings)} on products in this order.</p>}
                <Link className="button primary" href="/checkout">Continue to checkout</Link>
                <Link className="continue-link" href="/shop">Continue shopping</Link>
              </aside>
            </div>
          )}
        </div>
      </section>
    </>
  );
}
