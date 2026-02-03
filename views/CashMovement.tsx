
import React, { useState, useMemo, useEffect } from 'react';
import { useApp, CashEntry } from '../AppContext';
import { CashSession, CashSessionStatus, UserRole } from '../types';
import { useNavigate } from 'react-router-dom';

const CashMovement: React.FC = () => {
  const { cashSessions, cashEntries, transactions, establishments, currentUser, saveCashSession, addCashEntry, users, refreshData, cardOperators, cardBrands } = useApp();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('');
  
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  
  const [viewingSession, setViewingSession] = useState<CashSession | null>(null);
  const [activeTab, setActiveTab] = useState<'lançamentos' | 'auditoria'>('lançamentos');

  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState<{show: boolean, type: 'INCOME' | 'EXPENSE' | 'TRANSFER'}>({show: false, type: 'INCOME'});
  
  const [openingValue, setOpeningValue] = useState(0);
  const [selectedRegister, setSelectedRegister] = useState('');
  const [entryForm, setEntryForm] = useState({ description: '', value: 0, category: 'Ajuste Manual' });

  const currentStore = establishments.find(e => e.id === currentUser?.storeId);

  useEffect(() => {
    refreshData();
  }, []);

  useEffect(() => {
    if (showOpeningModal) {
      const lastClosed = [...cashSessions]
        .filter(s => s.storeId === currentUser?.storeId && s.status === CashSessionStatus.CLOSED)
        .sort((a, b) => b.id.localeCompare(a.id))[0];
      
      if (lastClosed) {
        setOpeningValue(lastClosed.closingValue || 0);
      } else {
        setOpeningValue(0);
      }
    }
  }, [showOpeningModal, cashSessions, currentUser]);

  const availableCashiers = useMemo(() => {
    return users.filter(u => (u.role === UserRole.CASHIER || u.role === UserRole.ADMIN || u.role === UserRole.MANAGER) && (isAdmin || u.storeId === currentUser?.storeId));
  }, [users, isAdmin, currentUser]);

  const filteredSessions = useMemo(() => {
    return cashSessions.filter(s => {
      const belongsToStore = isAdmin || s.storeId === currentUser?.storeId;
      const matchesFilter = filter === '' || 
        s.registerName.toLowerCase().includes(filter.toLowerCase()) ||
        s.openingOperatorName?.toLowerCase().includes(filter.toLowerCase());
      return belongsToStore && matchesFilter;
    });
  }, [cashSessions, filter, isAdmin, currentUser]);

  const sessionData = useMemo(() => {
    if (!viewingSession) return null;

    const cleanOpeningTime = viewingSession.openingTime?.replace(',', '').trim() || '';
    const datePart = cleanOpeningTime.split(' ')[0];
    const sessionDateParts = datePart.split('/');
    const sessionDateFormatted = sessionDateParts.length === 3 
      ? `${sessionDateParts[2]}-${sessionDateParts[1]}-${sessionDateParts[0]}` 
      : '';

    const sessionVendas = transactions.filter(t => {
      const matchesStore = t.store === viewingSession.storeName;
      const matchesOperator = t.cashierId === viewingSession.openingOperatorId;
      const isSale = t.type === 'INCOME' && (t.category === 'Venda' || t.category === 'Serviço');
      const matchesDate = t.date === sessionDateFormatted;
      return matchesStore && matchesOperator && isSale && matchesDate;
    });

    const sessionManualEntries = cashEntries.filter(e => e.sessionId === viewingSession.id);

    // Resumo por Operadora/Bandeira para Cartões
    const resumoCartoes: Record<string, { count: number, value: number }> = {};
    sessionVendas.forEach(v => {
       if (v.method === 'Credito' || v.method === 'Debito') {
          const op = cardOperators.find(o => o.id === v.cardOperatorId)?.name || 'OUTRA';
          const br = cardBrands.find(b => b.id === v.cardBrandId)?.name || 'OUTRA';
          const key = `${v.method}: ${op} / ${br}`;
          if (!resumoCartoes[key]) resumoCartoes[key] = { count: 0, value: 0 };
          resumoCartoes[key].count += 1;
          resumoCartoes[key].value += v.value;
       }
    });

    const totalVendasBruto = sessionVendas.reduce((acc, t) => acc + t.value, 0);
    const vendasEmDinheiro = sessionVendas.filter(v => v.method?.toUpperCase() === 'DINHEIRO').reduce((acc, v) => acc + v.value, 0);
    const entradasManuaisDinheiro = sessionManualEntries.filter(e => e.type === 'INCOME').reduce((acc, e) => acc + e.value, 0);
    const saídasDinheiro = sessionManualEntries.filter(e => e.type === 'EXPENSE').reduce((acc, e) => acc + e.value, 0);

    const saldoAnterior = viewingSession.openingValue || 0;
    const totalEntradasCaixa = vendasEmDinheiro + entradasManuaisDinheiro;
    const totalSaidasCaixa = saídasDinheiro;
    const saldoFinalCaixa = saldoAnterior + totalEntradasCaixa - totalSaidasCaixa;

    const allRecords = [
      ...sessionVendas.map(v => ({
        id: v.id,
        type: 'INCOME',
        natureza: 'E',
        description: `Venda PDV`,
        value: v.value,
        timestamp: v.date,
        method: v.method,
        cat: 'VENDA',
        client: v.client || 'Consumidor Final',
        installments: v.installments || 1,
        operator: cardOperators.find(o => o.id === v.cardOperatorId)?.name || '',
        brand: cardBrands.find(b => b.id === v.cardBrandId)?.name || ''
      })),
      ...sessionManualEntries.map(e => ({
        id: e.id,
        type: e.type,
        natureza: e.type === 'INCOME' ? 'E' : e.type === 'EXPENSE' ? 'S' : 'T',
        description: e.description,
        value: e.value,
        timestamp: e.timestamp,
        method: e.method || 'CAIXA',
        cat: e.category,
        client: 'SISTEMA',
        installments: 1,
        operator: '',
        brand: ''
      }))
    ].sort((a, b) => b.id.localeCompare(a.id));

    return { 
      allRecords, 
      saldoAnterior, 
      totalEntradasCaixa, 
      totalSaidasCaixa, 
      saldoFinalCaixa, 
      resumoCartoes, 
      totalVendasBruto,
      vendasEmDinheiro,
      vendasDetalhadas: sessionVendas
    };
  }, [viewingSession, transactions, cashEntries, cardOperators, cardBrands]);

  const handleOpenCash = async (e: React.FormEvent) => {
    e.preventDefault();
    const cashier = users.find(u => u.name === selectedRegister.split(' - ')[1]);
    const newSession: CashSession = {
      id: `${Date.now()}`,
      storeId: currentUser?.storeId || 'matriz',
      storeName: currentStore?.name || 'Matriz',
      registerName: selectedRegister,
      openingTime: new Date().toLocaleString('pt-BR'),
      openingOperatorId: cashier?.id || currentUser?.id,
      openingOperatorName: cashier?.name || currentUser?.name,
      openingValue: openingValue,
      status: CashSessionStatus.OPEN,
      priceTable: 'Tabela Padrão'
    };
    await saveCashSession(newSession);
    setShowOpeningModal(false);
    await refreshData();
  };

  const handleAddEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!viewingSession) return;
    const entry: CashEntry = {
      id: `ENT-${Date.now()}`,
      sessionId: viewingSession.id,
      type: showEntryModal.type,
      category: entryForm.category,
      description: entryForm.description,
      value: entryForm.value,
      timestamp: new Date().toLocaleTimeString('pt-BR')
    };
    await addCashEntry(entry);
    setShowEntryModal({ ...showEntryModal, show: false });
    setEntryForm({ description: '', value: 0, category: 'Ajuste Manual' });
    await refreshData();
  };

  const handleCloseCash = async () => {
    if (!viewingSession || !sessionData) return;
    const formattedBalance = Number(sessionData.saldoFinalCaixa).toLocaleString('pt-BR', { minimumFractionDigits: 2 });
    if (confirm(`DESEJA REALMENTE FECHAR ESTE CAIXA?\nSaldo Final em Dinheiro: R$ ${formattedBalance}`)) {
      const closedSession: CashSession = {
        ...viewingSession,
        status: CashSessionStatus.CLOSED,
        closingTime: new Date().toLocaleString('pt-BR'),
        closingOperatorId: currentUser?.id,
        closingOperatorName: currentUser?.name,
        closingValue: sessionData.saldoFinalCaixa
      };
      await saveCashSession(closedSession);
      setViewingSession(null);
      await refreshData();
    }
  };

  if (viewingSession) {
    return (
      <div className="p-6 space-y-6 animate-in slide-in-from-right-10 duration-500 pb-20">
        
        {/* RELATÓRIO DE IMPRESSÃO (DETALHADO E ANALÍTICO) */}
        <div id="cash-report-print" className="hidden print:block bg-white text-black font-sans p-6 text-[10px] leading-tight">
           <div className="border-b border-slate-300 pb-2 mb-4">
              <h1 className="font-black uppercase text-[11px] mb-1">DADOS DO MOVIMENTO DE CAIXA</h1>
              <div className="grid grid-cols-2 gap-x-12">
                 <div>
                    <p className="font-bold">DATA/HORA ABERTURA: <span className="font-normal">{viewingSession.openingTime}</span></p>
                    <p className="font-bold">OPERADOR: <span className="font-normal">{viewingSession.openingOperatorName?.toUpperCase()}</span></p>
                 </div>
                 <div>
                    <p className="font-bold">DATA/HORA FECHAMENTO: <span className="font-normal">{viewingSession.closingTime || '---'}</span></p>
                    <p className="font-bold">OPERADOR: <span className="font-normal">{viewingSession.closingOperatorName?.toUpperCase() || '---'}</span></p>
                 </div>
              </div>
           </div>

           <div className="bg-[#136dec] text-white p-2 text-center font-black uppercase mb-4 text-[10px] print:bg-slate-300 print:text-black">
              CAIXA: {viewingSession.id.slice(-4)} - {viewingSession.openingOperatorName?.toUpperCase()}
           </div>

           <div className="bg-[#136dec] text-white p-1 text-center font-black uppercase mb-1 print:bg-slate-200 print:text-black">
              LANÇAMENTOS DO DIA (VALORES EM ESPÉCIE / GAVETA)
           </div>

           <div className="grid grid-cols-2 gap-1 mb-4">
              <table className="w-full border-collapse border border-slate-400">
                 <thead className="bg-slate-100"><tr className="border-b border-slate-400 text-[8px]"><th className="p-1 text-left uppercase border-r border-slate-400">Classificação</th><th className="p-1 text-right uppercase">Valor</th></tr></thead>
                 <tbody>
                    <tr className="border-b border-slate-400">
                       <td className="p-1 border-r border-slate-400 uppercase">SALDO ANTERIOR (FUNDO)</td>
                       <td className="p-1 text-right tabular-nums">R$ {Number(sessionData?.saldoAnterior || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    </tr>
                    <tr className="border-b border-slate-400">
                       <td className="p-1 border-r border-slate-400 uppercase">VENDAS EM DINHEIRO (+)</td>
                       <td className="p-1 text-right tabular-nums">R$ {Number(sessionData?.vendasEmDinheiro || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    </tr>
                    <tr className="font-black bg-slate-50"><td className="p-1 border-r border-slate-400">TOTAIS ESPÉCIE</td><td className="p-1 text-right">R$ {Number(sessionData?.saldoFinalCaixa || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td></tr>
                 </tbody>
              </table>
              <table className="w-full border-collapse border border-slate-400">
                 <thead className="bg-slate-100"><tr className="border-b border-slate-400 text-[8px]"><th className="p-1 text-left uppercase border-r border-slate-400">Saídas / Sangrias</th><th className="p-1 text-right uppercase">Valor</th></tr></thead>
                 <tbody>
                    <tr className="border-b border-slate-400"><td className="p-1 border-r border-slate-400 uppercase">TOTAL DE RETIRADAS (-)</td><td className="p-1 text-right tabular-nums">R$ {Number(sessionData?.totalSaidasCaixa || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td></tr>
                    <tr className="font-black bg-slate-50"><td className="p-1 border-r border-slate-400">TOTAL SANGRIAS</td><td className="p-1 text-right">R$ {Number(sessionData?.totalSaidasCaixa || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td></tr>
                 </tbody>
              </table>
           </div>

           <div className="bg-[#136dec] text-white p-1 text-center font-black uppercase mb-1 print:bg-slate-200 print:text-black">
              RESUMO POR MEIO DE PAGAMENTO (CARTÕES / OUTROS)
           </div>
           <table className="w-full border-collapse border border-slate-400 mb-4">
              <thead className="bg-slate-100 text-[8px]"><tr className="border-b border-slate-400"><th className="p-1 text-left uppercase border-r border-slate-400">Forma / Operadora / Bandeira</th><th className="p-1 text-center uppercase border-r border-slate-400">Qtd. Notas</th><th className="p-1 text-right uppercase">Total Bruto</th></tr></thead>
              <tbody>
                 {Object.entries(sessionData?.resumoCartoes || {}).map(([key, data]) => (
                    <tr key={key} className="border-b border-slate-400 text-[8px]">
                       <td className="p-1 uppercase border-r border-slate-400">{key}</td>
                       <td className="p-1 text-center border-r border-slate-400">{data.count}</td>
                       <td className="p-1 text-right tabular-nums font-black">R$ {data.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    </tr>
                 ))}
                 {Object.keys(sessionData?.resumoCartoes || {}).length === 0 && <tr><td colSpan={3} className="p-4 text-center opacity-40 uppercase">Sem movimentação de cartões</td></tr>}
              </tbody>
           </table>

           <div className="bg-[#136dec] text-white p-1 text-center font-black uppercase mb-1 print:bg-slate-200 print:text-black">
              LISTAGEM ANALÍTICA DAS VENDAS
           </div>
           <table className="w-full border-collapse border border-slate-400 mb-4">
              <thead className="bg-slate-100 text-[7px]"><tr className="border-b border-slate-400"><th className="p-1 text-left uppercase border-r border-slate-400">Cliente</th><th className="p-1 text-left uppercase border-r border-slate-400">Forma / Operadora</th><th className="p-1 text-center uppercase border-r border-slate-400">Parcelas</th><th className="p-1 text-right uppercase">Valor Líquido</th></tr></thead>
              <tbody>
                 {sessionData?.allRecords.filter(r => r.cat === 'VENDA').map((v, idx) => (
                    <tr key={idx} className={`border-b border-slate-400 text-[7px] ${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50'}`}>
                       <td className="p-1 uppercase border-r border-slate-400 truncate max-w-[150px]">{v.client}</td>
                       <td className="p-1 uppercase border-r border-slate-400">{v.method} {v.operator ? `/ ${v.operator}` : ''}</td>
                       <td className="p-1 text-center border-r border-slate-400">{v.installments}x</td>
                       <td className="p-1 text-right tabular-nums font-black">R$ {v.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    </tr>
                 ))}
              </tbody>
           </table>

           <div className="space-y-1">
              <div className="bg-black text-white p-2 flex justify-between font-black uppercase text-[11px] border-t border-amber-500 mt-1 print:bg-black print:text-white"><span>VALOR TOTAL FATURADO (TODOS MEIOS):</span><span>R$ {Number(sessionData?.totalVendasBruto || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
           </div>
           
           <p className="mt-8 text-center opacity-40 text-[7px] uppercase font-black">TEM ACESSÓRIOS ERP - SISTEMA DE GESTÃO - {new Date().toLocaleString()}</p>
        </div>

        {/* HEADER DETALHE (TELA) */}
        <div className="flex justify-between items-start bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 print:hidden">
           <div className="space-y-4">
              <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase flex items-center gap-2">
                 <span className="material-symbols-outlined text-primary">visibility</span> Movimentação de Caixa - Analítico
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2">
                 <div className="flex flex-col"><span className="text-[10px] font-black text-slate-400 uppercase">ID Movimento:</span><span className="text-xs font-bold text-slate-600">{viewingSession.id}</span></div>
                 <div className="flex flex-col"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loja:</span><span className="text-xs font-bold text-primary uppercase">{viewingSession.storeName}</span></div>
                 <div className="flex flex-col"><span className="text-[10px] font-black text-slate-400 uppercase">Status:</span><span className="text-xs font-bold text-slate-600 uppercase">{viewingSession.status}</span></div>
                 <div className="flex flex-col"><span className="text-[10px] font-black text-slate-400 uppercase">Operador:</span><span className="text-xs font-bold text-slate-600 uppercase">{viewingSession.openingOperatorName}</span></div>
              </div>
           </div>
           <div className="flex gap-2">
              <button onClick={() => window.print()} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-2 shadow-lg hover:bg-black transition-all">
                 <span className="material-symbols-outlined text-sm">print</span> Imprimir Conferência
              </button>
              <button onClick={() => setViewingSession(null)} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 shadow-sm"><span className="material-symbols-outlined text-sm">arrow_back</span> Voltar</button>
           </div>
        </div>

        {/* CORPO DO DETALHE (TELA) */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[500px] print:hidden">
           <div className="flex border-b border-slate-100 dark:border-slate-800 p-2 gap-1 bg-slate-50/50">
              <button onClick={() => setActiveTab('lançamentos')} className={`px-6 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'lançamentos' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Detalhamento de Vendas e Lançamentos</button>
              <button onClick={() => setActiveTab('auditoria')} className={`px-6 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'auditoria' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Resumo Cartões / Operadoras</button>
              
              <div className="ml-auto">
                 {viewingSession.status === CashSessionStatus.OPEN && (
                    <button onClick={handleCloseCash} className="px-10 py-2 bg-white dark:bg-slate-800 border-2 border-emerald-500 text-emerald-600 rounded-xl text-[14px] font-black uppercase shadow-lg hover:bg-emerald-500 hover:text-white transition-all">FECHAR CAIXA AGORA</button>
                 )}
              </div>
           </div>

           {activeTab === 'lançamentos' ? (
             <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-[11px] font-bold border-collapse">
                   <thead className="bg-primary text-white sticky top-0 z-10">
                      <tr>
                         <th className="px-4 py-2.5 w-10 text-center font-black uppercase"><span className="material-symbols-outlined text-sm">info</span></th>
                         <th className="px-4 py-2.5 uppercase">Cliente</th>
                         <th className="px-4 py-2.5 uppercase">Forma / Operadora</th>
                         <th className="px-4 py-2.5 text-center uppercase">Band.</th>
                         <th className="px-4 py-2.5 text-center uppercase">Parc.</th>
                         <th className="px-4 py-2.5 text-right uppercase">Valor Bruto</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {sessionData?.allRecords.map(record => (
                        <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                           <td className="px-4 py-2.5 text-center"><span className={`size-2.5 rounded-full inline-block ${record.natureza === 'E' ? 'bg-emerald-500' : 'bg-rose-500'}`}></span></td>
                           <td className="px-4 py-2.5 uppercase text-slate-900 dark:text-white font-black">{record.client}</td>
                           <td className="px-4 py-2.5 uppercase text-primary">{record.method} {record.operator ? `/ ${record.operator}` : ''}</td>
                           <td className="px-4 py-2.5 text-center uppercase text-slate-400">{record.brand || '---'}</td>
                           <td className="px-4 py-2.5 text-center font-black text-slate-400">{record.installments}x</td>
                           <td className={`px-4 py-2.5 text-right font-black ${record.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>R$ {Number(record.value || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
           ) : (
             <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Resumo Consolidado de Cartões</h4>
                      <div className="space-y-4">
                         {Object.entries(sessionData?.resumoCartoes || {}).map(([key, data]) => (
                            <div key={key} className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                               <div className="flex flex-col">
                                  <span className="text-xs font-black uppercase text-slate-700 dark:text-slate-200">{key}</span>
                                  <span className="text-[9px] font-bold text-slate-400 uppercase">{data.count} Transações</span>
                               </div>
                               <span className="text-sm font-black text-primary">R$ {data.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                            </div>
                         ))}
                      </div>
                   </div>
                   <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-6">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Informações de Abertura</h4>
                      <div className="flex justify-between items-center"><span className="text-xs font-bold uppercase">Operador Responsável</span><span className="text-xs font-black uppercase">{viewingSession.openingOperatorName}</span></div>
                      <div className="flex justify-between items-center"><span className="text-xs font-bold uppercase">Hora Abertura</span><span className="text-xs font-black uppercase">{viewingSession.openingTime}</span></div>
                      <div className="flex justify-between items-center pt-4 border-t border-white/10"><span className="text-sm font-black uppercase text-primary">Fundo Inicial (Espécie)</span><span className="text-sm font-black text-white">R$ {Number(viewingSession.openingValue || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                   </div>
                </div>
             </div>
           )}
        </div>

        {/* RODAPÉ DE RESUMO (TELA) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
           <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col items-center shadow-lg">
              <span className="text-[10px] font-black uppercase text-slate-400">Saldo Anterior:</span>
              <span className="text-xl font-black tabular-nums">R$ {Number(sessionData?.saldoAnterior || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
           </div>
           <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col items-center shadow-lg">
              <span className="text-[10px] font-black uppercase text-emerald-500">Total Entradas (Espécie):</span>
              <span className="text-xl font-black tabular-nums">R$ {Number(sessionData?.totalEntradasCaixa || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
           </div>
           <div className="bg-slate-900 text-white p-4 rounded-2xl flex flex-col items-center shadow-lg">
              <span className="text-[10px] font-black uppercase text-rose-500">Total Saídas:</span>
              <span className="text-xl font-black tabular-nums">R$ {Number(sessionData?.totalSaidasCaixa || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
           </div>
           <div className="bg-primary text-white p-4 rounded-2xl flex flex-col items-center shadow-xl border-l-4 border-amber-400">
              <span className="text-[10px] font-black uppercase text-white/70">Saldo Final em Gaveta:</span>
              <span className="text-xl font-black tabular-nums">R$ {Number(sessionData?.saldoFinalCaixa || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
           </div>
        </div>

        {/* MODAL LANÇAMENTO MANUAL (TELA) */}
        {showEntryModal.show && (
           <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300 print:hidden">
              <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                 <div className={`p-6 text-white flex justify-between items-center ${showEntryModal.type === 'INCOME' ? 'bg-emerald-500' : showEntryModal.type === 'EXPENSE' ? 'bg-rose-500' : 'bg-blue-500'}`}>
                    <h3 className="font-black uppercase tracking-tight">Lançamento de {showEntryModal.type === 'INCOME' ? 'Entrada' : showEntryModal.type === 'EXPENSE' ? 'Saída' : 'Transferência'}</h3>
                    <button onClick={() => setShowEntryModal({...showEntryModal, show: false})}><span className="material-symbols-outlined">close</span></button>
                 </div>
                 <form onSubmit={handleAddEntry} className="p-8 space-y-4">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Valor Bruto (R$)</label>
                       <input autoFocus type="number" step="0.01" required value={entryForm.value} onChange={e => setEntryForm({...entryForm, value: parseFloat(e.target.value) || 0})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-6 text-xl font-black text-primary" placeholder="0,00" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Motivo / Histórico</label>
                       <textarea required rows={3} value={entryForm.description} onChange={e => setEntryForm({...entryForm, description: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 text-xs font-bold uppercase" placeholder="Descreva o motivo..." />
                    </div>
                    <button type="submit" className={`w-full h-14 text-white rounded-xl font-black text-xs uppercase shadow-xl mt-4 ${showEntryModal.type === 'INCOME' ? 'bg-emerald-500' : showEntryModal.type === 'EXPENSE' ? 'bg-rose-500' : 'bg-blue-500'}`}>Confirmar Lançamento</button>
                 </form>
              </div>
           </div>
        )}

        <style>{`
          @media print {
            /* Garante que o corpo do documento de impressão seja visível e o resto oculto */
            body * { visibility: hidden !important; }
            #root, #root * { visibility: hidden !important; }
            
            /* Remove restrições de overflow do layout principal para permitir impressão multi-página */
            #root, main, .flex-1 { 
              overflow: visible !important; 
              height: auto !important; 
              display: block !important; 
            }

            /* Força a visibilidade apenas do bloco de relatório */
            #cash-report-print, #cash-report-print * { 
              visibility: visible !important; 
              display: block !important; 
            }

            /* Posicionamento absoluto no topo da página de impressão */
            #cash-report-print {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              background: white !important;
              color: black !important;
              margin: 0 !important;
              padding: 10mm !important;
              border: none !important;
            }

            /* Remove cores escuras de fundo das tabelas na impressão para legibilidade */
            #cash-report-print table { border: 1px solid #333 !important; }
            #cash-report-print th { background-color: #f0f0f0 !important; color: black !important; }
            #cash-report-print .bg-[#136dec] { background-color: #e0e0e0 !important; color: black !important; border: 1px solid #ccc !important; }

            @page { size: auto; margin: 0mm; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Registro de Movimentação Diária do PDV</h2>
          <div className="flex gap-4 mt-2 text-[10px] font-black text-slate-400 uppercase">
             <span>Unidade: {currentStore?.name || 'Carregando...'}</span>
             <span>Ref: {new Date().toLocaleDateString('pt-BR')}</span>
          </div>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setShowOpeningModal(true)} className="px-4 py-2 bg-emerald-500 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all"><span className="material-symbols-outlined text-sm">check_circle</span> Realizar Abertura</button>
           <button onClick={() => navigate('/relatorios?type=conferencia_caixa')} className="px-4 py-2 bg-slate-800 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-2 shadow-lg transition-all hover:bg-black"><span className="material-symbols-outlined text-sm">monitoring</span> Relatórios Analíticos</button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
         <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-lg">search</span>
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="BUSCAR PELO NOME DO CAIXA OU OPERADOR..." className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg pl-10 text-[10px] font-black uppercase focus:ring-1 focus:ring-primary/20 h-10" />
         </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
         <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] font-bold">
               <thead className="bg-primary text-white">
                  <tr>
                     <th className="px-4 py-3 w-10 text-center uppercase"><span className="material-symbols-outlined text-sm">settings</span></th>
                     <th className="px-4 py-3 uppercase">ID</th>
                     <th className="px-4 py-3 uppercase">Terminal / Operador de Caixa</th>
                     <th className="px-4 py-3 uppercase">Abertura</th>
                     <th className="px-4 py-3 uppercase">Fechamento</th>
                     <th className="px-4 py-3 uppercase">Status</th>
                     <th className="px-4 py-3 text-right uppercase">Ação</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSessions.map(session => (
                    <tr key={session.id} onClick={() => setViewingSession(session)} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer group">
                       <td className="px-4 py-3 text-center"><span className={`size-2.5 rounded-full inline-block ${session.status === CashSessionStatus.OPEN ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`}></span></td>
                       <td className="px-4 py-3 font-mono text-slate-400">{session.id}</td>
                       <td className="px-4 py-3 uppercase text-slate-900 dark:text-white group-hover:text-primary transition-colors">{session.registerName}</td>
                       <td className="px-4 py-3 text-slate-400">{session.openingTime || '--:--'}</td>
                       <td className="px-4 py-3 text-slate-400">{session.closingTime || '--:--'}</td>
                       <td className="px-4 py-3 uppercase"><span className={`text-[9px] font-black px-2 py-0.5 rounded-full ${session.status === CashSessionStatus.OPEN ? 'bg-emerald-100 text-emerald-600' : 'bg-blue-100 text-blue-600'}`}>{session.status}</span></td>
                       <td className="px-4 py-3 text-right"><button className="text-primary hover:underline uppercase text-[9px] font-black">Visualizar Detalhes</button></td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {showOpeningModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in duration-300">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-6 bg-primary text-white flex justify-between items-center">
                 <h3 className="font-black uppercase tracking-tight">Abertura de Movimento PDV</h3>
                 <button onClick={() => setShowOpeningModal(false)}><span className="material-symbols-outlined">close</span></button>
              </div>
              <form onSubmit={handleOpenCash} className="p-8 space-y-6">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Unidade de Venda</label>
                    <div className="w-full h-12 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 flex items-center text-xs font-black uppercase text-primary border border-primary/10">{currentStore?.name || 'Unidade não identificada'}</div>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Selecionar Operador do Terminal</label>
                    <select required value={selectedRegister} onChange={e => setSelectedRegister(e.target.value)} className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 text-xs font-black uppercase"><option value="">Selecione o Operador...</option>{availableCashiers.map((u, idx) => (<option key={u.id} value={`Caixa {idx + 1} - {u.name}`}>Caixa {idx + 1} - {u.name}</option>))}</select>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Fundo de Troco Inicial (R$)</label>
                    <input autoFocus type="number" step="0.01" required value={openingValue} onChange={e => setOpeningValue(parseFloat(e.target.value) || 0)} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-6 text-xl font-black text-emerald-600" placeholder="0,00" />
                 </div>
                 <button type="submit" disabled={availableCashiers.length === 0} className="w-full h-14 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl disabled:opacity-30">Confirmar Abertura</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default CashMovement;
