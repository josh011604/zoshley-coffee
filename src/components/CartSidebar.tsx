import React from 'react';
import type { OrderItem } from '../types';

type CartSidebarProps = {
  cartItems: OrderItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  fulfillment: string;
  onChangeQuantity: (id: string, delta: number) => void;
  onOpenCheckout: () => void;
  onClearCart: () => void;
};

const CartSidebar: React.FC<CartSidebarProps> = ({
  cartItems,
  subtotal,
  tax,
  deliveryFee,
  total,
  fulfillment,
  onChangeQuantity,
  onOpenCheckout,
  onClearCart,
}) => {
  return (
    <section className="rounded-[2rem] border border-white/10 bg-white/5 p-5 shadow-glow backdrop-blur">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-cream/45">Your cart</p>
          <h3 className="mt-2 font-display text-3xl text-cream">Order summary</h3>
        </div>
      </div>

      <div className="mt-5 space-y-4">
        {cartItems.length ? (
          cartItems.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-cream">{item.name}</div>
                  <div className="text-sm text-cream/55">{item.quantity} × ₱{item.price}</div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onChangeQuantity(item.id, -1)}
                    className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm text-cream transition hover:border-gold/40"
                  >
                    -
                  </button>
                  <span className="w-7 text-center text-sm font-semibold text-cream">{item.quantity}</span>
                  <button
                    type="button"
                    onClick={() => onChangeQuantity(item.id, 1)}
                    className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-sm text-cream transition hover:border-gold/40"
                  >
                    +
                  </button>
                </div>
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-cream/60">
                <span>Item subtotal</span>
                <span>₱{(item.price * item.quantity).toFixed(0)}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-white/10 bg-black/10 p-6 text-sm text-cream/65">
            Add items to the cart to see your order details.
          </div>
        )}
      </div>

      <div className="mt-6 space-y-3 rounded-[1.5rem] border border-white/10 bg-black/20 p-4 text-sm text-cream/70">
        <div className="flex justify-between">
          <span>Subtotal</span>
          <span>₱{subtotal.toFixed(0)}</span>
        </div>
        <div className="flex justify-between">
          <span>Tax</span>
          <span>₱{tax.toFixed(0)}</span>
        </div>
        <div className="flex justify-between">
          <span>Delivery fee</span>
          <span>₱{deliveryFee.toFixed(0)}</span>
        </div>
        <div className="mt-3 flex justify-between border-t border-white/10 pt-3 text-base font-semibold text-cream">
          <span>Total</span>
          <span>₱{total.toFixed(0)}</span>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-3">
        <button
          type="button"
          onClick={onOpenCheckout}
          disabled={!cartItems.length}
          className="rounded-full bg-gradient-to-r from-gold via-amber-500 to-ember px-5 py-4 text-sm font-bold uppercase tracking-[0.2em] text-coffee-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Checkout
        </button>
        <button
          type="button"
          onClick={onClearCart}
          disabled={!cartItems.length}
          className="rounded-full border border-white/10 bg-black/20 px-5 py-4 text-sm font-semibold text-cream transition hover:border-gold/40 disabled:cursor-not-allowed disabled:opacity-50"
        >
          Clear cart
        </button>
      </div>
    </section>
  );
};

export default CartSidebar;
