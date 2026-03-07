
// Componente de Inventário com correções de tipagem explícita para evitar erros de 'unknown'.
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp, INITIAL_PERMS } from '../AppContext';
import { Product, TransactionStatus } from '../types';

const Inventory: React.FC = () => {
  const { products, addProduct, currentUser, rolePermissions, bulkUpdateStock, addTransaction, establishments, transactions } = useApp();
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [showProductModal, setShowProductModal] = useState(false);
  const [showMovementModal, setShowMovementModal] = useState(false);
  const [movementItems, setMovementItems] = useState<{ product: Product; quantityToAdd: number }[]>([]);
  const [movementSearch, setMovementSearch] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyStartDate, setHistoryStartDate] = useState(new Date().toISOString().split('T')[0]);
  const [historyEndDate, setHistoryEndDate] = useState(new Date().toISOString().split('T')[0]);

  const currentStore = establishments.find(e => e.id === currentUser?.storeId);

  const stockHistory = useMemo(() => {
    return transactions.filter(t => 
      t.category === 'Compra de Mercadoria' && 
      t.date >= historyStartDate && 
      t.date <= historyEndDate &&
      (currentUser?.role === 'ADMINISTRADOR' || t.store === currentStore?.name)
    ).sort((a, b) => b.date.localeCompare(a.date));
  }, [transactions, historyStartDate, historyEndDate, currentStore, currentUser]);

  // Lógica de Bipagem Automática para Movimentação de Estoque
  useEffect(() => {
    if (!movementSearch || movementSearch.length < 3) return;

    const exactMatch = products.find(p => p.barcode === movementSearch || p.sku === movementSearch);
    if (exactMatch) {
      handleAddToMovement(exactMatch);
      setMovementSearch('');
    }
  }, [movementSearch, products]);

  const handleAddToMovement = (product: Product) => {
    if (product.isService) return;
    setMovementItems(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item => 
          item.product.id === product.id 
            ? { ...item, quantityToAdd: item.quantityToAdd + 1 } 
            : item
        );
      }
      return [...prev, { product, quantityToAdd: 1 }];
    });
  };

  const handleSaveMovement = async () => {
    if (movementItems.length === 0) return;
    setIsSaving(true);
    try {
      const adjustments: Record<string, number> = {};
      let totalCost = 0;
      
      movementItems.forEach(item => {
        adjustments[item.product.id] = item.product.stock + item.quantityToAdd;
        totalCost += (item.product.costPrice * item.quantityToAdd);
      });

      // Registrar como Despesa para atualizar a DRE
      const transactionId = `STOCK-IN-${Date.now()}`;
      await addTransaction({
        id: transactionId,
        date: new Date().toISOString().split('T')[0],
        description: `Entrada de Estoque - ${movementItems.length} itens`,
        store: currentStore?.name || 'Matriz',
        category: 'Compra de Mercadoria',
        status: TransactionStatus.PAID,
        value: totalCost,
        type: 'EXPENSE',
        method: 'Saldo em Conta',
        items: movementItems.map(item => ({ ...item.product, quantity: item.quantityToAdd }))
      });

      await bulkUpdateStock(adjustments);
      setShowMovementModal(false);
      setMovementItems([]);
      alert("Estoque atualizado e registrado na DRE com sucesso!");
    } catch (err) {
      console.error(err);
      alert("Erro ao atualizar estoque.");
    } finally {
      setIsSaving(false);
    }
  };

  // Verificação de permissão de edição
  const canEdit = useMemo(() => {
    if (!currentUser) return false;
    const perms = rolePermissions[currentUser.role] || INITIAL_PERMS[currentUser.role];
    return perms.editProducts;
  }, [currentUser, rolePermissions]);

  const initialForm: Partial<Product> = {
    name: '', sku: '', barcode: '', category: 'Geral', brand: '', costPrice: 0, salePrice: 0, stock: 0, unit: 'UN', location: 'GERAL', image: '', isService: false,
    minStock: 0, marginPercent: 0
  };

  const [form, setForm] = useState<Partial<Product>>(initialForm);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => ['Todas', ...Array.from(new Set(products.map(p => p.category)))], [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const search = filter.toLowerCase();
      const matchesSearch = p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search) || p.barcode?.includes(search);
      const matchesCategory = categoryFilter === 'Todas' || p.category === categoryFilter;
      return matchesSearch && matchesCategory;
    });
  }, [products, filter, categoryFilter]);

  const handlePriceChange = (field: string, value: number) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'salePrice') {
        const cost = Number(next.costPrice) || 0;
        if (cost > 0) next.marginPercent = Number(((value / cost - 1) * 100).toFixed(2));
      } else if (field === 'marginPercent') {
        const cost = Number(next.costPrice) || 0;
        next.salePrice = Number((cost * (1 + value / 100)).toFixed(2));
      } else if (field === 'costPrice') {
        const margin = Number(next.marginPercent) || 0;
        next.salePrice = Number((value * (1 + margin / 100)).toFixed(2));
      }
      return next;
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      alert("Você não tem permissão para alterar produtos.");
      return;
    }

    // Validação de campos obrigatórios
    if (!form.name || !form.sku || !form.costPrice || !form.salePrice) {
      alert("Por favor, preencha todos os campos obrigatórios (Nome, SKU, Preços)!");
      return;
    }

    setIsSaving(true);
    const productData: Product = {
      id: editingId || `prod-${Date.now()}`,
      name: String(form.name || '').toUpperCase(),
      sku: String(form.sku || '').toUpperCase(),
      barcode: String(form.barcode || ''),
      category: String(form.category || 'Geral'),
      costPrice: Number(form.costPrice) || 0,
      salePrice: Number(form.salePrice) || 0,
      stock: form.isService ? 9999 : (Number(form.stock) || 0),
      image: form.image || `https://picsum.photos/seed/${form.sku}/400/400`,
      brand: String(form.brand || ''),
      unit: String(form.unit || 'UN'),
      location: String(form.location || 'GERAL'),
      isService: !!form.isService,
      minStock: Number(form.minStock) || 0,
      marginPercent: Number(form.marginPercent) || 0
    };
    
    try {
      await addProduct(productData);
      setShowProductModal(false);
      setEditingId(null);
      setForm(initialForm);
    } catch (err) {
      alert("Erro ao salvar produto. Verifique a conexão.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-4 sm:p-8 space-y-6 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h2 className="text-2xl sm:text-3xl font-black uppercase tracking-tight">Estoque & Produtos</h2>
        <div className="flex flex-col sm:flex-row gap-4 w-full sm:w-auto">
          <button 
            onClick={() => setShowHistoryModal(true)} 
            className="w-full sm:w-auto bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 px-6 py-4 rounded-2xl font-black text-xs uppercase shadow-sm hover:bg-slate-200 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">history</span>
            Histórico
          </button>
          <button 
            onClick={() => { setMovementItems([]); setShowMovementModal(true); }} 
            className="w-full sm:w-auto bg-slate-800 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:bg-slate-700 transition-all flex items-center justify-center gap-2"
          >
            <span className="material-symbols-outlined">inventory</span>
            Movimentar Estoque
          </button>
          {canEdit && (
            <button onClick={() => { setEditingId(null); setForm(initialForm); setShowProductModal(true); }} className="w-full sm:w-auto bg-primary text-white px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-all">Novo Produto</button>
          )}
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900/50 p-4 sm:p-6 rounded-3xl sm:rounded-[2rem] border border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4">
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Pesquisar..." className="flex-1 h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 text-sm font-bold uppercase" />
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-6 text-[10px] font-black uppercase">
          {/* Adicionado tipagem explícita para evitar erro de unknown */}
          {categories.map((c: string) => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[1.5rem] sm:rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b">
                <th className="px-4 sm:px-8 py-4 sm:py-6 text-[10px] font-black uppercase text-slate-400">Produto</th>
                <th className="hidden sm:table-cell px-8 py-6 text-[10px] font-black uppercase text-slate-400 text-center">Estoque</th>
                <th className="px-4 sm:px-8 py-4 sm:py-6 text-[10px] font-black uppercase text-slate-400 text-right">Venda</th>
                <th className="px-4 sm:px-8 py-4 sm:py-6 text-[10px] font-black uppercase text-slate-400 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {/* Adicionado tipagem explícita para evitar erro de unknown */}
              {filteredProducts.map((p: Product) => (
                <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                  <td className="px-4 sm:px-8 py-4 sm:py-6">
                    <div className="flex items-center gap-3 sm:gap-4">
                      <img src={p.image} className="size-10 sm:size-12 rounded-xl object-cover" alt="" />
                      <div>
                        <p className="text-xs sm:text-sm font-black uppercase line-clamp-1">{p.name}</p>
                        <p className="text-[8px] sm:text-[9px] text-slate-400 font-black">SKU: {p.sku}</p>
                      </div>
                    </div>
                  </td>
                  <td className="hidden sm:table-cell px-8 py-6 text-center font-black text-sm">{p.stock} {p.unit}</td>
                  <td className="px-4 sm:px-8 py-4 sm:py-6 text-right font-black text-primary text-xs sm:text-sm whitespace-nowrap">R$ {p.salePrice.toLocaleString('pt-BR')}</td>
                  <td className="px-4 sm:px-8 py-4 sm:py-6 text-right">
                    {canEdit ? (
                      <button onClick={() => { setEditingId(p.id); setForm(p); setShowProductModal(true); }} className="size-8 sm:size-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center mx-auto sm:ml-auto transition-all hover:bg-primary hover:text-white"><span className="material-symbols-outlined text-base sm:text-lg">edit</span></button>
                    ) : (
                      <span className="material-symbols-outlined text-slate-300">lock</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showMovementModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-4xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-8 bg-slate-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="size-12 bg-white/10 rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl">move_to_inbox</span>
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight">Entrada de Mercadoria</h3>
                  <p className="text-[10px] font-bold text-white/50 uppercase">Bipe ou pesquise para adicionar itens</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => window.print()} 
                  className="size-12 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all"
                  title="Imprimir Lista de Entrada"
                >
                  <span className="material-symbols-outlined">print</span>
                </button>
                <button onClick={() => setShowMovementModal(false)} className="size-12 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all"><span className="material-symbols-outlined">close</span></button>
              </div>
            </div>

            <div className="p-8 space-y-6 flex-1 overflow-hidden flex flex-col">
              <div className="relative">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 material-symbols-outlined text-slate-400">barcode_scanner</span>
                <input 
                  autoFocus
                  value={movementSearch}
                  onChange={e => setMovementSearch(e.target.value)}
                  placeholder="Bipe o código ou digite o nome do produto..."
                  className="w-full h-16 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl pl-14 pr-6 text-sm font-bold uppercase outline-none focus:ring-4 focus:ring-primary/10"
                />
                
                {movementSearch && movementSearch.length >= 2 && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 z-50 max-h-60 overflow-y-auto custom-scrollbar">
                    {products
                      .filter(p => !p.isService && (p.name.toLowerCase().includes(movementSearch.toLowerCase()) || p.sku.toLowerCase().includes(movementSearch.toLowerCase()) || p.barcode?.includes(movementSearch)))
                      .map(p => (
                        <button 
                          key={p.id}
                          onClick={() => { handleAddToMovement(p); setMovementSearch(''); }}
                          className="w-full p-4 flex items-center gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-all text-left border-b border-slate-100 dark:border-slate-700 last:border-none"
                        >
                          <img src={p.image} className="size-10 rounded-lg object-cover" />
                          <div className="flex-1">
                            <p className="text-xs font-black uppercase text-slate-900 dark:text-white">{p.name}</p>
                            <p className="text-[9px] font-bold text-slate-400 uppercase">Estoque Atual: {p.stock} {p.unit}</p>
                          </div>
                          <span className="material-symbols-outlined text-primary">add_circle</span>
                        </button>
                      ))}
                  </div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto custom-scrollbar space-y-3 pr-2">
                {movementItems.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                    <span className="material-symbols-outlined text-8xl">inventory_2</span>
                    <p className="text-xs font-black uppercase mt-4">Nenhum item na lista de entrada</p>
                  </div>
                ) : (
                  movementItems.map((item, idx) => (
                    <div key={idx} className="bg-slate-50 dark:bg-slate-800/50 p-4 rounded-3xl border border-slate-100 dark:border-slate-800 flex items-center gap-4 animate-in slide-in-from-right-4">
                      <img src={item.product.image} className="size-12 rounded-xl object-cover" />
                      <div className="flex-1">
                        <p className="text-xs font-black uppercase text-slate-900 dark:text-white">{item.product.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Atual: {item.product.stock} {item.product.unit}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-700 p-1">
                          <button 
                            onClick={() => setMovementItems(prev => prev.map((it, i) => i === idx ? { ...it, quantityToAdd: Math.max(1, it.quantityToAdd - 1) } : it))}
                            className="size-8 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">remove</span>
                          </button>
                          <input 
                            type="number"
                            value={item.quantityToAdd}
                            onChange={e => {
                              const val = parseInt(e.target.value) || 0;
                              setMovementItems(prev => prev.map((it, i) => i === idx ? { ...it, quantityToAdd: val } : it));
                            }}
                            className="w-12 text-center bg-transparent border-none text-sm font-black text-primary outline-none"
                          />
                          <button 
                            onClick={() => setMovementItems(prev => prev.map((it, i) => i === idx ? { ...it, quantityToAdd: it.quantityToAdd + 1 } : it))}
                            className="size-8 flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-all"
                          >
                            <span className="material-symbols-outlined text-sm">add</span>
                          </button>
                        </div>
                        <button 
                          onClick={() => setMovementItems(prev => prev.filter((_, i) => i !== idx))}
                          className="size-10 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
                        >
                          <span className="material-symbols-outlined">delete</span>
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-800">
                <button 
                  disabled={movementItems.length === 0 || isSaving}
                  onClick={handleSaveMovement}
                  className="w-full h-16 bg-primary text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-50 disabled:pointer-events-none"
                >
                  {isSaving ? <span className="material-symbols-outlined animate-spin">sync</span> : <span className="material-symbols-outlined">task_alt</span>}
                  {isSaving ? 'PROCESSANDO...' : 'CONFIRMAR ENTRADA DE ESTOQUE'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {showProductModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 sm:bg-black/90 backdrop-blur-sm p-0 sm:p-4 animate-in fade-in">
          <div className="bg-[#101822] w-full max-w-5xl h-full sm:h-auto sm:max-h-[95vh] sm:rounded-[3rem] shadow-2xl overflow-hidden border-none sm:border border-slate-800 animate-in zoom-in-95 flex flex-col">
            
            <div className="sticky top-0 z-50 p-5 sm:p-6 bg-primary flex justify-between items-center text-white shrink-0">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-2xl sm:text-3xl">inventory_2</span>
                <h3 className="text-base sm:text-xl font-black uppercase tracking-tight">{editingId ? 'EDITAR PRODUTO' : 'NOVO PRODUTO'}</h3>
              </div>
              <button onClick={() => setShowProductModal(false)} className="size-10 flex items-center justify-center bg-white/10 rounded-full hover:rotate-90 transition-transform"><span className="material-symbols-outlined text-2xl sm:text-3xl">close</span></button>
            </div>

            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto custom-scrollbar p-6 sm:p-10 space-y-8 sm:space-y-10 pb-32 sm:pb-10">
              
              <div className="flex flex-col sm:grid sm:grid-cols-4 gap-6 sm:gap-8">
                 <div className="sm:col-span-1 flex flex-col items-center">
                    <div 
                      onClick={() => fileInputRef.current?.click()} 
                      className="w-full aspect-square sm:aspect-square bg-slate-800/50 rounded-[2rem] sm:rounded-[2.5rem] border-2 border-dashed border-slate-700 flex flex-col items-center justify-center cursor-pointer overflow-hidden group hover:border-primary transition-colors"
                    >
                       {form.image ? (
                          <img src={form.image} className="size-full object-cover" />
                       ) : (
                          <>
                             <span className="material-symbols-outlined text-5xl sm:text-6xl text-slate-600 group-hover:scale-110 transition-transform mb-2">add_a_photo</span>
                             <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Tirar Foto</span>
                          </>
                       )}
                    </div>
                    <input 
                      type="file" 
                      ref={fileInputRef} 
                      className="hidden" 
                      accept="image/*" 
                      capture="environment"
                      onChange={e => {
                        const f = e.target.files?.[0];
                        if(f){ 
                          const r = new FileReader(); 
                          r.onloadend = () => setForm({...form, image: r.result as string}); 
                          r.readAsDataURL(f); 
                        }
                    }} />
                 </div>
                 
                 <div className="sm:col-span-3 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                    <div className="sm:col-span-2 space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Descrição do Produto <span className="text-rose-500">*</span></label>
                       <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full h-14 sm:h-14 bg-slate-800/40 border border-slate-700 rounded-2xl px-6 text-sm font-bold text-white uppercase focus:ring-2 focus:ring-primary outline-none" placeholder="Ex: CAPINHA IPHONE 15 SILICONE" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Unidade</label>
                       <input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="w-full h-14 bg-slate-800/40 border border-slate-700 rounded-2xl px-6 text-sm font-bold text-white uppercase" placeholder="UN, PC, KG" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Tipo de Produto</label>
                       <select value={form.isService ? 'true' : 'false'} onChange={e => setForm({...form, isService: e.target.value === 'true'})} className="w-full h-14 bg-slate-800/40 border border-slate-700 rounded-2xl px-6 text-sm font-bold text-white uppercase">
                          <option value="false">MERCADORIA (COM ESTOQUE)</option>
                          <option value="true">SERVIÇO (VIRTUAL)</option>
                       </select>
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 sm:gap-8">
                 <div className="bg-slate-800/20 p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-slate-800 space-y-6">
                    <h4 className="text-[10px] font-black text-primary uppercase tracking-widest border-b border-slate-800 pb-3">Controle de Estoque</h4>
                    <div className="space-y-4">
                       <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase"><span>Localização</span><span>Atual</span></div>
                       <div className="flex justify-between items-center border-b border-slate-800 pb-2"><span className="text-xs font-bold uppercase text-slate-300">GERAL</span><span className="text-sm font-black text-white">{form.stock}</span></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1"><label className="text-[8px] font-black uppercase text-slate-500">Mínimo</label><input type="number" value={form.minStock} onChange={e => setForm({...form, minStock: Number(e.target.value)})} className="w-full h-10 bg-slate-800 border-none rounded-xl px-4 text-white font-black text-center" /></div>
                       <div className="space-y-1"><label className="text-[8px] font-black uppercase text-slate-500">Saldo Inicial</label><input type="number" value={form.stock} onChange={e => setForm({...form, stock: Number(e.target.value)})} className="w-full h-10 bg-slate-800 border-none rounded-xl px-4 text-white font-black text-center" /></div>
                    </div>
                 </div>

                 <div className="bg-slate-800/20 p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-slate-800 space-y-6">
                    <h4 className="text-[10px] font-black text-primary uppercase tracking-widest border-b border-slate-800 pb-3">Financeiro</h4>
                    <div className="space-y-4">
                       <div className="flex justify-between items-center"><label className="text-[10px] font-black text-slate-400 uppercase">Custo R$ <span className="text-rose-500">*</span></label><input required type="number" step="0.01" value={form.costPrice} onChange={e => handlePriceChange('costPrice', parseFloat(e.target.value) || 0)} className="w-24 h-10 bg-slate-800 rounded-xl border-none text-right font-black text-rose-500 focus:ring-2 focus:ring-primary" /></div>
                       <div className="flex justify-between items-center"><label className="text-[10px] font-black text-slate-400 uppercase">Margem %</label><input type="number" step="0.1" value={form.marginPercent} onChange={e => handlePriceChange('marginPercent', parseFloat(e.target.value) || 0)} className="w-24 h-10 bg-slate-800 rounded-xl border-none text-right font-black text-amber-500" /></div>
                    </div>
                    <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                       <span className="text-[10px] font-black text-primary uppercase">Venda R$ <span className="text-rose-500">*</span></span>
                       <input required type="number" step="0.01" value={form.salePrice} onChange={e => handlePriceChange('salePrice', parseFloat(e.target.value) || 0)} className="w-32 h-12 bg-primary/10 rounded-xl border border-primary/20 text-right font-black text-lg text-primary tabular-nums focus:ring-2 focus:ring-primary outline-none" />
                    </div>
                 </div>

                 <div className="bg-slate-800/20 p-6 sm:p-8 rounded-[2rem] sm:rounded-[3rem] border border-slate-800 space-y-6">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-3">Identificação</h4>
                    <div className="space-y-4">
                       <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-slate-500 px-2">Código SKU <span className="text-rose-500">*</span></label>
                          <input required value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} placeholder="SKU-XXXX" className="w-full h-14 bg-slate-800 rounded-2xl border-none text-white font-mono text-center text-lg font-black focus:ring-2 focus:ring-primary outline-none" />
                       </div>
                       <div className="space-y-1">
                          <label className="text-[8px] font-black uppercase text-slate-500 px-2">Código de Barras</label>
                          <input value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} placeholder="EAN13" className="w-full h-10 bg-slate-800 rounded-xl border-none text-white font-mono text-center text-sm font-bold" />
                       </div>
                    </div>
                 </div>
              </div>

              <div className="fixed sm:relative bottom-0 left-0 right-0 p-4 sm:p-0 sm:pt-10 flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 bg-[#101822] sm:bg-transparent border-t border-slate-800 sm:border-t shadow-[0_-20px_40px_rgba(0,0,0,0.5)] sm:shadow-none z-[60]">
                 <button type="button" onClick={() => setShowProductModal(false)} className="hidden sm:block px-12 py-5 bg-slate-800/50 text-slate-400 rounded-full font-black text-xs uppercase hover:bg-slate-800 transition-all">CANCELAR</button>
                 <button type="submit" disabled={isSaving} className="w-full sm:w-auto px-16 py-6 sm:py-5 bg-primary text-white rounded-2xl sm:rounded-full font-black text-sm sm:text-xs uppercase shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center justify-center gap-3">
                    {isSaving ? <span className="material-symbols-outlined animate-spin text-xl sm:text-sm">sync</span> : <span className="material-symbols-outlined">check_circle</span>}
                    {isSaving ? 'PROCESSANDO...' : 'FINALIZAR CADASTRO'}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}
      
      {showHistoryModal && (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[90vh]">
            <div className="p-8 bg-slate-800 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center gap-4">
                <div className="size-12 bg-white/10 rounded-2xl flex items-center justify-center">
                  <span className="material-symbols-outlined text-3xl">history</span>
                </div>
                <div>
                  <h3 className="text-2xl font-black uppercase tracking-tight">Histórico de Entradas</h3>
                  <p className="text-[10px] font-bold text-white/50 uppercase">Controle de reposição por período</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button 
                  onClick={() => window.print()} 
                  className="size-12 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all"
                  title="Imprimir Relatório"
                >
                  <span className="material-symbols-outlined">print</span>
                </button>
                <button onClick={() => setShowHistoryModal(false)} className="size-12 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all"><span className="material-symbols-outlined">close</span></button>
              </div>
            </div>

            <div className="p-6 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row gap-4 items-end shrink-0">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Data Inicial</label>
                <input 
                  type="date" 
                  value={historyStartDate} 
                  onChange={e => setHistoryStartDate(e.target.value)}
                  className="w-full h-12 bg-white dark:bg-slate-900 border-none rounded-xl px-4 text-xs font-bold uppercase"
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-[10px] font-black uppercase text-slate-400 ml-2">Data Final</label>
                <input 
                  type="date" 
                  value={historyEndDate} 
                  onChange={e => setHistoryEndDate(e.target.value)}
                  className="w-full h-12 bg-white dark:bg-slate-900 border-none rounded-xl px-4 text-xs font-bold uppercase"
                />
              </div>
              <div className="bg-white dark:bg-slate-900 p-4 rounded-xl border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center min-w-[150px]">
                <p className="text-[8px] font-black text-slate-400 uppercase">Total no Período</p>
                <p className="text-lg font-black text-primary">R$ {stockHistory.reduce((acc, t) => acc + t.value, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              {stockHistory.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center opacity-20 py-20">
                  <span className="material-symbols-outlined text-8xl">search_off</span>
                  <p className="text-xs font-black uppercase mt-4">Nenhuma entrada encontrada no período</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {stockHistory.map((t) => (
                    <div key={t.id} className="bg-white dark:bg-slate-800 p-6 rounded-[2rem] border border-slate-100 dark:border-slate-700 shadow-sm">
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <p className="text-[10px] font-black text-primary uppercase tracking-widest">{new Date(t.date).toLocaleDateString('pt-BR')}</p>
                          <h4 className="text-sm font-black uppercase text-slate-900 dark:text-white mt-1">{t.description}</h4>
                        </div>
                        <div className="text-right">
                          <p className="text-lg font-black text-slate-900 dark:text-white">R$ {t.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase">{t.store}</p>
                        </div>
                      </div>
                      
                      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-2xl p-4">
                        <p className="text-[9px] font-black text-slate-400 uppercase mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">Itens da Reposição</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {t.items?.map((item, idx) => (
                            <div key={idx} className="flex items-center gap-3">
                              <div className="size-8 bg-slate-200 dark:bg-slate-700 rounded-lg overflow-hidden shrink-0">
                                <img src={item.image} className="size-full object-cover" />
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-black uppercase truncate">{item.name}</p>
                                <p className="text-[9px] font-bold text-slate-400 uppercase">{item.quantity} {item.unit} x R$ {item.costPrice.toLocaleString('pt-BR')}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Área de Impressão do Histórico de Entradas */}
      <div id="history-print-area" className="hidden print:block p-8 text-black bg-white">
        <div className="border-b-2 border-black pb-4 mb-6 flex justify-between items-end">
          <div>
            <h1 className="text-2xl font-bold uppercase">Relatório de Entradas de Estoque</h1>
            <p className="text-sm">Período: {new Date(historyStartDate).toLocaleDateString('pt-BR')} até {new Date(historyEndDate).toLocaleDateString('pt-BR')}</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-bold uppercase">Total Geral: R$ {stockHistory.reduce((acc, t) => acc + t.value, 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
          </div>
        </div>
        
        {stockHistory.map((t) => (
          <div key={t.id} className="mb-8 border border-gray-300 p-4 rounded">
            <div className="flex justify-between mb-2 border-b border-gray-200 pb-2">
              <span className="font-bold uppercase text-xs">Data: {new Date(t.date).toLocaleDateString('pt-BR')}</span>
              <span className="font-bold uppercase text-xs">Valor: R$ {t.value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <table className="w-full text-[10px]">
              <thead>
                <tr className="text-left border-b border-gray-100">
                  <th className="py-1 uppercase">Produto</th>
                  <th className="py-1 uppercase text-center">Qtd</th>
                  <th className="py-1 uppercase text-right">Custo Unit.</th>
                  <th className="py-1 uppercase text-right">Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {t.items?.map((item, idx) => (
                  <tr key={idx}>
                    <td className="py-1 uppercase">{item.name}</td>
                    <td className="py-1 text-center">{item.quantity} {item.unit}</td>
                    <td className="py-1 text-right">R$ {item.costPrice.toLocaleString('pt-BR')}</td>
                    <td className="py-1 text-right">R$ {(item.costPrice * item.quantity).toLocaleString('pt-BR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Área de Impressão da Entrada de Estoque */}
      <div id="stock-print-area" className="hidden print:block p-8 text-black bg-white">
        <div className="border-b-2 border-black pb-4 mb-6">
          <h1 className="text-2xl font-bold uppercase">Relatório de Entrada de Estoque</h1>
          <p className="text-sm">Data: {new Date().toLocaleDateString('pt-BR')} - {new Date().toLocaleTimeString('pt-BR')}</p>
          <p className="text-sm">Unidade: {currentStore?.name || 'Matriz'}</p>
        </div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-black">
              <th className="py-2 text-xs uppercase">Produto</th>
              <th className="py-2 text-xs uppercase text-center">Qtd. Entrada</th>
              <th className="py-2 text-xs uppercase text-right">Custo Unit.</th>
              <th className="py-2 text-xs uppercase text-right">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {movementItems.map((item, i) => (
              <tr key={i} className="border-b border-gray-200">
                <td className="py-2 text-xs uppercase">{item.product.name}</td>
                <td className="py-2 text-xs text-center">{item.quantityToAdd} {item.product.unit}</td>
                <td className="py-2 text-xs text-right">R$ {item.product.costPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
                <td className="py-2 text-xs text-right">R$ {(item.product.costPrice * item.quantityToAdd).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="font-bold">
              <td colSpan={3} className="py-4 text-right uppercase">Total da Entrada:</td>
              <td className="py-4 text-right">R$ {movementItems.reduce((acc, item) => acc + (item.product.costPrice * item.quantityToAdd), 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td>
            </tr>
          </tfoot>
        </table>
        <div className="mt-20 flex justify-around">
          <div className="text-center border-t border-black pt-2 w-64"><p className="text-[10px] uppercase font-bold">Assinatura Responsável</p></div>
          <div className="text-center border-t border-black pt-2 w-64"><p className="text-[10px] uppercase font-bold">Conferência Estoque</p></div>
        </div>
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #1e293b; border-radius: 20px; }
        @media (max-width: 640px) {
           .custom-scrollbar::-webkit-scrollbar { width: 0px; }
        }
        @media print {
          body * { visibility: hidden !important; }
          #root { display: none !important; }
          #stock-print-area, #stock-print-area *, #history-print-area, #history-print-area * { visibility: visible !important; display: block !important; }
          #stock-print-area, #history-print-area { position: absolute !important; left: 0 !important; top: 0 !important; width: 100% !important; }
          
          /* Esconder o que não for o modal aberto no momento da impressão */
          ${showHistoryModal ? '#stock-print-area { display: none !important; }' : ''}
          ${showMovementModal ? '#history-print-area { display: none !important; }' : ''}
        }
      `}</style>
    </div>
  );
};

export default Inventory;
