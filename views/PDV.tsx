
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../AppContext';
import { useNavigate } from 'react-router-dom';
import { CartItem, Product, Customer, UserRole, User, ServiceOrder, ServiceOrderStatus, Establishment, TransactionStatus, Transaction, CashSessionStatus } from '../types';

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

  const isCashOpen = useMemo(() => {
    if (isAdmin) return true;
    return cashSessions.some(s => 
      (s.storeId === currentUser?.storeId || s.storeName === currentStore.name) && 
      s.status === CashSessionStatus.OPEN
    );
  }, [cashSessions, currentUser, isAdmin, currentStore]);

  // Estados de Controle de Modais
  const [showCheckout, setShowCheckout] = useState(false);
  const [showOSModal, setShowOSModal] = useState(false);
  const [showPriceInquiry, setShowPriceInquiry] = useState(false);
  const [showReturnsModal, setShowReturnsModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showTerminalMenu, setShowTerminalMenu] = useState(false);
  
  const [editingItem, setEditingItem] = useState<{ index: number, item: CartItem } | null>(null);
  const [showGlobalDiscountModal, setShowGlobalDiscountModal] = useState(false);
  
  // Estados de Negócio
  const [successType, setSuccessType] = useState<'SALE' | 'OS' | 'RETURN' | 'CANCEL'>('SALE');
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [lastSaleData, setLastSaleData] = useState<any>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [globalDiscount, setGlobalDiscount] = useState(0);

  // Estados de Cartão
  const [cardInstallments, setCardInstallments] = useState(1);
  const [cardAuthNumber, setCardAuthNumber] = useState('');
  const [cardNsu, setCardNsu] = useState('');
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState('');

  // Estados de Formulário
  const [osDescription, setOsDescription] = useState('');
  const [shippingValue, setShippingValue] = useState(0);
  const [priceInquirySearch, setPriceInquirySearch] = useState('');
  const [cancelSearchId, setCancelSearchId] = useState('');

  const [tempItemPrice, setTempItemPrice] = useState(0);
  const [returnSearchTerm, setReturnSearchTerm] = useState('');

  const [activeCustomerTab, setActiveCustomerTab] = useState<'basic' | 'address'>('basic');
  const initialCustomerForm: Omit<Customer, 'id'> = { 
    name: '', phone: '', email: '', birthDate: new Date().toISOString().split('T')[0],
    cpfCnpj: '', zipCode: '', address: '', number: '', neighborhood: '', city: '', state: ''
  };
  const [customerForm, setCustomerForm] = useState(initialCustomerForm);

  const searchInputRef = useRef<HTMLInputElement>(null);

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

  const inquiryResults = useMemo(() => {
    if (!priceInquirySearch) return [];
    return products.filter(p => 
      p.name.toLowerCase().includes(priceInquirySearch.toLowerCase()) || 
      p.sku.toLowerCase().includes(priceInquirySearch.toLowerCase()) || 
      p.barcode?.includes(priceInquirySearch)
    ).slice(0, 5);
  }, [priceInquirySearch, products]);

  const cancelCandidate = useMemo(() => {
    if (!cancelSearchId) return null;
    return transactions.find(t => t.id === cancelSearchId || t.id.endsWith(cancelSearchId));
  }, [cancelSearchId, transactions]);

  const vendors = useMemo(() => {
    return users.filter(u => (u.role === UserRole.VENDOR || u.role === UserRole.ADMIN || u.role === UserRole.MANAGER) && (isAdmin || u.storeId === currentUser?.storeId));
  }, [users, currentUser, isAdmin]);

  const filteredBrands = useMemo(() => {
    return cardBrands.filter(b => b.operatorId === selectedOperatorId);
  }, [cardBrands, selectedOperatorId]);

  const subtotal = useMemo(() => cart.reduce((acc, item) => acc + (item.salePrice * item.quantity), 0), [cart]);
  const totalGeral = useMemo(() => Math.max(0, subtotal + (Number(shippingValue) || 0) - (Number(globalDiscount) || 0)), [subtotal, shippingValue, globalDiscount]);

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

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if(!customerForm.name || !customerForm.phone) {
      alert("Preencha ao menos nome e telefone!");
      return;
    }
    const newId = `CUST-${Date.now()}`;
    const newCustomer: Customer = { ...customerForm, id: newId };
    await addCustomer(newCustomer);
    setSelectedCustomerId(newId);
    setCustomerForm(initialCustomerForm);
    setShowCustomerModal(false);
  };

  const handleFinalizeSale = async () => {
    if (cart.length === 0 || isFinalizing) return;
    
    const isCardOrPixMaq = (paymentMethod === 'Credito' || paymentMethod === 'Debito' || paymentMethod === 'Pix Maquineta');
    if (isCardOrPixMaq) {
       if (!selectedOperatorId || !selectedBrandId) {
          alert("Selecione a Operadora e a Bandeira!");
          return;
       }
    }

    setIsFinalizing(true);
    try {
      const saleId = `SALE-${Date.now()}`;
      const vendor = vendors.find(v => v.id === selectedVendorId);
      const customer = customers.find(c => c.id === selectedCustomerId);
      const operator = cardOperators.find(o => o.id === selectedOperatorId);
      const brand = cardBrands.find(b => b.id === selectedBrandId);
      
      const cardDetails = isCardOrPixMaq ? {
        installments: cardInstallments,
        authNumber: cardAuthNumber,
        transactionSku: cardNsu,
        cardOperatorId: selectedOperatorId,
        cardBrandId: selectedBrandId
      } : {};

      const currentSaleData = {
        id: saleId, 
        items: [...cart], 
        subtotal, 
        discount: globalDiscount,
        shipping: shippingValue, 
        total: totalGeral,
        payment: paymentMethod, 
        date: new Date().toLocaleString('pt-BR'),
        vendor: vendor?.name || 'Vendedor Não Informado', 
        customer: customer?.name || 'Consumidor Final',
        store: currentStore,
        operatorName: operator?.name,
        brandName: brand?.name,
        ...cardDetails
      };
      
      setLastSaleData(currentSaleData);

      await processSale(cart, totalGeral, paymentMethod, selectedCustomerId, selectedVendorId, shippingValue, cardDetails);
      
      setCart([]);
      setShippingValue(0);
      setGlobalDiscount(0);
      setCardInstallments(1);
      setCardAuthNumber('');
      setCardNsu('');
      setSelectedOperatorId('');
      setSelectedBrandId('');
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

  const handleCreateOS = async () => {
    if (!selectedCustomerId || cart.length === 0) return;
    const customer = customers.find(c => c.id === selectedCustomerId)!;
    const newOS: ServiceOrder = {
      id: `OS-${Date.now()}`,
      date: new Date().toLocaleDateString('pt-BR'),
      customerId: selectedCustomerId,
      customerName: customer.name,
      description: osDescription,
      status: ServiceOrderStatus.OPEN,
      items: [...cart],
      totalValue: totalGeral,
      store: currentStore.name
    };
    await addServiceOrder(newOS);
    setCart([]);
    setGlobalDiscount(0);
    setOsDescription('');
    setShowOSModal(false);
    setSuccessType('OS');
    setShowSuccessModal(true);
  };

  const processSaleCancellation = async (sale: Transaction) => {
    if(confirm(`Deseja realmente realizar o estorno integral da venda ${sale.id}?\nO estoque dos produtos será devolvido automaticamente.`)) {
        const estorno: Transaction = {
          ...sale,
          id: `CANCEL-${Date.now()}`,
          description: `ESTORNO DE VENDA: ${sale.id}`,
          type: 'EXPENSE',
          category: 'Devolução',
          date: new Date().toISOString().split('T')[0],
          value: sale.value
        };
        const stockUpdates = (sale.items || []).map(item => {
           const p = products.find(x => x.id === item.id);
           if(p && !p.isService) return addProduct({ ...p, stock: p.stock + item.quantity });
           return Promise.resolve();
        });
        await Promise.all([...stockUpdates, addTransaction(estorno)]);
        setSuccessType('CANCEL');
        setShowCancelModal(false);
        setShowReturnsModal(false);
        setShowSuccessModal(true);
     }
  };

  if (!isCashOpen) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-100 dark:bg-background-dark p-6">
        <div className="bg-white dark:bg-slate-900 p-12 rounded-[3.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 text-center max-w-lg space-y-8 animate-in zoom-in-95 duration-500">
           <div className="size-24 bg-rose-500/10 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto animate-pulse"><span className="material-symbols-outlined text-5xl">lock</span></div>
           <h2 className="text-3xl font-black uppercase tracking-tighter">Caixa Fechado</h2>
           <p className="text-slate-500 font-bold text-sm uppercase leading-relaxed">Para iniciar as operações de venda, é necessário realizar a abertura do movimento diário.</p>
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
      
      {/* RECIBO TÉRMICO */}
      <div id="receipt-print-area" className="hidden print:block bg-white text-black font-mono text-[11px] leading-tight p-4">
        <div className="text-center space-y-1 mb-3 border-b-2 border-dashed border-black pb-2">
           {lastSaleData?.store?.logoUrl && <img src={lastSaleData.store.logoUrl} className="h-14 mx-auto mb-1 grayscale" alt="Logo" />}
           <h2 className="text-[14px] font-black uppercase">{lastSaleData?.store?.name || 'TEM ACESSÓRIOS'}</h2>
           <p className="text-[9px] uppercase">{lastSaleData?.store?.location || 'LOCAL NÃO INFORMADO'}</p>
           <p className="text-[9px]">CNPJ: {lastSaleData?.store?.cnpj || '00.000.000/0001-00'}</p>
           <div className="font-black text-[12px] pt-1">*** CUPOM NÃO FISCAL ***</div>
        </div>

        <div className="space-y-1 mb-2 text-[10px]">
           <div className="flex justify-between font-bold"><span>DOC: {lastSaleData?.id || '---'}</span><span>{lastSaleData?.date || '---'}</span></div>
           <div className="uppercase">CLIENTE: {lastSaleData?.customer || 'CONSUMIDOR FINAL'}</div>
           <div className="uppercase">VENDEDOR: {lastSaleData?.vendor || 'BALCÃO'}</div>
        </div>

        <div className="border-t border-b border-black py-1 mb-1 font-black flex justify-between uppercase text-[9px]">
           <span className="w-8">QTD</span><span className="flex-1 px-2">DESCRIÇÃO</span><span className="w-16 text-right">VALOR</span>
        </div>

        <div className="space-y-1 mb-3 text-[10px]">
           {lastSaleData?.items?.map((item: any, idx: number) => (
             <div key={idx} className="flex justify-between items-start uppercase">
                <span className="w-8">{item.quantity.toFixed(0)}</span>
                <span className="flex-1 px-2">{item.name}</span>
                <span className="w-16 text-right">{(item.quantity * item.salePrice).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
             </div>
           ))}
        </div>

        <div className="space-y-1 border-t border-black pt-2 mb-3 text-[11px]">
           <div className="flex justify-between font-bold"><span>SUBTOTAL:</span><span>R$ {lastSaleData?.subtotal?.toLocaleString('pt-BR', {minimumFractionDigits: 2}) || '0,00'}</span></div>
           {lastSaleData?.discount > 0 && <div className="flex justify-between text-rose-600"><span>DESCONTO (-):</span><span>R$ {lastSaleData?.discount?.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>}
           <div className="flex justify-between text-[13px] font-black border-t-2 border-black pt-1"><span>TOTAL GERAL:</span><span>R$ {lastSaleData?.total?.toLocaleString('pt-BR', {minimumFractionDigits: 2}) || '0,00'}</span></div>
        </div>

        <div className="bg-black/5 p-2 border border-black mb-4 text-[10px] space-y-1">
           <div className="font-black uppercase border-b border-black/10 pb-1">FORMA DE PAGAMENTO:</div>
           <div className="uppercase font-bold text-[11px]">{lastSaleData?.payment || 'NÃO INFORMADO'} {lastSaleData?.installments > 1 ? `(${lastSaleData?.installments}X)` : ''}</div>
           {lastSaleData?.operatorName && (
             <div className="text-[8px] opacity-70">
                <p>OPERADORA: {lastSaleData.operatorName} | BANDEIRA: {lastSaleData.brandName}</p>
                <p>NSU: {lastSaleData.transactionSku || '---'} | AUTH: {lastSaleData.authNumber || '---'}</p>
             </div>
           )}
        </div>

        <div className="text-center space-y-1 pt-2 border-t border-dashed border-black text-[9px]">
           <p className="font-black">OBRIGADO PELA PREFERÊNCIA!</p>
           <p className="opacity-70 uppercase">SISTEMA ERP CLOUD - v4.5.2</p>
        </div>
      </div>

      <header className="flex items-center justify-between px-8 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-30 shadow-sm shrink-0 print:hidden">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 relative">
             <div onClick={() => setShowTerminalMenu(!showTerminalMenu)} className="size-12 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg overflow-hidden cursor-pointer hover:scale-105 transition-all">
                {currentStore.logoUrl ? <img src={currentStore.logoUrl} className="size-full object-cover" alt="Terminal Logo" /> : <span className="material-symbols-outlined">point_of_sale</span>}
             </div>
             <div>
                <h1 className="text-lg font-black uppercase text-slate-900 dark:text-white leading-none">{currentStore.name}</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Terminal em Operação</p>
             </div>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:border-slate-800 mx-2"></div>
          <div className="flex gap-2 overflow-x-auto no-scrollbar max-w-[450px]">
             {categories.map(cat => (
               <button key={cat} onClick={() => setCategory(cat)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${category === cat ? 'bg-primary text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 hover:bg-slate-200'}`}>{cat}</button>
             ))}
          </div>
        </div>
        <div className="flex gap-3">
           <button onClick={() => { setCancelSearchId(''); setShowCancelModal(true); }} className="px-5 py-2.5 bg-rose-500/10 text-rose-500 rounded-xl font-black text-[10px] hover:bg-rose-500 hover:text-white transition-all uppercase flex items-center gap-2"><span className="material-symbols-outlined text-lg">cancel</span> Cancelamento</button>
           <button onClick={() => { setReturnSearchTerm(''); setShowReturnsModal(true); }} className="px-5 py-2.5 bg-amber-500/10 text-amber-600 rounded-xl font-black text-[10px] hover:bg-amber-500 hover:text-white transition-all uppercase flex items-center gap-2"><span className="material-symbols-outlined text-lg">history</span> Trocas</button>
           <button onClick={() => setShowPriceInquiry(true)} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-black text-[10px] hover:bg-primary hover:text-white transition-all uppercase flex items-center gap-2"><span className="material-symbols-outlined text-lg">sell</span> Consulta Preço</button>
           <button onClick={() => navigate('/servicos?tab=list')} className="px-5 py-2.5 bg-slate-900 text-white rounded-xl font-black text-[10px] hover:bg-primary transition-all uppercase flex items-center gap-2">
              <span className="material-symbols-outlined text-lg">build</span> Serviços / OS
           </button>
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
                <div className={`aspect-square w-full rounded-2xl mb-3 overflow-hidden flex items-center justify-center shrink-0 ${p.isService ? 'bg-amber-500/5' : 'bg-slate-100 dark:bg-slate-700'}`}>
                  {p.isService ? <span className="material-symbols-outlined text-4xl text-amber-500/50">build</span> : <img src={p.image} className="size-full object-cover group-hover:scale-110 transition-transform duration-500" alt={p.name} />}
                </div>
                <div className="flex flex-col flex-1 px-1">
                   <h4 className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-200 line-clamp-2 min-h-[32px] leading-tight mb-1">{p.name}</h4>
                   <div className="mt-auto flex justify-between items-end">
                      <div className="flex flex-col"><span className="text-[14px] font-black text-primary leading-none">R$ {p.salePrice.toLocaleString('pt-BR')}</span></div>
                      {!p.isService && <div className="text-right"><p className={`text-xs font-black leading-none ${p.stock <= 5 ? 'text-rose-500' : 'text-slate-600 dark:text-slate-300'}`}>{p.stock} <span className="text-[8px]">un</span></p></div>}
                   </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        <aside className="w-[480px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl shrink-0">
          <div className="p-6 space-y-4 border-b border-slate-100 dark:border-slate-800">
             <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                   <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Vendedor</label>
                   <select value={selectedVendorId} onChange={e => setSelectedVendorId(e.target.value)} className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 text-[10px] font-black uppercase">
                      <option value="">Selecione Vendedor</option>
                      {vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}
                   </select>
                </div>
                <div className="space-y-1.5">
                   <div className="flex justify-between items-center px-2">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Cliente</label>
                      <button onClick={() => setShowCustomerModal(true)} className="text-[9px] font-black text-primary uppercase hover:underline flex items-center gap-1"><span className="material-symbols-outlined text-[12px]">person_add</span> Novo</button>
                   </div>
                   <select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 text-[10px] font-black uppercase">
                      <option value="">Consumidor Final</option>
                      {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                   </select>
                </div>
             </div>
          </div>
          <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
             {cart.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center opacity-20"><span className="material-symbols-outlined text-7xl">shopping_cart</span><p className="text-xs font-black uppercase mt-4">Carrinho Vazio</p></div>
             ) : cart.map((item, idx) => {
               const original = products.find(p => p.id === item.id);
               const isPriceModified = original && original.salePrice !== item.salePrice;
               return (
                <div key={`${item.id}-${idx}`} onClick={() => openItemEdit(item, idx)} className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl group border border-transparent hover:border-primary/20 transition-all cursor-pointer">
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <p className="text-xs font-black uppercase truncate leading-none flex-1">{item.name}</p>
                        <button onClick={(e) => { e.stopPropagation(); setCart(prev => prev.filter((_, i) => i !== idx)); }} className="size-5 bg-rose-500/10 text-rose-500 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all"><span className="material-symbols-outlined text-xs">delete</span></button>
                      </div>
                      <div className="flex justify-between items-center mt-2">
                          <div className="flex items-center gap-3" onClick={(e) => e.stopPropagation()}>
                            <button onClick={() => setCart(prev => prev.map((i, ix) => ix === idx ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))} className="size-6 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center text-slate-500"><span className="material-symbols-outlined text-sm">remove</span></button>
                            <span className="text-xs font-black tabular-nums">{item.quantity}</span>
                            <button onClick={() => setCart(prev => prev.map((i, ix) => ix === idx ? { ...i, quantity: i.quantity + 1 } : i))} className="size-6 bg-primary/10 text-primary rounded-lg flex items-center justify-center"><span className="material-symbols-outlined text-sm">add</span></button>
                          </div>
                          <div className="flex flex-col items-end">
                            {isPriceModified && <span className="text-[8px] font-bold text-slate-400 line-through">R$ {original.salePrice.toLocaleString('pt-BR')}</span>}
                            <span className={`text-sm font-black ${isPriceModified ? (item.salePrice < original.salePrice ? 'text-rose-500' : 'text-emerald-500') : 'text-primary'}`}>
                              R$ {(item.salePrice * item.quantity).toLocaleString('pt-BR')}
                            </span>
                          </div>
                      </div>
                    </div>
                </div>
               );
             })}
          </div>
          <div className="p-8 border-t-2 border-slate-100 dark:border-slate-800 space-y-4 bg-white dark:bg-slate-900 shadow-[0_-20px_50px_rgba(0,0,0,0.05)] shrink-0">
             <div className="space-y-2">
                <div className="flex justify-between text-slate-500 items-center"><span className="text-[10px] font-black uppercase tracking-widest">Subtotal Bruto</span><span className="text-sm font-black tabular-nums">R$ {subtotal.toLocaleString('pt-BR')}</span></div>
                <div className="flex justify-between items-center group">
                  <button onClick={() => setShowGlobalDiscountModal(true)} className="flex items-center gap-1.5 text-rose-500 hover:bg-rose-500/10 px-3 py-1 rounded-lg transition-all"><span className="material-symbols-outlined text-sm">local_offer</span><span className="text-[9px] font-black uppercase tracking-widest">Desconto Geral (-)</span></button>
                  <span className="text-sm font-black tabular-nums text-rose-500">- R$ {globalDiscount.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                </div>
                <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-800 items-baseline"><span className="text-xs font-black uppercase opacity-50 tracking-widest">Total Líquido</span><span className="text-4xl font-black text-slate-900 dark:text-white tabular-nums">R$ {totalGeral.toLocaleString('pt-BR')}</span></div>
             </div>
             <div className="grid grid-cols-2 gap-4 pt-2">
                <button disabled={cart.length === 0} onClick={() => { if(!selectedCustomerId) { alert('Selecione um cliente!'); return; } setShowOSModal(true); }} className="py-5 bg-amber-500 hover:bg-amber-600 disabled:opacity-30 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">Gerar OS</button>
                <button disabled={cart.length === 0} onClick={() => setShowCheckout(true)} className="py-5 bg-primary hover:bg-blue-600 disabled:opacity-30 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">Vender</button>
             </div>
          </div>
        </aside>
      </main>

      {/* MODAL: Consulta de Preço */}
      {showPriceInquiry && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 bg-slate-900 text-white flex justify-between items-center">
                 <div><h3 className="text-2xl font-black uppercase tracking-tight">CONSULTA DE PREÇO</h3><p className="text-[10px] font-bold text-slate-400 uppercase mt-1">Busca rápida de valores e estoque</p></div>
                 <button onClick={() => { setPriceInquirySearch(''); setShowPriceInquiry(false); }} className="material-symbols-outlined text-4xl">close</button>
              </div>
              <div className="p-10 space-y-8">
                 <div className="relative">
                    <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 text-3xl">search</span>
                    <input autoFocus value={priceInquirySearch} onChange={e => setPriceInquirySearch(e.target.value)} placeholder="NOME DO PRODUTO OU SKU..." className="w-full h-20 bg-slate-50 dark:bg-slate-800 border-none rounded-[1.5rem] pl-20 pr-6 text-2xl font-black text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-primary/10 transition-all uppercase" />
                 </div>
                 <div className="space-y-4">
                    {inquiryResults.map(p => (
                       <div key={p.id} className="flex items-center gap-6 p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 animate-in slide-in-from-bottom-2">
                          <img src={p.image} className="size-20 rounded-2xl object-cover" />
                          <div className="flex-1">
                             <h4 className="text-lg font-black uppercase text-slate-900 dark:text-white leading-tight">{p.name}</h4>
                             <p className="text-xs font-bold text-slate-400 mt-1 uppercase">SKU: {p.sku} | ESTOQUE: {p.stock} UN</p>
                          </div>
                          <div className="text-right">
                             <p className="text-[10px] font-black text-slate-400 uppercase">Preço Venda</p>
                             <p className="text-4xl font-black text-primary tabular-nums">R$ {p.salePrice.toLocaleString('pt-BR')}</p>
                          </div>
                       </div>
                    ))}
                    {priceInquirySearch && inquiryResults.length === 0 && (
                       <div className="py-20 text-center opacity-30 uppercase font-black">Nenhum produto localizado</div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAL: Cancelamento */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 bg-rose-600 text-white flex justify-between items-center">
                 <div><h3 className="text-2xl font-black uppercase tracking-tight">CANCELAR DOCUMENTO</h3><p className="text-[10px] font-bold text-white/70 uppercase mt-1">Busca por número de venda</p></div>
                 <button onClick={() => setShowCancelModal(false)} className="material-symbols-outlined text-4xl">close</button>
              </div>
              <div className="p-10 space-y-8">
                 <input autoFocus value={cancelSearchId} onChange={e => setCancelSearchId(e.target.value)} placeholder="DIGITE O ID DA VENDA (Ex: SALE-1234)" className="w-full h-16 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-xl font-black text-rose-600 placeholder:text-rose-200 outline-none focus:ring-4 focus:ring-rose-500/10 transition-all uppercase" />
                 
                 {cancelCandidate ? (
                    <div className="space-y-6 animate-in zoom-in-95">
                       <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 space-y-4">
                          <div className="flex justify-between items-start">
                             <div><p className="text-[10px] font-black text-slate-400 uppercase">Documento</p><p className="text-lg font-black">{cancelCandidate.id}</p></div>
                             <div className="text-right"><p className="text-[10px] font-black text-slate-400 uppercase">Data</p><p className="text-lg font-black">{cancelCandidate.date}</p></div>
                          </div>
                          <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                             <p className="text-[10px] font-black text-slate-400 uppercase mb-2">Itens do Documento</p>
                             <div className="space-y-2 max-h-40 overflow-y-auto">
                                {cancelCandidate.items?.map((it, i) => (
                                   <div key={i} className="flex justify-between text-xs font-bold uppercase"><span className="truncate">{it.name}</span><span>{it.quantity} UN</span></div>
                                ))}
                             </div>
                          </div>
                          <div className="border-t border-slate-200 dark:border-slate-700 pt-4 flex justify-between items-center">
                             <span className="text-sm font-black uppercase">Valor Estorno</span>
                             <span className="text-2xl font-black text-rose-600">R$ {cancelCandidate.value.toLocaleString('pt-BR')}</span>
                          </div>
                       </div>
                       <button onClick={() => processSaleCancellation(cancelCandidate)} className="w-full h-20 bg-rose-600 text-white rounded-[2rem] font-black text-sm uppercase shadow-2xl shadow-rose-500/20 transition-all active:scale-95 flex items-center justify-center gap-4">CONFIRMAR ESTORNO INTEGRAL</button>
                    </div>
                 ) : cancelSearchId && (
                    <div className="py-10 text-center opacity-30 uppercase font-black">Venda não localizada no sistema</div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* MODAL: Trocas (Simples) */}
      {showReturnsModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 bg-amber-500 text-white flex justify-between items-center">
                 <div><h3 className="text-2xl font-black uppercase tracking-tight">CENTRAL DE TROCAS</h3><p className="text-[10px] font-bold text-white/70 uppercase mt-1">Busca por cliente ou documento</p></div>
                 <button onClick={() => setShowReturnsModal(false)} className="material-symbols-outlined text-4xl">close</button>
              </div>
              <div className="p-10 space-y-6">
                 <input autoFocus value={returnSearchTerm} onChange={e => setReturnSearchTerm(e.target.value)} placeholder="PESQUISAR CLIENTE OU NÚMERO DO DOCUMENTO..." className="w-full h-16 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-lg font-black text-amber-600 placeholder:text-amber-200 outline-none focus:ring-4 focus:ring-amber-500/10 transition-all uppercase" />
                 <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
                    {transactions.filter(t => (t.id.includes(returnSearchTerm) || t.client?.includes(returnSearchTerm)) && t.type === 'INCOME').slice(0, 10).map(t => (
                       <div key={t.id} className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 flex justify-between items-center group hover:border-amber-500 transition-all cursor-pointer" onClick={() => processSaleCancellation(t)}>
                          <div className="flex-1">
                             <div className="flex items-center gap-3"><span className="text-lg font-black uppercase">{t.client || 'CONSUMIDOR FINAL'}</span><span className="text-[9px] font-black bg-slate-200 px-2 py-0.5 rounded text-slate-500">{t.id}</span></div>
                             <p className="text-xs font-bold text-slate-400 uppercase mt-1">{t.date} • {t.items?.length} ITENS • PAGTO: {t.method}</p>
                          </div>
                          <div className="text-right flex items-center gap-6">
                             <p className="text-xl font-black text-slate-900 dark:text-white tabular-nums">R$ {t.value.toLocaleString('pt-BR')}</p>
                             <button className="px-6 py-2.5 bg-amber-500 text-white rounded-xl text-[10px] font-black uppercase shadow-lg group-hover:scale-105 transition-all">Iniciar Devolução</button>
                          </div>
                       </div>
                    ))}
                    {returnSearchTerm && transactions.filter(t => (t.id.includes(returnSearchTerm) || t.client?.includes(returnSearchTerm))).length === 0 && (
                       <div className="py-20 text-center opacity-30 uppercase font-black">Nenhuma venda encontrada para os critérios informados</div>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAL: Edição de Item */}
      {editingItem && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-900 text-white flex justify-between items-center">
                 <div><h3 className="text-xl font-black uppercase tracking-tight">AJUSTE DE ITEM</h3><p className="text-[10px] font-bold text-slate-400 uppercase mt-1">{editingItem.item.name}</p></div>
                 <button onClick={() => setEditingItem(null)} className="material-symbols-outlined">close</button>
              </div>
              <form onSubmit={handleUpdateItemPrice} className="p-10 space-y-8">
                 <div className="space-y-1.5"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Preço Unitário de Venda (R$)</label><div className="relative"><span className="absolute left-6 top-1/2 -translate-y-1/2 text-primary font-black text-lg">R$</span><input autoFocus type="number" step="0.01" value={tempItemPrice} onChange={e => setTempItemPrice(parseFloat(e.target.value) || 0)} className="w-full h-20 bg-slate-50 dark:bg-slate-800 border-none rounded-[1.5rem] pl-16 pr-6 text-3xl font-black text-slate-900 dark:text-white outline-none focus:ring-4 focus:ring-primary/10 transition-all" /></div></div>
                 <div className="grid grid-cols-2 gap-4"><div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl"><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Preço Original</p><p className="text-sm font-black">R$ {products.find(p => p.id === editingItem.item.id)?.salePrice.toLocaleString('pt-BR')}</p></div><div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl"><p className="text-[8px] font-black text-slate-400 uppercase mb-1">Variação %</p>{(() => { const orig = products.find(p => p.id === editingItem.item.id)?.salePrice || 1; const diff = ((tempItemPrice / orig) - 1) * 100; return <p className={`text-sm font-black ${diff < 0 ? 'text-rose-500' : 'text-emerald-500'}`}>{diff > 0 ? '+' : ''}{diff.toFixed(2)}%</p> })()}</div></div>
                 <button type="submit" className="w-full h-16 bg-primary text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-blue-600 transition-all">CONFIRMAR AJUSTE</button>
              </form>
           </div>
        </div>
      )}

      {/* MODAL: Desconto Global */}
      {showGlobalDiscountModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-rose-500 text-white flex justify-between items-center"><h3 className="text-xl font-black uppercase tracking-tight">DESCONTO GERAL</h3><button onClick={() => setShowGlobalDiscountModal(false)} className="material-symbols-outlined">close</button></div>
              <div className="p-10 space-y-8 text-center"><div className="space-y-1.5 text-left"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Valor Total do Desconto (R$)</label><input autoFocus type="number" step="0.01" value={globalDiscount} onChange={e => setGlobalDiscount(parseFloat(e.target.value) || 0)} className="w-full h-20 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-3xl font-black text-rose-500 text-center outline-none focus:ring-4 focus:ring-rose-500/10 transition-all" /></div>
                 <div className="grid grid-cols-2 gap-4"><div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Subtotal</p><p className="text-lg font-black">R$ {subtotal.toLocaleString('pt-BR')}</p></div><div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl"><p className="text-[10px] font-black text-slate-400 uppercase mb-1">Total Final</p><p className="text-lg font-black text-emerald-500">R$ {totalGeral.toLocaleString('pt-BR')}</p></div></div>
                 <button onClick={() => setShowGlobalDiscountModal(false)} className="w-full h-16 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-black transition-all">APLICAR E VOLTAR</button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL: Cadastro de Cliente Rápido */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col">
              <div className="p-8 bg-primary text-white flex justify-between items-center">
                 <div><h3 className="text-2xl font-black uppercase tracking-tight">CADASTRO DE CLIENTE</h3><p className="text-[10px] font-bold text-white/70 uppercase mt-1">Insira os dados para venda fidelizada</p></div>
                 <button onClick={() => setShowCustomerModal(false)} className="material-symbols-outlined text-4xl">close</button>
              </div>
              <div className="flex border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 p-2 gap-2">
                 <button onClick={() => setActiveCustomerTab('basic')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${activeCustomerTab === 'basic' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:bg-slate-200'}`}>Dados Básicos</button>
                 <button onClick={() => setActiveCustomerTab('address')} className={`flex-1 py-3 text-[10px] font-black uppercase rounded-xl transition-all ${activeCustomerTab === 'address' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:bg-slate-200'}`}>Endereço</button>
              </div>
              <form onSubmit={handleSaveCustomer} className="p-10 space-y-6">
                 {activeCustomerTab === 'basic' ? (
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-left-4">
                      <div className="md:col-span-2 space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Nome Completo</label><input required value={customerForm.name} onChange={e => setCustomerForm({...customerForm, name: e.target.value.toUpperCase()})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold uppercase" /></div>
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">WhatsApp / Tel</label><input required value={customerForm.phone} onChange={e => setCustomerForm({...customerForm, phone: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold" /></div>
                      <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">CPF / CNPJ</label><input value={customerForm.cpfCnpj} onChange={e => setCustomerForm({...customerForm, cpfCnpj: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold" /></div>
                      <div className="md:col-span-2 space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">E-mail</label><input type="email" value={customerForm.email} onChange={e => setCustomerForm({...customerForm, email: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold" /></div>
                   </div>
                 ) : (
                   <div className="grid grid-cols-1 md:grid-cols-4 gap-6 animate-in slide-in-from-right-4">
                      <div className="md:col-span-1 space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">CEP</label><input value={customerForm.zipCode} onChange={e => setCustomerForm({...customerForm, zipCode: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold" /></div>
                      <div className="md:col-span-2 space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Logradouro</label><input value={customerForm.address} onChange={e => setCustomerForm({...customerForm, address: e.target.value.toUpperCase()})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold uppercase" /></div>
                      <div className="md:col-span-1 space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Número</label><input value={customerForm.number} onChange={e => setCustomerForm({...customerForm, number: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold" /></div>
                      <div className="md:col-span-2 space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Bairro</label><input value={customerForm.neighborhood} onChange={e => setCustomerForm({...customerForm, neighborhood: e.target.value.toUpperCase()})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold uppercase" /></div>
                      <div className="md:col-span-1 space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Cidade</label><input value={customerForm.city} onChange={e => setCustomerForm({...customerForm, city: e.target.value.toUpperCase()})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold uppercase" /></div>
                      <div className="md:col-span-1 space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Estado</label><input value={customerForm.state} onChange={e => setCustomerForm({...customerForm, state: e.target.value.toUpperCase()})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold uppercase" maxLength={2} /></div>
                   </div>
                 )}
                 <div className="pt-6">
                    <button type="submit" className="w-full h-20 bg-primary text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all">CONCLUIR CADASTRO E SELECIONAR</button>
                 </div>
              </form>
           </div>
        </div>
      )}

      {/* MODAL: Checkout */}
      {showCheckout && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 print:hidden">
           <div className={`bg-white dark:bg-slate-900 w-full rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 transition-all duration-500 ${(paymentMethod === 'Credito' || paymentMethod === 'Debito' || paymentMethod === 'Pix Maquineta') ? 'max-w-4xl' : 'max-w-lg'}`}>
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                 <div><h3 className="text-2xl font-black uppercase tracking-tight">Finalização</h3><p className="text-[10px] font-black text-slate-400 uppercase">Selecione o meio de pagamento</p></div>
                 <button onClick={() => setShowCheckout(false)} className="size-12 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center transition-all hover:bg-rose-500 hover:text-white shadow-sm"><span className="material-symbols-outlined">close</span></button>
              </div>
              <div className="p-8 flex flex-col md:flex-row gap-10">
                 <div className="flex-1 space-y-6">
                    <div className="grid grid-cols-2 gap-3">
                       {['Dinheiro', 'Pix', 'Debito', 'Credito'].map(m => (
                         <div key={m} className="relative group">
                            <button 
                              onClick={() => {
                                if (m !== 'Pix') setPaymentMethod(m);
                                else setPaymentMethod('Pix Online');
                              }} 
                              className={`w-full p-6 rounded-[2rem] border-2 transition-all flex flex-col items-center gap-3 ${
                                (m === 'Dinheiro' && paymentMethod === 'Dinheiro') ||
                                (m === 'Debito' && paymentMethod === 'Debito') ||
                                (m === 'Credito' && paymentMethod === 'Credito') ||
                                (m === 'Pix' && (paymentMethod === 'Pix Online' || paymentMethod === 'Pix Maquineta'))
                                ? 'border-primary bg-primary/5 text-primary shadow-lg' 
                                : 'border-slate-100 dark:border-slate-800 text-slate-400 hover:border-primary/40'
                              }`}
                            >
                              <span className="material-symbols-outlined text-3xl">{m === 'Dinheiro' ? 'payments' : m === 'Pix' ? 'qr_code_2' : 'credit_card'}</span>
                              <span className="text-[11px] font-black uppercase tracking-widest">{m}</span>
                              {m === 'Pix' && (
                                <div className="absolute top-1 right-1">
                                  <span className="material-symbols-outlined text-xs animate-bounce opacity-50">expand_more</span>
                                </div>
                              )}
                            </button>
                            
                            {/* SUB-MENU PIX */}
                            {m === 'Pix' && (paymentMethod === 'Pix Online' || paymentMethod === 'Pix Maquineta') && (
                              <div className="mt-2 grid grid-cols-2 gap-2 animate-in slide-in-from-top-2 duration-300">
                                <button 
                                  onClick={() => setPaymentMethod('Pix Online')}
                                  className={`py-2 rounded-xl text-[8px] font-black uppercase border transition-all ${paymentMethod === 'Pix Online' ? 'bg-primary text-white border-primary shadow' : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-100 dark:border-slate-700'}`}
                                >
                                  ONLINE
                                </button>
                                <button 
                                  onClick={() => setPaymentMethod('Pix Maquineta')}
                                  className={`py-2 rounded-xl text-[8px] font-black uppercase border transition-all ${paymentMethod === 'Pix Maquineta' ? 'bg-primary text-white border-primary shadow' : 'bg-white dark:bg-slate-800 text-slate-400 border-slate-100 dark:border-slate-700'}`}
                                >
                                  MAQUINETA
                                </button>
                              </div>
                            )}
                         </div>
                       ))}
                    </div>
                    <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl space-y-2">
                       <div className="flex justify-between items-center"><span className="text-[10px] font-black text-slate-400 uppercase">Subtotal</span><span className="text-sm font-bold">R$ {subtotal.toLocaleString('pt-BR')}</span></div>
                       {globalDiscount > 0 && <div className="flex justify-between items-center"><span className="text-[10px] font-black text-rose-500 uppercase">Desconto</span><span className="text-sm font-bold text-rose-500">- R$ {globalDiscount.toLocaleString('pt-BR')}</span></div>}
                       <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700"><span className="text-sm font-black uppercase">Total a Receber</span><span className="text-2xl font-black text-primary">R$ {totalGeral.toLocaleString('pt-BR')}</span></div>
                    </div>
                    <button disabled={isFinalizing} onClick={handleFinalizeSale} className="w-full h-20 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[2rem] font-black text-sm uppercase shadow-2xl shadow-emerald-500/20 transition-all active:scale-95 flex items-center justify-center gap-4">{isFinalizing ? <span className="material-symbols-outlined animate-spin">sync</span> : null}{isFinalizing ? 'Processando...' : 'CONFIRMAR E FINALIZAR VENDA'}</button>
                 </div>
                 {(paymentMethod === 'Credito' || paymentMethod === 'Debito' || paymentMethod === 'Pix Maquineta') && (
                    <div className="flex-1 bg-slate-50 dark:bg-slate-800/40 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-700 space-y-6 animate-in slide-in-from-right-10">
                       <h4 className="text-[10px] font-black text-primary uppercase tracking-widest border-b border-primary/10 pb-4">Detalhes da Transação {paymentMethod === 'Pix Maquineta' ? 'PIX' : 'CARTÃO'}</h4>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Operadora / Banco</label><select value={selectedOperatorId} onChange={e => { setSelectedOperatorId(e.target.value); setSelectedBrandId(''); }} className="w-full h-12 bg-white dark:bg-slate-800 border-none rounded-xl px-4 text-[10px] font-black uppercase shadow-sm"><option value="">Selecione...</option>{cardOperators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}</select></div>
                          <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">{paymentMethod === 'Pix Maquineta' ? 'Canal' : 'Bandeira'}</label><select value={selectedBrandId} onChange={e => setSelectedBrandId(e.target.value)} className="w-full h-12 bg-white dark:bg-slate-800 border-none rounded-xl px-4 text-[10px] font-black uppercase shadow-sm"><option value="">Selecione...</option>{filteredBrands.map(br => <option key={br.id} value={br.id}>{br.name}</option>)}</select></div>
                       </div>
                       <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">NSU / Comprovante</label><input value={cardNsu} onChange={e => setCardNsu(e.target.value)} placeholder="000000" className="w-full h-12 bg-white dark:bg-slate-800 border-none rounded-xl px-4 text-[10px] font-black uppercase shadow-sm" /></div>
                          <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Autorização</label><input value={cardAuthNumber} onChange={e => setCardAuthNumber(e.target.value)} placeholder="AUTORIZ" className="w-full h-12 bg-white dark:bg-slate-800 border-none rounded-xl px-4 text-[10px] font-black uppercase shadow-sm" /></div>
                       </div>
                       {paymentMethod === 'Credito' && (<div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Parcelas</label><div className="grid grid-cols-6 gap-2">{[1,2,3,4,5,6].map(p => (<button key={p} onClick={() => setCardInstallments(p)} className={`h-10 rounded-lg text-[10px] font-black border-2 transition-all ${cardInstallments === p ? 'border-primary bg-primary text-white' : 'border-slate-200 dark:border-slate-700 text-slate-400 hover:border-primary/20'}`}>{p}X</button>))}</div></div>)}
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* MODAL: Sucesso */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-4 animate-in fade-in print:hidden">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[4rem] shadow-2xl overflow-hidden text-center animate-in zoom-in-95">
              <div className="p-12 space-y-8">
                 <div className="size-24 bg-emerald-500 text-white rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/30 animate-bounce"><span className="material-symbols-outlined text-5xl">check</span></div>
                 <h2 className="text-3xl font-black uppercase tracking-tighter">Operação Realizada!</h2>
                 {lastSaleData && successType === 'SALE' && (<div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl text-left space-y-3 border border-slate-100 dark:border-slate-700"><div className="flex justify-between text-sm font-black text-slate-800 dark:text-white uppercase"><span>Total Pago</span><span className="text-primary text-xl">R$ {lastSaleData.total.toLocaleString('pt-BR')}</span></div></div>)}
                 <div className="grid grid-cols-2 gap-3 pt-4">
                    <button onClick={() => { if(successType === 'SALE') window.print(); setShowSuccessModal(false); }} className={`py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg flex items-center justify-center gap-2 hover:bg-black transition-all ${successType === 'CANCEL' ? 'opacity-20 pointer-events-none' : ''}`}><span className="material-symbols-outlined text-lg">print</span> Imprimir Recibo</button>
                    <button onClick={() => setShowSuccessModal(false)} className="py-4 bg-primary text-white rounded-2xl font-black text-[10px] uppercase shadow-lg hover:bg-blue-600 transition-all">Concluir</button>
                 </div>
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
          aside, header, main, .print\\:hidden, div[class*="fixed"], div[class*="backdrop-blur"] { display: none !important; opacity: 0 !important; }
          #receipt-print-area, #receipt-print-area * { visibility: visible !important; display: block !important; }
          #receipt-print-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; max-width: 80mm !important; padding: 10px !important; margin: 0 !important; background: white !important; color: black !important; border: none !important; }
          @page { size: auto; margin: 0mm; }
        }
      `}</style>
    </div>
  );
};

export default PDV;
