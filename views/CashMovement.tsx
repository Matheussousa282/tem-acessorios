
import React, { useState, useMemo, useEffect } from 'react';
import { useApp, CashEntry } from '../AppContext';
import { CashSession, CashSessionStatus, UserRole } from '../types';
import { useNavigate } from 'react-router-dom';

const CashMovement: React.FC = () => {
  const { cashSessions, cashEntries, transactions, establishments, currentUser, saveCashSession, addCashEntry, users } = useApp();
  const navigate = useNavigate();
  const [filter, setFilter] = useState('');
  
  const isAdmin = currentUser?.role === UserRole.ADMIN;
  
  // Controle de Visão (Lista ou Detalhe)
  const [viewingSession, setViewingSession] = useState<CashSession | null>(null);
  const [activeTab, setActiveTab] = useState<'lançamentos' | 'auditoria'>('lançamentos');

  // Modais
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [showEntryModal, setShowEntryModal] = useState<{show: boolean, type: 'INCOME' | 'EXPENSE' | 'TRANSFER'}>({show: false, type: 'INCOME'});
  
  // Campos de Formulário
  const [openingValue, setOpeningValue] = useState(0);
  const [selectedRegister, setSelectedRegister] = useState('');
  const [entryForm, setEntryForm] = useState({ description: '', value: 0, category: 'Ajuste Manual' });

  const currentStore = establishments.find(e => e.id === currentUser?.storeId);

  // Efeito para buscar o saldo do último caixa fechado ao abrir o modal de abertura
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
    return users.filter(u => u.role === UserRole.CASHIER && (isAdmin || u.storeId === currentUser?.storeId));
  }, [users, isAdmin, currentUser]);

  const filteredSessions = useMemo(() => {
    return cashSessions.filter(s => {
      const belongsToStore = isAdmin || s.storeId === currentUser?.storeId;
      const matchesFilter = filter === '' || 
        s.registerName.toLowerCase().includes(filter.toLowerCase());
      return belongsToStore && matchesFilter;
    });
  }, [cashSessions, filter, isAdmin, currentUser]);

  // Cálculos da Sessão Selecionada
  const sessionData = useMemo(() => {
    if (!viewingSession) return null;

    // 1. Vendas do PDV durante a sessão
    const sessionVendas = transactions.filter(t => 
      t.store === viewingSession.storeName && 
      t.type === 'INCOME' &&
      (t.category === 'Venda' || t.category === 'Serviço') &&
      t.date === viewingSession.openingTime?.split(' ')[0].split('/').reverse().join('-')
    );

    // 2. Lançamentos Manuais
    const sessionManualEntries = cashEntries.filter(e => e.sessionId === viewingSession.id);

    // 3. Agrupamento por Forma de Pagamento (Para o Relatório)
    const resumoPagamentos: Record<string, number> = {};
    sessionVendas.forEach(v => {
       const method = v.method || 'NÃO INF.';
       resumoPagamentos[method] = (resumoPagamentos[method] || 0) + v.value;
    });

    // 4. Totais
    const totalVendas = sessionVendas.reduce((acc, t) => acc + t.value, 0);
    const totalEntradasManuais = sessionManualEntries.filter(e => e.type === 'INCOME').reduce((acc, e) => acc + e.value, 0);
    const totalSaidasManuais = sessionManualEntries.filter(e => e.type === 'EXPENSE').reduce((acc, e) => acc + e.value, 0);

    const saldoAnterior = viewingSession.openingValue || 0;
    const totalEntradas = totalVendas + totalEntradasManuais;
    const totalSaidas = totalSaidasManuais;
    const saldoFinal = saldoAnterior + totalEntradas - totalSaidas;

    // Merge para a tabela
    const allRecords = [
      ...sessionVendas.map(v => ({
        id: v.id,
        type: 'INCOME',
        natureza: 'E',
        description: `Venda PDV - ${v.method}`,
        value: v.value,
        timestamp: v.date,
        method: v.method,
        cat: 'VENDA'
      })),
      ...sessionManualEntries.map(e => ({
        id: e.id,
        type: e.type,
        natureza: e.type === 'INCOME' ? 'E' : e.type === 'EXPENSE' ? 'S' : 'T',
        description: e.description,
        value: e.value,
        timestamp: e.timestamp,
        method: e.method || 'CAIXA',
        cat: e.category
      }))
    ].sort((a, b) => b.id.localeCompare(a.id));

    return { allRecords, saldoAnterior, totalEntradas, totalSaidas, saldoFinal, resumoPagamentos, totalVendas };
  }, [viewingSession, transactions, cashEntries]);

  const handleOpenCash = async (e: React.FormEvent) => {
    e.preventDefault();
    const newSession: CashSession = {
      id: `${Date.now()}`,
      storeId: currentUser?.storeId || 'matriz',
      storeName: currentStore?.name || 'Matriz',
      registerName: selectedRegister,
      openingTime: new Date().toLocaleString('pt-BR'),
      openingOperatorId: currentUser?.id,
      openingOperatorName: currentUser?.name,
      openingValue: openingValue,
      status: CashSessionStatus.OPEN,
      priceTable: 'Tabela Padrão'
    };
    await saveCashSession(newSession);
    setShowOpeningModal(false);
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
  };

  const handleCloseCash = async () => {
    if (!viewingSession || !sessionData) return;
    if (confirm(`DESEJA REALMENTE FECHAR ESTE CAIXA?\nSaldo Final: R$ ${sessionData.saldoFinal.toLocaleString('pt-BR')}`)) {
      const closedSession: CashSession = {
        ...viewingSession,
        status: CashSessionStatus.CLOSED,
        closingTime: new Date().toLocaleString('pt-BR'),
        closingOperatorId: currentUser?.id,
        closingOperatorName: currentUser?.name,
        closingValue: sessionData.saldoFinal
      };
      await saveCashSession(closedSession);
      setViewingSession(null);
    }
  };

  // TELA DE DETALHE (VISUALIZAR)
  if (viewingSession) {
    return (
      <div className="p-6 space-y-6 animate-in slide-in-from-right-10 duration-500 pb-20">
        
        {/* TEMPLATE DE IMPRESSÃO (Oculto na tela, visível no print) */}
        <div id="cash-report-print" className="hidden print:block bg-white text-black font-sans p-4 text-[10px]">
           <div className="border-b-2 border-black pb-2 mb-4">
              <h1 className="font-black uppercase text-xs">Dados do Movimento</h1>
              <div className="grid grid-cols-2 gap-4 mt-2">
                 <div>
                    <p>DATA/HORA ABERTURA: {viewingSession.openingTime}</p>
                    <p>OPERADOR: {viewingSession.openingOperatorName?.toUpperCase()}</p>
                 </div>
                 <div>
                    <p>DATA/HORA FECHAMENTO: {viewingSession.closingTime || '---'}</p>
                    <p>OPERADOR: {viewingSession.closingOperatorName?.toUpperCase() || '---'}</p>
                 </div>
              </div>
           </div>

           <div className="bg-slate-700 text-white p-1 text-center font-black uppercase mb-4 print:bg-slate-200 print:text-black print:border">
              CAIXA: {viewingSession.id.slice(-4)} - {viewingSession.registerName?.toUpperCase()}
           </div>

           <div className="grid grid-cols-2 gap-4 mb-4">
              <table className="w-full border-collapse">
                 <thead className="bg-slate-100 border"><tr><th colSpan={3} className="p-1 uppercase">Aberturas</th></tr></thead>
                 <tbody className="border">
                    <tr className="text-[8px] border-b font-black uppercase bg-slate-50">
                       <td className="p-1">ID</td><td className="p-1">DATA/HORA</td><td className="p-1">OPERADOR</td>
                    </tr>
                    <tr>
                       <td className="p-1">{viewingSession.id.slice(-5)}</td>
                       <td className="p-1">{viewingSession.openingTime}</td>
                       <td className="p-1 truncate">{viewingSession.openingOperatorName}</td>
                    </tr>
                 </tbody>
              </table>
              <table className="w-full border-collapse">
                 <thead className="bg-slate-100 border"><tr><th colSpan={3} className="p-1 uppercase">Fechamentos</th></tr></thead>
                 <tbody className="border">
                    <tr className="text-[8px] border-b font-black uppercase bg-slate-50">
                       <td className="p-1">ID</td><td className="p-1">DATA/HORA</td><td className="p-1">OPERADOR</td>
                    </tr>
                    {viewingSession.status === CashSessionStatus.CLOSED && (
                       <tr>
                          <td className="p-1">{viewingSession.id.slice(-5)}</td>
                          <td className="p-1">{viewingSession.closingTime}</td>
                          <td className="p-1 truncate">{viewingSession.closingOperatorName}</td>
                       </tr>
                    )}
                 </tbody>
              </table>
           </div>

           <div className="bg-slate-700 text-white p-1 text-center font-black uppercase mb-2 print:bg-slate-200 print:text-black print:border">
              Lançamentos do Dia
           </div>

           <div className="grid grid-cols-2 gap-4 mb-4">
              <table className="w-full border-collapse">
                 <thead className="bg-slate-100 border"><tr><th colSpan={2} className="p-1 uppercase">Entradas</th></tr></thead>
                 <tbody className="border">
                    <tr className="text-[8px] border-b font-black uppercase bg-slate-50"><td className="p-1">CLASSIFICAÇÃO</td><td className="p-1 text-right">VALOR</td></tr>
                    <tr><td className="p-1">VENDAS PDV</td><td className="p-1 text-right">R$ {sessionData?.totalVendas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td></tr>
                    <tr className="font-black border-t"><td className="p-1">TOTAIS</td><td className="p-1 text-right">R$ {sessionData?.totalEntradas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td></tr>
                 </tbody>
              </table>
              <table className="w-full border-collapse">
                 <thead className="bg-slate-100 border"><tr><th colSpan={2} className="p-1 uppercase">Saídas</th></tr></thead>
                 <tbody className="border">
                    <tr className="text-[8px] border-b font-black uppercase bg-slate-50"><td className="p-1">CLASSIFICAÇÃO</td><td className="p-1 text-right">VALOR</td></tr>
                    <tr><td className="p-1">SANGRIAS / PAGOS</td><td className="p-1 text-right">R$ {sessionData?.totalSaidas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td></tr>
                    <tr className="font-black border-t"><td className="p-1">TOTAIS</td><td className="p-1 text-right">R$ {sessionData?.totalSaidas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td></tr>
                 </tbody>
              </table>
           </div>

           <div className="bg-slate-700 text-white p-1 text-center font-black uppercase mb-2 print:bg-slate-200 print:text-black print:border">
              Resumo das Vendas do Dia
           </div>
           <table className="w-full border-collapse mb-4 border">
              <thead className="bg-slate-100"><tr className="border-b"><th className="p-1 text-left uppercase">Forma de Pagamento</th><th className="p-1 text-right uppercase">Valor</th></tr></thead>
              <tbody>
                 {Object.entries(sessionData?.resumoPagamentos || {}).map(([method, val]) => (
                   <tr key={method} className="border-b">
                      <td className="p-1 uppercase font-bold">{method}</td>
                      <td className="p-1 text-right tabular-nums">R$ {val.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                   </tr>
                 ))}
                 <tr className="font-black bg-slate-50">
                    <td className="p-1">TOTAIS</td>
                    <td className="p-1 text-right tabular-nums">R$ {sessionData?.totalVendas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                 </tr>
              </tbody>
           </table>

           <div className="bg-slate-700 text-white p-1 text-center font-black uppercase mb-2 print:bg-slate-200 print:text-black print:border">
              Outras Operações
           </div>
           <div className="space-y-1">
              <div className="bg-black text-white p-1 flex justify-between font-black uppercase print:bg-white print:text-black print:border"><span>Saldo Anterior:</span><span>R$ {sessionData?.saldoAnterior.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
              <div className="bg-black text-white p-1 flex justify-between font-black uppercase print:bg-white print:text-black print:border"><span>Total Entradas:</span><span>R$ {sessionData?.totalEntradas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
              <div className="bg-black text-white p-1 flex justify-between font-black uppercase print:bg-white print:text-black print:border"><span>Total Saídas:</span><span>R$ {sessionData?.totalSaidas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
              <div className="bg-black text-white p-2 flex justify-between font-black uppercase text-xs border-t-2 border-amber-500 print:bg-white print:text-black print:border"><span>Saldo Final do Dia:</span><span>R$ {sessionData?.saldoFinal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
           </div>
           
           <p className="mt-10 text-center opacity-30 text-[8px] uppercase font-black">Sistema ERP Retail - Relatório de Conferência de Caixa</p>
        </div>

        {/* HEADER DETALHE */}
        <div className="flex justify-between items-start bg-slate-50 dark:bg-slate-900/40 p-4 rounded-xl border border-slate-200 dark:border-slate-800 print:hidden">
           <div className="space-y-4">
              <h2 className="text-xl font-black text-slate-800 dark:text-white uppercase flex items-center gap-2">
                 <span className="material-symbols-outlined text-primary">visibility</span> Caixas - Visualizar
              </h2>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-8 gap-y-2">
                 <div className="flex flex-col"><span className="text-[10px] font-black text-slate-400 uppercase">ID:</span><span className="text-xs font-bold text-slate-600">{viewingSession.id}</span></div>
                 <div className="flex flex-col"><span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loja:</span><span className="text-xs font-bold text-primary uppercase">{viewingSession.storeName}</span></div>
                 <div className="flex flex-col"><span className="text-[10px] font-black text-slate-400 uppercase">PDV:</span><span className="text-xs font-bold text-slate-600 uppercase">{viewingSession.registerName}</span></div>
                 <div className="flex flex-col"><span className="text-[10px] font-black text-slate-400 uppercase">Caixa:</span><span className="text-xs font-bold text-slate-600 uppercase">{viewingSession.openingOperatorName}</span></div>
              </div>
           </div>
           <div className="flex gap-2">
              <button onClick={() => window.print()} className="px-4 py-2 bg-amber-500 text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-amber-500/20 hover:scale-105 transition-all">
                 <span className="material-symbols-outlined text-sm">print</span> Imprimir Relatório
              </button>
              <button onClick={() => setViewingSession(null)} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 rounded-lg text-[10px] font-black uppercase flex items-center gap-2 shadow-sm"><span className="material-symbols-outlined text-sm">arrow_back</span> Voltar</button>
           </div>
        </div>

        {/* CORPO DO DETALHE */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm flex flex-col min-h-[600px] print:hidden">
           {/* SUB-MENU TABS */}
           <div className="flex border-b border-slate-100 dark:border-slate-800 p-2 gap-1 bg-slate-50/50">
              <button onClick={() => setActiveTab('lançamentos')} className={`px-6 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'lançamentos' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Lançamentos</button>
              <button onClick={() => setActiveTab('auditoria')} className={`px-6 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'auditoria' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Aberturas/Fechamentos</button>
              
              <div className="ml-auto">
                 {viewingSession.status === CashSessionStatus.OPEN && (
                    <button onClick={handleCloseCash} className="px-10 py-2 bg-white dark:bg-slate-800 border-2 border-emerald-500 text-emerald-600 rounded-xl text-[14px] font-black uppercase shadow-lg hover:bg-emerald-500 hover:text-white transition-all">FECHAR CAIXA</button>
                 )}
              </div>
           </div>

           {activeTab === 'lançamentos' ? (
             <>
               <div className="p-4 flex flex-wrap items-center gap-2 bg-slate-50/20">
                  <button disabled={viewingSession.status === CashSessionStatus.CLOSED} onClick={() => setShowEntryModal({show: true, type: 'INCOME'})} className="px-4 py-2 bg-primary text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-2 shadow-lg disabled:opacity-50"><span className="material-symbols-outlined text-sm">add</span> Registrar Entrada</button>
                  <button disabled={viewingSession.status === CashSessionStatus.CLOSED} onClick={() => setShowEntryModal({show: true, type: 'EXPENSE'})} className="px-4 py-2 bg-primary text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-2 shadow-lg disabled:opacity-50"><span className="material-symbols-outlined text-sm">remove</span> Registrar Saída</button>
                  <button disabled={viewingSession.status === CashSessionStatus.CLOSED} onClick={() => setShowEntryModal({show: true, type: 'TRANSFER'})} className="px-4 py-2 bg-primary text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-2 shadow-lg disabled:opacity-50"><span className="material-symbols-outlined text-sm">sync_alt</span> Registrar Transferência</button>
                  <div className="flex-1 ml-4 relative">
                     <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-sm">search</span>
                     <input placeholder="FILTRAGEM RÁPIDA..." className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg pl-10 text-[9px] font-black uppercase h-9 focus:ring-1 focus:ring-primary/20" />
                  </div>
               </div>

               <div className="flex-1 overflow-auto">
                  <table className="w-full text-left text-[11px] font-bold border-collapse">
                     <thead className="bg-primary text-white sticky top-0 z-10">
                        <tr>
                           <th className="px-4 py-2.5 w-10 text-center"><span className="material-symbols-outlined text-sm">settings</span></th>
                           <th className="px-4 py-2.5">ID</th>
                           <th className="px-4 py-2.5">Caixa/Banco</th>
                           <th className="px-4 py-2.5">Dt. Lançamento</th>
                           <th className="px-4 py-2.5 text-center">Nat.</th>
                           <th className="px-4 py-2.5 text-right">Valor Total</th>
                           <th className="px-4 py-2.5">Documento</th>
                           <th className="px-4 py-2.5">Conta Contábil</th>
                           <th className="px-4 py-2.5">Histórico</th>
                           <th className="px-4 py-2.5 text-right">Opções</th>
                        </tr>
                     </thead>
                     <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        <tr className="bg-slate-50/80 font-black text-slate-400">
                           <td className="px-4 py-2" colSpan={5}>TOTAL</td>
                           <td className="px-4 py-2 text-right text-slate-900">{sessionData?.saldoFinal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                           <td colSpan={4}></td>
                        </tr>
                        {sessionData?.allRecords.map(record => (
                          <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                             <td className="px-4 py-2.5 text-center"><span className="material-symbols-outlined text-xs opacity-30">drag_indicator</span></td>
                             <td className="px-4 py-2.5 font-mono text-slate-400">{record.id.slice(-5)}</td>
                             <td className="px-4 py-2.5 uppercase">{viewingSession.registerName}</td>
                             <td className="px-4 py-2.5">{record.timestamp}</td>
                             <td className="px-4 py-2.5 text-center">
                                <span className={`size-5 rounded-full inline-flex items-center justify-center text-[9px] text-white font-black ${record.natureza === 'E' ? 'bg-emerald-500' : record.natureza === 'S' ? 'bg-rose-500' : 'bg-blue-500'}`}>{record.natureza}</span>
                             </td>
                             <td className={`px-4 py-2.5 text-right font-black ${record.type === 'INCOME' ? 'text-emerald-600' : 'text-rose-600'}`}>{record.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                             <td className="px-4 py-2.5 text-slate-400 uppercase font-medium">{record.method || 'TICK-01'}</td>
                             <td className="px-4 py-2.5 text-slate-400 uppercase font-medium">{record.cat}</td>
                             <td className="px-4 py-2.5 text-slate-500 uppercase font-medium truncate max-w-[200px]">{record.description}</td>
                             <td className="px-4 py-2.5 text-right"><span className="material-symbols-outlined text-sm text-slate-300">more_horiz</span></td>
                          </tr>
                        ))}
                     </tbody>
                  </table>
               </div>
             </>
           ) : (
             <div className="p-10 space-y-10">
                <div className="grid grid-cols-2 gap-8">
                   <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100">
                      <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Informações de Abertura</h4>
                      <p className="text-sm font-bold uppercase">Operador: {viewingSession.openingOperatorName}</p>
                      <p className="text-sm font-bold uppercase">Data/Hora: {viewingSession.openingTime}</p>
                      <p className="text-sm font-black text-primary mt-2">Valor Inicial: R$ {viewingSession.openingValue?.toLocaleString('pt-BR')}</p>
                   </div>
                   <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-2xl border border-slate-100">
                      <h4 className="text-[10px] font-black uppercase text-slate-400 mb-4 tracking-widest">Informações de Fechamento</h4>
                      {viewingSession.status === CashSessionStatus.CLOSED ? (
                        <>
                          <p className="text-sm font-bold uppercase">Conferente: {viewingSession.closingOperatorName}</p>
                          <p className="text-sm font-bold uppercase">Data/Hora: {viewingSession.closingTime}</p>
                          <p className="text-sm font-black text-emerald-600 mt-2">Saldo Final: R$ {viewingSession.closingValue?.toLocaleString('pt-BR')}</p>
                        </>
                      ) : (
                        <p className="text-xs font-black uppercase text-rose-500 opacity-50 flex items-center gap-2"><span className="material-symbols-outlined text-sm animate-pulse">lock_open</span> Movimentação em aberto</p>
                      )}
                   </div>
                </div>
             </div>
           )}
        </div>

        {/* RODAPÉ DE RESUMO (IGUAL À IMAGEM) */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 print:hidden">
           <div className="bg-black text-white p-3 rounded-lg flex flex-col items-center">
              <span className="text-[10px] font-black uppercase text-amber-500">Saldo Anterior:</span>
              <span className="text-lg font-black tracking-tighter tabular-nums">R$ {sessionData?.saldoAnterior.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
           </div>
           <div className="bg-black text-white p-3 rounded-lg flex flex-col items-center">
              <span className="text-[10px] font-black uppercase text-amber-500">Total Entradas:</span>
              <span className="text-lg font-black tracking-tighter tabular-nums">R$ {sessionData?.totalEntradas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
           </div>
           <div className="bg-black text-white p-3 rounded-lg flex flex-col items-center">
              <span className="text-[10px] font-black uppercase text-amber-500">Total Saídas:</span>
              <span className="text-lg font-black tracking-tighter tabular-nums">R$ {sessionData?.totalSaidas.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
           </div>
           <div className="bg-black text-white p-3 rounded-lg flex flex-col items-center border-l-4 border-amber-500">
              <span className="text-[10px] font-black uppercase text-amber-500">Saldo Final do Dia:</span>
              <span className="text-lg font-black tracking-tighter tabular-nums">R$ {sessionData?.saldoFinal.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
           </div>
        </div>

        {/* MODAL LANÇAMENTO MANUAL */}
        {showEntryModal.show && (
           <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-300 print:hidden">
              <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
                 <div className={`p-6 text-white flex justify-between items-center ${showEntryModal.type === 'INCOME' ? 'bg-emerald-500' : showEntryModal.type === 'EXPENSE' ? 'bg-rose-500' : 'bg-blue-500'}`}>
                    <h3 className="font-black uppercase tracking-tight">Novo Lançamento de {showEntryModal.type === 'INCOME' ? 'Entrada' : showEntryModal.type === 'EXPENSE' ? 'Saída' : 'Transferência'}</h3>
                    <button onClick={() => setShowEntryModal({...showEntryModal, show: false})}><span className="material-symbols-outlined">close</span></button>
                 </div>
                 <form onSubmit={handleAddEntry} className="p-8 space-y-4">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Valor (R$)</label>
                       <input autoFocus type="number" step="0.01" required value={entryForm.value} onChange={e => setEntryForm({...entryForm, value: parseFloat(e.target.value) || 0})} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-6 text-xl font-black text-primary" placeholder="0,00" />
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Motivo / Histórico</label>
                       <textarea required rows={3} value={entryForm.description} onChange={e => setEntryForm({...entryForm, description: e.target.value})} className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-xl p-4 text-xs font-bold uppercase" placeholder="Descreva o motivo da operação..." />
                    </div>
                    <button type="submit" className={`w-full h-14 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl mt-4 ${showEntryModal.type === 'INCOME' ? 'bg-emerald-500' : showEntryModal.type === 'EXPENSE' ? 'bg-rose-500' : 'bg-blue-500'}`}>Confirmar Lançamento</button>
                 </form>
              </div>
           </div>
        )}
      </div>
    );
  }

  // LISTA DE SESSÕES (TELA INICIAL)
  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 pb-24">
      
      {/* CABEÇALHO ATUALIZADO */}
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
           <button className="px-4 py-2 bg-slate-200 dark:bg-slate-800 text-slate-500 rounded-lg text-[10px] font-black uppercase flex items-center gap-2">Histórico</button>
           <button className="px-4 py-2 bg-primary text-white rounded-lg text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-primary/20">Arquivos</button>
           <button onClick={() => window.history.back()} className="px-4 py-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 rounded-lg text-[10px] font-black uppercase">Voltar</button>
        </div>
      </div>

      {/* FILTROS RÁPIDOS */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-4 rounded-xl shadow-sm">
         <div className="relative">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-lg">search</span>
            <input 
              value={filter}
              onChange={e => setFilter(e.target.value)}
              placeholder="BUSCAR MOVIMENTAÇÃO PELO NOME DO CAIXA..." 
              className="w-full bg-slate-50 dark:bg-slate-800 border-none rounded-lg pl-10 text-[10px] font-black uppercase focus:ring-1 focus:ring-primary/20 h-10" 
            />
         </div>
      </div>

      {/* TABELA DE MOVIMENTAÇÕES */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden shadow-sm">
         <div className="overflow-x-auto">
            <table className="w-full text-left text-[11px] font-bold">
               <thead className="bg-primary text-white">
                  <tr>
                     <th className="px-4 py-3 w-10 text-center"><span className="material-symbols-outlined text-sm">settings</span></th>
                     <th className="px-4 py-3">ID</th>
                     <th className="px-4 py-3">Terminal / Operador de Caixa</th>
                     <th className="px-4 py-3">Data/Hora Abertura</th>
                     <th className="px-4 py-3">Data/Hora Fechamento</th>
                     <th className="px-4 py-3">Operador Fechamento</th>
                     <th className="px-4 py-3 text-right">Opções</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {filteredSessions.map(session => (
                    <tr key={session.id} onClick={() => setViewingSession(session)} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer group">
                       <td className="px-4 py-3 text-center">
                          <span className={`size-2.5 rounded-full inline-block ${session.status === CashSessionStatus.OPEN ? 'bg-emerald-500' : session.status === CashSessionStatus.CLOSED ? 'bg-blue-500' : 'bg-rose-500'}`}></span>
                       </td>
                       <td className="px-4 py-3 font-mono text-slate-400">{session.id}</td>
                       <td className="px-4 py-3 uppercase text-slate-900 dark:text-white group-hover:text-primary transition-colors">{session.registerName}</td>
                       <td className="px-4 py-3 text-slate-400">{session.openingTime || '--:--'}</td>
                       <td className="px-4 py-3 text-slate-400">{session.closingTime || '--:--'}</td>
                       <td className="px-4 py-3 uppercase text-slate-400">{session.closingOperatorName || '---'}</td>
                       <td className="px-4 py-3 text-right">
                          <button className="text-primary hover:underline uppercase text-[9px] font-black">Visualizar</button>
                       </td>
                    </tr>
                  ))}
                  {filteredSessions.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-10 text-center opacity-30 font-black uppercase text-[10px] tracking-widest">Nenhuma movimentação para o filtro atual</td>
                    </tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {/* RODAPÉ DE STATUS */}
      <div className="flex gap-4">
         <div className="bg-white dark:bg-slate-900 px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg text-[9px] font-black uppercase">Registros: {filteredSessions.length}</div>
         <div className="bg-white dark:bg-slate-900 px-4 py-2 border border-slate-200 dark:border-slate-800 rounded-lg flex gap-4 text-[9px] font-black uppercase">
            <span>Legenda:</span>
            <div className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-rose-500"></span> Pendente</div>
            <div className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-emerald-500"></span> Operando</div>
            <div className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-blue-500"></span> Finalizado</div>
         </div>
      </div>

      {/* MODAL DE ABERTURA */}
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
                    <div className="w-full h-12 bg-slate-100 dark:bg-slate-800 rounded-xl px-4 flex items-center text-xs font-black uppercase text-primary border border-primary/10">
                       {currentStore?.name || 'Unidade não identificada'}
                    </div>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Selecionar Terminal de Caixa</label>
                    <select required value={selectedRegister} onChange={e => setSelectedRegister(e.target.value)} className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 text-xs font-black uppercase">
                       <option value="">Selecione o Operador...</option>
                       {availableCashiers.map((u, idx) => (
                         <option key={u.id} value={`Caixa ${idx + 1} - ${u.name}`}>Caixa {idx + 1} - {u.name}</option>
                       ))}
                    </select>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Fundo de Troco Inicial (R$)</label>
                    <p className="text-[8px] text-slate-400 uppercase px-2 mb-1">Puxado automaticamente do último fechamento</p>
                    <input autoFocus type="number" step="0.01" required value={openingValue} onChange={e => setOpeningValue(parseFloat(e.target.value) || 0)} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-6 text-xl font-black text-emerald-600" placeholder="0,00" />
                 </div>
                 <button type="submit" disabled={availableCashiers.length === 0} className="w-full h-14 bg-primary text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl disabled:opacity-30">Confirmar Abertura</button>
              </form>
           </div>
        </div>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #root { display: none !important; }
          #cash-report-print, #cash-report-print * { visibility: visible !important; }
          #cash-report-print {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            display: block !important;
            background: white !important;
            color: black !important;
          }
          @page { size: auto; margin: 10mm; }
        }
      `}</style>
    </div>
  );
};

export default CashMovement;
