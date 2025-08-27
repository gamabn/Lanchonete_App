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
import { format } from 'path';

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

export function FinancasDahboard({data, data2}: {data: Vendas , data2: VendasGraffic[]}){

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
          // A função formatReal provavelmente espera o valor em centavos.
          // Como 'value' já está em Reais, multiplicamos por 100.
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
  console.log('totalSales',totalSales)

  const chartData = {
    labels,
    datasets: [
      {
        label: `Total de vendas: ${totalVendas}`,
        data: sales, // Convertendo centavos para Reais
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgb(54, 162, 235)',
        borderWidth: 1,
      },
    ],
  };

    return(
        <div className="p-6">
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
             
             <div className="w-full h-[400px] relative">
                <Bar options={options} data={chartData} />
             </div>
        </div>
    )
}