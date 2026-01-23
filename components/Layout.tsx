
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
  const [isReportsOpen, setIsReportsOpen] = useState(false);
  const [isFinancialOpen, setIsFinancialOpen] = useState(false);
  const [isOSOpen, setIsOSOpen] = useState(false);

  const perms = useMemo(() => {
    if (!currentUser) return INITIAL_PERMS[UserRole.VENDOR];
    return rolePermissions[currentUser.role] || INITIAL_PERMS[currentUser.role] || INITIAL_PERMS[UserRole.VENDOR];
  }, [rolePermissions, currentUser?.role]);

  useEffect(() => {
    if (location.pathname.includes('estoque')) setIsStockOpen(true);
    if (location.pathname.includes('pdv') || location.pathname.includes('clientes') || location.pathname.includes('relatorios') || location.pathname.includes('caixa')) {
      setIsVendasOpen(true);
      if (location.pathname.includes('relatorios')) setIsReportsOpen(true);
    }
    if (location.pathname.includes('entradas') || location.pathname.includes('dre') || location.pathname.includes('cartoes')) setIsFinancialOpen(true);
    if (location.pathname.includes('servicos')) setIsOSOpen(true);
  }, [location.pathname]);

  const currentStoreName = useMemo(() => {
    if (!currentUser || !establishments) return '---';
    const store = establishments.find(e => e.id === currentUser.storeId);
    return store ? store.name : currentUser.storeId;
  }, [currentUser, establishments]);

  if (!currentUser) return null;

  if (isPDV) return <div className="h-screen w-full overflow-hidden">{children}</div>;

  const hasVendasAccess = perms.cashControl || perms.pdv || perms.customers || perms.reports;
  const hasEstoqueAccess = perms.inventory || perms.balance;
  const hasFinancialGroupAccess = perms.incomes || perms.expenses || perms.cardManagement || perms.financial;

  return (
    <div className="flex h-screen overflow-hidden bg-background-light dark:bg-background-dark font-display">
      <aside className="w-64 flex-shrink-0 border-r border-slate-200 dark:border-slate-800 bg-white dark:bg-background-dark flex flex-col justify-between p-4 z-50 overflow-y-auto no-scrollbar">
        <div className="flex flex-col gap-8">
          <div className="flex items-center gap-3 px-2">
            {/* LOGOTIPO DINÂMICO */}
            <div className="bg-primary rounded-lg size-10 flex items-center justify-center text-white shadow-lg overflow-hidden">
              {systemConfig.logoUrl ? (
                <img src={systemConfig.logoUrl} className="size-full object-cover" alt="Logo" />
              ) : (
                <span className="material-symbols-outlined">storefront</span>
              )}
            </div>
            <div className="flex flex-col min-w-0">
              <h1 className="text-slate-900 dark:text-white text-sm font-black leading-tight truncate uppercase">{systemConfig.companyName}</h1>
              <p className="text-slate-500 text-[10px] font-bold uppercase tracking-widest">Gestão Total</p>
            </div>
          </div>

          <nav className="flex flex-col gap-1">
            {perms.dashboard && <SidebarItem to="/" icon="dashboard" label="Dashboard" />}
            
            {perms.serviceOrders && (
              <div className="flex flex-col">
                <button onClick={() => setIsOSOpen(!isOSOpen)} className="flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-slate-600 hover:bg-slate-100">
                  <div className="flex items-center gap-3"><span className="material-symbols-outlined text-xl">build</span><span className="text-xs font-black uppercase tracking-widest">Serviços</span></div>
                  <span className={`material-symbols-outlined text-sm transition-transform ${isOSOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                {isOSOpen && <div className="flex flex-col ml-9 mt-1 border-l gap-1"><SidebarSubItem to="/servicos?tab=list" label="Gerenciar OS" /><SidebarSubItem to="/servicos?tab=catalog" label="Catálogo" /></div>}
              </div>
            )}

            {hasVendasAccess && (
               <div className="flex flex-col">
                <button onClick={() => setIsVendasOpen(!isVendasOpen)} className="flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-slate-600 hover:bg-slate-100">
                  <div className="flex items-center gap-3"><span className="material-symbols-outlined text-xl">shopping_cart</span><span className="text-xs font-black uppercase tracking-widest">Vendas / PDV</span></div>
                  <span className={`material-symbols-outlined text-sm transition-transform ${isVendasOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                {isVendasOpen && (
                  <div className="flex flex-col ml-9 mt-1 border-l gap-1">
                    {perms.cashControl && <SidebarSubItem to="/caixa" label="Controle de Caixa" />}
                    {perms.pdv && <SidebarSubItem to="/pdv" label="Frente de Caixa" />}
                    {perms.customers && <SidebarSubItem to="/clientes" label="Clientes" />}
                    
                    {perms.reports && (
                      <div className="flex flex-col mt-1">
                         <button 
                          onClick={() => setIsReportsOpen(!isReportsOpen)}
                          className="flex items-center justify-between px-4 py-2 rounded-lg text-slate-400 hover:text-primary transition-all group"
                         >
                           <span className="text-[10px] font-black uppercase tracking-widest">Relatórios</span>
                           <span className={`material-symbols-outlined text-sm transition-transform ${isReportsOpen ? 'rotate-180' : ''}`}>expand_more</span>
                         </button>
                         
                         {isReportsOpen && (
                           <div className="flex flex-col ml-3 border-l border-slate-100 dark:border-slate-800 mt-1 gap-0.5 animate-in slide-in-from-top-1">
                              <SidebarSubItem to="/relatorios?type=evolucao" label="Evolução de Vendas" small />
                              <SidebarSubItem to="/relatorios?type=por_unidade" label="Vendas por Unidade" small />
                              <SidebarSubItem to="/relatorios?type=entrega_futura" label="Entrega Futura" small />
                              <SidebarSubItem to="/relatorios?type=por_ano" label="Por Ano" small />
                              <SidebarSubItem to="/relatorios?type=por_cliente" label="Por Cliente" small />
                              <SidebarSubItem to="/relatorios?type=por_vendas" label="Por Vendas" small />
                              <SidebarSubItem to="/relatorios?type=por_vendedor" label="Por Vendedor" small />
                              <SidebarSubItem to="/relatorios?type=ticket_vendedor" label="Ticket Médio por Vendedor" small />
                              <SidebarSubItem to="/relatorios?type=ticket_mes_ano" label="Ticket Médio por Mês/Ano" small />
                              <SidebarSubItem to="/relatorios?type=por_produto" label="Por Produto" small />
                              <SidebarSubItem to="/relatorios?type=margem_bruta" label="Por Produto com Margem Bruta" small />
                              <SidebarSubItem to="/relatorios?type=por_servico" label="Por Serviço" small />
                           </div>
                         )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {hasEstoqueAccess && (
              <div className="flex flex-col">
                <button onClick={() => setIsStockOpen(!isStockOpen)} className="flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-slate-600 hover:bg-slate-100">
                  <div className="flex items-center gap-3"><span className="material-symbols-outlined text-xl">inventory_2</span><span className="text-xs font-black uppercase tracking-widest">Estoque</span></div>
                  <span className={`material-symbols-outlined text-sm transition-transform ${isStockOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                {isStockOpen && (
                  <div className="flex flex-col ml-9 mt-1 border-l gap-1">
                    {perms.inventory && <SidebarSubItem to="/estoque" label="Produtos" />}
                    {perms.balance && <SidebarSubItem to="/balanco" label="Balanço" />}
                  </div>
                )}
              </div>
            )}

            {hasFinancialGroupAccess && (
              <div className="flex flex-col">
                <button onClick={() => setIsFinancialOpen(!isFinancialOpen)} className="flex items-center justify-between px-3 py-2.5 rounded-lg transition-all text-slate-600 hover:bg-slate-100">
                  <div className="flex items-center gap-3"><span className="material-symbols-outlined text-xl">account_balance</span><span className="text-xs font-black uppercase tracking-widest">Financeiro</span></div>
                  <span className={`material-symbols-outlined text-sm transition-transform ${isFinancialOpen ? 'rotate-180' : ''}`}>expand_more</span>
                </button>
                {isFinancialOpen && (
                  <div className="flex flex-col ml-9 mt-1 border-l gap-1">
                    {perms.incomes && <SidebarSubItem to="/entradas" label="Receitas" />}
                    {perms.expenses && <SidebarSubItem to="/saidas" label="Despesas" />}
                    {perms.cardManagement && <SidebarSubItem to="/cartoes" label="Cartões" />}
                    {perms.financial && <SidebarSubItem to="/dre" label="DRE" />}
                  </div>
                )}
              </div>
            )}

            {perms.settings && <SidebarItem to="/config" icon="settings" label="Configurações" />}
          </nav>
        </div>

        <div className="pt-4 border-t space-y-4">
           <div className="flex items-center gap-3 px-2 py-3 bg-slate-50 dark:bg-slate-800 rounded-2xl">
              <div className="size-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary font-black">{currentUser.name.charAt(0)}</div>
              <div className="flex-1 min-w-0"><p className="text-[11px] font-black uppercase truncate">{currentUser.name}</p><p className="text-[9px] font-bold text-slate-400 uppercase">{currentUser.role}</p></div>
              <button onClick={() => { logout(); navigate('/login'); }} className="text-rose-500"><span className="material-symbols-outlined text-lg">logout</span></button>
           </div>
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 flex-shrink-0 border-b bg-white/80 dark:bg-background-dark/80 backdrop-blur-md flex items-center justify-end px-8">
           <div className="flex items-center gap-4"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidade:</span><span className="text-xs font-black text-primary uppercase">{currentStoreName}</span></div>
        </header>
        <div className="flex-1 overflow-y-auto no-scrollbar">{children}</div>
      </main>
    </div>
  );
};

const SidebarItem = ({ to, icon, label }: any) => (
  <NavLink to={to} className={({ isActive }) => `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all ${isActive ? 'bg-primary text-white shadow-lg font-black' : 'text-slate-600 hover:bg-slate-100'}`}><span className="material-symbols-outlined text-xl">{icon}</span><span className="text-xs font-black uppercase tracking-widest">{label}</span></NavLink>
);

const SidebarSubItem = ({ to, label, small }: any) => (
  <NavLink to={to} className={({ isActive }) => `${small ? 'px-4 py-1 text-[9px]' : 'px-4 py-2 text-[10px]'} font-bold uppercase transition-all ${isActive ? 'text-primary bg-primary/5 border-l-2 border-primary font-black' : 'text-slate-400 hover:text-slate-600'}`}>{label}</NavLink>
);

export default Layout;
