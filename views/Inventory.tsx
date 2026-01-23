
import React, { useState, useMemo, useRef } from 'react';
import { useApp } from '../AppContext';
import { Product } from '../types';

const Inventory: React.FC = () => {
  const { products, addProduct, deleteProduct, currentUser, establishments, refreshData } = useApp();
  const [filter, setFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('Todas');
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
    setIsSaving(true);
    const productData: Product = {
      id: editingId || `prod-${Date.now()}`,
      name: String(form.name || '').toUpperCase(),
      sku: String(form.sku || '').toUpperCase() || `SKU-${Date.now()}`,
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
    <div className="p-8 space-y-6 animate-in fade-in duration-500 pb-24">
      <div className="flex justify-between items-center">
        <h2 className="text-3xl font-black uppercase tracking-tight">Estoque & Produtos</h2>
        <button onClick={() => { setEditingId(null); setForm(initialForm); setShowProductModal(true); }} className="bg-primary text-white px-8 py-4 rounded-2xl font-black text-xs uppercase shadow-xl hover:scale-105 transition-all">Novo Produto</button>
      </div>

      <div className="bg-white dark:bg-slate-900/50 p-6 rounded-[2rem] border border-slate-200 dark:border-slate-800 flex gap-4">
        <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="Pesquisar..." className="flex-1 h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 text-sm font-bold uppercase" />
        <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-6 text-[10px] font-black uppercase">
          {categories.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 dark:bg-slate-800/50 border-b"><th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400">Produto</th><th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 text-center">Estoque</th><th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 text-right">Venda</th><th className="px-8 py-6 text-[10px] font-black uppercase text-slate-400 text-right">Ações</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
            {filteredProducts.map(p => (
              <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/20">
                <td className="px-8 py-6">
                  <div className="flex items-center gap-4">
                    <img src={p.image} className="size-12 rounded-xl object-cover" alt="" />
                    <div><p className="text-sm font-black uppercase">{p.name}</p><p className="text-[9px] text-slate-400 font-black">SKU: {p.sku}</p></div>
                  </div>
                </td>
                <td className="px-8 py-6 text-center font-black text-sm">{p.stock} {p.unit}</td>
                <td className="px-8 py-6 text-right font-black text-primary">R$ {p.salePrice.toLocaleString('pt-BR')}</td>
                <td className="px-8 py-6 text-right">
                  <button onClick={() => { setEditingId(p.id); setForm(p); setShowProductModal(true); }} className="size-10 bg-slate-100 dark:bg-slate-800 rounded-xl"><span className="material-symbols-outlined text-lg">edit</span></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showProductModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-[#101822] w-full max-w-5xl rounded-[3rem] shadow-2xl overflow-hidden border border-slate-800 animate-in zoom-in-95">
            {/* HEADER IGUAL À IMAGEM */}
            <div className="p-6 bg-primary flex justify-between items-center text-white">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-3xl">inventory_2</span>
                <h3 className="text-xl font-black uppercase tracking-tight">{editingId ? 'EDITAR PRODUTO' : 'NOVO PRODUTO MERCADORIA'}</h3>
              </div>
              <button onClick={() => setShowProductModal(false)} className="hover:rotate-90 transition-transform"><span className="material-symbols-outlined text-3xl">close</span></button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-10 space-y-10">
              {/* SEÇÃO PRINCIPAL */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                 <div className="md:col-span-1">
                    <div onClick={() => fileInputRef.current?.click()} className="aspect-square bg-slate-800/50 rounded-[2.5rem] border-2 border-dashed border-slate-700 flex items-center justify-center cursor-pointer overflow-hidden group">
                       {form.image ? <img src={form.image} className="size-full object-cover" /> : <span className="material-symbols-outlined text-5xl text-slate-600 group-hover:scale-110 transition-transform">add_a_photo</span>}
                    </div>
                    <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={e => {
                       const f = e.target.files?.[0];
                       if(f){ const r = new FileReader(); r.onloadend = () => setForm({...form, image: r.result as string}); r.readAsDataURL(f); }
                    }} />
                 </div>
                 
                 <div className="md:col-span-3 grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="md:col-span-2 space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Descrição Completa</label>
                       <input required value={form.name} onChange={e => setForm({...form, name: e.target.value})} className="w-full h-14 bg-slate-800/40 border border-slate-700 rounded-2xl px-6 text-sm font-bold text-white uppercase focus:ring-2 focus:ring-primary outline-none" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">UN</label>
                       <input value={form.unit} onChange={e => setForm({...form, unit: e.target.value})} className="w-full h-14 bg-slate-800/40 border border-slate-700 rounded-2xl px-6 text-sm font-bold text-white uppercase" />
                    </div>
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-2">Tipo</label>
                       <select value={form.isService ? 'true' : 'false'} onChange={e => setForm({...form, isService: e.target.value === 'true'})} className="w-full h-14 bg-slate-800/40 border border-slate-700 rounded-2xl px-6 text-sm font-bold text-white uppercase">
                          <option value="false">NORMAL</option>
                          <option value="true">SERVIÇO / VIRTUAL</option>
                       </select>
                    </div>
                 </div>
              </div>

              {/* SEÇÕES INFERIORES */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                 {/* ESTOQUE */}
                 <div className="bg-slate-800/20 p-8 rounded-[3rem] border border-slate-800 space-y-6">
                    <h4 className="text-[10px] font-black text-primary uppercase tracking-widest border-b border-slate-800 pb-3">Estoque</h4>
                    <div className="space-y-4">
                       <div className="flex justify-between items-center text-[10px] font-black text-slate-500 uppercase"><span>Setor / Localização Principal</span><span>Estoque</span></div>
                       <div className="flex justify-between items-center border-b border-slate-800 pb-2"><span className="text-xs font-bold uppercase text-slate-300">GERAL</span><span className="text-sm font-black text-white">{form.stock}</span></div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-1"><label className="text-[8px] font-black uppercase text-slate-500">Mínimo</label><input type="number" value={form.minStock} onChange={e => setForm({...form, minStock: Number(e.target.value)})} className="w-full h-10 bg-slate-800 border-none rounded-xl px-4 text-white font-black" /></div>
                       <div className="space-y-1"><label className="text-[8px] font-black uppercase text-slate-500">Total</label><input type="number" value={form.stock} onChange={e => setForm({...form, stock: Number(e.target.value)})} className="w-full h-10 bg-slate-800 border-none rounded-xl px-4 text-white font-black" /></div>
                    </div>
                 </div>

                 {/* CÁLCULO PREÇO */}
                 <div className="bg-slate-800/20 p-8 rounded-[3rem] border border-slate-800 space-y-6">
                    <h4 className="text-[10px] font-black text-primary uppercase tracking-widest border-b border-slate-800 pb-3">Cálculo do Preço de Venda</h4>
                    <div className="space-y-4">
                       <div className="flex justify-between items-center"><label className="text-[10px] font-black text-slate-400 uppercase">Preço Custo R$</label><input type="number" step="0.01" value={form.costPrice} onChange={e => handlePriceChange('costPrice', parseFloat(e.target.value) || 0)} className="w-24 h-10 bg-slate-800 rounded-xl border-none text-right font-black text-rose-500" /></div>
                       <div className="flex justify-between items-center"><label className="text-[10px] font-black text-slate-400 uppercase">Margem %</label><input type="number" step="0.1" value={form.marginPercent} onChange={e => handlePriceChange('marginPercent', parseFloat(e.target.value) || 0)} className="w-24 h-10 bg-slate-800 rounded-xl border-none text-right font-black text-amber-500" /></div>
                    </div>
                    <div className="pt-4 border-t border-slate-800 flex justify-between items-center">
                       <span className="text-[10px] font-black text-primary uppercase">Preço Venda R$</span>
                       <input type="number" step="0.01" value={form.salePrice} onChange={e => handlePriceChange('salePrice', parseFloat(e.target.value) || 0)} className="w-32 h-12 bg-primary/10 rounded-xl border border-primary/20 text-right font-black text-lg text-primary" />
                    </div>
                 </div>

                 {/* BARRAS */}
                 <div className="bg-slate-800/20 p-8 rounded-[3rem] border border-slate-800 space-y-6">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-800 pb-3">Código de Barras</h4>
                    <input value={form.barcode} onChange={e => setForm({...form, barcode: e.target.value})} placeholder="EAN13 / SKU" className="w-full h-14 bg-slate-800 rounded-2xl border-none text-white font-mono text-center text-lg font-black" />
                 </div>
              </div>

              <div className="pt-10 flex justify-end gap-4 border-t border-slate-800">
                 <button type="button" onClick={() => setShowProductModal(false)} className="px-12 py-5 bg-slate-800/50 text-slate-400 rounded-full font-black text-xs uppercase hover:bg-slate-800 transition-all">CANCELAR</button>
                 <button type="submit" disabled={isSaving} className="px-16 py-5 bg-primary text-white rounded-full font-black text-xs uppercase shadow-2xl hover:scale-105 active:scale-95 transition-all flex items-center gap-3">
                    {isSaving && <span className="material-symbols-outlined animate-spin text-sm">sync</span>}
                    CONFIRMAR E EFETIVAR CADASTRO
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
