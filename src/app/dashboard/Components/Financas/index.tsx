"use client";

import { useContext, useMemo, useState } from "react";

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  type ChartOptions,
} from "chart.js";

import { Bar } from "react-chartjs-2";

import {
  CalendarDays,
  ChartColumnIncreasing,
  ChevronRight,
  CircleDollarSign,
  ClipboardList,
  Package,
  Search,
  ShoppingBag,
  TrendingUp,
  Users,
  Wallet,
} from "lucide-react";

import { Context } from "@/app/Context";
import { VendasProps } from "@/app/models/interface";

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
);

interface VendasGraffic {
  month: string;
  total_sales: string;
}

interface Vendas {
  TotalSales: string;
  totalOrders: string;
  pendingOrder: string;
  allClient: string;
  allProduct: string;
}

interface Props {
  data: Vendas;
  data2: VendasGraffic[];
  data3: VendasProps[];
}

// Formatação em reais.
// O valor recebido já representa reais, não centavos.
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

// Exemplo: "2026-11" -> "Novembro de 2026"
function formatMonth(month: string): string {
  const match = /^(\d{4})-(\d{2})$/.exec(month);

  if (!match) return month;

  const year = Number(match[1]);
  const monthNumber = Number(match[2]);

  if (monthNumber < 1 || monthNumber > 12) {
    return month;
  }

  const date = new Date(year, monthNumber - 1, 1);

  const formatted = new Intl.DateTimeFormat("pt-BR", {
    month: "long",
    year: "numeric",
  }).format(date);

  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

function parseSales(value: string | number): number {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function FinancasDahboard({ data, data2, data3 }: Props) {
  const { handleModalVisible, handleSales } = useContext(Context);

  const [search, setSearch] = useState("");

  // Organiza as vendas por mês
  const monthlySales = useMemo(() => {
    return [...data2]
      .map((item) => ({
        month: item.month,
        total: parseSales(item.total_sales),
      }))
      .sort((a, b) => a.month.localeCompare(b.month));
  }, [data2]);

  // Soma do faturamento dos meses recebidos
  const totalRevenue = useMemo(() => {
    return monthlySales.reduce((sum, item) => sum + item.total, 0);
  }, [monthlySales]);

  const totalOrders = Number(data.totalOrders) || 0;
  const totalClients = Number(data.allClient) || 0;
  const totalProducts = Number(data.allProduct) || 0;

  // Ticket médio calculado sobre o período recebido
  const averageTicket = totalOrders > 0 ? totalRevenue / totalOrders : 0;

  // Filtra meses pela pesquisa
  const filteredMonths = monthlySales.filter((item) => {
    const monthName = formatMonth(item.month).toLowerCase();
    const term = search.toLowerCase().trim();

    return monthName.includes(term) || item.month.includes(term);
  });

  // Dados do gráfico
  const chartData = {
    labels: monthlySales.map((item) => formatMonth(item.month)),
    datasets: [
      {
        label: "Faturamento",
        data: monthlySales.map((item) => item.total),
        backgroundColor: "rgba(249, 115, 22, 0.85)",
        hoverBackgroundColor: "rgba(234, 88, 12, 1)",
        borderColor: "#ea580c",
        borderWidth: 0,
        borderRadius: 8,
        borderSkipped: false as const,
        maxBarThickness: 58,
      },
    ],
  };

  const chartOptions: ChartOptions<"bar"> = {
    responsive: true,
    maintainAspectRatio: false,

    interaction: {
      intersect: false,
      mode: "index",
    },

    plugins: {
      legend: {
        display: false,
      },

      title: {
        display: false,
      },

      tooltip: {
        backgroundColor: "#0f172a",
        padding: 12,
        cornerRadius: 10,
        displayColors: false,

        callbacks: {
          label: (context) => {
            return formatCurrency(context.parsed.y ?? 0);
          },
        },
      },
    },

    scales: {
      x: {
        grid: {
          display: false,
        },

        border: {
          display: false,
        },

        ticks: {
          color: "#64748b",
          maxRotation: 45,
          minRotation: 0,
        },
      },

      y: {
        beginAtZero: true,

        border: {
          display: false,
          dash: [4, 4],
        },

        grid: {
          color: "#e2e8f0",
        },

        ticks: {
          color: "#64748b",

          callback: (value) => {
            return formatCurrency(Number(value));
          },
        },
      },
    },
  };

  // Abre modal com as vendas do mês selecionado
  function handleModal(month: string) {
    const salesForMonth = data3.filter((sale) => {
      const date = new Date(sale.created_at);

      if (Number.isNaN(date.getTime())) {
        return false;
      }

      const mesAno = `${date.getFullYear()}-${String(
        date.getMonth() + 1,
      ).padStart(2, "0")}`;

      return mesAno === month;
    });

    handleSales(salesForMonth);
    handleModalVisible();
  }

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 sm:px-6 lg:px-10">
      <div className="mx-auto max-w-7xl">
        {/* CABEÇALHO */}
        <header className="mb-8">
          <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-500">
            <ChartColumnIncreasing size={17} />
            <span>Painel administrativo</span>
          </div>

          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
                Minhas finanças
              </h1>

              <p className="mt-2 text-sm text-slate-500">
                Acompanhe as vendas e o desempenho da sua lanchonete.
              </p>
            </div>

            <div className="flex items-center gap-2 self-start rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <CalendarDays size={18} className="text-orange-500" />

              <span className="text-sm font-semibold text-slate-700">
                Relatório financeiro
              </span>
            </div>
          </div>
        </header>

        {/* INDICADORES */}
        <section className="mb-7 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {/* FATURAMENTO */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <Wallet size={23} />
              </div>

              <TrendingUp size={19} className="text-orange-500" />
            </div>

            <p className="mt-5 text-sm font-medium text-slate-500">
              Faturamento total
            </p>

            <h2 className="mt-2 break-words text-2xl font-bold tracking-tight text-slate-900">
              {formatCurrency(totalRevenue)}
            </h2>

            <p className="mt-2 text-xs text-slate-400">
              Soma dos meses apresentados
            </p>
          </div>

          {/* VENDAS */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <ShoppingBag size={23} />
            </div>

            <p className="mt-5 text-sm font-medium text-slate-500">
              Total de vendas
            </p>

            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              {totalOrders.toLocaleString("pt-BR")}
            </h2>

            <p className="mt-2 text-xs text-slate-400">Pedidos registrados</p>
          </div>

          {/* CLIENTES */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
              <Users size={23} />
            </div>

            <p className="mt-5 text-sm font-medium text-slate-500">
              Clientes cadastrados
            </p>

            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              {totalClients.toLocaleString("pt-BR")}
            </h2>

            <p className="mt-2 text-xs text-slate-400">Total de clientes</p>
          </div>

          {/* PRODUTOS */}
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-green-50 text-green-600">
              <Package size={23} />
            </div>

            <p className="mt-5 text-sm font-medium text-slate-500">
              Produtos cadastrados
            </p>

            <h2 className="mt-2 text-2xl font-bold text-slate-900">
              {totalProducts.toLocaleString("pt-BR")}
            </h2>

            <p className="mt-2 text-xs text-slate-400">Itens do cardápio</p>
          </div>
        </section>

        {/* GRÁFICO */}
        <section className="mb-7 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <div className="mb-7 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <div className="flex items-center gap-2">
                <ChartColumnIncreasing size={20} className="text-orange-500" />

                <h2 className="text-lg font-semibold text-slate-900">
                  Evolução das vendas
                </h2>
              </div>

              <p className="mt-2 text-sm text-slate-500">
                Faturamento mensal da lanchonete.
              </p>
            </div>

            <div className="self-start rounded-xl bg-orange-50 px-4 py-2">
              <span className="text-xs font-semibold text-orange-700">
                {monthlySales.length} meses
              </span>
            </div>
          </div>

          {monthlySales.length > 0 ? (
            <div className="relative h-[320px] w-full sm:h-[390px]">
              <Bar options={chartOptions} data={chartData} />
            </div>
          ) : (
            <div className="flex h-[280px] flex-col items-center justify-center rounded-xl bg-slate-50 text-center">
              <ChartColumnIncreasing size={43} className="text-slate-300" />

              <p className="mt-4 text-sm font-semibold text-slate-700">
                Nenhuma venda encontrada
              </p>

              <p className="mt-2 text-xs text-slate-400">
                O gráfico será exibido quando houver vendas.
              </p>
            </div>
          )}
        </section>

        {/* RESUMO E MESES */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* LISTA DE MESES */}
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7 lg:col-span-2">
            <div className="mb-6">
              <h2 className="text-lg font-semibold text-slate-900">
                Histórico mensal
              </h2>

              <p className="mt-2 text-sm text-slate-500">
                Selecione um mês para visualizar os pedidos.
              </p>
            </div>

            <div className="relative mb-5">
              <Search
                size={18}
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar mês ou ano..."
                className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-4 text-sm text-slate-800 outline-none transition-all placeholder:text-slate-400 focus:border-orange-400 focus:ring-4 focus:ring-orange-100"
              />
            </div>

            {filteredMonths.length > 0 ? (
              <div className="space-y-3">
                {[...filteredMonths].reverse().map((item) => (
                  <button
                    key={item.month}
                    type="button"
                    onClick={() => handleModal(item.month)}
                    className="group flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-orange-300 hover:bg-orange-50/40"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                        <CalendarDays size={21} />
                      </div>

                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {formatMonth(item.month)}
                        </p>

                        <p className="mt-1 text-xs text-slate-400">
                          Ver pedidos do mês
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <p className="text-sm font-bold text-green-600 sm:text-base">
                        {formatCurrency(item.total)}
                      </p>

                      <ChevronRight
                        size={19}
                        className="text-slate-400 transition-transform group-hover:translate-x-1 group-hover:text-orange-500"
                      />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="rounded-xl bg-slate-50 px-5 py-10 text-center">
                <CalendarDays size={35} className="mx-auto text-slate-300" />

                <p className="mt-3 text-sm text-slate-500">
                  Nenhum mês encontrado.
                </p>
              </div>
            )}
          </section>

          {/* RESUMO FINANCEIRO */}
          <aside className="space-y-5">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-orange-50 text-orange-600">
                <CircleDollarSign size={24} />
              </div>

              <h3 className="text-lg font-semibold text-slate-900">
                Resumo financeiro
              </h3>

              <p className="mt-2 text-sm text-slate-500">
                Indicadores gerais do período.
              </p>

              <div className="mt-6 space-y-5 border-t border-slate-100 pt-5">
                <div>
                  <p className="text-xs text-slate-500">
                    Faturamento dos meses exibidos
                  </p>

                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {formatCurrency(totalRevenue)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">
                    Ticket médio estimado
                  </p>

                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {formatCurrency(averageTicket)}
                  </p>
                </div>

                <div>
                  <p className="text-xs text-slate-500">Pedidos pendentes</p>

                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {Number(data.pendingOrder) || 0}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-orange-100 bg-orange-50 p-5">
              <div className="flex items-center gap-2 text-sm font-semibold text-orange-700">
                <ClipboardList size={19} />
                Detalhes das vendas
              </div>

              <p className="mt-2 text-xs leading-6 text-orange-700">
                Clique em qualquer mês do histórico para consultar os pedidos
                registrados naquele período.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
