
import React, { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { Transaction, UserRole, User, ServiceOrderStatus } from '../types';
import { useLocation } from 'react-router-dom';

const Reports: React.FC = () => {
  const { transactions, users, currentUser, establishments, serviceOrders, products } = useApp();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const reportType = query.get('type') || 'evolucao';

  // Intervalo padrão: últimos 30 dias
  const todayStr = new Date().toISOString().split('T')[0];
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split('T')[0];

  const [startDate, setStartDate] = useState(thirtyDaysAgoStr);
  const [endDate, setEndDate] = useState(todayStr);
  
  // Estados de Filtro Granulares
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStore, setFilterStore] = useState('Todas');
  const [filterCustomer, setFilterCustomer] = useState('');
  const [filterVendor, setFilterVendor] = useState('');
  const [filterCategory, setFilterCategory] = useState('Todas');
  const [filterPayment, setFilterPayment] = useState('Todos');

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const currentStore = establishments.find(e => e.id === currentUser?.storeId);
  const currentStoreName = currentStore?.name || '';

  const categories = useMemo(() => {
    return ['Todas', ...Array.from(new Set(products.map(p => p.category)))];
  }, [products]);

  const availableStores = useMemo(() => {
    return ['Todas', ...Array.from(new Set(establishments.map(e => e.name)))];
  }, [establishments]);

  // Filtro base de transações
  const periodSales = useMemo(() => {
    return (transactions || []).filter(t => {
      // 1. Filtro de Segurança/Escopo de Unidade
      const belongsToStoreScope = isAdmin || t.store === currentStoreName;
      if (!belongsToStoreScope) return false;

      // 2. Filtro de Tipo (Apenas Vendas/Serviços que geram receita)
      const isCorrectType = t.type === 'INCOME' && (t.category === 'Venda' || t.category === 'Serviço');
      if (!isCorrectType) return false;

      // 3. Filtro de Intervalo de Datas
      const inRange = t.date >= startDate && t.date <= endDate;
      if (!inRange) return false;
      
      // 4. Filtro por Loja Específica
      const matchesStore = filterStore === 'Todas' || t.store === filterStore;
      if (!matchesStore) return false;

      // 5. Filtro por Forma de Pagamento
      const matchesPayment = filterPayment === 'Todos' || t.method === filterPayment;
      if (!matchesPayment) return false;
      
      // 6. Filtro por Cliente
      const targetCustomer = filterCustomer || searchTerm;
      const matchesCustomer = targetCustomer === '' || 
        (t.client?.toLowerCase().includes(targetCustomer.toLowerCase()));
      if (!matchesCustomer) return false;

      // 7. Filtro por Vendedor (Novo)
      if (filterVendor !== '') {
        const vName = users.find(u => u.id === t.vendorId)?.name || 'Balcão / Sistema';
        if (!vName.toLowerCase().includes(filterVendor.toLowerCase())) return false;
      }

      return true;
    });
  }, [transactions, startDate, endDate, isAdmin, currentStoreName, filterStore, filterPayment, filterCustomer, searchTerm, filterVendor, users]);

  // --- LÓGICAS DE AGRUPAMENTO ---

  const dailyData = useMemo(() => {
    const map: Record<string, { label: string, total: number, count: number }> = {};
    periodSales.forEach(s => {
      if (!map[s.date]) map[s.date] = { label: s.date, total: 0, count: 0 };
      map[s.date].total += s.value;
      map[s.date].count += 1;
    });
    return Object.values(map).sort((a, b) => b.label.localeCompare(a.label));
  }, [periodSales]);

  const yearlyData = useMemo(() => {
    const map: Record<string, { label: string, total: number, count: number }> = {};
    periodSales.forEach(s => {
      const year = s.date.substring(0, 4);
      if (!map[year]) map[year] = { label: year, total: 0, count: 0 };
      map[year].total += s.value;
      map[year].count += 1;
    });
    return Object.values(map).sort((a, b) => b.label.localeCompare(a.label));
  }, [periodSales]);

  const monthlyData = useMemo(() => {
    const map: Record<string, { label: string, total: number, count: number }> = {};
    periodSales.forEach(s => {
      const monthYear = s.date.substring(0, 7);
      if (!map[monthYear]) map[monthYear] = { label: monthYear, total: 0, count: 0 };
      map[monthYear].total += s.value;
      map[monthYear].count += 1;
    });
    return Object.values(map).sort((a, b) => b.label.localeCompare(a.label));
  }, [periodSales]);

  const customerRanking = useMemo(() => {
    const map: Record<string, { name: string, total: number, count: number, lastSale: string }> = {};
    periodSales.forEach(s => {
      const cid = s.clientId || 'avulso';
      const cname = s.client || 'Consumidor Final';
      if (!map[cid]) map[cid] = { name: cname, total: 0, count: 0, lastSale: s.date };
      map[cid].total += s.value;
      map[cid].count += 1;
      if (s.date > map[cid].lastSale) map[cid].lastSale = s.date;
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [periodSales]);

  const vendorStats = useMemo(() => {
    const map: Record<string, { name: string, total: number, count: number, items: number }> = {};
    periodSales.forEach(s => {
      const vid = s.vendorId || 'balcao';
      const vname = users.find(u => u.id === s.vendorId)?.name || 'Balcão / Sistema';
      
      if (!map[vid]) map[vid] = { name: vname, total: 0, count: 0, items: 0 };
      map[vid].total += s.value;
      map[vid].count += 1;
      if (s.items && Array.isArray(s.items)) {
        s.items.forEach(i => map[vid].items += i.quantity);
      }
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [periodSales, users]);

  const productsStats = useMemo(() => {
    const map: Record<string, { name: string, sku: string, qty: number, total: number, cost: number, category: string }> = {};
    periodSales.forEach(s => {
      if (s.items && Array.isArray(s.items)) {
        s.items.forEach(i => {
          const matchesCategory = filterCategory === 'Todas' || i.category === filterCategory;
          const matchesSearch = searchTerm === '' || 
            i.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
            (i.sku && i.sku.toLowerCase().includes(searchTerm.toLowerCase()));

          if (!matchesCategory || !matchesSearch) return;

          const key = i.sku || i.name || i.id;
          if (!map[key]) map[key] = { name: i.name, sku: i.sku || 'N/A', qty: 0, total: 0, cost: 0, category: i.category };
          map[key].qty += i.quantity;
          map[key].total += (i.quantity * i.salePrice);
          map[key].cost += (i.quantity * (i.costPrice || 0));
        });
      }
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [periodSales, filterCategory, searchTerm]);

  const futureDeliveries = useMemo(() => {
    return (serviceOrders || []).filter(os => {
      const belongsToStore = isAdmin || os.store === currentStoreName;
      const isPending = os.status !== ServiceOrderStatus.FINISHED && os.status !== ServiceOrderStatus.CANCELLED;
      const inRange = os.date >= startDate && os.date <= endDate;
      const matchesSearch = searchTerm === '' || os.customerName.toLowerCase().includes(searchTerm.toLowerCase()) || os.id.toLowerCase().includes(searchTerm.toLowerCase());
      return belongsToStore && isPending && inRange && matchesSearch;
    });
  }, [serviceOrders, isAdmin, currentStoreName, startDate, endDate, searchTerm]);

  const unitSalesStats = useMemo(() => {
    const unitMap: Record<string, { storeName: string; total: number; count: number; vendors: Record<string, { name: string; total: number; count: number }> }> = {};
    periodSales.forEach(s => {
      const storeName = s.store || 'Unidade Indefinida';
      if (!unitMap[storeName]) unitMap[storeName] = { storeName, total: 0, count: 0, vendors: {} };
      unitMap[storeName].total += s.value;
      unitMap[storeName].count += 1;
      const vendorId = s.vendorId || 'sem-vendedor';
      const vendorName = users.find(u => u.id === s.vendorId)?.name || 'Balcão / Sistema';
      if (!unitMap[storeName].vendors[vendorId]) unitMap[storeName].vendors[vendorId] = { name: vendorName, total: 0, count: 0 };
      unitMap[storeName].vendors[vendorId].total += s.value;
      unitMap[storeName].vendors[vendorId].count += 1;
    });
    return Object.values(unitMap).sort((a, b) => b.total - a.total);
  }, [periodSales, users]);

  // KPI Dinâmicos
  const totalRevenue = periodSales.reduce((acc, t) => acc + t.value, 0);
  const globalAvgTicket = periodSales.length > 0 ? totalRevenue / periodSales.length : 0;

  const getReportTitle = (type: string) => {
    const titles: Record<string, string> = {
      evolucao: 'Evolução de Vendas Diária',
      vendas_unidade: 'Vendas por Unidade e Equipe',
      entrega_futura: 'Entrega Futura / OS Pendentes',
      por_ano: 'Consolidado de Vendas por Ano',
      por_cliente: 'Ranking de Compras por Cliente',
      por_vendas: 'Relatório Analítico de Vendas',
      por_vendedor: 'Desempenho da Equipe de Vendas',
      ticket_vendedor: 'Ticket Médio por Vendedor',
      ticket_periodo: 'Ticket Médio por Mês/Ano',
      por_produto: 'Vendas por Produto (Curva ABC)',
      margem_bruta: 'Relatório de Lucratividade / Margem',
      por_servico: 'Relatório de Serviços Realizados'
    };
    return titles[type] || 'Relatório de Gestão';
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-700 pb-20">
      <style>{`
        @media print {
          @page { margin: 1cm; size: A4; }
          body * { visibility: hidden !important; }
          #report-print-container, #report-print-container * { visibility: visible !important; }
          #report-print-container { 
            position: absolute !important; 
            left: 0 !important; 
            top: 0 !important; 
            width: 100% !important; 
            margin: 0 !important; 
            padding: 0 !important; 
            display: block !important;
            background: white !important;
            color: black !important;
          }
          .no-print, aside, header, nav, button, input[type="date"], .filter-bar, .header-filter-row { display: none !important; }
          .rounded-[3rem], .rounded-[2rem], .rounded-3xl { border-radius: 0 !important; }
          .shadow-sm, .shadow-xl, .shadow-2xl, .shadow-lg { box-shadow: none !important; border: 1px solid #eee !important; }
          table { width: 100% !important; border-collapse: collapse !important; table-layout: auto !important; }
          th { background-color: #f8fafc !important; color: #475569 !important; padding: 10px 6px !important; font-size: 8pt !important; border-bottom: 2px solid #e2e8f0 !important; text-transform: uppercase; font-weight: 800; }
          td { padding: 8px 6px !important; font-size: 8pt !important; border-bottom: 1px solid #f1f5f9 !important; font-weight: 600; }
          .text-primary { color: #136dec !important; }
          .kpi-grid { display: grid !important; grid-template-columns: repeat(4, 1fr) !important; gap: 8px !important; margin-bottom: 20px !important; }
          tr { page-break-inside: avoid !important; }
        }
      `}</style>

      <div id="report-print-container" className="space-y-8">
        {/* CABEÇALHO */}
        <div className="flex flex-col md:flex-row justify-between items-start gap-4">
          <div>
            <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase leading-none">{getReportTitle(reportType)}</h2>
            <div className="mt-4 flex flex-wrap gap-4 text-[10px] font-black uppercase text-slate-400 tracking-[0.1em]">
              <span>Período: {startDate} até {endDate}</span>
              <span className="hidden md:inline">•</span>
              <span>Unidade: {isAdmin ? 'ADMINISTRATIVO GLOBAL' : currentStoreName}</span>
            </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-2 no-print bg-white dark:bg-slate-800 p-2 rounded-3xl shadow-sm border border-slate-200 dark:border-slate-700">
             <div className="flex items-center gap-2 px-3">
                <span className="material-symbols-outlined text-slate-400 text-sm">calendar_month</span>
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase focus:ring-0 p-1" />
             </div>
             <div className="h-4 w-px bg-slate-200 dark:bg-slate-700 mx-1"></div>
             <div className="flex items-center gap-2 px-3">
                <span className="material-symbols-outlined text-slate-400 text-sm">event</span>
                <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase focus:ring-0 p-1" />
             </div>
             <button onClick={() => window.print()} className="ml-2 px-6 py-2.5 bg-primary text-white text-[10px] font-black uppercase rounded-xl flex items-center gap-2 shadow-lg shadow-primary/20 hover:scale-105 transition-all">
               <span className="material-symbols-outlined text-sm">print</span> Imprimir Relatório
             </button>
          </div>
        </div>

        {/* KPI GRID */}
        <div className="kpi-grid grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <ReportKPICard title="Ticket Médio" value={`R$ ${globalAvgTicket.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon="payments" color="text-primary" />
          <ReportKPICard title="Faturamento Bruto" value={`R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon="trending_up" color="text-emerald-500" />
          <ReportKPICard title="Operações" value={periodSales.length.toString()} icon="shopping_bag" color="text-amber-500" />
          <ReportKPICard title="Itens/Clientes" value={(reportType === 'por_produto' ? productsStats.length : customerRanking.length).toString()} icon="layers" color="text-blue-500" />
        </div>

        {/* TABELA DE DADOS DINÂMICA */}
        <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden min-h-[400px]">
           
           {/* 1. RELATÓRIO: VENDAS POR UNIDADE */}
           {reportType === 'vendas_unidade' && (
              <div className="p-8 space-y-10">
                {unitSalesStats.map((unit, i) => (
                  <div key={i} className="border border-slate-100 dark:border-slate-800 rounded-[2rem] overflow-hidden">
                    <div className="bg-slate-50 dark:bg-slate-800/40 p-6 flex justify-between items-center border-b">
                      <div>
                        <h4 className="text-lg font-black uppercase">{unit.storeName}</h4>
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{unit.count} Operações</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black text-primary tabular-nums">R$ {unit.total.toLocaleString('pt-BR')}</p>
                      </div>
                    </div>
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-white dark:bg-slate-900 border-b">
                           <th className="px-8 py-4">Vendedor</th>
                           <th className="px-8 py-4 text-center">Vendas</th>
                           <th className="px-8 py-4 text-right">Total (R$)</th>
                           <th className="px-8 py-4 text-right">Part %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {(Object.values(unit.vendors) as any[]).sort((a,b) => b.total - a.total).map((v, idx) => (
                          <tr key={idx} className="font-bold">
                            <td className="px-8 py-4 uppercase text-sm">{v.name}</td>
                            <td className="px-8 py-4 text-center tabular-nums">{v.count}</td>
                            <td className="px-8 py-4 text-right font-black tabular-nums">R$ {v.total.toLocaleString('pt-BR')}</td>
                            <td className="px-8 py-4 text-right text-primary tabular-nums">{((v.total / unit.total) * 100).toFixed(1)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))}
              </div>
           )}

           {/* 2. RELATÓRIOS TEMPORAIS */}
           {(reportType === 'evolucao' || reportType === 'por_ano' || reportType === 'ticket_periodo') && (
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr className="border-b">
                    <th className="px-8 py-5">{reportType === 'por_ano' ? 'Ano' : reportType === 'ticket_periodo' ? 'Mês/Ano' : 'Data'}</th>
                    <th className="px-8 py-5 text-center">Vendas</th>
                    <th className="px-8 py-5 text-right">Faturamento Bruto</th>
                    <th className="px-8 py-5 text-right">Ticket Médio</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {(reportType === 'por_ano' ? yearlyData : reportType === 'ticket_periodo' ? monthlyData : dailyData).map((d, i) => (
                    <tr key={i} className="font-bold hover:bg-slate-50 transition-all">
                      <td className="px-8 py-5 uppercase text-sm">{d.label}</td>
                      <td className="px-8 py-5 text-center tabular-nums">{d.count}</td>
                      <td className="px-8 py-5 text-right font-black tabular-nums">R$ {d.total.toLocaleString('pt-BR')}</td>
                      <td className="px-8 py-5 text-right text-primary font-black tabular-nums">R$ {(d.total / d.count).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
           )}

           {/* 3. RELATÓRIO: POR CLIENTE */}
           {reportType === 'por_cliente' && (
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b">
                   <tr className="no-print header-filter-row bg-slate-100/50 dark:bg-slate-800">
                      <th className="px-8 py-2">
                         <input 
                           value={searchTerm} 
                           onChange={e => setSearchTerm(e.target.value)} 
                           placeholder="Filtrar Cliente..." 
                           className="w-full h-8 bg-white dark:bg-slate-700 border-none rounded-lg text-[9px] font-black uppercase px-3 focus:ring-2 focus:ring-primary/20 transition-all" 
                         />
                      </th>
                      <th className="px-8 py-2 text-center" colSpan={3}></th>
                   </tr>
                  <tr>
                    <th className="px-8 py-5">Cliente</th>
                    <th className="px-8 py-5 text-center">Frequência</th>
                    <th className="px-8 py-5 text-right">Última Compra</th>
                    <th className="px-8 py-5 text-right">Total Acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {customerRanking.map((c, i) => (
                    <tr key={i} className="font-bold hover:bg-slate-50 transition-all">
                      <td className="px-8 py-5 uppercase">{c.name}</td>
                      <td className="px-8 py-5 text-center tabular-nums">{c.count}x</td>
                      <td className="px-8 py-5 text-right text-slate-400 tabular-nums">{c.lastSale}</td>
                      <td className="px-8 py-5 text-right text-primary font-black tabular-nums">R$ {c.total.toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
           )}

           {/* 4. RELATÓRIO: ANALÍTICO DE VENDAS */}
           {reportType === 'por_vendas' && (
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b">
                  <tr className="no-print header-filter-row bg-slate-100/50 dark:bg-slate-800">
                    <th className="px-6 py-2"></th>
                    <th className="px-6 py-2">
                       <select 
                         value={filterStore} 
                         onChange={e => setFilterStore(e.target.value)}
                         className="w-full h-8 bg-white dark:bg-slate-700 border-none rounded-lg text-[9px] font-black uppercase px-2"
                       >
                         {availableStores.map(s => <option key={s} value={s}>{s === 'Todas' ? 'Todas Lojas' : s}</option>)}
                       </select>
                    </th>
                    <th className="px-6 py-2">
                       <input 
                         value={filterCustomer} 
                         onChange={e => setFilterCustomer(e.target.value)}
                         placeholder="Buscar Cliente..." 
                         className="w-full h-8 bg-white dark:bg-slate-700 border-none rounded-lg text-[9px] font-black uppercase px-3"
                       />
                    </th>
                    <th className="px-6 py-2">
                       <select 
                         value={filterPayment} 
                         onChange={e => setFilterPayment(e.target.value)}
                         className="w-full h-8 bg-white dark:bg-slate-700 border-none rounded-lg text-[9px] font-black uppercase px-2"
                       >
                         <option value="Todos">Todos Pagtos</option>
                         <option value="Dinheiro">Dinheiro</option>
                         <option value="Pix">Pix</option>
                         <option value="Debito">Débito</option>
                         <option value="Credito">Crédito</option>
                       </select>
                    </th>
                    <th className="px-6 py-2 text-right">
                       <button onClick={() => { setFilterStore('Todas'); setFilterCustomer(''); setFilterPayment('Todos'); }} className="text-[8px] font-black uppercase text-primary hover:underline">Limpar</button>
                    </th>
                  </tr>
                  <tr>
                    <th className="px-6 py-4">Data</th>
                    <th className="px-6 py-4">Loja/Unidade</th>
                    <th className="px-6 py-4">Cliente</th>
                    <th className="px-6 py-4 text-center">Pagamento</th>
                    <th className="px-6 py-4 text-right">Valor Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {periodSales.map((s, i) => (
                    <tr key={i} className="font-bold hover:bg-slate-50">
                      <td className="px-6 py-4 text-xs tabular-nums">{s.date}</td>
                      <td className="px-6 py-4 uppercase text-[10px] text-primary">{s.store || 'Indefinida'}</td>
                      <td className="px-6 py-4 uppercase text-xs truncate max-w-[150px]">{s.client || 'Consumidor'}</td>
                      <td className="px-6 py-4 text-center text-[10px] uppercase text-slate-400">{s.method}</td>
                      <td className="px-6 py-4 text-right font-black tabular-nums text-sm">R$ {s.value.toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
           )}

           {/* 5. RELATÓRIO: VENDEDORES (DESEMPENHO E TICKET MÉDIO) */}
           {(reportType === 'por_vendedor' || reportType === 'ticket_vendedor') && (
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b">
                   <tr className="no-print header-filter-row bg-slate-100/50 dark:bg-slate-800">
                      <th className="px-8 py-2">
                         <input 
                           value={filterVendor} 
                           onChange={e => setFilterVendor(e.target.value)}
                           placeholder="Buscar Vendedor..." 
                           className="w-full h-8 bg-white dark:bg-slate-700 border-none rounded-lg text-[9px] font-black uppercase px-3 focus:ring-2 focus:ring-primary/20 transition-all"
                         />
                      </th>
                      <th className="px-8 py-2" colSpan={4}></th>
                   </tr>
                  <tr>
                    <th className="px-8 py-5">Vendedor</th>
                    <th className="px-8 py-5 text-center">Qtd. Vendas</th>
                    <th className="px-8 py-5 text-center">Itens Vendidos</th>
                    <th className="px-8 py-5 text-right">Ticket Médio</th>
                    <th className="px-8 py-5 text-right">Total Faturado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {vendorStats.map((v, i) => (
                    <tr key={i} className="font-bold hover:bg-slate-50 transition-all">
                      <td className="px-8 py-5 uppercase">{v.name}</td>
                      <td className="px-8 py-5 text-center tabular-nums">{v.count}</td>
                      <td className="px-8 py-5 text-center tabular-nums">{v.items}</td>
                      <td className="px-8 py-5 text-right text-amber-500 font-black tabular-nums">R$ {(v.total / (v.count || 1)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                      <td className="px-8 py-5 text-right text-primary font-black tabular-nums">R$ {v.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
           )}

           {/* 6. RELATÓRIO: PRODUTOS / MARGEM BRUTA */}
           {(reportType === 'por_produto' || reportType === 'margem_bruta' || reportType === 'por_servico') && (
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b">
                  <tr className="no-print header-filter-row bg-slate-100/50 dark:bg-slate-800">
                    <th className="px-8 py-2">
                       <input 
                         value={searchTerm} 
                         onChange={e => setSearchTerm(e.target.value)}
                         placeholder="Filtrar por nome ou SKU..." 
                         className="w-full h-8 bg-white dark:bg-slate-700 border-none rounded-lg text-[9px] font-black uppercase px-3"
                       />
                    </th>
                    <th className="px-8 py-2">
                       <select 
                         value={filterCategory} 
                         onChange={e => setFilterCategory(e.target.value)}
                         className="w-full h-8 bg-white dark:bg-slate-700 border-none rounded-lg text-[9px] font-black uppercase px-2"
                       >
                         {categories.map(c => <option key={c} value={c}>{c}</option>)}
                       </select>
                    </th>
                    <th className="px-8 py-2" colSpan={reportType === 'margem_bruta' ? 3 : 1}></th>
                  </tr>
                  <tr>
                    <th className="px-8 py-5">Produto / Mão de Obra</th>
                    <th className="px-8 py-5 text-center">Qtd. Vendida</th>
                    <th className="px-8 py-5 text-right">Total Venda (R$)</th>
                    {(reportType === 'margem_bruta' || reportType === 'por_servico') && <th className="px-8 py-5 text-right">Lucro Bruto</th>}
                    {reportType === 'margem_bruta' && <th className="px-8 py-5 text-right">Margem %</th>}
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {productsStats.filter(p => {
                    if (reportType === 'por_servico') return p.sku.startsWith('SRV') || p.name.toLowerCase().includes('serviço');
                    return true;
                  }).map((p, i) => (
                    <tr key={i} className="font-bold hover:bg-slate-50 transition-all">
                      <td className="px-8 py-5 uppercase">
                         <p>{p.name}</p>
                         <p className="text-[9px] text-slate-400 font-mono tracking-tighter">SKU: {p.sku} • {p.category}</p>
                      </td>
                      <td className="px-8 py-5 text-center tabular-nums">{p.qty}</td>
                      <td className="px-8 py-5 text-right font-black tabular-nums">R$ {p.total.toLocaleString('pt-BR')}</td>
                      {(reportType === 'margem_bruta' || reportType === 'por_servico') && (
                        <td className="px-8 py-5 text-right text-emerald-500 font-black tabular-nums">R$ {(p.total - p.cost).toLocaleString('pt-BR')}</td>
                      )}
                      {reportType === 'margem_bruta' && (
                        <td className="px-8 py-5 text-right text-primary font-black tabular-nums">
                          {p.total > 0 ? (((p.total - p.cost) / p.total) * 100).toFixed(1) : '0'}%
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
           )}

           {/* 7. RELATÓRIO: ENTREGA FUTURA */}
           {reportType === 'entrega_futura' && (
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 border-b">
                   <tr className="no-print header-filter-row bg-slate-100/50 dark:bg-slate-800">
                      <th className="px-8 py-2"></th>
                      <th className="px-8 py-2"></th>
                      <th className="px-8 py-2">
                         <input 
                           value={searchTerm} 
                           onChange={e => setSearchTerm(e.target.value)}
                           placeholder="Filtrar por Cliente..." 
                           className="w-full h-8 bg-white dark:bg-slate-700 border-none rounded-lg text-[9px] font-black uppercase px-3"
                         />
                      </th>
                      <th className="px-8 py-2" colSpan={2}></th>
                   </tr>
                  <tr>
                    <th className="px-8 py-5">ID Ordem</th>
                    <th className="px-8 py-5">Abertura</th>
                    <th className="px-8 py-5">Cliente</th>
                    <th className="px-8 py-5 text-center">Status</th>
                    <th className="px-8 py-5 text-right">Valor Estimado</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {futureDeliveries.map((os, i) => (
                    <tr key={i} className="font-bold hover:bg-slate-50">
                      <td className="px-8 py-5 font-mono text-primary">{os.id}</td>
                      <td className="px-8 py-5 tabular-nums text-slate-400">{os.date}</td>
                      <td className="px-8 py-5 uppercase truncate max-w-[200px]">{os.customerName}</td>
                      <td className="px-8 py-5 text-center"><span className="bg-amber-100 text-amber-600 px-3 py-1 rounded-lg text-[9px] uppercase">{os.status}</span></td>
                      <td className="px-8 py-5 text-right text-primary font-black tabular-nums">R$ {os.totalValue.toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
           )}

           {(periodSales.length === 0) && (
              <div className="py-32 text-center no-print">
                 <span className="material-symbols-outlined text-8xl text-slate-100 dark:text-slate-800">query_stats</span>
                 <p className="uppercase font-black text-xs text-slate-300 tracking-[0.4em] mt-4">Nenhum dado localizado para os filtros atuais</p>
              </div>
           )}
        </div>

        {/* RODAPÉ DE IMPRESSÃO */}
        <div className="hidden print:block border-t border-slate-900 pt-8 mt-10 text-[8px] uppercase font-black opacity-30 text-center">
           Relatório gerado em {new Date().toLocaleString('pt-BR')} • Tem Acessorios ERP • Unidade {isAdmin ? 'Global' : currentStoreName}
        </div>
      </div>
    </div>
  );
};

const ReportKPICard: React.FC<{ title: string; value: string; icon: string; color: string }> = ({ title, value, icon, color }) => (
  <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm group hover:border-primary/50 transition-all">
    <div className="flex justify-between items-start mb-6"><div className={`p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 ${color} shadow-inner`}><span className="material-symbols-outlined text-3xl">{icon}</span></div></div>
    <p className="text-[10px] font-black text-slate-400 uppercase mb-1 tracking-widest">{title}</p>
    <h4 className="text-2xl font-black tabular-nums">{value}</h4>
  </div>
);

export default Reports;
