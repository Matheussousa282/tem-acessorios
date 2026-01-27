
import React, { useState, useEffect, useRef } from 'react';
import { UserRole, User, Establishment, RolePermissions } from '../types';
import { useApp } from '../AppContext';

const Settings: React.FC = () => {
  const { 
    currentUser, systemConfig, updateConfig, 
    users, addUser, deleteUser, 
    establishments, addEstablishment, deleteEstablishment, 
    rolePermissions, updateRolePermissions, refreshData 
  } = useApp();
  
  const [activeTab, setActiveTab] = useState<'users' | 'stores' | 'general' | 'permissions' | 'db'>('general');
  const [isSaving, setIsSaving] = useState(false);
  const logoInputRef = useRef<HTMLInputElement>(null);

  const [localConfig, setLocalConfig] = useState(systemConfig);
  const [showUserModal, setShowUserModal] = useState(false);
  const [showStoreModal, setShowStoreModal] = useState(false);
  
  const [selectedRolePerm, setSelectedRolePerm] = useState<UserRole>(UserRole.MANAGER);
  const [localPerms, setLocalPerms] = useState<RolePermissions | null>(null);

  const [userForm, setUserForm] = useState<Partial<User>>({ name: '', email: '', role: UserRole.VENDOR, storeId: 'matriz', active: true, password: '123456' });
  const [storeForm, setStoreForm] = useState<Partial<Establishment>>({ name: '', cnpj: '', location: '', active: true, hasStockAccess: true });

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  useEffect(() => {
    setLocalConfig(systemConfig);
  }, [systemConfig]);

  useEffect(() => {
    if (rolePermissions[selectedRolePerm]) {
      setLocalPerms({ ...rolePermissions[selectedRolePerm] });
    }
  }, [selectedRolePerm, rolePermissions]);

  const handleSavePermissions = async () => {
    if (!localPerms) return;
    setIsSaving(true);
    try {
      await updateRolePermissions(selectedRolePerm, localPerms);
      alert(`Permissões atualizadas!`);
    } catch (e) { alert("Erro ao salvar"); } finally { setIsSaving(false); }
  };

  const togglePerm = (key: keyof RolePermissions) => {
    if (!localPerms) return;
    setLocalPerms({ ...localPerms, [key]: !localPerms[key] });
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    await addUser({ ...userForm, id: userForm.id || `u-${Date.now()}` } as User);
    setShowUserModal(false);
    setUserForm({ name: '', email: '', role: UserRole.VENDOR, storeId: 'matriz', active: true, password: '123456' });
  };

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    await addEstablishment({ ...storeForm, id: storeForm.id || `est-${Date.now()}` } as Establishment);
    setShowStoreModal(false);
    setStoreForm({ name: '', cnpj: '', location: '', active: true, hasStockAccess: true });
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Configurações</h1>
        <p className="text-slate-500 text-sm font-bold uppercase tracking-tight">Gestão de Identidade, Equipe e Unidades.</p>
      </div>

      <div className="flex border-b overflow-x-auto no-scrollbar gap-2 shadow-sm">
        <TabButton active={activeTab === 'general'} onClick={() => setActiveTab('general')} icon="palette" label="Identidade" />
        <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon="badge" label="Colaboradores" />
        <TabButton active={activeTab === 'stores'} onClick={() => setActiveTab('stores')} icon="store" label="Unidades" />
        {isAdmin && <TabButton active={activeTab === 'permissions'} onClick={() => setActiveTab('permissions')} icon="shield_person" label="Permissões" />}
        {isAdmin && <TabButton active={activeTab === 'db'} onClick={() => setActiveTab('db')} icon="dns" label="Infraestrutura" />}
      </div>

      <div className="mt-6">
        {/* ABA COLABORADORES */}
        {activeTab === 'users' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button onClick={() => { setUserForm({ name: '', email: '', role: UserRole.VENDOR, storeId: 'matriz', active: true, password: '123456' }); setShowUserModal(true); }} className="px-6 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg hover:scale-105 transition-all">Novo Colaborador</button>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border shadow-sm overflow-hidden">
               <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr className="border-b"><th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400">Nome</th><th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400">Perfil</th><th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400">Loja</th><th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Ações</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {users.map(u => (
                      <tr key={u.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                        <td className="px-8 py-4 font-black uppercase text-xs">{u.name}</td>
                        <td className="px-8 py-4 uppercase text-[10px] font-bold text-primary">{u.role}</td>
                        <td className="px-8 py-4 uppercase text-[10px] font-bold text-slate-400">{establishments.find(e => e.id === u.storeId)?.name || u.storeId}</td>
                        <td className="px-8 py-4 text-right">
                          <button onClick={() => { setUserForm(u); setShowUserModal(true); }} className="text-primary mr-4 hover:underline text-[10px] font-black uppercase">Editar</button>
                          {isAdmin && u.id !== currentUser?.id && <button onClick={() => deleteUser(u.id)} className="text-rose-500 hover:underline text-[10px] font-black uppercase">Excluir</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          </div>
        )}

        {/* ABA UNIDADES */}
        {activeTab === 'stores' && (
          <div className="space-y-6">
            <div className="flex justify-end">
              <button onClick={() => { setStoreForm({ name: '', cnpj: '', location: '', active: true, hasStockAccess: true }); setShowStoreModal(true); }} className="px-6 py-3 bg-primary text-white rounded-xl font-black text-xs uppercase shadow-lg hover:scale-105 transition-all">Nova Unidade</button>
            </div>
            <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border shadow-sm overflow-hidden">
               <table className="w-full text-left">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr className="border-b"><th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400">Nome da Unidade</th><th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400">Localização</th><th className="px-8 py-4 text-[10px] font-black uppercase text-slate-400 text-right">Ações</th></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {establishments.map(e => (
                      <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                        <td className="px-8 py-4 font-black uppercase text-xs">{e.name}</td>
                        <td className="px-8 py-4 uppercase text-[10px] font-bold text-slate-400">{e.location}</td>
                        <td className="px-8 py-4 text-right">
                          <button onClick={() => { setStoreForm(e); setShowStoreModal(true); }} className="text-primary mr-4 hover:underline text-[10px] font-black uppercase">Editar</button>
                          {isAdmin && <button onClick={() => deleteEstablishment(e.id)} className="text-rose-500 hover:underline text-[10px] font-black uppercase">Excluir</button>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
          </div>
        )}

        {activeTab === 'general' && (
           <div className="max-w-4xl bg-white dark:bg-slate-900 p-10 rounded-[3rem] border shadow-sm animate-in fade-in">
              <div className="flex items-center gap-10">
                 <div onClick={() => logoInputRef.current?.click()} className="size-32 bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden cursor-pointer group">
                    {localConfig.logoUrl ? <img src={localConfig.logoUrl} className="size-full object-contain" /> : <span className="material-symbols-outlined text-4xl text-slate-300 group-hover:scale-110 transition-transform">image</span>}
                 </div>
                 <div className="flex-1 space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Nome Comercial</label>
                    <input type="text" value={localConfig.companyName} onChange={e => setLocalConfig({...localConfig, companyName: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 font-black uppercase text-sm border-none outline-none focus:ring-2 focus:ring-primary shadow-inner" />
                    <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={e => {
                       const f = e.target.files?.[0]; if(f){ const r = new FileReader(); r.onloadend = () => setLocalConfig({...localConfig, logoUrl: r.result as string}); r.readAsDataURL(f); }
                    }} />
                 </div>
              </div>
              <button onClick={() => updateConfig(localConfig)} className="w-full h-16 bg-primary text-white rounded-2xl font-black text-xs uppercase shadow-xl mt-10 hover:scale-[1.02] transition-all">Salvar Alterações</button>
           </div>
        )}

        {activeTab === 'permissions' && localPerms && (
           <div className="max-w-4xl space-y-8 bg-white dark:bg-slate-900 p-10 rounded-[3rem] border shadow-sm animate-in slide-in-from-left-4">
              <div className="flex gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl">
                 {[UserRole.MANAGER, UserRole.CASHIER, UserRole.VENDOR].map(role => (
                    <button key={role} onClick={() => setSelectedRolePerm(role)} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${selectedRolePerm === role ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>{role}</button>
                 ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                 {Object.keys(localPerms).map((key) => (
                    <div key={key} className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                       <div className="flex items-center gap-3">
                          <div className={`size-8 rounded-lg flex items-center justify-center ${localPerms[key as keyof RolePermissions] ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                             <span className="material-symbols-outlined text-sm">{getIconForModule(key)}</span>
                          </div>
                          <span className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-300">{getLabelForModule(key)}</span>
                       </div>
                       <button onClick={() => togglePerm(key as keyof RolePermissions)} className={`w-12 h-6 rounded-full relative transition-all ${localPerms[key as keyof RolePermissions] ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                          <div className={`absolute top-1 size-4 bg-white rounded-full shadow-sm transition-all ${localPerms[key as keyof RolePermissions] ? 'right-1' : 'left-1'}`}></div>
                       </button>
                    </div>
                 ))}
              </div>
              <button onClick={handleSavePermissions} disabled={isSaving} className="w-full h-16 bg-primary text-white rounded-2xl font-black text-xs uppercase shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95">Salvar Acessos</button>
           </div>
        )}
      </div>

      {/* MODAIS */}
      {showUserModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border">
              <div className="p-6 bg-primary text-white flex justify-between items-center"><h3 className="font-black uppercase tracking-tight">Dados do Colaborador</h3><button onClick={() => setShowUserModal(false)} className="material-symbols-outlined">close</button></div>
              <form onSubmit={handleSaveUser} className="p-8 space-y-4">
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Nome Completo</label><input required value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} className="w-full h-12 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 border-none font-bold uppercase text-xs" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Login / E-mail</label><input required value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} className="w-full h-12 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 border-none font-bold text-xs" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Senha</label><input required value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full h-12 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 border-none font-bold text-xs" /></div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Perfil</label><select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})} className="w-full h-12 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 border-none font-bold uppercase text-[10px]">{Object.values(UserRole).map(r => <option key={r} value={r}>{r}</option>)}</select></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Unidade</label><select value={userForm.storeId} onChange={e => setUserForm({...userForm, storeId: e.target.value})} className="w-full h-12 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 border-none font-bold uppercase text-[10px]">{establishments.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}</select></div>
                 </div>
                 <button type="submit" className="w-full h-14 bg-primary text-white rounded-2xl font-black text-xs uppercase shadow-xl mt-4">Salvar</button>
              </form>
           </div>
        </div>
      )}

      {showStoreModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden border">
              <div className="p-6 bg-primary text-white flex justify-between items-center"><h3 className="font-black uppercase tracking-tight">Dados da Unidade</h3><button onClick={() => setShowStoreModal(false)} className="material-symbols-outlined">close</button></div>
              <form onSubmit={handleSaveStore} className="p-8 space-y-4">
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Nome da Loja</label><input required value={storeForm.name} onChange={e => setStoreForm({...storeForm, name: e.target.value})} className="w-full h-12 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 border-none font-bold uppercase text-xs" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Endereço</label><input required value={storeForm.location} onChange={e => setStoreForm({...storeForm, location: e.target.value})} className="w-full h-12 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 border-none font-bold uppercase text-xs" /></div>
                 <div className="space-y-1"><label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">CNPJ</label><input value={storeForm.cnpj} onChange={e => setStoreForm({...storeForm, cnpj: e.target.value})} className="w-full h-12 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 border-none font-bold uppercase text-xs" /></div>
                 <button type="submit" className="w-full h-14 bg-primary text-white rounded-2xl font-black text-xs uppercase shadow-xl mt-4">Salvar</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

const getLabelForModule = (key: string) => {
  const labels: Record<string, string> = {
    dashboard: 'Dashboard', pdv: 'Frente de Caixa (PDV)', cashControl: 'Controle de Caixa', customers: 'Gestão de Clientes', reports: 'Relatórios', inventory: 'Produtos', balance: 'Balanço de Estoque', incomes: 'Receitas', expenses: 'Despesas', financial: 'DRE / Resultado', settings: 'Configurações', serviceOrders: 'Ordens de Serviço (OS)', cardManagement: 'Cartões'
  };
  return labels[key] || key;
};

const getIconForModule = (key: string) => {
  const icons: Record<string, string> = {
    dashboard: 'monitoring', pdv: 'point_of_sale', cashControl: 'account_balance_wallet', customers: 'groups', reports: 'list_alt', inventory: 'inventory_2', balance: 'inventory', incomes: 'payments', expenses: 'money_off', financial: 'account_balance', settings: 'settings', serviceOrders: 'build', cardManagement: 'credit_card'
  };
  return icons[key] || 'label';
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: string; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-all whitespace-nowrap ${active ? 'border-primary text-primary font-black scale-105' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
    <span className="material-symbols-outlined text-lg">{icon}</span>
    <span className="text-xs uppercase font-bold tracking-widest">{label}</span>
  </button>
);

export default Settings;
