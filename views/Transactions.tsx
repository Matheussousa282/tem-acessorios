
import React, { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import { Transaction, TransactionStatus, UserRole } from '../types';

interface TransactionsProps {
  type: 'INCOME' | 'EXPENSE';
}

const Transactions: React.FC<TransactionsProps> = ({ type }) => {
  const { transactions, addTransaction, currentUser, establishments } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const todayStr = new Date().toLocaleDateString('en-CA');
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const currentStore = establishments.find(e => e.id === currentUser?.storeId);

  const [form, setForm] = useState<Partial<Transaction>>({
    date: todayStr,
    dueDate: todayStr,
    description: '',
    store: currentStore?.name || 'Geral',
    category: '',
    status: TransactionStatus.PENDING,
    value: 0,
    method: '',
    client: ''
  });

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => t.type === type && (isAdmin || t.store === currentStore?.name));
  }, [transactions, type, isAdmin, currentStore]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({
      date: todayStr,
      dueDate: todayStr,
      description: '',
      store: currentStore?.name || 'Geral',
      category: '',
      status: type === 'INCOME' ? TransactionStatus.PAID : TransactionStatus.PENDING,
      value: 0,
      method: '',
      client: '',
      type: type
    });
    setShowModal(true);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    addTransaction({
      ...form as Transaction,
      id: editingId || `TRX-${Date.now()}`, // Inclui timestamp para o Dashboard
      type: type,
      store: currentStore?.name || 'Principal'
    });
    setShowModal(false);
  };

  const totalValue = filteredTransactions.reduce((acc, t) => acc + t.value, 0);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tight">
            {type === 'INCOME' ? 'Receitas' : 'Despesas'} - {isAdmin ? 'Global' : currentStore?.name}
          </h1>
          <p className="text-slate-500 text-sm font-bold uppercase mt-1">Gestão financeira da unidade</p>
        </div>
        <button onClick={handleOpenAdd} className="bg-primary hover:bg-blue-600 text-white font-black py-3 px-8 rounded-2xl text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95">
          Novo Lançamento
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2.5rem] shadow-sm">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Total Consolidado</p>
          <p className="text-3xl font-black text-primary">R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2.5rem] shadow-sm">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Unidade Logada</p>
          <p className="text-3xl font-black text-slate-700 dark:text-white uppercase">{currentStore?.name || 'Local'}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
            {filteredTransactions.map(t => (
              <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all">
                <td className="px-8 py-5 text-xs font-bold text-slate-500 uppercase">{t.date}</td>
                <td className="px-8 py-5">
                   <p className="text-xs font-black text-slate-800 dark:text-white uppercase">{t.description}</p>
                   <p className="text-[9px] text-slate-400 font-bold uppercase">{t.category}</p>
                </td>
                <td className="px-8 py-5">
                   <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${t.status === TransactionStatus.APPROVED || t.status === TransactionStatus.PAID ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'}`}>{t.status}</span>
                </td>
                <td className="px-8 py-5 text-right font-black text-sm tabular-nums text-slate-900 dark:text-white">R$ {t.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-primary text-white">
              <h3 className="text-2xl font-black uppercase">Novo Registro</h3>
              <button onClick={() => setShowModal(false)} className="material-symbols-outlined">close</button>
            </div>
            <form onSubmit={handleSave} className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 text-sm font-bold border-none" required />
                <input type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 text-sm font-bold border-none" required />
              </div>
              <input type="text" placeholder="Descrição" value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 text-sm font-bold border-none" required />
              <div className="grid grid-cols-2 gap-4">
                <input type="number" placeholder="Valor (R$)" value={form.value} onChange={e => setForm({...form, value: parseFloat(e.target.value)})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 text-sm font-black border-none" required />
                <select value={form.status} onChange={e => setForm({...form, status: e.target.value as TransactionStatus})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 text-sm font-bold border-none">
                  <option value={TransactionStatus.PENDING}>Pendente</option>
                  <option value={TransactionStatus.PAID}>Pago</option>
                </select>
              </div>
              <button type="submit" className="w-full h-16 bg-primary text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl">Confirmar Lançamento</button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
