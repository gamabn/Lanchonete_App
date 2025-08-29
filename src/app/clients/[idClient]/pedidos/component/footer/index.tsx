"use client"
import {  ShoppingCart} from "lucide-react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { useEffect, useState } from "react"
import { Product } from "@/app/models/interface"

export function Footer(){
  const param = useParams()
  const idClient = param.idClient as string
  const [item,setItem] = useState<Product[]>([])

  useEffect(() => {
    const cartFromStorage = localStorage.getItem('product');
    if (cartFromStorage) {
      //console.log('Produtos no footer', cartFromStorage)
      setItem(JSON.parse(cartFromStorage));
      
    }
  }, []);
  

    return(
        <div className="flex items-center justify-center bg-gray-800/85 h-[50px] w-full">
         <Link href={`/clients/${idClient}/pedidos`}>
           <div className="flex items-center bg-gray-900 justify-center rounded-full p-2">
                <ShoppingCart size={25} color="#00ff00" className=""/>
            </div>
            {item?.length > 0 && (
               <div className="absolute top-5 right-37 rounded-full bg-blue-400 h-5 w-5 flex items-center justify-center text-white">
                <p className="p-1">{item?.length}</p> 
           </div>
           )}
         </Link>

          
        
        </div>
    )
}