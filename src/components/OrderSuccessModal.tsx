import React from 'react';

type OrderSuccessModalProps = {
  isOpen: boolean;
  orderCode: string;
  fulfillment: string;
  estimatedDeliveryTime: string;
  onClose: () => void;
};

const OrderSuccessModal: React.FC<OrderSuccessModalProps> = ({ isOpen, orderCode, fulfillment, estimatedDeliveryTime, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-2xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#0f0906] p-8 shadow-2xl shadow-black/60">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cream/45">Order placed</p>
            <h2 className="mt-2 font-display text-3xl text-cream">Success!</h2>
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm text-cream/70">
            Close
          </button>
        </div>

        <div className="mt-8 space-y-5 rounded-[1.75rem] border border-white/10 bg-black/20 p-7">
          <div className="rounded-2xl bg-white/5 p-5">
            <p className="text-sm text-cream/60">Order code</p>
            <p className="mt-2 text-3xl font-semibold text-cream">{orderCode}</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-cream/45">Fulfillment</p>
              <p className="mt-2 text-lg font-semibold text-cream">{fulfillment}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-black/10 p-4">
              <p className="text-xs uppercase tracking-[0.24em] text-cream/45">Estimated arrival</p>
              <p className="mt-2 text-lg font-semibold text-cream">{estimatedDeliveryTime}</p>
            </div>
          </div>

          <p className="text-sm leading-7 text-cream/70">
            Your order is now in the queue. Use this code to track progress in the staff panel or ask for help at the counter.
          </p>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccessModal;
