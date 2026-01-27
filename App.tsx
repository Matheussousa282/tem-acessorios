
import React, { useMemo } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp, INITIAL_PERMS } from './AppContext';
import Layout from './components/Layout';
import Dashboard from './views/Dashboard';
import PDV from './views/PDV';
import Inventory from './views/Inventory';
import Transactions from './views/Transactions';
import DRE from './views/DRE';
import Settings from './views/Settings';
import Reports from './views/Reports';
import Balance from './views/Balance';
import Customers from './views/Customers';
import ServiceOrders from './views/ServiceOrders';
import Login from './views/Login';
import CashMovement from './views/CashMovement';
import CardManagement from './views/CardManagement';
import SalesInquiry from './views/SalesInquiry';
import { UserRole } from './types';

const ProtectedRoute = ({ children, perm }: { children?: React.ReactNode, perm?: string }) => {
  const { currentUser, rolePermissions } = useApp();
  
  const perms = useMemo(() => {
    if (!currentUser) return INITIAL_PERMS[UserRole.VENDOR];
    return rolePermissions[currentUser.role] || INITIAL_PERMS[currentUser.role];
  }, [rolePermissions, currentUser?.role]);

  if (!currentUser) return <Navigate to="/login" />;
  if (perm && !(perms as any)[perm]) return <Navigate to="/" />;

  return <>{children}</>;
};

const AppRoutes: React.FC = () => {
  const { currentUser, loading } = useApp();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background-light dark:bg-background-dark">
        <div className="flex flex-col items-center gap-4">
           <div className="size-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
           <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Sincronizando Sistema...</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  return (
    <Routes>
      <Route path="/" element={<Layout><Dashboard /></Layout>} />
      <Route path="/pdv" element={<ProtectedRoute perm="pdv"><PDV /></ProtectedRoute>} />
      <Route path="/documentos" element={<Layout><SalesInquiry /></Layout>} />
      <Route path="/caixa" element={<Layout><ProtectedRoute perm="cashControl"><CashMovement /></ProtectedRoute></Layout>} />
      <Route path="/clientes" element={<Layout><ProtectedRoute perm="customers"><Customers /></ProtectedRoute></Layout>} />
      <Route path="/relatorios" element={<Layout><ProtectedRoute perm="reports"><Reports /></ProtectedRoute></Layout>} />
      <Route path="/estoque" element={<Layout><ProtectedRoute perm="inventory"><Inventory /></ProtectedRoute></Layout>} />
      <Route path="/balanco" element={<Layout><ProtectedRoute perm="balance"><Balance /></ProtectedRoute></Layout>} />
      <Route path="/servicos" element={<Layout><ProtectedRoute perm="serviceOrders"><ServiceOrders /></ProtectedRoute></Layout>} />
      <Route path="/entradas" element={<Layout><ProtectedRoute perm="incomes"><Transactions type="INCOME" /></ProtectedRoute></Layout>} />
      <Route path="/saidas" element={<Layout><ProtectedRoute perm="expenses"><Transactions type="EXPENSE" /></ProtectedRoute></Layout>} />
      <Route path="/cartoes" element={<Layout><ProtectedRoute perm="cardManagement"><CardManagement /></ProtectedRoute></Layout>} />
      <Route path="/dre" element={<Layout><ProtectedRoute perm="financial"><DRE /></ProtectedRoute></Layout>} />
      <Route path="/config" element={<Layout><ProtectedRoute perm="settings"><Settings /></ProtectedRoute></Layout>} />
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => (
  <AppProvider>
    <HashRouter>
      <AppRoutes />
    </HashRouter>
  </AppProvider>
);

export default App;
