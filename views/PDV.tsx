
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
        vendor: vendor?.name || 'Vendedor Não Informado', 
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
      
      {/* --------------------------------------------------------- */}
      {/* TEMPLATE DE IMPRESSÃO (Oculto em tela, visível em papel) */}
      {/* --------------------------------------------------------- */}
      <div id="receipt-print-area" className="hidden print:block bg-white text-black font-mono text-[11px] leading-tight p-2">
        <div className="text-center space-y-1 mb-3 border-b-2 border-dashed border-black pb-2">
           {lastSaleData?.store?.logoUrl && <img src={lastSaleData.store.logoUrl} className="h-14 mx-auto mb-1 grayscale invert-0" alt="Logo" />}
           <h2 className="text-[14px] font-black uppercase">{lastSaleData?.store?.name}</h2>
           <p className="text-[9px] uppercase">{lastSaleData?.store?.location}</p>
           <p className="text-[9px]">CNPJ: {lastSaleData?.store?.cnpj}</p>
           <div className="font-black text-[12px] pt-1">*** CUPOM NÃO FISCAL ***</div>
        </div>

        <div className="space-y-1 mb-2">
           <div className="flex justify-between font-bold">
              <span>DOC: {lastSaleData?.id}</span>
              <span>{lastSaleData?.date}</span>
           </div>
           <div className="uppercase">CLIENTE: {lastSaleData?.customer}</div>
           <div className="uppercase">VENDEDOR: {lastSaleData?.vendor}</div>
        </div>

        <div className="border-t border-b border-black py-1 mb-1 font-black flex justify-between uppercase">
           <span className="w-8">QTD</span>
           <span className="flex-1 px-2">DESCRIÇÃO</span>
           <span className="w-16 text-right">VALOR</span>
        </div>

        <div className="space-y-1 mb-3">
           {lastSaleData?.items.map((item: any, idx: number) => (
             <div key={idx} className="flex justify-between items-start uppercase">
                <span className="w-8">{item.quantity.toFixed(0)}</span>
                <span className="flex-1 px-2">{item.name}</span>
                <span className="w-16 text-right">{(item.quantity * item.salePrice).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
             </div>
           ))}
        </div>

        <div className="space-y-1 border-t border-black pt-2 mb-3">
           <div className="flex justify-between font-bold">
              <span>SUBTOTAL:</span>
              <span>R$ {lastSaleData?.subtotal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
           </div>
           {lastSaleData?.shipping > 0 && (
             <div className="flex justify-between">
                <span>FRETE (+):</span>
                <span>R$ {lastSaleData?.shipping.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
             </div>
           )}
           <div className="flex justify-between text-[14px] font-black border-t-2 border-black pt-1">
              <span>TOTAL GERAL:</span>
              <span>R$ {lastSaleData?.total.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
           </div>
        </div>

        <div className="bg-black/5 p-2 border border-black mb-4">
           <div className="font-black uppercase">PAGAMENTO:</div>
           <div className="uppercase font-bold text-[12px]">{lastSaleData?.payment} {lastSaleData?.installments > 1 ? `(${lastSaleData?.installments}X)` : ''}</div>
        </div>

        <div className="text-center space-y-2 pt-2 border-t border-dashed border-black">
           <p className="font-black">OBRIGADO PELA PREFERÊNCIA!</p>
           <p className="text-[8px] opacity-70">SISTEMA ERP RETAIL v4.5 - GESTÃO INTELIGENTE</p>
        </div>
      </div>
      {/* --------------------------------------------------------- */}

      {/* HEADER PDV (Oculto na Impressão) */}
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
          <div className="flex gap-2 overflow-x-auto no-scrollbar max-w-[400px]">
             {categories.map(cat => (
               <button key={cat} onClick={() => setCategory(cat)} className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase transition-all whitespace-nowrap ${category === cat ? 'bg-primary text-white shadow-lg' : 'bg-slate-100 dark:bg-slate-800 text-slate-500'}`}>{cat}</button>
             ))}
          </div>
        </div>
        <div className="flex gap-3">
           <button onClick={() => setShowCancelModal(true)} className="px-6 py-2.5 bg-rose-500/10 text-rose-500 rounded-xl font-black text-xs hover:bg-rose-500 hover:text-white transition-all uppercase flex items-center gap-2"><span className="material-symbols-outlined text-lg">cancel</span> Cancelamento</button>
           <button onClick={() => setShowReturnsModal(true)} className="px-6 py-2.5 bg-amber-500/10 text-amber-600 rounded-xl font-black text-xs hover:bg-amber-500 hover:text-white transition-all uppercase flex items-center gap-2"><span className="material-symbols-outlined text-lg">history</span> Trocas</button>
           <button onClick={() => setShowPriceInquiry(true)} className="px-6 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-black text-xs hover:bg-primary hover:text-white transition-all uppercase flex items-center gap-2"><span className="material-symbols-outlined text-lg">sell</span> Consulta Preço</button>
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
                <div className="flex justify-between pt-4 border-t border-slate-100 dark:border-slate-800"><span className="text-xs font-black uppercase opacity-50">Total</span><span className="text-4xl font-black text-slate-900 dark:text-white tabular-nums">R$ {totalGeral.toLocaleString('pt-BR')}</span></div>
             </div>
             <div className="grid grid-cols-2 gap-4 pt-2">
                <button disabled={cart.length === 0} onClick={() => { if(!selectedCustomerId) { alert('Selecione um cliente!'); return; } setShowOSModal(true); }} className="py-5 bg-amber-500 hover:bg-amber-600 disabled:opacity-30 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">Gerar OS</button>
                <button disabled={cart.length === 0} onClick={() => setShowCheckout(true)} className="py-5 bg-primary hover:bg-blue-600 disabled:opacity-30 text-white rounded-2xl font-black text-[10px] uppercase shadow-xl flex items-center justify-center gap-2 active:scale-95 transition-all">Vender</button>
             </div>
          </div>
        </aside>
      </main>

      {/* MODAL CHECKOUT (Oculto na Impressão) */}
      {showCheckout && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 print:hidden">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                 <div><h3 className="text-2xl font-black uppercase tracking-tight">Pagamento</h3></div>
                 <button onClick={() => setShowCheckout(false)} className="size-12 bg-white dark:bg-slate-900 rounded-2xl flex items-center justify-center"><span className="material-symbols-outlined">close</span></button>
              </div>
              <div className="p-8 space-y-6">
                 <div className="grid grid-cols-2 gap-3">
                    {['Dinheiro', 'Pix', 'Debito', 'Credito'].map(m => (
                      <button key={m} onClick={() => setPaymentMethod(m)} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === m ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 dark:border-slate-800 text-slate-400'}`}>
                        <span className="text-[9px] font-black uppercase tracking-widest">{m}</span>
                      </button>
                    ))}
                 </div>
                 <button disabled={isFinalizing} onClick={handleFinalizeSale} className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[2rem] font-black text-sm uppercase shadow-2xl transition-all active:scale-95 flex items-center justify-center gap-4">
                   {isFinalizing ? 'Processando...' : 'CONCLUIR VENDA'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL SUCESSO (Oculto na Impressão) */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-4 animate-in fade-in print:hidden">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[4rem] shadow-2xl overflow-hidden text-center animate-in zoom-in-95">
              <div className="p-12 space-y-8">
                 <div className="size-24 bg-emerald-500 text-white rounded-[2rem] flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/30 animate-bounce">
                    <span className="material-symbols-outlined text-5xl">check</span>
                 </div>
                 <div>
                    <h2 className="text-3xl font-black uppercase tracking-tighter">Operação Concluída!</h2>
                 </div>
                 
                 {lastSaleData && successType === 'SALE' && (
                    <div className="bg-slate-50 dark:bg-slate-800 p-6 rounded-3xl text-left space-y-3 border border-slate-100 dark:border-slate-700">
                       <div className="flex justify-between text-sm font-black"><span>Total Pago</span><span className="text-primary text-xl">R$ {lastSaleData.total.toLocaleString('pt-BR')}</span></div>
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

      {/* MODAL NOVO CLIENTE (PDV) */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 print:hidden">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-primary text-white flex justify-between items-center">
                 <h3 className="text-xl font-black uppercase">Cadastro de Cliente</h3>
                 <button onClick={() => setShowCustomerModal(false)} className="material-symbols-outlined">close</button>
              </div>
              <form onSubmit={handleSaveCustomer} className="p-8 space-y-4">
                 <input required placeholder="Nome do Cliente" value={customerForm.name} onChange={e => setCustomerForm({...customerForm, name: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold uppercase" />
                 <input placeholder="Telefone / WhatsApp" value={customerForm.phone} onChange={e => setCustomerForm({...customerForm, phone: e.target.value})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-sm font-bold" />
                 <button type="submit" className="w-full h-16 bg-primary text-white rounded-2xl font-black text-xs uppercase shadow-xl">Cadastrar e Usar</button>
              </form>
           </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; }
        .dark .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; }

        @media print {
          /* ESCONDER TUDO */
          body * { visibility: hidden; }
          #root { display: none !important; }
          
          /* MOSTRAR APENAS O ÁREA DE RECIBO */
          #receipt-print-area, #receipt-print-area * {
            visibility: visible !important;
          }

          #receipt-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            display: block !important;
            width: 100% !important;
            max-width: 80mm !important; /* Estreita para térmica */
            margin: 0 auto !important;
            padding: 10px !important;
            background: white !important;
            color: black !important;
          }

          /* Reset de Margens de Página */
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
