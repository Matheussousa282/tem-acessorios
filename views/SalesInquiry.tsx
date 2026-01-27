
import React, { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { Transaction, UserRole, Customer, User } from '../types';

const SalesInquiry: React.FC = () => {
  const { transactions, users, customers, currentUser, establishments, addTransaction } = useApp();
  
  // Estados de Filtro
  const [filter, setFilter] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showOptionsId, setShowOptionsId] = useState<string | null>(null);

  // Estados de Edição
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const currentStore = establishments.find(e => e.id === currentUser?.storeId);

  // Filtragem das Vendas
  const sales = useMemo(() => {
    return transactions.filter(t => {
      const isSale = t.type === 'INCOME' && (t.category === 'Venda' || t.category === 'Serviço');
      const matchesStore = isAdmin || t.store === currentStore?.name;
      const matchesSearch = !filter || 
        t.id.toLowerCase().includes(filter.toLowerCase()) || 
        t.client?.toLowerCase().includes(filter.toLowerCase());
      return isSale && matchesStore && matchesSearch;
    });
  }, [transactions, isAdmin, currentStore, filter]);

  // Totais do Rodapé
  const totals = useMemo(() => {
    let qtyItems = 0;
    let totalValue = 0;
    sales.forEach(s => {
      totalValue += s.value;
      s.items?.forEach(i => qtyItems += i.quantity);
    });
    return { qtyItems, totalValue };
  }, [sales]);

  const handleUpdateVendor = async (vendorId: string) => {
    if (!selectedTransaction) return;
    const vendor = users.find(u => u.id === vendorId);
    await addTransaction({
      ...selectedTransaction,
      vendorId: vendorId
    });
    setShowVendorModal(false);
    setSelectedTransaction(null);
  };

  const handleUpdateCustomer = async (customerId: string) => {
    if (!selectedTransaction) return;
    const customer = customers.find(c => c.id === customerId);
    await addTransaction({
      ...selectedTransaction,
      clientId: customerId,
      client: customer?.name || 'Consumidor Final'
    });
    setShowCustomerModal(false);
    setSelectedTransaction(null);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-background-dark font-sans text-[11px] uppercase font-bold">
      
      {/* HEADER AZUL PREMIUM */}
      <header className="bg-primary p-4 flex items-center justify-between text-white shadow-lg shrink-0">
        <div className="flex items-center gap-4">
           <div className="bg-white rounded-lg p-1.5 flex items-center justify-center">
              <span className="material-symbols-outlined text-primary text-2xl">point_of_sale</span>
           </div>
           <h1 className="text-sm font-black tracking-tight">Registro de Documentos de Vendas via PDV</h1>
        </div>
        <div className="flex items-center gap-6">
           <div className="flex items-center gap-2">
              <span className="size-2 bg-emerald-400 rounded-full animate-pulse"></span>
              <span className="text-[10px] font-black">SISTEMA ONLINE</span>
           </div>
           <div className="flex items-center gap-3 border-l border-white/20 pl-6">
              <div className="text-right">
                 <p className="text-[10px] leading-none">{currentUser?.name}</p>
                 <div className="flex gap-0.5 mt-1">
                    {[1,2,3,4,5].map(i => <span key={i} className="material-symbols-outlined text-[10px] text-amber-400">star</span>)}
                 </div>
              </div>
              <div className="size-8 rounded-full bg-white/20 flex items-center justify-center overflow-hidden">
                 {currentUser?.avatar ? <img src={currentUser.avatar} className="size-full object-cover" /> : <span className="material-symbols-outlined text-lg">person</span>}
              </div>
           </div>
        </div>
      </header>

      {/* BARRA DE FILTROS */}
      <div className="p-4 flex gap-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
         <button className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-slate-600">
            Filtro <span className="material-symbols-outlined text-sm">arrow_drop_down</span>
         </button>
         <button className="px-4 py-2 bg-amber-500 text-white rounded shadow-sm flex items-center gap-2">
            <span className="material-symbols-outlined text-sm">list_alt</span> Funcionalidades
         </button>
         <div className="flex-1 max-w-xs relative ml-4">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
            <input 
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="PESQUISAR DOCUMENTO OU CLIENTE..." 
              className="w-full h-9 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded pl-10 text-[10px] outline-none focus:ring-1 focus:ring-primary/30" 
            />
         </div>
      </div>

      {/* TABELA DE DOCUMENTOS (GRID DENSO) */}
      <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
        <table className="w-full text-left border-collapse min-w-[1600px]">
          <thead className="bg-primary text-white sticky top-0 z-20">
            <tr className="divide-x divide-white/10">
              <th className="px-3 py-2 text-center w-10"><span className="material-symbols-outlined text-sm">settings</span></th>
              <th className="px-3 py-2 w-20">Opções</th>
              <th className="px-3 py-2 w-24">ID</th>
              <th className="px-3 py-2 w-20">Tipo</th>
              <th className="px-3 py-2 w-20">Estab.</th>
              <th className="px-3 py-2 w-20">Rep.</th>
              <th className="px-3 py-2 w-20">Corretor</th>
              <th className="px-3 py-2 w-20">Vend.</th>
              <th className="px-3 py-2 w-24">Número</th>
              <th className="px-3 py-2 w-16">Série</th>
              <th className="px-3 py-2 w-40">Data de Emissão</th>
              <th className="px-3 py-2 w-40">Canal de Vendas</th>
              <th className="px-3 py-2">Cliente</th>
              <th className="px-3 py-2 w-40">CPF/CNPJ</th>
              <th className="px-3 py-2 w-14 text-center">Est.</th>
              <th className="px-3 py-2 w-14 text-center">Cont.</th>
              <th className="px-3 py-2 w-14 text-center">Fin.</th>
              <th className="px-3 py-2 w-24 text-right">Qtd. Itens</th>
              <th className="px-3 py-2 w-32 text-right">Vr. Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {sales.map(s => (
              <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 divide-x divide-slate-100 dark:divide-slate-800 transition-colors">
                <td className="px-3 py-1.5 text-center">
                   <div className="size-2.5 bg-blue-600 rounded-full mx-auto"></div>
                </td>
                <td className="px-3 py-1.5 relative">
                   <button 
                     onClick={() => setShowOptionsId(showOptionsId === s.id ? null : s.id)}
                     className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 hover:bg-primary hover:text-white transition-all flex items-center justify-center"
                   >
                      <span className="material-symbols-outlined text-sm">list</span>
                   </button>
                   
                   {showOptionsId === s.id && (
                     <div className="absolute left-full top-0 ml-1 z-50 bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 rounded-lg py-2 w-56 animate-in slide-in-from-left-2">
                        <p className="px-4 py-1 text-[9px] text-slate-400 font-black border-b border-slate-100 dark:border-slate-700 mb-1">Ações Disponíveis</p>
                        <button onClick={() => { window.print(); setShowOptionsId(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><span className="material-symbols-outlined text-sm">print</span> 01 - Imprimir</button>
                        <button onClick={() => { setSelectedTransaction(s); setShowCustomerModal(true); setShowOptionsId(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><span className="material-symbols-outlined text-sm">person_edit</span> 05 - Alterar Cliente</button>
                        <button onClick={() => { setSelectedTransaction(s); setShowVendorModal(true); setShowOptionsId(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><span className="material-symbols-outlined text-sm">badge</span> 06 - Alterar Vendedor</button>
                     </div>
                   )}
                </td>
                <td className="px-3 py-1.5 font-mono text-slate-400">{s.id.slice(-6)}</td>
                <td className="px-3 py-1.5"><span className="bg-blue-50 text-blue-600 border border-blue-200 rounded-full px-2 py-0.5 text-[9px]">NFC</span></td>
                <td className="px-3 py-1.5 text-primary">0024</td>
                <td className="px-3 py-1.5 text-primary">00275</td>
                <td className="px-3 py-1.5 text-primary">0000</td>
                <td className="px-3 py-1.5 text-primary">{s.vendorId?.slice(-5) || '00097'}</td>
                <td className="px-3 py-1.5 font-black text-slate-900 dark:text-white">{s.id.split('-')[1]?.slice(-5) || '23415'}</td>
                <td className="px-3 py-1.5 text-slate-400">005</td>
                <td className="px-3 py-1.5 text-slate-500">{s.date} 10:00</td>
                <td className="px-3 py-1.5 text-slate-400">0007 - ATACADO</td>
                <td className="px-3 py-1.5">
                   <div className="flex items-center gap-2">
                      <div className="size-2 bg-primary rotate-45"></div>
                      <span className="truncate max-w-[200px] text-slate-700 dark:text-slate-200 uppercase">{s.client || 'Consumidor Final'}</span>
                   </div>
                </td>
                <td className="px-3 py-1.5 text-slate-500">000.000.000-00</td>
                <td className="px-3 py-1.5 text-center"><span className="material-symbols-outlined text-emerald-500 text-sm">check</span></td>
                <td className="px-3 py-1.5 text-center"><span className="material-symbols-outlined text-emerald-500 text-sm">check</span></td>
                <td className="px-3 py-1.5 text-center"><span className="material-symbols-outlined text-emerald-500 text-sm">check</span></td>
                <td className="px-3 py-1.5 text-right font-black tabular-nums">{s.items?.reduce((acc, i) => acc + i.quantity, 0).toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right font-black text-slate-900 dark:text-white tabular-nums">R$ {s.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* RODAPÉ DE TOTAIS (CONFORME IMAGEM) */}
      <footer className="bg-slate-400 p-2 flex justify-between items-center text-slate-900 font-black shrink-0">
         <div className="flex items-center gap-4">
            <span className="text-[12px]">TOTAL</span>
         </div>
         <div className="flex gap-10 pr-4">
            <span className="text-[12px] tabular-nums">{totals.qtyItems.toFixed(2).replace('.', ',')}</span>
            <span className="text-[12px] tabular-nums">R$ {totals.totalValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
         </div>
      </footer>

      {/* MODAL ALTERAR VENDEDOR */}
      {showVendorModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-6 bg-primary text-white flex justify-between items-center">
                 <h3 className="font-black uppercase">Alterar Vendedor do Documento</h3>
                 <button onClick={() => setShowVendorModal(false)}><span className="material-symbols-outlined">close</span></button>
              </div>
              <div className="p-8 space-y-4">
                 <p className="text-[10px] text-slate-400 font-black">DOCUMENTO SELECIONADO: #{selectedTransaction?.id}</p>
                 <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {users.map(u => (
                      <button 
                        key={u.id} 
                        onClick={() => handleUpdateVendor(u.id)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${selectedTransaction?.vendorId === u.id ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-primary/20'}`}
                      >
                         <div className="size-8 rounded-full bg-slate-200 flex items-center justify-center text-[10px]">{u.name.charAt(0)}</div>
                         <div><p className="text-xs font-black uppercase text-slate-700">{u.name}</p><p className="text-[9px] text-slate-400">{u.role}</p></div>
                      </button>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAL ALTERAR CLIENTE */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 overflow-hidden">
              <div className="p-6 bg-primary text-white flex justify-between items-center">
                 <h3 className="font-black uppercase">Alterar Cliente do Documento</h3>
                 <button onClick={() => setShowCustomerModal(false)}><span className="material-symbols-outlined">close</span></button>
              </div>
              <div className="p-8 space-y-4">
                 <p className="text-[10px] text-slate-400 font-black">CLIENTE ATUAL: {selectedTransaction?.client}</p>
                 <div className="grid grid-cols-1 gap-2 max-h-60 overflow-y-auto custom-scrollbar">
                    {customers.map(c => (
                      <button 
                        key={c.id} 
                        onClick={() => handleUpdateCustomer(c.id)}
                        className={`w-full text-left p-4 rounded-xl border-2 transition-all flex items-center gap-3 ${selectedTransaction?.clientId === c.id ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-primary/20'}`}
                      >
                         <div className="size-8 rounded bg-primary text-white flex items-center justify-center"><span className="material-symbols-outlined text-sm">person</span></div>
                         <div><p className="text-xs font-black uppercase text-slate-700">{c.name}</p><p className="text-[9px] text-slate-400">{c.cpfCnpj || '---'}</p></div>
                      </button>
                    ))}
                 </div>
              </div>
           </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; }
      `}</style>
    </div>
  );
};

export default SalesInquiry;
