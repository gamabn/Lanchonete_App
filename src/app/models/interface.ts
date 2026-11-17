export interface Product {
  category?: string | null;
  id: string;
  restaurant_id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  available: boolean;
  created_at: string;
  has_variants?: boolean;
}

export interface LanchoneteProfile {
  id: string;
  name: string;
  email: string;
  city: string;
  neighborhood: string;
  street: string;
  number: string;
  phone: string;
  image_url?: string;
  open?: boolean;
  status?: boolean;
}

export interface Message {
  id: string;
  name?: string;
  chat_id: string;
  sender_type: "customer" | "restaurant";
  sender_id: string;
  message: string;
  created_at: string;
}

export interface OrderAddress {
  name?: string | null;
  street?: string | null;
  number?: string | number | null;
  neighborhood?: string | null;
  city?: string | null;
  complement?: string | null;
}

export interface VendasProps {
  restaurant_id: string;
  order_id: string;
  status: string;
  total_price: number;
  fulfillment_type?: "DELIVERY" | "PICKUP" | null;
  subtotal?: number | string | null;
  delivery_fee?: number | string | null;
  delivery_address?: OrderAddress | null;
  pickup_address?: OrderAddress | null;
  created_at: string;
  payment_method: string;
  change_for: string | number | null;

  customer: {
    id: string;
    name: string;
    phone: string;
    city: string | null;
    street: string | null;
    number: string | null;
    neighborhood: string | null;
    complement?: string | null;
  };
  items: OrderItem[];
  /* items: {
    id: string; // id do order_item
    product_id: string;
    product_name: string;
    quantity: number;
    item_price: number;
  }[];*/
}

export interface Bairros {
  id: string;
  bairro: string;
  frete: string;
  criado_em: string;
  lanchonete_id: string;
}
export interface OrderItemOption {
  id: string;
  option_id: string | null;
  option_name: string;
  group_name: string;
  additional_price: number;
}

export interface OrderItem {
  id: string;
  product_id: string;
  product_name: string;
  quantity: number;
  item_price: number;
  variant_id: string | null;
  variant_name: string | null;
  options: OrderItemOption[];
}

export interface CartProduct extends Product {
  variant_id?: string;
  option_ids?: string[];
  variant_name?: string;
  options?: { id: string; name: string; group_name: string; additional_price: number }[];
}

export interface PublicProductConfiguration {
  product: Product;
  variants: {
    id: string;
    name: string;
    price: string | number;
    groupLimits: { groupId: string; minSelect: number; maxSelect: number }[];
  }[];
  groups: {
    id: string;
    name: string;
    required: boolean;
    min_select: number;
    max_select: number;
    options: { id: string; group_id: string; name: string; additional_price: string | number }[];
  }[];
}
