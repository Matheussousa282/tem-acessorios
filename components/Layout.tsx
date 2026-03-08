
// Implementação do layout principal com navegação lateral e controle de acesso por permissões.
import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useApp } from '../AppContext';

const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, logout, rolePermissions, systemConfig } = useApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    VENDAS: true,
    ESTOQUE: true,
    FINANCEIRO: true
  });

  const toggleGroup = (label: string) => {
    setOpenGroups(prev => ({ ...prev, [label]: !prev[label] }));
  };

  const menuGroups = [
    {
      label: 'DASHBOARD',
      icon: 'grid_view',
      path: '/',
      perm: 'dashboard'
    },
    {
      label: 'VENDAS',
      icon: 'shopping_cart',
      perm: 'pdv',
      subItems: [
        { path: '/caixa', label: 'CAIXA', perm: 'cashControl' },
        { path: '/pdv', label: 'FRENTE DE CAIXA', perm: 'pdv' },
        { path: '/documentos', label: 'DOCUMENTOS', perm: 'dashboard' },
        { path: '/clientes', label: 'CLIENTES', perm: 'customers' },
        { path: '/relatorios', label: 'RELATÓRIOS', perm: 'reports' },
      ]
    },
    {
      label: 'ESTOQUE',
      icon: 'inventory_2',
      perm: 'inventory',
      subItems: [
        { path: '/estoque', label: 'PRODUTOS', perm: 'inventory' },
        { path: '/balanco', label: 'BALANÇO', perm: 'balance' },
      ]
    },
    {
      label: 'SERVIÇOS (OS)',
      icon: 'build',
      path: '/servicos',
      perm: 'serviceOrders'
    },
    {
      label: 'FINANCEIRO',
      icon: 'account_balance',
      perm: 'financial',
      subItems: [
        { path: '/entradas', label: 'RECEITAS', perm: 'incomes' },
        { path: '/saidas', label: 'DESPESAS', perm: 'expenses' },
        { path: '/dre', label: 'DRE', perm: 'financial' },
      ]
    },
    {
      label: 'CONFIGURAÇÕES',
      icon: 'settings',
      path: '/config',
      perm: 'settings'
    }
  ];

  const hasPermission = (perm: string) => {
    if (!currentUser) return false;
    const perms = rolePermissions[currentUser.role] as any;
    return perms ? perms[perm] : true;
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Auto-open group if a sub-item is active
  useEffect(() => {
    menuGroups.forEach(group => {
      if (group.subItems?.some(sub => sub.path === location.pathname)) {
        setOpenGroups(prev => ({ ...prev, [group.label]: true }));
      }
    });
  }, [location.pathname]);

  return (
    <div className="flex h-screen bg-slate-50 dark:bg-[#0a0f16]">
      <aside className={`${sidebarOpen ? 'w-64' : 'w-20'} bg-[#101822] text-slate-400 transition-all flex flex-col border-r border-slate-800`}>
        <div className="p-6 flex items-center gap-3">
          <div className="size-8 bg-primary rounded flex items-center justify-center text-white shrink-0 overflow-hidden">
            {systemConfig.logoUrl ? (
              <img src={systemConfig.logoUrl} className="size-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <span className="material-symbols-outlined text-xl">storefront</span>
            )}
          </div>
          {sidebarOpen && <span className="font-bold text-sm uppercase tracking-widest text-white truncate">{systemConfig.companyName || 'Retail Pro'}</span>}
        </div>

        <nav className="flex-1 overflow-y-auto px-4 py-2 space-y-1 custom-scrollbar">
          {menuGroups.map(group => {
            if (!hasPermission(group.perm)) return null;

            const isGroupActive = group.path === location.pathname || group.subItems?.some(sub => sub.path === location.pathname);

            if (!group.subItems) {
              return (
                <Link
                  key={group.label}
                  to={group.path!}
                  className={`flex items-center gap-4 p-3 rounded-lg transition-all ${location.pathname === group.path ? 'bg-primary text-white shadow-lg' : 'hover:bg-slate-800/50 hover:text-white'}`}
                >
                  <span className="material-symbols-outlined text-xl">{group.icon}</span>
                  {sidebarOpen && <span className="text-[11px] font-bold uppercase tracking-widest">{group.label}</span>}
                </Link>
              );
            }

            const isOpen = openGroups[group.label];

            return (
              <div key={group.label} className="space-y-1">
                <button
                  onClick={() => toggleGroup(group.label)}
                  className={`w-full flex items-center justify-between p-3 rounded-lg transition-all hover:bg-slate-800/50 hover:text-white ${isGroupActive && !isOpen ? 'text-white' : ''}`}
                >
                  <div className="flex items-center gap-4">
                    <span className="material-symbols-outlined text-xl">{group.icon}</span>
                    {sidebarOpen && <span className="text-[11px] font-bold uppercase tracking-widest">{group.label}</span>}
                  </div>
                  {sidebarOpen && (
                    <span className={`material-symbols-outlined text-sm transition-transform ${isOpen ? 'rotate-180' : ''}`}>
                      expand_more
                    </span>
                  )}
                </button>

                {isOpen && sidebarOpen && (
                  <div className="ml-6 pl-4 border-l border-slate-800 space-y-1">
                    {group.subItems.map(sub => {
                      if (!hasPermission(sub.perm)) return null;
                      const isActive = location.pathname === sub.path;
                      return (
                        <Link
                          key={sub.path}
                          to={sub.path}
                          className={`block p-2 text-[10px] font-bold uppercase tracking-widest transition-all ${isActive ? 'text-primary' : 'hover:text-white'}`}
                        >
                          {sub.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4 px-2">
             <div className="size-8 rounded bg-slate-800 overflow-hidden shrink-0">
                {currentUser?.avatar ? <img src={currentUser.avatar} referrerPolicy="no-referrer" /> : <div className="size-full flex items-center justify-center text-slate-500"><span className="material-symbols-outlined text-sm">person</span></div>}
             </div>
             {sidebarOpen && (
                <div className="min-w-0">
                   <p className="text-[10px] font-bold uppercase truncate text-white">{currentUser?.name}</p>
                   <p className="text-[8px] text-slate-500 uppercase">{currentUser?.role}</p>
                </div>
             )}
          </div>
          <button onClick={handleLogout} className="w-full flex items-center gap-4 p-3 text-slate-500 hover:text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all">
            <span className="material-symbols-outlined text-xl">logout</span>
            {sidebarOpen && <span className="text-[11px] font-bold uppercase tracking-widest">Sair</span>}
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden flex flex-col">
        <header className="h-16 bg-white dark:bg-[#101822] border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-8">
           <button onClick={() => setSidebarOpen(!sidebarOpen)} className="text-slate-400 hover:text-white transition-colors">
             <span className="material-symbols-outlined">menu</span>
           </button>
           <div className="flex items-center gap-4">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}
              </span>
           </div>
        </header>
        <div className="flex-1 overflow-y-auto bg-slate-50 dark:bg-[#0a0f16]">
           {children}
        </div>
      </main>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 10px; }
      `}</style>
    </div>
  );
};

export default Layout;
