"use client"
import api from "@/app/util/api";
import { toast } from "react-toastify";

interface DeleteProps{
    id: string;
    onClose: () => void; // Apenas a função de fechar
}

export function Delete({id, onClose}: DeleteProps){
 async function handleDelete() {

    try {
      // Alterado para a rota de exclusão de PEDIDO
      await api.delete(`/order_item`,{
        data: {
          id,
        },
      });
      // Feedback bem óbvio para sabermos que o 'try' funcionou
      alert('SUCESSO! O pedido foi excluído no backend. A página vai recarregar.');
      window.location.reload(); // Recarrega a página para vermos o resultado
    } catch (error: any) {
      console.error('Erro ao excluir pedido:', error);
      const errorMessage = error.response?.data?.error || "Erro desconhecido ao excluir.";
      // Feedback bem óbvio para sabermos que deu erro
      alert(`ERRO: ${errorMessage}\n\nVerifique o console (F12) e a aba 'Rede' para mais detalhes.`);
    }
}

    return(
        <div className="flex absolute top-0 left-0 w-full h-full flex-col bg-gray-700/85 items-center justify-center gap-4 p-4">
            <h1 className="text-white text-2xl font-bold">
                Voce quer mesmo excluir?
            </h1>
            <div className="flex gap-4">
                <button 
                onClick={handleDelete}
                className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg shadow">Sim</button>
                <button
                onClick={onClose}
                className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg shadow">Não</button>
            </div>
            
        </div>
    )
}