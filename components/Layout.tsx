
import React, { ReactNode, useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useApp, INITIAL_PERMS } from '../AppContext';
import { UserRole } from '../types';

interface LayoutProps { children: ReactNode; }

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout, systemConfig, rolePermissions, establishments } = useApp();
  const isPDV = location.pathname === '/pdv';
  
  const [isStockOpen, setIsStockOpen] = useState(false);
  const [isVendasOpen, setIsVendasOpen] = useState(false);
  const [isFinancialOpen, setIsFinancialOpen] = useState(false);

  const [isLightMode, setIsLightMode] = useState(() => {
    return localStorage.getItem('theme') === 'light';
  });

  useEffect(() => {
    const html = document.documentElement;
    if (isLightMode) {
      html.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    } else {
      html.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    }
  }, [isLightMode]);

  const perms = useMemo(() => {
    if (!currentUser) return INITIAL_PERMS[UserRole.VENDOR];
    return rolePermissions[currentUser.role] || INITIAL_PERMS[currentUser.role] || INITIAL_PERMS[UserRole.VENDOR];
  }, [rolePermissions, currentUser?.role]);

  if (!currentUser) return null;
  if (isPDV) return <div className="h-screen w-full overflow-hidden">{children}</div>;

  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark font-display transition-colors duration-300">
      <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-background-dark flex flex-col justify-between p-4 z-50 overflow-y-auto no-scrollbar print:hidden">
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-3 px-2">
            <div className="bg-primary rounded-lg size-10 flex items-center justify-center text-white shadow-lg overflow-hidden">
              {systemConfig.logoUrl ? <img src={systemConfig.logoUrl} className="size-full object-cover" /> : <span className="material-symbols-outlined">storefront</span>}
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-slate-900 dark:text-white text-sm font-black leading-tight truncate uppercase">{systemConfig.companyName}</h1>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Gestão Neon</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            {perms.dashboard && <SidebarItem to="/" icon="dashboard" label="Dashboard" />}
            
            <div className="flex flex-col">
              <button onClick={() => setIsVendasOpen(!isVendasOpen)} className="flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                <div className="flex items-center gap-3"><span className="material-symbols-outlined text-xl">shopping_cart</span><span className="text-xs font-black uppercase tracking-widest">Vendas</span></div>
                <span className={`material-symbols-outlined text-sm transition-transform ${isVendasOpen ? 'rotate-180' : ''}`}>expand_more</span>
              </button>
              {isVendasOpen && (
                <div className="flex flex-col ml-9 mt-1 border-l dark:border-slate-800 gap-1">
                  {perms.cashControl && <SidebarSubItem to="/caixa" label="Caixa" />}
                  {perms.pdv && <SidebarSubItem to="/pdv" label="Frente de Caixa" />}
                  <SidebarSubItem to="/documentos" label="Documentos" />
                  {perms.customers && <SidebarSubItem to="/clientes" label="Clientes" />}
                  {perms.reports && <SidebarSubItem to="/relatorios" label="Relatórios" />}
                </div>
              )}
            </div>

            {perms.inventory && (
              <div className="flex flex-col">
                <button onClick={() => setIsStockOpen(!isStockOpen)} className="flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <div className="flex items-center gap-3"><span className="material-symbols-outlined text-xl">inventory_2</span><span className="text-xs font-black uppercase tracking-widest">Estoque</span></div>
                  <span className={`material-symbols-outlined text-sm transition-transform ${isStockOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                {isStockOpen && (
                  <div className="flex flex-col ml-9 mt-1 border-l dark:border-slate-800 gap-1">
                    <SidebarSubItem to="/estoque" label="Produtos" />
                    <SidebarSubItem to="/balanco" label="Balanço" />
                  </div>
                )}
              </div>
            )}

            {perms.serviceOrders && (
              <SidebarItem to="/servicos" icon="build" label="Serviços (OS)" />
            )}

            {perms.financial && (
              <div className="flex flex-col">
                <button onClick={() => setIsFinancialOpen(!isFinancialOpen)} className="flex items-center justify-between px-3 py-2.5 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800">
                  <div className="flex items-center gap-3"><span className="material-symbols-outlined text-xl">account_balance</span><span className="text-xs font-black uppercase tracking-widest">Financeiro</span></div>
                  <span className={`material-symbols-outlined text-sm transition-transform ${isFinancialOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                {isFinancialOpen && (
                  <div className="flex flex-col ml-9 mt-1 border-l dark:border-slate-800 gap-1">
                    <SidebarSubItem to="/entradas" label="Receitas" />
                    <SidebarSubItem to="/saidas" label="Despesas" />
                    <SidebarSubItem to="/dre" label="DRE" />
                  </div>
                )}
              </div>
            )}
            
            {perms.settings && <SidebarItem to="/config" icon="settings" label="Configurações" />}
          </nav>
        </div>

        <div className="pt-4 border-t dark:border-slate-800">
           <div className="flex items-center gap-3 px-2 py-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl">
              <div className="size-10 rounded-xl bg-primary text-white flex items-center justify-center font-black">{currentUser.name.charAt(0)}</div>
              <div className="flex-1 min-w-0"><p className="text-[11px] font-black dark:text-white uppercase truncate">{currentUser.name}</p><p className="text-[9px] font-bold text-slate-400 uppercase">{currentUser.role}</p></div>
              <button onClick={() => { logout(); navigate('/login'); }} className="text-rose-500 hover:scale-110 transition-transform"><span className="material-symbols-outlined text-lg">logout</span></button>
           </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden bg-background-light dark:bg-background-dark print:overflow-visible">
        <header className="h-16 flex-shrink-0 border-b dark:border-slate-800 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md flex items-center justify-between px-8 print:hidden">
           <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest"><span className="size-2 bg-primary rounded-full animate-pulse"></span> Sistema Operacional</div>
           <div className="flex items-center gap-4">
              <button onClick={() => setIsLightMode(!isLightMode)} className="material-symbols-outlined text-slate-400 hover:text-primary transition-colors">{isLightMode ? 'dark_mode' : 'light_mode'}</button>
              <div className="h-6 w-px bg-slate-200 dark:bg-slate-800"></div>
              <span className="text-xs font-black text-primary uppercase">{establishments.find(e => e.id === currentUser.storeId)?.name || 'Local'}</span>
           </div>
        </header>
        <div className="flex-1 overflow-y-auto no-scrollbar print:overflow-visible print:block">{children}</div>
      </main>
    </div>
  );
};

const SidebarItem = ({ to, icon, label }: any) => (
  <NavLink to={to} className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive ? 'bg-primary text-white shadow-lg font-black' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800'}`}><span className="material-symbols-outlined text-xl">{icon}</span><span className="text-xs font-black uppercase tracking-widest">{label}</span></NavLink>
);

const SidebarSubItem = ({ to, label }: any) => (
  <NavLink to={to} className={({ isActive }) => `px-4 py-2 text-[10px] font-bold uppercase transition-all ${isActive ? 'text-primary bg-primary/5 border-l-2 border-primary font-black' : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'}`}>{label}</NavLink>
);

export default Layout;
