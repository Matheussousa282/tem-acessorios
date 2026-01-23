
import React, { useMemo, useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { UserRole, Transaction } from '../types';

const Dashboard: React.FC = () => {
  const { transactions, products, currentUser, establishments, users, refreshData } = useApp();
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'yesterday' | 'beforeYesterday'>('today');

  // Auto-refresh a cada 10 segundos chamando a API real
  useEffect(() => {
    const timer = setInterval(() => {
      refreshData().then(() => setLastUpdate(new Date()));
    }, 10000);
    return () => clearInterval(timer);
  }, [refreshData]);

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const currentStore = establishments.find(e => e.id === currentUser?.storeId);
  const currentStoreName = currentStore?.name || '';
  
  // Datas formatadas (YYYY-MM-DD)
  const dates = useMemo(() => {
    const now = new Date();
    
    const d0 = new Date(now);
    const d1 = new Date(now);
    d1.setDate(d1.getDate() - 1);
    const d2 = new Date(now);
    d2.setDate(d2.getDate() - 2);

    return {
      today: d0.toLocaleDateString('en-CA'),
      yesterday: d1.toLocaleDateString('en-CA'),
      beforeYesterday: d2.toLocaleDateString('en-CA')
    };
  }, []);

  const activeDate = dates[selectedPeriod];

  // FILTRO ESTRITAMENTE POR UNIDADE E DATA SELECIONADA
  const dailyTransactions = useMemo(() => {
    return (transactions || []).filter(t => 
      t.date === activeDate && 
      t.type === 'INCOME' && 
      (t.category === 'Venda' || t.category === 'Serviço') &&
      (isAdmin || t.store === currentStoreName)
    );
  }, [transactions, isAdmin, currentStoreName, activeDate]);

  // Lógica de Reação/Emoji (Ticket Médio)
  const getReaction = (val: number) => {
    if (val === 0) return { emoji: '⚪', label: 'Sem Vendas' };
    if (val < 50) return { emoji: '😡', label: 'Crítico' };
    if (val < 100) return { emoji: '😟', label: 'Baixo' };
    if (val < 200) return { emoji: '🙂', label: 'Bom' };
    return { emoji: '🤩', label: 'Excelente' };
  };

  // Cálculos do Resumo Diário
  const dailyMetrics = useMemo(() => {
    const totalSales = dailyTransactions.reduce((acc, t) => acc + t.value, 0);
    const qtySales = dailyTransactions.length;
    let qtyProducts = 0;
    
    dailyTransactions.forEach(t => {
      t.items?.forEach(item => qtyProducts += item.quantity);
    });

    const avgTicket = qtySales > 0 ? totalSales / qtySales : 0;
    const prodsPerSale = qtySales > 0 ? qtyProducts / qtySales : 0;

    return { totalSales, qtySales, qtyProducts, avgTicket, prodsPerSale };
  }, [dailyTransactions]);

  // Vendas por Hora
  const hourlyData = useMemo(() => {
    const hoursMap: Record<string, number> = {};
    for (let i = 7; i <= 22; i++) {
      hoursMap[`${i.toString().padStart(2, '0')}:00`] = 0;
    }

    dailyTransactions.forEach(t => {
      const parts = t.id.split('-');
      if (parts.length > 1) {
        const timestamp = parseInt(parts[1]);
        if (!isNaN(timestamp)) {
          const dateObj = new Date(timestamp);
          const hour = dateObj.getHours();
          const hourKey = `${hour.toString().padStart(2, '0')}:00`;
          if (hoursMap[hourKey] !== undefined) {
            hoursMap[hourKey] += t.value;
          }
        }
      }
    });

    return Object.entries(hoursMap).map(([hour, value]) => ({ hour, value }));
  }, [dailyTransactions]);

  // Lista de Produtos Vendidos (Ranking)
  const soldProductsList = useMemo(() => {
    const map: Record<string, any> = {};
    
    dailyTransactions.forEach(t => {
      t.items?.forEach(item => {
        if (!map[item.id]) {
          const original = products.find(p => p.id === item.id);
          map[item.id] = { 
            id: item.id, 
            code: item.sku, 
            name: item.name, 
            qty: 0, 
            total: 0, 
            group: item.category, 
            subgroup: item.brand || 'GERAL',
            stock: original?.stock || 0
          };
        }
        map[item.id].qty += item.quantity;
        map[item.id].total += (item.quantity * (item.salePrice || 0));
      });
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [dailyTransactions, products]);

  // Desempenho de Vendedores
  const vendorPerformance = useMemo(() => {
    const perf: Record<string, any> = {};
    const relevantUsers = users.filter(u => isAdmin || u.storeId === currentUser?.storeId);

    dailyTransactions.forEach(t => {
      const vendor = relevantUsers.find(u => u.id === t.vendorId);
      if (!vendor && !isAdmin) return;

      const vName = vendor?.name || 'Balcão/Geral';
      const vKey = t.vendorId || 'none';

      if (!perf[vKey]) {
        perf[vKey] = { name: vName, qtySales: 0, qtyProds: 0, total: 0 };
      }
      
      perf[vKey].qtySales += 1;
      perf[vKey].total += t.value;
      t.items?.forEach(item => perf[vKey].qtyProds += item.quantity);
    });

    return Object.values(perf).map(v => {
      const ticket = v.qtySales > 0 ? v.total / v.qtySales : 0;
      return {
        ...v,
        ticket,
        prodAvg: v.qtySales > 0 ? v.qtyProds / v.qtySales : 0,
        reaction: getReaction(ticket)
      };
    }).sort((a, b) => b.total - a.total);
  }, [dailyTransactions, users, isAdmin, currentUser]);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700 bg-[#f4f7f9] dark:bg-background-dark min-h-screen">
      
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* RESUMO DIÁRIO - DESTAQUE AMPLIADO */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-xl flex flex-col">
           <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex flex-col gap-4 bg-slate-50/50 dark:bg-slate-800/50">
              <h4 className="text-xs font-black uppercase text-slate-500 tracking-[0.2em]">
                {isAdmin ? 'Resumo Global de Vendas' : `Unidade: ${currentStoreName}`}
              </h4>
              <div className="flex gap-2 bg-slate-200/50 dark:bg-slate-700/50 p-1.5 rounded-2xl">
                 <button 
                  onClick={() => setSelectedPeriod('today')}
                  className={`flex-1 px-4 py-2 text-[10px] font-black rounded-xl uppercase transition-all ${selectedPeriod === 'today' ? 'bg-primary text-white shadow-lg' : 'text-slate-500'}`}
                 >
                   Hoje
                 </button>
                 <button 
                  onClick={() => setSelectedPeriod('yesterday')}
                  className={`flex-1 px-4 py-2 text-[10px] font-black rounded-xl uppercase transition-all ${selectedPeriod === 'yesterday' ? 'bg-primary text-white shadow-lg' : 'text-slate-500'}`}
                 >
                   Ontem
                 </button>
                 <button 
                  onClick={() => setSelectedPeriod('beforeYesterday')}
                  className={`flex-1 px-4 py-2 text-[10px] font-black rounded-xl uppercase transition-all ${selectedPeriod === 'beforeYesterday' ? 'bg-primary text-white shadow-lg' : 'text-slate-500'}`}
                 >
                   Anteontem
                 </button>
              </div>
           </div>
           
           <div className="p-8 space-y-10 flex-1">
              <div className="flex justify-between items-start">
                 <div>
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Faturamento {selectedPeriod !== 'today' ? 'no dia' : 'hoje'}</p>
                    <h2 className="text-5xl font-black text-primary tabular-nums tracking-tighter">R$ {dailyMetrics.totalSales.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
                 </div>
                 <div className="text-center bg-slate-50 dark:bg-slate-800 p-4 rounded-[2rem] shadow-inner">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Clima</p>
                    <div className="text-4xl">{getReaction(dailyMetrics.avgTicket).emoji}</div>
                 </div>
              </div>
              
              <div className="grid grid-cols-2 gap-y-10 gap-x-6">
                 <div className="space-y-1">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Qtd. vendas</p>
                    <p className="text-3xl font-black text-slate-800 dark:text-white tabular-nums">{dailyMetrics.qtySales}</p>
                 </div>
                 <div className="text-right space-y-1">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Qtd. produtos</p>
                    <p className="text-3xl font-black text-slate-800 dark:text-white tabular-nums">{dailyMetrics.qtyProducts.toLocaleString('pt-BR')}</p>
                 </div>
                 <div className="space-y-1">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Ticket médio</p>
                    <p className="text-xl font-black text-rose-600 tabular-nums">R$ {dailyMetrics.avgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                 </div>
                 <div className="text-right space-y-1">
                    <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Ipv Médio</p>
                    <p className="text-xl font-black text-slate-800 dark:text-white tabular-nums">{dailyMetrics.prodsPerSale.toFixed(2)}</p>
                 </div>
              </div>

              <div className="pt-8 mt-auto border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                 <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-sm text-slate-300">event_note</span>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ref: {activeDate}</p>
                 </div>
                 <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest animate-pulse flex items-center gap-1.5">
                    <span className="size-1.5 bg-emerald-500 rounded-full"></span> Live Data
                 </span>
              </div>
           </div>
        </div>

        {/* VENDAS POR HORA - GRÁFICO MAIOR */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden">
           <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center">
              <h4 className="text-xs font-black uppercase text-slate-500 tracking-[0.3em]">Fluxo de Movimentação Horária</h4>
              <div className="flex items-center gap-2 text-slate-300">
                 <span className="text-[10px] font-black uppercase tracking-widest">Tempo Real</span>
                 <span className="material-symbols-outlined text-lg">query_stats</span>
              </div>
           </div>
           <div className="p-8 h-[380px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: '800' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8', fontWeight: '800' }} tickFormatter={(val) => `R$ ${val}`} dx={-10} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '24px', border: 'none', boxShadow: '0 25px 50px -12px rgba(0,0,0,0.25)', fontWeight: '900', textTransform: 'uppercase', fontSize: '10px' }} 
                  />
                  <Bar dataKey="value" radius={[8, 8, 0, 0]} fill="#136dec" barSize={35}>
                    {hourlyData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.value > 0 ? '#136dec' : '#f1f5f9'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
           </div>
        </div>
      </div>

      {/* RANKING E EQUIPE - TEXTOS MAIORES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden h-[550px] flex flex-col">
           <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/30">
              <h4 className="text-xs font-black uppercase text-slate-500 tracking-widest">Ranking de Produtos: Top Saídas</h4>
              <span className="material-symbols-outlined text-slate-300">trending_up</span>
           </div>
           <div className="overflow-auto flex-1 custom-scrollbar">
              <table className="w-full text-left">
                 <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 border-b">
                    <tr className="text-[10px] font-black uppercase text-slate-400 tracking-widest">
                       <th className="px-8 py-6 uppercase">Referência</th>
                       <th className="px-8 py-6 uppercase">Descrição do Item</th>
                       <th className="px-8 py-6 text-center uppercase">Qtd.</th>
                       <th className="px-8 py-6 text-right uppercase">Total Bruto</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {soldProductsList.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all">
                         <td className="px-8 py-6 font-mono text-primary font-black text-xs uppercase">{item.code}</td>
                         <td className="px-8 py-6 font-black uppercase text-slate-700 dark:text-slate-200 truncate max-w-[220px] text-xs">{item.name}</td>
                         <td className="px-8 py-6 text-center font-black text-slate-900 dark:text-white tabular-nums text-sm">{item.qty}</td>
                         <td className="px-8 py-6 text-right font-black text-primary dark:text-primary tabular-nums text-sm">R$ {item.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-xl overflow-hidden h-[550px] flex flex-col">
           <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/30">
              <h4 className="text-xs font-black uppercase text-slate-500 tracking-widest">Performance Consultores</h4>
              <span className="material-symbols-outlined text-slate-300">groups</span>
           </div>
           <div className="overflow-auto flex-1 custom-scrollbar">
              <table className="w-full text-left">
                 <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 border-b">
                    <tr className="text-[9px] font-black uppercase text-slate-400 tracking-widest">
                       <th className="px-6 py-6">Vendedor</th>
                       <th className="px-4 py-6 text-center">Humor</th>
                       <th className="px-6 py-6 text-right">Total</th>
                       <th className="px-6 py-6 text-right">Ticket</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                    {vendorPerformance.map((v, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all">
                         <td className="px-6 py-6 font-black uppercase text-slate-800 dark:text-slate-200 truncate max-w-[120px] text-xs">{v.name}</td>
                         <td className="px-4 py-6 text-center text-3xl drop-shadow-sm">{v.reaction.emoji}</td>
                         <td className="px-6 py-6 text-right font-black text-slate-900 dark:text-white tabular-nums text-xs">R$ {v.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                         <td className="px-6 py-6 text-right font-black text-rose-600 tabular-nums text-sm">R$ {v.ticket.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; height: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; }
      `}</style>
    </div>
  );
};

export default Dashboard;
