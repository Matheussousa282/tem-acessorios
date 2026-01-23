
import React from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './AppContext';
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
      <Route path="/pdv" element={<PDV />} />
      <Route path="/caixa" element={<Layout><CashMovement /></Layout>} />
      <Route path="/clientes" element={<Layout><Customers /></Layout>} />
      <Route path="/relatorios" element={<Layout><Reports /></Layout>} />
      <Route path="/estoque" element={<Layout><Inventory /></Layout>} />
      <Route path="/balanco" element={<Layout><Balance /></Layout>} />
      <Route path="/servicos" element={<Layout><ServiceOrders /></Layout>} />
      <Route path="/entradas" element={<Layout><Transactions type="INCOME" /></Layout>} />
      <Route path="/saidas" element={<Layout><Transactions type="EXPENSE" /></Layout>} />
      <Route path="/cartoes" element={<Layout><CardManagement /></Layout>} />
      <Route path="/dre" element={<Layout><DRE /></Layout>} />
      <Route path="/config" element={<Layout><Settings /></Layout>} />
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
