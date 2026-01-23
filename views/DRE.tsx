
import React, { useMemo } from 'react';
import { useApp } from '../AppContext';
import { DRERow, UserRole } from '../types';

const DRE: React.FC = () => {
  const { transactions, currentUser, establishments } = useApp();
  
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const currentStore = establishments.find(e => e.id === currentUser?.storeId);
  const currentStoreName = currentStore?.name || '';

  const dreData = useMemo(() => {
    // 1. Filtrar transações da unidade logada
    const unitTransactions = transactions.filter(t => isAdmin || t.store === currentStoreName);
    
    const incomes = unitTransactions.filter(t => t.type === 'INCOME');
    const expenses = unitTransactions.filter(t => t.type === 'EXPENSE');

    // 2. Receita Bruta
    const totalIncome = incomes.reduce((acc, t) => acc + t.value, 0);
    const salesIncome = incomes.filter(t => t.category === 'Venda').reduce((acc, t) => acc + t.value, 0);
    const serviceIncome = incomes.filter(t => t.category === 'Serviço').reduce((acc, t) => acc + t.value, 0);
    const otherIncomes = totalIncome - (salesIncome + serviceIncome);

    // 3. CÁLCULO AUTOMÁTICO DO CMV (Custo das Mercadorias Vendidas)
    // Percorre cada venda e soma o custo dos itens vendidos
    let calculatedCMV = 0;
    incomes.forEach(t => {
      if (t.items && Array.isArray(t.items)) {
        t.items.forEach(item => {
          // Soma o custo (quantidade * preço de custo cadastrado no item na hora da venda)
          // Se o item não tiver preço de custo, considera 0 para não quebrar o cálculo
          const itemCost = (Number(item.costPrice) || 0) * (item.quantity || 1);
          calculatedCMV += itemCost;
        });
      }
    });

    // 4. Despesas Operacionais (Tudo que é EXPENSE exceto se for devolução/cancelamento que já abate na receita)
    const totalExpenses = expenses.reduce((acc, t) => acc + t.value, 0);
    
    const grossProfit = totalIncome - calculatedCMV;
    const netResult = totalIncome - calculatedCMV - totalExpenses;

    const rows: DRERow[] = [
      { label: 'RECEITA BRUTA TOTAL', value: totalIncome, avPercent: 100.0, trend: 0, isSubtotal: true },
      { label: 'Vendas de Produtos (PDV)', value: salesIncome, avPercent: totalIncome ? (salesIncome / totalIncome) * 100 : 0, trend: 0, indent: true },
      { label: 'Prestação de Serviços / Mão de Obra', value: serviceIncome, avPercent: totalIncome ? (serviceIncome / totalIncome) * 100 : 0, trend: 0, indent: true },
      { label: 'Outras Receitas', value: otherIncomes, avPercent: totalIncome ? (otherIncomes / totalIncome) * 100 : 0, trend: 0, indent: true },
      
      { label: '(=) RECEITA OPERACIONAL LÍQUIDA', value: totalIncome, avPercent: 100.0, trend: 0, isSubtotal: true },
      
      { label: '(-) CUSTO DAS MERCADORIAS VENDIDAS (CMV)', value: -calculatedCMV, avPercent: totalIncome ? (calculatedCMV / totalIncome) * 100 : 0, trend: 0, isNegative: true },
      
      { label: '(=) LUCRO BRUTO / MARGEM DE CONTRIBUIÇÃO', value: grossProfit, avPercent: totalIncome ? (grossProfit / totalIncome) * 100 : 0, trend: 0, isSubtotal: true },
      
      { label: '(-) DESPESAS OPERACIONAIS (FIXAS/VARIAVEIS)', value: -totalExpenses, avPercent: totalIncome ? (totalExpenses / totalIncome) * 100 : 0, trend: 0, isNegative: true },
      
      { label: '(=) RESULTADO LÍQUIDO (LUCRO/PREJUÍZO)', value: netResult, avPercent: totalIncome ? (netResult / totalIncome) * 100 : 0, trend: 0, isSubtotal: true },
    ];

    return rows;
  }, [transactions, isAdmin, currentStoreName]);

  const totalIncome = dreData[0].value;
  const netProfit = dreData[dreData.length - 1].value;
  const margin = totalIncome ? (netProfit / totalIncome) * 100 : 0;

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter text-slate-900 dark:text-white uppercase">DRE Automatizada</h1>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-tight mt-1">
             {isAdmin ? 'Visão Consolidada Global' : `Demonstrativo Unidade: ${currentStoreName}`}
          </p>
        </div>
        <div className="flex gap-3 bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800">
           <button onClick={() => window.print()} className="flex items-center gap-2 px-6 py-3 bg-slate-100 dark:bg-slate-700 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-primary hover:text-white transition-all">
             <span className="material-symbols-outlined text-lg">print</span> Gerar PDF
           </button>
           <button className="flex items-center gap-2 px-6 py-3 bg-emerald-500 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:scale-105 transition-all shadow-lg shadow-emerald-500/20">
             <span className="material-symbols-outlined text-lg">ios_share</span> Excel
           </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <SummaryCard title="Faturamento Bruto" value={`R$ ${totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon="trending_up" color="text-primary" />
        <SummaryCard title="Margem Líquida" value={`${margin.toFixed(1)}%`} subtext="Rentabilidade" icon="pie_chart" color="text-amber-500" />
        <SummaryCard title="Lucro Líquido" value={`R$ ${netProfit.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} icon="account_balance_wallet" color={netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'} />
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-2xl overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-700">
              <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em]">Descrição da Conta Financeira</th>
              <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-right">Valor (R$)</th>
              <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] text-right">AV %</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {dreData.map((row, i) => (
              <tr key={i} className={`${row.isSubtotal ? 'bg-slate-50/50 dark:bg-slate-800/30 font-black' : ''} hover:bg-slate-100/50 dark:hover:bg-slate-800/50 transition-all group`}>
                <td className={`px-10 py-6 text-sm uppercase ${row.indent ? 'pl-20 text-slate-500 dark:text-slate-400 font-bold' : 'font-black text-slate-800 dark:text-white'} ${row.isNegative ? 'text-rose-500 !font-black' : ''}`}>
                   <div className="flex items-center gap-3">
                      {row.isSubtotal && <span className={`size-2 rounded-full ${row.label.includes('LÍQUIDO') ? 'bg-emerald-500' : 'bg-primary'}`}></span>}
                      {row.label}
                   </div>
                </td>
                <td className={`px-10 py-6 text-lg text-right tabular-nums font-black ${row.isNegative ? 'text-rose-500' : row.isSubtotal ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-300'}`}>
                  {row.value < 0 ? `R$ (${Math.abs(row.value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})` : `R$ ${row.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                </td>
                <td className="px-10 py-6 text-xs text-right text-slate-400 font-bold tabular-nums group-hover:text-primary transition-colors">
                  {row.avPercent.toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-emerald-500/10 border-2 border-dashed border-emerald-500/20 p-8 rounded-[2.5rem] flex items-center gap-6">
         <div className="size-16 bg-emerald-500 text-white rounded-3xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <span className="material-symbols-outlined text-3xl">auto_awesome</span>
         </div>
         <div>
            <h4 className="text-sm font-black text-emerald-800 dark:text-emerald-400 uppercase tracking-widest">Cálculo Inteligente Ativo</h4>
            <p className="text-xs font-bold text-emerald-700/70 dark:text-emerald-400/70 uppercase leading-relaxed mt-1">
               A sua DRE agora calcula o CMV baseando-se no <strong>Custo Unitário</strong> de cada produto no momento da venda. <br/>
               Isso significa que seu lucro bruto é atualizado instantaneamente a cada bipagem no PDV.
            </p>
         </div>
      </div>
    </div>
  );
};

const SummaryCard: React.FC<{ title: string; value: string; icon: string; color: string; subtext?: string }> = ({ title, value, icon, color, subtext }) => (
  <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl group hover:border-primary/50 transition-all">
    <div className="flex justify-between items-start mb-6">
       <div className={`p-4 rounded-2xl bg-slate-50 dark:bg-slate-800 ${color} shadow-inner`}><span className="material-symbols-outlined text-3xl">{icon}</span></div>
    </div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">{title}</p>
    <div className="flex items-end gap-2">
      <h3 className="text-3xl font-black tabular-nums tracking-tighter">{value}</h3>
      {subtext && <span className="text-slate-400 text-[10px] font-black uppercase mb-1.5">{subtext}</span>}
    </div>
  </div>
);

export default DRE;
