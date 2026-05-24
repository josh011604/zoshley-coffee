export type Fulfillment = 'pickup' | 'delivery';

export type PaymentMethod = 'GCash' | 'Maya' | 'Cash on Delivery' | 'Credit/Debit Card';

export type OrderStatus =
  | 'new'
  | 'confirmed'
  | 'preparing'
  | 'ready'
  | 'out_for_delivery'
  | 'completed'
  | 'cancelled';

export type OrderItem = {
  id: string;
  name: string;
  price: number;
  quantity: number;
};

export type Review = {
  id: string;
  orderId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  comment: string;
  createdAt: string;
};

export type MenuItem = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  featured?: boolean;
  is_available?: boolean;
  icon?: string;
  prep_time?: string;
};

export type OrderFormState = {
  name: string;
  phone: string;
  email: string;
  fulfillment: Fulfillment;
  deliveryAddress: string;
  deliveryLat?: number | null;
  deliveryLng?: number | null;
  paymentMethod: PaymentMethod;
  notes: string;
};

export type ConnectionState = 'loading' | 'demo' | 'connected' | 'error';
