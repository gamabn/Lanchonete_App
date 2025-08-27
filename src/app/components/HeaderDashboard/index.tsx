'use client'
import Link from "next/link"
import { useState, useEffect, use } from "react";
import {FiLogOut, FiLoader,FiLock, FiDollarSign, FiUsers, FiShoppingBag} from 'react-icons/fi'
import { CalendarCheck,CalendarClock, ChartNoAxesCombined, MessageCircleMore, FilePenLine,AlignJustify, House, UserRound} from 'lucide-react';
import { useRouter } from "next/navigation";
import { useContext } from "react";
import { Context } from "@/app/Context";
import { io } from 'socket.io-client'
import api from "@/app/util/api";


const socket = io("http://localhost:3333");


socket.on("connect", () => {
  console.log("Conectado ao backend com id:", socket.id);
});

export  function HeaderDashboard({children}: {children: React.ReactNode}){
   const {user, lanchoneteProfile, logout} = useContext(Context)
    const [active, setActive] = useState(false)
    const [isClient, setIsClient] = useState(false)
    const [isOpen, setIsOpen] = useState<boolean>(false); 
   
    const router = useRouter()
useEffect(() =>{
  getStore()
},[])

  async function getStore(){
    if(lanchoneteProfile?.id){
      const res = await fetch(`/api/store/${lanchoneteProfile?.id}`)
      const data = await res.json()  
       //console.log('loja do cliente',data)
     
     setIsOpen(data.status)
    }
  }

   

    useEffect(() =>{
      setIsClient(true)
    },[])

    useEffect(()=>{
      socket.on("statusUpdated",(data)=>{
           console.log("Status da loja (evento):", data.status); // ✅ mostra o valor real
        setIsOpen(data.status)
        
      })

         return () => {
      socket.off("statusUpdated");
    };
    },[])

    async function handleSwitch() {
      setIsOpen(!isOpen);
      try {
        const res = await fetch('/api/login', {
          method: 'PATCH',
          body: JSON.stringify({ status: !isOpen }),
          headers: {
            'Content-Type': 'application/json',
          }, 
      })
        
       }catch(err){
       console.log(err)
     }
    }

  


    return(
        <div className="flex flex-col h-screen w-full">
        <header className="w-full flex bg-black items-center px-2 py-4  h-20 shadow-sm max-sm:hidden">
            <div className="w-full flex items-center  justify-between max-w-7xl mx-auto max-sm:justify-items-start max-sm:gap-6 ">
                 <div className="h-[60px] flex items-center gap-2" >
                    <h1 className="text-white text-3xl font-bold">{lanchoneteProfile?.name}</h1>
                    <img src={lanchoneteProfile?.image_url} alt="lanches" className=" h-[60px] w-[60px] rounded-full" />
                         
                </div>

                 <label className="inline-flex items-center cursor-pointer ml-2">
                        <input
                        type="checkbox"
                        className="sr-only peer"
                        checked={isOpen}
                        onChange={handleSwitch}
                        />
                        <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 
                            dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 
                            peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full 
                            peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] 
                            after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full 
                            after:h-5 after:w-5 after:transition-all dark:border-gray-600 
                            peer-checked:bg-blue-600 dark:peer-checked:bg-blue-600">
                        </div>
                        <span className="ms-3 text-sm font-medium text-white dark:text-gray-300">
                        {isOpen ? "Aberto" : "Fechado"}
                        </span>
                    </label>

                    <div className="flex items-baseline gap-6 max-sm:gap-6">
                         <Link 
                         className="flex hover:bg-gray-700 rounded-full p-2 items-center justify-center"
                         href='/dashboard'>
                             <House size={26} color="#fff"/>
                        </Link>
                         <Link 
                          className="flex hover:bg-gray-700 rounded-full p-2 items-center justify-center"
                         href='/dashboard/cadastroProdutos'>
                           <FiShoppingBag color="#fff" size={26}/>
                          
                        </Link>

                         <Link 
                         className="flex hover:bg-gray-700 rounded-full p-2 items-center justify-center"
                         href='/dashboard/financas'>
                           < ChartNoAxesCombined size={26} color="#fff"/>
                          
                        </Link>

                        <Link
                        className="flex hover:bg-gray-700 rounded-full p-2 items-center justify-center"
                         href='/dashboard/message'>
                           <MessageCircleMore  size={26} color="#fff"/>
                          
                        </Link>

                        <Link 
                        className="flex hover:bg-gray-700 rounded-full p-2 items-center justify-center"
                        href='/dashboard/profile'>
                            <UserRound size={26} color="#fff"/>
                        </Link>

                         <Link 
                         className="flex hover:bg-gray-700 rounded-full p-2 items-center justify-center"
                         href='/dashboard/editProduct'>
                            <FilePenLine size={26} color="#fff"/>
                        </Link>

                       <button
                       onClick={ ()=>logout()}
                       className="flex hover:bg-gray-700 rounded-full p-2 items-center justify-center"
                        >
                                < FiLogOut size={26} color="#f80627"/>
                        </button>


                    </div>
            </div>
        </header>


    {/* Renderiza o menu lateral e o botão de toggle apenas no cliente para evitar erros de hidratação */}
    {isClient && (
      <>
        <div  className={`fixed top-0 left-0 h-full bg-black z-50 transform transition-transform duration-300 ${
                      active ? "translate-x-0" : "-translate-x-full"
                  } w-[200px] max-sm:w-[80px] md:hidden`}> 
              
                <div className="w-full  p-3 flex flex-col "> 

                      <div className="mt-6 w-full flex flex-col items-center max-sm:items-start gap-3">  

                           <button 
                              onClick={()=>setActive(!active)}
                              className="h-[30px] w-[35px] bg-black md:hidden  rounded-full flex items-center justify-center">
                                  <AlignJustify size={26} color="#00ff00"/>
                              </button>

                              <div>
                                <img src={lanchoneteProfile?.image_url} alt="Logo-Lanchonete" className="h-[30px] w-[30px] rounded-full" />
                              </div>

                       <Link className="flex  mt-3" href='/dashboard'>
                          <House size={26} color="#FFF"/>
                      </Link>

                        <Link href='/dashboard/cadastroProdutos'>
                             <FiShoppingBag color="#FFF" size={26}/>
                            
                          </Link>

                          <Link href='/dashboard/financas'>
                             <ChartNoAxesCombined size={26} color="#FFF"/>
                            
                          </Link>

                              <Link href='/dashboard/message'>
                              < MessageCircleMore size={26} color="#fff"/>
                          </Link>

                            
                         

                              <Link href='/dashboard/profile'>
                              < UserRound size={26} color="#fff"/>
                          </Link>

                           <Link href='/dashboard/editProduct'>
                              <FilePenLine size={26} color="#fff"/>
                          </Link>
                    <div className="flex flex-col items-center justify-center"  onClick={handleSwitch}>
                      <input
                      type="checkbox" 
                        className="sr-only peer"
                          checked={isOpen}
                          onChange={handleSwitch}
                          />
                      <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 
                                dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 
                                peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full 
                                peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] 
                                after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full 
                                after:h-5 after:w-5 after:transition-all dark:border-gray-600 
                                peer-checked:bg-blue-600 dark:peer-checked:bg-blue-600">
                            </div>
                              <span className=" text-sm font-medium text-white dark:text-gray-300">
                            {isOpen ? "Aberto" : "Fechado"}
                            </span>
                </div>

                     <button
                    // onClick={signUpNewUser}
                    onClick={ ()=>logout()}
                      >
                        <FiLogOut size={26} color="#f80627"/>
                      </button>
                  </div>                               
                      
              </div>                            
                      
          </div>
       
           
              <button 
                  onClick={()=>setActive(!active)}
                    className="h-[30px] w-[35px] bg-black md:hidden absolute top-2 left-2 rounded-full flex items-center justify-center">
                      <AlignJustify size={26} color="#00ff00"/>
                  </button>
      </>
    )}
       <div className="flex-1 flex flex-col overflow-y-auto">
               
             {children}
       </div>
           
       
        </div>
    )
}