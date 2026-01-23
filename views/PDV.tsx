
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useApp } from '../AppContext';
import { useNavigate } from 'react-router-dom';
import { CartItem, Product, Customer, UserRole, User, ServiceOrder, ServiceOrderStatus, Establishment, TransactionStatus, Transaction, CashSessionStatus } from '../types';

const PDV: React.FC = () => {
  const { 
    products, customers, users, currentUser, processSale, 
    establishments, addServiceOrder, addCustomer, addEstablishment, 
    addUser, transactions, addTransaction, systemConfig, 
    addProduct, cashSessions, cardOperators, cardBrands 
  } = useApp();
  
  const navigate = useNavigate();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('Todos');
  
  const isCashOpen = useMemo(() => {
    return cashSessions.some(s => s.storeId === currentUser?.storeId && s.status === CashSessionStatus.OPEN);
  }, [cashSessions, currentUser]);

  // Estados de Controle de Modais
  const [showCheckout, setShowCheckout] = useState(false);
  const [showOSModal, setShowOSModal] = useState(false);
  const [showPriceInquiry, setShowPriceInquiry] = useState(false);
  const [showReturnsModal, setShowReturnsModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showTerminalMenu, setShowTerminalMenu] = useState(false);
  const [showPasswordChangeModal, setShowPasswordChangeModal] = useState(false);
  
  // Estados de Negócio
  const [successType, setSuccessType] = useState<'SALE' | 'OS' | 'RETURN' | 'CANCEL'>('SALE');
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [lastSaleData, setLastSaleData] = useState<any>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  // Estados de Cartão
  const [cardInstallments, setCardInstallments] = useState(1);
  const [cardAuthNumber, setCardAuthNumber] = useState('');
  const [cardNsu, setCardNsu] = useState('');
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState('');

  // Estados de Formulário
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [osDescription, setOsDescription] = useState('');
  const [shippingValue, setShippingValue] = useState(0);
  const [priceInquirySearch, setPriceInquirySearch] = useState('');
  const [cancelSearchId, setCancelSearchId] = useState('');

  // Estados de Troca (Returns)
  const [returnSearchTerm, setReturnSearchTerm] = useState('');
  const [selectedReturnSale, setSelectedReturnSale] = useState<Transaction | null>(null);

  const initialCustomerForm: Omit<Customer, 'id'> = { 
    name: '', phone: '', email: '', birthDate: new Date().toISOString().split('T')[0],
    cpfCnpj: '', zipCode: '', address: '', number: '', neighborhood: '', city: '', state: ''
  };
  const [customerForm, setCustomerForm] = useState(initialCustomerForm);

  const searchInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const currentStore = useMemo(() => establishments.find(e => e.id === currentUser?.storeId) || { id: 'default', name: 'Terminal Local' } as Establishment, [establishments, currentUser]);

  const categories = useMemo(() => ['Todos', 'Serviços', ...Array.from(new Set(products.filter(p => !p.isService).map(p => p.category)))], [products]);

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

  const vendors = useMemo(() => {
    return users.filter(u => (u.role === UserRole.VENDOR || u.role === UserRole.ADMIN || u.role === UserRole.MANAGER) && (isAdmin || u.storeId === currentUser?.storeId));
  }, [users, currentUser, isAdmin]);

  const filteredBrands = useMemo(() => {
    return cardBrands.filter(b => b.operatorId === selectedOperatorId);
  }, [cardBrands, selectedOperatorId]);

  const subtotal = useMemo(() => cart.reduce((acc, item) => acc + (item.salePrice * item.quantity), 0), [cart]);
  const totalGeral = useMemo(() => subtotal + (Number(shippingValue) || 0), [subtotal, shippingValue]);

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

  const handleFinalizeSale = async () => {
    if (cart.length === 0 || isFinalizing) return;
    
    if ((paymentMethod === 'Credito' || paymentMethod === 'Debito')) {
       if (!selectedOperatorId || !selectedBrandId) {
          alert("Selecione a Operadora e a Bandeira do cartão!");
          return;
       }
    }

    setIsFinalizing(true);
    try {
      const saleId = `SALE-${Date.now()}`;
      const vendor = vendors.find(v => v.id === selectedVendorId);
      const customer = customers.find(c => c.id === selectedCustomerId);
      
      const cardDetails = (paymentMethod === 'Credito' || paymentMethod === 'Debito') ? {
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
        shipping: shippingValue, 
        total: totalGeral,
        payment: paymentMethod, 
        date: new Date().toLocaleString('pt-BR'),
        vendor: vendor?.name || 'Não inf.', 
        customer: customer?.name || 'Consumidor Final',
        store: currentStore,
        ...cardDetails
      };
      
      setLastSaleData(currentSaleData);

      await processSale(cart, totalGeral, paymentMethod, selectedCustomerId, selectedVendorId, shippingValue, cardDetails);
      
      setCart([]);
      setShippingValue(0);
      setCardInstallments(1);
      setCardAuthNumber('');
      setCardNsu('');
      setSuccessType('SALE');
      setShowCheckout(false);
      setShowSuccessModal(true);
    } catch (e) {
      alert("Erro ao processar venda.");
    } finally {
      setIsFinalizing(false);
    }
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
    setOsDescription('');
    setShowOSModal(false);
    setSuccessType('OS');
    setShowSuccessModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `c-${Date.now()}`;
    await addCustomer({ ...customerForm, id: newId });
    setSelectedCustomerId(newId);
    setShowCustomerModal(false);
    setCustomerForm(initialCustomerForm);
  };

  const filteredReturnSales = useMemo(() => {
    if (!returnSearchTerm) return [];
    return transactions.filter(t => 
      t.type === 'INCOME' && 
      (t.id.toLowerCase().includes(returnSearchTerm.toLowerCase()) || 
       t.client?.toLowerCase().includes(returnSearchTerm.toLowerCase()))
    ).slice(0, 10);
  }, [transactions, returnSearchTerm]);

  const handleProcessReturn = async () => {
     if(!selectedReturnSale) return;
     if(confirm('Confirmar estorno integral desta venda? O estoque será devolvido.')) {
        const estorno: Transaction = {
          ...selectedReturnSale,
          id: `CANCEL-${Date.now()}`,
          description: `ESTORNO: ${selectedReturnSale.id}`,
          type: 'EXPENSE',
          category: 'Devolução',
          date: new Date().toISOString().split('T')[0],
          value: selectedReturnSale.value
        };
        
        // Devolução manual de estoque baseada nos itens da venda
        const stockUpdates = (selectedReturnSale.items || []).map(item => {
           const p = products.find(x => x.id === item.id);
           if(p && !p.isService) {
              return addProduct({ ...p, stock: p.stock + item.quantity });
           }
           return Promise.resolve();
        });

        await Promise.all([...stockUpdates, addTransaction(estorno)]);
        setSelectedReturnSale(null);
        setShowReturnsModal(false);
        setSuccessType('RETURN');
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
      
      {/* TEMPLATE DE IMPRESSÃO DO RECIBO PDV */}
      <div id="receipt-print-template" className="hidden print:block p-4 bg-white text-black font-mono text-[10px] leading-tight">
        <div className="text-center space-y-1 mb-4">
           {lastSaleData?.store?.logoUrl && <img src={lastSaleData.store.logoUrl} className="h-12 mx-auto mb-2 grayscale" alt="Logo" />}
           <h2 className="text-xs font-black uppercase">{lastSaleData?.store?.name}</h2>
           <p className="text-[8px] uppercase">{lastSaleData?.store?.location}</p>
           <p className="text-[8px]">CNPJ: {lastSaleData?.store?.cnpj}</p>
           <div className="border-t border-b border-black py-1 my-2 font-black">CUPOM NÃO FISCAL</div>
        </div>

        <div className="flex justify-between mb-2">
           <span>DOC: {lastSaleData?.id}</span>
           <span>{lastSaleData?.date}</span>
        </div>
        
        <div className="mb-4">
           <p>CLIENTE: {lastSaleData?.customer}</p>
           <p>VENDEDOR: {lastSaleData?.vendor}</p>
        </div>

        <div className="border-b border-black pb-1 mb-1 flex text-[9px] font-black">
           <span className="w-10">QTD</span>
           <span className="flex-1">DESCRIÇÃO</span>
           <span className="w-16 text-right">TOTAL</span>
        </div>

        <div className="space-y-1 mb-4 border-b border-black pb-2">
           {lastSaleData?.items.map((item: any, idx: number) => (
             <div key={idx} className="flex">
                <span className="w-10">{item.quantity}</span>
                <span className="flex-1 uppercase">{item.name}</span>
                <span className="w-16 text-right">{(item.quantity * item.salePrice).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
             </div>
           ))}
        </div>

        <div className="space-y-1 text-right font-black">
           <div className="flex justify-between"><span>SUBTOTAL:</span><span>R$ {lastSaleData?.subtotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
           {lastSaleData?.shipping > 0 && <div className="flex justify-between"><span>FRETE (+):</span><span>R$ {lastSaleData?.shipping.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>}
           <div className="flex justify-between text-xs border-t border-black pt-1"><span>TOTAL GERAL:</span><span>R$ {lastSaleData?.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
        </div>

        <div className="mt-4 pt-2 border-t border-dashed border-black">
           <p className="font-black">FORMA DE PAGAMENTO:</p>
           <p className="uppercase">{lastSaleData?.payment} {lastSaleData?.installments > 1 ? `(${lastSaleData?.installments}X)` : ''}</p>
        </div>

        <div className="mt-8 text-center space-y-2">
           <p className="text-[8px] font-bold">OBRIGADO PELA PREFERÊNCIA!</p>
           <p className="text-[7px] opacity-50">SISTEMA ERP RETAIL - v4.5</p>
        </div>
      </div>

      {/* HEADER PDV */}
      <header className="flex items-center justify-between px-8 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-30 shadow-sm shrink-0 print:hidden">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-3 relative">
             <div onClick={() => setShowTerminalMenu(!showTerminalMenu)} className="size-12 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg overflow-hidden cursor-pointer hover:scale-105 transition-all">
                {currentStore.logoUrl ? <img src={currentStore.logoUrl} className="size-full object-cover" alt="Terminal Logo" /> : <span className="material-symbols-outlined">point_of_sale</span>}
             </div>
             <div>
                <h1 className="text-lg font-black uppercase text-slate-900 dark:text-white leading-none">{currentStore.name}</h1>
                <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Operação em Aberto</p>
             </div>
          </div>
          <div className="h-8 w-px bg-slate-200 dark:border-slate-800 mx-2"></div>
          <div className="flex gap-2">
             {categories.map(cat => (
               <button key={cat} onClick={() => setCategory(cat)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all ${category === cat ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{cat}</button>
             ))}
          </div>
        </div>
        <div className="flex gap-3">
           <button onClick={() => setShowCancelModal(true)} className="px-6 py-2.5 bg-rose-500/10 text-rose-500 rounded-xl font-black text-xs hover:bg-rose-500 hover:text-white transition-all uppercase flex items-center gap-2"><span className="material-symbols-outlined text-lg">cancel</span> Cancelamento</button>
           <button onClick={() => setShowReturnsModal(true)} className="px-6 py-2.5 bg-amber-500/10 text-amber-600 rounded-xl font-black text-xs hover:bg-amber-500 hover:text-white transition-all uppercase flex items-center gap-2"><span className="material-symbols-outlined text-lg">history</span> Trocas</button>
           <button onClick={() => setShowPriceInquiry(true)} className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-black text-xs hover:bg-primary hover:text-white transition-all uppercase flex items-center gap-2"><span className="material-symbols-outlined text-lg">sell</span> Consulta Preço</button>
           <button onClick={() => navigate('/servicos?tab=list')} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-black text-xs hover:bg-primary transition-all uppercase flex items-center gap-2"><span className="material-symbols-outlined text-lg">build</span> Gerenciar OS</button>
           <button onClick={() => window.history.back()} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl font-black text-xs hover:bg-black transition-all uppercase tracking-widest">Sair</button>
        </div>
      </header>

      <main className="flex flex-1 overflow-hidden print:hidden">
        {/* LADO ESQUERDO: LISTA DE PRODUTOS */}
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

        {/* LADO DIREITO: CARRINHO */}
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
             {cart.length === 0 ? <div className="h-full flex flex-col items-center justify-center opacity-20"><span className="material-symbols-outlined text-7xl">shopping_cart</span><p className="text-xs font-black uppercase mt-4">Vazio</p></div> : cart.map(item => (
               <div key={item.id} className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl group border border-transparent hover:border-primary/20 transition-all">
                  <div className={`size-14 rounded-2xl flex items-center justify-center shrink-0 overflow-hidden ${item.isService ? 'bg-amber-500/10 text-amber-500' : 'bg-slate-100 dark:bg-slate-700'}`}>
                    {item.image && !item.isService ? ( <img src={item.image} className="size-full object-cover" alt={item.name} /> ) : item.isService ? ( <span className="material-symbols-outlined">build</span> ) : ( <span className="material-symbols-outlined">shopping_bag</span> )}
                  </div>
                  <div className="flex-1 min-w-0">
                     <p className="text-xs font-black uppercase truncate leading-none">{item.name}</p>
                     <div className="flex justify-between items-center mt-2">
                        <div className="flex items-center gap-3">
                           <button onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))} className="size-6 bg-slate-200 dark:bg-slate-700 rounded-lg flex items-center justify-center text-slate-500"><span className="material-symbols-outlined text-sm">remove</span></button>
                           <span className="text-xs font-black tabular-nums">{item.quantity}</span>
                           <button onClick={() => addToCart(item)} className="size-6 bg-primary/10 text-primary rounded-lg flex items-center justify-center"><span className="material-symbols-outlined text-sm">add</span></button>
                        </div>
                        <span className="text-sm font-black text-primary">R$ {(item.salePrice * item.quantity).toLocaleString('pt-BR')}</span>
                     </div>
                  </div>
               </div>
             ))}
          </div>
          <div className="p-8 border-t-2 border-slate-100 dark:border-slate-800 space-y-4 bg-white dark:bg-slate-900 shadow-[0_-20px_50px_rgba(0,0,0,0.05)] shrink-0">
             <div className="space-y-2">
                <div className="flex justify-between text-slate-500"><span className="text-[10px] font-black uppercase">Subtotal</span><span className="text-sm font-black tabular-nums">R$ {subtotal.toLocaleString('pt-BR')}</span></div>
                <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800 p-3 rounded-xl border border-dashed border-slate-200 dark:border-slate-700">
                   <div className="flex items-center gap-2"><span className="material-symbols-outlined text-sm text-slate-400">local_shipping</span><span className="text-[10px] font-black uppercase text-slate-400">Frete</span></div>
                   <input type="number" value={shippingValue} onChange={e => setShippingValue(parseFloat(e.target.value) || 0)} className="bg-transparent border-none text-right text-xs font-black text-slate-900 dark:text-white w-24 p-0 focus:ring-0" placeholder="0,00" />
                </div>
                <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-800"><span className="text-xs font-black uppercase opacity-50">Total</span><span className="text-4xl font-black text-slate-900 dark:text-white tabular-nums">R$ {totalGeral.toLocaleString('pt-BR')}</span></div>
             </div>
             <div className="grid grid-cols-2 gap-4 pt-2">
                <button disabled={cart.length === 0} onClick={() => { if(!selectedCustomerId) { alert('Selecione um cliente!'); return; } setShowOSModal(true); }} className="py-5 bg-amber-500 hover:bg-amber-600 disabled:opacity-30 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">build</span> Gerar OS</button>
                <button disabled={cart.length === 0} onClick={() => setShowCheckout(true)} className="py-5 bg-primary hover:bg-blue-600 disabled:opacity-30 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all"><span className="material-symbols-outlined text-lg">payments</span> Vender</button>
             </div>
          </div>
        </aside>
      </main>

      {/* MODAL CHECKOUT */}
      {showCheckout && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 print:hidden">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                 <div><h3 className="text-2xl font-black uppercase tracking-tight">Pagamento</h3><p className="text-[10px] font-black text-slate-400 uppercase mt-1">Selecione o método e finalize</p></div>
                 <button onClick={() => setShowCheckout(false)} className="size-12 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center"><span className="material-symbols-outlined">close</span></button>
              </div>
              <div className="p-8 space-y-6 max-h-[80vh] overflow-y-auto custom-scrollbar">
                 <div className="grid grid-cols-2 gap-3">
                    {['Dinheiro', 'Pix', 'Debito', 'Credito'].map(m => (
                      <button key={m} onClick={() => setPaymentMethod(m)} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === m ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 dark:border-slate-800 text-slate-400 hover:border-primary/50'}`}>
                        <span className="material-symbols-outlined text-2xl">{m === 'Dinheiro' ? 'payments' : m === 'Pix' ? 'qr_code_2' : 'credit_card'}</span>
                        <span className="text-[9px] font-black uppercase tracking-widest">{m}</span>
                      </button>
                    ))}
                 </div>

                 {(paymentMethod === 'Credito' || paymentMethod === 'Debito') && (
                   <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 space-y-4 animate-in slide-in-from-top-2">
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Operadora</label>
                            <select value={selectedOperatorId} onChange={e => { setSelectedOperatorId(e.target.value); setSelectedBrandId(''); }} className="w-full h-12 bg-white dark:bg-slate-900 border-none rounded-xl px-4 text-[10px] font-bold uppercase">
                               <option value="">Selecione...</option>
                               {cardOperators.map(op => <option key={op.id} value={op.id}>{op.name}</option>)}
                            </select>
                         </div>
                         <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Bandeira</label>
                            <select value={selectedBrandId} onChange={e => setSelectedBrandId(e.target.value)} className="w-full h-12 bg-white dark:bg-slate-900 border-none rounded-xl px-4 text-[10px] font-bold uppercase">
                               <option value="">Selecione...</option>
                               {filteredBrands.map(br => <option key={br.id} value={br.id}>{br.name}</option>)}
                            </select>
                         </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                         <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Parcelas</label>
                            <select value={cardInstallments} onChange={e => setCardInstallments(Number(e.target.value))} className="w-full h-12 bg-white dark:bg-slate-900 border-none rounded-xl px-4 text-xs font-bold">
                               {[...Array(12)].map((_, i) => <option key={i+1} value={i+1}>{i+1}x</option>)}
                            </select>
                         </div>
                         <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">NSU (Opcional)</label>
                            <input value={cardNsu} onChange={e => setCardNsu(e.target.value)} placeholder="000000" className="w-full h-12 bg-white dark:bg-slate-900 border-none rounded-xl px-4 text-xs font-bold" />
                         </div>
                      </div>
                      <div className="space-y-1">
                         <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Nº Autorização (Opcional)</label>
                         <input value={cardAuthNumber} onChange={e => setCardAuthNumber(e.target.value)} placeholder="000000" className="w-full h-12 bg-white dark:bg-slate-900 border-none rounded-xl px-4 text-xs font-bold" />
                      </div>
                   </div>
                 )}

                 <div className="text-center bg-slate-900 dark:bg-black p-6 rounded-[2.5rem]"><p className="text-3xl font-black text-primary tabular-nums">R$ {totalGeral.toLocaleString('pt-BR')}</p></div>
                 <button disabled={isFinalizing} onClick={handleFinalizeSale} className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-white rounded-[2rem] font-black text-sm uppercase shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4">
                   {isFinalizing ? <span className="material-symbols-outlined animate-spin">sync</span> : 'CONCLUIR VENDA'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL CONSULTA PREÇO */}
      {showPriceInquiry && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in print:hidden">
           <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-900 text-white">
                 <h3 className="text-xl font-black uppercase">Consulta de Preço Rápida</h3>
                 <button onClick={() => setShowPriceInquiry(false)} className="material-symbols-outlined">close</button>
              </div>
              <div className="p-8 space-y-6">
                 <input autoFocus value={priceInquirySearch} onChange={e => setPriceInquirySearch(e.target.value)} placeholder="Bipe o código de barras ou digite o nome..." className="w-full h-14 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold" />
                 <div className="space-y-3">
                    {products.filter(p => p.name.toLowerCase().includes(priceInquirySearch.toLowerCase()) || p.barcode?.includes(priceInquirySearch)).slice(0, 5).map(p => (
                       <div key={p.id} className="flex justify-between items-center p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl">
                          <div><p className="text-xs font-black uppercase">{p.name}</p><p className="text-[9px] text-slate-400 font-bold">Ref: {p.sku}</p></div>
                          <p className="text-xl font-black text-primary">R$ {p.salePrice.toLocaleString('pt-BR')}</p>
                       </div>
                    ))}
                    {priceInquirySearch === '' && <p className="text-center text-[10px] font-black text-slate-400 uppercase py-10">Aguardando leitura do produto...</p>}
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAL TROCAS (RETURNS) */}
      {showReturnsModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in print:hidden">
           <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 h-[600px] flex flex-col">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-amber-500 text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase">Trocas e Devoluções</h3>
                 <button onClick={() => { setShowReturnsModal(false); setSelectedReturnSale(null); }} className="material-symbols-outlined">close</button>
              </div>
              <div className="p-8 flex-1 overflow-y-auto space-y-6 custom-scrollbar">
                 {!selectedReturnSale ? (
                    <div className="space-y-4">
                       <p className="text-xs font-bold text-slate-500 uppercase tracking-widest">Localizar venda por Cliente ou Ticket:</p>
                       <input 
                          autoFocus 
                          value={returnSearchTerm} 
                          onChange={e => setReturnSearchTerm(e.target.value)} 
                          placeholder="Digite o nome do cliente ou ID da venda..." 
                          className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold uppercase" 
                       />
                       <div className="space-y-2 pt-4">
                          {filteredReturnSales.map(sale => (
                             <div key={sale.id} onClick={() => setSelectedReturnSale(sale)} className="p-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-2xl hover:border-amber-500 cursor-pointer transition-all flex justify-between items-center">
                                <div>
                                   <p className="text-[10px] font-black text-primary uppercase">{sale.id}</p>
                                   <p className="text-xs font-black uppercase text-slate-700 dark:text-slate-200">{sale.client}</p>
                                   <p className="text-[9px] text-slate-400 font-bold uppercase">{sale.date} • {sale.method}</p>
                                </div>
                                <span className="text-sm font-black text-slate-900 dark:text-white tabular-nums">R$ {sale.value.toLocaleString('pt-BR')}</span>
                             </div>
                          ))}
                          {returnSearchTerm && filteredReturnSales.length === 0 && <p className="text-center py-10 text-[10px] font-black text-slate-400 uppercase">Nenhuma venda localizada</p>}
                       </div>
                    </div>
                 ) : (
                    <div className="space-y-6 animate-in slide-in-from-right-4">
                       <div className="p-4 bg-slate-900 text-white rounded-2xl flex justify-between items-center">
                          <div><p className="text-[10px] uppercase opacity-50">Venda Selecionada</p><p className="font-black uppercase">{selectedReturnSale.id}</p></div>
                          <button onClick={() => setSelectedReturnSale(null)} className="text-[10px] font-black uppercase underline">Alterar</button>
                       </div>
                       <div className="space-y-3">
                          <p className="text-[10px] font-black text-slate-400 uppercase border-b pb-1">Itens do Ticket</p>
                          {(selectedReturnSale.items || []).map(item => (
                             <div key={item.id} className="flex justify-between items-center text-xs font-bold uppercase text-slate-600 dark:text-slate-300">
                                <span>{item.quantity}x {item.name}</span>
                                <span>R$ {(item.quantity * item.salePrice).toLocaleString('pt-BR')}</span>
                             </div>
                          ))}
                       </div>
                       <div className="p-6 bg-amber-500/10 rounded-2xl border-2 border-dashed border-amber-500/20 text-center">
                          <p className="text-[10px] font-black text-amber-600 uppercase mb-1">Valor do Crédito/Estorno</p>
                          <p className="text-3xl font-black text-amber-600 tabular-nums">R$ {selectedReturnSale.value.toLocaleString('pt-BR')}</p>
                       </div>
                       <button onClick={handleProcessReturn} className="w-full h-16 bg-amber-500 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-amber-600 transition-all flex items-center justify-center gap-3">
                          <span className="material-symbols-outlined">assignment_return</span> CONFIRMAR TROCA / DEVOLUÇÃO
                       </button>
                    </div>
                 )}
              </div>
           </div>
        </div>
      )}

      {/* MODAL CANCELAMENTO */}
      {showCancelModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in print:hidden">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-rose-500 text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase">Cancelamento de Venda</h3>
                 <button onClick={() => setShowCancelModal(false)} className="material-symbols-outlined">close</button>
              </div>
              <div className="p-8 space-y-4">
                 <p className="text-xs font-bold text-slate-500 uppercase">Informe o código da venda para estornar:</p>
                 <input value={cancelSearchId} onChange={e => setCancelSearchId(e.target.value)} placeholder="EX: SALE-123456" className="w-full h-14 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold" />
                 <button className="w-full h-16 bg-rose-500 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-rose-600 transition-all">Solicitar Estorno</button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL SUCESSO */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-4 animate-in fade-in print:hidden">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[4rem] shadow-2xl overflow-hidden text-center animate-in zoom-in-95">
              <div className="p-12 space-y-8">
                 <div className="size-24 bg-emerald-500 text-white rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/30 animate-bounce">
                    <span className="material-symbols-outlined text-5xl">check</span>
                 </div>
                 <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter">Operação Concluída!</h2>
                    <p className="text-slate-500 font-bold text-sm uppercase mt-2">
                       {successType === 'SALE' ? 'Venda realizada com sucesso' : 
                        successType === 'RETURN' ? 'Troca processada com crédito gerado' :
                        successType === 'OS' ? 'Ordem de serviço gerada' : 'Cancelamento efetuado'}
                    </p>
                 </div>
                 
                 {lastSaleData && successType === 'SALE' && (
                    <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl text-left space-y-3 border border-slate-100 dark:border-slate-700">
                       <div className="flex justify-between text-[10px] font-black text-slate-400 uppercase"><span>Comprovante</span><span>#{lastSaleData.id.slice(-6)}</span></div>
                       <div className="flex justify-between text-sm font-black"><span>Total Pago</span><span className="text-primary text-xl">R$ {lastSaleData.total.toLocaleString('pt-BR')}</span></div>
                       <div className="flex justify-between text-[9px] font-bold text-slate-500 uppercase"><span>Pagamento</span><span>{lastSaleData.payment} {lastSaleData.installments > 1 ? `(${lastSaleData.installments}x)` : ''}</span></div>
                    </div>
                 )}

                 <div className="grid grid-cols-2 gap-3">
                    <button onClick={() => { window.print(); setShowSuccessModal(false); }} className="py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase shadow-lg flex items-center justify-center gap-2"><span className="material-symbols-outlined text-lg">print</span> Imprimir Recibo</button>
                    <button onClick={() => setShowSuccessModal(false)} className="py-4 bg-primary text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">Próxima Operação</button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* MODAL NOVO CLIENTE (SIMPLIFICADO PARA PDV) */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in print:hidden">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-primary text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase">Cadastro de Cliente</h3>
                 <button onClick={() => setShowCustomerModal(false)} className="material-symbols-outlined">close</button>
              </div>
              <form onSubmit={handleSaveCustomer} className="p-8 space-y-4">
                 <input required placeholder="Nome do Cliente" value={customerForm.name} onChange={e => setCustomerForm({...customerForm, name: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold uppercase" />
                 <input placeholder="Telefone / WhatsApp" value={customerForm.phone} onChange={e => setCustomerForm({...customerForm, phone: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold" />
                 <input placeholder="CPF / CNPJ" value={customerForm.cpfCnpj} onChange={e => setCustomerForm({...customerForm, cpfCnpj: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold" />
                 <button type="submit" className="w-full h-16 bg-primary text-white rounded-2xl font-black text-xs uppercase shadow-xl">Cadastrar e Usar</button>
              </form>
           </div>
        </div>
      )}

      {/* MODAL ORDEM DE SERVIÇO */}
      {showOSModal && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in print:hidden">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-amber-500 text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase">Gerar Ordem de Serviço</h3>
                 <button onClick={() => setShowOSModal(false)} className="material-symbols-outlined">close</button>
              </div>
              <div className="p-8 space-y-6">
                 <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700">
                    <p className="text-[9px] font-black text-slate-400 uppercase">Cliente Vinculado</p>
                    <p className="text-sm font-black uppercase">{customers.find(c => c.id === selectedCustomerId)?.name}</p>
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase px-2">Descrição do Defeito / Diagnóstico</label>
                    <textarea value={osDescription} onChange={e => setOsDescription(e.target.value)} className="w-full h-32 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl p-4 text-xs font-bold uppercase" placeholder="Descreva aqui o problema relatado pelo cliente..." />
                 </div>
                 <div className="p-4 bg-amber-500/10 rounded-2xl text-center"><p className="text-[10px] font-black text-amber-600 uppercase">Valor Estimado</p><p className="text-2xl font-black text-amber-600 tabular-nums">R$ {totalGeral.toLocaleString('pt-BR')}</p></div>
                 <button onClick={handleCreateOS} className="w-full h-16 bg-amber-500 text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-amber-600 transition-all">Confirmar e Gerar OS</button>
              </div>
           </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; }

        @media print {
          /* Esconder toda a interface do sistema */
          aside, header, main, div[class*="fixed"], div[id="root"] > div:not(#receipt-print-template) {
            display: none !important;
          }
          
          body {
            background-color: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
          }

          #receipt-print-template {
            display: block !important;
            width: 100% !important;
            max-width: 80mm; /* Tamanho padrão de impressora térmica */
            margin: 0 auto;
            visibility: visible;
          }

          /* Para impressoras A4, vamos centralizar e dar uma margem */
          @page {
            size: auto;
            margin: 0mm;
          }
        }
      `}</style>
    </div>
  );
};

export default PDV;
