
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
  
  // Lógica garantida para detectar caixa aberto para o usuário atual
  const isCashOpen = useMemo(() => {
    return cashSessions.some(s => 
      s.status === CashSessionStatus.OPEN && 
      (s.storeId === currentUser?.storeId || s.openingOperatorId === currentUser?.id)
    );
  }, [cashSessions, currentUser]);

  const [showCheckout, setShowCheckout] = useState(false);
  const [showOSModal, setShowOSModal] = useState(false);
  const [showPriceInquiry, setShowPriceInquiry] = useState(false);
  const [showReturnsModal, setShowReturnsModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [showTerminalMenu, setShowTerminalMenu] = useState(false);
  
  const [successType, setSuccessType] = useState<'SALE' | 'OS' | 'RETURN' | 'CANCEL'>('SALE');
  const [paymentMethod, setPaymentMethod] = useState('Dinheiro');
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [selectedVendorId, setSelectedVendorId] = useState('');
  const [lastSaleData, setLastSaleData] = useState<any>(null);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const [cardInstallments, setCardInstallments] = useState(1);
  const [cardAuthNumber, setCardAuthNumber] = useState('');
  const [cardNsu, setCardNsu] = useState('');
  const [selectedOperatorId, setSelectedOperatorId] = useState('');
  const [selectedBrandId, setSelectedBrandId] = useState('');

  const [osDescription, setOsDescription] = useState('');
  const [shippingValue, setShippingValue] = useState(0);
  const [priceInquirySearch, setPriceInquirySearch] = useState('');
  const [cancelSearchId, setCancelSearchId] = useState('');

  const [returnSearchTerm, setReturnSearchTerm] = useState('');
  const [selectedReturnSale, setSelectedReturnSale] = useState<Transaction | null>(null);

  const [activeCustomerTab, setActiveCustomerTab] = useState<'basic' | 'address'>('basic');
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
        id: saleId, items: [...cart], subtotal, shipping: shippingValue, total: totalGeral,
        payment: paymentMethod, date: new Date().toLocaleString('pt-BR'),
        vendor: vendor?.name || 'Vendedor Não Informado', 
        customer: customer?.name || 'Consumidor Final',
        store: currentStore, ...cardDetails
      };
      
      setLastSaleData(currentSaleData);

      await processSale(cart, totalGeral, paymentMethod, selectedCustomerId, selectedVendorId, shippingValue, cardDetails);
      
      setCart([]);
      setShippingValue(0);
      setSuccessType('SALE');
      setShowCheckout(false);
      setShowSuccessModal(true);
    } catch (e) {
      alert("Erro ao processar venda.");
    } finally {
      setIsFinalizing(false);
    }
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    const newId = `c-${Date.now()}`;
    await addCustomer({ ...customerForm, id: newId });
    setSelectedCustomerId(newId);
    setShowCustomerModal(false);
  };

  const processSaleCancellation = async (sale: Transaction) => {
    if(confirm(`Deseja estornar a venda ${sale.id}?`)) {
        const estorno: Transaction = {
          ...sale, id: `CANCEL-${Date.now()}`, description: `ESTORNO: ${sale.id}`,
          type: 'EXPENSE', category: 'Devolução', date: new Date().toISOString().split('T')[0], value: sale.value
        };
        const stockUpdates = (sale.items || []).map(item => {
           const p = products.find(x => x.id === item.id);
           if(p && !p.isService) return addProduct({ ...p, stock: p.stock + item.quantity });
           return Promise.resolve();
        });
        await Promise.all([...stockUpdates, addTransaction(estorno)]);
        setShowCancelModal(false);
        alert("Venda estornada com sucesso!");
     }
  };

  if (!isCashOpen) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-100 dark:bg-background-dark p-6">
        <div className="bg-white dark:bg-slate-900 p-12 rounded-[3.5rem] shadow-2xl border border-slate-200 dark:border-slate-800 text-center max-w-lg space-y-8 animate-in zoom-in-95">
           <div className="size-24 bg-rose-500/10 text-rose-500 rounded-[2rem] flex items-center justify-center mx-auto animate-pulse"><span className="material-symbols-outlined text-5xl">lock</span></div>
           <h2 className="text-3xl font-black uppercase">Caixa Fechado</h2>
           <p className="text-slate-500 font-bold text-sm uppercase">Para iniciar as operações de venda, realize a abertura do movimento diário.</p>
           <button onClick={() => navigate('/caixa')} className="w-full py-5 bg-primary text-white rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-all">Ir para Abertura de Caixa</button>
           <button onClick={() => navigate('/')} className="w-full py-5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-2xl font-black text-xs uppercase transition-all">Voltar ao Início</button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-slate-50 dark:bg-background-dark overflow-hidden font-display relative">
      
      {/* RECIBO PARA IMPRESSÃO (Oculto em tela) */}
      <div id="receipt-print" className="hidden print:block bg-white text-black font-mono text-[11px] p-4 w-[80mm]">
        <div className="text-center space-y-1 mb-4 border-b border-dashed border-black pb-2">
           <h2 className="text-[14px] font-black uppercase">{lastSaleData?.store?.name}</h2>
           <p className="text-[9px]">{lastSaleData?.store?.location}</p>
           <p className="text-[12px] font-black pt-1">CUPOM NÃO FISCAL</p>
        </div>
        <div className="flex justify-between font-bold mb-2">
           <span>DOC: {lastSaleData?.id?.slice(-8)}</span>
           <span>{lastSaleData?.date}</span>
        </div>
        <div className="border-y border-black py-1 mb-2 font-black flex justify-between uppercase text-[9px]">
           <span>QTD</span><span className="flex-1 px-2">PRODUTO</span><span className="w-16 text-right">VALOR</span>
        </div>
        <div className="space-y-1 mb-4">
           {lastSaleData?.items?.map((item: any, idx: number) => (
             <div key={idx} className="flex justify-between items-start uppercase">
                <span className="w-8">{item.quantity}</span>
                <span className="flex-1 px-2">{item.name}</span>
                <span className="w-16 text-right">{(item.quantity * item.salePrice).toLocaleString('pt-BR')}</span>
             </div>
           ))}
        </div>
        <div className="border-t-2 border-black pt-2 mb-4 text-[13px] font-black flex justify-between">
           <span>TOTAL GERAL:</span><span>R$ {lastSaleData?.total?.toLocaleString('pt-BR')}</span>
        </div>
        <div className="text-center border-t border-dashed border-black pt-2 text-[9px]">
           <p className="font-black">OBRIGADO PELA PREFERÊNCIA!</p>
        </div>
      </div>

      {/* UI PDV */}
      <div className="print:hidden h-full flex flex-col">
        <header className="flex items-center justify-between px-8 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 z-30 shadow-sm shrink-0">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-3 relative">
               <div onClick={() => setShowTerminalMenu(!showTerminalMenu)} className="size-12 rounded-xl bg-primary flex items-center justify-center text-white shadow-lg overflow-hidden cursor-pointer hover:scale-105 transition-all">
                  {currentStore.logoUrl ? <img src={currentStore.logoUrl} className="size-full object-cover" /> : <span className="material-symbols-outlined">point_of_sale</span>}
               </div>
               <div>
                  <h1 className="text-lg font-black uppercase text-slate-900 dark:text-white leading-none">{currentStore.name}</h1>
                  <p className="text-[10px] font-black text-slate-400 uppercase mt-1">Terminal Aberto por: {currentUser?.name}</p>
               </div>
            </div>
          </div>
          <div className="flex gap-3">
             <button onClick={() => setShowCancelModal(true)} className="px-5 py-2.5 bg-rose-500/10 text-rose-500 rounded-xl font-black text-[10px] uppercase flex items-center gap-2"><span className="material-symbols-outlined text-lg">cancel</span> Cancelar</button>
             <button onClick={() => setShowPriceInquiry(true)} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 rounded-xl font-black text-[10px] uppercase flex items-center gap-2"><span className="material-symbols-outlined text-lg">sell</span> Consulta Preço</button>
             <button onClick={() => window.history.back()} className="px-5 py-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-xl font-black text-[10px] uppercase">Sair</button>
          </div>
        </header>

        <main className="flex flex-1 overflow-hidden">
          <section className="flex-1 flex flex-col">
            <div className="p-6 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shrink-0">
              <div className="relative">
                 <span className="material-symbols-outlined absolute left-6 top-1/2 -translate-y-1/2 text-slate-400 text-2xl">search</span>
                 <input ref={searchInputRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Pesquisar produto ou bipar..." className="w-full h-16 bg-slate-100 dark:bg-slate-800 border-none rounded-2xl pl-16 pr-6 text-xl font-bold outline-none focus:ring-4 focus:ring-primary/10 transition-all" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-5 gap-4 content-start custom-scrollbar">
              {filteredProducts.map(p => (
                <div key={p.id} onClick={() => addToCart(p)} className="bg-white dark:bg-slate-800 p-3 rounded-3xl border-2 border-transparent hover:border-primary transition-all cursor-pointer shadow-sm group">
                  <div className={`aspect-square w-full rounded-2xl mb-3 overflow-hidden flex items-center justify-center bg-slate-100 dark:bg-slate-700`}>
                    <img src={p.image} className="size-full object-cover group-hover:scale-110 transition-transform duration-500" />
                  </div>
                  <div className="px-1">
                     <h4 className="text-[11px] font-black uppercase text-slate-700 dark:text-slate-200 truncate">{p.name}</h4>
                     <p className="text-[14px] font-black text-primary leading-none mt-2">R$ {p.salePrice.toLocaleString('pt-BR')}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <aside className="w-[480px] bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 flex flex-col shadow-2xl shrink-0">
            <div className="p-6 space-y-4 border-b">
               <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Vendedor</label><select value={selectedVendorId} onChange={e => setSelectedVendorId(e.target.value)} className="w-full h-12 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 text-[10px] font-black uppercase border-none">{vendors.map(v => <option key={v.id} value={v.id}>{v.name}</option>)}</select></div>
                  <div className="space-y-1.5"><label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-2">Cliente</label><select value={selectedCustomerId} onChange={e => setSelectedCustomerId(e.target.value)} className="w-full h-12 bg-slate-50 dark:bg-slate-800 rounded-xl px-4 text-[10px] font-black uppercase border-none"><option value="">Consumidor Final</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
               </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
               {cart.map(item => (
                 <div key={item.id} className="flex items-center gap-4 bg-slate-50 dark:bg-slate-800 p-4 rounded-3xl group border border-transparent hover:border-primary/20 transition-all">
                    <div className="flex-1 min-w-0">
                       <p className="text-xs font-black uppercase truncate leading-none">{item.name}</p>
                       <div className="flex justify-between items-center mt-2">
                          <div className="flex items-center gap-3">
                             <button onClick={() => setCart(prev => prev.map(i => i.id === item.id ? { ...i, quantity: Math.max(1, i.quantity - 1) } : i))} className="size-6 bg-slate-200 rounded-lg flex items-center justify-center text-slate-500"><span className="material-symbols-outlined text-sm">remove</span></button>
                             <span className="text-xs font-black">{item.quantity}</span>
                             <button onClick={() => addToCart(item)} className="size-6 bg-primary/10 text-primary rounded-lg flex items-center justify-center"><span className="material-symbols-outlined text-sm">add</span></button>
                          </div>
                          <span className="text-sm font-black text-primary">R$ {(item.salePrice * item.quantity).toLocaleString('pt-BR')}</span>
                       </div>
                    </div>
                 </div>
               ))}
            </div>
            <div className="p-8 border-t-2 space-y-4 bg-white dark:bg-slate-900 shadow-[0_-20px_50px_rgba(0,0,0,0.05)] shrink-0">
               <div className="space-y-2">
                  <div className="flex justify-between text-slate-500 font-black uppercase text-[10px]"><span>Subtotal</span><span>R$ {subtotal.toLocaleString('pt-BR')}</span></div>
                  <div className="flex justify-between pt-4 border-t"><span className="text-xs font-black uppercase opacity-50">Total Geral</span><span className="text-4xl font-black text-slate-900 dark:text-white">R$ {totalGeral.toLocaleString('pt-BR')}</span></div>
               </div>
               <button disabled={cart.length === 0} onClick={() => setShowCheckout(true)} className="w-full py-5 bg-primary hover:bg-blue-600 disabled:opacity-30 text-white rounded-2xl font-black text-sm uppercase shadow-xl transition-all">FINALIZAR VENDA (F5)</button>
            </div>
          </aside>
        </main>
      </div>

      {/* MODAL CHECKOUT */}
      {showCheckout && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl p-4 animate-in fade-in print:hidden">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[3.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-8 border-b flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                 <h3 className="text-2xl font-black uppercase">Pagamento</h3>
                 <button onClick={() => setShowCheckout(false)} className="size-12 hover:bg-rose-500 hover:text-white rounded-2xl flex items-center justify-center transition-all"><span className="material-symbols-outlined">close</span></button>
              </div>
              <div className="p-8 space-y-6">
                 <div className="grid grid-cols-2 gap-3">
                    {['Dinheiro', 'Pix', 'Debito', 'Credito'].map(m => (
                      <button key={m} onClick={() => setPaymentMethod(m)} className={`p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-2 ${paymentMethod === m ? 'border-primary bg-primary/5 text-primary' : 'border-slate-100 dark:border-slate-800 text-slate-400 hover:border-primary/40'}`}>
                        <span className="material-symbols-outlined text-2xl">{m === 'Dinheiro' ? 'payments' : m === 'Pix' ? 'qr_code_2' : 'credit_card'}</span>
                        <span className="text-[10px] font-black uppercase tracking-widest">{m}</span>
                      </button>
                    ))}
                 </div>
                 <button disabled={isFinalizing} onClick={handleFinalizeSale} className="w-full h-16 bg-emerald-500 hover:bg-emerald-600 text-white rounded-[2rem] font-black text-sm uppercase shadow-2xl transition-all active:scale-95 flex items-center justify-center">
                   {isFinalizing ? 'PROCESSANDO...' : 'CONFIRMAR E FINALIZAR'}
                 </button>
              </div>
           </div>
        </div>
      )}

      {/* MODAL SUCESSO */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/90 backdrop-blur-2xl p-4 animate-in fade-in print:hidden">
           <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[4rem] shadow-2xl overflow-hidden text-center p-12 space-y-8 animate-in zoom-in-95">
              <div className="size-24 bg-emerald-500 text-white rounded-[2rem] flex items-center justify-center mx-auto shadow-emerald-500/30 animate-bounce"><span className="material-symbols-outlined text-5xl">check</span></div>
              <h2 className="text-3xl font-black uppercase tracking-tighter">Venda Realizada!</h2>
              <div className="grid grid-cols-2 gap-3 pt-4">
                 <button onClick={() => { window.print(); setShowSuccessModal(false); }} className="py-4 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase flex items-center justify-center gap-2 shadow-lg"><span className="material-symbols-outlined text-lg">print</span> Imprimir Recibo</button>
                 <button onClick={() => setShowSuccessModal(false)} className="py-4 bg-primary text-white rounded-2xl font-black text-[10px] uppercase shadow-lg">Concluir</button>
              </div>
           </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #root { display: block !important; }
          #receipt-print, #receipt-print * { visibility: visible !important; display: block !important; }
          #receipt-print { position: absolute !important; left: 0; top: 0; width: 80mm !important; margin: 0; padding: 10px; background: white; color: black; }
          .print\\:hidden, div[class*="fixed"], div[class*="backdrop-blur"], header, aside, main { display: none !important; opacity: 0 !important; }
          @page { size: 80mm auto; margin: 0mm; }
        }
      `}</style>
    </div>
  );
};

export default PDV;
