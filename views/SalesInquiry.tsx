
import React, { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { Transaction, UserRole } from '../types';

const SalesInquiry: React.FC = () => {
  const { transactions, users, currentUser, establishments } = useApp();
  const [filter, setFilter] = useState('');
  const [viewingDetail, setViewingDetail] = useState<Transaction | null>(null);

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const currentStore = establishments.find(e => e.id === currentUser?.storeId);

  const sales = useMemo(() => {
    return transactions.filter(t => {
      const isSale = t.type === 'INCOME' && (t.category === 'Venda' || t.category === 'Serviço');
      const belongs = isAdmin || t.store === currentStore?.name;
      const match = !filter || t.id.includes(filter) || t.client?.toLowerCase().includes(filter.toLowerCase());
      return isSale && belongs && match;
    });
  }, [transactions, isAdmin, currentStore, filter]);

  const getUserData = (userId?: string) => users.find(u => u.id === userId);

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-background-dark font-sans text-[11px] uppercase font-bold">
      
      {/* ESPELHO DE IMPRESSÃO (LIMPO) */}
      <div id="print-area" className="hidden print:block p-8 bg-white text-black font-sans text-[10px]">
         {viewingDetail && (
           <div className="space-y-6">
              <div className="flex justify-between border-b-2 border-black pb-4">
                 <div><h1 className="text-xl font-black uppercase">Documento de Venda PDV</h1><p className="font-bold">UNIDADE: {viewingDetail.store}</p></div>
                 <div className="text-right"><p className="font-bold">ID: {viewingDetail.id}</p><p>DATA: {viewingDetail.date}</p></div>
              </div>
              <div className="grid grid-cols-2 gap-4 border p-4">
                 <div><p className="font-black text-[8px] uppercase text-slate-500">Cliente:</p><p className="font-bold">{viewingDetail.client || 'CONSUMIDOR FINAL'}</p></div>
                 <div><p className="font-black text-[8px] uppercase text-slate-500">Vendedor:</p><p className="font-bold">{getUserData(viewingDetail.vendorId)?.name || 'BALCÃO'}</p></div>
              </div>
              <table className="w-full mt-4 text-left border-collapse">
                 <thead><tr className="border-b-2 border-black font-black uppercase text-[8px]"><th>REF</th><th>PRODUTO</th><th className="text-right">QTD</th><th className="text-right">TOTAL</th></tr></thead>
                 <tbody>
                    {viewingDetail.items?.map((item, i) => (
                      <tr key={i} className="border-b"><td className="py-2">{item.sku}</td><td className="py-2 uppercase font-bold">{item.name}</td><td className="py-2 text-right">{item.quantity}</td><td className="py-2 text-right">R$ {(item.quantity * item.salePrice).toLocaleString('pt-BR')}</td></tr>
                    ))}
                 </tbody>
                 <tfoot><tr className="font-black text-lg"><td colSpan={3} className="pt-4 text-right uppercase tracking-widest">Total:</td><td className="pt-4 text-right">R$ {viewingDetail.value.toLocaleString('pt-BR')}</td></tr></tfoot>
              </table>
           </div>
         )}
      </div>

      <div className="print:hidden h-full flex flex-col">
        <header className="bg-primary p-4 flex items-center justify-between text-white shadow-lg shrink-0">
          <div className="flex items-center gap-4"><div className="bg-white rounded-lg p-1.5 flex items-center justify-center"><span className="material-symbols-outlined text-primary">point_of_sale</span></div><h1 className="text-sm font-black uppercase tracking-tight">Histórico de Documentos</h1></div>
          <div className="flex items-center gap-2"><span className="text-[10px] font-black uppercase tracking-widest">Sincronizado</span></div>
        </header>

        <div className="p-4 bg-white dark:bg-slate-900 border-b flex gap-2">
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="PESQUISAR VENDA OU CLIENTE..." className="flex-1 h-10 bg-slate-100 dark:bg-slate-800 rounded px-4 outline-none focus:ring-1 focus:ring-primary uppercase font-bold text-[10px]" />
        </div>

        <div className="flex-1 overflow-auto bg-white dark:bg-slate-900">
          <table className="w-full text-left border-collapse">
            <thead className="bg-primary text-white sticky top-0 z-10">
              <tr><th className="px-6 py-3 uppercase">ID</th><th className="px-6 py-3 uppercase">Unidade</th><th className="px-6 py-3 uppercase">Cliente</th><th className="px-6 py-3 uppercase">Data</th><th className="px-6 py-3 text-right uppercase">Vr. Total</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sales.map(s => (
                <tr key={s.id} onClick={() => setViewingDetail(s)} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer border-b transition-colors">
                  <td className="px-6 py-3 font-mono text-slate-400">{s.id.slice(-6)}</td>
                  <td className="px-6 py-3 text-primary">{s.store}</td>
                  <td className="px-6 py-3 uppercase font-bold">{s.client || 'Consumidor Final'}</td>
                  <td className="px-6 py-3 text-slate-500 font-bold">{s.date}</td>
                  <td className="px-6 py-3 text-right font-black">R$ {s.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL DETALHE */}
      {viewingDetail && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in print:hidden">
           <div className="bg-white dark:bg-slate-900 w-full max-w-5xl h-[85vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden text-slate-700">
              <div className="p-4 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                 <h2 className="text-sm font-black uppercase text-primary tracking-widest">Informações do Documento #{viewingDetail.id.slice(-8)}</h2>
                 <div className="flex gap-2">
                    <button onClick={() => window.print()} className="size-10 bg-white dark:bg-slate-700 hover:bg-primary hover:text-white rounded-xl flex items-center justify-center transition-all shadow-sm"><span className="material-symbols-outlined">print</span></button>
                    <button onClick={() => setViewingDetail(null)} className="size-10 bg-white dark:bg-slate-700 hover:bg-rose-500 hover:text-white rounded-xl flex items-center justify-center transition-all shadow-sm"><span className="material-symbols-outlined">close</span></button>
                 </div>
              </div>
              <div className="p-8 space-y-6 overflow-y-auto">
                 <div className="grid grid-cols-3 gap-6">
                    <div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Loja</p><p className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-black uppercase border">{viewingDetail.store}</p></div>
                    <div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vendedor</p><p className="p-3 bg-slate-50 dark:bg-slate-800 rounded-lg text-xs font-black uppercase border">{getUserData(viewingDetail.vendorId)?.name || 'NÃO INFORMADO'}</p></div>
                    <div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Operador Caixa</p><p className="p-3 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-black uppercase">{getUserData(viewingDetail.cashierId)?.name || 'SISTEMA'}</p></div>
                 </div>
                 <div className="space-y-1"><p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cliente Responsável</p><p className="p-4 bg-slate-50 dark:bg-slate-800 rounded-lg text-sm font-black uppercase border">{viewingDetail.client || 'CONSUMIDOR FINAL'}</p></div>
                 <div className="border dark:border-slate-800 rounded-2xl overflow-hidden shadow-inner">
                    <table className="w-full text-left text-[10px] border-collapse">
                       <thead className="bg-slate-50 dark:bg-slate-800/80 border-b"><tr><th className="px-4 py-3 uppercase tracking-widest font-black">Produto</th><th className="px-4 py-3 text-right uppercase tracking-widest font-black">Qtd</th><th className="px-4 py-3 text-right uppercase tracking-widest font-black">Vr. Total</th></tr></thead>
                       <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                          {viewingDetail.items?.map((item, i) => (
                            <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/40"><td className="px-4 py-3 uppercase font-bold">{item.name}</td><td className="px-4 py-3 text-right font-black">{item.quantity}</td><td className="px-4 py-3 text-right font-black text-primary">R$ {(item.quantity * item.salePrice).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                          ))}
                       </tbody>
                    </table>
                 </div>
              </div>
           </div>
        </div>
      )}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #root { display: block !important; }
          #print-area, #print-area * { visibility: visible !important; display: block !important; }
          #print-area { position: absolute !important; left: 0; top: 0; width: 100%; margin: 0; padding: 20px; background: white; color: black; border: none !important; }
          aside, header, footer, .fixed, .backdrop-blur, .print\\:hidden { display: none !important; opacity: 0 !important; }
          table { width: 100% !important; border-collapse: collapse !important; border: 1px solid #000 !important; }
          th, td { border-bottom: 1px solid #000 !important; padding: 6px !important; color: black !important; }
          @page { size: A4; margin: 10mm; }
        }
      `}</style>
    </div>
  );
};

export default SalesInquiry;
