
import React, { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { Transaction, UserRole, Customer, User } from '../types';

const SalesInquiry: React.FC = () => {
  const { transactions, users, customers, currentUser, establishments, addTransaction, cashSessions } = useApp();
  
  const [filter, setFilter] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showOptionsId, setShowOptionsId] = useState<string | null>(null);
  const [viewingDetail, setViewingDetail] = useState<Transaction | null>(null);

  // Estados de Edição
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const currentStore = establishments.find(e => e.id === currentUser?.storeId);

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

  const totals = useMemo(() => {
    let qtyItems = 0;
    let totalValue = 0;
    sales.forEach(s => {
      totalValue += s.value;
      s.items?.forEach(i => qtyItems += i.quantity);
    });
    return { qtyItems, totalValue };
  }, [sales]);

  const getUserData = (userId?: string) => {
    return users.find(u => u.id === userId);
  };

  const handleUpdateVendor = async (vendorId: string) => {
    if (!selectedTransaction) return;
    await addTransaction({ ...selectedTransaction, vendorId });
    setShowVendorModal(false);
    setSelectedTransaction(null);
    if(viewingDetail?.id === selectedTransaction.id) {
       setViewingDetail({ ...selectedTransaction, vendorId });
    }
  };

  const handleUpdateCustomer = async (customerId: string) => {
    if (!selectedTransaction) return;
    const customer = customers.find(c => c.id === customerId);
    const updated = { ...selectedTransaction, clientId: customerId, client: customer?.name || 'Consumidor Final' };
    await addTransaction(updated);
    setShowCustomerModal(false);
    setSelectedTransaction(null);
    if(viewingDetail?.id === selectedTransaction.id) {
       setViewingDetail(updated);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-background-dark font-sans text-[11px] uppercase font-bold">
      
      {/* ESPELHO DE IMPRESSÃO */}
      <div id="print-area" className="hidden print:block p-8 bg-white text-black font-sans text-[10px]">
         {viewingDetail && (
           <div className="space-y-6">
              <div className="flex justify-between border-b-2 border-black pb-4">
                 <div><h1 className="text-xl font-black">DOCUMENTO DE VENDA</h1><p>LOJA: {viewingDetail.store}</p></div>
                 <div className="text-right"><p className="font-bold">ID: {viewingDetail.id}</p><p>DATA: {viewingDetail.date} 10:00</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4 border p-4">
                 <div><p className="font-black text-[8px]">CLIENTE:</p><p>{viewingDetail.client || 'CONSUMIDOR FINAL'}</p></div>
                 <div><p className="font-black text-[8px]">VENDEDOR:</p><p>{getUserData(viewingDetail.vendorId)?.name || 'BALCÃO'}</p></div>
              </div>
              <table className="w-full mt-4 text-left border-collapse">
                 <thead><tr className="border-b-2 border-black"><th>REF</th><th>PRODUTO</th><th className="text-right">QTD</th><th className="text-right">TOTAL</th></tr></thead>
                 <tbody>
                    {viewingDetail.items?.map((item, i) => (
                      <tr key={i} className="border-b"><td className="py-2">{item.sku}</td><td className="py-2">{item.name}</td><td className="py-2 text-right">{item.quantity}</td><td className="py-2 text-right">R$ {(item.quantity * item.salePrice).toLocaleString('pt-BR')}</td></tr>
                    ))}
                 </tbody>
                 <tfoot><tr className="font-black text-lg"><td colSpan={3} className="pt-4 text-right uppercase">Total:</td><td className="pt-4 text-right">R$ {viewingDetail.value.toLocaleString('pt-BR')}</td></tr></tfoot>
              </table>
           </div>
         )}
      </div>

      <div className="print:hidden h-full flex flex-col">
        <header className="bg-primary p-4 flex items-center justify-between text-white shadow-lg shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-lg p-1.5 flex items-center justify-center"><span className="material-symbols-outlined text-primary text-2xl">point_of_sale</span></div>
            <h1 className="text-sm font-black tracking-tight">DOCUMENTOS DE VENDAS PDV</h1>
          </div>
          <div className="flex items-center gap-2"><span className="size-2 bg-emerald-400 rounded-full animate-pulse"></span><span className="text-[10px] font-black uppercase">Sistema Online</span></div>
        </header>

        <div className="p-4 flex gap-2 bg-white dark:bg-slate-900 border-b">
          <button className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-slate-600">Filtro <span className="material-symbols-outlined text-sm">arrow_drop_down</span></button>
          <div className="flex-1 max-w-xs relative ml-2">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
              <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="PESQUISAR..." className="w-full h-9 bg-slate-50 dark:bg-slate-800 border rounded pl-10 text-[10px] uppercase outline-none" />
          </div>
        </div>

        <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="bg-primary text-white sticky top-0 z-20">
              <tr className="divide-x divide-white/10">
                <th className="px-3 py-2 text-center w-10">#</th>
                <th className="px-3 py-2 w-20 uppercase">Opções</th>
                <th className="px-3 py-2 w-24 uppercase">ID</th>
                <th className="px-3 py-2 w-32 uppercase">Loja</th>
                <th className="px-3 py-2 w-20 uppercase">Vend.</th>
                <th className="px-3 py-2 w-40 uppercase">Data</th>
                <th className="px-3 py-2 uppercase">Cliente</th>
                <th className="px-3 py-2 w-24 text-right uppercase">Itens</th>
                <th className="px-3 py-2 w-32 text-right uppercase">Vr. Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sales.map(s => (
                <tr key={s.id} onClick={() => setViewingDetail(s)} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 divide-x transition-colors cursor-pointer">
                  <td className="px-3 py-1.5 text-center"><div className="size-2 bg-blue-600 rounded-full mx-auto"></div></td>
                  <td className="px-3 py-1.5 relative" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowOptionsId(showOptionsId === s.id ? null : s.id)} className="bg-slate-100 dark:bg-slate-800 border rounded px-2 py-0.5 hover:bg-primary hover:text-white transition-all"><span className="material-symbols-outlined text-sm">list</span></button>
                    {showOptionsId === s.id && (
                      <div className="absolute left-full top-0 ml-1 z-50 bg-white dark:bg-slate-800 shadow-2xl border rounded-lg py-2 w-56 text-[10px]">
                          <button onClick={() => { setViewingDetail(s); setTimeout(() => window.print(), 100); setShowOptionsId(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 uppercase"><span className="material-symbols-outlined text-sm">print</span> Imprimir</button>
                          <button onClick={() => { setSelectedTransaction(s); setShowCustomerModal(true); setShowOptionsId(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 uppercase"><span className="material-symbols-outlined text-sm">person_edit</span> Alterar Cliente</button>
                          <button onClick={() => { setSelectedTransaction(s); setShowVendorModal(true); setShowOptionsId(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 uppercase"><span className="material-symbols-outlined text-sm">badge</span> Alterar Vendedor</button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-slate-400">{s.id.slice(-6)}</td>
                  <td className="px-3 py-1.5 text-primary">{s.store}</td>
                  <td className="px-3 py-1.5 text-primary truncate max-w-[80px]">{getUserData(s.vendorId)?.name.split(' ')[0] || '---'}</td>
                  <td className="px-3 py-1.5 text-slate-500">{s.date} 10:00</td>
                  <td className="px-3 py-1.5 truncate max-w-[200px] uppercase">{s.client || 'CONSUMIDOR FINAL'}</td>
                  <td className="px-3 py-1.5 text-right tabular-nums">{s.items?.reduce((acc, i) => acc + i.quantity, 0)}</td>
                  <td className="px-3 py-1.5 text-right font-black tabular-nums text-slate-900 dark:text-white">R$ {s.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <footer className="bg-slate-400 p-2 flex justify-between items-center text-slate-900 font-black shrink-0">
          <div className="flex items-center gap-4 text-xs uppercase tracking-widest"><span>Total Geral Pesquisa</span></div>
          <div className="flex gap-10 pr-4 tabular-nums"><span>{totals.qtyItems} Itens</span><span>R$ {totals.totalValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
        </footer>
      </div>

      {/* MODAL DETALHADO */}
      {viewingDetail && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 print:hidden animate-in fade-in">
           <div className="bg-slate-100 w-full max-w-[1100px] h-[90vh] rounded shadow-2xl flex flex-col overflow-hidden text-slate-700">
              <div className="bg-white p-3 border-b flex items-center justify-between shadow-sm">
                 <h2 className="text-sm font-bold flex items-center gap-2 uppercase tracking-tight">Informações Gerais do Documento</h2>
                 <div className="flex items-center gap-2">
                    <button onClick={() => window.print()} className="size-8 hover:bg-primary hover:text-white flex items-center justify-center rounded transition-all"><span className="material-symbols-outlined">print</span></button>
                    <button onClick={() => setViewingDetail(null)} className="size-8 hover:bg-rose-500 hover:text-white flex items-center justify-center rounded transition-all"><span className="material-symbols-outlined">close</span></button>
                 </div>
              </div>
              <div className="p-4 space-y-4 overflow-y-auto">
                 <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-2"><DetailField label="ID DOCUMENTO:" value={viewingDetail.id.slice(-8)} /></div>
                    <div className="col-span-10"><DetailField label="LOJA / UNIDADE:" value={viewingDetail.store} borderHighlight /></div>
                 </div>
                 <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-9"><DetailField label="CLIENTE:" value={viewingDetail.client || 'CONSUMIDOR FINAL'} borderHighlight /></div>
                    <div className="col-span-3"><DetailField label="DATA EMISSÃO:" value={`${viewingDetail.date} 10:00`} borderHighlight /></div>
                 </div>
                 <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-3"><DetailField label="REPRESENTANTE:" value="000275 - ALAGOAS" /></div>
                    <div className="col-span-3"><DetailField label="VENDEDOR:" value={getUserData(viewingDetail.vendorId)?.name || 'BALCÃO'} borderHighlight /></div>
                    {/* Campos de Caixa e Operador preenchidos com quem efetuou a venda */}
                    <div className="col-span-3"><DetailField label="CAIXA:" value={getUserData(viewingDetail.cashierId)?.name || 'SISTEMA'} borderHighlight /></div>
                    <div className="col-span-3"><DetailField label="OPERADOR:" value={getUserData(viewingDetail.cashierId)?.name || 'SISTEMA'} borderHighlight /></div>
                 </div>
                 <div className="bg-primary text-white flex items-center px-4 py-1.5 gap-8 mt-2 shadow-inner uppercase text-[9px] tracking-widest">
                    <button className="border-b-2 border-white pb-0.5">Itens do Documento</button>
                    <button className="opacity-60">Financeiro / Pagtos</button>
                 </div>
                 <div className="bg-white border border-slate-300 flex-1 min-h-[300px] shadow-inner">
                    <table className="w-full text-left text-[10px] border-collapse">
                       <thead className="bg-primary text-white sticky top-0 z-10"><tr><th className="px-2 py-2 uppercase">ID</th><th className="px-2 py-2 uppercase">SKU</th><th className="px-2 py-2 uppercase">Produto</th><th className="px-2 py-2 text-right uppercase">Qtd</th><th className="px-2 py-2 text-right uppercase">Vr. Unit</th><th className="px-2 py-2 text-right uppercase">Vr. Total</th></tr></thead>
                       <tbody className="divide-y divide-slate-100">
                          {viewingDetail.items?.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50 transition-colors uppercase">
                               <td className="px-2 py-2 text-slate-400 font-mono">{item.id.slice(-6)}</td>
                               <td className="px-2 py-2 font-black">{item.sku}</td>
                               <td className="px-2 py-2 truncate max-w-[400px]">{item.name}</td>
                               <td className="px-2 py-2 text-right font-black tabular-nums">{item.quantity}</td>
                               <td className="px-2 py-2 text-right tabular-nums">R$ {item.salePrice.toLocaleString('pt-BR')}</td>
                               <td className="px-2 py-2 text-right font-black tabular-nums">R$ {(item.quantity * item.salePrice).toLocaleString('pt-BR')}</td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAIS DE EDIÇÃO (RESTURADOS) */}
      {showVendorModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden">
              <div className="p-6 bg-primary text-white flex justify-between items-center uppercase tracking-widest text-xs font-black"><h3>Alterar Vendedor</h3><button onClick={() => setShowVendorModal(false)}><span className="material-symbols-outlined">close</span></button></div>
              <div className="p-8 space-y-4 max-h-60 overflow-y-auto custom-scrollbar">
                 {users.map(u => (
                   <button key={u.id} onClick={() => handleUpdateVendor(u.id)} className={`w-full text-left p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${selectedTransaction?.vendorId === u.id ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-primary/20'}`}>
                      <div className="size-8 rounded-full bg-slate-200 flex items-center justify-center font-black">{u.name.charAt(0)}</div>
                      <div><p className="text-xs font-black uppercase">{u.name}</p><p className="text-[9px] text-slate-400 font-bold uppercase">{u.role}</p></div>
                   </button>
                 ))}
              </div>
           </div>
        </div>
      )}

      {showCustomerModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 print:hidden animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden">
              <div className="p-6 bg-primary text-white flex justify-between items-center uppercase tracking-widest text-xs font-black"><h3>Alterar Cliente</h3><button onClick={() => setShowCustomerModal(false)}><span className="material-symbols-outlined">close</span></button></div>
              <div className="p-8 space-y-4 max-h-60 overflow-y-auto custom-scrollbar">
                 {customers.map(c => (
                   <button key={c.id} onClick={() => handleUpdateCustomer(c.id)} className={`w-full text-left p-4 rounded-xl border-2 flex items-center gap-3 transition-all ${selectedTransaction?.clientId === c.id ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-primary/20'}`}>
                      <div className="size-8 rounded bg-primary text-white flex items-center justify-center"><span className="material-symbols-outlined text-sm">person</span></div>
                      <div><p className="text-xs font-black uppercase">{c.name}</p><p className="text-[9px] text-slate-400 font-bold">{c.cpfCnpj || '---'}</p></div>
                   </button>
                 ))}
              </div>
           </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #root { display: block !important; }
          #print-area, #print-area * { visibility: visible !important; display: block !important; }
          #print-area { position: absolute !important; left: 0; top: 0; width: 100%; margin: 0; padding: 20px; background: white; color: black; }
          aside, header, footer, .fixed, .backdrop-blur, .print\\:hidden { display: none !important; opacity: 0 !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border-bottom: 1px solid #000 !important; padding: 4px !important; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>
    </div>
  );
};

const DetailField = ({ label, value, borderHighlight }: { label: string, value: string, borderHighlight?: boolean }) => (
  <div className="flex flex-col gap-0.5">
     <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</label>
     <div className={`h-8 bg-white border ${borderHighlight ? 'border-primary/40 rounded-lg' : 'border-slate-300'} px-2 flex items-center text-[10px] font-bold truncate shadow-inner`}>
        {value}
     </div>
  </div>
);

export default SalesInquiry;
