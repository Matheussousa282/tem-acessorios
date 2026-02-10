
import React, { useState, useMemo, useEffect } from 'react';
import { useApp, CashEntry } from '../AppContext';
import { CashSession, CashSessionStatus, UserRole, TransactionStatus } from '../types';
import { useNavigate } from 'react-router-dom';

const CashMovement: React.FC = () => {
  const { cashSessions, cashEntries, transactions, establishments, currentUser, saveCashSession, addCashEntry, users, refreshData, cardOperators, cardBrands } = useApp();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('');
  
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const todayStr = useMemo(() => new Date().toLocaleDateString('pt-BR'), []);
  const todayISO = new Date().toISOString().split('T')[0];
  
  const [viewingSession, setViewingSession] = useState<CashSession | null>(null);
  const [activeTab, setActiveTab] = useState<'lançamentos' | 'auditoria'>('lançamentos');
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [openingValue, setOpeningValue] = useState(0);
  const [selectedRegister, setSelectedRegister] = useState('');

  const currentStore = establishments.find(e => e.id === currentUser?.storeId);

  useEffect(() => {
    refreshData();
  }, []);

  // 1. CÁLCULO DO SALDO ACUMULADO (TUDO QUE ENTROU - TUDO QUE SAIU NA HISTÓRIA DA UNIDADE)
  const totalCumulativeBalance = useMemo(() => {
    const storeName = currentStore?.name;
    if (!storeName) return 0;

    // Entradas Totais (Vendas + Manual)
    const allCashIncomes = transactions.filter(t => 
      t.store === storeName && t.method === 'Dinheiro' && t.status === TransactionStatus.PAID && t.type === 'INCOME'
    ).reduce((acc, t) => acc + t.value, 0);

    const allManualIncomes = cashEntries.filter(e => {
       const session = cashSessions.find(s => s.id === e.sessionId);
       return session?.storeName === storeName && e.type === 'INCOME';
    }).reduce((acc, e) => acc + e.value, 0);

    // Saídas Totais (Despesas + Manual/Sangria)
    const allCashExpenses = transactions.filter(t => 
      t.store === storeName && t.method === 'Dinheiro' && t.status === TransactionStatus.PAID && t.type === 'EXPENSE'
    ).reduce((acc, t) => acc + t.value, 0);

    const allManualExpenses = cashEntries.filter(e => {
       const session = cashSessions.find(s => s.id === e.sessionId);
       return session?.storeName === storeName && e.type === 'EXPENSE';
    }).reduce((acc, e) => acc + e.value, 0);

    // Pegamos o valor de abertura do PRIMEIRO caixa de todos como base inicial
    const firstSession = [...cashSessions].filter(s => s.storeName === storeName).sort((a,b) => a.id.localeCompare(b.id))[0];
    const baseInitial = firstSession?.openingValue || 0;

    return (baseInitial + allCashIncomes + allManualIncomes) - (allCashExpenses + allManualExpenses);
  }, [transactions, cashSessions, cashEntries, currentStore]);

  // 2. CÁLCULO DO SALDO DIÁRIO (APENAS O QUE ACONTECEU HOJE NO TURNO)
  const dailyDrawerBalance = useMemo(() => {
    const storeName = currentStore?.name;
    if (!storeName) return 0;

    const activeSession = cashSessions.find(s => 
      (s.storeId === currentUser?.storeId || s.storeName === storeName) && 
      s.status === CashSessionStatus.OPEN
    );
    if (!activeSession) return 0;

    const sessionOpening = activeSession.openingValue || 0;

    const todayCashSales = transactions.filter(t => 
      t.store === storeName && t.date === todayISO && t.method === 'Dinheiro' && t.status === TransactionStatus.PAID && t.type === 'INCOME'
    ).reduce((acc, t) => acc + t.value, 0);

    const todayManualIn = cashEntries.filter(e => e.sessionId === activeSession.id && e.type === 'INCOME').reduce((acc, e) => acc + e.value, 0);
    const todayManualOut = cashEntries.filter(e => e.sessionId === activeSession.id && e.type === 'EXPENSE').reduce((acc, e) => acc + e.value, 0);
    
    // Despesas de hoje lançadas no financeiro
    const todayFinanceExpenses = transactions.filter(t =>
      t.store === storeName && t.date === todayISO && t.method === 'Dinheiro' && t.status === TransactionStatus.PAID && t.type === 'EXPENSE'
    ).reduce((acc, t) => acc + t.value, 0);

    return (sessionOpening + todayCashSales + todayManualIn) - (todayManualOut + todayFinanceExpenses);
  }, [transactions, cashSessions, cashEntries, currentStore, todayISO]);

  const alreadyOpenedToday = useMemo(() => {
    return cashSessions.some(s => {
      const isThisStore = s.storeId === currentUser?.storeId;
      const sessionDate = s.openingTime?.split(',')[0].split(' ')[0].trim();
      return isThisStore && sessionDate === todayStr;
    });
  }, [cashSessions, currentUser, todayStr]);

  useEffect(() => {
    if (showOpeningModal) {
      const lastClosed = [...cashSessions]
        .filter(s => s.storeId === currentUser?.storeId && s.status === CashSessionStatus.CLOSED)
        .sort((a, b) => b.id.localeCompare(a.id))[0];
      setOpeningValue(lastClosed?.closingValue || 0);
    }
  }, [showOpeningModal, cashSessions, currentUser]);

  const availableCashiers = useMemo(() => {
    return users.filter(u => (u.role === UserRole.CASHIER || u.role === UserRole.ADMIN || u.role === UserRole.MANAGER) && (isAdmin || u.storeId === currentUser?.storeId));
  }, [users, isAdmin, currentUser]);

  const filteredSessions = useMemo(() => {
    return cashSessions.filter(s => {
      const belongsToStore = isAdmin || s.storeId === currentUser?.storeId;
      const matchesFilter = filter === '' || s.registerName.toLowerCase().includes(filter.toLowerCase());
      return belongsToStore && matchesFilter;
    });
  }, [cashSessions, filter, isAdmin, currentUser]);

  const sessionData = useMemo(() => {
    if (!viewingSession) return null;
    const datePart = viewingSession.openingTime?.split(',')[0].trim();
    const [d, m, y] = datePart?.split('/') || [];
    const isoDate = `${y}-${m}-${d}`;

    const sessionVendas = transactions.filter(t => {
      const matchesStore = t.store === viewingSession.storeName;
      const isSale = t.type === 'INCOME' && (t.category === 'Venda' || t.category === 'Serviço');
      const matchesDate = t.date === isoDate;
      const matchesOperator = t.cashierId ? t.cashierId === viewingSession.openingOperatorId : true;
      return matchesStore && isSale && matchesDate && matchesOperator;
    });

    const sessionManualEntries = cashEntries.filter(e => e.sessionId === viewingSession.id);
    const resumoCartoes: Record<string, { count: number, value: number }> = {};
    sessionVendas.forEach(v => {
       if (['Credito', 'Debito', 'Pix', 'Pix Maquineta'].some(m => v.method?.includes(m))) {
          const methodKey = v.method?.includes('Pix') ? 'PIX' : (v.method || 'CARTÃO').toUpperCase();
          if (!resumoCartoes[methodKey]) resumoCartoes[methodKey] = { count: 0, value: 0 };
          resumoCartoes[methodKey].count += 1;
          resumoCartoes[methodKey].value += v.value;
       }
    });

    const totalVendasBruto = sessionVendas.reduce((acc, t) => acc + t.value, 0);
    const vendasEmDinheiro = sessionVendas.filter(v => v.method?.toUpperCase() === 'DINHEIRO').reduce((acc, v) => acc + v.value, 0);
    const entradasManuaisDinheiro = sessionManualEntries.filter(e => e.type === 'INCOME').reduce((acc, e) => acc + e.value, 0);
    const saídasDinheiro = sessionManualEntries.filter(e => e.type === 'EXPENSE').reduce((acc, e) => acc + e.value, 0);
    const saldoAnterior = viewingSession.openingValue || 0;
    const saldoFinalCaixa = (saldoAnterior + vendasEmDinheiro + entradasManuaisDinheiro) - saídasDinheiro;

    const allRecords = [
      ...sessionVendas.map(v => ({ id: v.id, type: 'INCOME', description: `Venda PDV - ${v.id.slice(-5)}`, value: v.value, timestamp: v.date, method: v.method, cat: 'VENDA', client: v.client || 'Consumidor Final', installments: v.installments || 1 })),
      ...sessionManualEntries.map(e => ({ id: e.id, type: e.type, description: e.description, value: e.value, timestamp: e.timestamp, method: e.method || 'CAIXA', cat: e.category, client: 'SISTEMA', installments: 1 }))
    ].sort((a, b) => b.id.localeCompare(a.id));

    return { allRecords, saldoAnterior, vendasEmDinheiro, entradasManuaisDinheiro, saídasDinheiro, saldoFinalCaixa, resumoCartoes, totalVendasBruto };
  }, [viewingSession, transactions, cashEntries]);

  const handleOpenCash = async (e: React.FormEvent) => {
    e.preventDefault();
    if (alreadyOpenedToday && !isAdmin) {
      alert("Atenção: Já existe um movimento de caixa hoje.");
      return;
    }
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

  const handleCloseCash = async () => {
    if (!viewingSession || !sessionData) return;
    if (confirm(`FECHAR CAIXA?\nSaldo Final: R$ ${sessionData.saldoFinalCaixa.toLocaleString('pt-BR')}`)) {
      await saveCashSession({ ...viewingSession, status: CashSessionStatus.CLOSED, closingTime: new Date().toLocaleString('pt-BR'), closingOperatorId: currentUser?.id, closingOperatorName: currentUser?.name, closingValue: sessionData.saldoFinalCaixa });
      setViewingSession(null);
      await refreshData();
    }
  };

  if (viewingSession) {
    return (
      <div className="p-6 space-y-6 animate-in slide-in-from-right-10 duration-500 pb-20 print:p-0">
        <div id="cash-report-print" className="hidden print:block bg-white text-black font-sans text-[10px] leading-tight w-full max-w-[210mm] mx-auto p-4">
           <div className="mb-4">
              <h1 className="font-black uppercase text-[12px] mb-2">DADOS DO MOVIMENTO DE CAIXA</h1>
              <div className="grid grid-cols-2 text-[10px]">
                 <div className="space-y-0.5">
                    <p><span className="font-black uppercase">DATA/HORA ABERTURA:</span> <span>{viewingSession.openingTime}</span></p>
                    <p><span className="font-black uppercase">OPERADOR:</span> <span>{viewingSession.openingOperatorName?.toUpperCase()}</span></p>
                 </div>
                 <div className="space-y-0.5">
                    <p><span className="font-black uppercase">DATA/HORA FECHAMENTO:</span> <span>{viewingSession.closingTime || '--'}</span></p>
                    <p><span className="font-black uppercase">OPERADOR:</span> <span>{viewingSession.closingOperatorName?.toUpperCase() || '--'}</span></p>
                 </div>
              </div>
              <div className="border-b border-black w-full mt-2"></div>
           </div>

           <div className="bg-[#136dec] text-white p-1.5 text-center font-black uppercase mb-4 text-[11px] print:bg-[#136dec] print:text-white">
              CAIXA: {viewingSession.id.slice(-4)} - {viewingSession.openingOperatorName?.toUpperCase()}
           </div>

           <div className="text-center font-black uppercase mb-2 text-[10px]">LANÇAMENTOS DO DIA (VALORES EM ESPÉCIE / GAVETA)</div>

           <div className="flex gap-4 mb-6">
              <div className="flex-1">
                 <table className="w-full border-collapse border border-black">
                    <thead>
                       <tr className="border-b border-black">
                          <th className="p-1 text-left uppercase border-r border-black font-black text-[9px]">Classificação</th>
                          <th className="p-1 text-right uppercase font-black text-[9px]">Valor</th>
                       </tr>
                    </thead>
                    <tbody>
                       <tr className="border-b border-black">
                          <td className="p-1 border-r border-black uppercase">SALDO ANTERIOR (FUNDO)</td>
                          <td className="p-1 text-right tabular-nums">R$ {Number(sessionData?.saldoAnterior || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                       </tr>
                       <tr className="border-b border-black">
                          <td className="p-1 border-r border-black uppercase">VENDAS EM DINHEIRO (+)</td>
                          <td className="p-1 text-right tabular-nums">R$ {Number(sessionData?.vendasEmDinheiro || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                       </tr>
                       <tr className="font-black">
                          <td className="p-1 border-r border-black uppercase">TOTAIS ESPÉCIE</td>
                          <td className="p-1 text-right">R$ {Number(sessionData?.saldoFinalCaixa || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                       </tr>
                    </tbody>
                 </table>
              </div>

              <div className="flex-1">
                 <table className="w-full border-collapse border border-black">
                    <thead>
                       <tr className="border-b border-black">
                          <th className="p-1 text-left uppercase border-r border-black font-black text-[9px]">Saídas / Sangrias</th>
                          <th className="p-1 text-right uppercase font-black text-[9px]">Valor</th>
                       </tr>
                    </thead>
                    <tbody>
                       <tr className="border-b border-black">
                          <td className="p-1 border-r border-black uppercase">TOTAL DE RETIRADAS (-)</td>
                          <td className="p-1 text-right tabular-nums">R$ {Number(sessionData?.saídasDinheiro || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                       </tr>
                       <tr className="font-black">
                          <td className="p-1 border-r border-black uppercase">TOTAL SANGRIAS</td>
                          <td className="p-1 text-right">R$ {Number(sessionData?.saídasDinheiro || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                       </tr>
                    </tbody>
                 </table>
              </div>
           </div>

           <div className="bg-[#136dec] text-white p-1.5 text-center font-black uppercase mb-2 text-[10px] print:bg-[#136dec] print:text-white">RESUMO POR MEIO DE PAGAMENTO (CARTÕES / OUTROS)</div>
           <table className="w-full border-collapse border border-black mb-6">
              <thead><tr className="border-b border-black"><th className="p-1 text-left uppercase border-r border-black font-black text-[9px]">Forma / Operadora</th><th className="p-1 text-center uppercase border-r border-black font-black text-[9px] w-28">Qtd. Notas</th><th className="p-1 text-right uppercase font-black text-[9px] w-36">Total Bruto</th></tr></thead>
              <tbody>
                 {(Object.entries(sessionData?.resumoCartoes || {}) as any).map(([key, data]: [string, any]) => (
                    <tr key={key} className="border-b border-black font-bold">
                       <td className="p-1 uppercase border-r border-black">{key}</td>
                       <td className="p-1 text-center border-r border-black">{data.count}</td>
                       <td className="p-1 text-right tabular-nums">R$ {data.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    </tr>
                 ))}
              </tbody>
           </table>

           <div className="bg-[#136dec] text-white p-1.5 text-center font-black uppercase mb-2 text-[10px] print:bg-[#136dec] print:text-white">LISTAGEM ANALÍTICA DAS VENDAS</div>
           <table className="w-full border-collapse border border-black mb-6 text-[8px]">
              <thead><tr className="border-b border-black font-black text-[8px]"><th className="p-1 text-left uppercase border-r border-black">Documento</th><th className="p-1 text-left uppercase border-r border-black">Cliente</th><th className="p-1 text-left uppercase border-r border-black">Forma Pagto</th><th className="p-1 text-right uppercase">Valor</th></tr></thead>
              <tbody>
                 {sessionData?.allRecords.filter(r => r.cat === 'VENDA').map((v, idx) => (
                    <tr key={idx} className="border-b border-black font-bold">
                       <td className="p-1 border-r border-black uppercase">{v.id}</td>
                       <td className="p-1 border-r border-black uppercase truncate">{v.client}</td>
                       <td className="p-1 border-r border-black uppercase">{v.method}</td>
                       <td className="p-1 text-right tabular-nums">R$ {v.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    </tr>
                 ))}
              </tbody>
           </table>

           <div className="border-t-[3px] border-[#f59e0b] pt-1 mt-2">
              <div className="flex justify-between font-black uppercase text-[11px] py-2">
                 <span className="text-slate-400">VALOR TOTAL FATURADO (TODOS MEIOS):</span>
                 <span className="text-black text-[13px]">R$ {Number(sessionData?.totalVendasBruto || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
              </div>
           </div>
        </div>

        <div className="flex justify-between items-start bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 print:hidden">
           <div className="space-y-4">
              <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase flex items-center gap-2">
                 <span className="material-symbols-outlined text-primary">visibility</span> Movimentação de Caixa
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2 text-[11px] uppercase font-bold">
                 <div className="flex flex-col"><span className="text-slate-400">ID Movimento:</span><span>{viewingSession.id}</span></div>
                 <div className="flex flex-col"><span className="text-slate-400">Loja:</span><span className="text-primary">{viewingSession.storeName}</span></div>
                 <div className="flex flex-col"><span className="text-slate-400">Status:</span><span>{viewingSession.status}</span></div>
                 <div className="flex flex-col"><span className="text-slate-400">Operador:</span><span>{viewingSession.openingOperatorName}</span></div>
              </div>
           </div>
           <div className="flex gap-2">
              <button onClick={() => window.print()} className="px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 hover:bg-black transition-all">
                 <span className="material-symbols-outlined text-lg">print</span> Imprimir Conferência
              </button>
              <button onClick={() => setViewingSession(null)} className="px-6 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 rounded-xl text-[10px] font-black uppercase flex items-center gap-2"><span className="material-symbols-outlined text-lg">arrow_back</span> Voltar</button>
           </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[500px] print:hidden">
           <div className="flex border-b border-slate-100 dark:border-slate-800 p-2 gap-1 bg-slate-50/50">
              <button onClick={() => setActiveTab('lançamentos')} className={`px-6 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'lançamentos' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Lançamentos e Vendas</button>
              <button onClick={() => setActiveTab('auditoria')} className={`px-6 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'auditoria' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Resumo de Caixa</button>
              <div className="ml-auto">
                 {viewingSession.status === CashSessionStatus.OPEN && (
                    <button onClick={handleCloseCash} className="px-10 py-2 bg-white dark:bg-slate-800 border-2 border-emerald-500 text-emerald-600 rounded-xl text-[14px] font-black uppercase shadow-lg hover:bg-emerald-500 hover:text-white transition-all">FECHAR CAIXA AGORA</button>
                 )}
              </div>
           </div>

           {activeTab === 'lançamentos' ? (
             <div className="flex-1 overflow-auto">
                <table className="w-full text-left text-[11px] font-bold">
                   <thead className="bg-primary text-white sticky top-0 z-10">
                      <tr>
                         <th className="px-4 py-3 uppercase">Documento / Descrição</th>
                         <th className="px-4 py-3 uppercase">Cliente / Natureza</th>
                         <th className="px-4 py-3 uppercase">Meio / Forma</th>
                         <th className="px-4 py-3 text-right uppercase">Valor Bruto</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800 uppercase">
                      {sessionData?.allRecords.map(record => (
                        <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                           <td className="px-4 py-3">
                              <p className="font-black text-slate-800 dark:text-white leading-none">{record.description}</p>
                              <p className="text-[9px] text-slate-400 mt-1">{record.id}</p>
                           </td>
                           <td className="px-4 py-3">
                              <p className="text-primary">{record.client}</p>
                              <p className="text-[9px] text-slate-400 mt-1">{record.cat}</p>
                           </td>
                           <td className="px-4 py-3">
                              <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded text-[9px] font-black">{record.method}</span>
                              <p className="text-[9px] text-slate-400 mt-1">{record.installments}x PARCELADO</p>
                           </td>
                           <td className="px-4 py-3 text-right font-black tabular-nums text-sm">R$ {Number(record.value || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                        </tr>
                      ))}
                      {sessionData?.allRecords.length === 0 && <tr><td colSpan={4} className="py-20 text-center opacity-30 font-black">NENHUM LANÇAMENTO PARA ESTE CAIXA</td></tr>}
                   </tbody>
                </table>
             </div>
           ) : (
             <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700 space-y-4">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Cartões e Outros Meios</h4>
                      {(Object.entries(sessionData?.resumoCartoes || {}) as any).map(([key, data]: [string, any]) => (
                         <div key={key} className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                            <div className="flex flex-col"><span className="text-xs font-black uppercase">{key}</span><span className="text-[9px] font-bold text-slate-400">{data.count} Transações</span></div>
                            <span className="text-sm font-black text-primary">R$ {data.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                         </div>
                      ))}
                   </div>
                   <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-6">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Resumo Dinheiro (Gaveta)</h4>
                      <div className="space-y-3">
                         <div className="flex justify-between items-center"><span className="text-xs font-bold uppercase text-slate-400">Fundo Anterior</span><span className="text-sm font-black tabular-nums text-white">R$ {Number(sessionData?.saldoAnterior || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                         <div className="flex justify-between items-center"><span className="text-xs font-bold uppercase text-emerald-400">Vendas Dinheiro (+)</span><span className="text-sm font-black tabular-nums text-emerald-400">R$ {Number(sessionData?.vendasEmDinheiro || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                         <div className="flex justify-between items-center"><span className="text-xs font-bold uppercase text-blue-400">Entradas Manuais (+)</span><span className="text-sm font-black tabular-nums text-blue-400">R$ {Number(sessionData?.entradasManuaisDinheiro || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                         <div className="flex justify-between items-center"><span className="text-xs font-bold uppercase text-rose-400">Retiradas / Sangrias (-)</span><span className="text-sm font-black tabular-nums text-rose-400">R$ {Number(sessionData?.saídasDinheiro || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                      </div>
                      <div className="flex justify-between items-center pt-6 border-t border-white/10"><span className="text-sm font-black uppercase text-primary">Saldo Final em Gaveta</span><span className="text-xl font-black text-white tabular-nums">R$ {Number(sessionData?.saldoFinalCaixa || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                   </div>
                </div>
             </div>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 pb-24">
      {/* CARDS DE SALDO: ACUMULADO VS DIÁRIO */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
         <div className="md:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-[2.5rem] flex flex-col md:flex-row justify-between items-center gap-6 shadow-sm">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-8 w-full md:w-auto">
               <div className="flex items-center gap-4">
                  <div className="size-14 bg-emerald-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                     <span className="material-symbols-outlined text-3xl">account_balance_wallet</span>
                  </div>
                  <div>
                     <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">Saldo Acumulado (Gaveta)</p>
                     <h2 className="text-2xl font-black text-emerald-500 tabular-nums leading-none">R$ {totalCumulativeBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
                  </div>
               </div>
               <div className="flex items-center gap-4 border-l border-slate-100 dark:border-slate-800 pl-8">
                  <div className="size-14 bg-primary text-white rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20">
                     <span className="material-symbols-outlined text-3xl">today</span>
                  </div>
                  <div>
                     <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest">Saldo Diário (Turno)</p>
                     <h2 className="text-2xl font-black text-primary tabular-nums leading-none">R$ {dailyDrawerBalance.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</h2>
                  </div>
               </div>
            </div>
            <div className="flex gap-3">
               <button 
                onClick={() => setShowOpeningModal(true)} 
                disabled={alreadyOpenedToday && !isAdmin}
                className={`px-8 py-4 rounded-2xl text-[11px] font-black uppercase flex items-center gap-2 shadow-xl transition-all ${alreadyOpenedToday && !isAdmin ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-emerald-500 text-white shadow-emerald-500/20 hover:scale-105'}`}
               >
                <span className="material-symbols-outlined text-sm">{alreadyOpenedToday && !isAdmin ? 'lock' : 'add_circle'}</span> 
                {alreadyOpenedToday && !isAdmin ? 'Hoje Iniciado' : 'Abrir Turno'}
               </button>
            </div>
         </div>
         <div className="md:col-span-4 bg-slate-900 p-8 rounded-[2.5rem] text-white flex flex-col justify-center relative overflow-hidden group">
            <div className="absolute top-0 right-0 size-32 bg-primary/20 blur-3xl group-hover:bg-primary/40 transition-all"></div>
            <div className="relative z-10">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Auditoria de Unidade</p>
               <h3 className="text-xl font-black uppercase leading-tight mb-4">{currentStore?.name}</h3>
               <p className="text-[9px] font-bold text-slate-400 mb-4 uppercase tracking-tighter">O saldo acumulado reflete todo o dinheiro que deve estar fisicamente na gaveta agora.</p>
               <button onClick={() => navigate('/relatorios?type=conferencia_caixa')} className="text-[10px] font-black uppercase text-primary hover:underline flex items-center gap-1">Verificar Auditoria <span className="material-symbols-outlined text-sm">arrow_forward</span></button>
            </div>
         </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
         <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-lg">search</span>
            <input value={filter} onChange={e => setFilter(e.target.value)} placeholder="PESQUISAR TERMINAL OU OPERADOR..." className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg pl-10 text-[10px] font-black uppercase h-12" />
         </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
         <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] font-bold border-collapse">
               <thead className="bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-800 text-slate-400 uppercase">
                  <tr>
                     <th className="px-6 py-5 w-10 text-center">Status</th>
                     <th className="px-6 py-5">Caixa / Operador</th>
                     <th className="px-6 py-5">Data/Hora Abertura</th>
                     <th className="px-6 py-5">Data/Hora Fechamento</th>
                     <th className="px-6 py-5 text-right">Ação</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 dark:divide-slate-800 uppercase">
                  {filteredSessions.map(session => (
                    <tr key={session.id} onClick={() => setViewingSession(session)} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer group transition-colors">
                       <td className="px-6 py-4 text-center">
                          <span className={`size-3 rounded-full inline-block ${session.status === CashSessionStatus.OPEN ? 'bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-blue-500'}`}></span>
                       </td>
                       <td className="px-6 py-4"><p className="text-slate-900 dark:text-white font-black group-hover:text-primary transition-colors">{session.registerName}</p><p className="text-[9px] text-slate-400">MOV: #{session.id}</p></td>
                       <td className="px-6 py-4 text-slate-500">{session.openingTime || '---'}</td>
                       <td className="px-6 py-4 text-slate-500">{session.closingTime || 'SESSÃO EM ABERTO'}</td>
                       <td className="px-6 py-4 text-right">
                          <button className="px-4 py-2 bg-slate-100 dark:bg-slate-800 rounded-lg text-primary text-[9px] font-black group-hover:bg-primary group-hover:text-white transition-all uppercase">Exibir Extrato</button>
                       </td>
                    </tr>
                  ))}
               </tbody>
            </table>
         </div>
      </div>

      {showOpeningModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-6 bg-primary text-white flex justify-between items-center">
                 <h3 className="font-black uppercase tracking-tight">Abertura de Movimento</h3>
                 <button onClick={() => setShowOpeningModal(false)} className="material-symbols-outlined">close</button>
              </div>
              <form onSubmit={handleOpenCash} className="p-8 space-y-6">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase px-2">Operador Responsável</label>
                    <select required value={selectedRegister} onChange={e => setSelectedRegister(e.target.value)} className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 text-[11px] font-black uppercase">
                       <option value="">Selecione o Operador...</option>
                       {availableCashiers.map((u, idx) => (<option key={u.id} value={`CX ${idx + 1} - ${u.name}`}>CAIXA {idx + 1} - {u.name}</option>))}
                    </select>
                 </div>
                 <div className="p-4 bg-emerald-500/5 border border-emerald-500/10 rounded-xl">
                    <p className="text-[9px] font-black text-emerald-600 uppercase mb-2">Fundo Sugerido (Saldo Acumulado)</p>
                    <p className="text-sm font-black text-slate-900 dark:text-white">R$ {totalCumulativeBalance.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase px-2">Confirmar Fundo em Gaveta (R$)</label>
                    <input autoFocus type="number" step="0.01" required value={openingValue} onChange={e => setOpeningValue(parseFloat(e.target.value) || 0)} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-6 text-2xl font-black text-emerald-600 text-center" placeholder="0,00" />
                 </div>
                 <button type="submit" disabled={availableCashiers.length === 0} className="w-full h-16 bg-primary text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-primary/20 hover:scale-105 transition-all">INICIAR TURNO AGORA</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default CashMovement;
