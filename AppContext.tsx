
// Implementação completa do AppContext para gerenciamento de estado e sincronização com o banco de dados Neon.
import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product, Customer, User, Establishment, Transaction, CashSession, CashSessionStatus, ServiceOrder, RolePermissions, TransactionStatus, UserRole, CardOperator, CardBrand } from './types';

interface AppContextType {
  products: Product[];
  customers: Customer[];
  users: User[];
  establishments: Establishment[];
  transactions: Transaction[];
  cashSessions: CashSession[];
  cashEntries: any[];
  cardOperators: CardOperator[];
  cardBrands: CardBrand[];
  serviceOrders: ServiceOrder[];
  systemConfig: any;
  currentUser: User | null;
  rolePermissions: Record<string, RolePermissions>;
  loading: boolean;
  dbConnected: boolean;
  refreshData: () => Promise<void>;
  login: (email: string, pass: string) => Promise<boolean>;
  logout: () => void;
  addProduct: (p: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addCustomer: (c: Customer) => Promise<void>;
  addUser: (u: User) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  addEstablishment: (e: Establishment) => Promise<void>;
  deleteEstablishment: (id: string) => Promise<void>;
  addTransaction: (t: Transaction) => Promise<void>;
  saveCashSession: (s: CashSession) => Promise<void>;
  addCashEntry: (e: any) => Promise<void>;
  saveCardOperator: (o: CardOperator) => Promise<void>;
  deleteCardOperator: (id: string) => Promise<void>;
  saveCardBrand: (b: CardBrand) => Promise<void>;
  deleteCardBrand: (id: string) => Promise<void>;
  updateServiceOrder: (os: ServiceOrder) => Promise<void>;
  addServiceOrder: (os: ServiceOrder) => Promise<void>;
  updateConfig: (config: any) => Promise<void>;
  processSale: (cart: any[], total: number, method: string, customerId: string, vendorId: string, shipping: number, cardDetails: any) => Promise<void>;
  bulkUpdateStock: (adjustments: Record<string, number>) => Promise<void>;
  updateRolePermissions: (role: string, perms: RolePermissions) => Promise<void>;
}

export const INITIAL_PERMS: Record<string, RolePermissions> = {
  [UserRole.ADMIN]: { dashboard: true, pdv: true, cashControl: true, customers: true, reports: true, inventory: true, balance: true, incomes: true, expenses: true, financial: true, settings: true, serviceOrders: true, cardManagement: true, editProducts: true },
  [UserRole.MANAGER]: { dashboard: true, pdv: true, cashControl: true, customers: true, reports: true, inventory: true, balance: true, incomes: true, expenses: true, financial: true, settings: true, serviceOrders: true, cardManagement: true, editProducts: true },
  [UserRole.CASHIER]: { dashboard: true, pdv: true, cashControl: true, customers: true, reports: false, inventory: true, balance: false, incomes: false, expenses: false, financial: false, settings: false, serviceOrders: true, cardManagement: false, editProducts: false },
  [UserRole.VENDOR]: { dashboard: true, pdv: true, cashControl: false, customers: true, reports: false, inventory: false, balance: false, incomes: false, expenses: false, financial: false, settings: false, serviceOrders: true, cardManagement: false, editProducts: false },
};

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [cashSessions, setCashSessions] = useState<CashSession[]>([]);
  const [cashEntries, setCashEntries] = useState<any[]>([]);
  const [cardOperators, setCardOperators] = useState<CardOperator[]>([]);
  const [cardBrands, setCardBrands] = useState<CardBrand[]>([]);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [systemConfig, setSystemConfig] = useState<any>({ companyName: 'ERP Retail', returnPeriodDays: 30 });
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [rolePermissions, setRolePermissions] = useState<Record<string, RolePermissions>>(INITIAL_PERMS);
  const [loading, setLoading] = useState(true);
  const [dbConnected, setDbConnected] = useState(true);

  const refreshData = async () => {
    try {
      // Tenta carregar usuários primeiro para verificar se o banco está inicializado
      let uData;
      try {
        const res = await fetch('/api/users');
        uData = await res.json();
        
        if (uData.error === 'DB URL missing' || uData.error === 'DATABASE_URL não configurada') {
          setDbConnected(false);
          setLoading(false);
          return;
        }

        if (uData.error || (Array.isArray(uData) && uData.length === 0)) {
          const initRes = await fetch('/api/init-db');
          const initData = await initRes.json();
          if (initData.error) {
            setDbConnected(false);
          } else {
            const retryRes = await fetch('/api/users');
            uData = await retryRes.json();
            setDbConnected(true);
          }
        } else {
          setDbConnected(true);
        }
      } catch (err) {
        setDbConnected(false);
      }

      if (!uData || uData.error) {
        setUsers([]);
      } else {
        setUsers(Array.isArray(uData) ? uData : []);
      }

      const [p, c, e, t, cs, ce, co, cb, so, conf, perms] = await Promise.all([
        fetch('/api/products').then(r => r.json()),
        fetch('/api/customers').then(r => r.json()),
        fetch('/api/establishments').then(r => r.json()),
        fetch('/api/transactions').then(r => r.json()),
        fetch('/api/cash-sessions').then(r => r.json()),
        fetch('/api/cash-entries').then(r => r.json()),
        fetch('/api/card-operators').then(r => r.json()),
        fetch('/api/card-brands').then(r => r.json()),
        fetch('/api/service-orders').then(r => r.json()),
        fetch('/api/config').then(r => r.json()),
        fetch('/api/permissions').then(r => r.json()),
      ]);

      setUsers(Array.isArray(uData) ? uData : []);
      setProducts(Array.isArray(p) ? p : []);
      setCustomers(Array.isArray(c) ? c : []);
      setEstablishments(Array.isArray(e) ? e : []);
      setTransactions(Array.isArray(t) ? t : []);
      setCashSessions(Array.isArray(cs) ? cs : []);
      setCashEntries(Array.isArray(ce) ? ce : []);
      setCardOperators(Array.isArray(co) ? co : []);
      setCardBrands(Array.isArray(cb) ? cb : []);
      setServiceOrders(Array.isArray(so) ? so : []);
      setSystemConfig(conf && !conf.error ? conf : { companyName: 'ERP Retail', returnPeriodDays: 30 });
      
      if (perms && Array.isArray(perms) && perms.length > 0) {
        const pMap: any = { ...INITIAL_PERMS };
        perms.forEach((item: any) => { if(item.role) pMap[item.role] = item.permissions; });
        setRolePermissions(pMap);
      }
    } catch (err) {
      console.error('Erro ao sincronizar dados:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const savedUser = localStorage.getItem('erp_user');
    if (savedUser) {
      setCurrentUser(JSON.parse(savedUser));
    }
    refreshData();
  }, []);

  const login = async (email: string, pass: string) => {
    const user = users.find(u => (u.email === email || u.name === email) && u.password === pass);
    if (user) {
      setCurrentUser(user);
      localStorage.setItem('erp_user', JSON.stringify(user));
      return true;
    }
    return false;
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('erp_user');
  };

  const addProduct = async (p: Product) => {
    await fetch('/api/products', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(p) });
    await refreshData();
  };

