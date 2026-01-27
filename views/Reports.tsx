
import React, { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { Transaction, UserRole } from '../types';
import { useLocation, useNavigate } from 'react-router-dom';

const Reports: React.FC = () => {
  const { transactions, users, currentUser, establishments } = useApp();
  const navigate = useNavigate();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const reportType = query.get('type') || 'evolucao';

  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [filterStore, setFilterStore] = useState('TODAS LOJAS');
  const [showHub, setShowHub] = useState(false);

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const currentStoreName = establishments.find(e => e.id === currentUser?.storeId)?.name || 'ADMIN';

  const baseData = useMemo(() => {
    return transactions.filter(t => {
      const matchesDate = t.date >= startDate && t.date <= endDate;
      const belongs = isAdmin || t.store === currentStoreName;
      const matchesStore = filterStore === 'TODAS LOJAS' || t.store === filterStore;
      return t.type === 'INCOME' && matchesDate && belongs && matchesStore;
    });
  }, [transactions, startDate, endDate, isAdmin, currentStoreName, filterStore]);

  const displayData = useMemo(() => {
    const groups: Record<string, any> = {};

    switch (reportType) {
      case 'evolucao':
      case 'por_vendas':
        return baseData.map(t => ({
          col1: t.date.split('-').reverse().join('/'), col2: t.store, col3: t.client || 'Consumidor Final', col4: `${t.items?.length || 0} itens`, col5: t.method, value: t.value
        }));

      case 'por_produto':
      case 'margem_bruta':
        baseData.forEach(t => {
          t.items?.forEach(item => {
            const key = item.id;
            if (!groups[key]) groups[key] = { col1: item.sku, col2: item.category, col3: item.name, qty: 0, revenue: 0, cost: 0 };
            groups[key].qty += item.quantity;
            groups[key].revenue += (item.salePrice * item.quantity);
            groups[key].cost += (item.costPrice * item.quantity);
          });
        });
        return Object.values(groups).map(g => ({
          ...g, col4: `${g.qty} UN`, value: g.revenue, profit: g.revenue - g.cost, col5: g.revenue > 0 ? `${(((g.revenue - g.cost) / g.revenue) * 100).toFixed(1)}%` : '0%'
        })).sort((a, b) => b.value - a.value);

      case 'por_vendedor':
        baseData.forEach(t => {
          const v = users.find(u => u.id === t.vendorId);
          const key = t.vendorId || 'BALCAO';
          if (!groups[key]) groups[key] = { col1: v?.role || 'VENDEDOR', col2: t.store, col3: v?.name || 'BALCÃO', count: 0, value: 0 };
          groups[key].count += 1;
          groups[key].value += t.value;
        });
        return Object.values(groups).map(g => ({ ...g, col4: `${g.count} Vendas`, col5: 'ATIVO', value: g.value })).sort((a, b) => b.value - a.value);

      case 'por_cliente':
        baseData.forEach(t => {
          const key = t.clientId || t.client || 'FINAL';
          if (!groups[key]) groups[key] = { col1: 'CLIENTE', col2: t.store, col3: t.client || 'CONSUMIDOR FINAL', count: 0, value: 0 };
          groups[key].count += 1;
          groups[key].value += t.value;
        });
        return Object.values(groups).map(g => ({ ...g, col4: `${g.count} Compras`, col5: 'OK', value: g.value })).sort((a, b) => b.value - a.value);

      default:
        baseData.forEach(t => {
          const key = t.store;
          if (!groups[key]) groups[key] = { col1: 'UNIDADE', col2: 'LOJA', col3: key, count: 0, value: 0 };
          groups[key].count += 1;
          groups[key].value += t.value;
        });
        return Object.values(groups).map(g => ({ ...g, col4: `${g.count} Transações`, col5: 'OK', value: g.value }));
    }
  }, [baseData, reportType, users]);

  const reportOptions = [
    { id: 'evolucao', label: 'Evolução de Vendas', icon: 'trending_up', color: 'bg-blue-500' },
    { id: 'por_unidade', label: 'Vendas por Unidade', icon: 'store', color: 'bg-emerald-500' },
    { id: 'por_produto', label: 'Vendas por Produto', icon: 'inventory_2', color: 'bg-amber-500' },
    { id: 'margem_bruta', label: 'Margem Bruta / Lucro', icon: 'payments', color: 'bg-rose-500' },
    { id: 'por_vendedor', label: 'Desempenho Vendedor', icon: 'badge', color: 'bg-indigo-500' },
    { id: 'por_cliente', label: 'Ranking de Clientes', icon: 'groups', color: 'bg-cyan-500' },
    { id: 'por_servico', label: 'Serviços Prestados', icon: 'build', color: 'bg-orange-500' },
    { id: 'ticket_medio', label: 'Análise Ticket Médio', icon: 'analytics', color: 'bg-purple-500' },
    { id: 'giro_estoque', label: 'Giro de Estoque', icon: 'sync', color: 'bg-teal-500' },
    { id: 'por_vendas', label: 'Listagem Detalhada', icon: 'list_alt', color: 'bg-slate-500' },
  ];

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 bg-[#0f172a] min-h-screen text-slate-100 print:bg-white print:text-black print:p-4">
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 print:hidden">
        <div className="flex items-center gap-4">
          <button onClick={() => setShowHub(!showHub)} className="size-14 bg-white/10 hover:bg-primary text-white rounded-2xl flex items-center justify-center transition-all shadow-xl">
             <span className="material-symbols-outlined text-3xl">{showHub ? 'close' : 'apps'}</span>
          </button>
          <div>
            <h2 className="text-4xl font-black uppercase tracking-tighter text-white">Relatório {reportOptions.find(o => o.id === reportType)?.label || 'Vendas'}</h2>
          </div>
        </div>
        <div className="flex items-center gap-2 bg-slate-900/80 p-2 rounded-2xl border border-slate-800">
           <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black text-white uppercase focus:ring-0" />
           <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black text-white uppercase focus:ring-0" />
           <button onClick={() => window.print()} className="bg-primary hover:bg-blue-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all">Imprimir</button>
        </div>
      </div>

      {showHub && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 animate-in zoom-in-95 duration-300 print:hidden">
           {reportOptions.map(opt => (
             <button key={opt.id} onClick={() => { navigate(`/relatorios?type=${opt.id}`); setShowHub(false); }} className={`p-6 rounded-[2rem] border transition-all flex flex-col items-center gap-3 group ${reportType === opt.id ? 'bg-primary border-primary' : 'bg-slate-900 border-slate-800 hover:border-primary/50'}`}>
                <div className={`size-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${opt.color} group-hover:scale-110 transition-transform`}><span className="material-symbols-outlined text-2xl">{opt.icon}</span></div>
                <span className="text-[10px] font-black uppercase tracking-tighter text-center">{opt.label}</span>
             </button>
           ))}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:grid-cols-4">
        <MetricCard title="Total Faturado" value={`R$ ${baseData.reduce((acc, t) => acc + t.value, 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`} icon="trending_up" color="text-emerald-500" />
        <MetricCard title="Vendas" value={baseData.length.toString()} icon="shopping_bag" color="text-primary" />
        <MetricCard title="Ticket Médio" value={`R$ ${(baseData.length ? baseData.reduce((acc, t) => acc + t.value, 0)/baseData.length : 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`} icon="payments" color="text-amber-500" />
        <MetricCard title="Unidades" value={Array.from(new Set(baseData.map(t => t.store))).length.toString()} icon="store" color="text-indigo-400" />
      </div>

      <div className="bg-[#1e293b] rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl print:border-none">
         <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-800 border-b border-slate-700">
                <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Coluna 1</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Unidade</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Descrição</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Detalhe</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                <th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
              {displayData.map((row: any, idx: number) => (
                <tr key={idx} className="hover:bg-slate-800/40 uppercase text-[10px] font-bold">
                  <td className="px-8 py-4 text-slate-500">{row.col1}</td>
                  <td className="px-8 py-4 text-primary">{row.col2}</td>
                  <td className="px-8 py-4 text-white truncate max-w-[250px]">{row.col3}</td>
                  <td className="px-8 py-4 text-slate-400">{row.col4}</td>
                  <td className="px-8 py-4 text-slate-500">{row.col5}</td>
                  <td className="px-8 py-4 text-right font-black text-white">R$ {row.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                </tr>
              ))}
            </tbody>
         </table>
      </div>
    </div>
  );
};

const MetricCard = ({ title, value, icon, color }: any) => (
  <div className="bg-[#1e293b] p-6 rounded-[2rem] border border-slate-800 flex items-center gap-4 hover:border-primary/40 transition-all shadow-lg group">
     <div className={`size-14 rounded-2xl bg-slate-900 flex items-center justify-center ${color} shadow-inner group-hover:scale-110 transition-transform`}><span className="material-symbols-outlined text-3xl">{icon}</span></div>
     <div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{title}</p>
        <p className="text-xl font-black text-white">{value}</p>
     </div>
  </div>
);

export default Reports;
