
import React, { useState, useMemo } from 'react';
import { useApp, CashEntry } from '../AppContext';
import { CashSession, CashSessionStatus, UserRole } from '../types';
import { useNavigate } from 'react-router-dom';

const CashMovement: React.FC = () => {
  const { cashSessions, cashEntries, transactions, establishments, currentUser, saveCashSession, addCashEntry, users, refreshData } = useApp();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('');
  
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const [viewingSession, setViewingSession] = useState<CashSession | null>(null);
  const [activeTab, setActiveTab] = useState<'lançamentos' | 'auditoria'>('lançamentos');
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [openingValue, setOpeningValue] = useState(0);
  const [selectedRegister, setSelectedRegister] = useState('');

  const currentStore = establishments.find(e => e.id === currentUser?.storeId);

  const availableCashiers = useMemo(() => {
    return users.filter(u => (u.role === UserRole.CASHIER || u.role === UserRole.ADMIN || u.role === UserRole.MANAGER) && (isAdmin || u.storeId === currentUser?.storeId));
  }, [users, isAdmin, currentUser]);

  const filteredSessions = useMemo(() => {
    return cashSessions.filter(s => {
      const belongsToStore = isAdmin || s.storeId === currentUser?.storeId;
      const matchesFilter = filter === '' || s.registerName.toLowerCase().includes(filter.toLowerCase());
      return belongsToStore && matchesFilter;
    });
  }, [cashSessions, filter, isAdmin, currentUser]);

  const handleOpenCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegister) { alert('Selecione um operador/terminal'); return; }
    
    const newSession: CashSession = {
      id: `CASH-${Date.now()}`,
      storeId: currentUser?.storeId || 'matriz',
      storeName: currentStore?.name || 'Matriz',
      registerName: selectedRegister,
      openingTime: new Date().toLocaleString('pt-BR'),
      openingOperatorId: currentUser?.id,
      openingOperatorName: currentUser?.name,
      openingValue: openingValue,
      status: CashSessionStatus.OPEN,
      priceTable: 'Tabela Padrão'
    };
    
    await saveCashSession(newSession);
    await refreshData(); // GARANTE QUE O PDV VEJA O CAIXA ABERTO
    setShowOpeningModal(false);
    alert('CAIXA ABERTO COM SUCESSO! O PDV já pode ser operado.');
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div><h2 className="text-xl font-black text-slate-800 dark:text-white uppercase">Registro de Movimentação Diária</h2></div>
        <div className="flex gap-2">
           <button onClick={() => setShowOpeningModal(true)} className="px-6 py-2 bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase shadow-lg"><span className="material-symbols-outlined text-sm">check_circle</span> Realizar Abertura</button>
           <button onClick={() => window.history.back()} className="px-4 py-2 bg-white dark:bg-slate-800 border rounded-lg text-[10px] font-black uppercase">Voltar</button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
         <table className="w-full text-left text-[11px] font-bold">
            <thead className="bg-primary text-white">
               <tr><th className="px-4 py-3">ID</th><th className="px-4 py-3">Terminal / Operador</th><th className="px-4 py-3">Data Abertura</th><th className="px-4 py-3">Status</th><th className="px-4 py-3 text-right">Ações</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
               {filteredSessions.map(session => (
                 <tr key={session.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-3 font-mono text-slate-400">{session.id.slice(-6)}</td>
                    <td className="px-4 py-3 uppercase">{session.registerName}</td>
                    <td className="px-4 py-3 text-slate-400">{session.openingTime}</td>
                    <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded text-[9px] font-black text-white ${session.status === CashSessionStatus.OPEN ? 'bg-emerald-500' : 'bg-blue-500'}`}>{session.status}</span></td>
                    <td className="px-4 py-3 text-right"><button onClick={() => setViewingSession(session)} className="text-primary hover:underline text-[10px] font-black uppercase">Detalhes</button></td>
                 </tr>
               ))}
            </tbody>
         </table>
      </div>

      {showOpeningModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden">
              <div className="p-6 bg-primary text-white flex justify-between items-center"><h3 className="font-black uppercase tracking-tight">Abertura de Movimento</h3><button onClick={() => setShowOpeningModal(false)}><span className="material-symbols-outlined">close</span></button></div>
              <form onSubmit={handleOpenCash} className="p-8 space-y-6">
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Unidade de Venda</label><div className="w-full h-12 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 flex items-center text-xs font-black uppercase text-primary">{currentStore?.name}</div></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Operador Responsável</label><select required value={selectedRegister} onChange={e => setSelectedRegister(e.target.value)} className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 text-xs font-black uppercase"><option value="">Selecione...</option>{availableCashiers.map(u => <option key={u.id} value={`${u.name}`}>{u.name}</option>)}</select></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Fundo de Troco (R$)</label><input autoFocus type="number" step="0.01" required value={openingValue} onChange={e => setOpeningValue(parseFloat(e.target.value) || 0)} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-6 text-xl font-black text-primary" /></div>
                 <button type="submit" className="w-full h-14 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-xl">Confirmar Abertura</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default CashMovement;
