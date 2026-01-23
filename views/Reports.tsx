
import React, { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { Transaction, UserRole, User, ServiceOrderStatus } from '../types';
import { useLocation } from 'react-router-dom';

const Reports: React.FC = () => {
  const { transactions, users, currentUser, establishments, serviceOrders, products } = useApp();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const reportType = query.get('type') || 'evolucao';

  const todayStr = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(thirtyDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);
  const [searchTerm, setSearchTerm] = useState('');

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const currentStore = establishments.find(e => e.id === currentUser?.storeId);
  const currentStoreName = currentStore?.name || '';

  const periodSales = useMemo(() => {
    return (transactions || []).filter(t => {
      const belongsToStoreScope = isAdmin || t.store === currentStoreName;
      if (!belongsToStoreScope) return false;
      const isCorrectType = t.type === 'INCOME' && (t.category === 'Venda' || t.category === 'Serviço');
      if (!isCorrectType) return false;
      return t.date >= startDate && t.date <= endDate;
    });
  }, [transactions, startDate, endDate, isAdmin, currentStoreName]);

  const dailyData = useMemo(() => {
    const map: Record<string, { label: string, total: number, count: number }> = {};
    periodSales.forEach(s => {
      if (!map[s.date]) map[s.date] = { label: s.date, total: 0, count: 0 };
      map[s.date].total += s.value;
      map[s.date].count += 1;
    });
    return Object.values(map).sort((a, b) => b.label.localeCompare(a.label));
  }, [periodSales]);

  const vendorStats = useMemo(() => {
    const map: Record<string, { name: string, total: number, count: number, items: number }> = {};
    periodSales.forEach(s => {
      const vid = s.vendorId || 'balcao';
      const vname = users.find(u => u.id === s.vendorId)?.name || 'BALCÃO / SISTEMA';
      if (!map[vid]) map[vid] = { name: vname, total: 0, count: 0, items: 0 };
      map[vid].total += s.value;
      map[vid].count += 1;
      if (s.items) s.items.forEach((i: any) => map[vid].items += i.quantity);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [periodSales, users]);

  const productsStats = useMemo(() => {
    const map: Record<string, { name: string, sku: string, qty: number, total: number, cost: number, category: string, isService: boolean }> = {};
    periodSales.forEach(s => {
      if (s.items) {
        s.items.forEach((i: any) => {
          const key = i.sku || i.name;
          if (!map[key]) map[key] = { name: i.name, sku: i.sku || 'N/A', qty: 0, total: 0, cost: 0, category: i.category, isService: !!i.isService };
          map[key].qty += i.quantity;
          map[key].total += (i.quantity * i.salePrice);
          map[key].cost += (i.quantity * (i.costPrice || 0));
        });
      }
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [periodSales]);

  const serviceStats = useMemo(() => {
    return productsStats.filter(p => p.isService).sort((a, b) => b.total - a.total);
  }, [productsStats]);

  const totalRevenue = periodSales.reduce((acc, t) => acc + t.value, 0);
  const totalCost = productsStats.reduce((acc, p) => acc + p.cost, 0);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4 no-print">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tight">
            {reportType === 'por_vendedor' ? 'Performance de Equipe' : 
             reportType === 'por_produto' ? 'Curva ABC de Produtos' : 
             reportType === 'por_servico' ? 'Analítico de Serviços' :
             reportType === 'margem_bruta' ? 'Analítico de Rentabilidade' : 'Evolução de Faturamento'}
          </h2>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-2">Período: {startDate} até {endDate}</p>
        </div>
        <div className="flex items-center gap-2 bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-sm">
           <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase" />
           <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase" />
           <button onClick={() => window.print()} className="px-6 py-2.5 bg-primary text-white text-[10px] font-black uppercase rounded-xl flex items-center gap-2">
             <span className="material-symbols-outlined text-sm">print</span> Imprimir
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <KPICard title="Bruto do Período" value={`R$ ${totalRevenue.toLocaleString('pt-BR')}`} icon="payments" color="text-primary" />
        <KPICard title="Ticket Médio" value={`R$ ${(periodSales.length ? totalRevenue / periodSales.length : 0).toLocaleString('pt-BR')}`} icon="trending_up" color="text-emerald-500" />
        <KPICard title="Margem Bruta (R$)" value={`R$ ${(totalRevenue - totalCost).toLocaleString('pt-BR')}`} icon="pie_chart" color="text-amber-500" />
        <KPICard title="Lucratividade %" value={`${(totalRevenue ? ((totalRevenue - totalCost) / totalRevenue) * 100 : 0).toFixed(1)}%`} icon="analytics" color="text-blue-500" />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
         {reportType === 'evolucao' && (
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 border-b"><tr className="text-[10px] font-black uppercase text-slate-400"><th className="px-8 py-5">Data</th><th className="px-8 py-5 text-center">Vendas</th><th className="px-8 py-5 text-right">Total</th><th className="px-8 py-5 text-right">Ticket Médio</th></tr></thead>
              <tbody className="divide-y">
                {dailyData.map((d, i) => (
                  <tr key={i} className="hover:bg-slate-50 font-bold"><td className="px-8 py-5 text-sm uppercase">{d.label}</td><td className="px-8 py-5 text-center">{d.count}</td><td className="px-8 py-5 text-right tabular-nums">R$ {d.total.toLocaleString('pt-BR')}</td><td className="px-8 py-5 text-right text-primary">R$ {(d.total / d.count).toLocaleString('pt-BR')}</td></tr>
                ))}
              </tbody>
            </table>
         )}

         {reportType === 'por_vendedor' && (
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b"><tr className="text-[10px] font-black uppercase text-slate-400"><th className="px-8 py-5">Consultor</th><th className="px-8 py-5 text-center">Tickets</th><th className="px-8 py-5 text-center">Itens</th><th className="px-8 py-5 text-right">Total Vendido</th><th className="px-8 py-5 text-right">Ticket Médio</th></tr></thead>
              <tbody className="divide-y">
                {vendorStats.map((v, i) => (
                  <tr key={i} className="hover:bg-slate-50 font-bold"><td className="px-8 py-5 text-sm uppercase">{v.name}</td><td className="px-8 py-5 text-center">{v.count}</td><td className="px-8 py-5 text-center">{v.items}</td><td className="px-8 py-5 text-right tabular-nums">R$ {v.total.toLocaleString('pt-BR')}</td><td className="px-8 py-5 text-right text-emerald-500">R$ {(v.total / v.count).toLocaleString('pt-BR')}</td></tr>
                ))}
              </tbody>
            </table>
         )}

         {reportType === 'por_produto' && (
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b"><tr className="text-[10px] font-black uppercase text-slate-400"><th className="px-8 py-5">Produto</th><th className="px-8 py-5 text-center">Qtd. Vendida</th><th className="px-8 py-5 text-right">Total Bruto</th><th className="px-8 py-5 text-right">Part. %</th></tr></thead>
              <tbody className="divide-y">
                {productsStats.filter(p => !p.isService).map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50 font-bold"><td className="px-8 py-5 text-xs uppercase">{p.name} <br/><span className="text-[9px] text-slate-400">SKU: {p.sku}</span></td><td className="px-8 py-5 text-center tabular-nums">{p.qty}</td><td className="px-8 py-5 text-right tabular-nums text-primary">R$ {p.total.toLocaleString('pt-BR')}</td><td className="px-8 py-5 text-right tabular-nums text-slate-400">{((p.total / totalRevenue) * 100).toFixed(1)}%</td></tr>
                ))}
              </tbody>
            </table>
         )}

         {reportType === 'por_servico' && (
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b"><tr className="text-[10px] font-black uppercase text-slate-400"><th className="px-8 py-5">Serviço / Mão de Obra</th><th className="px-8 py-5 text-center">Ocorrências</th><th className="px-8 py-5 text-right">Total Faturado</th><th className="px-8 py-5 text-right">Part. %</th></tr></thead>
              <tbody className="divide-y">
                {serviceStats.map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50 font-bold"><td className="px-8 py-5 text-xs uppercase">{p.name}</td><td className="px-8 py-5 text-center tabular-nums">{p.qty}</td><td className="px-8 py-5 text-right tabular-nums text-amber-600">R$ {p.total.toLocaleString('pt-BR')}</td><td className="px-8 py-5 text-right tabular-nums text-slate-400">{((p.total / totalRevenue) * 100).toFixed(1)}%</td></tr>
                ))}
              </tbody>
            </table>
         )}

         {reportType === 'margem_bruta' && (
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b"><tr className="text-[10px] font-black uppercase text-slate-400"><th className="px-8 py-5">Item</th><th className="px-8 py-5 text-right">Faturamento</th><th className="px-8 py-5 text-right">Custo Total</th><th className="px-8 py-5 text-right">Margem R$</th><th className="px-8 py-5 text-right">Margem %</th></tr></thead>
              <tbody className="divide-y">
                {productsStats.map((p, i) => (
                  <tr key={i} className="hover:bg-slate-50 font-bold"><td className="px-8 py-5 text-xs uppercase">{p.name}</td><td className="px-8 py-5 text-right tabular-nums">R$ {p.total.toLocaleString('pt-BR')}</td><td className="px-8 py-5 text-right tabular-nums text-rose-500">R$ {p.cost.toLocaleString('pt-BR')}</td><td className="px-8 py-5 text-right tabular-nums text-emerald-500">R$ {(p.total - p.cost).toLocaleString('pt-BR')}</td><td className="px-8 py-5 text-right text-blue-500">{p.total > 0 ? (((p.total - p.cost) / p.total) * 100).toFixed(1) : 0}%</td></tr>
                ))}
              </tbody>
            </table>
         )}
      </div>
    </div>
  );
};

const KPICard = ({ title, value, icon, color }: any) => (
  <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
    <div className={`size-12 rounded-xl bg-slate-50 dark:bg-slate-800 ${color} flex items-center justify-center mb-4`}><span className="material-symbols-outlined text-2xl">{icon}</span></div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{title}</p>
    <p className="text-2xl font-black tabular-nums mt-1">{value}</p>
  </div>
);

export default Reports;
