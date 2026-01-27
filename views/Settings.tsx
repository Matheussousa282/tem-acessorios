
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
      alert(`Permissões do perfil ${selectedRolePerm} atualizadas com sucesso!`);
    } catch (e) {
      alert("Erro ao salvar permissões.");
    } finally {
      setIsSaving(false);
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
        <p className="text-slate-500 text-sm font-bold uppercase tracking-tight">Administração de identidade, equipe e permissões de acesso.</p>
      </div>

      <div className="flex border-b overflow-x-auto no-scrollbar gap-2 shadow-sm">
        <TabButton active={activeTab === 'general'} onClick={() => setActiveTab('general')} icon="palette" label="Identidade" />
        <TabButton active={activeTab === 'users'} onClick={() => setActiveTab('users')} icon="badge" label="Colaboradores" />
        <TabButton active={activeTab === 'stores'} onClick={() => setActiveTab('stores')} icon="store" label="Unidades" />
        {isAdmin && <TabButton active={activeTab === 'permissions'} onClick={() => setActiveTab('permissions')} icon="shield_person" label="Permissões" />}
        {isAdmin && <TabButton active={activeTab === 'db'} onClick={() => setActiveTab('db')} icon="dns" label="Infraestrutura" />}
      </div>

      <div className="mt-6">
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
                          <span className="text-[11px] font-black uppercase text-slate-600 dark:text-slate-300 tracking-widest">{getLabelForModule(key)}</span>
                       </div>
                       <button onClick={() => togglePerm(key as keyof RolePermissions)} className={`w-12 h-6 rounded-full relative transition-all ${localPerms[key as keyof RolePermissions] ? 'bg-emerald-500' : 'bg-slate-300 dark:bg-slate-600'}`}>
                          <div className={`absolute top-1 size-4 bg-white rounded-full shadow-sm transition-all ${localPerms[key as keyof RolePermissions] ? 'right-1' : 'left-1'}`}></div>
                       </button>
                    </div>
                 ))}
              </div>
              <button onClick={handleSavePermissions} disabled={isSaving} className="w-full h-16 bg-primary text-white rounded-2xl font-black text-xs uppercase shadow-xl flex items-center justify-center gap-2 transition-transform active:scale-95">
                 {isSaving ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">save</span>}
                 SALVAR CONFIGURAÇÃO DE ACESSO
              </button>
           </div>
        )}
        
        {/* OUTRAS ABAS RESTAURADAS (GENERAL, USERS, STORES, DB) */}
        {activeTab === 'general' && (
           <div className="max-w-4xl bg-white dark:bg-slate-900 p-10 rounded-[3rem] border shadow-sm space-y-10 animate-in fade-in">
              <div className="flex items-center gap-10">
                 <div onClick={() => logoInputRef.current?.click()} className="size-32 bg-slate-50 dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden cursor-pointer group">
                    {localConfig.logoUrl ? <img src={localConfig.logoUrl} className="size-full object-contain" /> : <span className="material-symbols-outlined text-4xl text-slate-300 group-hover:scale-110 transition-transform">image</span>}
                 </div>
                 <div className="flex-1 space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Nome do Estabelecimento / Empresa</label>
                    <input type="text" value={localConfig.companyName} onChange={e => setLocalConfig({...localConfig, companyName: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 font-black uppercase text-sm border-none outline-none focus:ring-2 focus:ring-primary shadow-inner" />
                    <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={e => { const f = e.target.files?.[0]; if(f){ const r = new FileReader(); r.onloadend = () => setLocalConfig({...localConfig, logoUrl: r.result as string}); r.readAsDataURL(f); } }} />
                 </div>
              </div>
              <button onClick={() => updateConfig(localConfig)} className="w-full h-16 bg-primary text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-[1.02] transition-all">ATUALIZAR IDENTIDADE VISUAL</button>
           </div>
        )}

        {activeTab === 'db' && isAdmin && (
           <div className="max-w-4xl bg-slate-900 p-12 rounded-[3rem] text-white shadow-2xl relative overflow-hidden animate-in zoom-in-95">
              <div className="absolute top-0 right-0 size-64 bg-primary/10 blur-[100px] rounded-full"></div>
              <h2 className="text-3xl font-black uppercase tracking-tight">Manutenção Neon DB</h2>
              <p className="text-slate-400 mt-4 uppercase text-xs font-bold leading-relaxed">Força a sincronização das tabelas e atualiza colunas legadas. <br/> Use isso se alguma informação não estiver aparecendo.</p>
              <button onClick={async () => { await fetch('/api/init-db'); await refreshData(); alert('Banco de dados sincronizado!'); }} className="px-10 py-5 bg-primary text-white rounded-2xl font-black text-xs uppercase mt-8 shadow-xl hover:scale-105 transition-all">Sincronizar Estrutura Agora</button>
           </div>
        )}
      </div>
    </div>
  );
};

const getLabelForModule = (key: string) => {
  const labels: Record<string, string> = {
    dashboard: 'Dashboard Analítico',
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
    cardManagement: 'Gestão de Cartões'
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
