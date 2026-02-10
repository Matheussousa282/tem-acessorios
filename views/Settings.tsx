
import React, { useState, useEffect, useRef } from 'react';
import { UserRole, User, Establishment, RolePermissions } from '../types';
import { useApp, INITIAL_PERMS } from '../AppContext';

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

  const isAdmin = currentUser?.role === UserRole.ADMIN;

  const [userForm, setUserForm] = useState<Partial<User>>({
    name: '', email: '', password: '', role: UserRole.VENDOR, storeId: '', active: true, commissionActive: false, commissionRate: 0
  });
  
  const [storeForm, setStoreForm] = useState<Partial<Establishment>>({
    name: '', cnpj: '', location: '', hasStockAccess: true, active: true
  });

  const ALL_PERM_KEYS: (keyof RolePermissions)[] = [
    'dashboard', 'pdv', 'cashControl', 'customers', 'reports', 
    'inventory', 'balance', 'incomes', 'expenses', 
    'financial', 'settings', 'serviceOrders', 'cardManagement', 'editProducts'
  ];

  useEffect(() => {
    setLocalConfig(systemConfig);
  }, [systemConfig]);

  useEffect(() => {
    if (rolePermissions[selectedRolePerm]) {
      const current = rolePermissions[selectedRolePerm] as any;
      const merged: any = {};
      ALL_PERM_KEYS.forEach(key => {
        merged[key] = current[key] ?? INITIAL_PERMS[selectedRolePerm][key] ?? false;
      });
      setLocalPerms(merged);
    } else {
      setLocalPerms({ ...INITIAL_PERMS[selectedRolePerm] });
    }
  }, [selectedRolePerm, rolePermissions]);

  const filteredUsers = users.filter(u => isAdmin || u.storeId === currentUser?.storeId);
  const filteredStores = establishments.filter(e => isAdmin || e.id === currentUser?.storeId);

  const handleSaveConfig = async () => {
    setIsSaving(true);
    try {
      await updateConfig(localConfig);
    } catch (e) {
      alert("Erro ao salvar configurações");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userForm.password && !userForm.id) {
      alert("A senha é obrigatória para novos colaboradores!");
      return;
    }
    const newUser: User = {
      ...userForm as User,
      id: userForm.id || `user-${Date.now()}`,
      active: true
    };
    await addUser(newUser);
    setShowUserModal(false);
  };

  const handleSaveStore = async (e: React.FormEvent) => {
    e.preventDefault();
    const newStore: Establishment = {
      ...storeForm as Establishment,
      id: storeForm.id || `est-${Date.now()}`
    };
    await addEstablishment(newStore);
    setShowStoreModal(false);
  };

  const handleSavePermissions = async () => {
    if (!localPerms) return;
    setIsSaving(true);
    try {
      await updateRolePermissions(selectedRolePerm, localPerms);
      alert(`Permissões para ${selectedRolePerm} atualizadas com sucesso!`);
    } catch (e) {
      alert("Erro ao salvar permissões");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSyncDB = async () => {
     if(confirm("Deseja forçar a sincronização de tabelas com o banco Neon? Isso garantirá que todas as colunas novas existam.")) {
        const res = await fetch('/api/init-db');
        if (res.ok) {
          await refreshData();
          alert("Sincronização Neon concluída com sucesso!");
        } else {
          alert("Erro ao sincronizar banco.");
        }
     }
  };

  const togglePerm = (key: keyof RolePermissions) => {
    if (!localPerms) return;
    setLocalPerms({ ...localPerms, [key]: !localPerms[key] });
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 pb-20">
      <div className="flex flex-col gap-1">
        <h1 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Ajustes do Sistema</h1>
        <p className="text-slate-500 text-sm font-bold uppercase tracking-tight">Administração de identidade, equipe e permissões.</p>
      </div>

      <div className="flex border-b border-slate-200 dark:border-slate-800 overflow-x-auto no-scrollbar gap-2">
        <TabButton active={activeTab === 'general'} onClick={() => setActiveTab('general')} icon="palette" label="Identidade" />
        <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon="badge" label="Colaboradores" />
        <TabButton active={activeTab === 'stores'} onClick={() => setActiveTab('stores')} icon="store" label="Unidades" />
        {isAdmin && <TabButton active={activeTab === 'permissions'} onClick={() => setActiveTab('permissions')} icon="shield_person" label="Permissões" />}
        {isAdmin && <TabButton active={activeTab === 'db'} onClick={() => setActiveTab('db')} icon="dns" label="Infraestrutura" />}
      </div>

      <div className="mt-6">
        {activeTab === 'general' && (
          <div className="max-w-4xl space-y-8">
             <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
                <div className="flex items-center gap-10">
                   <div className="size-32 bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden">
                      {localConfig.logoUrl ? <img src={localConfig.logoUrl} className="size-full object-contain" /> : <span className="material-symbols-outlined text-4xl text-slate-300">image</span>}
                   </div>
                   <div className="flex-1 space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Nome Comercial</label>
                           <input type="text" value={localConfig.companyName} onChange={e => setLocalConfig({...localConfig, companyName: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 font-black text-sm border-none outline-none focus:ring-2 focus:ring-primary uppercase" />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Prazo para Troca (Dias)</label>
                           <input type="number" value={localConfig.returnPeriodDays} onChange={e => setLocalConfig({...localConfig, returnPeriodDays: parseInt(e.target.value) || 30})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 font-black text-sm border-none outline-none focus:ring-2 focus:ring-primary" />
                        </div>
                      </div>
                      <button onClick={() => logoInputRef.current?.click()} className="text-[10px] font-black text-primary uppercase underline">Subir Logotipo</button>
                      <input type="file" ref={logoInputRef} className="hidden" onChange={e => {
                         const file = e.target.files?.[0];
                         if(file) {
                            const reader = new FileReader();
                            reader.onloadend = () => setLocalConfig({...localConfig, logoUrl: reader.result as string});
                            reader.readAsDataURL(file);
                         }
                      }} />
                   </div>
                </div>
                <button onClick={handleSaveConfig} className="w-full h-16 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2">
                  {isSaving ? <span className="material-symbols-outlined animate-spin">sync</span> : null}
                  {isSaving ? 'Salvando...' : 'Atualizar Configurações'}
                </button>
             </div>
          </div>
        )}

        {activeTab === 'users' && (
           <div className="space-y-6">
              <div className="flex justify-between items-center px-4">
                 <h3 className="text-xl font-black uppercase tracking-tight">Gestão de Colaboradores ({filteredUsers.length})</h3>
                 <button onClick={() => { setUserForm({ name: '', email: '', password: '', role: UserRole.VENDOR, storeId: currentUser?.storeId || '', commissionActive: false, commissionRate: 0 }); setShowUserModal(true); }} className="px-8 py-3 bg-primary text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg">Novo Cadastro</button>
              </div>
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden">
                 <table className="w-full text-left">
                    <thead className="bg-slate-50 dark:bg-slate-800/50"><tr className="border-b border-slate-100 dark:border-slate-800"><th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400">Nome / E-mail</th><th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400">Acesso / Unidade</th><th className="px-10 py-6 text-[10px] font-black uppercase text-slate-400 text-right">Ações</th></tr></thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                       {filteredUsers.map(u => {
                          const store = establishments.find(e => e.id === u.storeId);
                          return (
                            <tr key={u.id} className="hover:bg-slate-50 transition-all">
                              <td className="px-10 py-6"><p className="text-sm font-black uppercase">{u.name}</p><p className="text-[10px] text-slate-400">{u.email}</p></td>
                              <td className="px-10 py-6"><span className="text-[10px] font-black uppercase text-primary bg-primary/10 px-3 py-1 rounded-lg">{u.role}</span><p className="text-[9px] text-slate-400 mt-1 uppercase font-bold">{store?.name || u.storeId}</p></td>
                              <td className="px-10 py-6 text-right"><button onClick={() => { setUserForm(u); setShowUserModal(true); }} className="size-10 bg-slate-100 dark:bg-slate-800 rounded-xl"><span className="material-symbols-outlined text-lg">edit</span></button></td>
                            </tr>
                          );
                       })}
                    </tbody>
                 </table>
              </div>
           </div>
        )}

        {activeTab === 'stores' && (
           <div className="space-y-6">
              <div className="flex justify-between items-center px-4">
                 <h3 className="text-xl font-black uppercase tracking-tight">Unidades do Grupo ({filteredStores.length})</h3>
                 <button onClick={() => setShowStoreModal(true)} className="px-8 py-3 bg-primary text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg">Nova Loja</button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {filteredStores.map(e => (
                   <div key={e.id} className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm relative group hover:border-primary transition-all">
                      <h4 className="text-lg font-black uppercase mb-1">{e.name}</h4>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{e.location}</p>
                      <p className="text-[10px] font-black text-primary mt-4">CNPJ: {e.cnpj}</p>
                   </div>
                 ))}
              </div>
           </div>
        )}

        {activeTab === 'permissions' && isAdmin && (
          <div className="max-w-4xl space-y-8 animate-in slide-in-from-left-4">
             <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-8">
                <div className="space-y-2">
                   <h3 className="text-xl font-black uppercase tracking-tight">Configuração de Acessos</h3>
                   <p className="text-xs font-bold text-slate-400 uppercase">Defina o que cada cargo pode visualizar e operar no sistema.</p>
                </div>
                
                <div className="flex gap-2 bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl">
                   {[UserRole.MANAGER, UserRole.CASHIER, UserRole.VENDOR].map(role => (
                      <button 
                        key={role} 
                        onClick={() => setSelectedRolePerm(role)}
                        className={`flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${selectedRolePerm === role ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-slate-400 hover:text-slate-600'}`}
                      >
                         {role}
                      </button>
                   ))}
                </div>

                {localPerms && (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {ALL_PERM_KEYS.map((key) => (
                         <div key={key} className="flex items-center justify-between p-5 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-700">
                            <div className="flex items-center gap-3">
                               <div className={`size-8 rounded-lg flex items-center justify-center ${localPerms[key] ? 'bg-primary text-white' : 'bg-slate-200 dark:bg-slate-700 text-slate-400'}`}>
                                  <span className="material-symbols-outlined text-sm">{getIconForModule(key)}</span>
                               </div>
                               <span className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-300">{getLabelForModule(key)}</span>
                            </div>
                            <button 
                              onClick={() => togglePerm(key)}
                              className={`w-12 h-6 rounded-full relative transition-all ${localPerms[key] ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}
                            >
                               <div className={`absolute top-1 size-4 bg-white rounded-full shadow-sm transition-all ${localPerms[key] ? 'right-1' : 'left-1'}`}></div>
                            </button>
                         </div>
                      ))}
                   </div>
                )}

                <button onClick={handleSavePermissions} disabled={isSaving} className="w-full h-16 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-2">
                   {isSaving ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">shield</span>}
                   {isSaving ? 'Salvando...' : `Salvar Permissões para ${selectedRolePerm}`}
                </button>
             </div>
          </div>
        )}

        {activeTab === 'db' && isAdmin && (
           <div className="max-w-4xl space-y-8 animate-in slide-in-from-right-4">
              <div className="bg-slate-900 p-12 rounded-[3rem] text-white shadow-2xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 size-64 bg-primary/20 blur-[100px] rounded-full"></div>
                 <div className="relative z-10 space-y-6">
                    <div className="size-20 bg-primary/20 rounded-3xl flex items-center justify-center mb-6"><span className="material-symbols-outlined text-4xl">database</span></div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter">Manutenção de Dados</h2>
                    <p className="text-slate-400 text-sm font-bold uppercase leading-relaxed max-w-lg">Gerencie a estrutura do banco de dados Neon. Use a sincronização forçada se notar campos ausentes após atualizações do sistema.</p>
                    <div className="flex gap-4 pt-6">
                       <button onClick={handleSyncDB} className="px-10 py-5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-105 transition-all shadow-xl shadow-primary/20">Forçar Sincronização Neon</button>
                       <button onClick={() => refreshData()} className="px-10 py-5 bg-white/10 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-white/20">Recarregar Cache</button>
                    </div>
                 </div>
              </div>
           </div>
        )}
      </div>

      {showUserModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-primary text-white flex justify-between items-center">
                 <h3 className="text-2xl font-black uppercase">Colaborador</h3>
                 <button onClick={() => setShowUserModal(false)}><span className="material-symbols-outlined">close</span></button>
              </div>
              <form onSubmit={handleSaveUser} className="p-10 space-y-4">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Nome Completo</label>
                    <input placeholder="Ex: Carlos Silva" value={userForm.name} onChange={e => setUserForm({...userForm, name: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-xl px-6 font-bold border-none uppercase" required />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">E-mail de Acesso</label>
                    <input placeholder="Ex: carlos@loja.com" type="email" value={userForm.email} onChange={e => setUserForm({...userForm, email: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-xl px-6 font-bold border-none" required />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Senha de Login</label>
                    <input placeholder="Digite a senha" type="password" value={userForm.password} onChange={e => setUserForm({...userForm, password: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-xl px-6 font-bold border-none" required={!userForm.id} />
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Unidade / Loja</label>
                    <select value={userForm.storeId} onChange={e => setUserForm({...userForm, storeId: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-xl px-6 font-bold border-none" required>
                       <option value="">Selecione a Unidade</option>
                       {establishments.map(est => <option key={est.id} value={est.id}>{est.name}</option>)}
                    </select>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Cargo / Função</label>
                    <select value={userForm.role} onChange={e => setUserForm({...userForm, role: e.target.value as UserRole})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-xl px-6 font-bold border-none">
                       <option value={UserRole.VENDOR}>VENDEDOR</option>
                       <option value={UserRole.MANAGER}>GERENTE</option>
                       <option value={UserRole.CASHIER}>CAIXA</option>
                       <option value={UserRole.ADMIN}>ADMINISTRADOR</option>
                    </select>
                 </div>
                 <div className="p-4 bg-emerald-500/10 rounded-2xl space-y-3">
                    <div className="flex justify-between items-center">
                       <span className="text-[10px] font-black uppercase">Comissão Ativa?</span>
                       <input type="checkbox" checked={userForm.commissionActive} onChange={e => setUserForm({...userForm, commissionActive: e.target.checked})} />
                    </div>
                    {userForm.commissionActive && <input type="number" step="0.1" value={userForm.commissionRate} onChange={e => setUserForm({...userForm, commissionRate: parseFloat(e.target.value)})} placeholder="% Comissão" className="w-full h-12 bg-white rounded-lg px-4 text-xs font-black border-none" />}
                 </div>
                 <button type="submit" className="w-full h-16 bg-primary text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Salvar Colaborador</button>
              </form>
           </div>
        </div>
      )}

      {showStoreModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-900 text-white flex justify-between items-center">
                 <h3 className="text-2xl font-black uppercase">Nova Unidade</h3>
                 <button onClick={() => setShowStoreModal(false)}><span className="material-symbols-outlined">close</span></button>
              </div>
              <form onSubmit={handleSaveStore} className="p-10 space-y-4">
                 <input placeholder="Nome da Loja" value={storeForm.name} onChange={e => setStoreForm({...storeForm, name: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-xl px-6 font-bold border-none" required />
                 <input placeholder="Localização / Endereço" value={storeForm.location} onChange={e => setStoreForm({...storeForm, location: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-xl px-6 font-bold border-none" required />
                 <input placeholder="CNPJ" value={storeForm.cnpj} onChange={e => setStoreForm({...storeForm, cnpj: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-xl px-6 font-bold border-none" />
                 <button type="submit" className="w-full h-16 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl">Salvar Unidade</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

const getLabelForModule = (key: string) => {
  const labels: Record<string, string> = {
    dashboard: 'Dashboard / Resumo',
    pdv: 'Frente de Caixa (PDV)',
    cashControl: 'Controle de Caixa',
    customers: 'Gestão de Clientes',
    reports: 'Relatórios de Venda',
    inventory: 'Catálogo de Produtos',
    balance: 'Balanço de Estoque',
    incomes: 'Controle de Receitas',
    expenses: 'Controle de Despesas',
    financial: 'DRE / Resultado',
    settings: 'Configurações Sistema',
    serviceOrders: 'Ordens de Serviço',
    cardManagement: 'Gestão de Cartões',
    editProducts: 'Habilitar Alteração de Produtos'
  };
  return labels[key] || key;
};

const getIconForModule = (key: string) => {
  const icons: Record<string, string> = {
    dashboard: 'dashboard',
    pdv: 'point_of_sale',
    cashControl: 'account_balance_wallet',
    customers: 'groups',
    reports: 'monitoring',
    inventory: 'inventory_2',
    balance: 'inventory',
    incomes: 'payments',
    expenses: 'money_off',
    financial: 'account_balance',
    settings: 'settings',
    serviceOrders: 'build',
    cardManagement: 'credit_card',
    editProducts: 'edit_square'
  };
  return icons[key] || 'label';
};

const TabButton: React.FC<{ active: boolean; onClick: () => void; icon: string; label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`flex items-center gap-2 px-6 py-4 border-b-2 transition-all whitespace-nowrap ${active ? 'border-primary text-primary font-black' : 'border-transparent text-slate-500 hover:text-slate-700'}`}>
    <span className="material-symbols-outlined text-lg">{icon}</span>
    <span className="text-xs uppercase tracking-widest font-bold">{label}</span>
  </button>
);

export default Settings;