  const deleteProduct = async (id: string) => {
    await fetch(`/api/products?id=${id}`, { method: 'DELETE' });
    await refreshData();
  };

  const addCustomer = async (c: Customer) => {
    await fetch('/api/customers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(c) });
    await refreshData();
  };

  const addUser = async (u: User) => {
    await fetch('/api/users', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(u) });
    await refreshData();
  };

  const deleteUser = async (id: string) => {
    await fetch(`/api/users?id=${id}`, { method: 'DELETE' });
    await refreshData();
  };

  const addEstablishment = async (e: Establishment) => {
    await fetch('/api/establishments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(e) });
    await refreshData();
  };

  const deleteEstablishment = async (id: string) => {
    await fetch(`/api/establishments?id=${id}`, { method: 'DELETE' });
    await refreshData();
  };

  const addTransaction = async (t: Transaction) => {
    await fetch('/api/transactions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(t) });
    await refreshData();
  };

  const saveCashSession = async (s: CashSession) => {
    await fetch('/api/cash-sessions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(s) });
    await refreshData();
  };

  const addCashEntry = async (e: any) => {
    await fetch('/api/cash-entries', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(e) });
    await refreshData();
  };

  const saveCardOperator = async (o: CardOperator) => {
    await fetch('/api/card-operators', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(o) });
    await refreshData();
  };

  const deleteCardOperator = async (id: string) => {
    await fetch(`/api/card-operators?id=${id}`, { method: 'DELETE' });
    await refreshData();
  };

  const saveCardBrand = async (b: CardBrand) => {
    await fetch('/api/card-brands', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(b) });
    await refreshData();
  };

  const deleteCardBrand = async (id: string) => {
    await fetch(`/api/card-brands?id=${id}`, { method: 'DELETE' });
    await refreshData();
  };

  const updateServiceOrder = async (os: ServiceOrder) => {
    await fetch('/api/service-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(os) });
    await refreshData();
  };

  const addServiceOrder = async (os: ServiceOrder) => {
    await fetch('/api/service-orders', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(os) });
    await refreshData();
  };

  const updateConfig = async (config: any) => {
    await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(config) });
    await refreshData();
  };

  const bulkUpdateStock = async (adjustments: Record<string, number>) => {
    for (const [id, stock] of Object.entries(adjustments)) {
      const p = products.find(prod => prod.id === id);
      if (p) await addProduct({ ...p, stock });
    }
  };

  const updateRolePermissions = async (role: string, perms: RolePermissions) => {
    await fetch('/api/permissions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role, permissions: perms }) });
    await refreshData();
  };

  const processSale = async (cart: any[], total: number, method: string, customerId: string, vendorId: string, shipping: number, cardDetails: any) => {
    const saleId = `SALE-${Date.now()}`;
    const store = establishments.find(e => e.id === currentUser?.storeId);
    const customer = customers.find(c => c.id === customerId);

    const transaction: Transaction = {
      id: saleId,
      date: new Date().toISOString().split('T')[0],
      description: 'Venda PDV',
      store: store?.name || 'Matriz',
      category: 'Venda',
      status: TransactionStatus.PAID,
      value: total,
      shippingValue: shipping,
      type: 'INCOME',
      method,
      client: customer?.name || 'Consumidor Final',
      clientId: customerId,
      vendorId,
      items: cart,
      ...cardDetails
    };

    const stockUpdates = cart.map(item => {
      const p = products.find(x => x.id === item.id);
      if (p && !p.isService) return addProduct({ ...p, stock: p.stock - item.quantity });
      return Promise.resolve();
    });

    await Promise.all([...stockUpdates, addTransaction(transaction)]);
  };

  return (
    <AppContext.Provider value={{
      products, customers, users, establishments, transactions, cashSessions, cashEntries, cardOperators, cardBrands, serviceOrders, systemConfig, currentUser, rolePermissions, loading, dbConnected,
      refreshData, login, logout, addProduct, deleteProduct, addCustomer, addUser, deleteUser, addEstablishment, deleteEstablishment, addTransaction, saveCashSession, addCashEntry,
      saveCardOperator, deleteCardOperator, saveCardBrand, deleteCardBrand, updateServiceOrder, addServiceOrder, updateConfig, processSale, bulkUpdateStock, updateRolePermissions
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
};
