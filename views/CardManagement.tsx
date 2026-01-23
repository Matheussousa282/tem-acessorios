
import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { CardOperator, CardBrand } from '../types';

const CardManagement: React.FC = () => {
  const { cardOperators, cardBrands, saveCardOperator, deleteCardOperator, saveCardBrand, deleteCardBrand } = useApp();
  const [activeTab, setActiveTab] = useState<'operators' | 'brands'>('operators');
  
  const [operatorForm, setOperatorForm] = useState({ name: '', id: '' });
  const [brandForm, setBrandForm] = useState({ name: '', operatorId: '', id: '' });

  const handleSaveOperator = async (e: React.FormEvent) => {
    e.preventDefault();
    const op: CardOperator = {
      id: operatorForm.id || `op-${Date.now()}`,
      name: operatorForm.name,
      active: true
    };
    await saveCardOperator(op);
    setOperatorForm({ name: '', id: '' });
  };

  const handleSaveBrand = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!brandForm.operatorId) { alert('Selecione uma operadora!'); return; }
    const br: CardBrand = {
      id: brandForm.id || `br-${Date.now()}`,
      name: brandForm.name,
      operatorId: brandForm.operatorId,
      active: true
    };
    await saveCardBrand(br);
    setBrandForm({ name: '', operatorId: '', id: '' });
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Gestão de Cartões</h1>
        <p className="text-slate-500 text-sm font-bold uppercase tracking-tight">Cadastro de Adquirentes e Bandeiras de Cartão</p>
      </div>

      <div className="flex bg-white dark:bg-slate-900 p-2 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800 w-fit">
         <button onClick={() => setActiveTab('operators')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'operators' ? 'bg-primary text-white shadow-lg' : 'text-slate-400'}`}>Operadoras (Adquirentes)</button>
         <button onClick={() => setActiveTab('brands')} className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'brands' ? 'bg-primary text-white shadow-lg' : 'text-slate-400'}`}>Bandeiras de Cartão</button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
         {/* FORMULÁRIOS */}
         <div className="lg:col-span-4 space-y-6">
            <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-xl space-y-8">
               {activeTab === 'operators' ? (
                  <form onSubmit={handleSaveOperator} className="space-y-6">
                     <h3 className="text-sm font-black uppercase text-primary border-b pb-4">Cadastrar Operadora</h3>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Nome da Operadora (Ex: Stone, Rede)</label>
                        <input required value={operatorForm.name} onChange={e => setOperatorForm({...operatorForm, name: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 font-bold border-none uppercase" />
                     </div>
                     <button type="submit" className="w-full h-14 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl">Salvar Operadora</button>
                  </form>
               ) : (
                  <form onSubmit={handleSaveBrand} className="space-y-6">
                     <h3 className="text-sm font-black uppercase text-primary border-b pb-4">Cadastrar Bandeira</h3>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Nome da Bandeira (Ex: Visa, Master)</label>
                        <input required value={brandForm.name} onChange={e => setBrandForm({...brandForm, name: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 font-bold border-none uppercase" />
                     </div>
                     <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Operadora Vinculada</label>
                        <select required value={brandForm.operatorId} onChange={e => setBrandForm({...brandForm, operatorId: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 font-bold border-none uppercase text-xs">
                           <option value="">Selecione...</option>
                           {cardOperators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
                        </select>
                     </div>
                     <button type="submit" className="w-full h-14 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl">Salvar Bandeira</button>
                  </form>
               )}
            </div>
         </div>

         {/* LISTAGENS */}
         <div className="lg:col-span-8">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden shadow-sm">
               <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                     <tr className="border-b border-slate-100">
                        <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400">Descrição</th>
                        {activeTab === 'brands' && <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400">Operadora</th>}
                        <th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 text-right">Ações</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                     {activeTab === 'operators' ? (
                        cardOperators.map(op => (
                           <tr key={op.id} className="hover:bg-slate-50 transition-all font-bold">
                              <td className="px-10 py-6 uppercase text-sm">{op.name}</td>
                              <td className="px-10 py-6 text-right">
                                 <button onClick={() => deleteCardOperator(op.id)} className="text-rose-500 hover:underline text-[10px] font-black uppercase">Excluir</button>
                              </td>
                           </tr>
                        ))
                     ) : (
                        cardBrands.map(br => {
                           const op = cardOperators.find(o => o.id === br.operatorId);
                           return (
                              <tr key={br.id} className="hover:bg-slate-50 transition-all font-bold">
                                 <td className="px-10 py-6 uppercase text-sm">{br.name}</td>
                                 <td className="px-10 py-6 uppercase text-xs text-primary">{op?.name || 'Não inf.'}</td>
                                 <td className="px-10 py-6 text-right">
                                    <button onClick={() => deleteCardBrand(br.id)} className="text-rose-500 hover:underline text-[10px] font-black uppercase">Excluir</button>
                                 </td>
                              </tr>
                           );
                        })
                     )}
                     {(activeTab === 'operators' ? cardOperators.length : cardBrands.length) === 0 && (
                        <tr><td colSpan={3} className="px-10 py-10 text-center opacity-30 uppercase font-black text-xs">Nenhum registro localizado</td></tr>
                     )}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
    </div>
  );
};

export default CardManagement;
