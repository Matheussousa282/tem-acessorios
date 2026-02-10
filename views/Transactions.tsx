
import React, { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import { Transaction, TransactionStatus, UserRole, CashSessionStatus } from '../types';

interface TransactionsProps {
  type: 'INCOME' | 'EXPENSE';
}

const Transactions: React.FC<TransactionsProps> = ({ type }) => {
  const { transactions, addTransaction, currentUser, establishments, cashSessions, cashEntries, refreshData } = useApp();
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
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
    method: 'Dinheiro',
    client: ''
  });

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => t.type === type && (isAdmin || t.store === currentStore?.name));
  }, [transactions, type, isAdmin, currentStore]);

  // Motor de cálculo de saldo em tempo real (Dinheiro em Espécie)
  const drawerCashBalance = useMemo(() => {
    const storeName = currentStore?.name;
    if (!storeName) return 0;

    // Apenas o que já foi PAGO em dinheiro entra no cálculo do saldo disponível
    const storeTransactions = transactions.filter(t => t.store === storeName && t.method === 'Dinheiro' && t.status === TransactionStatus.PAID);
    
    const incomes = storeTransactions.filter(t => t.type === 'INCOME').reduce((acc, t) => acc + t.value, 0);
    const expenses = storeTransactions.filter(t => t.type === 'EXPENSE').reduce((acc, t) => acc + t.value, 0);

    const activeSession = cashSessions.find(s => s.storeName === storeName && s.status === CashSessionStatus.OPEN);
    const openingValue = activeSession?.openingValue || 0;

    const sessionManualEntries = cashEntries.filter(e => e.sessionId === activeSession?.id);
    const manualIncomes = sessionManualEntries.filter(e => e.type === 'INCOME').reduce((acc, e) => acc + e.value, 0);
    const manualExpenses = sessionManualEntries.filter(e => e.type === 'EXPENSE').reduce((acc, e) => acc + e.value, 0);

    return (openingValue + incomes + manualIncomes) - (expenses + manualExpenses);
  }, [transactions, cashSessions, cashEntries, currentStore]);

  const handleOpenAdd = () => {
    setEditingId(null);
    setForm({
      date: todayStr,
      dueDate: todayStr,
      description: '',
      store: currentStore?.name || 'Geral',
      category: type === 'INCOME' ? 'Receita Extra' : 'Despesa Operacional',
      status: type === 'INCOME' ? TransactionStatus.PAID : TransactionStatus.PENDING,
      value: 0,
      method: 'Dinheiro',
      client: '',
      type: type
    });
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isProcessing) return;

    const valueToSpend = Number(form.value) || 0;

    // TRAVA RIGOROSA: Bloqueia se for despesa em dinheiro, independente de ser Pendente ou Paga
    if (type === 'EXPENSE' && form.method === 'Dinheiro') {
      if (valueToSpend > drawerCashBalance) {
        alert(`Saldo insuficiente no caixa para lançar, vamos vender mais! 😊\n\nSaldo atual: R$ ${drawerCashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        return;
      }
    }

    setIsProcessing(true);
    try {
      await addTransaction({
        ...form as Transaction,
        id: editingId || `TRX-${Date.now()}`,
        type: type,
        store: currentStore?.name || 'Principal'
      });
      setShowModal(false);
      await refreshData();
    } catch (err) {
      alert("Erro ao salvar lançamento.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkAsPaid = async (t: Transaction) => {
    // Valida saldo antes de permitir a quitação de uma despesa em dinheiro
    if (t.type === 'EXPENSE' && t.method === 'Dinheiro') {
      if (t.value > drawerCashBalance) {
        alert(`Saldo insuficiente no caixa para pagar este lançamento, vamos vender mais! 😊\n\nSaldo atual: R$ ${drawerCashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
        return;
      }
    }

    if(confirm(`Confirmar o pagamento de R$ ${t.value.toLocaleString('pt-BR')}?`)) {
      await addTransaction({ ...t, status: TransactionStatus.PAID });
      await refreshData();
    }
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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2.5rem] shadow-sm">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Total Consolidado</p>
          <p className="text-3xl font-black text-primary">R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2.5rem] shadow-sm">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Saldo em Dinheiro (Gaveta)</p>
          <p className={`text-3xl font-black ${drawerCashBalance <= 0 ? 'text-rose-500' : 'text-emerald-500'}`}>R$ {drawerCashBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2.5rem] shadow-sm">
          <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-2">Unidade Logada</p>
          <p className="text-3xl font-black text-slate-700 dark:text-white uppercase truncate">{currentStore?.name || 'Local'}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Meio</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
              <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
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
                   <span className="text-[10px] font-black uppercase text-slate-500">{t.method}</span>
                </td>
                <td className="px-8 py-5">
                   <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${t.status === TransactionStatus.PAID ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>{t.status}</span>
                </td>
                <td className="px-8 py-5 text-right font-black text-sm tabular-nums text-slate-900 dark:text-white">R$ {t.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td className="px-8 py-5 text-right">
                   {t.status === TransactionStatus.PENDING && (
                     <button 
                       onClick={() => handleMarkAsPaid(t)}
                       className="px-4 py-2 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase hover:scale-105 transition-all shadow-lg shadow-emerald-500/20"
                     >
                        Quitar
                     </button>
                   )}
                </td>
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
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase px-2">Data Emissão</label>
                  <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20" required />
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase px-2">Vencimento</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20" required />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-400 uppercase px-2">Descrição / Fornecedor</label>
                <input type="text" placeholder="EX: ALUGUEL, COMPRA DE PEÇAS..." value={form.description} onChange={e => setForm({...form, description: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20 uppercase" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase px-2">Meio de Pagamento</label>
                  <select value={form.method} onChange={e => setForm({...form, method: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 text-sm font-bold border-none">
                      <option value="Dinheiro">Dinheiro (Gaveta)</option>
                      <option value="Pix">Pix</option>
                      <option value="Debito">Débito</option>
                      <option value="Credito">Crédito</option>
                  </select>
                 </div>
                 <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-400 uppercase px-2">Situação</label>
                  <select value={form.status} onChange={e => setForm({...form, status: e.target.value as TransactionStatus})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 text-sm font-bold border-none">
                    <option value={TransactionStatus.PENDING}>A Pagar (Pendente)</option>
                    <option value={TransactionStatus.PAID}>Pago (Efetivado)</option>
                  </select>
                 </div>
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase px-2">Valor do Lançamento (R$)</label>
                <input type="number" step="0.01" placeholder="0,00" value={form.value || ''} onChange={e => setForm({...form, value: parseFloat(e.target.value) || 0})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 text-xl font-black border-none outline-none focus:ring-4 focus:ring-primary/10" required />
              </div>
              
              <button 
                type="submit" 
                disabled={isProcessing}
                className="w-full h-16 bg-primary text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl hover:scale-105 transition-all flex items-center justify-center gap-2"
              >
                {isProcessing ? <span className="material-symbols-outlined animate-spin">sync</span> : null}
                {isProcessing ? 'PROCESSANDO...' : 'Confirmar Lançamento'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
