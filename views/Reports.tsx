
import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import { Transaction, UserRole } from '../types';
import { useLocation } from 'react-router-dom';

const Reports: React.FC = () => {
  const { transactions, users, currentUser, establishments } = useApp();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const reportType = query.get('type') || 'evolucao';

  // Filtros de Data - Agora inicia com os últimos 30 dias para garantir que mostre dados
  const today = new Date();
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(today.getDate() - 30);
  
  const todayStr = today.toISOString().split('T')[0];
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(thirtyDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);

  // Filtros Secundários
  const [filterStore, setFilterStore] = useState('TODAS LOJAS');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterPayment, setFilterPayment] = useState('TODOS PAGTOS');

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const currentStore = establishments.find(e => e.id === currentUser?.storeId);
  const currentStoreName = currentStore?.name || 'ADMINISTRATIVO GLOBAL';

  // 1. Filtragem Base (Data e Permissões)
  const baseFilteredData = useMemo(() => {
    return (transactions || []).filter(t => {
      if (t.type !== 'INCOME') return false;
      
      const matchesDate = t.date >= startDate && t.date <= endDate;
      if (!matchesDate) return false;

      const belongsToStore = isAdmin || t.store === currentStoreName;
      if (!belongsToStore) return false;
      
      if (filterStore !== 'TODAS LOJAS' && t.store !== filterStore) return false;
      if (filterCustomer && !t.client?.toLowerCase().includes(filterCustomer.toLowerCase())) return false;
      if (filterPayment !== 'TODOS PAGTOS' && t.method !== filterPayment) return false;

      return true;
    });
  }, [transactions, startDate, endDate, isAdmin, currentStoreName, filterStore, filterCustomer, filterPayment]);

  // 2. Processamento Dinâmico por Tipo de Relatório
  const displayData = useMemo(() => {
    if (reportType === 'evolucao' || reportType === 'por_vendas') {
      return baseFilteredData.map(t => ({
        col1: t.date,
        col2: t.store,
        col3: t.client || 'Consumidor Final',
        col4: t.method,
        value: t.value,
        id: t.id
      }));
    }

    // Agrupamentos
    const groups: Record<string, any> = {};

    if (reportType === 'por_produto' || reportType === 'margem_bruta') {
      baseFilteredData.forEach(t => {
        (t.items || []).forEach(item => {
          const key = item.id;
          if (!groups[key]) {
            groups[key] = { col1: item.sku, col2: 'MERCADORIA', col3: item.name, col4: 'UN', value: 0, qty: 0 };
          }
          groups[key].value += (item.salePrice * item.quantity);
          groups[key].qty += item.quantity;
          groups[key].col4 = `${groups[key].qty} UN`;
        });
      });
    } else {
      baseFilteredData.forEach(t => {
        let key = '';
        let label = '';
        let subLabel = '';

        switch (reportType) {
          case 'por_unidade': key = t.store; label = t.store; subLabel = 'UNIDADE'; break;
          case 'por_cliente': key = t.client || 'FINAL'; label = t.client || 'Consumidor Final'; subLabel = 'CLIENTE'; break;
          case 'por_vendedor': 
            const v = users.find(u => u.id === t.vendorId);
            key = t.vendorId || 'BALCAO'; label = v?.name || 'Vendedor não inf.'; subLabel = 'CONSULTOR'; break;
          default: key = t.id; label = t.description; subLabel = t.category;
        }

        if (!groups[key]) {
          groups[key] = { col1: '---', col2: subLabel, col3: label, col4: 'Venda(s)', value: 0, count: 0 };
        }
        groups[key].value += t.value;
        groups[key].count += 1;
        groups[key].col4 = `${groups[key].count} Venda(s)`;
      });
    }

    return Object.values(groups).sort((a, b) => b.value - a.value);
  }, [baseFilteredData, reportType, users]);

  // Cálculos para os Cards (Sempre sobre a base filtrada)
  const metrics = useMemo(() => {
    const faturamento = baseFilteredData.reduce((acc, t) => acc + t.value, 0);
    const operacoes = baseFilteredData.length;
    const ticketMedio = operacoes > 0 ? faturamento / operacoes : 0;
    const uniqueClients = new Set(baseFilteredData.map(t => t.clientId || t.client)).size;
    return { faturamento, operacoes, ticketMedio, uniqueClients };
  }, [baseFilteredData]);

  const getTableHeaders = () => {
    switch (reportType) {
      case 'por_produto': return ['SKU', 'Tipo', 'Descrição do Produto', 'Qtd Total', 'Total Bruto'];
      case 'por_cliente': return ['---', 'Tipo', 'Nome do Cliente', 'Frequência', 'Total Gasto'];
      case 'por_vendedor': return ['---', 'Cargo', 'Nome do Consultor', 'Atendimentos', 'Total Vendido'];
      case 'por_unidade': return ['---', 'Tipo', 'Unidade/Loja', 'Movimento', 'Total Loja'];
      default: return ['Data', 'Loja/Unidade', 'Cliente/Descrição', 'Pagamento', 'Valor Total'];
    }
  };

  const clearFilters = () => {
    setFilterStore('TODAS LOJAS');
    setFilterCustomer('');
    setFilterPayment('TODOS PAGTOS');
    setStartDate(thirtyDaysAgoStr);
    setEndDate(todayStr);
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 bg-[#0f172a] min-h-screen text-slate-100 print:bg-white print:text-black print:p-0">
      
      {/* HEADER RELATÓRIO */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 print:mb-8">
        <div className="space-y-1">
          <h2 className="text-3xl font-black uppercase tracking-tight text-white print:text-black">
            {reportType.replace('_', ' ')} de Vendas
          </h2>
          <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
             <span>Período: {startDate} até {endDate}</span>
             <span className="size-1 bg-slate-600 rounded-full"></span>
             <span>Unidade: {isAdmin ? filterStore : currentStoreName}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-[2rem] border border-slate-800 print:hidden">
           <div className="flex items-center gap-2 px-4 border-r border-slate-800">
              <span className="material-symbols-outlined text-slate-500 text-lg">calendar_month</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-[11px] font-black text-white focus:ring-0 uppercase" />
           </div>
           <div className="flex items-center gap-2 px-4 border-r border-slate-800">
              <span className="material-symbols-outlined text-slate-500 text-lg">calendar_month</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-[11px] font-black text-white focus:ring-0 uppercase" />
           </div>
           <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-primary/20 hover:scale-105 transition-all">
              <span className="material-symbols-outlined text-lg">print</span> Imprimir
           </button>
        </div>
      </div>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-4">
         <MetricCard title="Ticket Médio" value={`R$ ${metrics.ticketMedio.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`} icon="payments" iconBg="bg-blue-500/10 text-blue-500" />
         <MetricCard title="Faturamento Bruto" value={`R$ ${metrics.faturamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`} icon="trending_up" iconBg="bg-emerald-500/10 text-emerald-500" />
         <MetricCard title="Operações" value={metrics.operacoes.toString()} icon="shopping_bag" iconBg="bg-amber-500/10 text-amber-500" />
         <MetricCard title="Itens/Clientes" value={metrics.uniqueClients.toString()} icon="layers" iconBg="bg-indigo-500/10 text-indigo-500" />
      </div>

      {/* BARRA DE FILTROS SECUNDÁRIA */}
      <div className="bg-[#1e293b]/50 p-4 rounded-[2rem] border border-slate-800 flex flex-wrap items-center gap-4 print:hidden">
         {isAdmin && (
           <select 
             value={filterStore} 
             onChange={e => setFilterStore(e.target.value)}
             className="h-12 bg-slate-900/50 border border-slate-700 rounded-xl px-4 text-[10px] font-black uppercase text-slate-300 outline-none focus:ring-2 focus:ring-primary min-w-[180px]"
           >
              <option>TODAS LOJAS</option>
              {establishments.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
           </select>
         )}

         <div className="flex-1 relative min-w-[200px]">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 text-lg">person_search</span>
            <input 
              value={filterCustomer}
              onChange={e => setFilterCustomer(e.target.value)}
              placeholder="BUSCAR CLIENTE..." 
              className="w-full h-12 bg-slate-900/50 border border-slate-700 rounded-xl pl-12 pr-4 text-[10px] font-black uppercase text-white outline-none focus:ring-2 focus:ring-primary" 
            />
         </div>

         <select 
           value={filterPayment}
           onChange={e => setFilterPayment(e.target.value)}
           className="h-12 bg-slate-900/50 border border-slate-700 rounded-xl px-4 text-[10px] font-black uppercase text-slate-300 outline-none focus:ring-2 focus:ring-primary min-w-[180px]"
         >
            <option>TODOS PAGTOS</option>
            <option>Dinheiro</option>
            <option>Pix</option>
            <option>Debito</option>
            <option>Credito</option>
         </select>

         <button onClick={clearFilters} className="text-[10px] font-black uppercase text-primary hover:underline px-4">Limpar</button>
      </div>

      {/* TABELA DE RESULTADOS */}
      <div className="bg-[#1e293b] rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl print:border-none print:shadow-none">
         <table className="w-full text-left">
            <thead>
               <tr className="bg-slate-800/50 border-b border-slate-700">
                  {getTableHeaders().map((h, i) => (
                    <th key={i} className={`px-8 py-6 text-[10px] font-black uppercase text-slate-400 ${i === 4 ? 'text-right' : ''}`}>{h}</th>
                  ))}
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
               {displayData.map((row: any, idx: number) => (
                 <tr key={row.id || idx} className="hover:bg-slate-800/30 transition-all font-bold group">
                    <td className="px-8 py-5 text-xs text-slate-400">{row.col1}</td>
                    <td className="px-8 py-5 text-xs text-primary uppercase">{row.col2}</td>
                    <td className="px-8 py-5 text-xs text-slate-200 uppercase">{row.col3}</td>
                    <td className="px-8 py-5 text-[10px] text-slate-500 uppercase">{row.col4}</td>
                    <td className="px-8 py-5 text-right text-sm font-black text-white print:text-black tabular-nums">R$ {row.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                 </tr>
               ))}
               {displayData.length === 0 && (
                 <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-[10px] font-black uppercase text-slate-600 tracking-widest">Nenhum registro localizado no período</td>
                 </tr>
               )}
            </tbody>
            {displayData.length > 0 && (
              <tfoot className="bg-slate-800/20 border-t border-slate-700">
                 <tr>
                    <td colSpan={4} className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 text-right">Somatória Geral:</td>
                    <td className="px-8 py-6 text-right text-lg font-black text-primary tabular-nums">R$ {metrics.faturamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                 </tr>
              </tfoot>
            )}
         </table>
      </div>

      <style>{`
        @media print {
          aside, header, nav, .print\\:hidden, button, select, input { display: none !important; }
          body { background-color: white !important; color: black !important; margin: 0 !important; padding: 0 !important; }
          #root, main, div[class*="overflow-y-auto"] { overflow: visible !important; height: auto !important; width: 100% !important; position: static !important; }
          .p-8 { padding: 0 !important; }
          table { border-collapse: collapse !important; width: 100% !important; }
          tr { page-break-inside: avoid !important; }
          th { background-color: #f8fafc !important; color: #475569 !important; border-bottom: 2px solid #e2e8f0 !important; }
          td, th { border: 1px solid #e2e8f0 !important; padding: 8px !important; }
          .text-white { color: black !important; }
          .text-primary { color: #136dec !important; }
        }
      `}</style>
    </div>
  );
};

const MetricCard = ({ title, value, icon, iconBg }: any) => (
  <div className="bg-[#1e293b] p-8 rounded-[2.5rem] border border-slate-800 shadow-lg flex flex-col gap-6 group hover:border-primary transition-all print:border-slate-200">
     <div className={`size-14 rounded-2xl flex items-center justify-center ${iconBg} shadow-inner`}>
        <span className="material-symbols-outlined text-3xl">{icon}</span>
     </div>
     <div className="space-y-1">
        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">{title}</p>
        <h3 className="text-3xl font-black text-white print:text-black tabular-nums tracking-tighter">{value}</h3>
     </div>
  </div>
);

export default Reports;
