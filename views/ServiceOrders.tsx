
import React, { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import { ServiceOrder, ServiceOrderStatus, UserRole, Product, TransactionStatus } from '../types';
import { useLocation } from 'react-router-dom';

const ServiceOrders: React.FC = () => {
  const { serviceOrders, updateServiceOrder, currentUser, products, addProduct, deleteProduct, establishments, addTransaction } = useApp();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const initialTab = query.get('tab') || 'list';
  
  const [activeTab, setActiveTab] = useState(initialTab);
  const [filterStatus, setFilterStatus] = useState<string>('TODAS');
  const [selectedOS, setSelectedOS] = useState<ServiceOrder | null>(null);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('Pix');

  const [showServiceModal, setShowServiceModal] = useState(false);
  const [editingServiceId, setEditingServiceId] = useState<string | null>(null);
  const [serviceForm, setServiceForm] = useState<Partial<Product>>({
    name: '', sku: '', category: 'Serviços', salePrice: 0, costPrice: 0, 
    isService: true, stock: 999999, marginPercent: 0, otherCostsPercent: 0, commissionPercent: 0
  });

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const currentStore = establishments.find(e => e.id === currentUser?.storeId);

  const servicesCatalog = useMemo(() => products.filter(p => p.isService), [products]);

  const filteredOS = useMemo(() => {
    return serviceOrders.filter(os => {
      const matchesStore = isAdmin || os.store === currentStore?.name;
      const matchesStatus = filterStatus === 'TODAS' || os.status === filterStatus;
      return matchesStore && matchesStatus;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [serviceOrders, filterStatus, isAdmin, currentStore]);

  const handleUpdateStatus = (os: ServiceOrder, newStatus: ServiceOrderStatus) => {
    if (newStatus === ServiceOrderStatus.FINISHED) {
      setSelectedOS(os);
      setShowPaymentModal(true);
      return;
    }
    updateServiceOrder({ ...os, status: newStatus });
    if (selectedOS?.id === os.id) setSelectedOS({ ...os, status: newStatus });
  };

  const handleFinalizeAndPay = async () => {
    if (!selectedOS) return;
    try {
      await addTransaction({
        id: `PAY-OS-${Date.now()}`,
        date: new Date().toISOString().split('T')[0],
        description: `Recebimento de OS #${selectedOS.id}`,
        store: selectedOS.store,
        category: 'Serviço',
        status: TransactionStatus.PAID,
        value: selectedOS.totalValue,
        type: 'INCOME',
        method: paymentMethod,
        client: selectedOS.customerName,
        clientId: selectedOS.customerId,
        items: selectedOS.items
      });
      const updated = { ...selectedOS, status: ServiceOrderStatus.FINISHED };
      await updateServiceOrder(updated);
      setSelectedOS(updated);
      setShowPaymentModal(false);
    } catch (e) {
      alert("Erro ao processar recebimento.");
    }
  };

  const handlePrintOS = () => {
    window.print();
  };

  const handlePriceChange = (field: string, value: number) => {
    setServiceForm(prev => {
      const next = { ...prev, [field]: value };
      const cost = Number(next.costPrice) || 0;
      const others = Number(next.otherCostsPercent) || 0;
      
      if (field === 'salePrice') {
        const totalCost = cost * (1 + others / 100);
        if (totalCost > 0) {
           next.marginPercent = Number(((value / totalCost - 1) * 100).toFixed(2));
        }
      } else {
        const margin = Number(next.marginPercent) || 0;
        next.salePrice = Number((cost * (1 + others / 100) * (1 + margin / 100)).toFixed(2));
      }
      return next;
    });
  };

  const handleSaveService = async (e: React.FormEvent) => {
    e.preventDefault();
    const serviceData: Product = {
      ...serviceForm as Product,
      id: editingServiceId || `srv-${Date.now()}`,
      sku: serviceForm.sku || `SRV-${Date.now()}`,
      image: 'https://picsum.photos/seed/service/400/400',
      stock: 999999, 
      isService: true
    };
    await addProduct(serviceData);
    setShowServiceModal(false);
    setEditingServiceId(null);
  };

  const openNewService = () => {
    setEditingServiceId(null);
    setServiceForm({
      name: '', sku: `SRV-${Date.now()}`, category: 'Serviços', salePrice: 0, costPrice: 0, 
      isService: true, stock: 999999, marginPercent: 0, otherCostsPercent: 0, commissionPercent: 0
    });
    setShowServiceModal(true);
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 pb-20">
      
      {/* TEMPLATE DE IMPRESSÃO DA OS */}
      <div id="os-print-template" className="hidden print:block p-8 bg-white text-slate-900 font-sans text-xs">
         <div className="flex justify-between items-start border-b-2 border-slate-900 pb-6 mb-6">
            <div className="flex items-center gap-4">
               {currentStore?.logoUrl && <img src={currentStore.logoUrl} className="h-16 w-16 object-contain" />}
               <div>
                  <h1 className="text-xl font-black uppercase">{currentStore?.name}</h1>
                  <p className="text-[10px] font-bold">{currentStore?.location}</p>
                  <p className="text-[10px] font-bold">CNPJ: {currentStore?.cnpj}</p>
               </div>
            </div>
            <div className="text-right">
               <h2 className="text-2xl font-black text-primary">OS #{selectedOS?.id}</h2>
               <p className="font-bold uppercase">Data: {selectedOS?.date}</p>
               <p className="font-bold uppercase text-primary">Status: {selectedOS?.status}</p>
            </div>
         </div>

         <div className="grid grid-cols-2 gap-8 mb-8">
            <div className="p-4 border border-slate-200 rounded-xl">
               <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2">Dados do Cliente</h4>
               <p className="text-sm font-black uppercase">{selectedOS?.customerName}</p>
               <p className="text-[10px] font-bold mt-1 text-slate-500">ID Cliente: {selectedOS?.customerId}</p>
            </div>
            <div className="p-4 border border-slate-200 rounded-xl">
               <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2">Informações Técnicas</h4>
               <p className="text-sm font-black uppercase">Técnico: {selectedOS?.technicianName || 'Não Informado'}</p>
               <p className="text-[10px] font-bold mt-1 text-slate-500">Unidade: {selectedOS?.store}</p>
            </div>
         </div>

         <div className="mb-8">
            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-2 border-b pb-1">Descrição do Problema / Diagnóstico</h4>
            <p className="text-sm font-medium leading-relaxed uppercase whitespace-pre-wrap">{selectedOS?.description}</p>
         </div>

         <div className="mb-8">
            <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 border-b pb-1">Peças e Mão de Obra</h4>
            <table className="w-full text-left">
               <thead>
                  <tr className="border-b-2 border-slate-100">
                     <th className="py-2 font-black uppercase text-[10px]">Item</th>
                     <th className="py-2 text-center font-black uppercase text-[10px]">Qtd</th>
                     <th className="py-2 text-right font-black uppercase text-[10px]">Unitário</th>
                     <th className="py-2 text-right font-black uppercase text-[10px]">Total</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-50">
                  {selectedOS?.items.map((item, i) => (
                    <tr key={i} className="text-[11px]">
                       <td className="py-3 font-bold uppercase">{item.name}</td>
                       <td className="py-3 text-center font-bold">{item.quantity}</td>
                       <td className="py-3 text-right font-bold">R$ {item.salePrice.toLocaleString('pt-BR')}</td>
                       <td className="py-3 text-right font-black">R$ {(item.quantity * item.salePrice).toLocaleString('pt-BR')}</td>
                    </tr>
                  ))}
               </tbody>
               <tfoot>
                  <tr className="border-t-2 border-slate-900">
                     <td colSpan={3} className="py-4 text-right font-black text-sm uppercase">Valor Total da Ordem:</td>
                     <td className="py-4 text-right font-black text-lg text-primary tabular-nums">R$ {selectedOS?.totalValue.toLocaleString('pt-BR')}</td>
                  </tr>
               </tfoot>
            </table>
         </div>

         <div className="mt-20 grid grid-cols-2 gap-20 text-center">
            <div className="border-t border-slate-900 pt-4">
               <p className="text-[10px] font-black uppercase">{selectedOS?.technicianName || 'Assinatura Técnico'}</p>
               <p className="text-[8px] text-slate-400">Responsável pela execução</p>
            </div>
            <div className="border-t border-slate-900 pt-4">
               <p className="text-[10px] font-black uppercase">{selectedOS?.customerName}</p>
               <p className="text-[8px] text-slate-400">Assinatura do Cliente</p>
            </div>
         </div>
         <p className="text-center text-[8px] mt-20 opacity-30 uppercase font-black">Tem Acessorio ERP - Sistema de Gestão Inteligente</p>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start gap-4 print:hidden">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase">Gestão de Serviços</h1>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-1">Ordens de serviço e catálogo de mão de obra</p>
        </div>
        
        <div className="flex bg-white dark:bg-slate-800 p-1.5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
           <TabNav active={activeTab === 'list'} onClick={() => setActiveTab('list')} label="Visualizar Ordens" />
           <TabNav active={activeTab === 'catalog'} onClick={() => setActiveTab('catalog')} label="Catálogo de Serviços" />
           <TabNav active={activeTab === 'create'} onClick={() => setActiveTab('create')} label="Nova OS (PDV)" />
        </div>
      </div>

      {activeTab === 'list' && (
        <div className="space-y-6 print:hidden">
           <div className="flex gap-3 overflow-x-auto no-scrollbar py-2">
              {['TODAS', ...Object.values(ServiceOrderStatus)].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} className={`px-6 py-2 rounded-full text-[10px] font-black uppercase border-2 transition-all whitespace-nowrap ${filterStatus === s ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-200 text-slate-400'}`}>{s}</button>
              ))}
           </div>
           <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {filteredOS.length > 0 ? filteredOS.map(os => (
                <div key={os.id} onClick={() => setSelectedOS(os)} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm group hover:border-primary transition-all cursor-pointer relative overflow-hidden">
                   <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-3xl text-[9px] font-black uppercase text-white ${os.status === ServiceOrderStatus.OPEN ? 'bg-amber-500' : os.status === ServiceOrderStatus.IN_PROGRESS ? 'bg-primary' : os.status === ServiceOrderStatus.FINISHED ? 'bg-emerald-500' : 'bg-rose-500'}`}>{os.status}</div>
                   <div className="flex justify-between items-start mb-6">
                      <div><h3 className="text-xl font-black text-slate-900 dark:text-white uppercase leading-none">{os.id}</h3><p className="text-[10px] font-bold text-slate-400 uppercase mt-2">{os.date} • {os.store}</p></div>
                      <div className="text-right"><p className="text-xs font-black text-slate-400 uppercase">Total Estimado</p><p className="text-2xl font-black text-primary tabular-nums">R$ {os.totalValue.toLocaleString('pt-BR')}</p></div>
                   </div>
                   <div className="space-y-4">
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cliente</p><p className="text-sm font-black text-slate-800 dark:text-white uppercase">{os.customerName}</p></div>
                      <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Serviço Solicitado</p><p className="text-sm font-bold text-slate-600 dark:text-slate-400 uppercase line-clamp-2">{os.description}</p></div>
                   </div>
                </div>
              )) : <div className="col-span-full py-20 text-center opacity-20 uppercase font-black text-xs tracking-widest">Nenhuma Ordem de Serviço encontrada</div>}
           </div>
        </div>
      )}

      {activeTab === 'catalog' && (
        <div className="space-y-6 animate-in slide-in-from-right-4 print:hidden">
           <div className="flex justify-between items-center px-4">
              <h3 className="text-xl font-black uppercase tracking-tight">Catálogo de Mão de Obra</h3>
              <button onClick={openNewService} className="px-10 py-4 bg-amber-500 text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-lg shadow-amber-500/20 hover:scale-105 transition-all flex items-center gap-2">
                <span className="material-symbols-outlined text-lg">construction</span> Cadastrar Novo Serviço
              </button>
           </div>

           <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden shadow-sm">
              <table className="w-full text-left">
                 <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr className="border-b border-slate-100 dark:border-slate-800">
                       <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400">Serviço</th>
                       <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400">Ref / Código</th>
                       <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 text-right">Mão de Obra (Venda)</th>
                       <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 text-right">Ações</th>
                    </tr>
                 </thead>
                 <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {servicesCatalog.map(srv => (
                      <tr key={srv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all">
                         <td className="px-10 py-6">
                            <p className="text-sm font-black uppercase">{srv.name}</p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase">{srv.category}</p>
                         </td>
                         <td className="px-10 py-6"><span className="text-[10px] font-mono text-slate-400 uppercase font-black">{srv.sku}</span></td>
                         <td className="px-10 py-6 text-right"><p className="text-lg font-black text-amber-500 tabular-nums">R$ {srv.salePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p></td>
                         <td className="px-10 py-6 text-right">
                            <div className="flex justify-end gap-2">
                               <button onClick={() => { setServiceForm(srv); setEditingServiceId(srv.id); setShowServiceModal(true); }} className="size-10 bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-primary rounded-xl transition-all flex items-center justify-center shadow-sm"><span className="material-symbols-outlined text-lg">edit</span></button>
                               <button onClick={() => { if(confirm('Excluir este serviço?')) deleteProduct(srv.id)}} className="size-10 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all flex items-center justify-center"><span className="material-symbols-outlined text-lg">delete</span></button>
                            </div>
                         </td>
                      </tr>
                    ))}
                 </tbody>
              </table>
           </div>
        </div>
      )}

      {activeTab === 'create' && (
        <div className="bg-white dark:bg-slate-900 p-12 rounded-[3rem] text-center border border-slate-200 dark:border-slate-800 space-y-8 print:hidden">
           <div className="size-24 bg-primary/10 text-primary rounded-[2rem] flex items-center justify-center mx-auto"><span className="material-symbols-outlined text-5xl">point_of_sale</span></div>
           <h2 className="text-2xl font-black uppercase">Deseja criar uma nova ordem?</h2>
           <p className="text-slate-500 max-w-sm mx-auto font-bold text-sm uppercase">Para criar uma OS, utilize o Frente de Caixa (PDV), selecione o serviço cadastrado e as peças, e clique em 'GERAR OS'.</p>
           <button onClick={() => window.location.hash = '#/pdv'} className="px-12 py-5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all">Ir para o PDV agora</button>
        </div>
      )}

      {/* MODAL CADASTRO SERVIÇO - COM CALCULADORA DE PREÇO */}
      {showServiceModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in print:hidden">
           <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-[3.5rem] shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-amber-500 text-white">
                 <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-3xl">construction</span>
                    <h3 className="text-2xl font-black uppercase tracking-tight">{editingServiceId ? 'Editar Serviço' : 'Novo Serviço de Mão de Obra'}</h3>
                 </div>
                 <button onClick={() => setShowServiceModal(false)} className="size-12 hover:bg-white/20 rounded-2xl flex items-center justify-center"><span className="material-symbols-outlined">close</span></button>
              </div>
              
              <form onSubmit={handleSaveService} className="flex-1 overflow-y-auto p-10 custom-scrollbar space-y-10">
                 <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-8 items-center">
                    <div className="md:col-span-1 flex flex-col items-center">
                       <div className="size-32 bg-white dark:bg-slate-900 rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center shadow-inner">
                          <span className="material-symbols-outlined text-4xl text-amber-500">build</span>
                       </div>
                       <p className="text-[9px] font-black text-amber-600 uppercase mt-4">Mão de Obra / Serviço</p>
                    </div>
                    <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-6">
                       <div className="md:col-span-2 space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase px-2">Descrição do Serviço</label>
                          <input type="text" required value={serviceForm.name} onChange={e => setServiceForm({...serviceForm, name: e.target.value})} className="w-full h-14 bg-white dark:bg-slate-900 border-none rounded-2xl px-6 text-sm font-bold uppercase" placeholder="EX: TROCA DE TELA IPHONE 13..." />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase px-2">Ref / Código OS</label>
                          <input value={serviceForm.sku} onChange={e => setServiceForm({...serviceForm, sku: e.target.value})} className="w-full h-14 bg-white dark:bg-slate-900 border-none rounded-2xl px-6 text-sm font-black uppercase text-primary" />
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="bg-white dark:bg-slate-900 p-8 rounded-[3rem] border-2 border-amber-500/20 shadow-xl space-y-6">
                       <h4 className="text-[10px] font-black text-amber-600 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-3">Cálculo de Preço Mão de Obra</h4>
                       <div className="space-y-4">
                          <div className="flex items-center justify-between">
                             <label className="text-[11px] font-black text-slate-500 uppercase">Preço Custo R$</label>
                             <input type="number" step="0.01" value={serviceForm.costPrice} onChange={e => handlePriceChange('costPrice', parseFloat(e.target.value) || 0)} className="w-32 h-10 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 text-right font-black tabular-nums text-rose-500" />
                          </div>
                          <div className="flex items-center justify-between">
                             <label className="text-[11px] font-black text-slate-500 uppercase">Outros Custos %</label>
                             <input type="number" step="0.01" value={serviceForm.otherCostsPercent} onChange={e => handlePriceChange('otherCostsPercent', parseFloat(e.target.value) || 0)} className="w-32 h-10 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 text-right font-black tabular-nums" />
                          </div>
                          <div className="flex items-center justify-between">
                             <label className="text-[11px] font-black text-slate-500 uppercase">Margem Lucro %</label>
                             <input type="number" step="0.01" value={serviceForm.marginPercent} onChange={e => handlePriceChange('marginPercent', parseFloat(e.target.value) || 0)} className="w-32 h-10 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 text-right font-black tabular-nums text-amber-500" />
                          </div>
                          <div className="flex items-center justify-between pt-6 border-t border-slate-100 dark:border-slate-800">
                             <label className="text-sm font-black text-amber-600 uppercase">Preço Venda Final R$</label>
                             <input type="number" step="0.01" value={serviceForm.salePrice} onChange={e => handlePriceChange('salePrice', parseFloat(e.target.value) || 0)} className="w-48 h-14 bg-amber-500/10 border-2 border-amber-500/30 rounded-2xl px-6 text-right font-black text-xl text-amber-600 tabular-nums" />
                          </div>
                       </div>
                    </div>

                    <div className="space-y-6">
                       <div className="bg-slate-50 dark:bg-slate-800/50 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 space-y-6">
                          <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-3">Comissão e Unidade</h4>
                          <div className="flex items-center justify-between">
                             <label className="text-[11px] font-black text-slate-500 uppercase">Comissão Técnica %</label>
                             <input type="number" step="0.1" value={serviceForm.commissionPercent} onChange={e => setServiceForm({...serviceForm, commissionPercent: parseFloat(e.target.value) || 0})} className="w-24 h-10 bg-white dark:bg-slate-900 border-none rounded-xl px-4 text-right font-black text-sm" />
                          </div>
                          <div className="flex items-center justify-between">
                             <label className="text-[11px] font-black text-slate-500 uppercase">Unidade Medida</label>
                             <input type="text" value={serviceForm.unit || 'UN'} onChange={e => setServiceForm({...serviceForm, unit: e.target.value})} className="w-24 h-10 bg-white dark:bg-slate-900 border-none rounded-xl px-4 text-right font-black text-xs uppercase" />
                          </div>
                       </div>
                       <div className="p-6 bg-amber-500/5 rounded-[2rem] border border-amber-500/10 flex items-center gap-4">
                          <span className="material-symbols-outlined text-amber-500 text-3xl">info</span>
                          <p className="text-[10px] font-bold text-amber-700 dark:text-amber-500 uppercase leading-relaxed">Este item é configurado como mão de obra. Ele não afeta o inventário físico do sistema.</p>
                       </div>
                    </div>
                 </div>

                 <div className="pt-10 flex justify-end gap-4 border-t border-slate-100 dark:border-slate-800">
                    <button type="button" onClick={() => setShowServiceModal(false)} className="px-12 py-5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-3xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                    <button type="submit" className="px-16 py-5 bg-amber-500 text-white rounded-3xl font-black text-xs uppercase tracking-widest shadow-2xl shadow-amber-500/30 hover:scale-105 active:scale-95 transition-all">
                       {editingServiceId ? 'Salvar Alterações' : 'Confirmar Cadastro de Serviço'}
                    </button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {selectedOS && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 print:hidden">
           <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col md:flex-row h-[700px]">
              <div className="w-full md:w-[350px] bg-slate-50 dark:bg-slate-800/50 p-10 border-r border-slate-200 dark:border-slate-800 flex flex-col justify-between">
                 <div className="space-y-8">
                    <button onClick={() => setSelectedOS(null)} className="text-slate-400 hover:text-rose-500 flex items-center gap-2 text-[10px] font-black uppercase"><span className="material-symbols-outlined text-lg">arrow_back</span> Voltar</button>
                    <div>
                       <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Situação Atual</h4>
                       <div className={`px-6 py-3 rounded-2xl text-xs font-black uppercase text-white text-center shadow-lg ${selectedOS.status === ServiceOrderStatus.OPEN ? 'bg-amber-500 shadow-amber-500/20' : selectedOS.status === ServiceOrderStatus.IN_PROGRESS ? 'bg-primary shadow-primary/20' : selectedOS.status === ServiceOrderStatus.FINISHED ? 'bg-emerald-500 shadow-emerald-500/20' : 'bg-rose-500'}`}>
                          {selectedOS.status}
                       </div>
                    </div>
                    {selectedOS.status !== ServiceOrderStatus.FINISHED && (
                      <div className="space-y-4 pt-8 border-t border-slate-200 dark:border-slate-700">
                         <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ações Rápidas</p>
                         <div className="grid grid-cols-1 gap-2">
                            <button onClick={() => handleUpdateStatus(selectedOS, ServiceOrderStatus.FINISHED)} className="w-full py-3 bg-emerald-500 text-white rounded-xl text-[9px] font-black uppercase border-2 border-emerald-500 hover:bg-emerald-600 shadow-lg shadow-emerald-500/10 transition-all">Concluir e Receber</button>
                            <button onClick={() => handleUpdateStatus(selectedOS, ServiceOrderStatus.IN_PROGRESS)} className="w-full py-3 bg-white dark:bg-slate-900 text-primary rounded-xl text-[9px] font-black uppercase border-2 border-primary/20 hover:border-primary transition-all">Iniciar Execução</button>
                         </div>
                      </div>
                    )}
                 </div>
                 <button onClick={handlePrintOS} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:scale-105 active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">print</span> Imprimir OS</button>
              </div>
              <div className="flex-1 overflow-y-auto p-12 space-y-10 custom-scrollbar">
                 <div className="flex justify-between items-start">
                    <div><h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase leading-none">{selectedOS.id}</h2><p className="text-xs font-bold text-slate-400 uppercase mt-2">Abertura em {selectedOS.date}</p></div>
                    <div className="text-right"><h3 className="text-4xl font-black text-primary tabular-nums">R$ {selectedOS.totalValue.toLocaleString('pt-BR')}</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor Consolidado</p></div>
                 </div>
                 <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente</p><p className="text-lg font-black text-slate-800 dark:text-white uppercase">{selectedOS.customerName}</p></div>
                    <div className="space-y-1"><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Técnico Responsável</p><p className="text-lg font-black text-slate-800 dark:text-white uppercase">{selectedOS.technicianName || 'Não definido'}</p></div>
                 </div>
                 <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Diagnóstico / Descrição</p>
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-3xl border border-slate-100 dark:border-slate-700 text-sm font-bold text-slate-600 dark:text-slate-300 uppercase leading-relaxed">{selectedOS.description}</div>
                 </div>
                 <div className="space-y-4">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-2">Itens / Peças Utilizadas</p>
                    <div className="space-y-3">
                       {selectedOS.items.map(item => (
                         <div key={item.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800/30 rounded-2xl">
                            <div className="flex items-center gap-3"><div className={`size-10 rounded-lg flex items-center justify-center ${item.isService ? 'bg-amber-500/10 text-amber-500' : 'bg-primary/10 text-primary'}`}><span className="material-symbols-outlined text-sm">{item.isService ? 'build' : 'shopping_bag'}</span></div><div><p className="text-xs font-black uppercase">{item.name}</p><p className="text-[9px] text-slate-400 font-bold">{item.quantity}x • R$ {item.salePrice.toLocaleString('pt-BR')}</p></div></div>
                            <span className="text-sm font-black text-primary tabular-nums">R$ {(item.quantity * item.salePrice).toLocaleString('pt-BR')}</span>
                         </div>
                       ))}
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {showPaymentModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in print:hidden">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-emerald-500 text-white flex justify-between items-center">
                 <h3 className="text-2xl font-black uppercase tracking-tight">Recebimento OS</h3>
                 <button onClick={() => setShowPaymentModal(false)} className="material-symbols-outlined">close</button>
              </div>
              <div className="p-10 space-y-8">
                 <div className="text-center"><p className="text-[10px] font-black text-slate-400 uppercase mb-2">Total a Receber</p><p className="text-4xl font-black text-slate-900 dark:text-white tabular-nums">R$ {selectedOS?.totalValue.toLocaleString('pt-BR')}</p></div>
                 <div className="grid grid-cols-2 gap-3">
                    {['Dinheiro', 'Pix', 'Débito', 'Crédito'].map(m => (
                      <button key={m} onClick={() => setPaymentMethod(m)} className={`py-4 rounded-2xl border-2 font-black text-[10px] uppercase transition-all ${paymentMethod === m ? 'border-emerald-500 bg-emerald-50 text-emerald-600' : 'border-slate-100 dark:border-slate-800 text-slate-400 hover:border-emerald-200'}`}>{m}</button>
                    ))}
                 </div>
                 <button onClick={handleFinalizeAndPay} className="w-full h-16 bg-emerald-500 text-white rounded-[1.5rem] font-black text-xs uppercase shadow-xl hover:scale-105 transition-all active:scale-95">CONFIRMAR RECEBIMENTO</button>
              </div>
           </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; }
        @media print {
           body * { visibility: hidden; }
           #os-print-template, #os-print-template * { visibility: visible; }
           #os-print-template { position: absolute; left: 0; top: 0; width: 100%; display: block !important; }
        }
      `}</style>
    </div>
  );
};

const TabNav: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => (
  <button onClick={onClick} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${active ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>{label}</button>
);

export default ServiceOrders;
