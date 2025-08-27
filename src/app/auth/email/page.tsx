"use client"
import { Header } from "@/app/components/header";
import { useState } from "react";
import api from "@/app/util/api";
import { set } from "zod";

export default function ForgetEmail(){
    const [email, setEmail] = useState('')

    async function handleEmail(){
        if(!email) return;

        const response = await api.post('/user/change', {
            email
        })
        console.log(response.data)
        setEmail('')

    }
    return(
        <div>
            <Header/>
            <h1
             className="text-2xl font-bold text-center m-5 max-sm:text-md">
                Digite seu email
           </h1>

            <div className="flex flex-col gap-2 p-3">
                <input 
                className="p-2  border rounded-xl w-full "
                type="text" 
                placeholder="Email" 
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                />

                <button
                onClick={handleEmail}
                className="bg-blue-600 text-white p-2 text-lg rounded-xl"
                >Enviar</button>
            </div>
        </div>
    )
}