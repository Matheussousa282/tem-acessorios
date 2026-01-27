
import React, { useMemo, useState, useEffect } from 'react';
import { useApp } from '../AppContext';
import { Transaction, UserRole } from '../types';
import { useLocation } from 'react-router-dom';

const Reports: React.FC = () => {
  const { transactions, users, currentUser, establishments, products } = useApp();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const reportType = query.get('type') || 'evolucao';

  // Filtros de Data
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

  // 1. Filtragem Base (Respeita Datas, Unidade e Filtros de Busca)
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

  // 2. Processamento Dinâmico Completo por Tipo de Relatório
  const displayData = useMemo(() => {
    const groups: Record<string, any> = {};

    // --- GRUPO A: ANALÍTICO DE VENDAS (Venda por Venda) ---
    if (reportType === 'evolucao' || reportType === 'por_vendas' || reportType === 'entrega_futura') {
      const data = reportType === 'entrega_futura' 
        ? baseFilteredData.filter(t => t.description.toUpperCase().includes('FUTURA') || t.category.toUpperCase().includes('FUTURA'))
        : baseFilteredData;

      return data.map(t => {
        const qtyItems = t.items?.reduce((acc, item) => acc + item.quantity, 0) || 0;
        return {
          id: t.id,
          col1: t.date.split('-').reverse().join('/'),
          col2: t.store,
          col3: t.client || 'Consumidor Final',
          col4: `${qtyItems} itens`,
          col5: t.method,
          value: t.value,
          extra: t.id.split('-')[1] ? new Date(parseInt(t.id.split('-')[1])).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'}) : '--:--'
        };
      });
    }

    // --- GRUPO B: PRODUTOS E SERVIÇOS ---
    if (reportType === 'por_produto' || reportType === 'margem_bruta' || reportType === 'por_servico') {
      baseFilteredData.forEach(t => {
        (t.items || []).forEach(item => {
          if (reportType === 'por_servico' && !item.isService) return;
          
          const key = item.id;
          if (!groups[key]) {
            groups[key] = { col1: item.sku, col2: item.category, col3: item.name, qty: 0, revenue: 0, cost: 0, profit: 0 };
          }
          const itemRev = (item.salePrice * item.quantity);
          const itemCost = (item.costPrice * item.quantity);
          groups[key].qty += item.quantity;
          groups[key].revenue += itemRev;
          groups[key].cost += itemCost;
          groups[key].profit = groups[key].revenue - groups[key].cost;
        });
      });
      return Object.values(groups).map(g => ({
        ...g,
        col4: `${g.qty.toLocaleString('pt-BR')} UN`,
        value: g.revenue,
        profit: g.profit,
        margin: g.revenue > 0 ? (g.profit / g.revenue) * 100 : 0
      })).sort((a, b) => b.value - a.value);
    }

    // --- GRUPO C: VENDEDORES E TICKET MÉDIO ---
    if (reportType === 'por_vendedor' || reportType === 'ticket_vendedor') {
      baseFilteredData.forEach(t => {
        const vendor = users.find(u => u.id === t.vendorId);
        const key = t.vendorId || 'BALCAO';
        const vName = vendor?.name || 'Vendedor não inf.';
        const rate = vendor?.commissionRate || 0;

        if (!groups[key]) {
          groups[key] = { col1: vendor?.role || '---', col2: t.store, col3: vName, count: 0, value: 0, commission: 0 };
        }
        groups[key].count += 1;
        groups[key].value += t.value;
        groups[key].commission += (t.value * (rate / 100));
      });
      return Object.values(groups).map(g => ({
        ...g,
        col4: `${g.count} Venda(s)`,
        value: g.value,
        extra: reportType === 'ticket_vendedor' 
          ? `R$ ${(g.value / g.count).toLocaleString('pt-BR', {minimumFractionDigits: 2})}` 
          : `R$ ${g.commission.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
      })).sort((a, b) => b.value - a.value);
    }

    // --- GRUPO D: TEMPORAL (Ano, Mês/Ano) ---
    if (reportType === 'por_ano' || reportType === 'ticket_mes_ano') {
      baseFilteredData.forEach(t => {
        const dateObj = new Date(t.date);
        const year = dateObj.getFullYear();
        const month = dateObj.getMonth() + 1;
        const key = reportType === 'por_ano' ? `${year}` : `${month.toString().padStart(2, '0')}/${year}`;
        const label = reportType === 'por_ano' ? `ANO ${year}` : `PERÍODO ${key}`;

        if (!groups[key]) {
          groups[key] = { col1: '---', col2: 'FECHAMENTO', col3: label, count: 0, value: 0 };
        }
        groups[key].count += 1;
        groups[key].value += t.value;
      });
      return Object.values(groups).map(g => ({
        ...g,
        col4: `${g.count} Transações`,
        value: g.value,
        extra: reportType === 'ticket_mes_ano' 
          ? `Ticket: R$ ${(g.value / g.count).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`
          : '---'
      })).sort((a, b) => b.col3.localeCompare(a.col3));
    }

    // --- GRUPO E: AGRUPAMENTOS PADRÃO (Unidade, Cliente) ---
    baseFilteredData.forEach(t => {
      let key = '';
      let label = '';
      let subLabel = '';
      switch (reportType) {
        case 'por_unidade': key = t.store; label = t.store; subLabel = 'UNIDADE'; break;
        case 'por_cliente': key = t.clientId || t.client || 'FINAL'; label = t.client || 'Consumidor Final'; subLabel = 'CLIENTE'; break;
        default: key = t.id; label = t.description; subLabel = t.category;
      }
      if (!groups[key]) {
        groups[key] = { col1: '---', col2: subLabel, col3: label, count: 0, value: 0 };
      }
      groups[key].value += t.value;
      groups[key].count += 1;
    });
    return Object.values(groups).map(g => ({
      ...g,
      col4: `${g.count} Movimentações`,
      value: g.value
    })).sort((a, b) => b.value - a.value);

  }, [baseFilteredData, reportType, users]);

  // Métricas Consolidadas do Topo
  const metrics = useMemo(() => {
    const faturamento = baseFilteredData.reduce((acc, t) => acc + t.value, 0);
    const operacoes = baseFilteredData.length;
    const ticketMedio = operacoes > 0 ? faturamento / operacoes : 0;
    
    let totalCusto = 0;
    baseFilteredData.forEach(t => {
       t.items?.forEach(item => totalCusto += (item.costPrice * item.quantity));
    });
    
    const lucroBruto = faturamento - totalCusto;
    const markup = totalCusto > 0 ? (lucroBruto / totalCusto) * 100 : 0;

    return { faturamento, operacoes, ticketMedio, lucroBruto, markup };
  }, [baseFilteredData]);

  // Definição Dinâmica de Cabeçalhos
  const getTableHeaders = () => {
    switch (reportType) {
      case 'por_produto': 
      case 'margem_bruta': return ['SKU', 'Categoria', 'Produto', 'Quantidade', 'Lucro (R$)', 'Faturamento'];
      case 'por_servico': return ['Ref', 'Tipo Serviço', 'Descrição do Serviço', 'Qtd Realizada', 'Lucro (R$)', 'Total Bruto'];
      case 'por_vendedor': return ['Cargo', 'Loja', 'Consultor', 'Qtd. Vendas', 'Comissão Est.', 'Total Vendas'];
      case 'ticket_vendedor': return ['Cargo', 'Loja', 'Consultor', 'Qtd. Vendas', 'Ticket Médio', 'Total Vendas'];
      case 'por_cliente': return ['---', 'Perfil', 'Nome do Cliente', 'Frequência', '---', 'Total Gasto'];
      case 'por_unidade': return ['---', 'Tipo', 'Unidade/Loja', 'Vendas Realizadas', '---', 'Total Loja'];
      case 'por_ano': return ['---', 'Exercício', 'Ano Fiscal', 'Transações', '---', 'Total Ano'];
      case 'ticket_mes_ano': return ['---', 'Fechamento', 'Período', 'Volume', 'Ticket Médio', 'Faturamento'];
      case 'entrega_futura': return ['Data Venda', 'Unidade', 'Cliente', 'Qtd Itens', 'Aguardando', 'Total'];
      default: return ['Data', 'Unidade', 'Cliente', 'Qtd Itens', 'Pagamento', 'Total'];
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 bg-[#0f172a] min-h-screen text-slate-100 print:bg-white print:text-black print:p-0">
      
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 print:mb-8">
        <div className="space-y-1">
          <h2 className="text-4xl font-black uppercase tracking-tighter text-white print:text-black">
            Relatório {reportType.replace(/_/g, ' ')}
          </h2>
          <div className="flex items-center gap-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">
             <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">calendar_today</span> {startDate.split('-').reverse().join('/')} a {endDate.split('-').reverse().join('/')}</span>
             <span className="size-1 bg-slate-600 rounded-full"></span>
             <span className="flex items-center gap-1"><span className="material-symbols-outlined text-[14px]">store</span> {isAdmin ? filterStore : currentStoreName}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-3 bg-slate-900/50 p-3 rounded-[2rem] border border-slate-800 print:hidden">
           <div className="flex items-center gap-2 px-4 border-r border-slate-800">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-[11px] font-black text-white focus:ring-0 uppercase cursor-pointer" />
           </div>
           <div className="flex items-center gap-2 px-4 border-r border-slate-800">
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-[11px] font-black text-white focus:ring-0 uppercase cursor-pointer" />
           </div>
           <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-3 bg-primary text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-primary/20 hover:scale-105 transition-all">
              <span className="material-symbols-outlined text-lg">print</span> Gerar PDF
           </button>
        </div>
      </div>

      {/* CARDS DE MÉTRICAS ANALÍTICAS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 print:grid-cols-5">
         <MetricCard title="Faturamento Bruto" value={`R$ ${metrics.faturamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`} icon="trending_up" color="text-emerald-500" />
         <MetricCard title="Lucro Líquido PDV" value={`R$ ${metrics.lucroBruto.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`} icon="account_balance_wallet" color="text-primary" />
         <MetricCard title="Markup Médio" value={`${metrics.markup.toFixed(1)}%`} icon="percent" color="text-amber-500" />
         <MetricCard title="Ticket Médio" value={`R$ ${metrics.ticketMedio.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`} icon="receipt_long" color="text-indigo-400" />
         <MetricCard title="Total de Vendas" value={metrics.operacoes.toString()} icon="shopping_bag" color="text-rose-400" />
      </div>

      {/* FILTROS DE PESQUISA REFINADA */}
      <div className="bg-[#1e293b]/50 p-5 rounded-[2.5rem] border border-slate-800 flex flex-wrap items-center gap-4 print:hidden">
         {isAdmin && (
           <div className="flex flex-col gap-1.5">
             <label className="text-[9px] font-black text-slate-500 uppercase px-2">Filtrar por Unidade</label>
             <select value={filterStore} onChange={e => setFilterStore(e.target.value)} className="h-11 bg-slate-900/80 border-none rounded-xl px-4 text-[10px] font-black uppercase text-slate-300 min-w-[180px] outline-none focus:ring-2 focus:ring-primary/20">
                <option>TODAS LOJAS</option>
                {establishments.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
             </select>
           </div>
         )}
         <div className="flex flex-col gap-1.5 flex-1">
           <label className="text-[9px] font-black text-slate-500 uppercase px-2">Pesquisa de Texto (Cliente / Doc)</label>
           <input value={filterCustomer} onChange={e => setFilterCustomer(e.target.value)} placeholder="NOME, CPF OU ID..." className="w-full h-11 bg-slate-900/80 border-none rounded-xl px-4 text-[10px] font-black uppercase text-white outline-none focus:ring-2 focus:ring-primary/40 transition-all" />
         </div>
         <div className="flex flex-col gap-1.5">
           <label className="text-[9px] font-black text-slate-500 uppercase px-2">Forma Pagt.</label>
           <select value={filterPayment} onChange={e => setFilterPayment(e.target.value)} className="h-11 bg-slate-900/80 border-none rounded-xl px-4 text-[10px] font-black uppercase text-slate-300 min-w-[180px] outline-none focus:ring-2 focus:ring-primary/20">
              <option>TODOS PAGTOS</option>
              {['Dinheiro', 'Pix', 'Debito', 'Credito'].map(m => <option key={m}>{m}</option>)}
           </select>
         </div>
      </div>

      {/* TABELA DE DADOS RESULTANTES */}
      <div className="bg-[#1e293b] rounded-[3rem] border border-slate-800 overflow-hidden shadow-2xl print:border-none">
         <table className="w-full text-left">
            <thead>
               <tr className="bg-slate-800/80 border-b border-slate-700">
                  {getTableHeaders().map((h, i) => (
                    <th key={i} className={`px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest ${i >= 4 ? 'text-right' : ''}`}>{h}</th>
                  ))}
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/50">
               {displayData.map((row: any, idx: number) => (
                 <tr key={idx} className="hover:bg-slate-800/40 transition-all group">
                    <td className="px-8 py-5 text-xs text-slate-500 font-mono">{row.col1}</td>
                    <td className="px-8 py-5 text-xs text-primary font-black uppercase">{row.col2}</td>
                    <td className="px-8 py-5 text-xs text-slate-200 font-bold uppercase truncate max-w-[250px]">{row.col3}</td>
                    <td className="px-8 py-5 text-[10px] text-slate-400 font-black uppercase">{row.col4}</td>
                    <td className="px-8 py-5 text-right font-black">
                       {reportType.includes('vendedor') || reportType.includes('mes_ano') ? (
                          <span className="text-emerald-500 text-[11px] tabular-nums font-black">{row.extra}</span>
                       ) : reportType.includes('produto') || reportType === 'margem_bruta' || reportType === 'por_servico' ? (
                          <div className="flex flex-col">
                             <span className={`text-[11px] tabular-nums ${row.profit > 0 ? 'text-emerald-500' : 'text-rose-500'}`}>R$ {row.profit?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                             <span className="text-[9px] text-slate-500 font-bold">{row.margin?.toFixed(1)}% margem</span>
                          </div>
                       ) : (
                          <span className="text-slate-400 text-[10px] tabular-nums uppercase">{row.extra || row.col5 || '---'}</span>
                       )}
                    </td>
                    <td className="px-8 py-5 text-right text-sm font-black text-white tabular-nums">
                       R$ {row.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </td>
                 </tr>
               ))}
               {displayData.length === 0 && (
                 <tr><td colSpan={6} className="px-8 py-32 text-center text-[11px] font-black uppercase text-slate-600 tracking-[0.3em]">Nenhum registro analítico encontrado no período</td></tr>
               )}
            </tbody>
            {displayData.length > 0 && (
              <tfoot className="bg-slate-800/30 border-t border-slate-700">
                 <tr>
                    <td colSpan={5} className="px-8 py-8 text-[11px] font-black uppercase text-slate-400 text-right tracking-widest">Total Consolidado do Período:</td>
                    <td className="px-8 py-8 text-right text-2xl font-black text-primary tabular-nums">R$ {metrics.faturamento.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                 </tr>
              </tfoot>
            )}
         </table>
      </div>

      <style>{`
        @media print {
          body { background: white !important; color: black !important; }
          .print\\:hidden { display: none !important; }
          table { border: 1px solid #e2e8f0 !important; width: 100% !important; }
          th { background: #f8fafc !important; color: #64748b !important; border-bottom: 2px solid #e2e8f0 !important; }
          td { border-bottom: 1px solid #f1f5f9 !important; padding: 10px !important; color: black !important; }
          .text-white, .text-slate-100, .text-slate-200 { color: black !important; }
          .text-primary { color: #136dec !important; }
          .bg-[#0f172a], .bg-[#1e293b] { background: white !important; }
        }
      `}</style>
    </div>
  );
};

const MetricCard = ({ title, value, icon, color }: any) => (
  <div className="bg-[#1e293b] p-6 rounded-[2.5rem] border border-slate-800 shadow-xl flex flex-col gap-4 group hover:border-primary/50 transition-all print:border-slate-200">
     <div className={`size-12 rounded-2xl bg-slate-800/50 ${color} flex items-center justify-center shadow-inner`}>
        <span className="material-symbols-outlined text-2xl">{icon}</span>
     </div>
     <div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">{title}</p>
        <h3 className="text-2xl font-black text-white print:text-black tabular-nums tracking-tighter">{value}</h3>
     </div>
  </div>
);

export default Reports;
