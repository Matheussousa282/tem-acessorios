
import React, { createContext, useContext, useState, ReactNode, useEffect, useCallback } from 'react';
import { Product, Transaction, TransactionStatus, Customer, User, CartItem, Establishment, UserRole, RolePermissions, ServiceOrder, ServiceOrderStatus, CashSession, CashSessionStatus, CardOperator, CardBrand } from './types';

export interface CashEntry {
  id: string;
  sessionId: string;
  type: 'INCOME' | 'EXPENSE' | 'TRANSFER';
  category: string;
  description: string;
  value: number;
  timestamp: string;
  method?: string;
}

interface SystemConfig {
  companyName: string;
  logoUrl?: string;
  taxRegime: string;
  allowNegativeStock: boolean;
  returnPeriodDays: number;
}

interface AppContextType {
  currentUser: User | null;
  systemConfig: SystemConfig;
  rolePermissions: Record<UserRole, RolePermissions>;
  products: Product[];
  transactions: Transaction[];
  customers: Customer[];
  users: User[];
  serviceOrders: ServiceOrder[];
  establishments: Establishment[];
  cashSessions: CashSession[];
  cashEntries: CashEntry[];
  cardOperators: CardOperator[];
  cardBrands: CardBrand[];
  loading: boolean;
  login: (username: string, pass: string) => Promise<boolean>;
  logout: () => void;
  updateConfig: (config: SystemConfig) => Promise<void>;
  updateRolePermissions: (role: UserRole, perms: RolePermissions) => Promise<void>;
  addProduct: (p: Product) => Promise<void>;
  updateProduct: (p: Product) => Promise<void>;
  deleteProduct: (id: string) => Promise<void>;
  addTransaction: (t: Transaction) => Promise<void>;
  addCustomer: (c: Customer) => Promise<void>;
  addUser: (u: User) => Promise<void>;
  updateSelf: (u: User) => Promise<void>;
  addServiceOrder: (os: ServiceOrder) => Promise<void>;
  updateServiceOrder: (os: ServiceOrder) => Promise<void>;
  deleteUser: (id: string) => Promise<void>;
  addEstablishment: (e: Establishment) => Promise<void>;
  deleteEstablishment: (id: string) => Promise<void>;
  saveCashSession: (s: CashSession) => Promise<void>;
  addCashEntry: (e: CashEntry) => Promise<void>;
  saveCardOperator: (o: CardOperator) => Promise<void>;
  deleteCardOperator: (id: string) => Promise<void>;
  saveCardBrand: (b: CardBrand) => Promise<void>;
  deleteCardBrand: (id: string) => Promise<void>;
  processSale: (items: CartItem[], total: number, method: string, clientId?: string, vendorId?: string, shippingValue?: number, cardDetails?: { installments?: number; authNumber?: string; transactionSku?: string; cardOperatorId?: string; cardBrandId?: string }) => Promise<void>;
  updateStock: (productId: string, quantity: number) => Promise<void>;
  bulkUpdateStock: (adjustments: Record<string, number>) => Promise<void>;
  refreshData: () => Promise<void>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const INITIAL_PERMS: Record<UserRole, RolePermissions> = {
  [UserRole.ADMIN]: { dashboard: true, pdv: true, customers: true, reports: true, inventory: true, balance: true, incomes: true, expenses: true, financial: true, settings: true, serviceOrders: true },
  [UserRole.MANAGER]: { dashboard: true, pdv: true, customers: true, reports: true, inventory: true, balance: true, incomes: true, expenses: true, financial: true, settings: false, serviceOrders: true },
  [UserRole.CASHIER]: { dashboard: true, pdv: true, customers: true, reports: false, inventory: false, balance: false, incomes: true, expenses: false, financial: false, settings: false, serviceOrders: true },
  [UserRole.VENDOR]: { dashboard: true, pdv: true, customers: true, reports: false, inventory: false, balance: false, incomes: false, expenses: false, financial: false, settings: false, serviceOrders: true },
};

const SESSION_KEY = 'tem_acessorios_user_session';
const LAST_ACTIVITY_KEY = 'tem_acessorios_last_activity';
const INACTIVITY_LIMIT = 60 * 60 * 1000;

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [rolePermissions, setRolePermissions] = useState<Record<UserRole, RolePermissions>>(INITIAL_PERMS);
  const [serviceOrders, setServiceOrders] = useState<ServiceOrder[]>([]);
  const [cashSessions, setCashSessions] = useState<CashSession[]>([]);
  const [cashEntries, setCashEntries] = useState<CashEntry[]>([]);
  const [cardOperators, setCardOperators] = useState<CardOperator[]>([]);
  const [cardBrands, setCardBrands] = useState<CardBrand[]>([]);
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    companyName: 'Retail Cloud ERP', logoUrl: '', taxRegime: 'Simples Nacional', allowNegativeStock: false, returnPeriodDays: 30
  });

  const [products, setProducts] = useState<Product[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [establishments, setEstablishments] = useState<Establishment[]>([]);
  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setCurrentUser(null);
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LAST_ACTIVITY_KEY);
  }, []);

  const refreshData = async () => {
    try {
      const responses = await Promise.all([
        fetch('/api/products').then(r => r.json()).catch(() => []),
        fetch('/api/transactions').then(r => r.json()).catch(() => []),
        fetch('/api/customers').then(r => r.json()).catch(() => []),
        fetch('/api/users').then(r => r.json()).catch(() => []),
        fetch('/api/establishments').then(r => r.json()).catch(() => []),
        fetch('/api/service-orders').then(r => r.json()).catch(() => []),
        fetch('/api/cash-sessions').then(r => r.json()).catch(() => []),
        fetch('/api/cash-entries').then(r => r.json()).catch(() => []),
        fetch('/api/card-operators').then(r => r.json()).catch(() => []),
        fetch('/api/card-brands').then(r => r.json()).catch(() => []),
        fetch('/api/config').then(r => r.ok ? r.json() : null).catch(() => null),
        fetch('/api/permissions').then(r => r.ok ? r.json() : null).catch(() => null)
      ]);
      
      setProducts(responses[0]);
      setTransactions(responses[1]);
      setCustomers(responses[2]);
      setUsers(responses[3]);
      setEstablishments(responses[4]);
      setServiceOrders(responses[5]);
      setCashSessions(responses[6]);
      setCashEntries(responses[7]);
      setCardOperators(responses[8]);
      setCardBrands(responses[9]);
      
      if (responses[10]) setSystemConfig(responses[10]);
      if (responses[11] && Array.isArray(responses[11])) {
        const permsMap = { ...INITIAL_PERMS };
        responses[11].forEach((p: any) => { permsMap[p.role as UserRole] = p.permissions; });
        setRolePermissions(permsMap);
      }

      const savedUser = localStorage.getItem(SESSION_KEY);
      if (savedUser) {
        const parsedUser = JSON.parse(savedUser) as User;
        const validUser = (responses[3] as User[]).find(u => u.id === parsedUser.id && u.active);
        if (validUser) setCurrentUser(validUser);
      }
    } catch (error) {
      console.error("Erro na sincronização:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/init-db').finally(() => refreshData());
  }, []);

  const login = async (username: string, pass: string) => {
    const user = users.find(u => u.name.toLowerCase() === username.toLowerCase() && u.password === pass);
    if (user && user.active) {
      setCurrentUser(user);
      localStorage.setItem(SESSION_KEY, JSON.stringify(user));
      return true;
    }
    return false;
  };

  const addProduct = async (p: Product) => { await fetch('/api/products', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(p)}); await refreshData(); };
  const addTransaction = async (t: Transaction) => { await fetch('/api/transactions', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(t)}); await refreshData(); };
  const addCustomer = async (c: Customer) => { await fetch('/api/customers', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(c)}); await refreshData(); };
  const addUser = async (u: User) => { await fetch('/api/users', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(u)}); await refreshData(); };
  const addEstablishment = async (e: Establishment) => { await fetch('/api/establishments', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(e)}); await refreshData(); };
  const addServiceOrder = async (os: ServiceOrder) => { await fetch('/api/service-orders', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(os)}); await refreshData(); };
  const updateServiceOrder = async (os: ServiceOrder) => { await addServiceOrder(os); };
  
  const saveCashSession = async (s: CashSession) => { await fetch('/api/cash-sessions', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(s)}); await refreshData(); };
  const addCashEntry = async (e: CashEntry) => { await fetch('/api/cash-entries', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(e)}); await refreshData(); };

  const saveCardOperator = async (o: CardOperator) => { await fetch('/api/card-operators', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(o)}); await refreshData(); };
  const deleteCardOperator = async (id: string) => { await fetch(`/api/card-operators?id=${id}`, { method: 'DELETE' }); await refreshData(); };
  const saveCardBrand = async (b: CardBrand) => { await fetch('/api/card-brands', { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(b)}); await refreshData(); };
  const deleteCardBrand = async (id: string) => { await fetch(`/api/card-brands?id=${id}`, { method: 'DELETE' }); await refreshData(); };

  const processSale = async (items: CartItem[], total: number, method: string, clientId?: string, vendorId?: string, shippingValue: number = 0, cardDetails?: any) => {
    const stockUpdates = items
      .filter(item => {
        const p = products.find(x => x.id === item.id);
        return p && !p.isService;
      })
      .map(item => {
        const p = products.find(x => x.id === item.id)!;
        return fetch('/api/products', {
          method: 'POST', 
          headers: {'Content-Type':'application/json'}, 
          body: JSON.stringify({...p, stock: p.stock - item.quantity})
        });
      });

    const client = customers.find(c => c.id === clientId);
    const storeObj = establishments.find(e => e.id === currentUser?.storeId);

    const transactionData = {
      id: `SALE-${Date.now()}`,
      date: new Date().toISOString().split('T')[0],
      description: `Venda PDV`,
      store: storeObj?.name || 'Unidade Local',
      category: 'Venda',
      status: TransactionStatus.PAID,
      value: total,
      shippingValue: shippingValue,
      type: 'INCOME' as const,
      method,
      clientId,
      client: client?.name || 'Consumidor Final',
      vendorId,
      items,
      ...cardDetails
    };

    await Promise.all([
      ...stockUpdates,
      fetch('/api/transactions', { 
        method: 'POST', 
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify(transactionData)
      })
    ]);
    
    await refreshData();
  };

  const bulkUpdateStock = async (adjustments: Record<string, number>) => {
    const updates = Object.entries(adjustments).map(([id, newStock]) => {
      const p = products.find(x => x.id === id);
      if (p) {
        return fetch('/api/products', { 
          method: 'POST', 
          headers: {'Content-Type': 'application/json'}, 
          body: JSON.stringify({ ...p, stock: newStock })
        });
      }
      return Promise.resolve();
    });
    await Promise.all(updates);
    await refreshData();
  };

  return (
    <AppContext.Provider value={{ 
      currentUser, systemConfig, rolePermissions, products, transactions, customers, users, serviceOrders, establishments, cashSessions, cashEntries, cardOperators, cardBrands, loading, login, logout, 
      addProduct, updateProduct: addProduct, deleteProduct: async (id) => {}, addTransaction, addCustomer, addUser, updateSelf: addUser, addServiceOrder, updateServiceOrder,
      deleteUser: async (id) => {}, addEstablishment, deleteEstablishment: async (id) => {}, processSale, updateStock: async (id, q) => {}, bulkUpdateStock, refreshData, saveCashSession, addCashEntry,
      saveCardOperator, deleteCardOperator, saveCardBrand, deleteCardBrand,
      updateConfig: async (conf) => { await fetch('/api/config', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(conf)}); refreshData(); }, 
      updateRolePermissions: async (role, perms) => { await fetch('/api/permissions', {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({role, permissions: perms})}); refreshData(); }
    }}>
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within an AppProvider');
  return context;
};
