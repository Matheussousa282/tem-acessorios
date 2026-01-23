
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../AppContext';
import { Product, UserRole } from '../types';

const Inventory: React.FC = () => {
  const { products, addProduct, deleteProduct, currentUser, establishments, refreshData } = useApp();
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'PRODUCT' | 'SERVICE'>('ALL');

  const [showProductModal, setShowProductModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const initialForm: Partial<Product> = {
    name: '', sku: '', barcode: '', category: 'Geral', brand: '', costPrice: 0, salePrice: 0, stock: 0, unit: 'UN', location: '', image: '', isService: false,
    minStock: 0, otherCostsPercent: 0, marginPercent: 0, maxDiscountPercent: 0, commissionPercent: 0, conversionFactor: 1, weight: '0'
  };

  const [form, setForm] = useState<Partial<Product>>(initialForm);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const currentStore = useMemo(() => establishments.find(e => e.id === currentUser?.storeId), [establishments, currentUser]);
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
        if (totalCost > 0) next.marginPercent = Number(((value / totalCost - 1) * 100).toFixed(2));
      } else {
        const margin = Number(next.marginPercent) || 0;
        next.salePrice = Number((cost * (1 + others / 100) * (1 + margin / 100)).toFixed(2));
      }
      return next;
    });
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    
    // Sanitização rigorosa para evitar erro no Banco Neon (SQL)
    const productData: Product = {
      id: editingId || `prod-${Date.now()}`,
      name: String(form.name || '').toUpperCase(),
      sku: String(form.sku || `SKU-${Date.now()}`).toUpperCase(),
      barcode: String(form.barcode || ''),
      category: String(form.category || 'Geral'),
      costPrice: Number(form.costPrice) || 0,
      salePrice: Number(form.salePrice) || 0,
      stock: form.isService ? 999999 : (Number(form.stock) || 0),
      image: form.image || `https://picsum.photos/seed/${form.sku}/400/400`,
      brand: String(form.brand || ''),
      unit: String(form.unit || 'UN'),
      location: String(form.location || 'GERAL'),
      isService: !!form.isService,
      minStock: Number(form.minStock) || 0,
      otherCostsPercent: Number(form.otherCostsPercent) || 0,
      marginPercent: Number(form.marginPercent) || 0,
      maxDiscountPercent: Number(form.maxDiscountPercent) || 0,
      commissionPercent: Number(form.commissionPercent) || 0,
      conversionFactor: Number(form.conversionFactor) || 1,
      weight: String(form.weight || '0')
    };
    
    try {
      await addProduct(productData);
      await refreshData();
      setShowProductModal(false);
      setEditingId(null);
      setForm(initialForm);
    } catch (err) {
      alert("Erro ao gravar no banco de dados. Verifique os campos.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500 pb-24">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Inventário & Catálogo</h2>
          <p className="text-slate-500 text-sm mt-1 font-bold uppercase tracking-tight">Controle central de ativos e mercadorias</p>
        </div>
        <button onClick={() => { setEditingId(null); setForm(initialForm); setShowProductModal(true); }} className="flex items-center gap-2 bg-primary text-white px-10 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all">
          <span className="material-symbols-outlined text-lg">add_shopping_cart</span> Novo Cadastro
        </button>
      </div>

      <div className="bg-white dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 shadow-sm flex flex-wrap gap-4 items-center">
        <div className="flex-1 min-w-[250px] relative group">
          <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">search</span>
          <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Bipar código ou digitar nome..." className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-12 text-sm font-bold focus:ring-2 focus:ring-primary/20" />
        </div>
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
           {(['ALL', 'PRODUCT', 'SERVICE'] as const).map(t => (
             <button key={t} onClick={() => setTypeFilter(t)} className={`px-4 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${typeFilter === t ? 'bg-white dark:bg-slate-700 text-primary shadow-sm' : 'text-slate-400'}`}>
               {t === 'ALL' ? 'Tudo' : t === 'PRODUCT' ? 'Produtos' : 'Serviços'}
             </button>
           ))}
        </div>
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-6 text-[10px] font-black uppercase">
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>
      
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[2.5rem] overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800">
              <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400">Item</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400">Referências</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 text-right">Financeiro</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 text-center">Estoque</th>
              <th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 text-right">Ações</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredProducts.map(p => (
              <tr key={p.id} className="group hover:bg-slate-50 dark:hover:bg-slate-800/20 transition-all">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <img src={p.image} className="size-14 rounded-2xl object-cover shadow-inner" alt={p.name} />
                    <div><p className="text-sm font-black text-slate-900 dark:text-white uppercase truncate max-w-[200px]">{p.name}</p><p className="text-[9px] text-slate-400 font-black uppercase">{p.brand || 'Marca N/I'}</p></div>
                  </div>
                </td>
                <td className="px-8 py-6"><p className="text-[10px] font-mono font-black text-primary uppercase">SKU: {p.sku}</p><p className="text-[10px] font-mono font-bold text-slate-400">{p.barcode || 'S/ BARRAS'}</p></td>
                <td className="px-8 py-6 text-right"><p className="text-sm font-black text-primary tabular-nums">R$ {p.salePrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p><p className="text-[9px] font-black text-slate-400 uppercase">Custo: R$ {p.costPrice.toLocaleString('pt-BR')}</p></td>
                <td className="px-8 py-6 text-center">
                  {p.isService ? <span className="text-[10px] font-black text-amber-500 uppercase bg-amber-500/10 px-4 py-2 rounded-xl">Virtual</span> : <div className="flex flex-col items-center"><span className={`text-sm font-black tabular-nums ${p.stock <= (p.minStock || 0) ? 'text-rose-500' : 'text-slate-600 dark:text-slate-300'}`}>{p.stock}</span><span className="text-[9px] font-black text-slate-400 uppercase">{p.unit}</span></div>}
                </td>
                <td className="px-8 py-6 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => { setEditingId(p.id); setForm(p); setShowProductModal(true); }} className="size-10 bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-primary rounded-xl transition-all shadow-sm"><span className="material-symbols-outlined text-lg">edit</span></button>
                    <button onClick={() => { if(confirm('Excluir item?')) deleteProduct(p.id)}} className="size-10 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl transition-all"><span className="material-symbols-outlined text-lg">delete</span></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in">
          <div className="bg-white dark:bg-slate-900 w-full max-w-6xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 flex flex-col max-h-[95vh]">
            <div className="p-6 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center text-white bg-primary">
              <h3 className="text-xl font-black uppercase">{editingId ? 'Editar Produto' : 'Novo Registro de Mercadoria'}</h3>
              <button onClick={() => setShowProductModal(false)}><span className="material-symbols-outlined">close</span></button>
            </div>
            <form onSubmit={handleSaveProduct} className="flex-1 overflow-y-auto p-8 space-y-8">
              <div className="bg-slate-50 dark:bg-slate-800/50 p-6 rounded-[2rem] grid grid-cols-1 md:grid-cols-4 gap-6 items-center border border-slate-200">
                 <div className="md:col-span-1 flex flex-col items-center">
                    <div className="size-32 bg-white dark:bg-slate-800 rounded-3xl border-2 border-dashed border-slate-200 flex items-center justify-center overflow-hidden cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                       {form.image ? <img src={form.image} className="size-full object-cover" /> : <span className="material-symbols-outlined text-3xl text-slate-300">add_a_photo</span>}
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => {
                       const f = e.target.files?.[0];
                       if(f){ const r = new FileReader(); r.onloadend = () => setForm({...form, image: r.result as string}); r.readAsDataURL(f); }
                    }} />
                 </div>
                 <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="md:col-span-2 space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Descrição do Produto</label><input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full h-12 bg-white dark:bg-slate-900 border-none rounded-xl px-4 text-sm font-bold uppercase" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Tipo</label><select value={form.isService ? 'true' : 'false'} onChange={e => setForm({...form, isService: e.target.value === 'true'})} className="w-full h-12 bg-white dark:bg-slate-900 border-none rounded-xl px-4 text-sm font-bold uppercase"><option value="false">Produto Físico</option><option value="true">Mão de Obra / Serviço</option></select></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Categoria</label><input value={form.category} onChange={e => setForm({...form, category: e.target.value})} className="w-full h-12 bg-white dark:bg-slate-900 border-none rounded-xl px-4 text-sm font-black uppercase" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">SKU / Referência</label><input required value={form.sku} onChange={e => setForm({...form, sku: e.target.value})} className="w-full h-12 bg-white dark:bg-slate-900 border-none rounded-xl px-4 text-sm font-black uppercase" /></div>
                    <div className="space-y-1"><label className="text-[10px] font-black text-slate-400 uppercase">Código de Barras</label><input value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} className="w-full h-12 bg-white dark:bg-slate-900 border-none rounded-xl px-4 text-sm font-mono font-black" /></div>
                 </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border-2 border-primary/20 space-y-4">
                    <h4 className="text-[10px] font-black text-primary uppercase border-b pb-2">Precificação</h4>
                    <div className="flex justify-between items-center"><span className="text-xs font-bold uppercase">Preço de Custo</span><input type="number" step="0.01" value={form.costPrice} onChange={e => handlePriceChange('costPrice', parseFloat(e.target.value) || 0)} className="w-24 h-10 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-right font-black text-rose-500" /></div>
                    <div className="flex justify-between items-center"><span className="text-xs font-bold uppercase">Margem Lucro %</span><input type="number" step="0.1" value={form.marginPercent} onChange={e => handlePriceChange('marginPercent', parseFloat(e.target.value) || 0)} className="w-24 h-10 bg-slate-50 dark:bg-slate-800 border-none rounded-lg text-right font-black text-amber-500" /></div>
                    <div className="flex justify-between items-center pt-2 border-t"><span className="text-xs font-black uppercase text-primary">Preço Venda Final</span><input type="number" step="0.01" value={form.salePrice} onChange={e => handlePriceChange('salePrice', parseFloat(e.target.value) || 0)} className="w-32 h-12 bg-primary/5 border-2 border-primary/20 rounded-xl text-right font-black text-lg text-primary" /></div>
                 </div>
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase border-b pb-2">Estoque</h4>
                    <div className="flex justify-between items-center"><span className="text-xs font-bold uppercase">Estoque Atual</span><input disabled={form.isService} type="number" value={form.stock} onChange={e => setForm({...form, stock: parseInt(e.target.value) || 0})} className="w-24 h-10 bg-slate-50 border-none rounded-lg text-right font-black" /></div>
                    <div className="flex justify-between items-center"><span className="text-xs font-bold uppercase">Mínimo Crítico</span><input disabled={form.isService} type="number" value={form.minStock} onChange={e => setForm({...form, minStock: parseInt(e.target.value) || 0})} className="w-24 h-10 bg-slate-50 border-none rounded-lg text-right font-black" /></div>
                 </div>
                 <div className="bg-white dark:bg-slate-900 p-6 rounded-[2rem] border border-slate-200 space-y-4">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase border-b pb-2">Logística</h4>
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400">Marca / Fabricante</label><input value={form.brand} onChange={e => setForm({...form, brand: e.target.value})} className="w-full h-10 bg-slate-50 rounded-lg px-3 text-xs uppercase" /></div>
                    <div className="space-y-1"><label className="text-[9px] font-black uppercase text-slate-400">Localização Física</label><input value={form.location} onChange={e => setForm({...form, location: e.target.value})} className="w-full h-10 bg-slate-50 rounded-lg px-3 text-xs uppercase" /></div>
                 </div>
              </div>

              <div className="pt-6 border-t flex justify-end gap-4">
                 <button type="button" onClick={() => setShowProductModal(false)} className="px-10 py-5 bg-slate-100 rounded-[2rem] font-black text-xs uppercase">Cancelar</button>
                 <button type="submit" disabled={isSaving} className="px-12 py-5 bg-primary text-white rounded-[2rem] font-black text-xs uppercase shadow-xl flex items-center gap-2">
                    {isSaving ? <span className="material-symbols-outlined animate-spin">sync</span> : null}
                    {editingId ? 'Salvar Alterações' : 'Concluir Cadastro'}
                 </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Inventory;
