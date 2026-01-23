
import { Product, Transaction, TransactionStatus, User, UserRole, Establishment, Customer } from './types';

export const MOCK_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Smartphone X-Pro 128GB',
    sku: 'SM-2024-XP',
    barcode: '7891020304050',
    category: 'Eletrônicos',
    costPrice: 2450.00,
    salePrice: 4299.00,
    stock: 12,
    image: 'https://picsum.photos/seed/phone/400/400',
    brand: 'Apple Inc.',
    unit: 'UN',
    location: 'Gôndola Eletrônicos A'
  },
  {
    id: '2',
    name: 'Fone Bluetooth Premium',
    sku: 'AU-HD-700',
    barcode: '7895060708090',
    category: 'Eletrônicos',
    costPrice: 115.00,
    salePrice: 589.90,
    stock: 45,
    image: 'https://picsum.photos/seed/headphone/400/400',
    brand: 'AudioTech',
    unit: 'UN',
    location: 'Vitrine 02'
  },
  {
    id: '3',
    name: 'Mouse Gamer RGB 16k DPI',
    sku: 'MS-G-402',
    barcode: '7899010203040',
    category: 'Periféricos',
    costPrice: 89.00,
    salePrice: 245.00,
    stock: 3,
    image: 'https://picsum.photos/seed/mouse/400/400',
    brand: 'Logix Pro',
    unit: 'UN',
    location: 'Gaveta B1'
  }
];

export const MOCK_CUSTOMERS: Customer[] = [
  {
    id: 'c-1',
    name: 'Ana Oliveira',
    email: 'ana@gmail.com',
    phone: '(11) 98877-6655',
    birthDate: '1990-05-20'
  },
  {
    id: 'c-2',
    name: 'Pedro Santos',
    email: 'pedro@bol.com',
    phone: '(11) 97766-5544',
    birthDate: new Date().toISOString().split('T')[0] // Aniversariante hoje para teste
  }
];

export const MOCK_USERS: User[] = [
  {
    id: 'u-1',
    name: 'Carlos Silva',
    email: 'carlos@erp.com',
    role: UserRole.ADMIN,
    storeId: 'est-1',
    active: true,
    avatar: 'https://picsum.photos/seed/carlos/100/100'
  },
  {
    id: 'u-2',
    name: 'Mariana Costa',
    email: 'mariana@erp.com',
    role: UserRole.VENDOR,
    storeId: 'est-1',
    active: true,
    avatar: 'https://picsum.photos/seed/mariana/100/100'
  }
];

export const MOCK_ESTABLISHMENTS: Establishment[] = [
  {
    id: 'est-1',
    name: 'Matriz São Paulo',
    cnpj: '12.345.678/0001-90',
    location: 'São Paulo - SP',
    hasStockAccess: true,
    active: true
  }
];

export const MOCK_TRANSACTIONS: Transaction[] = [
  {
    id: 'TRX-94821',
    date: '2024-05-24',
    dueDate: '2024-05-24',
    description: 'Venda de Balcão',
    store: 'Matriz São Paulo',
    category: 'Venda',
    status: TransactionStatus.PAID,
    value: 1250.50,
    type: 'INCOME',
    method: 'Cartão de Crédito'
  }
];
