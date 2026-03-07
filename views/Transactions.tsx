
// Implementação da visão de transações financeiras para controle de receitas e despesas.
import React, { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { TransactionStatus, UserRole } from '../types';

interface TransactionsProps {
  type: 'INCOME' | 'EXPENSE';
}

const Transactions: React.FC<TransactionsProps> = ({ type }) => {
  const { transactions, currentUser, establishments } = useApp();
  const [filter, setFilter] = useState('');
  
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const currentStoreName = establishments.find(e => e.id === currentUser?.storeId)?.name || '';

  const filtered = useMemo(() => {
    return transactions.filter(t => 
      t.type === type && 
      (isAdmin || t.store === currentStoreName) &&
      (t.description.toLowerCase().includes(filter.toLowerCase()) || 
       t.client?.toLowerCase().includes(filter.toLowerCase()) ||
       t.category.toLowerCase().includes(filter.toLowerCase()))
    ).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, type, isAdmin, currentStoreName, filter]);

  const total = useMemo(() => filtered.reduce((acc, t) => acc + t.value, 0), [filtered]);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">{type === 'INCOME' ? 'Controle de Receitas' : 'Controle de Despesas'}</h1>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-tight mt-1">Gestão financeira e fluxo de caixa</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm text-right">
           <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total no Período</p>
           <h3 className={`text-2xl font-black tabular-nums ${type === 'INCOME' ? 'text-emerald-500' : 'text-rose-500'}`}>R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h3>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 p-4 rounded-3xl border border-slate-200 dark:border-slate-800">
         <div className="relative">
            <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-300">search</span>
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Pesquisar lançamentos..." className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl pl-12 pr-6 text-sm font-bold uppercase" />
         </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
         <table className="w-full text-left">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
               <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400">Data / Loja</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400">Descrição / Categoria</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400">Método / Status</th>
                  <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 text-right">Valor</th>
               </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
               {filtered.map(t => (
                 <tr key={t.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all">
                    <td className="px-8 py-6">
                       <p className="text-xs font-black text-slate-700 dark:text-slate-300">{t.date.split('-').reverse().join('/')}</p>
                       <p className="text-[10px] text-slate-400 font-bold uppercase">{t.store}</p>
                    </td>
                    <td className="px-8 py-6">
                       <p className="text-xs font-black text-slate-900 dark:text-white uppercase">{t.description}</p>
                       <p className="text-[10px] text-slate-400 font-bold uppercase">{t.category}</p>
                    </td>
                    <td className="px-8 py-6">
                       <span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-3 py-1 rounded-lg">{t.method || 'CAIXA'}</span>
                       <p className={`text-[9px] font-bold mt-1 uppercase ${t.status === TransactionStatus.PAID ? 'text-emerald-500' : 'text-amber-500'}`}>{t.status}</p>
                    </td>
                    <td className={`px-8 py-6 text-right font-black text-sm tabular-nums ${type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>
                       {type === 'EXPENSE' && '- '}R$ {t.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </td>
                 </tr>
               ))}
            </tbody>
         </table>
      </div>
    </div>
  );
};

export default Transactions;
