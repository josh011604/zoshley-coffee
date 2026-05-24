export type Fulfillment = 'pickup' | 'delivery';

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
  notes: string;
};

export type ConnectionState = 'loading' | 'demo' | 'connected' | 'error';
