
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../AppContext';
import { useNavigate } from 'react-router-dom';
import { CartItem, Product, Customer, UserRole, User, ServiceOrder, ServiceOrderStatus, Establishment, TransactionStatus, Transaction, CashSessionStatus } from '../types';

interface MultiPayment {
  method: string;
  value: number;
  details?: {
    installments?: number;
    authNumber?: string;
    transactionSku?: string;
    cardOperatorId?: string;
    cardBrandId?: string;
    operatorName?: string;
    brandName?: string;
  };
}

const PDV: React.FC = () => {
  const { 
    products, customers, users, currentUser, processSale, 
    establishments, addServiceOrder, addCustomer, addEstablishment, 
    addUser, transactions, addTransaction, systemConfig, 
    addProduct, cashSessions, cardOperators, cardBrands, refreshData
  } = useApp();
  
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');

  const isAdmin = currentUser?.role === UserRole.ADMIN || currentUser?.role === UserRole.MANAGER;
  const currentStore = useMemo(() => establishments.find(e => e.id === currentUser?.storeId) || { id: 'default', name: 'Terminal Local' } as Establishment, [establishments, currentUser]);
  
  useEffect(() => {
    refreshData();
  }, []);

  const todayStr = useMemo(() => new Date().toLocaleDateString('pt-BR'), []);

  const staleSession = useMemo(() => {
    return cashSessions.find(s => {
      const isThisStore = s.storeId === currentUser?.storeId || s.storeName === currentStore.name;
      const isOpen = s.status === CashSessionStatus.OPEN;
      if (!isThisStore || !isOpen) return false;
      const sessionDate = s.openingTime?.split(',')[0].split(' ')[0].trim();
      return sessionDate !== todayStr;
    });
  }, [cashSessions, currentUser, currentStore, todayStr]);

  const isCashOpenToday = useMemo(() => {
    if (isAdmin) return true;
    return cashSessions.some(s => {
      const isThisStore = s.storeId === currentUser?.storeId || s.storeName === currentStore.name;
      const isOpen = s.status === CashSessionStatus.OPEN;
      const sessionDate = s.openingTime?.split(',')[0].split(' ')[0].trim();
      return isThisStore && isOpen && sessionDate === todayStr;
    });
  }, [cashSessions, currentUser, isAdmin, currentStore, todayStr]);

  // Estados de Controle de Modais
  const [showCheckout, setShowCheckout] = useState(false);
  const [showOSModal, setShowOSModal] = useState(false);
  const [showPriceInquiry, setShowPriceInquiry] = useState(false);
  const [showReturnsModal, setShowReturnsModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showTerminalMenu, setShowTerminalMenu] = useState(false);
  const [showGlobalDiscountModal, setShowGlobalDiscountModal] = useState(false);
  
  const [editingItem, setEditingItem] = useState<{ index: number, item: CartItem } | null>(null);
  
  // Estados de Negócio
  const [successType, setSuccessType] = useState<'SALE' | 'OS' | 'RETURN' | 'CANCEL'>('SALE');
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [lastSaleData, setLastSaleData] = useState<any>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  
  // Controle de Desconto e Frete
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'VALUE' | 'PERCENT'>('VALUE');
  const [shippingValue, setShippingValue] = useState(0);

  // Estados Temporários do Modal de Desconto (Garante que o botão APLICAR seja necessário)
  const [tempDiscount, setTempDiscount] = useState(0);
  const [tempDiscountType, setTempDiscountType] = useState<'VALUE' | 'PERCENT'>('VALUE');

  // Estados de Pagamento Múltiplo
  const [payments, setPayments] = useState<MultiPayment[]>([]);
  const [currentPaymentValue, setCurrentPaymentValue] = useState<number>(0);

  // Estados de Cartão
  const [cardInstallments, setCardInstallments] = useState(1);
  const [cardAuthNumber, setCardAuthNumber] = useState('');
  const [cardNsu, setCardNsu] = useState('');
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState('');

  // Estados de Formulário
  const [osDescription, setOsDescription] = useState('');
  const [priceInquirySearch, setPriceInquirySearch] = useState('');
  const [cancelSearchId, setCancelSearchId] = useState('');
  const [tempItemPrice, setTempItemPrice] = useState(0);
  const [returnSearchTerm, setReturnSearchTerm] = useState('');

  // Cadastro de Cliente Rápido (Completo conforme solicitado)
  const initialCustomerForm: Omit<Customer, 'id'> = { 
    name: '', phone: '', email: '', birthDate: new Date().toISOString().split('T')[0],
    cpfCnpj: '', zipCode: '', address: '', number: '', neighborhood: '', city: '', state: '', complement: '', notes: ''
  };
  const [customerForm, setCustomerForm] = useState(initialCustomerForm);

  const searchInputRef = useRef<HTMLInputElement>(null);

  // Cálculos de Totais
  const subtotal = useMemo(() => cart.reduce((acc, item) => acc + (item.salePrice * item.quantity), 0), [cart]);
  
  const discountValueCalculated = useMemo(() => {
    if (discountType === 'PERCENT') {
      return (subtotal * (globalDiscount / 100));
    }
    return globalDiscount;
  }, [subtotal, globalDiscount, discountType]);

  const totalGeral = useMemo(() => {
    const val = subtotal + (Number(shippingValue) || 0) - (Number(discountValueCalculated) || 0);
    return Math.max(0, val);
  }, [subtotal, shippingValue, discountValueCalculated]);
  
  const totalPaid = useMemo(() => payments.reduce((acc, p) => acc + p.value, 0), [payments]);
  const remainingValue = useMemo(() => Math.max(0, totalGeral - totalPaid), [totalGeral, totalPaid]);
  const changeValue = useMemo(() => Math.max(0, totalPaid - totalGeral), [totalGeral, totalPaid]);

  useEffect(() => {
    if (showCheckout) {
      setCurrentPaymentValue(remainingValue);
    }
  }, [showCheckout, remainingValue]);

  const vendors = useMemo(() => {
    return users.filter(u => (u.role === UserRole.VENDOR || u.role === UserRole.ADMIN || u.role === UserRole.MANAGER) && (isAdmin || u.storeId === currentUser?.storeId));
  }, [users, currentUser, isAdmin]);

  const categories = useMemo(() => {
    const cats = ['Todos', 'Serviços'];
    const productCats = Array.from(new Set(products.filter(p => !p.isService).map(p => p.category)));
    return [...cats, ...productCats];
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const searchLower = search.toLowerCase();
      const matchesSearch = (p.name.toLowerCase().includes(searchLower) || p.sku.toLowerCase().includes(searchLower) || p.barcode?.includes(search));
      let matchesCategory = true;
      if (category === 'Serviços') matchesCategory = !!p.isService;
      else if (category !== 'Todos') matchesCategory = p.category === category && !p.isService;
      return matchesSearch && matchesCategory;
    });
  }, [search, category, products]);

  const addToCart = (product: Product) => {
    if (!product.isService && product.stock <= 0) { alert('Produto sem estoque!'); return; }
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...prev, { ...product, quantity: 1 }];
    });
    setSearch('');
    searchInputRef.current?.focus();
  };

  // Lógica de Desconto
  const handleOpenDiscountModal = () => {
    setTempDiscount(globalDiscount);
    setTempDiscountType(discountType);
    setShowGlobalDiscountModal(true);
  };

  const handleApplyDiscount = () => {
    setGlobalDiscount(tempDiscount);
    setDiscountType(tempDiscountType);
    setShowGlobalDiscountModal(false);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!customerForm.name || !customerForm.phone) { alert("Preencha ao menos nome e telefone!"); return; }
    const newId = `CUST-${Date.now()}`;
    const newCustomer: Customer = { ...customerForm, id: newId };
    await addCustomer(newCustomer);
    setSelectedCustomerId(newId);
    setCustomerForm(initialCustomerForm);
    setShowCustomerModal(false);
  };

  const handleFinalizeSale = async () => {
    if (cart.length === 0 || isFinalizing) return;
    if (totalPaid < totalGeral) { alert("O valor total pago é inferior ao total da venda!"); return; }
    if (!selectedVendorId) { alert("Selecione um VENDEDOR para finalizar a venda!"); return; }

    setIsFinalizing(true);
    try {
      const saleId = `SALE-${Date.now()}`;
      const vendor = vendors.find(v => v.id === selectedVendorId);
      const customer = customers.find(c => c.id === selectedCustomerId);
      const methodsList = Array.from(new Set(payments.map(p => p.method)));
      const methodStr = methodsList.length > 1 ? `Múltiplo (${methodsList.join(', ')})` : methodsList[0];

      const currentSaleData = {
        id: saleId, items: [...cart], subtotal, discount: discountValueCalculated,
        shipping: shippingValue, total: totalGeral, totalPaid, change: changeValue,
        payment: methodStr, payments: payments, date: new Date().toLocaleString('pt-BR'),
        vendor: vendor?.name || 'Vendedor Não Informado', customer: customer?.name || 'Consumidor Final',
        store: currentStore
      };
      
      setLastSaleData(currentSaleData);
      await processSale(cart, totalGeral, methodStr, selectedCustomerId, selectedVendorId, shippingValue);
      
      setCart([]);
      setShippingValue(0);
      setGlobalDiscount(0);
      setPayments([]);
      setSuccessType('SALE');
      setShowCheckout(false);
      setShowSuccessModal(true);
    } catch (e) {
      alert("Erro ao processar venda.");
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleUpdateItemPrice = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    const newCart = [...cart];
    newCart[editingItem.index] = { ...newCart[editingItem.index], salePrice: tempItemPrice };
    setCart(newCart);
    setEditingItem(null);
  };

  const openItemEdit = (item: CartItem, index: number) => {
    setEditingItem({ index, item });
    setTempItemPrice(item.salePrice);
  };

  if (staleSession && !isAdmin) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-100 dark:bg-background-dark p-6">
        <div className="bg-white dark:bg-slate-900 p-12 rounded-[3.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 text-center max-w-lg space-y-8 animate-in zoom-in-95 duration-500">
           <div className="size-24 bg-amber-500/10 text-amber-500 rounded-[2rem] flex items-center justify-center mx-auto animate-bounce"><span className="material-symbols-outlined text-5xl">warning</span></div>
           <h2 className="text-3xl font-black uppercase tracking-tighter">Caixa Antigo Pendente</h2>
           <p className="text-slate-500 font-bold text-sm uppercase leading-relaxed">Existe um movimento de caixa aberto em uma data anterior ({staleSession.openingTime?.split(',')[0].split(' ')[0]}). É obrigatório realizar o fechamento deste movimento antes de iniciar as vendas de hoje.</p>
           <button onClick={() => navigate('/caixa')} className="w-full py-5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all">Ir para Fechamento de Caixa</button>
        </div>
      </div>
    );
  }

  if (!isCashOpenToday && !isAdmin) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-100 dark:bg-background-dark p-6">
        <div className="bg-white dark:bg-slate-900 p-12 rounded-[3.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 text-center max-w-lg space-y-8 animate-in zoom-in-95 duration-500">
           <div className="size-24 bg-rose-500/10 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto animate-pulse"><span className="material-symbols-outlined text-5xl">lock</span></div>
           <h2 className="text-3xl font-black uppercase tracking-tighter">Caixa Fechado</h2>
           <p className="text-slate-500 font-bold text-sm uppercase leading-relaxed">Para iniciar as operações de venda hoje ({todayStr}), é necessário realizar a abertura do movimento diário.</p>
           <div className="flex flex-col gap-3">
              <button onClick={() => navigate('/caixa')} className="w-full py-5 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all">Ir para Abertura de Caixa</button>
              <button onClick={() => navigate('/')} className="w-full py-5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-xs uppercase tracking-widest transition-all">Voltar ao Início</button>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-background-dark overflow-hidden font-display relative">
      
      {/* RECIBO TÉRMICO OCULTO PARA IMPRESSÃO */}
      <div id="receipt-print-area" className="hidden print:block bg-white text-black font-mono text-[11px] leading-tight p-4">
        <div className="text-center space-y-1 mb-3 border-b-2 border-dashed border-black pb-2">
           {lastSaleData?.store?.logoUrl && <img src={lastSaleData.store.logoUrl} className="h-14 mx-auto mb-1 grayscale" alt="Logo" />}
           <h2 className="text-[14px] font-black uppercase">{lastSaleData?.store?.name || 'TEM ACESSÓRIOS'}</h2>
           <div className="font-black text-[12px] pt-1">*** CUPOM NÃO FISCAL ***</div>
        </div>
        <div className="space-y-1 mb-3 text-[10px]">
           {lastSaleData?.items?.map((item: any, idx: number) => (
             <div key={idx} className="flex justify-between items-start uppercase"><span className="w-8">{item.quantity.toFixed(0)}</span><span className="flex-1 px-2">{item.name}</span><span className="w-16 text-right">{(item.quantity * item.salePrice).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
           ))}
        </div>
        <div className="space-y-1 border-t border-black pt-2 mb-3 text-[11px]">
           <div className="flex justify-between font-black text-[13px]"><span>TOTAL GERAL:</span><span>R$ {lastSaleData?.total?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
        </div>
      </div>

      <header className="flex items-center justify-between px-8 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-30 shadow-sm shrink-0 print:hidden">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 relative">
             <div onClick={() => setShowTerminalMenu(!showTerminalMenu)} className="size-12 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg overflow-hidden cursor-pointer hover:scale-105 transition-all">
                {currentStore.logoUrl ? <img src={currentStore.logoUrl} className="size-full object-cover" alt="Terminal Logo" /> : <span className="material-symbols-outlined">point_of_sale</span>}
             </div>
             <div><h1 className="text-lg font-black uppercase text-slate-900 dark:text-white leading-none">{currentStore.name}</h1><p className="text-[10px] font-black text-slate-400 uppercase mt-1">Terminal Ativo</p></div>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:border-slate-800 mx-2"></div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar max-w-[450px]">
             {categories.map(cat => (
               <button key={cat} onClick={() => setCategory(cat)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${category === cat ? 'bg-primary text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}>{cat}</button>
             ))}
          </div>
        </div>
        <div className="flex gap-3">
           <button onClick={() => setShowPriceInquiry(true)} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-black text-[10px] hover:bg-primary hover:text-white transition-all uppercase flex items-center gap-2"><span className="material-symbols-outlined text-lg">sell</span> Consulta Preço</button>
           <button onClick={() => navigate('/servicos?tab=list')} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[10px] hover:bg-primary transition-all uppercase flex items-center gap-2"><span className="material-symbols-outlined text-lg">build</span> Serviços / OS</button>
           <button onClick={() => window.history.back()} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black text-[10px] hover:bg-rose-500 hover:text-white transition-all uppercase tracking-widest">Sair</button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden print:hidden">
        <section className="flex-1 flex flex-col">
          <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
            <div className="relative">
               <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 text-2xl">search</span>
               <input ref={searchInputRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar produto ou bipar código..." className="w-full h-16 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl pl-16 pr-6 text-xl font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all" />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4 content-start custom-scrollbar">
            {filteredProducts.map(p => (
              <div key={p.id} onClick={() => addToCart(p)} className="bg-white dark:bg-slate-800 p-3 rounded-3xl border-2 border-transparent hover:border-primary transition-all cursor-pointer shadow-sm group relative flex flex-col h-fit">
                <div className="absolute top-4 left-4 z-10"><span className={`px-2 py-0.5 rounded-lg text-[8px] font-black uppercase tracking-tighter shadow-sm ${p.isService ? 'bg-amber-500 text-white' : 'bg-slate-900/60 text-white backdrop-blur-md'}`}>{p.isService ? 'Serviço' : p.category}</span></div>
                <div className={`aspect-square w-full rounded-2xl mb-3 overflow-hidden flex items-center justify-center shrink-0 ${p.isService ? 'bg-amber-500/5' : 'bg-slate-100 dark:bg-slate-700'}`}><img src={p.image} className="size-full object-cover" alt={p.name} /></div>
                <div className="flex flex-col flex-1 px-1">
                   <h4 className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-200 line-clamp-2 leading-tight mb-1">{p.name}</h4>
                   <div className="mt-auto flex justify-between items-end"><span className="text-[14px] font-black text-primary">R$ {p.salePrice.toLocaleString('pt-BR')}</span></div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="w-[480px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl shrink-0">
          <div className="p-6 space-y-4 border-b border-slate-100 dark:border-slate-800">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Vendedor</label>
                   <select value={selectedVendorId} onChange={e => setSelectedVendorId(e.target.value)} className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-2 rounded-xl px-4 text-[10px] font-black uppercase"><option value="">SELECIONE VENDEDOR</option>{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select>
                </div>
                <div className="space-y-1.5">
                   <div className="flex justify-between items-center px-2"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cliente</label><button onClick={() => setShowCustomerModal(true)} className="text-[9px] font-black text-primary uppercase">Novo</button></div>
                   <select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 text-[10px] font-black uppercase"><option value="">Consumidor Final</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
                </div>
             </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
             {cart.map((item, idx) => (
               <div key={`${item.id}-${idx}`} onClick={() => openItemEdit(item, idx)} className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl group cursor-pointer border border-transparent hover:border-primary/20 transition-all">
                  <div className="flex-1 min-w-0"><p className="text-xs font-black uppercase truncate">{item.name}</p><div className="flex justify-between items-center mt-2"><span className="text-xs font-black">{item.quantity}x</span><span className="text-sm font-black text-primary">R$ {(item.salePrice * item.quantity).toLocaleString('pt-BR')}</span></div></div>
                  <button onClick={(e) => { e.stopPropagation(); setCart(prev => prev.filter((_, i) => i !== idx)); }} className="size-8 bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center opacity-0 group-hover:opacity-100"><span className="material-symbols-outlined text-sm">delete</span></button>
               </div>
             ))}
          </div>
          <div className="p-8 border-t-2 border-slate-100 dark:border-slate-800 space-y-4 bg-white dark:bg-slate-900 shrink-0">
             <div className="space-y-2">
                <div className="flex justify-between items-center"><span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Subtotal</span><span className="text-sm font-black tabular-nums">R$ {subtotal.toLocaleString('pt-BR')}</span></div>
                <div className="flex justify-between items-center">
                   <button onClick={handleOpenDiscountModal} className="text-rose-500 flex items-center gap-1.5 hover:bg-rose-500/10 px-2 py-1 rounded-lg transition-all"><span className="material-symbols-outlined text-sm">local_offer</span><span className="text-[9px] font-black uppercase">Desconto Geral (-)</span></button>
                   <span className="text-sm font-black tabular-nums text-rose-500">- R$ {discountValueCalculated.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between pt-4 border-t border-slate-100 items-baseline"><span className="text-xs font-black uppercase opacity-50 tracking-widest">Total Líquido</span><span className="text-4xl font-black text-slate-900 dark:text-white tabular-nums">R$ {totalGeral.toLocaleString('pt-BR')}</span></div>
             </div>
             <div className="grid grid-cols-2 gap-4">
                <button disabled={cart.length === 0} onClick={() => { if(!selectedVendorId || !selectedCustomerId) { alert('Selecione Vendedor e Cliente!'); return; } setShowOSModal(true); }} className="py-5 bg-amber-500 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-amber-600 transition-all">Gerar OS</button>
                <button disabled={cart.length === 0} onClick={() => { if(!selectedVendorId) { alert('Selecione Vendedor!'); return; } setPayments([]); setShowCheckout(true); }} className="py-5 bg-primary text-white rounded-2xl font-black text-[10px] uppercase shadow-xl hover:bg-blue-600 transition-all">Vender</button>
             </div>
          </div>
        </aside>
      </main>

      {/* MODAL: DESCONTO GERAL (RESTAURADO E FUNCIONAL) */}
      {showGlobalDiscountModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-rose-500 text-white flex justify-between items-center">
                 <div className="flex items-center gap-3">
                    <span className="material-symbols-outlined text-3xl">local_offer</span>
                    <h3 className="text-xl font-black uppercase tracking-tight">Aplicar Desconto Geral</h3>
                 </div>
                 <button onClick={() => setShowGlobalDiscountModal(false)} className="material-symbols-outlined hover:rotate-90 transition-transform">close</button>
              </div>
              <div className="p-10 space-y-8 text-center">
                 {/* Seletor de Tipo */}
                 <div className="flex bg-slate-50 dark:bg-slate-800 p-1.5 rounded-2xl mb-4">
                    <button onClick={() => setTempDiscountType('VALUE')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${tempDiscountType === 'VALUE' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-400'}`}>Em Reais (R$)</button>
                    <button onClick={() => setTempDiscountType('PERCENT')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${tempDiscountType === 'PERCENT' ? 'bg-white dark:bg-slate-700 shadow-sm text-primary' : 'text-slate-400'}`}>Porcentagem (%)</button>
                 </div>
                 
                 <div className="space-y-1.5 text-left">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Valor do Desconto</label>
                    <div className="relative">
                       <span className="absolute left-6 top-1/2 -translate-y-1/2 text-rose-500 font-black text-lg">{tempDiscountType === 'VALUE' ? 'R$' : '%'}</span>
                       <input 
                         autoFocus 
                         type="number" 
                         step="0.01" 
                         value={tempDiscount || ''} 
                         onChange={e => setTempDiscount(parseFloat(e.target.value) || 0)} 
                         className="w-full h-20 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl pl-16 pr-6 text-3xl font-black text-rose-500 text-center outline-none focus:ring-4 focus:ring-rose-500/10" 
                         placeholder="0,00"
                       />
                    </div>
                 </div>

                 {/* Comparativo Visual */}
                 <div className="grid grid-cols-2 gap-4">
                    <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl">
                       <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Subtotal Bruto</p>
                       <p className="text-lg font-black text-slate-800 dark:text-white">R$ {subtotal.toLocaleString('pt-BR')}</p>
                    </div>
                    <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl">
                       <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Valor Final Líquido</p>
                       <p className="text-lg font-black text-emerald-500">R$ {
                         (subtotal - (tempDiscountType === 'PERCENT' ? (subtotal * (tempDiscount/100)) : tempDiscount)).toLocaleString('pt-BR', {minimumFractionDigits: 2})
                       }</p>
                    </div>
                 </div>

                 <button 
                   onClick={handleApplyDiscount} 
                   className="w-full h-16 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 active:scale-95 transition-all"
                 >
                   APLICAR DESCONTO AGORA
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL: CADASTRO DE CLIENTE COMPLETO NO PDV (MANTIDO) */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
              <div className="p-8 bg-primary text-white flex justify-between items-center shrink-0">
                 <div className="flex items-center gap-4">
                   <span className="material-symbols-outlined text-3xl">person_add</span>
                   <div>
                     <h3 className="text-2xl font-black uppercase tracking-tight">Novo Registro de Cliente</h3>
                     <p className="text-[10px] font-bold text-white/70 uppercase">Preencha os dados completos para faturamento</p>
                   </div>
                 </div>
                 <button onClick={() => setShowCustomerModal(false)} className="material-symbols-outlined text-4xl">close</button>
              </div>
              <form onSubmit={handleSaveCustomer} className="flex-1 overflow-y-auto p-10 space-y-10 custom-scrollbar">
                 <div className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase text-slate-500 border-b pb-2">Informações Pessoais</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                       <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 px-2 uppercase">Nome Completo / Razão Social *</label><input required value={customerForm.name} onChange={e => setCustomerForm({...customerForm, name: e.target.value.toUpperCase()})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold uppercase" /></div>
                       <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 px-2 uppercase">CPF / CNPJ</label><input value={customerForm.cpfCnpj} onChange={e => setCustomerForm({...customerForm, cpfCnpj: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold" /></div>
                       <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 px-2 uppercase">WhatsApp / Celular *</label><input required value={customerForm.phone} onChange={e => setCustomerForm({...customerForm, phone: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold" placeholder="(00) 00000-0000" /></div>
                       <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 px-2 uppercase">E-mail</label><input type="email" value={customerForm.email} onChange={e => setCustomerForm({...customerForm, email: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold" /></div>
                    </div>
                 </div>
                 <div className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase text-slate-500 border-b pb-2">Endereço de Entrega / Localização</h4>
                    <div className="grid grid-cols-1 md:grid-cols-6 gap-6">
                       <div className="md:col-span-2 space-y-1"><label className="text-[10px] font-black text-slate-400 px-2 uppercase">CEP</label><input value={customerForm.zipCode} onChange={e => setCustomerForm({...customerForm, zipCode: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold" /></div>
                       <div className="md:col-span-3 space-y-1"><label className="text-[10px] font-black text-slate-400 px-2 uppercase">Rua / Logradouro</label><input value={customerForm.address} onChange={e => setCustomerForm({...customerForm, address: e.target.value.toUpperCase()})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold uppercase" /></div>
                       <div className="md:col-span-1 space-y-1"><label className="text-[10px] font-black text-slate-400 px-2 uppercase">Nº</label><input value={customerForm.number} onChange={e => setCustomerForm({...customerForm, number: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold" /></div>
                       <div className="md:col-span-2 space-y-1"><label className="text-[10px] font-black text-slate-400 px-2 uppercase">Bairro</label><input value={customerForm.neighborhood} onChange={e => setCustomerForm({...customerForm, neighborhood: e.target.value.toUpperCase()})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold uppercase" /></div>
                       <div className="md:col-span-2 space-y-1"><label className="text-[10px] font-black text-slate-400 px-2 uppercase">Cidade</label><input value={customerForm.city} onChange={e => setCustomerForm({...customerForm, city: e.target.value.toUpperCase()})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold uppercase" /></div>
                       <div className="md:col-span-2 space-y-1"><label className="text-[10px] font-black text-slate-400 px-2 uppercase">Estado (UF)</label><input value={customerForm.state} onChange={e => setCustomerForm({...customerForm, state: e.target.value.toUpperCase()})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold uppercase" maxLength={2} /></div>
                    </div>
                 </div>
                 <div className="space-y-6">
                    <h4 className="text-[10px] font-black uppercase text-slate-500 border-b pb-2">Observações Técnicas / Notas</h4>
                    <textarea value={customerForm.notes} onChange={e => setCustomerForm({...customerForm, notes: e.target.value})} className="w-full h-32 bg-slate-50 dark:bg-slate-800 border-none rounded-3xl p-6 text-sm font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all uppercase" placeholder="Anotações sobre o cliente..." />
                 </div>
                 <button type="submit" className="w-full h-20 bg-primary text-white rounded-[2.5rem] font-black text-xs uppercase shadow-xl hover:scale-105 active:scale-95 transition-all">CONCLUIR E VINCULAR AO PDV</button>
              </form>
           </div>
        </div>
      )}

      {/* MODAL: CHECKOUT MÚLTIPLOS PAGAMENTOS (RESTAURADO) */}
      {showCheckout && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-6xl rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                 <div><h3 className="text-2xl font-black uppercase tracking-tight text-slate-900 dark:text-white">Pagamento da Venda</h3><p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Multi-Pagamentos • Restante: R$ {remainingValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p></div>
                 <button onClick={() => setShowCheckout(false)} className="material-symbols-outlined text-4xl">close</button>
              </div>
              <div className="p-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
                 <div className="lg:col-span-4 space-y-6">
                    <div className="grid grid-cols-2 gap-3">
                       {['Dinheiro', 'Pix', 'Debito', 'Credito'].map(m => (
                          <button key={m} onClick={() => setPaymentMethod(m)} className={`p-5 rounded-3xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === m ? 'border-primary bg-primary/5 text-primary shadow-lg' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}>
                             <span className="material-symbols-outlined text-3xl">{m === 'Dinheiro' ? 'payments' : m === 'Pix' ? 'qr_code_2' : 'credit_card'}</span>
                             <span className="text-[10px] font-black uppercase">{m}</span>
                          </button>
                       ))}
                    </div>
                    <div className="p-6 bg-slate-50 dark:bg-slate-800/50 rounded-[2rem] border border-slate-100 dark:border-slate-800 space-y-4">
                       <label className="text-[10px] font-black text-slate-400 uppercase px-2">Valor do Lançamento</label>
                       <input type="number" step="0.01" value={currentPaymentValue} onChange={e => setCurrentPaymentValue(parseFloat(e.target.value) || 0)} className="w-full h-16 bg-white dark:bg-slate-900 border-none rounded-2xl px-6 text-2xl font-black text-primary" />
                       <button onClick={() => { if(currentPaymentValue <= 0) return; setPayments([...payments, {method: paymentMethod, value: currentPaymentValue}]); setCurrentPaymentValue(Math.max(0, totalGeral - (totalPaid + currentPaymentValue))); }} className="w-full h-14 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase">ADICIONAR PAGAMENTO</button>
                    </div>
                 </div>
                 <div className="lg:col-span-5 flex flex-col">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b pb-2 mb-4">Itens Lançados</h4>
                    <div className="flex-1 overflow-y-auto space-y-3 custom-scrollbar pr-2 min-h-[300px]">
                       {payments.map((p, idx) => (
                          <div key={idx} className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 flex justify-between items-center text-slate-900 dark:text-white animate-in slide-in-from-right-4">
                             <span className="text-xs font-black uppercase">{p.method}</span>
                             <div className="flex items-center gap-4"><span className="text-lg font-black tabular-nums">R$ {p.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span><button onClick={() => setPayments(payments.filter((_, i) => i !== idx))} className="text-rose-500 material-symbols-outlined">delete</button></div>
                          </div>
                       ))}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-6">
                       <div className="bg-blue-500/5 p-4 rounded-2xl"><p className="text-[9px] font-black text-blue-400 uppercase">Restante</p><p className="text-xl font-black text-blue-600">R$ {remainingValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p></div>
                       <div className="bg-emerald-500/5 p-4 rounded-2xl"><p className="text-[9px] font-black text-emerald-500 uppercase">Troco</p><p className="text-xl font-black text-emerald-600">R$ {changeValue.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p></div>
                    </div>
                 </div>
                 <div className="lg:col-span-3">
                    <div className="bg-slate-900 text-white p-8 rounded-[2.5rem] space-y-6 shadow-2xl">
                       <h4 className="text-[10px] font-black text-primary uppercase tracking-widest">Resumo Final</h4>
                       <div className="space-y-2">
                          <div className="flex justify-between text-[10px]"><span>SUBTOTAL</span><span>R$ {subtotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                          <div className="flex justify-between text-[10px] text-rose-500"><span>DESCONTOS</span><span>- R$ {discountValueCalculated.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                          <div className="pt-2 border-t border-white/10 flex justify-between font-black"><span>TOTAL</span><span className="text-2xl">R$ {totalGeral.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                       </div>
                       <button disabled={totalPaid < totalGeral || isFinalizing} onClick={handleFinalizeSale} className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase shadow-xl transition-all">FINALIZAR VENDA</button>
                    </div>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAL: SUCESSO */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[500] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-sm rounded-[3rem] shadow-2xl p-12 text-center animate-in zoom-in-95">
              <div className="size-20 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl shadow-emerald-500/20 animate-bounce"><span className="material-symbols-outlined text-4xl">check</span></div>
              <h2 className="text-2xl font-black uppercase text-slate-900 dark:text-white">Concluído!</h2>
              <div className="mt-6 flex flex-col gap-3">
                 <button onClick={() => { window.print(); setShowSuccessModal(false); }} className="w-full py-4 bg-primary text-white rounded-2xl font-black text-xs uppercase shadow-xl">Imprimir e Fechar</button>
                 <button onClick={() => setShowSuccessModal(false)} className="w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-xs uppercase">Apenas Fechar</button>
              </div>
           </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 20px; }
        @media print {
          body * { visibility: hidden !important; }
          #root { display: block !important; }
          #receipt-print-area, #receipt-print-area * { visibility: visible !important; display: block !important; }
          #receipt-print-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; max-width: 80mm !important; }
        }
      `}</style>
    </div>
  );
};

export default PDV;
