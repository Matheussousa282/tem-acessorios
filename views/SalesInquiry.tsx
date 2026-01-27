
import React, { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { Transaction, UserRole, Customer, User } from '../types';

const SalesInquiry: React.FC = () => {
  const { transactions, users, customers, currentUser, establishments, addTransaction, cashSessions } = useApp();
  
  // Estados de Filtro e Seleção
  const [filter, setFilter] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showOptionsId, setShowOptionsId] = useState<string | null>(null);
  
  // Estado para o Modal Detalhado
  const [viewingDetail, setViewingDetail] = useState<Transaction | null>(null);

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

  // Totais do Rodapé da Lista Geral
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
    const updated = {
      ...selectedTransaction,
      clientId: customerId,
      client: customer?.name || 'Consumidor Final'
    };
    await addTransaction(updated);
    setShowCustomerModal(false);
    setSelectedTransaction(null);
    if(viewingDetail?.id === selectedTransaction.id) {
       setViewingDetail(updated);
    }
  };

  const getUserData = (userId?: string) => {
    return users.find(u => u.id === userId);
  };

  const handlePrint = (t: Transaction) => {
    setViewingDetail(t);
    setTimeout(() => window.print(), 200);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-background-dark font-sans text-[11px] uppercase font-bold">
      
      {/* ESPELHO DE IMPRESSÃO (Oculto em tela) */}
      <div id="print-area" className="hidden print:block p-8 bg-white text-black font-sans text-[10px]">
         {viewingDetail && (
           <div className="space-y-6">
              <div className="flex justify-between border-b-2 border-black pb-4">
                 <div>
                    <h1 className="text-xl font-black">DETALHE DO DOCUMENTO FISCAL</h1>
                    <p>UNIDADE: {viewingDetail.store}</p>
                 </div>
                 <div className="text-right">
                    <p className="font-bold">DOC: {viewingDetail.id.split('-')[1] || viewingDetail.id}</p>
                    <p>DATA: {viewingDetail.date} 10:00</p>
                 </div>
              </div>
              <div className="grid grid-cols-2 gap-4 border p-4">
                 <div><p className="font-black text-[8px]">CLIENTE:</p><p>{viewingDetail.client || 'CONSUMIDOR FINAL'}</p></div>
                 <div><p className="font-black text-[8px]">VENDEDOR:</p><p>{getUserData(viewingDetail.vendorId)?.name || 'BALCÃO'}</p></div>
              </div>
              <table className="w-full text-left mt-4 border-collapse">
                 <thead><tr className="border-b-2 border-black"><th>PRODUTO</th><th className="text-right">QTD</th><th className="text-right">UNIT</th><th className="text-right">TOTAL</th></tr></thead>
                 <tbody>
                    {viewingDetail.items?.map((item, i) => (
                      <tr key={i} className="border-b">
                         <td className="py-2">{item.sku} - {item.name}</td>
                         <td className="py-2 text-right">{item.quantity}</td>
                         <td className="py-2 text-right">R$ {item.salePrice.toLocaleString('pt-BR')}</td>
                         <td className="py-2 text-right">R$ {(item.quantity * item.salePrice).toLocaleString('pt-BR')}</td>
                      </tr>
                    ))}
                 </tbody>
                 <tfoot>
                    <tr className="font-black text-lg">
                       <td colSpan={3} className="pt-4 text-right">TOTAL DO DOCUMENTO:</td>
                       <td className="pt-4 text-right">R$ {viewingDetail.value.toLocaleString('pt-BR')}</td>
                    </tr>
                 </tfoot>
              </table>
           </div>
         )}
      </div>

      <div className="print:hidden h-full flex flex-col">
        {/* HEADER AZUL PREMIUM */}
        <header className="bg-primary p-4 flex items-center justify-between text-white shadow-lg shrink-0">
          <div className="flex items-center gap-4">
            <div className="bg-white rounded-lg p-1.5 flex items-center justify-center">
                <span className="material-symbols-outlined text-primary text-2xl">point_of_sale</span>
            </div>
            <h1 className="text-sm font-black tracking-tight">DOCUMENTOS DE VENDAS PDV</h1>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
                <span className="size-2 bg-emerald-400 rounded-full animate-pulse"></span>
                <span className="text-[10px] font-black">SISTEMA ONLINE</span>
            </div>
          </div>
        </header>

        {/* FILTROS */}
        <div className="p-4 flex gap-2 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800">
          <button className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded border border-slate-200 dark:border-slate-700 flex items-center gap-2 text-slate-600">
              Filtro <span className="material-symbols-outlined text-sm">arrow_drop_down</span>
          </button>
          <div className="flex-1 max-w-xs relative ml-2">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span>
              <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="PESQUISAR DOCUMENTO OU CLIENTE..." className="w-full h-9 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded pl-10 text-[10px] outline-none" />
          </div>
        </div>

        {/* TABELA */}
        <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
          <table className="w-full text-left border-collapse min-w-[1200px]">
            <thead className="bg-primary text-white sticky top-0 z-20">
              <tr className="divide-x divide-white/10">
                <th className="px-3 py-2 text-center w-10"><span className="material-symbols-outlined text-sm">settings</span></th>
                <th className="px-3 py-2 w-20">Opções</th>
                <th className="px-3 py-2 w-24">ID</th>
                <th className="px-3 py-2 w-32">Loja</th>
                <th className="px-3 py-2 w-20">Vend.</th>
                <th className="px-3 py-2 w-40">Data de Emissão</th>
                <th className="px-3 py-2">Cliente</th>
                <th className="px-3 py-2 w-24 text-right">Qtd. Itens</th>
                <th className="px-3 py-2 w-32 text-right">Vr. Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sales.map(s => (
                <tr key={s.id} onClick={() => setViewingDetail(s)} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 divide-x transition-colors cursor-pointer">
                  <td className="px-3 py-1.5 text-center"><div className="size-2.5 bg-blue-600 rounded-full mx-auto"></div></td>
                  <td className="px-3 py-1.5 relative" onClick={e => e.stopPropagation()}>
                    <button onClick={() => setShowOptionsId(showOptionsId === s.id ? null : s.id)} className="bg-slate-100 dark:bg-slate-800 border rounded px-2 py-0.5 hover:bg-primary hover:text-white transition-all">
                        <span className="material-symbols-outlined text-sm">list</span>
                    </button>
                    {showOptionsId === s.id && (
                      <div className="absolute left-full top-0 ml-1 z-50 bg-white dark:bg-slate-800 shadow-2xl border rounded-lg py-2 w-56 text-[10px]">
                          <button onClick={() => { handlePrint(s); setShowOptionsId(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><span className="material-symbols-outlined text-sm">print</span> 01 - Imprimir</button>
                          <button onClick={() => { setSelectedTransaction(s); setShowCustomerModal(true); setShowOptionsId(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><span className="material-symbols-outlined text-sm">person_edit</span> 05 - Alterar Cliente</button>
                          <button onClick={() => { setSelectedTransaction(s); setShowVendorModal(true); setShowOptionsId(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><span className="material-symbols-outlined text-sm">badge</span> 06 - Alterar Vendedor</button>
                      </div>
                    )}
                  </td>
                  <td className="px-3 py-1.5 font-mono text-slate-400">{s.id.slice(-6)}</td>
                  <td className="px-3 py-1.5 text-primary">{s.store}</td>
                  <td className="px-3 py-1.5 text-primary">{getUserData(s.vendorId)?.name.split(' ')[0] || '---'}</td>
                  <td className="px-3 py-1.5 text-slate-500">{s.date} 10:00</td>
                  <td className="px-3 py-1.5 uppercase truncate max-w-[200px]">{s.client || 'Consumidor Final'}</td>
                  <td className="px-3 py-1.5 text-right font-black tabular-nums">{s.items?.reduce((acc, i) => acc + i.quantity, 0).toFixed(2)}</td>
                  <td className="px-3 py-1.5 text-right font-black text-slate-900 dark:text-white tabular-nums">R$ {s.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* RODAPÉ */}
        <footer className="bg-slate-400 p-2 flex justify-between items-center text-slate-900 font-black shrink-0">
          <div className="flex items-center gap-4"><span className="text-[12px]">TOTAL GERAL PESQUISA</span></div>
          <div className="flex gap-10 pr-4">
              <span className="text-[12px] tabular-nums">{totals.qtyItems.toFixed(2).replace('.', ',')}</span>
              <span className="text-[12px] tabular-nums">R$ {totals.totalValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
          </div>
        </footer>
      </div>

      {/* MODAL DETALHADO */}
      {viewingDetail && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 print:hidden animate-in fade-in">
           <div className="bg-slate-100 w-full max-w-[1200px] h-[90vh] rounded shadow-2xl flex flex-col overflow-hidden text-slate-700">
              <div className="bg-white p-3 border-b border-slate-300 flex items-center justify-between">
                 <h2 className="text-sm font-bold flex items-center gap-2">Informações Gerais do Documento <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px]">NFC</span></h2>
                 <div className="flex items-center gap-2">
                    <button onClick={() => window.print()} className="size-8 hover:bg-primary hover:text-white flex items-center justify-center rounded transition-all"><span className="material-symbols-outlined">print</span></button>
                    <button onClick={() => setViewingDetail(null)} className="size-8 hover:bg-rose-500 hover:text-white flex items-center justify-center rounded transition-all"><span className="material-symbols-outlined">close</span></button>
                 </div>
              </div>
              <div className="p-4 space-y-4 overflow-y-auto">
                 <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-2"><DetailField label="ID:" value={viewingDetail.id.slice(-6)} /></div>
                    <div className="col-span-10"><DetailField label="LOJA:" value={viewingDetail.store} borderHighlight /></div>
                 </div>
                 <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-10"><DetailField label="CLIENTE:" value={viewingDetail.client || 'Consumidor Final'} borderHighlight /></div>
                    <div className="col-span-2"><DetailField label="DATA EMISSÃO:" value={`${viewingDetail.date} 10:00`} borderHighlight /></div>
                 </div>
                 <div className="grid grid-cols-12 gap-2">
                    <div className="col-span-3"><DetailField label="REPRESENTANTE:" value="000275 - ALAGOAS" /></div>
                    <div className="col-span-3"><DetailField label="VENDEDOR:" value={getUserData(viewingDetail.vendorId)?.name || 'BALCÃO'} borderHighlight /></div>
                    {/* MOSTRANDO O OPERADOR REAL QUE PASSOU A VENDA */}
                    <div className="col-span-3"><DetailField label="CAIXA:" value={getUserData(viewingDetail.cashierId)?.name || 'SISTEMA'} borderHighlight /></div>
                    <div className="col-span-3"><DetailField label="OPERADOR:" value={getUserData(viewingDetail.cashierId)?.name || 'SISTEMA'} borderHighlight /></div>
                 </div>
                 <div className="bg-primary text-white flex items-center px-4 py-1.5 gap-8 mt-2">
                    <button className="text-[10px] font-black border-b-2 border-white pb-0.5">ITENS</button>
                    <button className="text-[10px] font-black opacity-70">PAGAMENTO</button>
                 </div>
                 <div className="bg-white border border-slate-300 flex-1 min-h-[300px]">
                    <table className="w-full text-left text-[10px] border-collapse">
                       <thead className="bg-primary text-white sticky top-0"><tr><th className="px-2 py-1">ID</th><th className="px-2 py-1">SKU</th><th>PRODUTO</th><th className="text-right">QTD</th><th className="text-right">VR. UNIT</th><th className="text-right">VR. TOTAL</th></tr></thead>
                       <tbody className="divide-y">
                          {viewingDetail.items?.map((item, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                               <td className="px-2 py-1 text-slate-400">{item.id.slice(-6)}</td>
                               <td className="px-2 py-1 font-bold">{item.sku}</td>
                               <td className="px-2 py-1 uppercase">{item.name}</td>
                               <td className="px-2 py-1 text-right font-black">{item.quantity}</td>
                               <td className="px-2 py-1 text-right">R$ {item.salePrice.toLocaleString('pt-BR')}</td>
                               <td className="px-2 py-1 text-right font-black">R$ {(item.quantity * item.salePrice).toLocaleString('pt-BR')}</td>
                            </tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAIS DE EDIÇÃO (MANTIDOS) */}
      {showVendorModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in print:hidden">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden">
              <div className="p-6 bg-primary text-white flex justify-between items-center"><h3 className="font-black uppercase">Alterar Vendedor</h3><button onClick={() => setShowVendorModal(false)}><span className="material-symbols-outlined">close</span></button></div>
              <div className="p-8 space-y-4 max-h-60 overflow-y-auto">
                 {users.map(u => (
                   <button key={u.id} onClick={() => handleUpdateVendor(u.id)} className={`w-full text-left p-4 rounded-xl border-2 flex items-center gap-3 ${selectedTransaction?.vendorId === u.id ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-primary/20'}`}>
                      <div className="size-8 rounded-full bg-slate-200 flex items-center justify-center">{u.name.charAt(0)}</div>
                      <div><p className="text-xs font-black uppercase">{u.name}</p><p className="text-[9px] text-slate-400">{u.role}</p></div>
                   </button>
                 ))}
              </div>
           </div>
        </div>
      )}

      {showCustomerModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in print:hidden">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden">
              <div className="p-6 bg-primary text-white flex justify-between items-center"><h3 className="font-black uppercase">Alterar Cliente</h3><button onClick={() => setShowCustomerModal(false)}><span className="material-symbols-outlined">close</span></button></div>
              <div className="p-8 space-y-4 max-h-60 overflow-y-auto">
                 {customers.map(c => (
                   <button key={c.id} onClick={() => handleUpdateCustomer(c.id)} className={`w-full text-left p-4 rounded-xl border-2 flex items-center gap-3 ${selectedTransaction?.clientId === c.id ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-primary/20'}`}>
                      <div className="size-8 rounded bg-primary text-white flex items-center justify-center"><span className="material-symbols-outlined text-sm">person</span></div>
                      <div><p className="text-xs font-black uppercase">{c.name}</p><p className="text-[9px] text-slate-400">{c.cpfCnpj || '---'}</p></div>
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
     <label className="text-[9px] font-black text-slate-500 uppercase">{label}</label>
     <div className={`h-8 bg-white border ${borderHighlight ? 'border-emerald-500/50 rounded-lg' : 'border-slate-300'} px-2 flex items-center text-[10px] font-bold truncate shadow-inner`}>
        {value}
     </div>
  </div>
);

export default SalesInquiry;
