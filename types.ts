
export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode?: string;
  category: string;
  costPrice: number;
  salePrice: number;
  stock: number;
  image: string;
  brand?: string;
  unit?: string;
  weight?: string;
  location?: string;
  isService?: boolean;
  minStock?: number;
  otherCostsPercent?: number;
  marginPercent?: number;
  maxDiscountPercent?: number;
  commissionPercent?: number;
  conversionFactor?: number;
}

export interface CartItem extends Product {
  quantity: number;
}

export enum TransactionStatus {
  PAID = 'PAGO',
  PENDING = 'PENDENTE',
  OVERDUE = 'ATRASADO',
  APPROVED = 'ATRASADO',
  CANCELLED = 'CANCELADO'
}

export enum ServiceOrderStatus {
  OPEN = 'ABERTA',
  IN_PROGRESS = 'EM ANDAMENTO',
  FINISHED = 'CONCLUÍDA',
  CANCELLED = 'CANCELADA'
}

export enum CashSessionStatus {
  PENDING = 'ABERTURA PENDENTE',
  OPEN = 'ABERTO',
  CLOSED = 'FECHADO'
}

export interface CardOperator {
  id: string;
  name: string;
  active: boolean;
}

export interface CardBrand {
  id: string;
  name: string;
  operatorId: string;
  active: boolean;
}

export interface CashSession {
  id: string;
  storeId: string;
  storeName: string;
  registerName: string; 
  openingTime?: string;
  openingOperatorId?: string;
  openingOperatorName?: string;
  openingValue?: number;
  closingTime?: string;
  closingOperatorId?: string;
  closingOperatorName?: string;
  closingValue?: number;
  status: CashSessionStatus;
  priceTable: string; 
}

export interface ServiceOrder {
  id: string;
  date: string;
  customerName: string;
  customerId: string;
  description: string;
  status: ServiceOrderStatus;
  items: CartItem[];
  totalValue: number;
  technicianName?: string;
  expectedDate?: string;
  store: string;
}

export interface Transaction {
  id: string;
  date: string;
  dueDate?: string;
  description: string;
  store: string;
  category: string;
  status: TransactionStatus;
  value: number;
  shippingValue?: number;
  type: 'INCOME' | 'EXPENSE';
  method?: string;
  client?: string;
  clientId?: string;
  vendorId?: string;
  items?: CartItem[];
  installments?: number;
  authNumber?: string;
  transactionSku?: string;
  cardOperatorId?: string;
  cardBrandId?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  storeId: string;
  active: boolean;
  avatar?: string;
  password?: string;
  commissionActive?: boolean;
  commissionRate?: number;
}

export enum UserRole {
  ADMIN = 'ADMINISTRADOR',
  MANAGER = 'GERENTE',
  CASHIER = 'CAIXA',
  VENDOR = 'VENDEDOR'
}

export interface RolePermissions {
  dashboard: boolean;
  pdv: boolean;
  cashControl: boolean;
  customers: boolean;
  reports: boolean;
  inventory: boolean;
  balance: boolean;
  incomes: boolean;
  expenses: boolean;
  financial: boolean;
  settings: boolean;
  serviceOrders: boolean;
  cardManagement: boolean;
}

export interface Customer {
  id: string;
  name: string;
  email: string;
  phone: string;
  birthDate: string;
  cpfCnpj?: string;
  zipCode?: string;
  address?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  notes?: string;
}

export interface Establishment {
  id: string;
  name: string;
  cnpj: string;
  location: string;
  hasStockAccess: boolean;
  active: boolean;
  logoUrl?: string;
}

export interface DRERow {
  label: string;
  value: number;
  avPercent: number;
  trend: number;
  isSubtotal?: boolean;
  isNegative?: boolean;
  indent?: boolean;
}
