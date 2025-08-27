"use client"
//import { supabase } from "@/app/lib/supabase"
import { useState, useEffect } from "react"
import { useContext } from "react"
import { Context } from "@/app/Context"


// Adicione 'public_id' e 'restaurant_id' à sua interface de Produto
interface Product {
  id: string;
  name: string;
  description: string;
  price: number | string;
  image_url: string;
  public_id: string;
  restaurant_id: string;
}
import { formatReal, parseRealToCents } from "@/app/components/money"
import api from "@/app/util/api"
import { toast } from "react-toastify"


export default function EditProduct(){
    const {user, lanchoneteProfile} = useContext(Context)
    const [products, setProducts] = useState<Product[]>([])
    const [loadingProductId, setLoadingProductId] = useState<string | null>(null);
    const [filesToUpload, setFilesToUpload] = useState<{ [productId: string]: File }>({});
    const [previews, setPreviews] = useState<{ [productId: string]: string }>({});

    // URL base para carregar as imagens do seu backend
    const filesBaseUrl = "http://localhost:3333/files";

     useEffect(() => {
      async function fetchProducts() {
        try {
          const response = await fetch('/api/product');
           const res =  await response.json()
           const formattedProducts = res.map((p: Product) => ({
           ...p,
            price: Number(p.price) || 0
         }));

           setProducts(formattedProducts)
        
        } catch (error) {
          console.error("Erro ao buscar produtos:", error);
        }
    
    }

    fetchProducts()
  }, [user?.id])

 const handleChange = (index: number, field: keyof Product, value:  string | number) => {
    const updatedProducts = [...products]
    updatedProducts[index] = { ...updatedProducts[index], [field]: value }
    setProducts(updatedProducts)
  }

  async function handleEditProduct(index: number) {
    const productToUpdate = products[index];
    setLoadingProductId(productToUpdate.id);

    // Garante que temos o ID do restaurante para enviar ao backend
    if (!lanchoneteProfile?.id) {
      toast.error("ID do restaurante não encontrado. Faça login novamente.");
      setLoadingProductId(null);
      return;
    }

    try {
      const formData = new FormData();

      // Garante que o preço seja sempre um número (centavos) antes de enviar.
      const priceFloat = typeof productToUpdate.price === 'number'
        ? productToUpdate.price
        : parseFloat(String(productToUpdate.price).replace(/[^\d,]/g, '').replace(',', '.'));
      // Adiciona todos os campos do produto ao FormData
      formData.append('product_id', productToUpdate.id);
      formData.append('name', productToUpdate.name);
      formData.append('description', productToUpdate.description);
      formData.append('price', String(priceFloat));
      formData.append('restaurant_id', lanchoneteProfile.id.toString()); // <-- Envia o ID do restaurante
      // Apenas anexa o old_public_id se ele realmente existir, para evitar enviar "undefined"
      if (productToUpdate.public_id) {
        formData.append('old_public_id', productToUpdate.public_id);
      }

      // Adiciona o arquivo de imagem, SOMENTE se um novo foi selecionado
      const newImageFile = filesToUpload[productToUpdate.id];
      if (newImageFile) {
        formData.append('file', newImageFile);
      }

       const res = await fetch('/api/product', {
        method: 'PUT',
        body: formData,
      })
      if (res.ok){
           toast.success(`Produto "${productToUpdate.name}" atualizado com sucesso!`);
      }else{
        // Lê a mensagem de erro específica da API e a exibe.
        const errorData = await res.json();
        toast.error(errorData.message || `Falha ao atualizar o produto "${productToUpdate.name}".`);
      }
     
      // Opcional: recarregar os produtos para ver a imagem atualizada
      // fetchProducts(); 
    } catch (error) {
      console.error("Erro ao atualizar produto:", error);
      toast.error("Falha ao atualizar o produto. Tente novamente.");
    } finally {
      setLoadingProductId(null);
    }
  }
    
    return(
        <div
        className="p-6 flex flex-col"
        >
            <h1 className="text-2xl font-bold  p-3">Editar Produtos</h1>
            <div>
                {products && (
                    <div className="flex flex-wrap gap-3">
                        {products.map((product, index)=>(
                            <div 
                            key={product.id}
                            className="flex gap-4 mt-2 p-3 max-sm:flex-col">
                                <div className="h-[250px] w-[250px]">
                                    <img
                                    className="h-[200px] w-[200px] object-cover rounded-md"
                                    src={previews[product.id] || product.image_url}  alt={product.name} />
                                   

                                    <input 
                                    className="p-2 border mt-3 w-[200px]"
                                    type="file"
                                    accept="image/*"
                                     onChange={(e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                          setFilesToUpload(prev => ({ ...prev, [product.id]: file }));
                                          setPreviews(prev => ({ ...prev, [product.id]: URL.createObjectURL(file) }));
                                        }
                                      }}
                                />
                                </div>
                                <div>
                                    
                               <input 
                               className="w-full p-2 border rounded-lg mb-3"
                               type="text" 
                               value={product.name}
                               onChange={(e) => handleChange(index, 'name', e.target.value)}

                               />
                               <input type="text" 
                               className="w-full p-2 border mt-3" 
                               value={product.description}
                               onChange={(e) => handleChange(index, 'description', e.target.value)}
                               />
                               <input 
                               type="text" 
                               className="w-full p-2 border mt-3" 
                               value={typeof product.price === 'number' ? formatReal(product.price) : product.price}

                                onBlur={(e) => {
                                    const cents = parseRealToCents(e.target.value); // ← Converte "R$ 25,00" para 2500
                                    handleChange(index, 'price', cents);
                                }}
                                onChange={(e) => handleChange(index, 'price', e.target.value)}
                               
                               />

                               <button 
                               onClick={() => handleEditProduct(index)}
                               className="h-11 w-full p-2 bg-green-500 mt-3 rounded-lg text-white">
                                 {loadingProductId === product.id ? 'Carregando...' : 'Editar'}
                               </button>
                               
                                </div>
                               
                             
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}