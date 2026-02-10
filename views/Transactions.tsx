
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
  const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.MANAGER;
  const currentStore = establishments.find(e => e.id === currentUser?.storeId);

  const [form, setForm] = useState<Partial<Transaction>>({
    date: todayStr, 
    dueDate: todayStr, 
    description: '', 
    store: currentStore?.name || 'Geral', 
    category: type === 'INCOME' ? 'Receita Extra' : 'Despesa Operacional', 
    status: TransactionStatus.PENDING, 
    value: 0, 
    method: 'Dinheiro', 
    client: ''
  });

  const filteredTransactions = useMemo(() => {
    return transactions.filter(t => t.type === type && (isAdmin || t.store === currentStore?.name));
  }, [transactions, type, isAdmin, currentStore]);

  /**
   * CÁLCULO DE SALDO ACUMULADO (Geral da Gaveta)
   * Soma tudo o que entrou e subtrai o que saiu (Dinheiro) na história da unidade.
   */
  const calculateStoreBalance = (storeName: string) => {
    if (!storeName) return 0;
    
    // Entradas em Dinheiro (Vendas + Entradas Manuais)
    const cashIn = transactions.filter(t => t.store === storeName && t.method === 'Dinheiro' && t.status === TransactionStatus.PAID && t.type === 'INCOME').reduce((acc, t) => acc + t.value, 0);
    const manIn = cashEntries.filter(e => {
       const session = cashSessions.find(s => s.id === e.sessionId);
       return session?.storeName === storeName && e.type === 'INCOME';
    }).reduce((acc, e) => acc + e.value, 0);

    // Saídas em Dinheiro (Despesas + Sangrias Manuais)
    const cashOut = transactions.filter(t => t.store === storeName && t.method === 'Dinheiro' && t.status === TransactionStatus.PAID && t.type === 'EXPENSE').reduce((acc, t) => acc + t.value, 0);
    const manOut = cashEntries.filter(e => {
       const session = cashSessions.find(s => s.id === e.sessionId);
       return session?.storeName === storeName && e.type === 'EXPENSE';
    }).reduce((acc, e) => acc + e.value, 0);

    // Saldo Inicial do primeiro caixa aberto
    const firstSess = [...cashSessions].filter(s => s.storeName === storeName).sort((a,b) => a.id.localeCompare(b.id))[0];
    const initial = firstSess?.openingValue || 0;

    return (initial + cashIn + manIn) - (cashOut + manOut);
  };

  // Se for Admin, calcula o saldo de cada loja. Se for Caixa, só o da unidade dele.
  const storeBalances = useMemo(() => {
    if (isAdmin) {
      return establishments.map(e => ({ name: e.name, balance: calculateStoreBalance(e.name) }));
    }
    return [{ name: currentStore?.name || 'Unidade Atual', balance: calculateStoreBalance(currentStore?.name || '') }];
  }, [transactions, cashSessions, cashEntries, establishments, isAdmin, currentStore]);

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
    const targetStoreBalance = calculateStoreBalance(form.store || '');

    // TRAVA DE SALDO: Não deixa lançar despesa em dinheiro se não houver saldo na unidade escolhida
    if (type === 'EXPENSE' && form.method === 'Dinheiro') {
      if (valueToSpend > targetStoreBalance) {
        alert(`❌ SALDO INSUFICIENTE NA GAVETA!\n\nA unidade "${form.store}" possui apenas R$ ${targetStoreBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} em dinheiro disponível.`);
        return;
      }
    }

    setIsProcessing(true);
    try {
      await addTransaction({ 
        ...form as Transaction, 
        id: editingId || `TRX-${Date.now()}`, 
        type: type 
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
    const bal = calculateStoreBalance(t.store);
    if (t.type === 'EXPENSE' && t.method === 'Dinheiro' && t.value > bal) {
      alert(`❌ CAIXA INSUFICIENTE!\n\nNão há saldo na gaveta da unidade "${t.store}" para quitar este valor.\n\nSaldo atual: R$ ${bal.toLocaleString('pt-BR')}`);
      return;
    }
    if(confirm(`Confirmar pagamento de R$ ${t.value.toLocaleString('pt-BR')} via ${t.method}?`)) {
      await addTransaction({ ...t, status: TransactionStatus.PAID });
      await refreshData();
    }
  };

  const totalValue = filteredTransactions.reduce((acc, t) => acc + t.value, 0);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="flex items-center gap-4">
          <div className={`size-14 rounded-2xl flex items-center justify-center text-white shadow-xl ${type === 'INCOME' ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-rose-500 shadow-rose-500/20'}`}>
            <span className="material-symbols-outlined text-3xl">{type === 'INCOME' ? 'add_chart' : 'analytics'}</span>
          </div>
          <div>
            <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900 dark:text-white">
              {type === 'INCOME' ? 'Receitas' : 'Despesas'}
            </h1>
            <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mt-1 flex items-center gap-2">
              <span className="size-2 bg-primary rounded-full animate-pulse"></span>
              {isAdmin ? 'Controle Consolidado do Grupo' : `Unidade: ${currentStore?.name}`}
            </p>
          </div>
        </div>
        <button onClick={handleOpenAdd} className="bg-primary hover:bg-blue-600 text-white font-black py-4 px-10 rounded-[1.5rem] text-[11px] uppercase tracking-widest shadow-2xl transition-all active:scale-95 flex items-center gap-2">
          <span className="material-symbols-outlined text-sm">add_circle</span>
          Lançar {type === 'INCOME' ? 'Receita' : 'Despesa'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2.5rem] shadow-sm flex flex-col justify-center">
           <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-2">Total na Listagem</p>
           <p className={`text-3xl font-black tabular-nums ${type === 'INCOME' ? 'text-emerald-500' : 'text-rose-500'}`}>R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
        </div>
        
        {/* CARD DE SALDOS POR UNIDADE - O "CORAÇÃO" DA TELA */}
        <div className="md:col-span-3 bg-slate-900 p-8 rounded-[2.5rem] text-white flex flex-col justify-center relative overflow-hidden group">
           <div className="absolute top-0 right-0 size-48 bg-primary/10 blur-[80px] rounded-full group-hover:bg-primary/20 transition-all"></div>
           <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-4 relative z-10">Saldos Disponíveis em Dinheiro (Gaveta)</p>
           <div className="flex gap-10 overflow-x-auto no-scrollbar relative z-10">
              {storeBalances.map(sb => (
                 <div key={sb.name} className="flex flex-col border-r border-white/10 pr-10 last:border-none min-w-fit">
                    <span className="text-[10px] font-black uppercase text-primary mb-1 tracking-tighter">{sb.name}</span>
                    <span className={`text-2xl font-black tabular-nums ${sb.balance <= 0 ? 'text-rose-500' : 'text-emerald-400'}`}>R$ {sb.balance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
                    <p className="text-[8px] font-bold text-slate-500 uppercase mt-1">Disponível para Pagto</p>
                 </div>
              ))}
           </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[3rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Data / Loja</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Descrição / Fornecedor</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Meio</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Status</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Valor</th>
                <th className="px-10 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {filteredTransactions.map(t => (
                <tr key={t.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-all group">
                  <td className="px-10 py-6">
                    <p className="text-xs font-bold text-slate-500 uppercase">{t.date.split('-').reverse().join('/')}</p>
                    <p className="text-[9px] font-black text-primary uppercase mt-0.5">{t.store}</p>
                  </td>
                  <td className="px-10 py-6">
                    <p className="text-xs font-black text-slate-800 dark:text-white uppercase leading-none">{t.description}</p>
                    <p className="text-[9px] text-slate-400 font-bold uppercase mt-1.5">{t.category}</p>
                  </td>
                  <td className="px-10 py-6">
                    <span className="text-[10px] font-black uppercase text-slate-500 bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded-lg">{t.method}</span>
                  </td>
                  <td className="px-10 py-6">
                    <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black uppercase ${t.status === TransactionStatus.PAID ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>{t.status}</span>
                  </td>
                  <td className="px-10 py-6 text-right font-black text-sm tabular-nums text-slate-900 dark:text-white">R$ {t.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                  <td className="px-10 py-6 text-right">
                     {t.status === TransactionStatus.PENDING && (
                       <button onClick={() => handleMarkAsPaid(t)} className="px-6 py-2.5 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase hover:scale-105 transition-all shadow-xl shadow-emerald-500/20">Quitar</button>
                     )}
                  </td>
                </tr>
              ))}
              {filteredTransactions.length === 0 && (
                <tr><td colSpan={6} className="py-24 text-center opacity-30 font-black text-xs uppercase tracking-widest">Nenhum lançamento localizado</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-xl rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-primary text-white flex justify-between items-center shadow-lg">
              <div className="flex items-center gap-3">
                 <span className="material-symbols-outlined text-3xl">post_add</span>
                 <h3 className="text-2xl font-black uppercase tracking-tight">Novo Lançamento</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="size-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-all"><span className="material-symbols-outlined">close</span></button>
            </div>
            <form onSubmit={handleSave} className="p-10 space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Data Emissão</label>
                  <input type="date" value={form.date} onChange={e => setForm({...form, date: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 text-sm font-bold border-none outline-none focus:ring-2 focus:ring-primary/20" required />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Unidade Responsável</label>
                  <select 
                    disabled={!isAdmin} 
                    value={form.store} 
                    onChange={e => setForm({...form, store: e.target.value})} 
                    className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 text-[11px] font-black uppercase border-none focus:ring-2 focus:ring-primary/20"
                  >
                    {establishments.map(e => <option key={e.id} value={e.name}>{e.name}</option>)}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Descrição do Lançamento / Fornecedor</label>
                <input type="text" required value={form.description} onChange={e => setForm({...form, description: e.target.value.toUpperCase()})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 text-sm font-bold border-none uppercase focus:ring-2 focus:ring-primary/20" placeholder="EX: PAGAMENTO DE ALUGUEL, COMPRA DE PEÇAS..." />
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Meio de Movimentação</label>
                    <select value={form.method} onChange={e => setForm({...form, method: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 text-[11px] font-black uppercase border-none focus:ring-2 focus:ring-primary/20">
                      <option value="Dinheiro">Dinheiro (Gaveta)</option>
                      <option value="Pix">Pix (Banco)</option>
                      <option value="Debito">Débito (Banco)</option>
                      <option value="Credito">Crédito (Banco)</option>
                    </select>
                 </div>
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Status Situacional</label>
                    <select value={form.status} onChange={e => setForm({...form, status: e.target.value as TransactionStatus})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 text-[11px] font-black uppercase border-none focus:ring-2 focus:ring-primary/20">
                      <option value={TransactionStatus.PENDING}>Pendente (Aguardando)</option>
                      <option value={TransactionStatus.PAID}>Pago (Efetivado)</option>
                    </select>
                 </div>
              </div>

              <div className="space-y-1.5 p-6 bg-primary/5 rounded-[2rem] border border-primary/10">
                <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] px-2 text-center block mb-2">Valor do Documento (R$)</label>
                <input type="number" step="0.01" required value={form.value || ''} onChange={e => setForm({...form, value: parseFloat(e.target.value) || 0})} className="w-full h-16 bg-white dark:bg-slate-800 rounded-2xl px-6 text-3xl font-black text-primary text-center border-none shadow-inner focus:ring-4 focus:ring-primary/10 tabular-nums" placeholder="0,00" />
              </div>
              
              <button 
                type="submit" 
                disabled={isProcessing} 
                className="w-full h-20 bg-primary text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl hover:scale-105 transition-all flex items-center justify-center gap-3 shadow-primary/30"
              >
                {isProcessing ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">check_circle</span>}
                {isProcessing ? 'PROCESSANDO...' : 'Confirmar Registro Financeiro'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;
