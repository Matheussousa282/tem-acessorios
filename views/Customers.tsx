
import React, { useState, useMemo } from 'react';
import { useApp } from '../AppContext';
import { Customer } from '../types';

const Customers: React.FC = () => {
  const { customers, addCustomer } = useApp();
  const [filter, setFilter] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const initialFormState: Omit<Customer, 'id'> = {
    name: '', email: '', phone: '', birthDate: '',
    cpfCnpj: '', zipCode: '', address: '', number: '',
    complement: '', neighborhood: '', city: '', state: '', notes: ''
  };

  const [customerForm, setCustomerForm] = useState(initialFormState);

  const filteredCustomers = useMemo(() => {
    return customers.filter(c => 
      c.name.toLowerCase().includes(filter.toLowerCase()) || 
      c.email.toLowerCase().includes(filter.toLowerCase()) ||
      c.phone.includes(filter) ||
      (c.cpfCnpj && c.cpfCnpj.includes(filter))
    );
  }, [customers, filter]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await addCustomer({
      ...customerForm,
      id: editingId || `c-${Date.now()}`
    });
    setShowModal(false);
    setEditingId(null);
    setCustomerForm(initialFormState);
  };

  const handleEdit = (c: Customer) => {
    setEditingId(c.id);
    setCustomerForm({
      name: c.name, email: c.email, phone: c.phone, birthDate: c.birthDate,
      cpfCnpj: c.cpfCnpj || '', zipCode: c.zipCode || '', address: c.address || '',
      number: c.number || '', complement: c.complement || '', neighborhood: c.neighborhood || '',
      city: c.city || '', state: c.state || '', notes: c.notes || ''
    });
    setShowModal(true);
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Gestão de Clientes</h2>
          <p className="text-slate-500 text-sm mt-1 font-bold uppercase tracking-tight">Base de dados unificada para CRM e Vendas</p>
        </div>
        <button 
          onClick={() => { setEditingId(null); setCustomerForm(initialFormState); setShowModal(true); }}
          className="flex items-center gap-2 bg-primary text-white px-8 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all active:scale-95"
        >
          <span className="material-symbols-outlined">person_add</span>
          CADASTRAR NOVO CLIENTE
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <KPICard title="Total de Clientes" value={customers.length.toString()} icon="groups" color="text-primary" />
        <KPICard title="Ativos no Mês" value="--" icon="verified" color="text-emerald-500" />
        <KPICard title="Novos (30 dias)" value="--" icon="new_releases" color="text-amber-500" />
      </div>

      <div className="space-y-4">
        <div className="relative group">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
          <input 
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Pesquisar por nome, documento, e-mail ou telefone..."
            className="w-full h-14 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl pl-12 pr-6 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all outline-none"
          />
        </div>

        <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Cliente / Documento</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Contato</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">Localização</th>
                <th className="px-8 py-6 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredCustomers.map(c => (
                <tr key={c.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="size-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center font-black">
                        {c.name.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase leading-none">{c.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold mt-1">{c.cpfCnpj || 'DOCUMENTO NÃO INF.'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-xs font-black text-slate-700 dark:text-slate-300">{c.phone}</p>
                    <p className="text-[10px] text-slate-400 font-bold">{c.email}</p>
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase">{c.city || 'Cidade N/I'}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase">{c.state || 'UF N/I'}</p>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => handleEdit(c)} className="size-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary rounded-xl transition-all shadow-sm"><span className="material-symbols-outlined text-lg">edit</span></button>
                      <button className="size-10 flex items-center justify-center bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all"><span className="material-symbols-outlined text-lg">delete</span></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL CADASTRO COMPLETO */}
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in duration-300">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-primary text-white">
              <div className="flex items-center gap-4">
                <div className="size-12 bg-white/20 rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl">person_add</span>
                </div>
                <h3 className="text-2xl font-black uppercase tracking-tight">{editingId ? 'Editar Cliente' : 'Novo Cadastro de Cliente'}</h3>
              </div>
              <button onClick={() => setShowModal(false)} className="size-12 hover:bg-white/10 rounded-2xl flex items-center justify-center transition-colors">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-10 space-y-10 overflow-y-auto custom-scrollbar">
              {/* SEÇÃO: DADOS PESSOAIS */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                   <span className="material-symbols-outlined text-slate-400 text-lg">account_circle</span>
                   <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Informações Pessoais / Comerciais</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormInput label="Nome Completo / Razão Social" required value={customerForm.name} onChange={v => setCustomerForm({...customerForm, name: v})} />
                  <FormInput label="CPF ou CNPJ" value={customerForm.cpfCnpj} onChange={v => setCustomerForm({...customerForm, cpfCnpj: v})} />
                  <FormInput label="WhatsApp / Telefone" required value={customerForm.phone} onChange={v => setCustomerForm({...customerForm, phone: v})} placeholder="(00) 00000-0000" />
                  <FormInput label="E-mail" type="email" value={customerForm.email} onChange={v => setCustomerForm({...customerForm, email: v})} />
                  <FormInput label="Data de Nascimento" type="date" value={customerForm.birthDate} onChange={v => setCustomerForm({...customerForm, birthDate: v})} />
                </div>
              </div>

              {/* SEÇÃO: ENDEREÇO */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                   <span className="material-symbols-outlined text-slate-400 text-lg">location_on</span>
                   <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Endereço de Entrega / Cobrança</h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                  <div className="md:col-span-2"><FormInput label="CEP" value={customerForm.zipCode} onChange={v => setCustomerForm({...customerForm, zipCode: v})} /></div>
                  <div className="md:col-span-3"><FormInput label="Logradouro" value={customerForm.address} onChange={v => setCustomerForm({...customerForm, address: v})} /></div>
                  <div className="md:col-span-1"><FormInput label="Nº" value={customerForm.number} onChange={v => setCustomerForm({...customerForm, number: v})} /></div>
                  <div className="md:col-span-2"><FormInput label="Complemento" value={customerForm.complement} onChange={v => setCustomerForm({...customerForm, complement: v})} /></div>
                  <div className="md:col-span-2"><FormInput label="Bairro" value={customerForm.neighborhood} onChange={v => setCustomerForm({...customerForm, neighborhood: v})} /></div>
                  <div className="md:col-span-1"><FormInput label="Cidade" value={customerForm.city} onChange={v => setCustomerForm({...customerForm, city: v})} /></div>
                  <div className="md:col-span-1"><FormInput label="Estado (UF)" value={customerForm.state} onChange={v => setCustomerForm({...customerForm, state: v})} /></div>
                </div>
              </div>

              {/* SEÇÃO: NOTAS */}
              <div className="space-y-6">
                <div className="flex items-center gap-2 border-b border-slate-100 dark:border-slate-800 pb-2">
                   <span className="material-symbols-outlined text-slate-400 text-lg">description</span>
                   <h4 className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Observações Técnicas / Notas</h4>
                </div>
                <textarea 
                   value={customerForm.notes} 
                   onChange={e => setCustomerForm({...customerForm, notes: e.target.value})}
                   className="w-full h-32 bg-slate-50 dark:bg-slate-800 border-none rounded-3xl p-6 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all"
                   placeholder="Anotações adicionais sobre o perfil do cliente, restrições ou preferências..."
                />
              </div>

              <div className="pt-6">
                <button type="submit" className="w-full h-20 bg-primary text-white font-black rounded-[2.5rem] shadow-2xl shadow-primary/20 hover:bg-blue-600 transition-all uppercase text-sm tracking-widest active:scale-[0.98]">
                  {editingId ? 'SALVAR ALTERAÇÕES NO CADASTRO' : 'FINALIZAR E SALVAR NOVO CLIENTE'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const KPICard: React.FC<{ title: string; value: string; icon: string; color: string }> = ({ title, value, icon, color }) => (
  <div className="bg-white dark:bg-slate-900 p-8 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm">
    <div className={`p-3 rounded-2xl bg-slate-50 dark:bg-slate-800 ${color} mb-6 w-fit`}><span className="material-symbols-outlined text-3xl">{icon}</span></div>
    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{title}</p>
    <h4 className="text-3xl font-black text-slate-900 dark:text-white">{value}</h4>
  </div>
);

const FormInput: React.FC<{ label: string; required?: boolean; value: string; onChange: (v: string) => void; type?: string; placeholder?: string }> = ({ label, required, value, onChange, type = 'text', placeholder }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-4">{label} {required && '*'}</label>
    <input 
      type={type} 
      required={required} 
      value={value} 
      onChange={e => onChange(e.target.value)} 
      className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all uppercase" 
      placeholder={placeholder}
    />
  </div>
);

export default Customers;
