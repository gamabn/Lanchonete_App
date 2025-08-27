"use client"
import Link from "next/link"
import { House} from "lucide-react"

export function Header(){
    return(
        <div>    
                 <div className=" h-[90px] bg-black w-full flex justify-center items-center" >
                    <h1 className="text-white text-3xl font-bold">Itambe </h1>
                    <img src="/lanche4.png" alt="lanches" className=" h-[90px]" />
                    <h2 className="text-white text-3xl font-bold">Lanches</h2>           
                </div>
               
        </div>
    )
}