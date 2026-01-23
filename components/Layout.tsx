
import React, { ReactNode, useState, useEffect, useMemo } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useApp, INITIAL_PERMS } from '../AppContext';
import { UserRole, RolePermissions } from '../types';

interface LayoutProps { children: ReactNode; }

const Layout: React.FC<LayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { currentUser, logout, systemConfig, rolePermissions, establishments } = useApp();
  const isPDV = location.pathname === '/pdv';
  
  // Controle de estados dos menus expansíveis
  const [isStockOpen, setIsStockOpen] = useState(false);
  const [isVendasOpen, setIsVendasOpen] = useState(false);
  const [isFinancialOpen, setIsFinancialOpen] = useState(false);
  const [isOSOpen, setIsOSOpen] = useState(false);
  const [isReportsMenuOpen, setIsReportsMenuOpen] = useState(false);

  // Sincroniza a abertura dos menus com a rota atual no primeiro carregamento
  useEffect(() => {
    if (location.pathname.includes('estoque') || location.pathname.includes('balanco')) setIsStockOpen(true);
    if (location.pathname.includes('pdv') || location.pathname.includes('clientes') || location.pathname.includes('caixa')) setIsVendasOpen(true);
    if (location.pathname.includes('entradas') || location.pathname.includes('saidas') || location.pathname.includes('dre') || location.pathname.includes('cartoes')) setIsFinancialOpen(true);
    if (location.pathname.includes('servicos')) setIsOSOpen(true);
    if (location.pathname.includes('relatorios')) { setIsVendasOpen(true); setIsReportsMenuOpen(true); }
  }, []);

  useEffect(() => {
    document.title = `${systemConfig.companyName} | Gestão Integrada`;
  }, [systemConfig.companyName]);

  const currentStoreName = useMemo(() => {
    if (!currentUser || !establishments) return '---';
    const store = establishments.find(e => e.id === currentUser.storeId);
    return store ? store.name : currentUser.storeId;
  }, [currentUser, establishments]);

  // Se não estiver logado, não renderiza nada (o roteador redirecionará)
  if (!currentUser) return null;

  // Lógica de fallback para permissões: 
  // Busca do estado rolePermissions e, se falhar, busca das constantes iniciais
  const perms = useMemo(() => {
    return rolePermissions[currentUser.role] || INITIAL_PERMS[currentUser.role] || INITIAL_PERMS[UserRole.VENDOR];
  }, [rolePermissions, currentUser.role]);

  // Modo PDV limpo (sem sidebar)
  if (isPDV) return <div className="h-screen w-full overflow-hidden">{children}</div>;

  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark font-display">
      <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-background-dark flex flex-col justify-between p-4 z-50 overflow-y-auto no-scrollbar">
        <div className="flex flex-col gap-8">
          {/* LOGO AREA */}
          <div className="flex items-center gap-3 px-2">
            {systemConfig.logoUrl ? (
              <img src={systemConfig.logoUrl} className="size-10 rounded-lg object-contain" alt="Logo" />
            ) : (
              <div className="bg-primary rounded-lg size-10 flex items-center justify-center text-white shadow-lg shadow-primary/20">
                <span className="material-symbols-outlined">storefront</span>
              </div>
            )}
            <div className="flex flex-col min-w-0">
              <h1 className="text-slate-900 dark:text-white text-sm font-black leading-tight truncate uppercase">{systemConfig.companyName}</h1>
              <p className="text-slate-500 dark:text-[#9da8b9] text-[10px] font-bold uppercase tracking-widest">Gestão Total</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            {/* DASHBOARD */}
            {perms.dashboard && <SidebarItem to="/" icon="dashboard" label="Dashboard" />}
            
            {/* SERVIÇOS */}
            {perms.serviceOrders && (
              <div className="flex flex-col">
                <button onClick={() => setIsOSOpen(!isOSOpen)} className="flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-slate-600 dark:text-[#9da8b9] hover:bg-slate-100 dark:hover:bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-xl">build</span>
                    <span className="text-xs font-black uppercase tracking-widest">Serviços</span>
                  </div>
                  <span className={`material-symbols-outlined text-sm transition-transform ${isOSOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                {isOSOpen && (
                  <div className="flex flex-col ml-9 mt-1 border-l border-slate-100 dark:border-slate-800 gap-1">
                    <SidebarSubItem to="/servicos?tab=create" label="Criar Serviço" />
                    <SidebarSubItem to="/servicos?tab=list" label="Gerenciar OS" />
                  </div>
                )}
              </div>
            )}

            {/* VENDAS / PDV */}
            {perms.pdv && (
               <div className="flex flex-col">
                <button onClick={() => setIsVendasOpen(!isVendasOpen)} className="flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-slate-600 dark:text-[#9da8b9] hover:bg-slate-100 dark:hover:bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-xl">shopping_cart</span>
                    <span className="text-xs font-black uppercase tracking-widest">Vendas / PDV</span>
                  </div>
                  <span className={`material-symbols-outlined text-sm transition-transform ${isVendasOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                {isVendasOpen && (
                  <div className="flex flex-col ml-9 mt-1 border-l border-slate-100 dark:border-slate-800 gap-1">
                    <SidebarSubItem to="/caixa" label="Controle de Caixa" />
                    <SidebarSubItem to="/pdv" label="Frente de Caixa" />
                    {perms.customers && <SidebarSubItem to="/clientes" label="Clientes" />}
                    
                    {perms.reports && (
                      <div className="flex flex-col">
                        <button onClick={() => setIsReportsMenuOpen(!isReportsMenuOpen)} className="flex items-center justify-between px-4 py-2 text-[10px] font-bold uppercase tracking-widest text-slate-400 hover:text-primary transition-all">
                          <span>Relatórios</span>
                          <span className={`material-symbols-outlined text-xs transition-transform ${isReportsMenuOpen ? 'rotate-180' : ''}`}>expand_more</span>
                        </button>
                        {isReportsMenuOpen && (
                          <div className="flex flex-col ml-4 border-l border-slate-100 dark:border-slate-800 gap-0.5 my-1">
                            <SidebarSubItem to="/relatorios?type=evolucao" label="Evolução de vendas" small />
                            <SidebarSubItem to="/relatorios?type=vendas_unidade" label="Vendas por Unidade" small />
                            <SidebarSubItem to="/relatorios?type=por_vendedor" label="Por vendedor" small />
                            <SidebarSubItem to="/relatorios?type=por_produto" label="Por produto" small />
                            <SidebarSubItem to="/relatorios?type=margem_bruta" label="Margem bruta" small />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* ESTOQUE */}
            {(perms.inventory || perms.balance) && (
              <div className="flex flex-col">
                <button onClick={() => setIsStockOpen(!isStockOpen)} className="flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-slate-600 dark:text-[#9da8b9] hover:bg-slate-100 dark:hover:bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-xl">inventory_2</span>
                    <span className="text-xs font-black uppercase tracking-widest">Estoque</span>
                  </div>
                  <span className={`material-symbols-outlined text-sm transition-transform ${isStockOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                {isStockOpen && (
                  <div className="flex flex-col ml-9 mt-1 border-l border-slate-100 dark:border-slate-800 gap-1">
                    {perms.inventory && <SidebarSubItem to="/estoque" label="Produtos" />}
                    {perms.balance && <SidebarSubItem to="/balanco" label="Balanço" />}
                  </div>
                )}
              </div>
            )}

            {/* FINANCEIRO */}
            {(perms.incomes || perms.expenses || perms.financial) && (
              <div className="flex flex-col">
                <button onClick={() => setIsFinancialOpen(!isFinancialOpen)} className="flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-slate-600 dark:text-[#9da8b9] hover:bg-slate-100 dark:hover:bg-slate-800/50">
                  <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-xl">account_balance</span>
                    <span className="text-xs font-black uppercase tracking-widest">Financeiro</span>
                  </div>
                  <span className={`material-symbols-outlined text-sm transition-transform ${isFinancialOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                {isFinancialOpen && (
                  <div className="flex flex-col ml-9 mt-1 border-l border-slate-100 dark:border-slate-800 gap-1">
                    {perms.incomes && <SidebarSubItem to="/entradas" label="Receitas" />}
                    {perms.expenses && <SidebarSubItem to="/saidas" label="Despesas" />}
                    <SidebarSubItem to="/cartoes" label="Operadoras / Bandeiras" />
                    {perms.financial && <SidebarSubItem to="/dre" label="DRE" />}
                  </div>
                )}
              </div>
            )}

            {/* CONFIGURAÇÕES */}
            {perms.settings && <SidebarItem to="/config" icon="settings" label="Configurações" />}
          </nav>
        </div>

        {/* USER PROFILE & LOGOUT */}
        <div className="pt-4 mt-8 border-t border-slate-100 dark:border-slate-800 space-y-4">
           <div className="flex items-center gap-3 px-2 py-3 bg-slate-50 dark:bg-slate-800/40 rounded-2xl">
              <div className="size-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-black">
                 {currentUser.name.charAt(0)}
              </div>
              <div className="flex flex-col min-w-0 flex-1">
                 <p className="text-[11px] font-black text-slate-900 dark:text-white uppercase truncate">{currentUser.name}</p>
                 <p className="text-[9px] font-bold text-slate-400 uppercase truncate">{currentUser.role}</p>
              </div>
              <button onClick={() => { logout(); navigate('/login'); }} className="size-8 flex items-center justify-center text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all">
                <span className="material-symbols-outlined text-lg">logout</span>
              </button>
           </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 flex-shrink-0 border-b border-slate-200 dark:border-slate-800 bg-white/80 dark:bg-background-dark/80 backdrop-blur-md flex items-center justify-end px-8">
           <div className="flex items-center gap-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidade:</span>
              <span className="text-xs font-black text-primary uppercase">{currentStoreName}</span>
           </div>
        </header>
        <div className="flex-1 overflow-y-auto custom-scrollbar">
          {children}
        </div>
      </main>
    </div>
  );
};

const SidebarItem: React.FC<{ to: string; icon: string; label: string }> = ({ to, icon, label }) => (
  <NavLink 
    to={to} 
    className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive ? 'bg-primary text-white shadow-lg shadow-primary/20 font-black' : 'text-slate-600 dark:text-[#9da8b9] hover:bg-slate-100 dark:hover:bg-slate-800/50'}`}
  >
    <span className="material-symbols-outlined text-xl">{icon}</span>
    <span className="text-xs font-black uppercase tracking-widest">{label}</span>
  </NavLink>
);

const SidebarSubItem: React.FC<{ to: string; label: string; small?: boolean }> = ({ to, label, small }) => (
  <NavLink 
    to={to} 
    className={({ isActive }) => `${small ? 'px-4 py-1 text-[9px]' : 'px-4 py-2 text-[10px]'} font-bold uppercase tracking-widest transition-all ${isActive ? 'text-primary bg-primary/5 rounded-r-lg border-l-2 border-primary font-black' : 'text-slate-400 hover:text-slate-600 dark:hover:text-white'}`}
  >
    {label}
  </NavLink>
);

export default Layout;
