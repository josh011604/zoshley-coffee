import React from 'react';
import type { OrderFormState, OrderItem, PaymentMethod } from '../types';
import MapAutocomplete from './MapAutocomplete';
import MapPreview from './MapPreview';

type CheckoutModalProps = {
  isOpen: boolean;
  orderForm: OrderFormState;
  cartItems: OrderItem[];
  subtotal: number;
  tax: number;
  deliveryFee: number;
  total: number;
  onClose: () => void;
  onUpdateForm: (field: keyof OrderFormState, value: string) => void;
  onSetDeliveryLocation?: (address: string, lat: number | null, lng: number | null) => void;
  onSubmit: () => void;
  submitting: boolean;
  canSubmit: boolean;
};

const paymentOptions: PaymentMethod[] = ['GCash', 'Maya', 'Cash on Delivery', 'Credit/Debit Card'];

const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  orderForm,
  cartItems,
  subtotal,
  tax,
  deliveryFee,
  total,
  onClose,
  onUpdateForm,
  onSetDeliveryLocation,
  onSubmit,
  submitting,
  canSubmit,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start sm:items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm overflow-auto">
      <div className="w-full max-w-4xl max-h-[90vh] overflow-auto rounded-[2rem] border border-white/10 bg-[#0f0906] p-6 shadow-2xl shadow-black/60">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cream/45">Checkout</p>
            <h2 className="mt-2 font-display text-3xl text-cream">Confirm your order</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-cream/70">
            Close
          </button>
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[0.95fr_0.8fr]">
          <div className="space-y-5 rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="space-y-2 text-sm text-cream/70">
                <span className="font-semibold text-cream">Customer name</span>
                <input
                  value={orderForm.name}
                  onChange={(event) => onUpdateForm('name', event.target.value)}
                  aria-label="Customer name"
                  className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-cream outline-none transition placeholder:text-cream/40 focus:border-gold/60"
                  placeholder="Anna Santos"
                />
              </label>
              <label className="space-y-2 text-sm text-cream/70">
                <span className="font-semibold text-cream">Phone</span>
                <input
                  value={orderForm.phone}
                  onChange={(event) => onUpdateForm('phone', event.target.value)}
                  aria-label="Phone"
                  className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-cream outline-none transition placeholder:text-cream/40 focus:border-gold/60"
                  placeholder="0917 123 4567"
                />
              </label>
            </div>

            <label className="block space-y-2 text-sm text-cream/70">
              <span className="font-semibold text-cream">Email</span>
              <input
                value={orderForm.email}
                onChange={(event) => onUpdateForm('email', event.target.value)}
                aria-label="Email"
                className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-cream outline-none transition placeholder:text-cream/40 focus:border-gold/60"
                placeholder="anna@example.com"
                type="email"
              />
            </label>

            <label className="block space-y-2 text-sm text-cream/70">
              <span className="font-semibold text-cream">Fulfillment</span>
              <select
                value={orderForm.fulfillment}
                onChange={(event) => onUpdateForm('fulfillment', event.target.value as any)}
                aria-label="Fulfillment"
                className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-cream outline-none transition focus:border-gold/60"
              >
                <option value="pickup">Pickup</option>
                <option value="delivery">Delivery</option>
              </select>
            </label>

            {orderForm.fulfillment === 'delivery' ? (
              <label className="block space-y-2 text-sm text-cream/70">
                <span className="font-semibold text-cream">Delivery location</span>
                <MapAutocomplete
                  value={orderForm.deliveryAddress}
                  onSelect={(address, lat, lng) => {
                    if (onSetDeliveryLocation) onSetDeliveryLocation(address, lat, lng);
                    else onUpdateForm('deliveryAddress', address);
                  }}
                  placeholder="Enter your delivery address"
                />
                {orderForm.deliveryLat != null && orderForm.deliveryLng != null ? (
                  <div className="mt-3">
                    <MapPreview destLat={orderForm.deliveryLat} destLng={orderForm.deliveryLng} height="180px" />
                  </div>
                ) : null}
                <p className="text-xs text-cream/55">Pin your location and get an estimated fee and ETA.</p>
              </label>
            ) : null}

            <label className="block space-y-2 text-sm text-cream/70">
              <span className="font-semibold text-cream">Payment method</span>
              <select
                value={orderForm.paymentMethod}
                onChange={(event) => onUpdateForm('paymentMethod', event.target.value as PaymentMethod)}
                aria-label="Payment method"
                className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-cream outline-none transition focus:border-gold/60"
              >
                {paymentOptions.map((method) => (
                  <option key={method} value={method}>{method}</option>
                ))}
              </select>
            </label>

            <label className="block space-y-2 text-sm text-cream/70">
              <span className="font-semibold text-cream">Special requests</span>
              <textarea
                value={orderForm.notes}
                onChange={(event) => onUpdateForm('notes', event.target.value)}
                aria-label="Special requests"
                rows={4}
                className="w-full rounded-2xl border border-white/10 bg-black/10 px-4 py-3 text-cream outline-none transition placeholder:text-cream/40 focus:border-gold/60"
                placeholder="Add any notes or allergy details"
              />
            </label>
          </div>

          <div className="rounded-[1.75rem] border border-white/10 bg-black/20 p-5">
            <div className="mb-5 flex items-center justify-between text-xs uppercase tracking-[0.28em] text-cream/45">
              <span>Order summary</span>
              <span>{cartItems.length} items</span>
            </div>
            <div className="space-y-3">
              {cartItems.map((item) => (
                <div key={item.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                  <div>
                    <p className="font-semibold text-cream">{item.name}</p>
                    <p className="text-sm text-cream/60">{item.quantity} x ₱{item.price}</p>
                  </div>
                  <p className="text-sm font-semibold text-cream">₱{(item.price * item.quantity).toFixed(0)}</p>
                </div>
              ))}
            </div>

            <div className="mt-5 space-y-3 rounded-[1.5rem] border border-white/10 bg-black/10 p-4 text-sm text-cream/70">
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
              <div className="flex justify-between border-t border-white/10 pt-3 text-base font-semibold text-cream">
                <span>Total</span>
                <span>₱{total.toFixed(0)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={onSubmit}
              disabled={cartItems.length === 0 || submitting}
              className="mt-5 w-full rounded-full bg-gradient-to-r from-gold via-amber-500 to-ember px-5 py-4 text-sm font-bold uppercase tracking-[0.2em] text-coffee-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Placing order…' : 'Confirm order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutModal;
