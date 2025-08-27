"use client"
import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import { supabase } from "@/app/lib/supabase";
import Link from "next/link";
import { Loader, ArrowLeft } from "lucide-react";
import { useParams } from "next/navigation";
import { Product, LanchoneteProfile } from "@/app/models/interface";
import { formatReal, parseRealToCents } from "@/app/money";
import { FormClient } from "./component";
import { number, z } from "zod";
import { useRouter } from "next/navigation";
import api from "@/app/util/api";
import { id } from "zod/locales";

const addressSchema = z.object({
  name: z.string(),
  phone: z.string(),
  cidade: z.string(),
  bairro: z.string(),
  rua: z.string(),
  numero: z.string(),
  complemento: z.string().optional(),
  id: z.string().optional()
});
type AddressData = z.infer<typeof addressSchema>;

export default function Car(){
    const param = useParams()
    const [loading, setLoading] = useState<boolean>(true)
    const idClient = param.idClient as string
    const [car, setCar] = useState<Product[]>([])   
    const [count, setCount] = useState<{[id: string]: number}>({})
    const [active, setActive] = useState(false)
    const [address, setAddress] = useState<AddressData | null>(null)
    const [existUser, setExistUser] = useState<AddressData | null>(null)
    const router = useRouter()
    const [trocoPara, setTrocoPara] = useState<string>('')
     const [payments, setPayments] = useState<string>("");
    const [store,setStore] = useState<LanchoneteProfile>({
         id: '',
      name: '',
      email: '',
      phone: '',
      city: '',
      neighborhood: '',
      street: '',
      number: '',
      image_url: '',
    })

    async function getProduct(){
       const existItem = await localStorage.getItem('product')

       if(existItem){
        setCar(JSON.parse(existItem))
       }else{
        setCar([])
       }
    }

     async function getStore(){
        if(idClient){
          const res = await fetch(`/api/store/${idClient}`)
          const data = await res.json()  
          console.log('loja do cliente',data)
        setStore(data)
     
        }
  }

    
      useEffect(() =>{
        async function loadInitialData() {
        //  console.log('YUsuario',existUser)
          if (idClient) {
            await Promise.all([
              getStore(),
              getProduct()
            ]);

            const savedAddress = localStorage.getItem('customerInfo');
            if (savedAddress) {
              try {
                setAddress(JSON.parse(savedAddress));
              } catch (e) { console.error("Erro ao ler endereço do localStorage", e); }
            }
            setLoading(false);
          }
        }
        loadInitialData();
      },[idClient, existUser])

      async function handleSub(item: Product){
        //console.log('Produto adicionado ao carrinho',item)
        setCount(prevCount => {
            const current = prevCount[item.id] || 0;
            if (current <= 1) return prevCount;

            return {
            ...prevCount,
            [item.id]: current - 1
            };
        });
    }
      

      async function handleAdd(item: Product){
        setCount(prevCount => {
            return {
            ...prevCount,
            [item.id]: (prevCount[item.id] || 0) + 1
            };
        });
       
    };
     function handresAdress(data: AddressData){
      console.log('Endereço',data)
      setActive(false)
      setAddress(data)
     }
  

      if(loading){
        return(
            <div className="flex flex-col items-center justify-center h-screen w-full">
                <h1 className="text-2xl font-bold text-center p-3">Carregando...</h1>
                <Loader className="text-2xl text-center text-green-500 animate-spin"/>
            </div>
        )
      }

   async function handleFinalizar() {
            if (!address || !idClient) {
        toast.error("Por favor, adicione um endereço de entrega ou metodo de pagamento.");
        return;
      }
      if(!payments){
        toast.error("Por favor, selecione um metodo de pagamento.");
        return;
      }

      

      const itemsInCart = car.filter(item => (count[item.id] || 0) > 0);
      if (itemsInCart.length === 0) {
        toast.error("Seu carrinho está vazio ou sem quantidades definidas.");
        return;
      }

      setLoading(true);

  try {
        let customerId = null;

        // GET cliente via fetch (Next.js API)
        const res = await fetch(`/api/client/${idClient}?phone=${address.phone}`);
            if(!res.ok) throw new Error('Erro ao buscar cliente');
            const data = await res.json();
            console.log('dados do cliente',data)
            const existingCustomer = Array.isArray(data) ? data[0] : data;
           // setExistUser(existingCustomer || null)


            if (existingCustomer) {
              customerId = existingCustomer.id;

              const resClient = await api.put(`/client/update`, {
                id: existingCustomer.id,
                name: address.name,
                phone: address.phone,
                city: address.cidade, 
                street: address.rua,
                number: address.numero,
                neighborhood: address.bairro,               
                complement: address.complemento,

              })
              console.log('resClient',resClient.data)
              if (!resClient.data) throw new Error("Erro ao atualizar cliente");

            } else {
              // Cria novo cliente via backend (axios)
              const clientResponse = await api.post(`/client/${idClient}`, {
                name: address.name,
                phone: address.phone,
                city: address.cidade, // certifique-se que backend espera city
                number: address.numero,
                street: address.rua,
                neighborhood: address.bairro,
                complement: address.complemento,
              });
              const newCustomer = clientResponse.data;
              if (!newCustomer) throw new Error("Erro ao criar cliente");
              customerId = newCustomer.id;
            }

        // Cria pedido
        const orderResponse = await api.post(`/order/${idClient}`, {
          customer_id: customerId,
          total_price: totalItem,
          status: 'pending',
          payment_method: payments,
          change_for:  parseRealToCents(trocoPara),
        });
        const orderData = orderResponse.data;
        if (!orderData) throw new Error("Erro ao criar pedido");

    localStorage.setItem('order', JSON.stringify(orderData.order.id));

        // Insere itens do pedido
        const orderItems = itemsInCart.map(item => ({
           order_id: orderData.order.id,
          product_id: item.id,
          quantity: count[item.id],
          item_price: item.price,
        }));
        console.log('orderItems',orderItems)
        const orderItemsResponse = await api.post(`/order_item`, orderItems);

        if (!orderItemsResponse.data) {
          // Se falhar, deletar pedido
          await api.delete(`/user/delete`, { data: { id: orderData.id } });
          throw new Error("Erro ao inserir itens do pedido");
        }

          toast.success("Pedido realizado com sucesso!");
          router.push(`/clients/${idClient}`)
          localStorage.setItem('customerInfo', JSON.stringify(address)); // Salva o endereço para a próxima visita
          localStorage.removeItem('product');
          setCar([]);
          setCount({});
    
        } catch (error) {
          console.error('Erro ao finalizar o pedido:', error);
          toast.error("Ocorreu um erro ao finalizar seu pedido. Tente novamente.");
        } finally {
          setLoading(false);
        }
      }


      const totalItem = car.reduce((acc, item) => {
                          const quantity = count[item.id] || 0;
                            return acc + (item.price * quantity);
     }, 0)
     function handleActive(){
      setActive(!active)
     }
                                      
                                      

    return(
        <div className="bg-amber-50 h-screen">
            <header className="h-[150px] relative flex items-center bg-[url('/LanchesFundo.jpg')] bg-cover bg-no-repeat bg-center justify-center border-b">
                {store.image_url && store.image_url !== '' && (
                    <div className="flex flex-col absolute  top-[115px]  z-100">
                    <img 
                      src={store?.image_url}
                      alt="logo" 
                      className="h-20 w-20 rounded-full"/> 
                </div>
                )}
                  
           </header>
           <div>
            <Link  href={`/clients/${idClient}`}>
                <p className="flex p-3 items-center">
                  <ArrowLeft size={30} color="#00ff"/>
                   Voltar
                </p>
            </Link>
                
           </div>
           
         
            <div  className={`fixed top-3 right-10 transform transition-all duration-500 ease-in-out
              ${active ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'}
            `}>
                 <FormClient onSubmitAddress={handresAdress} handleActive={handleActive} initialData={address} />
            </div>
                       
          <div className="flex items-center justify-center flex-col w-full gap-3 mt-3 pt-6">
            {car.length > 0 ? (
                <div className="w-full items-center justify-center flex flex-col">
                  <h1 className="text-2xl mt-10 font-bold text-center p-3">Carrinho</h1>
                    {/* Container apenas para os produtos */}
                    <div className="flex  flex-wrap gap-3">
                        {car.map((item) => (
                            <div className="flex p-3" key={item.id}>
                                <img src={item.image_url} className="h-[200px] w-[200px] object-cover rounded-md" alt={item.name} />
                                <div>
                                     <p className="font-semibold">{item.name}</p>
                                     <p>{formatReal(item.price * (count[item.id] || 0))}</p>

                                     <div className="flex gap-2 items-center justify-center mt-2">
                                        <button 
                                        onClick={() =>handleSub(item)}
                                        className="text-2xl font-bold text-red-500 text-center">-</button>
                                        <p className="font-medium">{count[item.id] || 0}</p>
                                        <button
                                        onClick={() =>handleAdd(item)} 
                                        className="text-2xl font-bold text-green-500">+</button>
                                     </div>
                                     {/* <h2>{formatReal(total[item.id])}</h2>*/}
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Seção de Checkout e Total, agora separada */}
                    <div className="flex flex-col items-center justify-center mt-8 w-full p-3 border-t-2 border-gray-200">
                        {address ? (
                            <div className="text-center">
                               <button onClick={handleActive} className="bg-orange-500 p-2 rounded-xl text-white font-bold">
                                    Alterar endereço
                                    </button>
                                   
                                <h3 className="font-bold text-lg">Entregar para: {address.name}</h3>
                                <p className="text-gray-600">{address.rua}, {address.numero} - {address.bairro}, {address.cidade}</p>
                                <p className="text-gray-600">Telefone: {address.phone}</p>
                               <p>{address.complemento}</p>
                                <div className="flex items-center gap-3 justify-center mt-4 max-sm:flex-col max-sm:items-center">

                                    <select
                                        className="text-black border h-11 px-2 mb-3 rounded-lg border-black"
                                            id="payments"
                                            name="payments"
                                            onChange={(e) => setPayments(e.target.value)}
                                            value={payments}
                                            >
                                            <option value="">Tipo de Pagamento</option>
                                            <option value="Dinheiro">Dinheiro</option>
                                            <option value="Cartao">Cartao</option>
                                            <option value="Pix">Pix</option>
                                          </select>
                                 
                                      {payments === 'Dinheiro' &&(
                                           <input 
                                          className="text-black border h-11 px-2 mb-3 rounded-lg border-black"
                                          value={trocoPara}
                                          onChange={(e) => setTrocoPara(e.target.value)}
                                          onBlur={(e) => {
                                            const valorEmCentavos = parseRealToCents(e.target.value);
                                            const valorFormatado = formatReal(valorEmCentavos);
                                            setTrocoPara(valorFormatado);
                                          }}
                                          placeholder="Troco para..."
                                          type="text" />
                                      )
                                        }
                                     
                                
                                   
                                    <button onClick={handleFinalizar} className="bg-green-500 p-2 rounded-xl text-white font-bold">
                                    Finalizar Pedido
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="flex items-center gap-3 justify-center max-sm:flex-col max-sm:items-center">
                                <button onClick={handleActive} className="bg-blue-500 p-2 rounded-xl text-white font-bold">
                                   Adicionar endereço
                                   </button>
                                <button disabled className="mt-4 text-2xl bg-green-500 p-2 rounded-xl text-white font-bold opacity-50 cursor-not-allowed">
                                Finalizar Pedido
                                </button>
                            </div>
                        )}
                        <div className="mt-4 text-xl font-bold text-blue-600 text-center">
                          <h2>
                            Total: {formatReal(totalItem)}
                            </h2>  
                        </div>
                    </div>
                </div>
            ):(
                <div className="flex  flex-col i h-screen w-full">
                    <h2 className="text-2xl font-bold text-center p-3">Carrinho Vazio...</h2>
                </div>
            )}
          </div>
        </div>
    )
}