
import React, { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { Transaction, UserRole } from '../types';
import { useLocation, useNavigate } from 'react-router-dom';

const Reports: React.FC = () => {
  const { transactions, users, currentUser, establishments, products } = useApp();
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

  // Base de dados filtrada globalmente
  const baseData = useMemo(() => {
    return transactions.filter(t => {
      const matchesDate = t.date >= startDate && t.date <= endDate;
      const belongs = isAdmin || t.store === currentStoreName;
      const matchesStore = filterStore === 'TODAS LOJAS' || t.store === filterStore;
      return t.type === 'INCOME' && matchesDate && belongs && matchesStore;
    });
  }, [transactions, startDate, endDate, isAdmin, currentStoreName, filterStore]);

  // Definição dos Modelos de Relatórios
  const reportOptions = [
    { id: 'evolucao', label: 'Evolução de Vendas', icon: 'trending_up', color: 'bg-blue-500' },
    { id: 'por_unidade', label: 'Vendas por Unidade', icon: 'store', color: 'bg-emerald-500' },
    { id: 'por_produto', label: 'Vendas por Produto', icon: 'inventory_2', color: 'bg-amber-500' },
    { id: 'margem_bruta', label: 'Margem Bruta / Lucro', icon: 'payments', color: 'bg-rose-500' },
    { id: 'ticket_vendedor', label: 'Ticket Médio / Vendedor', icon: 'badge', color: 'bg-indigo-500' },
    { id: 'conferencia_caixa', label: 'Conferência de Caixa', icon: 'account_balance_wallet', color: 'bg-emerald-600' },
    { id: 'por_cliente', label: 'Ranking de Clientes', icon: 'groups', color: 'bg-cyan-500' },
    { id: 'por_servico', label: 'Serviços Prestados', icon: 'build', color: 'bg-orange-500' },
    { id: 'ticket_medio', label: 'Ticket Médio / Loja', icon: 'analytics', color: 'bg-purple-500' },
    { id: 'giro_estoque', label: 'Giro de Estoque', icon: 'sync', color: 'bg-teal-500' },
    { id: 'por_vendas', label: 'Listagem Detalhada', icon: 'list_alt', color: 'bg-slate-500' },
  ];

  // Motores de cálculo específicos para cada tipo de relatório
  const displayData = useMemo(() => {
    const groups: Record<string, any> = {};

    switch (reportType) {
      case 'evolucao':
      case 'por_vendas':
        return baseData.map(t => ({
          col1: t.date.split('-').reverse().join('/'), 
          col2: t.store, 
          col3: t.client || 'Consumidor Final', 
          col4: `${t.items?.length || 0} itens`, 
          col5: t.method, 
          value: t.value
        }));

      case 'conferencia_caixa':
        return baseData.map(t => ({
          col1: t.date.split('-').reverse().join('/'), 
          col2: t.client || 'Consumidor Final', 
          col3: t.method || 'Dinheiro', 
          col4: t.installments ? `${t.installments}x` : '1x', 
          col5: 'PAGO', 
          value: t.value
        }));

      case 'por_produto':
      case 'margem_bruta':
      case 'giro_estoque':
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
          ...g, 
          col4: `${g.qty} UN`, 
          value: g.revenue, 
          profit: g.revenue - g.cost, 
          col5: g.revenue > 0 ? `${(((g.revenue - g.cost) / g.revenue) * 100).toFixed(1)}%` : '0%'
        })).sort((a, b) => b.value - a.value);

      case 'ticket_vendedor':
        baseData.forEach(t => {
          const v = users.find(u => u.id === t.vendorId);
          const key = t.vendorId || 'BALCAO';
          if (!groups[key]) groups[key] = { col1: v?.name || 'BALCÃO', col2: t.store, col3: v?.role || 'VENDEDOR', count: 0, value: 0 };
          groups[key].count += 1;
          groups[key].value += t.value;
        });
        return Object.values(groups).map(g => ({ 
          ...g, 
          col4: `${g.count} Vendas`, 
          col5: `T.M. R$ ${(g.value / g.count).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
          value: g.value 
        })).sort((a, b) => b.value - a.value);

      case 'por_cliente':
        baseData.forEach(t => {
          const key = t.clientId || t.client || 'FINAL';
          if (!groups[key]) groups[key] = { col1: 'CLIENTE', col2: t.store, col3: t.client || 'CONSUMIDOR FINAL', count: 0, value: 0 };
          groups[key].count += 1;
          groups[key].value += t.value;
        });
        return Object.values(groups).map(g => ({ ...g, col4: `${g.count} Compras`, col5: 'FIDELIZADO', value: g.value })).sort((a, b) => b.value - a.value);

      case 'por_servico':
        baseData.forEach(t => {
          t.items?.forEach(item => {
            if (!item.isService) return;
            const key = item.id;
            if (!groups[key]) groups[key] = { col1: item.sku, col2: 'SERVIÇO', col3: item.name, qty: 0, value: 0 };
            groups[key].qty += item.quantity;
            groups[key].value += (item.salePrice * item.quantity);
          });
        });
        return Object.values(groups).map(g => ({ ...g, col4: `${g.qty} Execuções`, col5: 'SERVIÇO', value: g.value }));

      case 'ticket_medio':
        const storeGroups: Record<string, any> = {};
        baseData.forEach(t => {
          if (!storeGroups[t.store]) storeGroups[t.store] = { col1: 'LOJA', col2: 'UNIDADE', col3: t.store, count: 0, value: 0 };
          storeGroups[t.store].count += 1;
          storeGroups[t.store].value += t.value;
        });
        return Object.values(storeGroups).map(g => ({ 
          ...g, 
          col4: `${g.count} Vendas`, 
          col5: `T.M. R$ ${(g.value / g.count).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`,
          value: g.value
        }));

      default:
        baseData.forEach(t => {
          const key = t.store;
          if (!groups[key]) groups[key] = { col1: 'UNIDADE', col2: 'LOJA', col3: key, count: 0, value: 0 };
          groups[key].count += 1;
          groups[key].value += t.value;
        });
        return Object.values(groups).map(g => ({ ...g, col4: `${g.count} Transações`, col5: 'OPERACIONAL', value: g.value }));
    }
  }, [baseData, reportType, users]);

  const totalRevenue = baseData.reduce((acc, t) => acc + t.value, 0);

  const getHeaders = () => {
    if (['por_produto', 'margem_bruta', 'giro_estoque', 'por_servico'].includes(reportType)) 
      return ['REF/SKU', 'CATEGORIA', 'DESCRIÇÃO ITEM', 'VOLUME', 'MARGEM/STATUS', 'TOTAL FATURADO'];
    if (reportType === 'ticket_vendedor') return ['VENDEDOR', 'UNIDADE', 'CARGO', 'VOL. VENDAS', 'TICKET MÉDIO', 'TOTAL VENDIDO'];
    if (reportType === 'conferencia_caixa') return ['DATA', 'NOME DA CLIENTE', 'FORMA PAGTO', 'PARCELAS', 'STATUS', 'VALOR'];
    if (reportType === 'por_cliente') return ['TIPO', 'ÚLT. UNIDADE', 'NOME CLIENTE', 'FREQUÊNCIA', 'STATUS', 'TOTAL GASTO'];
    if (reportType === 'ticket_medio') return ['TIPO', 'CATEGORIA', 'UNIDADE', 'VOL. VENDAS', 'TICKET MÉDIO', 'TOTAL BRUTO'];
    return ['DATA', 'UNIDADE', 'IDENTIFICAÇÃO', 'DETALHE', 'MÉTODO', 'TOTAL'];
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 bg-[#0f172a] min-h-screen text-slate-100 print:bg-white print:text-black print:p-0">
      
      {/* HEADER DINÂMICO COM HUB TOGGLE */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 print:block">
        <div className="flex items-center gap-4">
          <button onClick={() => setShowHub(!showHub)} className="size-14 bg-white/10 hover:bg-primary text-white rounded-2xl flex items-center justify-center transition-all shadow-xl print:hidden">
             <span className="material-symbols-outlined text-3xl">{showHub ? 'close' : 'apps'}</span>
          </button>
          <div>
            <h2 className="text-4xl font-black uppercase tracking-tighter text-white print:text-black print:text-2xl">
              {reportOptions.find(o => o.id === reportType)?.label || 'Relatórios de Gestão'}
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-slate-600">Inteligência Comercial e Performance • {new Date().toLocaleDateString()}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 bg-slate-900/80 p-2 rounded-2xl border border-slate-800 shadow-2xl print:hidden">
           <div className="flex items-center px-4 border-r border-slate-800">
              <span className="material-symbols-outlined text-slate-500 mr-2 text-sm">calendar_month</span>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black text-white uppercase focus:ring-0" />
              <span className="text-slate-700 mx-2 font-black">ATÉ</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black text-white uppercase focus:ring-0" />
           </div>
           {isAdmin && (
             <select value={filterStore} onChange={e => setFilterStore(e.target.value)} className="bg-transparent border-none text-[10px] font-black text-primary uppercase focus:ring-0 pr-8">
                <option value="TODAS LOJAS">TODAS LOJAS</option>
                {establishments.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
             </select>
           )}
           <button onClick={() => window.print()} className="bg-primary hover:bg-blue-600 px-6 py-2 rounded-xl text-[10px] font-black uppercase transition-all flex items-center gap-2">
              <span className="material-symbols-outlined text-sm">print</span> IMPRIMIR
           </button>
        </div>
      </div>

      {/* HUB DE RELATÓRIOS (GRID DE SELEÇÃO) */}
      {showHub && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4 animate-in zoom-in-95 duration-300 print:hidden">
           {reportOptions.map(opt => (
             <button 
               key={opt.id} 
               onClick={() => { navigate(`/relatorios?type=${opt.id}`); setShowHub(false); }}
               className={`p-6 rounded-[2rem] border transition-all flex flex-col items-center gap-3 group ${reportType === opt.id ? 'bg-primary border-primary shadow-2xl shadow-primary/20' : 'bg-slate-900 border-slate-800 hover:border-primary/50'}`}
             >
                <div className={`size-12 rounded-2xl flex items-center justify-center text-white shadow-lg ${opt.color} group-hover:scale-110 transition-transform`}>
                   <span className="material-symbols-outlined text-2xl">{opt.icon}</span>
                </div>
                <span className="text-[10px] font-black uppercase tracking-tighter text-center leading-none">{opt.label}</span>
             </button>
           ))}
        </div>
      )}

      {/* MÉTRICAS DE TOPO */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:grid-cols-4">
        <MetricCard title="Faturamento Bruto" value={`R$ ${totalRevenue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`} icon="trending_up" color="text-emerald-500" />
        <MetricCard title="Volume Operacional" value={baseData.length.toString()} icon="shopping_bag" color="text-primary" />
        <MetricCard title="Ticket Médio" value={`R$ ${(baseData.length ? totalRevenue/baseData.length : 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}`} icon="payments" color="text-amber-500" />
        <MetricCard title="Unidades Analisadas" value={Array.from(new Set(baseData.map(t => t.store))).length.toString()} icon="store" color="text-indigo-400" />
      </div>

      {/* TABELA DE RESULTADOS */}
      <div className="bg-[#1e293b] rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl print:bg-white print:border-slate-200 print:shadow-none print:rounded-none">
         <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-800 border-b border-slate-700 print:bg-slate-100 print:border-slate-300">
                  {getHeaders().map((h, i) => (
                    <th key={i} className={`px-8 py-5 text-[10px] font-black uppercase text-slate-400 tracking-widest print:text-slate-700 ${i === 5 ? 'text-right' : ''}`}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50 print:divide-slate-200">
                {displayData.map((row: any, idx: number) => (
                  <tr key={idx} className="hover:bg-slate-800/40 uppercase text-[10px] font-bold transition-colors print:hover:bg-transparent">
                    <td className="px-8 py-4 text-slate-500 whitespace-nowrap print:text-slate-600">{row.col1}</td>
                    <td className="px-8 py-4 text-primary whitespace-nowrap print:text-black">{row.col2}</td>
                    <td className="px-8 py-4 text-white truncate max-w-[300px] print:text-black">{row.col3}</td>
                    <td className="px-8 py-4 text-slate-400 print:text-slate-700">{row.col4}</td>
                    <td className="px-8 py-4">
                       <span className={`px-3 py-1 rounded-lg ${row.profit && row.profit > 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-slate-700 text-slate-400'}`}>
                          {row.col5}
                       </span>
                    </td>
                    <td className="px-8 py-4 text-right font-black text-white tabular-nums print:text-black">
                      R$ {row.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}
                    </td>
                  </tr>
                ))}
                {displayData.length === 0 && (
                  <tr><td colSpan={6} className="px-8 py-32 text-center opacity-20 font-black tracking-[0.5em] text-sm print:opacity-100 print:text-slate-300">NENHUM REGISTRO ANALÍTICO LOCALIZADO</td></tr>
                )}
              </tbody>
              {displayData.length > 0 && (
                <tfoot className="bg-slate-800/30 border-t border-slate-700 print:bg-slate-50 print:border-slate-300">
                   <tr>
                      <td colSpan={5} className="px-8 py-8 text-[11px] font-black uppercase text-slate-400 text-right tracking-widest print:text-slate-600">SUBTOTAL CONSOLIDADO:</td>
                      <td className="px-8 py-8 text-right text-2xl font-black text-primary tabular-nums print:text-black">R$ {totalRevenue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                   </tr>
                </tfoot>
              )}
            </table>
         </div>
      </div>

      <style>{`
        @media print {
          /* OCULTA TODOS OS ELEMENTOS DA UI GLOBAL */
          aside, header, footer, .print\\:hidden, button, nav { 
            display: none !important; 
          }
          
          /* RESET DO CONTAINER PRINCIPAL */
          main { 
            margin: 0 !important; 
            padding: 0 !important; 
            display: block !important; 
          }
          
          #root { 
            display: block !important; 
            width: 100% !important; 
          }
          
          body { 
            background: white !important; 
            color: black !important; 
            margin: 0 !important; 
            padding: 20px !important;
          }

          /* CONVERSÃO DE CORES DARK PARA PRINT */
          .bg-\\[\\#0f172a\\], .bg-\\[\\#1e293b\\], .bg-slate-900, .bg-slate-800 { 
            background: white !important; 
            border: 1px solid #eee !important;
            color: black !important;
          }

          .text-white, .text-slate-100, .text-slate-400, .text-primary { 
            color: black !important; 
          }

          /* ESTILO DA TABELA */
          table { 
            border-collapse: collapse !important; 
            width: 100% !important; 
            margin-top: 20px;
          }
          
          th { 
            background-color: #f8fafc !important;
            color: #475569 !important;
            border-bottom: 2px solid #e2e8f0 !important;
          }
          
          td { 
            border-bottom: 1px solid #f1f5f9 !important; 
            color: black !important; 
            padding: 10px !important; 
          }
          
          tfoot td {
            border-top: 2px solid black !important;
          }

          /* AJUSTE DOS CARDS DE MÉTRICA */
          div[class*="MetricCard"], .MetricCard {
            border: 1px solid #ddd !important;
            box-shadow: none !important;
            background: #fff !important;
          }

          @page { 
            size: A4 landscape; 
            margin: 10mm; 
          }
        }
        
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
      `}</style>
    </div>
  );
};

const MetricCard = ({ title, value, icon, color }: any) => (
  <div className="bg-[#1e293b] p-6 rounded-[2rem] border border-slate-800 flex items-center gap-6 hover:border-primary/40 transition-all shadow-lg group print:bg-white print:border-slate-200 print:shadow-none">
     <div className={`size-14 rounded-2xl bg-slate-900 flex items-center justify-center ${color} shadow-inner group-hover:scale-110 transition-transform print:bg-slate-100 print:text-black`}>
        <span className="material-symbols-outlined text-3xl">{icon}</span>
     </div>
     <div>
        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1 print:text-slate-600">{title}</p>
        <p className="text-2xl font-black text-white tabular-nums tracking-tighter print:text-black">{value}</p>
     </div>
  </div>
);

export default Reports;
