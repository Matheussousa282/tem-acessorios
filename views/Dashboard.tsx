
import React, { useMemo, useEffect, useState } from 'react';
import { useApp } from '../AppContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { UserRole, Transaction } from '../types';

const Dashboard: React.FC = () => {
  const { transactions, products, currentUser, establishments, users, refreshData } = useApp();
  const [lastUpdate, setLastUpdate] = useState(new Date());
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | 'yesterday' | 'beforeYesterday'>('today');

  // Auto-refresh e Sincronização
  useEffect(() => {
    // Sincroniza dados ao montar o componente para garantir que alterações externas apareçam
    refreshData().then(() => setLastUpdate(new Date()));

    const timer = setInterval(() => {
      refreshData().then(() => setLastUpdate(new Date()));
    }, 15000); // Aumentado para 15s para evitar overload, mas refreshData já é chamado em cada save
    
    return () => clearInterval(timer);
  }, []); // Remove refreshData da dependência para evitar loops, mas o estado transactions já trigger re-render

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const currentStore = establishments.find(e => e.id === currentUser?.storeId);
  const currentStoreName = currentStore?.name || '';
  
  const dates = useMemo(() => {
    const now = new Date();
    const d0 = new Date(now);
    const d1 = new Date(now); d1.setDate(d1.getDate() - 1);
    const d2 = new Date(now); d2.setDate(d2.getDate() - 2);

    return {
      today: d0.toLocaleDateString('en-CA'),
      yesterday: d1.toLocaleDateString('en-CA'),
      beforeYesterday: d2.toLocaleDateString('en-CA')
    };
  }, []);

  const activeDate = dates[selectedPeriod];

  const dailyTransactions = useMemo(() => {
    return (transactions || []).filter(t => 
      t.date === activeDate && 
      t.type === 'INCOME' && 
      (t.category === 'Venda' || t.category === 'Serviço') &&
      (isAdmin || t.store === currentStoreName)
    );
  }, [transactions, isAdmin, currentStoreName, activeDate]);

  const getReaction = (val: number) => {
    if (val === 0) return { emoji: '⚪', label: 'Sem Vendas' };
    if (val < 50) return { emoji: '😡', label: 'Crítico' };
    if (val < 100) return { emoji: '😟', label: 'Baixo' };
    if (val < 200) return { emoji: '🙂', label: 'Bom' };
    return { emoji: '🤩', label: 'Excelente' };
  };

  const dailyMetrics = useMemo(() => {
    const totalSales = dailyTransactions.reduce((acc, t) => acc + t.value, 0);
    const qtySales = dailyTransactions.length;
    let qtyProducts = 0;
    dailyTransactions.forEach(t => t.items?.forEach(item => qtyProducts += item.quantity));
    const avgTicket = qtySales > 0 ? totalSales / qtySales : 0;
    const prodsPerSale = qtySales > 0 ? qtyProducts / qtySales : 0;
    return { totalSales, qtySales, qtyProducts, avgTicket, prodsPerSale };
  }, [dailyTransactions]);

  const hourlyData = useMemo(() => {
    const hoursMap: Record<string, number> = {};
    for (let i = 8; i <= 20; i++) hoursMap[`${i.toString().padStart(2, '0')}:00`] = 0;
    dailyTransactions.forEach(t => {
      const parts = t.id.split('-');
      if (parts.length > 1) {
        const timestamp = parseInt(parts[1]);
        if (!isNaN(timestamp)) {
          const hour = new Date(timestamp).getHours();
          const hourKey = `${hour.toString().padStart(2, '0')}:00`;
          if (hoursMap[hourKey] !== undefined) hoursMap[hourKey] += t.value;
        }
      }
    });
    return Object.entries(hoursMap).map(([hour, value]) => ({ hour, value }));
  }, [dailyTransactions]);

  const soldProductsList = useMemo(() => {
    const map: Record<string, any> = {};
    dailyTransactions.forEach(t => {
      t.items?.forEach(item => {
        if (!map[item.id]) {
          const original = products.find(p => p.id === item.id);
          map[item.id] = { id: item.id, code: item.sku, name: item.name, unit: item.unit || 'UN', group: item.category, subgroup: item.brand || 'GERAL', stock: original?.stock || 0, qtySold: 0, totalValue: 0 };
        }
        map[item.id].qtySold += item.quantity;
        map[item.id].totalValue += (item.quantity * (item.salePrice || 0));
      });
    });
    return Object.values(map).sort((a: any, b: any) => b.totalValue - a.totalValue);
  }, [dailyTransactions, products]);

  const vendorPerformance = useMemo(() => {
    const perf: Record<string, any> = {};
    const relevantUsers = users.filter(u => isAdmin || u.storeId === currentUser?.storeId);

    dailyTransactions.forEach(t => {
      const vendor = relevantUsers.find(u => u.id === t.vendorId);
      const vName = vendor?.name || 'Balcão/Geral';
      const vKey = t.vendorId || 'none';

      if (!perf[vKey]) perf[vKey] = { name: vName, qtySales: 0, qtyProds: 0, total: 0 };
      perf[vKey].qtySales += 1;
      perf[vKey].total += t.value;
      t.items?.forEach(item => perf[vKey].qtyProds += item.quantity);
    });

    return Object.values(perf).map(v => {
      const ticket = v.qtySales > 0 ? v.total / v.qtySales : 0;
      return { ...v, ticket, prodAvg: v.qtySales > 0 ? v.qtyProds / v.qtySales : 0, reaction: getReaction(ticket) };
    }).sort((a, b) => b.total - a.total);
  }, [dailyTransactions, users]); // transactions mudando já faz o dailyTransactions mudar, triggerando o re-calculo

  const formatCurrency = (val: number) => val.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  return (
    <div className="p-4 space-y-4 animate-in fade-in duration-700 bg-[#f4f7f9] dark:bg-background-dark min-h-screen font-sans">
      <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-4">
           <button onClick={() => setSelectedPeriod('today')} className={`px-4 py-1.5 text-[11px] font-bold rounded-lg border transition-all ${selectedPeriod === 'today' ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-white text-slate-500 border-slate-200'}`}>Hoje</button>
           <button onClick={() => setSelectedPeriod('yesterday')} className={`px-4 py-1.5 text-[11px] font-bold rounded-lg border transition-all ${selectedPeriod === 'yesterday' ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-white text-slate-500 border-slate-200'}`}>Ontem</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-4 space-y-6">
            <div className="space-y-4">
              <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase">Resumo de vendas diário</h2>
              <div className="space-y-6 px-2">
                <div><p className="text-xs font-bold text-slate-600 dark:text-slate-400">Total de vendas</p><p className="text-3xl font-black text-rose-800 tabular-nums">{formatCurrency(dailyMetrics.totalSales)}</p></div>
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Qtd. vendas</p><p className="text-xl font-black text-rose-700/70 tabular-nums">{dailyMetrics.qtySales}</p></div>
                  <div><p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 text-right">Qtd. produtos</p><p className="text-xl font-black text-rose-700/70 tabular-nums text-right">{dailyMetrics.qtyProducts.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</p></div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div><p className="text-[11px] font-bold text-slate-600 dark:text-slate-400">Ticket médio</p><p className="text-xl font-black text-rose-700/70 tabular-nums">{formatCurrency(dailyMetrics.avgTicket)}</p></div>
                  <div><p className="text-[11px] font-bold text-slate-600 dark:text-slate-400 text-right">Produtos por venda</p><p className="text-xl font-black text-rose-700/70 tabular-nums text-right">{dailyMetrics.prodsPerSale.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</p></div>
                </div>
              </div>
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 flex items-center gap-2">
                 <span className="text-[10px] font-bold text-slate-400">Última atualização: {lastUpdate.toLocaleTimeString('pt-BR')}</span>
                 <span className="text-xl">{getReaction(dailyMetrics.avgTicket).emoji}</span>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 border-l border-slate-100 dark:border-slate-800 pl-6">
            <div className="flex justify-between items-center mb-4"><h2 className="text-sm font-bold text-slate-700 dark:text-slate-200 uppercase">Vendas por hora</h2></div>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData} margin={{ top: 10, right: 10, left: 20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis dataKey="hour" axisLine={{ stroke: '#cbd5e1' }} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={{ stroke: '#cbd5e1' }} tickLine={false} tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={(val) => `R$ ${val.toLocaleString('pt-BR')}`} />
                  <Tooltip cursor={{fill: '#f1f5f9'}} formatter={(value: number) => [formatCurrency(value), 'Valor']} contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '10px', fontWeight: 'bold' }} />
                  <Bar dataKey="value" fill="#b91c1c" barSize={30} radius={[2, 2, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[450px]">
           <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50"><h2 className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-300">Produtos vendidos</h2></div>
           <div className="overflow-auto flex-1 custom-scrollbar">
              <table className="w-full text-left border-collapse">
                 <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-200 shadow-sm"><tr className="text-[9px] font-black uppercase text-slate-500 bg-slate-50/30"><th className="px-3 py-2 border-r border-slate-200">Código</th><th className="px-3 py-2 border-r border-slate-200">Produto</th><th className="px-3 py-2 border-r border-slate-200">UN</th><th className="px-3 py-2 border-r border-slate-200 text-right">Estoque</th><th className="px-3 py-2 border-r border-slate-200 text-right">Vendidos</th><th className="px-3 py-2 text-right">Total</th></tr></thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {soldProductsList.map((item: any, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-[10px] font-medium text-slate-700 dark:text-slate-300">
                         <td className="px-3 py-2 border-r border-slate-100">{item.code}</td>
                         <td className="px-3 py-2 border-r border-slate-100 uppercase truncate max-w-[150px] font-bold">{item.name}</td>
                         <td className="px-3 py-2 border-r border-slate-100 text-center">{item.unit}</td>
                         <td className={`px-3 py-2 border-r border-slate-100 text-right tabular-nums ${item.stock < 0 ? 'text-rose-600' : ''}`}>{item.stock.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</td>
                         <td className="px-3 py-2 border-r border-slate-100 text-right tabular-nums font-bold text-slate-900 dark:text-white">{item.qtySold.toLocaleString('pt-BR', { minimumFractionDigits: 3 })}</td>
                         <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-900 dark:text-white">{formatCurrency(item.totalValue)}</td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[450px]">
           <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50/50"><h2 className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-300">Desempenho de vendedores</h2></div>
           <div className="overflow-auto flex-1 custom-scrollbar">
              <table className="w-full text-left border-collapse">
                 <thead className="sticky top-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-200 shadow-sm"><tr className="text-[9px] font-black uppercase text-slate-500 bg-slate-50/30"><th className="px-3 py-2 border-r border-slate-200">Vendedor</th><th className="px-3 py-2 border-r border-slate-200 text-right">Vendas</th><th className="px-3 py-2 border-r border-slate-200 text-right">Valor Total</th><th className="px-3 py-2 text-right">Ticket Médio</th></tr></thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {vendorPerformance.map((v: any, idx) => (
                      <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 text-[10px] font-medium text-slate-700 dark:text-slate-300">
                         <td className="px-3 py-2 border-r border-slate-100 uppercase font-bold flex items-center gap-2"><span>{v.reaction.emoji}</span><span className="truncate">{v.name}</span></td>
                         <td className="px-3 py-2 border-r border-slate-100 text-right tabular-nums">{v.qtySales}</td>
                         <td className="px-3 py-2 border-r border-slate-100 text-right tabular-nums font-bold text-slate-900 dark:text-white">{formatCurrency(v.total)}</td>
                         <td className="px-3 py-2 text-right tabular-nums font-bold text-slate-900 dark:text-white">{formatCurrency(v.ticket)}</td>
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
