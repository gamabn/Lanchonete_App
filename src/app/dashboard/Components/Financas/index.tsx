"use client"

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
//import ChartDataLabels from 'chartjs-plugin-datalabels';
import { Bar } from 'react-chartjs-2';
import { formatReal } from '@/app/components/money'; // Verifique se este caminho está correto
import { VendasProps } from '@/app/models/interface';
import { CalendarDays } from 'lucide-react';
import { useContext } from 'react';
import { Context } from '@/app/Context';


ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
 // ChartDataLabels
);
interface VendasGraffic {  
  month: string,
 total_sales: string  
}

interface Vendas {
        TotalSales: string,
        totalOrders: string,
        pendingOrder: string,
        allClient: string,
        allProduct: string   
}

export function FinancasDahboard({data, data2, data3}: {data: Vendas , data2: VendasGraffic[], data3: VendasProps[]}){
   const { handleModalVisible, handleSales } = useContext(Context)

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: 'Vendas Mensais',
      },
      datalabels: {
        anchor: 'end',
        align: 'top',
        formatter: (value: number) => {
         
          return formatReal(value * 100);
        },
        color: '#4A5568', // Cor do texto (cinza escuro)
        font: {
          weight: 'bold' as const,
        },
      },
    },
  };

  const labels = data2.map(item => item.month);
  const totalSales = data2.map(item => (parseFloat(item.total_sales)));
  const totalVendas = totalSales.map(item => formatReal(item))
  const sales = totalSales.map(item => item.toFixed(2))
 

  const chartData = {
    labels,
    datasets: [
      {
        label: `Total de vendas: ${totalVendas}`,
        data: sales, 
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgb(54, 162, 235)',
        borderWidth: 1,
      },
    ],
  };

  function handleModal(dados: VendasProps[]){
     console.log('dados',dados)
     handleModalVisible()
     handleSales(dados)
  }

  const dados = data3.filter((item) => {
  const date = new Date(item.created_at);
  const mesAno = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
  return labels.includes(mesAno);
});

    return(
        <div className="p-6 bg-white text-black">
             <h1 className="text-2xl flex gap-2 items-center justify-center font-bold p-3 text-center">Minhas finanças</h1>

             <div className="flex flex-wrap items-center justify-center gap-5 mb-8">


                <div className="bg-red-500 flex flex-col p-3 rounded-sm h-[150px] w-[150px]">
                 <h2>Clientes</h2> 
                  <p>{data.allClient}</p>
                </div>

                <div className="bg-blue-500 flex flex-col p-3 rounded-sm h-[150px] w-[150px]">
                 <h2>Produtos</h2> 
                  <p>{data.allProduct}</p>
                </div>

                 <div className="bg-green-500 flex flex-col p-3 rounded-sm h-[150px] w-[150px]">
                 <h2>Vendas</h2> 
                  <p>{data.totalOrders}</p>
                </div>
             </div>

             <div>
              {data2.length > 0 ? (
             
                  <div className='flex flex-col items-center justify-center gap-3'>
                  
                      <button 
                      onClick={() => handleModal(dados)}
                      className='flex w-full p-2 items-center justify-between gap-2 bg-[#000]  shadow-xl rounded-lg'>
                        <div className='flex gap-2 items-center justify-center'>
                              <CalendarDays  size={25} color='#00ff' />
                           <h2 className='text-white'>{labels}</h2>
                        </div>
                         
                           <h2
                           className='text-green-500'
                           >{totalVendas}</h2>
                         
                      </button>
                   </div>
                 
                                
            
              )
              :(
                <div>
                <h2>Não existe vendas</h2>
                </div>
              )}

              
             </div>
             
             <div className="w-full h-[400px] relative">
                <Bar options={options} data={chartData} />
             </div>
        </div>
    )
}