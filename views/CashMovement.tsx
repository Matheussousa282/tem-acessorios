
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
  
  const [openingValue, setOpeningValue] = useState(0);
  const [selectedRegister, setSelectedRegister] = useState('');

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

    const resumoCartoes: Record<string, { count: number, value: number }> = {};
    sessionVendas.forEach(v => {
       if (v.method === 'Credito' || v.method === 'Debito' || v.method === 'Pix') {
          const methodKey = v.method === 'Pix' ? 'PIX' : v.method.toUpperCase();
          const op = cardOperators.find(o => o.id === v.cardOperatorId)?.name || '';
          const br = cardBrands.find(b => b.id === v.cardBrandId)?.name || '';
          const key = op && br ? `${methodKey}: ${op} / ${br}` : methodKey;
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
      <div className="p-6 space-y-6 animate-in slide-in-from-right-10 duration-500 pb-20 print:p-0">
        
        {/* RELATÓRIO DE IMPRESSÃO (ESTILO EXATO DO PRINT) */}
        <div id="cash-report-print" className="hidden print:block bg-white text-black font-sans text-[10px] leading-tight w-full max-w-[210mm] mx-auto p-4">
           {/* CABEÇALHO SUPERIOR */}
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

           {/* FAIXA AZUL CENTRAL - CAIXA */}
           <div className="bg-[#136dec] text-white p-1.5 text-center font-black uppercase mb-4 text-[11px] print:bg-[#136dec] print:text-white">
              CAIXA: {viewingSession.id.slice(-4)} - {viewingSession.openingOperatorName?.toUpperCase()}
           </div>

           {/* SEÇÃO: LANÇAMENTOS DO DIA */}
           <div className="text-center font-black uppercase mb-2 text-[10px]">
              LANÇAMENTOS DO DIA (VALORES EM ESPÉCIE / GAVETA)
           </div>

           <div className="flex gap-4 mb-6">
              {/* TABELA ESQUERDA: CLASSIFICAÇÃO */}
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

              {/* TABELA DIREITA: SAÍDAS */}
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
                          <td className="p-1 text-right tabular-nums">R$ {Number(sessionData?.totalSaidasCaixa || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                       </tr>
                       <tr className="font-black">
                          <td className="p-1 border-r border-black uppercase">TOTAL SANGRIAS</td>
                          <td className="p-1 text-right">R$ {Number(sessionData?.totalSaidasCaixa || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                       </tr>
                    </tbody>
                 </table>
              </div>
           </div>

           {/* FAIXA AZUL: RESUMO MEIO PAGAMENTO */}
           <div className="bg-[#136dec] text-white p-1.5 text-center font-black uppercase mb-2 text-[10px] print:bg-[#136dec] print:text-white">
              RESUMO POR MEIO DE PAGAMENTO (CARTÕES / OUTROS)
           </div>
           <table className="w-full border-collapse border border-black mb-6">
              <thead>
                 <tr className="border-b border-black">
                    <th className="p-1 text-left uppercase border-r border-black font-black text-[9px]">Forma / Operadora / Bandeira</th>
                    <th className="p-1 text-center uppercase border-r border-black font-black text-[9px] w-28">Qtd. Notas</th>
                    <th className="p-1 text-right uppercase font-black text-[9px] w-36">Total Bruto</th>
                 </tr>
              </thead>
              <tbody>
                 {Object.entries(sessionData?.resumoCartoes || {}).map(([key, data]) => (
                    <tr key={key} className="border-b border-black font-bold">
                       <td className="p-1 uppercase border-r border-black">{key}</td>
                       <td className="p-1 text-center border-r border-black">{data.count}</td>
                       <td className="p-1 text-right tabular-nums">R$ {data.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    </tr>
                 ))}
                 {Object.keys(sessionData?.resumoCartoes || {}).length === 0 && <tr><td colSpan={3} className="p-4 text-center opacity-30 uppercase italic font-bold">Sem movimentação de cartões</td></tr>}
              </tbody>
           </table>

           {/* FAIXA AZUL: LISTAGEM ANALÍTICA */}
           <div className="bg-[#136dec] text-white p-1.5 text-center font-black uppercase mb-2 text-[10px] print:bg-[#136dec] print:text-white">
              LISTAGEM ANALÍTICA DAS VENDAS
           </div>
           <table className="w-full border-collapse border border-black mb-6">
              <thead>
                 <tr className="border-b border-black">
                    <th className="p-1 text-left uppercase border-r border-black font-black text-[8px] w-[180px]">Cliente</th>
                    <th className="p-1 text-left uppercase border-r border-black font-black text-[8px] w-[220px]">Forma / Operadora</th>
                    <th className="p-1 text-center uppercase border-r border-black font-black text-[8px] w-16">Parcelas</th>
                    <th className="p-1 text-right uppercase font-black text-[8px]">Valor Líquido</th>
                 </tr>
              </thead>
              <tbody>
                 {sessionData?.allRecords.filter(r => r.cat === 'VENDA').map((v, idx) => (
                    <tr key={idx} className="border-b border-black font-bold">
                       <td className="p-1 uppercase border-r border-black truncate">{v.client}</td>
                       <td className="p-1 uppercase border-r border-black">{v.method} {v.operator ? `/ ${v.operator}` : ''}</td>
                       <td className="p-1 text-center border-r border-black">{v.installments}x</td>
                       <td className="p-1 text-right tabular-nums">R$ {v.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                    </tr>
                 ))}
              </tbody>
           </table>

           {/* RODAPÉ TOTAL FATURADO */}
           <div className="border-t-[3px] border-[#f59e0b] pt-1 mt-2">
              <div className="flex justify-between font-black uppercase text-[11px] py-2">
                 <span className="text-slate-400">VALOR TOTAL FATURADO (TODOS MEIOS):</span>
                 <span className="text-black text-[13px]">R$ {Number(sessionData?.totalVendasBruto || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
              </div>
           </div>
           
           <div className="mt-12 text-center opacity-40 text-[7px] uppercase font-black">
              TEM ACESSÓRIOS ERP - SISTEMA DE GESTÃO - {new Date().toLocaleString('pt-BR')}
           </div>
        </div>

        {/* INTERFACE DE TELA (PRINT:HIDDEN) */}
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
              <button onClick={() => setActiveTab('auditoria')} className={`px-6 py-2 text-[10px] font-black uppercase rounded-lg transition-all ${activeTab === 'auditoria' ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-slate-600'}`}>Resumo Cartões</button>
              
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
                         <th className="px-4 py-3 uppercase">Cliente</th>
                         <th className="px-4 py-3 uppercase">Forma / Operadora</th>
                         <th className="px-4 py-3 text-center uppercase">Parc.</th>
                         <th className="px-4 py-3 text-right uppercase">Valor Bruto</th>
                      </tr>
                   </thead>
                   <tbody className="divide-y divide-slate-100 dark:divide-slate-800 uppercase">
                      {sessionData?.allRecords.map(record => (
                        <tr key={record.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                           <td className="px-4 py-3 font-black text-slate-800 dark:text-white">{record.client}</td>
                           <td className="px-4 py-3 text-primary">{record.method} {record.operator ? `/ ${record.operator}` : ''}</td>
                           <td className="px-4 py-3 text-center text-slate-400">{record.installments}x</td>
                           <td className="px-4 py-3 text-right font-black tabular-nums">R$ {Number(record.value || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</td>
                        </tr>
                      ))}
                   </tbody>
                </table>
             </div>
           ) : (
             <div className="p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                   <div className="p-6 bg-slate-50 dark:bg-slate-800 rounded-3xl border border-slate-100 dark:border-slate-700">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Cartões e Outros Meios</h4>
                      <div className="space-y-4">
                         {Object.entries(sessionData?.resumoCartoes || {}).map(([key, data]) => (
                            <div key={key} className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700 pb-2">
                               <div className="flex flex-col"><span className="text-xs font-black uppercase">{key}</span><span className="text-[9px] font-bold text-slate-400">{data.count} Transações</span></div>
                               <span className="text-sm font-black text-primary">R$ {data.value.toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span>
                            </div>
                         ))}
                      </div>
                   </div>
                   <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-6">
                      <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Informações em Espécie</h4>
                      <div className="flex justify-between items-center"><span className="text-xs font-bold uppercase">Saldo Anterior (Fundo)</span><span className="text-xs font-black tabular-nums">R$ {Number(sessionData?.saldoAnterior || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                      <div className="flex justify-between items-center"><span className="text-xs font-bold uppercase">Vendas Dinheiro (+)</span><span className="text-xs font-black tabular-nums">R$ {Number(sessionData?.vendasEmDinheiro || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                      <div className="flex justify-between items-center pt-4 border-t border-white/10"><span className="text-sm font-black uppercase text-primary">Total em Gaveta</span><span className="text-sm font-black text-white tabular-nums">R$ {Number(sessionData?.saldoFinalCaixa || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</span></div>
                   </div>
                </div>
             </div>
           )}
        </div>

        <style>{`
          @media print {
            body * { visibility: hidden !important; }
            #root, main, .flex-1, .p-6 { visibility: hidden !important; display: block !important; height: auto !important; overflow: visible !important; margin: 0 !important; padding: 0 !important; }
            #cash-report-print, #cash-report-print * { visibility: visible !important; }
            #cash-report-print {
              position: absolute !important;
              left: 0 !important;
              top: 0 !important;
              width: 100% !important;
              max-width: 210mm !important;
              background: white !important;
              color: black !important;
              padding: 5mm !important;
              margin: 0 !important;
              box-sizing: border-box !important;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            #cash-report-print table { width: 100% !important; border: 1px solid black !important; border-collapse: collapse !important; }
            #cash-report-print th, #cash-report-print td { border: 1px solid black !important; padding: 4px !important; color: black !important; }
            #cash-report-print th { background-color: #f2f2f2 !important; font-weight: 900 !important; }
            #cash-report-print .bg-\\[\\#136dec\\] { background-color: #136dec !important; color: white !important; }
            #cash-report-print .border-b-black { border-bottom: 1px solid black !important; }
            #cash-report-print .border-black { border: 1px solid black !important; }
            #cash-report-print .grid { display: flex !important; gap: 4mm !important; }
            #cash-report-print .flex-1 { flex: 1 !important; }
            @page { size: A4 portrait; margin: 5mm; }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 pb-24">
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-8 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 shadow-sm">
        <div>
          <h2 className="text-2xl font-black text-slate-800 dark:text-white uppercase tracking-tight">Movimentação Diária de Caixas</h2>
          <p className="text-slate-500 text-[10px] font-black uppercase mt-1">Controle de abertura, fechamento e conferência</p>
        </div>
        <div className="flex gap-3">
           <button onClick={() => setShowOpeningModal(true)} className="px-6 py-3 bg-emerald-500 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg shadow-emerald-500/20 hover:scale-105 transition-all"><span className="material-symbols-outlined text-sm">add_circle</span> Abrir Novo Movimento</button>
           <button onClick={() => navigate('/relatorios?type=conferencia_caixa')} className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase flex items-center gap-2 shadow-lg hover:bg-black"><span className="material-symbols-outlined text-sm">monitoring</span> Auditoria Global</button>
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
               <thead className="bg-primary text-white uppercase">
                  <tr>
                     <th className="px-6 py-4 w-10 text-center">Status</th>
                     <th className="px-6 py-4">Caixa / Operador</th>
                     <th className="px-6 py-4">Data Abertura</th>
                     <th className="px-6 py-4">Data Fechamento</th>
                     <th className="px-6 py-4 text-right">Ação</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 dark:divide-slate-800 uppercase">
                  {filteredSessions.map(session => (
                    <tr key={session.id} onClick={() => setViewingSession(session)} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer group">
                       <td className="px-6 py-4 text-center"><span className={`size-3 rounded-full inline-block ${session.status === CashSessionStatus.OPEN ? 'bg-emerald-500 animate-pulse' : 'bg-blue-500'}`}></span></td>
                       <td className="px-6 py-4"><p className="text-slate-900 dark:text-white font-black group-hover:text-primary transition-colors">{session.registerName}</p><p className="text-[9px] text-slate-400">ID: {session.id}</p></td>
                       <td className="px-6 py-4 text-slate-500">{session.openingTime || '---'}</td>
                       <td className="px-6 py-4 text-slate-500">{session.closingTime || 'EM ABERTO'}</td>
                       <td className="px-6 py-4 text-right"><span className="text-primary hover:underline text-[9px] font-black">EXIBIR DETALHES</span></td>
                    </tr>
                  ))}
                  {filteredSessions.length === 0 && (
                    <tr><td colSpan={5} className="py-20 text-center opacity-30 font-black text-xs">NENHUM MOVIMENTO LOCALIZADO</td></tr>
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {showOpeningModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
           <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95">
              <div className="p-6 bg-primary text-white flex justify-between items-center">
                 <h3 className="font-black uppercase tracking-tight">Abertura de Terminal</h3>
                 <button onClick={() => setShowOpeningModal(false)}><span className="material-symbols-outlined">close</span></button>
              </div>
              <form onSubmit={handleOpenCash} className="p-8 space-y-6">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase px-2">Selecionar Terminal / Operador</label>
                    <select required value={selectedRegister} onChange={e => setSelectedRegister(e.target.value)} className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-4 text-[11px] font-black uppercase">
                       <option value="">Selecione...</option>
                       {availableCashiers.map((u, idx) => (<option key={u.id} value={`CAIXA ${idx + 1} - ${u.name}`}>CAIXA {idx + 1} - {u.name}</option>))}
                    </select>
                 </div>
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase px-2">Fundo de Caixa Inicial (R$)</label>
                    <input autoFocus type="number" step="0.01" required value={openingValue} onChange={e => setOpeningValue(parseFloat(e.target.value) || 0)} className="w-full h-14 bg-slate-50 dark:bg-slate-800 border-none rounded-xl px-6 text-xl font-black text-emerald-600" placeholder="0,00" />
                 </div>
                 <button type="submit" disabled={availableCashiers.length === 0} className="w-full h-14 bg-primary text-white rounded-xl font-black text-[11px] uppercase tracking-widest shadow-xl shadow-primary/20">CONFIRMAR ABERTURA</button>
              </form>
           </div>
        </div>
      )}
    </div>
  );
};

export default CashMovement;
