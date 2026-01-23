
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../AppContext';
import { Product, TransactionStatus, UserRole } from '../types';

const Inventory: React.FC = () => {
  const { products, addProduct, updateProduct, deleteProduct, updateStock, addTransaction, currentUser, establishments } = useApp();
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PRODUCT' | 'SERVICE'>('ALL');

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const [form, setForm] = useState<Partial<Product>>({
    name: '', sku: '', barcode: '', category: '', brand: '', costPrice: 0, salePrice: 0, stock: 0, unit: 'UN', location: '', image: '', isService: false,
    minStock: 0, otherCostsPercent: 0, marginPercent: 0, maxDiscountPercent: 0, commissionPercent: 0, conversionFactor: 1, weight: '0'
  });

  const fileInputRef = useRef<HTMLInputElement>(null);

  const categories = useMemo(() => ['Todas', ...Array.from(new Set(products.map(p => p.category)))], [products]);

  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      const search = filter.toLowerCase();
      const matchesSearch = p.name.toLowerCase().includes(search) || p.sku.toLowerCase().includes(search) || p.barcode?.includes(search);
      const matchesCategory = categoryFilter === 'Todas' || p.category === categoryFilter;
      const matchesType = typeFilter === 'ALL' || (typeFilter === 'SERVICE' ? p.isService : !p.isService);
      return matchesSearch && matchesCategory && matchesType;
    });
  }, [products, filter, categoryFilter, typeFilter]);

  const handlePriceChange = (field: string, value: number) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      const cost = Number(next.costPrice) || 0;
      const others = Number(next.otherCostsPercent) || 0;
      
      if (field === 'salePrice') {
        const totalCost = cost * (1 + others / 100);
        if (totalCost > 0) {
           next.marginPercent = Number(((value / totalCost - 1) * 100).toFixed(2));
        }
      } else {
        const margin = Number(next.marginPercent) || 0;
        next.salePrice = Number((cost * (1 + others / 100) * (1 + margin / 100)).toFixed(2));
      }
      return next;
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalImage = form.image || `https://picsum.photos/seed/${form.sku || Date.now()}/400/400`;
    const productData = { 
      ...form as Product, 
      id: editingId || `prod-${Date.now()}`, 
      image: finalImage,
      isService: false
    };
    
    await addProduct(productData);
    setShowProductModal(false);
    setEditingId(null);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setForm({ ...form, image: reader.result as string });
      reader.readAsDataURL(file);
    }
  };

  const openNewProduct = () => {
    setEditingId(null);
    setForm({ 
      name: '', sku: `SKU-${Date.now()}`, barcode: '', category: '', brand: '', 
      costPrice: 0, salePrice: 0, stock: 0, unit: 'UN', location: '', image: '', isService: false,
      minStock: 0, otherCostsPercent: 0, marginPercent: 0, maxDiscountPercent: 0, commissionPercent: 0, conversionFactor: 1, weight: '0'
    });
    setShowProductModal(true);
  };

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Inventário & Catálogo</h2>
          <p className="text-slate-500 text-sm mt-1 font-bold uppercase tracking-tight">Controle central de ativos e mercadorias</p>
        </div>
        <div className="flex gap-3">
          <button onClick={openNewProduct} className="flex items-center gap-2 bg-primary text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all">
            <span className="material-symbols-outlined text-lg">add_shopping_cart</span> Novo Produto
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[250px] relative group">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-primary transition-colors">search</span>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Bipar código ou digitar nome..." className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-12 pr-4 text-sm font-bold focus:ring-2 focus:ring-primary/20 transition-all" />
        </div>
        
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
           <button onClick={() => setTypeFilter('ALL')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${typeFilter === 'ALL' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400'}`}>Tudo</button>
           <button onClick={() => setTypeFilter('PRODUCT')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${typeFilter === 'PRODUCT' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400'}`}>Produtos</button>
           <button onClick={() => setTypeFilter('SERVICE')} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${typeFilter === 'SERVICE' ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400'}`}>Serviços</button>
        </div>

        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-6 text-[10px] font-black uppercase tracking-widest">
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Item</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest">Referências</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Financeiro</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-center">Controle</th>
                <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {filteredProducts.map(p => (
                <tr key={p.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all">
                  <td className="px-8 py-6">
                    <div className="flex items-center gap-4">
                      <div className="size-14 rounded-2xl bg-slate-100 dark:bg-slate-800 overflow-hidden border border-slate-100 dark:border-slate-700 shadow-inner group-hover:scale-110 transition-transform">
                        <img src={p.image} className="size-full object-cover" />
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase truncate max-w-[200px]">{p.name}</p>
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">{p.brand || 'Marca não inf.'}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <div className="flex flex-col gap-1">
                      <span className="text-[10px] font-mono font-black text-primary uppercase">SKU: {p.sku}</span>
                      <span className="text-[10px] font-mono font-bold text-slate-400">{p.barcode || 'S/ BARRAS'}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <p className="text-sm font-black text-primary tabular-nums">Venda: R$ {p.salePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                    <p className="text-[9px] font-black text-slate-400 uppercase">Custo: R$ {p.costPrice.toLocaleString('pt-BR')}</p>
                  </td>
                  <td className="px-8 py-6 text-center">
                    {p.isService ? (
                      <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest bg-amber-500/10 px-4 py-2 rounded-xl">Mão de Obra</span>
                    ) : (
                      <div className="flex flex-col items-center">
                        <span className={`text-sm font-black tabular-nums ${p.stock <= (p.minStock || 0) ? 'text-rose-500' : 'text-slate-600 dark:text-slate-300'}`}>{p.stock}</span>
                        <span className="text-[9px] font-black text-slate-400 uppercase">{p.unit} • {p.location || 'S/ Loc.'}</span>
                      </div>
                    )}
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingId(p.id); setForm(p); setShowProductModal(true); }} className="size-10 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary rounded-xl transition-all shadow-sm"><span className="material-symbols-outlined text-lg">edit</span></button>
                      <button onClick={() => { if(confirm('Excluir item do catálogo permanentemente?')) deleteProduct(p.id)}} className="size-10 flex items-center justify-center bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all"><span className="material-symbols-outlined text-lg">delete</span></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-6xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[95vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center text-white bg-primary">
              <div className="flex items-center gap-4">
                 <span className="material-symbols-outlined text-3xl">inventory_2</span>
                 <h3 className="text-xl font-black uppercase tracking-tight">{editingId ? 'Editar Produto' : 'Novo Produto Mercadoria'}</h3>
              </div>
              <button onClick={() => setShowProductModal(false)} className="size-10 hover:bg-white/20 rounded-xl flex items-center justify-center transition-all"><span className="material-symbols-outlined">close</span></button>
            </div>
            
            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-8 custom-scrollbar space-y-8">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-4 gap-6 items-center">
                 <div className="md:col-span-1">
                    <div className="aspect-square size-32 mx-auto bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center overflow-hidden relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                       {form.image ? <img src={form.image} className="size-full object-cover" /> : <span className="material-symbols-outlined text-3xl text-slate-300">add_photo_alternate</span>}
                       <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-[10px] text-white font-black uppercase">Foto</div>
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" onChange={handleFileChange} accept="image/*" />
                 </div>
                 <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-1">
                       <label className="text-[10px] font-black text-slate-400 uppercase px-2">Descrição Completa</label>
                       <input type="text" required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full h-12 bg-white dark:bg-slate-900 border-none rounded-xl px-4 text-sm font-bold uppercase" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-slate-400 uppercase px-2">Código Interno (ID)</label>
                       <input readOnly value={form.id || 'NOVO'} className="w-full h-12 bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 text-sm font-black text-slate-400" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-slate-400 uppercase px-2">UN</label>
                       <input type="text" value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="w-full h-12 bg-white dark:bg-slate-900 border-none rounded-xl px-4 text-sm font-black uppercase" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-slate-400 uppercase px-2">Tipo</label>
                       <input readOnly value="Normal" className="w-full h-12 bg-slate-100 dark:bg-slate-800 border-none rounded-xl px-4 text-sm font-black text-slate-400 uppercase" />
                    </div>
                 </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                 <div className="lg:col-span-5 space-y-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 shadow-sm space-y-4">
                       <h4 className="text-[10px] font-black text-primary uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-3">Estoque</h4>
                       <div className="overflow-hidden rounded-xl border border-slate-100 dark:border-slate-800">
                          <table className="w-full text-left text-[10px]">
                             <thead className="bg-slate-50 dark:bg-slate-800">
                                <tr>
                                   <th className="px-4 py-3 font-black uppercase text-slate-400">Setor - Localização principal</th>
                                   <th className="px-4 py-3 font-black uppercase text-slate-400 text-right">Estoque</th>
                                </tr>
                             </thead>
                             <tbody>
                                <tr>
                                   <td className="px-4 py-3 font-bold uppercase text-slate-600 dark:text-slate-300">
                                      <input type="text" value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="w-full bg-transparent border-none p-0 text-[10px] focus:ring-0 uppercase" placeholder="GERAL" />
                                   </td>
                                   <td className="px-4 py-3 font-black text-right tabular-nums">
                                      <input type="number" value={form.stock} onChange={e => setForm({...form, stock: parseInt(e.target.value) || 0})} className="w-20 bg-transparent border-none p-0 text-right text-[10px] font-black focus:ring-0" />
                                   </td>
                                </tr>
                             </tbody>
                          </table>
                       </div>
                       <div className="grid grid-cols-2 gap-4 pt-2">
                          <div className="space-y-1">
                             <label className="text-[9px] font-black text-slate-400 uppercase px-2">Estoque Mínimo</label>
                             <input type="number" value={form.minStock} onChange={e => setForm({...form, minStock: parseInt(e.target.value) || 0})} className="w-full h-10 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 text-xs font-black" />
                          </div>
                          <div className="space-y-1">
                             <label className="text-[9px] font-black text-slate-400 uppercase px-2">Estoque Total</label>
                             <div className="w-full h-10 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 text-xs font-black flex items-center justify-end text-slate-500">{form.stock}</div>
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="lg:col-span-4 space-y-6">
                    <div className="bg-white dark:bg-slate-900 p-6 rounded-[2.5rem] border-2 border-primary/20 shadow-lg space-y-6">
                       <h4 className="text-[10px] font-black text-primary uppercase tracking-widest border-b border-slate-100 dark:border-slate-800 pb-3">Cálculo do Preço de Venda</h4>
                       <div className="space-y-4">
                          <div className="flex items-center justify-between">
                             <label className="text-[10px] font-black text-slate-500 uppercase">Preço Custo R$</label>
                             <input type="number" step="0.01" value={form.costPrice} onChange={e => handlePriceChange('costPrice', parseFloat(e.target.value) || 0)} className="w-32 h-10 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 text-right font-black tabular-nums text-rose-500" />
                          </div>
                          <div className="flex items-center justify-between">
                             <label className="text-[10px] font-black text-slate-500 uppercase">Margem %</label>
                             <input type="number" step="0.01" value={form.marginPercent} onChange={e => handlePriceChange('marginPercent', parseFloat(e.target.value) || 0)} className="w-32 h-10 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 text-right font-black tabular-nums text-amber-500" />
                          </div>
                          <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-800">
                             <label className="text-[10px] font-black text-primary uppercase">Preço Venda R$</label>
                             <input type="number" step="0.01" value={form.salePrice} onChange={e => handlePriceChange('salePrice', parseFloat(e.target.value) || 0)} className="w-40 h-12 bg-primary/10 border-2 border-primary/20 rounded-xl px-4 text-right font-black text-lg text-primary tabular-nums" />
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="lg:col-span-3 space-y-6">
                    <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 space-y-4">
                       <div className="space-y-1">
                          <label className="text-[10px] font-black text-slate-400 uppercase px-2">Código de Barras</label>
                          <input type="text" value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} className="w-full h-12 bg-white dark:bg-slate-900 border-none rounded-xl px-4 text-sm font-mono font-black" />
                       </div>
                    </div>
                 </div>
              </div>

              <div className="pt-6 border-t border-slate-100 dark:border-slate-800 flex justify-end gap-4">
                 <button type="button" onClick={() => setShowProductModal(false)} className="px-10 py-5 bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-[2rem] font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">Cancelar</button>
                 <button type="submit" className="px-12 py-5 rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-2xl transition-all active:scale-95 text-white bg-primary shadow-primary/20">
                    {editingId ? 'Salvar Alterações' : 'Confirmar e Efetivar Cadastro'}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}
      <style>{`.custom-scrollbar::-webkit-scrollbar { width: 4px; } .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; }`}</style>
    </div>
  );
};

export default Inventory;
