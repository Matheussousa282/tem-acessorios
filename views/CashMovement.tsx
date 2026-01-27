
import React, { useState, useMemo } from 'react';
import { useApp, CashEntry } from '../AppContext';
import { CashSession, CashSessionStatus, UserRole } from '../types';
import { useNavigate } from 'react-router-dom';

const CashMovement: React.FC = () => {
  const { cashSessions, establishments, currentUser, saveCashSession, users, refreshData } = useApp();
  const navigate = useNavigate();
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [openingValue, setOpeningValue] = useState(0);
  const [selectedRegister, setSelectedRegister] = useState('');

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const currentStore = establishments.find(e => e.id === currentUser?.storeId);

  const availableCashiers = useMemo(() => {
    return users.filter(u => (u.role === UserRole.CASHIER || u.role === UserRole.ADMIN || u.role === UserRole.MANAGER) && (isAdmin || u.storeId === currentUser?.storeId));
  }, [users, isAdmin, currentUser]);

  const filteredSessions = useMemo(() => {
    return cashSessions.filter(s => isAdmin || s.storeId === currentUser?.storeId);
  }, [cashSessions, isAdmin, currentUser]);

  const handleOpenCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRegister) { alert('Selecione um operador responsável'); return; }
    
    const newSession: CashSession = {
      id: `CASH-${Date.now()}`,
      storeId: currentUser?.storeId || 'MATRIZ',
      storeName: currentStore?.name || 'UNIDADE LOCAL',
      registerName: selectedRegister,
      openingTime: new Date().toLocaleString('pt-BR'),
      openingOperatorId: currentUser?.id,
      openingOperatorName: currentUser?.name,
      openingValue: openingValue,
      status: CashSessionStatus.OPEN,
      priceTable: 'TABELA PADRÃO'
    };
    
    await saveCashSession(newSession);
    await refreshData();
    setShowOpeningModal(false);
    alert('CAIXA ABERTO! O PDV já pode ser operado.');
    navigate('/pdv');
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
        <div>
           <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Controle de Movimento Diário</h2>
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gestão de abertura e fechamento de caixa por unidade</p>
        </div>
        <div className="flex gap-3">
           <button onClick={() => setShowOpeningModal(true)} className="px-8 py-4 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase shadow-lg shadow-emerald-500/20 flex items-center gap-2 hover:scale-105 transition-all"><span className="material-symbols-outlined">add_circle</span> Realizar Abertura</button>
           <button onClick={() => window.history.back()} className="px-6 py-4 bg-slate-100 dark:bg-slate-800 border rounded-2xl text-[10px] font-black uppercase">Voltar</button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border rounded-[2.5rem] overflow-hidden shadow-sm">
         <table className="w-full text-left text-[11px] font-bold">
            <thead className="bg-primary text-white">
               <tr><th className="px-8 py-4 uppercase">Terminal / Operador</th><th className="px-8 py-4 uppercase">Abertura</th><th className="px-8 py-4 uppercase">Status</th><th className="px-8 py-4 text-right uppercase">Ações</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
               {filteredSessions.map(session => (
                 <tr key={session.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-8 py-4 uppercase font-black">{session.registerName}</td>
                    <td className="px-8 py-4 text-slate-400 font-mono">{session.openingTime}</td>
                    <td className="px-8 py-4">
                       <span className={`px-4 py-1 rounded-full text-[9px] font-black text-white ${session.status === CashSessionStatus.OPEN ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-blue-500'}`}>{session.status}</span>
                    </td>
                    <td className="px-8 py-4 text-right">
                       <button className="text-primary hover:underline text-[10px] font-black uppercase">Detalhes</button>
                    </td>
                 </tr>
               ))}
               {filteredSessions.length === 0 && (
                  <tr><td colSpan={4} className="px-8 py-20 text-center opacity-30 uppercase font-black text-xs tracking-widest">Nenhuma sessão de caixa localizada</td></tr>
               )}
            </tbody>
         </table>
      </div>

      {showOpeningModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden border">
              <div className="p-8 bg-primary text-white flex justify-between items-center"><h3 className="font-black uppercase tracking-tight text-lg">Abertura de Caixa</h3><button onClick={() => setShowOpeningModal(false)}><span className="material-symbols-outlined text-2xl">close</span></button></div>
              <form onSubmit={handleOpenCash} className="p-10 space-y-6">
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Unidade Logada</label><div className="w-full h-14 bg-slate-100 dark:bg-slate-800 rounded-2xl px-6 flex items-center text-xs font-black uppercase text-primary border-none shadow-inner">{currentStore?.name}</div></div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Operador Responsável</label><select required value={selectedRegister} onChange={e => setSelectedRegister(e.target.value)} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-xs font-black uppercase focus:ring-2 focus:ring-primary shadow-sm"><option value="">SELECIONE O CAIXA...</option>{availableCashiers.map(u => <option key={u.id} value={`${u.name}`}>{u.name}</option>)}</select></div>
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-4">Fundo de Troco (R$)</label><input autoFocus type="number" step="0.01" required value={openingValue} onChange={e => setOpeningValue(parseFloat(e.target.value) || 0)} className="w-full h-16 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-2xl font-black text-primary text-center focus:ring-4 focus:ring-primary/10 transition-all shadow-inner" /></div>
                 <button type="submit" className="w-full h-16 bg-primary text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl hover:bg-blue-600 active:scale-95 transition-all">CONFIRMAR ABERTURA DIÁRIA</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default CashMovement;
