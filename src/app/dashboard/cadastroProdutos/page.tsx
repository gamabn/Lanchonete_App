"use client"
import { MdFileUpload } from "react-icons/md"
import Image from "next/image"
import { useState } from "react"
import z, { set } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "@/app/components/Input";
import { parseRealToCents } from "@/app/components/money";
import { toast } from "react-toastify";
import { useContext } from "react";
import { Context } from "@/app/Context";
import { id } from "zod/locales";



 const schema = z.object({
    nome: z.string().min(3, "Nome e obrigatorio e tem que ter mais de 3 caracteres"),
    valor: z.string().min(1, "Valor e obrigatorio").refine((item)=> parseRealToCents(item) >= 0, {message: "Valor invalido"}),
    descricao: z.string().optional()

 })

 type ProdutosData = z.infer<typeof schema>


export default function Cadastro(){
         const {user, lanchoneteProfile} = useContext(Context)
         const [previewImage, setPreviewImage] = useState<string | null>(null);
         const [image, setImage] = useState<File | null>(null);
         const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
          const [loading, setLoading] = useState(false)

          if(!lanchoneteProfile?.id)return null;


         const {
            register,
            handleSubmit,
            formState:  { errors, isSubmitting }, reset, control } = useForm<ProdutosData>({
            resolver: zodResolver(schema)
         })

         const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
            if(e.target.files && e.target.files.length > 0){
             const file = e.target.files?.[0];
             
             if(file.type !== "image/jpeg" && file.type !== "image/png"){
                return toast.info("Apenas arquivos JPG ou PNG")
             }

             setImage(file);
             setPreviewImage(URL.createObjectURL(file));
            }
         }

        async function  handleCadastro(data: ProdutosData){
            //console.log('Dados do formulario',data)
            console.log("Imagem para upload:", image);
            setFormMessage(null)
            setLoading(true)

           
          
            try{
                  if (!image) throw new Error("Imagem não selecionada");
                  if (!lanchoneteProfile?.id) throw new Error("ID da lanchonete não disponível");

                     const formData = new FormData();
                        formData.append("file", image); // Blob
                        formData.append("name", data.nome || ""); // string
                        formData.append("price", parseRealToCents(data.valor).toString()); // string
                        formData.append("description", data.descricao || ""); // string
                        formData.append("restaurant_id", lanchoneteProfile.id.toString()); // string

                 const response = await fetch("/api/product", {
                    method: "POST",
                    body: formData,
                  });
              // console.log(uploadData)
                setLoading(false)
                if(response.ok){
                    setFormMessage({ type: 'success', text: "Produto cadastrado com sucesso!",  });
                }else{
                    setFormMessage({ type: 'error', text: "Erro ao cadastrar produto!",  })
                }
               
                reset();
                setImage(null);
                setPreviewImage(null);
            }catch(error){
                console.log(error)

               
            }

       }
            
    
    return(
        <div className="flex flex-col h-screen w-full p-8">
            <h1 className="text-2xl font-bold text-center p-3">Cadastro de Produtos</h1>
           <div>
             <form  onSubmit={handleSubmit(handleCadastro)}>
               

                    <label className="flex h-[250px] border  px-3 flex-col items-center justify-center w-full relative">

                            <span>
                                <MdFileUpload color="#0000FF" size={45} className="mr-2 z-99"/>
                            </span>

                        <input
                            type="file"
                            accept="image/*" 
                            onChange={handleFile}
                            required
                            className="text-white hidden"
                        />
                        
                        {previewImage &&(
                                <Image
                                src={previewImage}
                                alt="Preview"
                                className=""
                                fill
                                quality={100}
                                style={{ objectFit: "cover" }}                           
                                />

                            )}
             </label>
               
                
                <div className="flex flex-col gap-1 mt-2">

                    <label>Nome do Produto</label>

                    <Input
                     name="nome" 
                    placeholder="Nome do Produto"                 
                    register={register} error={errors.nome?.message} 
                    type="text" 
                    />
                </div>

                <div className="flex flex-col gap-1 mt-2">
                    <label>Valor do Produto</label>
                    <Input
                      name="valor"
                       placeholder="valor do produto" 
                       register={register} error={errors.valor?.message}
                        type="text"  
                        control={control}
                        currency                
                    />
                </div>

                <div className="flex flex-col gap-1 mt-2">

                    <label>Descriçao do Produto</label>

                    <Input
                   name="descricao"
                    placeholder="Descrição (Opcional)"
                     register={register}
                      error={errors.descricao?.message} type="text" 
                    />
                </div>
                  {formMessage && (
                    <p className={`text-sm mt-2 ${formMessage.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                        {formMessage.text}
                    </p>
                )}
                <button 
                type="submit"
                className="flex bg-green-500 w-full cursor-pointer p-2 items-center justify-center h-11 rounded-xl text-white font-bold mt-4">
                   {loading ? 'Carregando...' : 'Cadastrar'}
                </button>
             </form>

            </div>
        </div>
    )
}