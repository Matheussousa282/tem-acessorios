
import React, { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { Transaction, UserRole } from '../types';
import { useLocation } from 'react-router-dom';

const Reports: React.FC = () => {
  const { transactions, users, currentUser, establishments, products } = useApp();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const reportType = query.get('type') || 'evolucao';

  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterStore, setFilterStore] = useState('TODAS LOJAS');
  const [filterCustomer, setFilterCustomer] = useState('');

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const currentStoreName = establishments.find(e => e.id === currentUser?.storeId)?.name || 'ADMIN';

  const baseData = useMemo(() => {
    return transactions.filter(t => {
      const matchesDate = t.date >= startDate && t.date <= endDate;
      const belongs = isAdmin || t.store === currentStoreName;
      const matchesStore = filterStore === 'TODAS LOJAS' || t.store === filterStore;
      const matchesClient = !filterCustomer || t.client?.toLowerCase().includes(filterCustomer.toLowerCase());
      return t.type === 'INCOME' && matchesDate && belongs && matchesStore && matchesClient;
    });
  }, [transactions, startDate, endDate, isAdmin, currentStoreName, filterStore, filterCustomer]);

  const displayData = useMemo(() => {
    const groups: Record<string, any> = {};

    if (reportType === 'evolucao' || reportType === 'por_vendas') {
      return baseData.map(t => ({
        col1: t.date.split('-').reverse().join('/'), col2: t.store, col3: t.client || 'Consumidor Final', col4: `${t.items?.length || 0} itens`, col5: t.method, value: t.value
      }));
    }

    if (reportType === 'por_produto' || reportType === 'margem_bruta' || reportType === 'por_servico') {
      baseData.forEach(t => {
        t.items?.forEach(item => {
          if (reportType === 'por_servico' && !item.isService) return;
          const key = item.id;
          if (!groups[key]) groups[key] = { col1: item.sku, col2: item.category, col3: item.name, qty: 0, revenue: 0, cost: 0 };
          groups[key].qty += item.quantity;
          groups[key].revenue += (item.salePrice * item.quantity);
          groups[key].cost += (item.costPrice * item.quantity);
        });
      });
      return Object.values(groups).map(g => ({
        ...g, col4: `${g.qty} UN`, value: g.revenue, profit: g.revenue - g.cost, margin: g.revenue > 0 ? ((g.revenue - g.cost) / g.revenue) * 100 : 0
      })).sort((a, b) => b.value - a.value);
    }

    if (reportType === 'por_vendedor') {
      baseData.forEach(t => {
        const v = users.find(u => u.id === t.vendorId);
        const key = t.vendorId || 'BALCAO';
        if (!groups[key]) groups[key] = { col1: v?.role || 'VENDEDOR', col2: t.store, col3: v?.name || 'BALCÃO', count: 0, value: 0 };
        groups[key].count += 1;
        groups[key].value += t.value;
      });
      return Object.values(groups).map(g => ({ ...g, col4: `${g.count} Vendas`, value: g.value })).sort((a, b) => b.value - a.value);
    }

    // Default: Por Unidade
    baseData.forEach(t => {
      const key = t.store;
      if (!groups[key]) groups[key] = { col1: 'UNIDADE', col2: 'LOJA', col3: key, count: 0, value: 0 };
      groups[key].count += 1;
      groups[key].value += t.value;
    });
    return Object.values(groups).map(g => ({ ...g, col4: `${g.count} Transações`, value: g.value }));

  }, [baseData, reportType, users]);

  const totalRevenue = baseData.reduce((acc, t) => acc + t.value, 0);

  const getHeaders = () => {
    if (reportType.includes('produto') || reportType === 'margem_bruta' || reportType === 'por_servico') return ['SKU', 'Categoria', 'Item', 'Quantidade', 'Lucro Bruto', 'Total'];
    if (reportType === 'por_vendedor') return ['Cargo', 'Unidade', 'Colaborador', 'Volume', 'Status', 'Total'];
    return ['Data', 'Unidade', 'Identificação', 'Detalhe', 'Método', 'Total'];
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 bg-[#0f172a] min-h-screen text-slate-100 print:bg-white print:text-black print:p-4">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 print:hidden">
        <h2 className="text-4xl font-black uppercase tracking-tighter text-white">Relatório {reportType.replace(/_/g, ' ')}</h2>
        <div className="flex gap-2 bg-slate-900/50 p-2 rounded-2xl border border-slate-800">
           <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black text-white uppercase" />
           <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black text-white uppercase" />
           <button onClick={() => window.print()} className="bg-primary px-6 py-2 rounded-xl text-[10px] font-black uppercase">Imprimir</button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:grid-cols-4">
        <MetricCard title="Total Faturado" value={`R$ ${totalRevenue.toLocaleString('pt-BR')}`} icon="trending_up" color="text-emerald-500" />
        <MetricCard title="Vendas Realizadas" value={baseData.length.toString()} icon="shopping_bag" color="text-primary" />
        <MetricCard title="Unidades Ativas" value={Array.from(new Set(baseData.map(t => t.store))).length.toString()} icon="store" color="text-amber-500" />
        <MetricCard title="Ticket Médio" value={`R$ ${(baseData.length ? totalRevenue/baseData.length : 0).toLocaleString('pt-BR')}`} icon="payments" color="text-indigo-400" />
      </div>

      <div className="bg-[#1e293b] rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl print:border-none">
         <table className="w-full text-left">
            <thead><tr className="bg-slate-800 border-b border-slate-700">
              {getHeaders().map((h, i) => <th key={i} className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">{h}</th>)}
            </tr></thead>
            <tbody className="divide-y divide-slate-800/50">
              {displayData.map((row: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-800/40 uppercase text-[10px] font-bold">
                  <td className="px-8 py-4 text-slate-500">{row.col1}</td>
                  <td className="px-8 py-4 text-primary">{row.col2}</td>
                  <td className="px-8 py-4 text-white truncate max-w-[200px]">{row.col3}</td>
                  <td className="px-8 py-4 text-slate-400">{row.col4}</td>
                  <td className="px-8 py-4">{row.profit ? `R$ ${row.profit.toLocaleString('pt-BR')}` : (row.col5 || 'OK')}</td>
                  <td className="px-8 py-4 text-right font-black text-white">R$ {row.value.toLocaleString('pt-BR')}</td>
                </tr>
              ))}
            </tbody>
         </table>
      </div>
      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          .bg-[#1e293b], .bg-[#0f172a] { background: white !important; border: 1px solid #ddd !important; }
          .text-white, .text-slate-100 { color: black !important; }
          @page { size: A4 landscape; margin: 10mm; }
        }
      `}</style>
    </div>
  );
};

const MetricCard = ({ title, value, icon, color }: any) => (
  <div className="bg-[#1e293b] p-6 rounded-[2rem] border border-slate-800 flex items-center gap-4">
     <div className={`size-12 rounded-xl bg-slate-800 flex items-center justify-center ${color}`}><span className="material-symbols-outlined">{icon}</span></div>
     <div><p className="text-[9px] font-black text-slate-500 uppercase">{title}</p><p className="text-xl font-black">{value}</p></div>
  </div>
);

export default Reports;
