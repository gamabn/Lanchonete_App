"use client"
import { useContext, useState } from "react"
import { Context } from "@/app/Context"
import { UserRound, Mail, MapPinHouse,  Phone} from "lucide-react"
import { supabase } from "@/app/lib/supabase"
import { toast, ToastContainer } from "react-toastify"
import { MdFileUpload } from "react-icons/md"
import api from "@/app/util/api"


export default function Profile(){
    const [image, setImage] = useState<File | null>(null)
    const {lanchoneteProfile, user} = useContext(Context)
    const [loading, setLoading] = useState(false)
    const [preView, setPreView] = useState<string | null>(null)
    const [formMessage, setFormMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
    const [lanchonete, setLanchonete] = useState({
        id: lanchoneteProfile?.id,
        name: lanchoneteProfile?.name,
        phone: lanchoneteProfile?.phone,
        email: lanchoneteProfile?.email,
        city: lanchoneteProfile?.city,
        neighborhood: lanchoneteProfile?.neighborhood,
        street: lanchoneteProfile?.street,
        number: lanchoneteProfile?.number,
        image_url: lanchoneteProfile?.image_url,
    })



  async function handleEditProfile() {
    setLoading(true);
    setFormMessage(null);
    if(!image){
        return toast.info("A imagem é obrigatoria")
    }
    
    try {
     const formData = new FormData();
     formData.append("file", image);
     const imageApi = await api.put(`/user/image/${lanchonete.id}`, formData, {
          headers: {
            "Content-Type": "multipart/form-data"
          }
        });
    const res = await fetch(`/api/user/`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        id: lanchonete.id,
        name: lanchonete.name,
        email: lanchonete.email,
        phone: lanchonete.phone,
        city: lanchonete.city,
        neighborhood: lanchonete.neighborhood,
        street: lanchonete.street,
        number: lanchonete.number,
      })},
   );
     if(res.ok){
         toast.success('Perfil atualizado com sucesso!');
     }
     
    } catch (error) {
      console.error("Erro ao editar perfil:", error);
      toast.error('Erro ao atualizar o perfil. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }

    return(
        <div className="p-6 flex flex-col ">
            <h1 className="text-2xl font-bold text-center">
                Perfil da Lanchonete
                </h1>
                <div className="flex gap-3 mt-3 border-b justify-center">
                    <div className="p-4">
                        <img
                        src={preView || lanchoneteProfile?.image_url} 
                        alt="lanchonete"
                        className="h-[150px] w-[150px] rounded-full md:w-[400px] md:h-[400px]" />


                        <label className="">
                            <span className="flex px-3 flex-col rounded-xl mt-2 bg-black items-center justify-center ">
                                <MdFileUpload color="#0000FF" size={25} className=" z-99"/>
                            </span>
                                <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                onChange={(e) =>{
                                    const fileImg = e.target.files?.[0];
                                    if(fileImg){
                                        setImage(fileImg)
                                    }
                                    const imageUrl = URL.createObjectURL(fileImg);
                                setPreView(imageUrl)
                                }} />
                        </label>
                        </div>
                   
               
                <div>
                    <p className="text-sm font-light md:text-xl p-2 flex"> 
                        <span><UserRound size={26} color="#0000ff"/></span>
                        {lanchoneteProfile?.name}
                    </p>

                    <p className="text-sm font-light p-2 md:text-lg flex gap-2 ">
                         <span><Mail size={26} color="#0000ff"/></span>
                             {lanchoneteProfile?.email}
                         </p>

                         <p className="text-sm font-light p-2 md:text-lg flex gap-2">
                            <span><MapPinHouse size={26} color="#0000ff"/></span>
                                {lanchoneteProfile?.city}<br/>
                                {lanchoneteProfile?.neighborhood}<br/>
                                {lanchoneteProfile?.street}<br/>
                                {lanchoneteProfile?.number}
                                </p>
                         <span className="text-sm font-light p-2 md:text-lg flex gap-2">
                            <Phone size={26} color="#0000ff"/>
                            {lanchoneteProfile?.phone}
                         </span>
                   
                </div>
                 </div>

                <div>
                    <h2 className="text-2xl font-bold text-center p-3">Editar Perfil</h2>
                    <div>
                        <div>
                            <div>
                            <label>Nome da lanchonete</label>
                                <input 
                                className="w-full p-2 border rounded-lg mb-3"
                                type="text" 
                                value={lanchonete.name}
                                onChange={(e) => setLanchonete({...lanchonete, name: e.target.value   })}
                                />
                            </div>

                            <div>
                                <label>Email</label>
                                    <input 
                                    className="w-full p-2 border rounded-lg mb-3"
                                    type="text"  
                                    value={lanchonete.email}
                                    onChange={e => setLanchonete({...lanchonete, email: e.target.value   })}
                                    />
                            </div>

                            <div>
                                <label>Telefone</label>
                                    <input 
                                    className="w-full p-2 border rounded-lg mb-3"
                                    type="text"  
                                    value={lanchonete.phone}
                                    onChange={e => setLanchonete({...lanchonete, phone: e.target.value   })}
                                    />
                            </div>


                            <div>
                            <label>Cidade</label>
                                <input 
                                className="w-full p-2 border rounded-lg mb-3"
                                type="text"  
                                value={lanchonete.city}
                                onChange={e => setLanchonete({...lanchonete, city: e.target.value   })}
                                />
                            </div>

                            <div>
                            <label>Bairro</label>
                                <input 
                                className="w-full p-2 border rounded-lg mb-3"
                                type="text"  
                                value={lanchonete.neighborhood}
                                onChange={e => setLanchonete({...lanchonete, neighborhood: e.target.value   })}
                                />   
                            </div>

                            <div>
                            <label>Rua</label>
                                <input 
                                className="w-full p-2 border rounded-lg mb-3"
                                type="text"  
                                value={lanchonete.street}
                                onChange={e => setLanchonete({...lanchonete, street: e.target.value   })}
                                />
                            </div>
                            
                            <div>
                            <label>Numero</label>
                                <input 
                                className="w-full p-2 border rounded-lg mb-3"
                                type="text"  
                                value={lanchonete.number}
                                onChange={e => setLanchonete({...lanchonete, number: e.target.value   })}
                                />
                            </div>

                        </div>
                        <button
                         onClick={handleEditProfile}
                         disabled={loading}
                         className="bg-blue-500 text-white p-2 rounded-lg w-full">
                           {loading ? "Carregando..." : "Salvar" } 
                        </button>
                    </div>
                </div>
          
        </div>
    )

}