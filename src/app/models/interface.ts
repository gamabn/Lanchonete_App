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
