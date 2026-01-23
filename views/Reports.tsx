
import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import { Transaction, UserRole } from '../types';
import { useLocation } from 'react-router-dom';

const Reports: React.FC = () => {
  const { transactions, users, currentUser, establishments } = useApp();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const reportType = query.get('type') || 'evolucao';

  // Filtros de Data
  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  // Filtros Secundários (Barra Cinza)
  const [filterStore, setFilterStore] = useState('TODAS LOJAS');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterPayment, setFilterPayment] = useState('TODOS PAGTOS');

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const currentStore = establishments.find(e => e.id === currentUser?.storeId);
  const currentStoreName = currentStore?.name || 'ADMINISTRATIVO GLOBAL';

  // Lógica de Filtragem mestre
  const filteredData = useMemo(() => {
    return (transactions || []).filter(t => {
      // 1. Apenas Entradas (Vendas)
      if (t.type !== 'INCOME') return false;
      
      // 2. Filtro de Data
      const matchesDate = t.date >= startDate && t.date <= endDate;
      if (!matchesDate) return false;

      // 3. Filtro de Loja (Respeitando permissão)
      const belongsToStore = isAdmin || t.store === currentStoreName;
      if (!belongsToStore) return false;
      if (filterStore !== 'TODAS LOJAS' && t.store !== filterStore) return false;

      // 4. Filtro de Cliente
      if (filterCustomer && !t.client?.toLowerCase().includes(filterCustomer.toLowerCase())) return false;

      // 5. Filtro de Pagamento
      if (filterPayment !== 'TODOS PAGTOS' && t.method !== filterPayment) return false;

      return true;
    });
  }, [transactions, startDate, endDate, isAdmin, currentStoreName, filterStore, filterCustomer, filterPayment]);

  // Cálculos para os Cards
  const metrics = useMemo(() => {
    const faturamento = filteredData.reduce((acc, t) => acc + t.value, 0);
    const operacoes = filteredData.length;
    const ticketMedio = operacoes > 0 ? faturamento / operacoes : 0;
    
    // Contagem de Itens/Clientes únicos
    const uniqueClients = new Set(filteredData.map(t => t.clientId || t.client)).size;

    return { faturamento, operacoes, ticketMedio, uniqueClients };
  }, [filteredData]);

  const clearFilters = () => {
    setFilterStore('TODAS LOJAS');
    setFilterCustomer('');
    setFilterPayment('TODOS PAGTOS');
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 bg-[#0f172a] min-h-screen text-slate-100 print:bg-white print:text-black print:p-0">
      
      {/* HEADER RELATÓRIO */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 print:mb-8">
        <div className="space-y-1">
          <h2 className="text-3xl font-black uppercase tracking-tight text-white print:text-black">Relatório Analítico de Vendas</h2>
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
              <span className="material-symbols-outlined text-lg">print</span> Imprimir Relatório
           </button>
        </div>
      </div>

      {/* CARDS DE RESUMO */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 print:grid-cols-4">
         <MetricCard 
           title="Ticket Médio" 
           value={`R$ ${metrics.ticketMedio.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`} 
           icon="payments" 
           iconBg="bg-blue-500/10 text-blue-500"
         />
         <MetricCard 
           title="Faturamento Bruto" 
           value={`R$ ${metrics.faturamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`} 
           icon="trending_up" 
           iconBg="bg-emerald-500/10 text-emerald-500"
         />
         <MetricCard 
           title="Operações" 
           value={metrics.operacoes.toString()} 
           icon="shopping_bag" 
           iconBg="bg-amber-500/10 text-amber-500"
         />
         <MetricCard 
           title="Itens/Clientes" 
           value={metrics.uniqueClients.toString()} 
           icon="layers" 
           iconBg="bg-indigo-500/10 text-indigo-500"
         />
      </div>

      {/* BARRA DE FILTROS SECUNDÁRIA */}
      <div className="bg-[#1e293b]/50 p-4 rounded-[2rem] border border-slate-800 flex flex-wrap items-center gap-4 print:hidden">
         <select 
           value={filterStore} 
           onChange={e => setFilterStore(e.target.value)}
           className="h-12 bg-slate-900/50 border border-slate-700 rounded-xl px-4 text-[10px] font-black uppercase text-slate-300 outline-none focus:ring-2 focus:ring-primary min-w-[180px]"
         >
            <option>TODAS LOJAS</option>
            {establishments.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
         </select>

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
                  <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400">Data</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400">Loja/Unidade</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400">Cliente</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400">Pagamento</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 text-right">Valor Total</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
               {filteredData.map(t => (
                 <tr key={t.id} className="hover:bg-slate-800/30 transition-all font-bold group">
                    <td className="px-8 py-5 text-xs text-slate-400">{t.date}</td>
                    <td className="px-8 py-5 text-xs text-primary uppercase">{t.store}</td>
                    <td className="px-8 py-5 text-xs text-slate-200 uppercase">{t.client || 'Consumidor Final'}</td>
                    <td className="px-8 py-5 text-[10px] text-slate-500 uppercase">{t.method}</td>
                    <td className="px-8 py-5 text-right text-sm font-black text-white print:text-black tabular-nums">R$ {t.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                 </tr>
               ))}
               {filteredData.length === 0 && (
                 <tr>
                    <td colSpan={5} className="px-8 py-20 text-center text-[10px] font-black uppercase text-slate-600 tracking-widest">Nenhum registro localizado no período</td>
                 </tr>
               )}
            </tbody>
            {filteredData.length > 0 && (
              <tfoot className="bg-slate-800/20 border-t border-slate-700">
                 <tr>
                    <td colSpan={4} className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 text-right">Somatória dos Lançamentos:</td>
                    <td className="px-8 py-6 text-right text-lg font-black text-primary tabular-nums">R$ {metrics.faturamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                 </tr>
              </tfoot>
            )}
         </table>
      </div>

      <style>{`
        @media print {
          /* Esconde UI do sistema */
          aside, header, nav, .print\\:hidden, button, select, input {
            display: none !important;
          }
          
          /* Ajusta container principal para ocupar tudo */
          body {
            background-color: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          #root, main, div[class*="overflow-y-auto"] {
            overflow: visible !important;
            height: auto !important;
            width: 100% !important;
            position: static !important;
          }

          .p-8 {
            padding: 0 !important;
          }

          /* Tabela impressa precisa ser legível */
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          tr {
            page-break-inside: avoid !important;
          }
          th {
            background-color: #f8fafc !important;
            color: #475569 !important;
            border-bottom: 2px solid #e2e8f0 !important;
          }
          td, th {
            border: 1px solid #e2e8f0 !important;
            padding: 8px !important;
          }
          .text-white { color: black !important; }
          .text-primary { color: #136dec !important; }
          .bg-primary { background-color: #136dec !important; color: white !important; }
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
