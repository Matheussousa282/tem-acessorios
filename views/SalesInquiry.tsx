
import React, { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { Transaction, UserRole, Customer, User } from '../types';

const SalesInquiry: React.FC = () => {
  const { transactions, users, customers, currentUser, establishments, addTransaction, cardOperators, cardBrands, systemConfig } = useApp();
  
  // Estados de Filtro
  const [filter, setFilter] = useState('');
  const [startDate, setStartDate] = useState(new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [storeFilter, setStoreFilter] = useState('TODAS');

  // Estados de Seleção e Modais
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const [showOptionsId, setShowOptionsId] = useState<string | null>(null);
  const [viewingDetail, setViewingDetail] = useState<Transaction | null>(null);
  const [activeDetailTab, setActiveDetailTab] = useState<'ITENS' | 'PAGAMENTO' | 'DEVOLUCOES'>('ITENS');
  const [showVendorModal, setShowVendorModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const currentStore = establishments.find(e => e.id === currentUser?.storeId);

  // Filtragem das Vendas
  const sales = useMemo(() => {
    return transactions.filter(t => {
      const isSale = t.type === 'INCOME' && (t.category === 'Venda' || t.category === 'Serviço');
      const matchesStore = isAdmin 
        ? (storeFilter === 'TODAS' || t.store === storeFilter)
        : (t.store === currentStore?.name);
      const matchesDate = t.date >= startDate && t.date <= endDate;
      const matchesSearch = !filter || 
        t.id.toLowerCase().includes(filter.toLowerCase()) || 
        t.client?.toLowerCase().includes(filter.toLowerCase());
      return isSale && matchesStore && matchesDate && matchesSearch;
    });
  }, [transactions, isAdmin, currentStore, filter, startDate, endDate, storeFilter]);

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
    if(viewingDetail?.id === selectedTransaction.id) setViewingDetail({ ...selectedTransaction, vendorId });
  };

  const handleUpdateCustomer = async (customerId: string) => {
    if (!selectedTransaction) return;
    const customer = customers.find(c => c.id === customerId);
    const updatedTx = { ...selectedTransaction, clientId: customerId, client: customer?.name || 'Consumidor Final' };
    await addTransaction(updatedTx);
    setShowCustomerModal(false);
    setSelectedTransaction(null);
    if(viewingDetail?.id === selectedTransaction.id) setViewingDetail(updatedTx);
  };

  const getUserData = (userId?: string) => users.find(u => u.id === userId);

  const getCardInfo = (opId?: string, brId?: string) => {
    const op = cardOperators.find(o => o.id === opId);
    const br = cardBrands.find(b => b.id === brId);
    return { operator: op?.name || '---', brand: br?.name || '---' };
  };

  const handleReprint = (sale: Transaction) => {
     setSelectedTransaction(sale);
     setTimeout(() => window.print(), 100);
  };

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-background-dark font-sans text-[11px] uppercase font-bold flex flex-col relative">
      
      {/* TEMPLATE DE REIMPRESSÃO (TÉRMICO) */}
      <div id="receipt-reprint-area" className="hidden print:block bg-white text-black font-mono text-[11px] leading-tight p-4">
        {selectedTransaction && (
          <>
            <div className="text-center space-y-1 mb-3 border-b-2 border-dashed border-black pb-2">
               <h2 className="text-[14px] font-black uppercase">{selectedTransaction.store}</h2>
               <div className="font-black text-[12px] pt-1">*** REIMPRESSÃO DE CUPOM ***</div>
            </div>
            <div className="space-y-1 mb-2 text-[10px]">
               <div className="flex justify-between font-bold"><span>DOC: {selectedTransaction.id}</span><span>{selectedTransaction.date}</span></div>
               <div className="uppercase">CLIENTE: {selectedTransaction.client || 'CONSUMIDOR FINAL'}</div>
               <div className="uppercase">VENDEDOR: {getUserData(selectedTransaction.vendorId)?.name || 'BALCÃO'}</div>
            </div>
            <div className="border-t border-b border-black py-1 mb-1 font-black flex justify-between uppercase text-[9px]">
               <span className="w-8">QTD</span><span className="flex-1 px-2">DESCRIÇÃO</span><span className="w-16 text-right">VALOR</span>
            </div>
            <div className="space-y-1 mb-3 text-[10px]">
               {selectedTransaction.items?.map((item, idx) => (
                 <div key={idx} className="flex justify-between items-start uppercase">
                    <span className="w-8">{item.quantity}</span><span className="flex-1 px-2">{item.name}</span><span className="w-16 text-right">{(item.quantity * item.salePrice).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                 </div>
               ))}
            </div>
            <div className="space-y-1 border-t border-black pt-2 mb-3 text-[11px]">
               <div className="flex justify-between text-[13px] font-black pt-1"><span>TOTAL GERAL:</span><span>R$ {selectedTransaction.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
            </div>
            <div className="bg-black/5 p-2 border border-black mb-4 text-[10px] space-y-1">
               <div className="font-black uppercase border-b border-black/10 pb-1">FORMA DE PAGAMENTO:</div>
               <div className="uppercase font-bold text-[11px]">{selectedTransaction.method} {selectedTransaction.installments ? `(${selectedTransaction.installments}X)` : ''}</div>
               {(selectedTransaction.cardOperatorId) && (
                 <div className="text-[8px] opacity-70">
                    <p>OPERADORA: {getCardInfo(selectedTransaction.cardOperatorId, selectedTransaction.cardBrandId).operator} | BANDEIRA: {getCardInfo(selectedTransaction.cardOperatorId, selectedTransaction.cardBrandId).brand}</p>
                    <p>NSU: {selectedTransaction.transactionSku || '---'} | AUTH: {selectedTransaction.authNumber || '---'}</p>
                 </div>
               )}
            </div>
            <div className="text-center space-y-1 pt-2 border-t border-dashed border-black text-[9px]"><p className="font-black">DOCUMENTO REIMPRESSO EM {new Date().toLocaleString()}</p></div>
          </>
        )}
      </div>

      <header className="bg-primary p-4 flex items-center justify-between text-white shadow-lg shrink-0 print:hidden">
        <div className="flex items-center gap-4">
           <div className="bg-white rounded-lg p-1.5 flex items-center justify-center"><span className="material-symbols-outlined text-primary text-2xl">receipt_long</span></div>
           <h1 className="text-sm font-black tracking-tight">DOCUMENTOS DE VENDAS PDV</h1>
        </div>
      </header>

      <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-end gap-4 shadow-sm print:hidden">
         <div className="space-y-1"><label className="text-[9px] text-slate-400 font-black px-1">DATA INICIAL:</label><div className="h-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 flex items-center gap-2"><span className="material-symbols-outlined text-slate-400 text-sm">calendar_today</span><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black outline-none focus:ring-0 p-0 w-24" /></div></div>
         <div className="space-y-1"><label className="text-[9px] text-slate-400 font-black px-1">DATA FINAL:</label><div className="h-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 flex items-center gap-2"><span className="material-symbols-outlined text-slate-400 text-sm">calendar_today</span><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black outline-none focus:ring-0 p-0 w-24" /></div></div>
         <div className="space-y-1"><label className="text-[9px] text-slate-400 font-black px-1">UNIDADE / LOJA:</label><div className="h-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 flex items-center gap-2"><span className="material-symbols-outlined text-slate-400 text-sm">store</span><select disabled={!isAdmin} value={storeFilter} onChange={e => setStoreFilter(e.target.value)} className="bg-transparent border-none text-[10px] font-black outline-none focus:ring-0 p-0 pr-8"><option value="TODAS">TODAS AS LOJAS</option>{establishments.map(est => <option key={est.id} value={est.name}>{est.name}</option>)}</select></div></div>
         <div className="flex-1 space-y-1"><label className="text-[9px] text-slate-400 font-black px-1">PESQUISA RÁPIDA (ID OU CLIENTE):</label><div className="relative"><span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">search</span><input value={filter} onChange={e => setFilter(e.target.value)} placeholder="DIGITE PARA BUSCAR..." className="w-full h-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded pl-10 text-[10px] font-black outline-none focus:ring-1 focus:ring-primary/30 uppercase" /></div></div>
         <button onClick={() => { setFilter(''); setStoreFilter('TODAS'); }} className="h-10 px-4 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[9px] font-black hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center gap-2"><span className="material-symbols-outlined text-sm">filter_alt_off</span> LIMPAR</button>
      </div>

      <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 print:hidden">
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
              <tr key={s.id} onClick={() => { setViewingDetail(s); setActiveDetailTab('ITENS'); }} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 divide-x divide-slate-100 dark:divide-slate-800 transition-colors cursor-pointer group">
                <td className="px-3 py-1.5 text-center"><div className="size-2.5 bg-blue-600 rounded-full mx-auto"></div></td>
                <td className="px-3 py-1.5 relative" onClick={(e) => e.stopPropagation()}>
                   <button onClick={() => setShowOptionsId(showOptionsId === s.id ? null : s.id)} className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 hover:bg-primary hover:text-white transition-all flex items-center justify-center"><span className="material-symbols-outlined text-sm">list</span></button>
                   {showOptionsId === s.id && (
                     <div className="absolute left-full top-0 ml-1 z-50 bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 rounded-lg py-2 w-56">
                        <p className="px-4 py-1 text-[9px] text-slate-400 font-black border-b mb-1">Ações Disponíveis</p>
                        <button onClick={() => handleReprint(s)} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><span className="material-symbols-outlined text-sm">print</span> 01 - Reimprimir Cupom</button>
                        <button onClick={() => { setSelectedTransaction(s); setShowCustomerModal(true); setShowOptionsId(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><span className="material-symbols-outlined text-sm">person_edit</span> 05 - Alterar Cliente</button>
                        <button onClick={() => { setSelectedTransaction(s); setShowVendorModal(true); setShowOptionsId(null); }} className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><span className="material-symbols-outlined text-sm">badge</span> 06 - Alterar Vendedor</button>
                     </div>
                   )}
                </td>
                <td className="px-3 py-1.5 font-mono text-slate-400">{s.id.slice(-6)}</td>
                <td className="px-3 py-1.5 text-primary">{s.store}</td>
                <td className="px-3 py-1.5 text-primary">{getUserData(s.vendorId)?.name.split(' ')[0] || '---'}</td>
                <td className="px-3 py-1.5 text-slate-500">{s.date}</td>
                <td className="px-3 py-1.5"><span className="truncate max-w-[200px] uppercase">{s.client || 'Consumidor Final'}</span></td>
                <td className="px-3 py-1.5 text-right font-black tabular-nums">{s.items?.reduce((acc, i) => acc + i.quantity, 0).toFixed(2)}</td>
                <td className="px-3 py-1.5 text-right font-black text-slate-900 dark:text-white tabular-nums">R$ {s.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="bg-slate-400 p-2 flex justify-between items-center text-slate-900 font-black shrink-0 print:hidden">
         <div className="flex items-center gap-4"><span className="text-[12px]">TOTAL GERAL PESQUISA</span></div>
         <div className="flex gap-10 pr-4"><span className="text-[12px] tabular-nums">{totals.qtyItems.toFixed(2).replace('.', ',')}</span><span className="text-[12px] tabular-nums">R$ {totals.totalValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
      </footer>

      {/* MODAL DETALHE (TELA) */}
      {viewingDetail && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 animate-in fade-in print:hidden">
           <div className="bg-slate-100 w-full max-w-[1200px] h-[90vh] rounded shadow-2xl flex flex-col overflow-hidden text-slate-700">
              <div className="bg-white p-3 border-b border-slate-300 flex items-center justify-between"><h2 className="text-sm font-bold flex items-center gap-2">Informações Gerais do Documento <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px]">VENDA</span></h2><button onClick={() => setViewingDetail(null)} className="size-8 hover:bg-rose-500 hover:text-white flex items-center justify-center rounded transition-all"><span className="material-symbols-outlined">close</span></button></div>
              <div className="p-4 space-y-4 overflow-y-auto">
                 <div className="grid grid-cols-12 gap-2"><div className="col-span-2"><DetailField label="ID:" value={viewingDetail.id.slice(-6)} /></div><div className="col-span-10"><DetailField label="LOJA:" value={viewingDetail.store} borderHighlight /></div></div>
                 <div className="grid grid-cols-12 gap-2"><div className="col-span-10"><DetailField label="CLIENTE:" value={viewingDetail.client || 'Consumidor Final'} borderHighlight /></div><div className="col-span-2"><DetailField label="DATA EMISSÃO:" value={viewingDetail.date} borderHighlight /></div></div>
                 <div className="grid grid-cols-12 gap-2"><div className="col-span-4"><DetailField label="VENDEDOR:" value={getUserData(viewingDetail.vendorId)?.name || 'NÃO INF.'} borderHighlight /></div><div className="col-span-4"><DetailField label="CAIXA:" value={getUserData(viewingDetail.cashierId)?.name || viewingDetail.method || 'SISTEMA'} borderHighlight /></div><div className="col-span-4"><button onClick={() => handleReprint(viewingDetail)} className="w-full h-12 bg-primary text-white rounded font-black uppercase text-[10px] shadow flex items-center justify-center gap-2 hover:bg-blue-600">Reimprimir Cupom</button></div></div>
                 <div className="bg-primary text-white flex items-center px-4 py-1.5 gap-8 mt-2">
                    <button onClick={() => setActiveDetailTab('ITENS')} className={`text-[10px] font-black pb-0.5 uppercase ${activeDetailTab === 'ITENS' ? 'border-b-2 border-white' : 'opacity-70'}`}>ITENS</button>
                    <button onClick={() => setActiveDetailTab('PAGAMENTO')} className={`text-[10px] font-black pb-0.5 uppercase ${activeDetailTab === 'PAGAMENTO' ? 'border-b-2 border-white' : 'opacity-70'}`}>FORMAS DE PAGAMENTO</button>
                 </div>
                 <div className="bg-white border border-slate-300 flex flex-col min-h-[300px]">
                    {activeDetailTab === 'ITENS' && (
                       <div className="overflow-auto flex-1">
                          <table className="w-full text-left border-collapse text-[10px]"><thead className="bg-primary text-white"><tr><th className="px-2 py-1">Produto</th><th className="px-2 py-1 text-right">Qtd.</th><th className="px-2 py-1 text-right">Vr. Unitário</th><th className="px-2 py-1 text-right">Vr. Total</th></tr></thead>
                          <tbody>{viewingDetail.items?.map((item, idx) => (<tr key={idx} className="hover:bg-slate-50 border-b"><td className="px-2 py-1"><span className="text-blue-600 font-black">{item.sku}</span> - {item.name}</td><td className="px-2 py-1 text-right font-black">{item.quantity.toFixed(2)}</td><td className="px-2 py-1 text-right">R$ {item.salePrice.toLocaleString('pt-BR')}</td><td className="px-2 py-1 text-right font-black">R$ {(item.quantity * item.salePrice).toLocaleString('pt-BR')}</td></tr>))}</tbody></table>
                       </div>
                    )}
                    {activeDetailTab === 'PAGAMENTO' && (
                       <div className="p-8 space-y-6">
                          <div className="grid grid-cols-3 gap-6"><div className="bg-slate-50 p-4 rounded border"><p className="text-[9px] text-slate-400">PAGAMENTO</p><p className="text-sm font-black">{viewingDetail.method || 'DINHEIRO'}</p></div><div className="bg-slate-50 p-4 rounded border"><p className="text-[9px] text-slate-400">TOTAL</p><p className="text-sm font-black text-emerald-600">R$ {viewingDetail.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p></div></div>
                          {(viewingDetail.cardOperatorId) && (<div className="grid grid-cols-4 gap-4"><div className="bg-white p-3 rounded border"><p className="text-[8px] text-slate-400">OPERADORA</p><p className="text-[10px] font-bold">{getCardInfo(viewingDetail.cardOperatorId, viewingDetail.cardBrandId).operator}</p></div><div className="bg-white p-3 rounded border"><p className="text-[8px] text-slate-400">BANDEIRA</p><p className="text-[10px] font-bold">{getCardInfo(viewingDetail.cardOperatorId, viewingDetail.cardBrandId).brand}</p></div><div className="bg-white p-3 rounded border"><p className="text-[8px] text-slate-400">NSU / AUTH</p><p className="text-[10px] font-bold">{viewingDetail.transactionSku || viewingDetail.authNumber || '---'}</p></div></div>)}
                       </div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; height: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; }
        @media print {
          body * { visibility: hidden !important; }
          #root { display: block !important; }
          .print\\:hidden, header, footer, div[class*="fixed"], div[class*="backdrop-blur"] { display: none !important; }
          #receipt-reprint-area, #receipt-reprint-area * { visibility: visible !important; display: block !important; }
          #receipt-reprint-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; max-width: 80mm !important; padding: 10px !important; margin: 0 !important; background: white !important; color: black !important; border: none !important; }
          @page { size: auto; margin: 0mm; }
        }
      `}</style>
    </div>
  );
};

const DetailField = ({ label, value, borderHighlight }: { label: string, value: string, borderHighlight?: boolean }) => (
  <div className="flex flex-col gap-0.5">
     <label className="text-[9px] font-black text-slate-500 uppercase">{label}</label>
     <div className={`h-8 bg-white border ${borderHighlight ? 'border-emerald-500/50 rounded-lg' : 'border-slate-300'} px-2 flex items-center text-[10px] font-bold truncate shadow-inner`}>{value}</div>
  </div>
);

export default SalesInquiry;
