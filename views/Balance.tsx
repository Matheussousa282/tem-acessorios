
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../AppContext';
import { Product } from '../types';

interface Batch {
  id: string;
  name: string;
  items: Record<string, number>;
  timestamp: string;
}

const STORAGE_KEY = 'erp_retail_balance_v1';

const Balance: React.FC = () => {
  const { products, bulkUpdateStock } = useApp();
  
  // Estados de Sessão
  const [sessionActive, setSessionActive] = useState(false);
  const [batches, setBatches] = useState<Batch[]>([]);
  
  // Estados do Lote Atual
  const [currentBatchName, setCurrentBatchName] = useState('');
  const [currentBatchItems, setCurrentBatchItems] = useState<Record<string, number>>({});
  const [isScanning, setIsScanning] = useState(false);
  
  // Estados de UI
  const [scannerValue, setScannerValue] = useState('');
  const [viewingBatchId, setViewingBatchId] = useState<string | null>(null);
  const scannerRef = useRef<HTMLInputElement>(null);

  // 1. Efeito para carregar dados salvos ao iniciar
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setBatches(parsed.batches || []);
        setCurrentBatchItems(parsed.currentBatchItems || {});
        setCurrentBatchName(parsed.currentBatchName || '');
        setSessionActive(parsed.sessionActive || false);
        if (parsed.sessionActive && parsed.currentBatchName) setIsScanning(true);
      } catch (e) {
        console.error("Erro ao recuperar sessão salva", e);
      }
    }
  }, []);

  // 2. Efeito para persistir dados a cada mudança
  useEffect(() => {
    const dataToSave = {
      batches,
      currentBatchItems,
      currentBatchName,
      sessionActive
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
  }, [batches, currentBatchItems, currentBatchName, sessionActive]);

  // Iniciar Balanço Geral
  const handleStartSession = () => {
    setSessionActive(true);
    setBatches([]);
    setCurrentBatchItems({});
    setCurrentBatchName('');
    setIsScanning(false);
  };

  // Abrir novo lote
  const handleOpenBatch = () => {
    if (!currentBatchName.trim()) {
      alert("Por favor, identifique o lote (ex: Caixa 01 ou Corredor A)");
      return;
    }
    setIsScanning(true);
    setTimeout(() => scannerRef.current?.focus(), 100);
  };

  // Bipar item
  const handleScan = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && scannerValue) {
      const product = products.find(p => p.barcode === scannerValue || p.sku === scannerValue);
      if (product) {
        setCurrentBatchItems(prev => ({
          ...prev,
          [product.id]: (prev[product.id] || 0) + 1
        }));
        setScannerValue('');
      } else {
        alert('Produto não localizado!');
        setScannerValue('');
      }
    }
  };

  // Remover um item (ou decrementar) do lote atual
  const handleRemoveItemFromCurrentBatch = (pid: string, all: boolean = false) => {
    setCurrentBatchItems(prev => {
      const newItems = { ...prev };
      if (all || newItems[pid] <= 1) {
        delete newItems[pid];
      } else {
        newItems[pid] -= 1;
      }
      return newItems;
    });
  };

  // Excluir um lote inteiro já gravado
  const handleDeleteBatch = (e: React.MouseEvent, batchId: string) => {
    e.stopPropagation(); // Evita abrir o modal ao clicar em deletar
    if (confirm("Deseja realmente remover este lote gravado? A contagem dele será subtraída do total.")) {
      setBatches(prev => prev.filter(b => b.id !== batchId));
    }
  };

  // Gravar Lote Atual e preparar para o próximo
  const handleSaveBatch = () => {
    if (Object.keys(currentBatchItems).length === 0) {
      alert("Este lote está vazio. Bipe alguns itens antes de gravar.");
      return;
    }

    const newBatch: Batch = {
      id: `batch-${Date.now()}`,
      name: currentBatchName,
      items: { ...currentBatchItems },
      timestamp: new Date().toLocaleTimeString()
    };

    setBatches(prev => [...prev, newBatch]);
    setCurrentBatchItems({});
    setCurrentBatchName('');
    setIsScanning(false);
  };

  // Cálculo de Consolidação (Soma de todos os lotes + lote atual)
  const consolidatedCount = useMemo(() => {
    const total: Record<string, number> = {};
    
    // Soma lotes gravados
    batches.forEach(b => {
      Object.entries(b.items).forEach(([pid, qty]) => {
        // Fix for Error: Operator '+' cannot be applied to types 'number' and 'unknown'.
        total[pid] = (total[pid] || 0) + (qty as number);
      });
    });

    // Soma lote que está sendo bipado agora
    Object.entries(currentBatchItems).forEach(([pid, qty]) => {
      // Fix for Error: Operator '+' cannot be applied to types 'number' and 'unknown'.
      total[pid] = (total[pid] || 0) + (qty as number);
    });

    return total;
  }, [batches, currentBatchItems]);

  // Comparativo Final
  const comparison = useMemo(() => {
    return products.map(p => {
      const counted = consolidatedCount[p.id] || 0;
      const expected = p.stock;
      const diff = counted - expected;
      return {
        ...p,
        expected,
        counted,
        diff,
        status: diff === 0 ? 'OK' : diff > 0 ? 'SOBRA' : 'FALTA'
      };
    }).sort((a, b) => (Math.abs(b.diff) - Math.abs(a.diff)));
  }, [products, consolidatedCount]);

  const stats = useMemo(() => {
    // Fix for Error: Operator '+' cannot be applied to types 'unknown' and 'unknown'.
    const totalCounted = (Object.values(consolidatedCount) as number[]).reduce((a, b) => a + b, 0);
    const divergencies = comparison.filter(c => c.diff !== 0).length;
    return { totalCounted, divergencies };
  }, [consolidatedCount, comparison]);

  // Efetivar no Estoque Real
  const handleFinalizeBalance = () => {
    const msg = `ATENÇÃO: Este processo irá substituir as quantidades atuais do sistema pelas quantidades contadas fisicamente.\n\nTotal de Itens Contados: ${stats.totalCounted}\nDivergências detectadas: ${stats.divergencies}\n\nDeseja confirmar o ajuste de estoque?`;
    
    if (confirm(msg)) {
      const adjustments: Record<string, number> = {};
      products.forEach(p => {
        adjustments[p.id] = consolidatedCount[p.id] || 0;
      });
      
      bulkUpdateStock(adjustments);
      localStorage.removeItem(STORAGE_KEY);
      setSessionActive(false);
      setBatches([]);
      alert("Estoque atualizado com sucesso!");
    }
  };

  // Resetar tudo (Descarte)
  const handleReset = () => {
    if (confirm("Deseja realmente descartar todo o balanço em andamento? Esta ação não pode ser desfeita.")) {
      localStorage.removeItem(STORAGE_KEY);
      setSessionActive(false);
      setBatches([]);
      setCurrentBatchItems({});
      setCurrentBatchName('');
      setIsScanning(false);
    }
  };

  const viewingBatch = useMemo(() => batches.find(b => b.id === viewingBatchId), [batches, viewingBatchId]);

  // UI: Tela Inicial
  if (!sessionActive) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-8 text-center animate-in fade-in duration-700">
        <div className="size-48 bg-primary/10 text-primary rounded-[4rem] flex items-center justify-center mb-10 shadow-2xl shadow-primary/5">
          <span className="material-symbols-outlined text-8xl">inventory</span>
        </div>
        <h2 className="text-5xl font-black text-slate-900 dark:text-white mb-6">Balanço de Estoque</h2>
        <p className="max-w-xl text-slate-500 font-bold text-lg mb-12 leading-relaxed uppercase tracking-wider">
          Auditoria inteligente com persistência offline e <br/> gerenciamento por lotes de conferência.
        </p>
        <button 
          onClick={handleStartSession}
          className="px-12 py-6 bg-primary hover:bg-blue-600 text-white rounded-[2rem] font-black text-xl shadow-2xl shadow-primary/30 transition-all active:scale-95 flex items-center gap-4 group"
        >
          <span className="material-symbols-outlined text-3xl group-hover:rotate-90 transition-transform">add_circle</span>
          INICIAR NOVA SESSÃO
        </button>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in slide-in-from-bottom-6 duration-500 pb-24 relative">
      {/* HEADER DE STATUS */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 bg-white dark:bg-slate-900 p-8 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-xl">
        <div className="flex items-center gap-6">
          <div className="bg-emerald-500 p-5 rounded-3xl text-white shadow-lg shadow-emerald-500/20">
            <span className="material-symbols-outlined text-4xl">check_circle</span>
          </div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter">Balanço em Andamento</h2>
            <p className="text-xs font-black text-slate-400 uppercase tracking-widest mt-1">Dados protegidos pelo armazenamento local</p>
          </div>
        </div>

        <div className="flex items-center gap-8">
           <div className="text-center px-8 border-r border-slate-100 dark:border-slate-800">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Consolidado</p>
              <p className="text-3xl font-black text-primary tabular-nums">{stats.totalCounted} <span className="text-xs">un.</span></p>
           </div>
           <div className="flex gap-3">
              <button onClick={handleFinalizeBalance} className="px-8 py-4 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95">
                <span className="material-symbols-outlined text-xl">verified</span> FINALIZAR E AJUSTAR
              </button>
              <button onClick={handleReset} className="px-6 py-4 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-2xl font-black text-xs uppercase tracking-widest transition-all">
                DESCARTAR
              </button>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* COLUNA ESQUERDA: GESTÃO DE LOTES E BIPAGEM */}
        <div className="lg:col-span-4 space-y-6">
           
           {!isScanning ? (
             <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border-2 border-primary/20 shadow-lg space-y-6">
                <div className="flex items-center gap-3 mb-2">
                   <span className="material-symbols-outlined text-primary">label</span>
                   <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Identificar Novo Lote</h3>
                </div>
                <input 
                  autoFocus
                  value={currentBatchName}
                  onChange={e => setCurrentBatchName(e.target.value)}
                  placeholder="Ex: Caixa 10, Prateleira B..."
                  className="w-full h-16 bg-slate-50 dark:bg-slate-800 border-none rounded-2xl px-6 text-lg font-bold placeholder:text-slate-400 focus:ring-4 focus:ring-primary/10 transition-all"
                />
                <button 
                  onClick={handleOpenBatch}
                  className="w-full py-5 bg-primary hover:bg-blue-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-lg shadow-primary/20 flex items-center justify-center gap-3 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined">barcode_scanner</span>
                  ABRIR ABA DE BIPAR
                </button>
             </div>
           ) : (
             <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border-4 border-primary shadow-2xl space-y-6 animate-in zoom-in-95 duration-300">
                <div className="flex justify-between items-center mb-2">
                   <div className="flex items-center gap-3">
                      <span className="size-3 bg-red-500 rounded-full animate-ping"></span>
                      <h3 className="text-sm font-black text-slate-800 dark:text-white uppercase tracking-widest">Bipando: {currentBatchName}</h3>
                   </div>
                   <button onClick={() => setIsScanning(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                      <span className="material-symbols-outlined">close</span>
                   </button>
                </div>
                <input 
                  ref={scannerRef}
                  autoFocus
                  value={scannerValue}
                  onChange={e => setScannerValue(e.target.value)}
                  onKeyDown={handleScan}
                  placeholder="BIPE O CÓDIGO AQUI"
                  className="w-full h-20 bg-primary/5 border-2 border-primary/20 rounded-3xl px-6 text-3xl font-black text-center text-primary placeholder:text-primary/20 focus:ring-0 outline-none"
                />
                <div className="flex flex-col gap-2 max-h-60 overflow-y-auto custom-scrollbar pr-2">
                   {Object.entries(currentBatchItems).reverse().map(([pid, qty]) => {
                     const p = products.find(x => x.id === pid);
                     return (
                       <div key={pid} className="group/item flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-100 dark:border-slate-700 animate-in slide-in-from-right-4">
                          <div className="flex flex-col min-w-0">
                             <span className="text-xs font-black truncate text-slate-700 dark:text-slate-200 uppercase">{p?.name}</span>
                             <span className="text-[9px] font-mono text-slate-400">{p?.sku}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                             <button 
                               onClick={() => handleRemoveItemFromCurrentBatch(pid)}
                               className="size-7 bg-rose-500/10 text-rose-500 rounded-lg hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
                               title="Subtrair 1"
                             >
                               <span className="material-symbols-outlined text-base">remove</span>
                             </button>
                             <span className="text-sm font-black text-primary w-6 text-center tabular-nums">{qty}x</span>
                             <button 
                               onClick={() => handleRemoveItemFromCurrentBatch(pid, true)}
                               className="size-7 bg-slate-200 dark:bg-slate-700 text-slate-400 rounded-lg hover:bg-rose-600 hover:text-white transition-all flex items-center justify-center"
                               title="Excluir item deste lote"
                             >
                               <span className="material-symbols-outlined text-base">delete</span>
                             </button>
                          </div>
                       </div>
                     );
                   })}
                </div>
                <button 
                  onClick={handleSaveBatch}
                  className="w-full py-5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-2xl font-black text-sm uppercase tracking-widest shadow-xl flex items-center justify-center gap-3 transition-all active:scale-95"
                >
                  <span className="material-symbols-outlined">save</span>
                  GRAVAR LOTE
                </button>
             </div>
           )}

           {/* LISTA DE LOTES JÁ GRAVADOS */}
           <div className="bg-white dark:bg-slate-900 p-8 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 space-y-6 shadow-sm">
              <div className="flex items-center justify-between">
                 <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Lotes Consolidados ({batches.length})</h3>
                 <span className="material-symbols-outlined text-slate-300">layers</span>
              </div>
              <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar pr-2">
                 {batches.length > 0 ? [...batches].reverse().map(b => (
                   <div 
                    key={b.id} 
                    onClick={() => setViewingBatchId(b.id)}
                    className="group/batch p-4 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-transparent hover:border-primary/50 hover:bg-primary/5 transition-all flex justify-between items-center cursor-pointer"
                   >
                      <div className="min-w-0">
                         <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-black text-slate-800 dark:text-white uppercase truncate">{b.name}</span>
                            <span className="material-symbols-outlined text-xs text-primary opacity-0 group-hover/batch:opacity-100 transition-opacity">visibility</span>
                         </div>
                         <p className="text-[10px] font-bold text-primary uppercase">
                           {/* Fix for Error: Operator '+' cannot be applied to types 'unknown' and 'unknown'. */}
                           {(Object.values(b.items) as number[]).reduce((a,b) => a+b, 0)} itens • {b.timestamp}
                         </p>
                      </div>
                      <button 
                        onClick={(e) => handleDeleteBatch(e, b.id)}
                        className="size-10 bg-rose-500/10 text-rose-500 rounded-xl opacity-0 group-hover/batch:opacity-100 hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center shrink-0"
                        title="Remover este lote inteiro"
                      >
                         <span className="material-symbols-outlined text-lg">delete_forever</span>
                      </button>
                   </div>
                 )) : (
                   <div className="text-center py-10 opacity-20 uppercase font-black text-[10px] tracking-widest">Nenhum lote gravado</div>
                 )}
              </div>
           </div>
        </div>

        {/* COLUNA DIREITA: TABELA COMPARATIVA GERAL */}
        <div className="lg:col-span-8">
           <div className="bg-white dark:bg-slate-900 rounded-[3rem] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden flex flex-col h-[750px]">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-800/20 flex justify-between items-center">
                 <div>
                    <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tight">Comparativo de Divergências</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-1">Visão Geral: Sistema vs Realidade Física</p>
                 </div>
                 <div className="flex gap-4">
                    <div className="flex items-center gap-2 bg-rose-500/10 px-3 py-1.5 rounded-full">
                       <span className="size-2 bg-rose-500 rounded-full"></span>
                       <span className="text-[10px] font-black text-rose-600 uppercase">Perdas: {comparison.filter(c => c.diff < 0).length}</span>
                    </div>
                    <div className="flex items-center gap-2 bg-amber-500/10 px-3 py-1.5 rounded-full">
                       <span className="size-2 bg-amber-500 rounded-full"></span>
                       <span className="text-[10px] font-black text-amber-600 uppercase">Sobras: {comparison.filter(c => c.diff > 0).length}</span>
                    </div>
                 </div>
              </div>
              
              <div className="flex-1 overflow-y-auto custom-scrollbar">
                 <table className="w-full text-left">
                    <thead className="sticky top-0 bg-white dark:bg-slate-900 z-20 shadow-sm">
                       <tr className="border-b border-slate-100 dark:border-slate-800">
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest">Produto / SKU</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">No Sistema</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Físico Total</th>
                          <th className="px-8 py-5 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Diferença</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                       {comparison.map(item => (
                         <tr key={item.id} className={`group hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-all ${item.diff !== 0 ? 'bg-slate-50/30' : ''}`}>
                            <td className="px-8 py-5">
                               <div className="flex items-center gap-4">
                                  <div className="size-12 rounded-2xl bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 overflow-hidden shrink-0 shadow-sm group-hover:scale-110 transition-transform">
                                     <img src={item.image} className="w-full h-full object-cover" />
                                  </div>
                                  <div>
                                     <p className="text-xs font-black text-slate-800 dark:text-white uppercase leading-tight mb-1">{item.name}</p>
                                     <div className="flex gap-2">
                                        <span className="text-[9px] font-mono text-primary font-bold uppercase tracking-tighter">{item.sku}</span>
                                        <span className="text-[9px] text-slate-400 font-bold uppercase">{item.category}</span>
                                     </div>
                                  </div>
                               </div>
                            </td>
                            <td className="px-8 py-5 text-center text-sm font-bold text-slate-400 tabular-nums">
                               {item.expected}
                            </td>
                            <td className="px-8 py-5 text-center">
                               <span className={`text-lg font-black tabular-nums ${item.counted > 0 ? 'text-primary' : 'text-slate-200 dark:text-slate-800'}`}>
                                  {item.counted}
                               </span>
                            </td>
                            <td className="px-8 py-5 text-right">
                               <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-xs font-black tabular-nums shadow-sm ${
                                  item.status === 'OK' ? 'bg-emerald-500/10 text-emerald-500' :
                                  item.status === 'SOBRA' ? 'bg-amber-500/10 text-amber-500' : 'bg-rose-500/10 text-rose-500'
                               }`}>
                                  {item.diff > 0 ? `+${item.diff}` : item.diff}
                                  <span className="material-symbols-outlined text-[16px]">
                                     {item.status === 'OK' ? 'verified' : item.status === 'SOBRA' ? 'keyboard_double_arrow_up' : 'keyboard_double_arrow_down'}
                                  </span>
                               </div>
                            </td>
                         </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      </div>

      {/* MODAL DE VISUALIZAÇÃO DE LOTE */}
      {viewingBatch && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in duration-300">
           <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-8 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                 <div className="flex items-center gap-4">
                    <div className="size-14 bg-primary text-white rounded-[1.5rem] flex items-center justify-center shadow-lg shadow-primary/20">
                      <span className="material-symbols-outlined text-3xl">list_alt</span>
                    </div>
                    <div>
                      <h3 className="text-2xl font-black tracking-tight text-slate-900 dark:text-white uppercase">Conferência de Lote</h3>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{viewingBatch.name} • {viewingBatch.timestamp}</p>
                    </div>
                 </div>
                 <button onClick={() => setViewingBatchId(null)} className="size-12 hover:bg-rose-500 hover:text-white rounded-[1.25rem] flex items-center justify-center transition-all bg-white dark:bg-slate-800 shadow-sm border border-slate-100 dark:border-slate-700">
                    <span className="material-symbols-outlined">close</span>
                 </button>
              </div>

              <div className="p-8 max-h-[500px] overflow-y-auto custom-scrollbar">
                 <div className="space-y-4">
                    {Object.entries(viewingBatch.items).map(([pid, qty]) => {
                      const p = products.find(x => x.id === pid);
                      return (
                        <div key={pid} className="flex items-center justify-between p-4 bg-slate-50 dark:bg-slate-800/40 rounded-2xl border border-slate-100 dark:border-slate-700">
                           <div className="flex items-center gap-4 min-w-0">
                              <img src={p?.image} className="size-12 rounded-xl object-cover shrink-0" />
                              <div className="min-w-0">
                                 <p className="text-xs font-black text-slate-800 dark:text-white uppercase truncate">{p?.name}</p>
                                 <p className="text-[9px] font-mono text-slate-400 tracking-tighter uppercase">{p?.sku} • {p?.category}</p>
                              </div>
                           </div>
                           <div className="flex flex-col items-end shrink-0 pl-4">
                              <span className="text-xs font-black text-slate-400 uppercase leading-none mb-1">Qtd Contada</span>
                              <span className="text-xl font-black text-primary tabular-nums">{qty} un.</span>
                           </div>
                        </div>
                      );
                    })}
                 </div>
              </div>
              
              <div className="p-8 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-100 dark:border-slate-800 flex justify-between items-center">
                 <div className="flex flex-col">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Resumo do Lote</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">
                      {Object.keys(viewingBatch.items).length} Produtos Diferentes
                    </span>
                 </div>
                 <button 
                  onClick={() => setViewingBatchId(null)}
                  className="px-8 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-black text-xs uppercase tracking-widest hover:scale-[1.02] active:scale-95 transition-all shadow-xl"
                 >
                   FECHAR CONFERÊNCIA
                 </button>
              </div>
           </div>
        </div>
      )}

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
      `}</style>
    </div>
  );
};

export default Balance;
