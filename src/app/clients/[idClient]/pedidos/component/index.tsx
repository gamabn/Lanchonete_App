"use client"
import { useForm } from "react-hook-form"
import z from "zod"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { Input } from "@/app/components/Input"


const schema = z.object({
  name: z.string().min(1, "O nome é obrigatório"),
  phone: z.string().min(11, "O telefone deve ter pelo menos 11 dígitos").max(15, "Telefone muito longo"),
  cidade: z.string().min(1, "A cidade e obrigatoria"),
  bairro: z.string().min(1, "O bairro e obrigatorio"),
  rua: z.string().min(1, "A rua e obrigatoria"),
  numero: z.string().min(1, "O numero e obrigatorio"),
  id: z.string().optional(),
  complemento: z.string().optional(),
  
 
})

interface FormClientProps {
  onSubmitAddress: (data: FormData) => void
  handleActive: () => void,
  initialData?: FormData | null
}

type FormData = z.infer<typeof schema>

export function FormClient({ onSubmitAddress, handleActive, initialData }: FormClientProps){
    const {register, handleSubmit, formState: { errors } } =  useForm<FormData>({
          resolver: zodResolver(schema),
          defaultValues: initialData || {}
     });

  function handleRegister(data: FormData){
    onSubmitAddress(data)        
  }

    return(
        <div className= { ` flex-col gap-3 p-3 bg-amber-200 relative z-50 text-white rounded-xl `}>
            <form onSubmit={handleSubmit(handleRegister)} className="flex flex-col gap-3">
                <h1 className="text-md font-bold text-center text-black">Endereço para entrega</h1>  
                {initialData?.id &&(
                    <Input name="id" placeholder="id" type="text"  disabled={true} register={register} error={errors.name?.message} />
                )}                  
                 <Input name="name" placeholder="Nome" type="text" register={register} error={errors.name?.message} />
                 <Input name="phone" placeholder="Telefone" type="text" register={register} error={errors.phone?.message} />
                 <Input name="rua" placeholder="Rua" type="text" register={register} error={errors.rua?.message} />
                 <Input name="bairro" placeholder="Bairro" type="text" register={register} error={errors.bairro?.message} />
                 <Input name="cidade" placeholder="Cidade" type="text" register={register} error={errors.cidade?.message} />
                 <Input name="numero" placeholder="Número" type="text" register={register} error={errors.numero?.message} />
                 <Input name="complemento" placeholder="Complemento (opcional...)" type="text" register={register} />


            <button 
            className="bg-green-500 p-2 rounded-xl text-white font-bold"
            type="submit">
                Enviar
                </button>
              </form>
              <button 
              onClick={handleActive}
              className="text-4xl absolute top-2 right-2 text-red-500">
                x
                </button>
        </div>
    )
}