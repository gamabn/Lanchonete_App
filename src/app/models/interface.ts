export interface Product {
    id: string;
    restaurante_id: string;
    name: string;
    description: string;
    price: number;
    image_url: string;
    available: boolean;
    created_at: string;
    
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
  open?:boolean
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

export interface VendasProps {
  order_id: string;
  status: string;
  total_price: number;
  created_at: string;
   payment_method: string;
  change_for: number;
 
  customer: {
    id: string;
    name: string;
    phone: string;
    city: string;
    street: string;
    number: string;
    neighborhood: string;
    complement?: string;
  };

  items: {
    id: string; // id do order_item
    product_id: string;
    product_name: string;
    quantity: number;
    item_price: number;
  }[];
}
