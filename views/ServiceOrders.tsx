
import React, { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import { ServiceOrder, ServiceOrderStatus, UserRole, Product, TransactionStatus } from '../types';

const ServiceOrders: React.FC = () => {
  const { serviceOrders, updateServiceOrder, currentUser, products, establishments } = useApp();
  const [activeTab, setActiveTab] = useState('list');
  const [filterStatus, setFilterStatus] = useState<string>('TODAS');
  const [selectedOS, setSelectedOS] = useState<ServiceOrder | null>(null);

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const currentStore = establishments.find(e => e.id === currentUser?.storeId);

  const filteredOS = useMemo(() => {
    return serviceOrders.filter(os => {
      const matchesStore = isAdmin || os.store === currentStore?.name;
      const matchesStatus = filterStatus === 'TODAS' || os.status === filterStatus;
      return matchesStore && matchesStatus;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [serviceOrders, filterStatus, isAdmin, currentStore]);

  const handleUpdateStatus = (os: ServiceOrder, newStatus: ServiceOrderStatus) => {
    updateServiceOrder({ ...os, status: newStatus });
    if (selectedOS?.id === os.id) setSelectedOS({ ...os, status: newStatus });
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start gap-4">
        <div>
          <h1 className="text-4xl font-black tracking-tighter uppercase">Gestão de Serviços</h1>
          <p className="text-slate-500 text-sm font-bold uppercase tracking-widest mt-1">Ordens de serviço e catálogo de mão de obra</p>
        </div>
        <div className="flex bg-white dark:bg-slate-800 p-1.5 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar">
           <TabNav active={activeTab === 'list'} onClick={() => setActiveTab('list')} label="Visualizar Ordens" />
           <TabNav active={activeTab === 'catalog'} onClick={() => setActiveTab('catalog')} label="Catálogo de Serviços" />
        </div>
      </div>

      {activeTab === 'list' && (
        <div className="space-y-6">
           <div className="flex gap-3 overflow-x-auto no-scrollbar py-2">
              {['TODAS', ...Object.values(ServiceOrderStatus)].map(s => (
                <button key={s} onClick={() => setFilterStatus(s)} className={`px-6 py-2 rounded-full text-[10px] font-black uppercase border-2 transition-all whitespace-nowrap ${filterStatus === s ? 'bg-slate-900 border-slate-900 text-white' : 'border-slate-200 text-slate-400'}`}>{s}</button>
              ))}
           </div>
           <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              {filteredOS.map(os => (
                <div key={os.id} onClick={() => setSelectedOS(os)} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm group hover:border-primary transition-all cursor-pointer relative overflow-hidden">
                   <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-3xl text-[9px] font-black uppercase text-white ${os.status === ServiceOrderStatus.OPEN ? 'bg-amber-500' : os.status === ServiceOrderStatus.IN_PROGRESS ? 'bg-primary' : os.status === ServiceOrderStatus.FINISHED ? 'bg-emerald-500' : 'bg-rose-500'}`}>{os.status}</div>
                   <div className="flex justify-between items-start mb-6">
                      <div><h3 className="text-xl font-black text-slate-900 dark:text-white uppercase leading-none">{os.id}</h3><p className="text-[10px] font-bold text-slate-400 uppercase mt-2">{os.date} • {os.store}</p></div>
                      <div className="text-right"><p className="text-xs font-black text-slate-400 uppercase">Total Estimado</p><p className="text-2xl font-black text-primary tabular-nums">R$ {os.totalValue.toLocaleString('pt-BR')}</p></div>
                   </div>
                   <div className="space-y-2">
                      <div className="flex items-center gap-2"><span className="material-symbols-outlined text-sm text-slate-400">person</span><span className="text-sm font-black text-slate-700 dark:text-slate-300 uppercase">{os.customerName}</span></div>
                      <div className="flex items-center gap-2"><span className="material-symbols-outlined text-sm text-slate-400">build</span><span className="text-sm font-bold text-slate-500 dark:text-slate-400 uppercase truncate">{os.description}</span></div>
                   </div>
                </div>
              ))}
           </div>
        </div>
      )}

      {activeTab === 'catalog' && (
        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border shadow-sm overflow-hidden">
           <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                 <tr className="border-b"><th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Mão de Obra</th><th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400">Categoria</th><th className="px-8 py-5 text-[10px] font-black uppercase text-slate-400 text-right">Valor Padrão</th></tr>
              </thead>
              <tbody className="divide-y">
                 {products.filter(p => p.isService).map(p => (
                   <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20 uppercase text-[10px] font-black">
                      <td className="px-8 py-4">{p.name}</td>
                      <td className="px-8 py-4 text-slate-400">{p.category}</td>
                      <td className="px-8 py-4 text-right text-primary">R$ {p.salePrice.toLocaleString('pt-BR')}</td>
                   </tr>
                 ))}
              </tbody>
           </table>
        </div>
      )}

      {selectedOS && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden p-8 animate-in zoom-in-95">
              <div className="flex justify-between items-center mb-8"><h3 className="text-2xl font-black uppercase tracking-tight text-primary">Detalhes da OS #{selectedOS.id}</h3><button onClick={() => setSelectedOS(null)} className="material-symbols-outlined">close</button></div>
              <div className="space-y-6">
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl"><p className="text-[9px] font-black text-slate-400 uppercase">Cliente</p><p className="text-sm font-black uppercase">{selectedOS.customerName}</p></div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl"><p className="text-[9px] font-black text-slate-400 uppercase">Total OS</p><p className="text-xl font-black text-primary">R$ {selectedOS.totalValue.toLocaleString('pt-BR')}</p></div>
                 </div>
                 <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl"><p className="text-[10px] font-black text-slate-400 uppercase mb-2">Diagnóstico</p><p className="text-sm font-bold text-slate-600 dark:text-slate-300 uppercase leading-relaxed">{selectedOS.description}</p></div>
                 <div className="flex gap-2">
                    <button onClick={() => handleUpdateStatus(selectedOS, ServiceOrderStatus.IN_PROGRESS)} className="flex-1 py-4 bg-primary text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">Iniciar Serviço</button>
                    <button onClick={() => handleUpdateStatus(selectedOS, ServiceOrderStatus.FINISHED)} className="flex-1 py-4 bg-emerald-500 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">Finalizar OS</button>
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

const TabNav: React.FC<{ active: boolean; onClick: () => void; label: string }> = ({ active, onClick, label }) => (
  <button onClick={onClick} className={`px-6 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap ${active ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>{label}</button>
);

export default ServiceOrders;
