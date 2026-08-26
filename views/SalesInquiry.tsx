import React, { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { Transaction, UserRole } from '../types';

const SalesInquiry: React.FC = () => {
  const {
    transactions,
    users,
    customers,
    currentUser,
    establishments,
    addTransaction,
    cardOperators,
    cardBrands
  } = useApp();

  // =========================================================
  // FILTROS
  // =========================================================

  const [filter, setFilter] = useState('');

  const [startDate, setStartDate] = useState(
    new Date(
      new Date().setDate(new Date().getDate() - 30)
    ).toISOString().split('T')[0]
  );

  const [endDate, setEndDate] = useState(
    new Date().toISOString().split('T')[0]
  );

  const [storeFilter, setStoreFilter] = useState('TODAS');

  // =========================================================
  // ESTADOS
  // =========================================================

  const [selectedTransaction, setSelectedTransaction] =
    useState<Transaction | null>(null);

  const [showOptionsId, setShowOptionsId] =
    useState<string | null>(null);

  const [viewingDetail, setViewingDetail] =
    useState<Transaction | null>(null);

  const [activeDetailTab, setActiveDetailTab] =
    useState<'ITENS' | 'PAGAMENTO' | 'DEVOLUCOES'>('ITENS');

  const [showVendorModal, setShowVendorModal] =
    useState(false);

  const [showCustomerModal, setShowCustomerModal] =
    useState(false);

  // =========================================================
  // USUÁRIO / LOJA
  // =========================================================

  const isAdmin =
    currentUser?.role === UserRole.ADMIN ||
    currentUser?.role === UserRole.MANAGER;

  const currentStore = establishments.find(
    e => e.id === currentUser?.storeId
  );

  // =========================================================
  // VENDAS
  // =========================================================

  const sales = useMemo(() => {
    return transactions.filter(t => {

      const isSale =
        t.type === 'INCOME' &&
        (
          t.category === 'Venda' ||
          t.category === 'Serviço'
        );

      const matchesStore = isAdmin
        ? (
            storeFilter === 'TODAS' ||
            t.store === storeFilter
          )
        : (
            t.store === currentStore?.name
          );

      const matchesDate =
        t.date >= startDate &&
        t.date <= endDate;

      const search =
        filter.toLowerCase().trim();

      const matchesSearch =
        !search ||
        t.id.toLowerCase().includes(search) ||
        t.client?.toLowerCase().includes(search);

      return (
        isSale &&
        matchesStore &&
        matchesDate &&
        matchesSearch
      );
    });
  }, [
    transactions,
    isAdmin,
    currentStore,
    filter,
    startDate,
    endDate,
    storeFilter
  ]);

  // =========================================================
  // TOTAIS
  // =========================================================

  const totals = useMemo(() => {

    let qtyItems = 0;
    let totalValue = 0;

    sales.forEach(s => {

      totalValue += Number(s.value || 0);

      s.items?.forEach(i => {
        qtyItems += Number(i.quantity || 0);
      });

    });

    return {
      qtyItems,
      totalValue
    };

  }, [sales]);

  // =========================================================
  // USUÁRIO
  // =========================================================

  const getUserData = (userId?: string) => {
    return users.find(u => u.id === userId);
  };

  // =========================================================
  // CARTÃO
  // =========================================================

  const getCardInfo = (
    opId?: string,
    brId?: string
  ) => {

    const op = cardOperators.find(
      o => o.id === opId
    );

    const br = cardBrands.find(
      b => b.id === brId
    );

    return {
      operator: op?.name || '---',
      brand: br?.name || '---'
    };
  };

  // =========================================================
  // REIMPRESSÃO A4
  // =========================================================

  const handleReprint = (sale: Transaction) => {

    setSelectedTransaction(sale);

    setTimeout(() => {

      window.print();

      setTimeout(() => {
        setSelectedTransaction(null);
      }, 800);

    }, 300);
  };

  // =========================================================
  // ALTERAR VENDEDOR
  // =========================================================

  const handleUpdateVendor = async (
    vendorId: string
  ) => {

    if (!selectedTransaction) return;

    try {

      await addTransaction({
        ...selectedTransaction,
        vendorId
      });

      setShowVendorModal(false);
      setSelectedTransaction(null);

    } catch (e) {

      alert('Erro ao atualizar vendedor.');

    }
  };

  // =========================================================
  // ALTERAR CLIENTE
  // =========================================================

  const handleUpdateCustomer = async (
    customerId: string
  ) => {

    if (!selectedTransaction) return;

    const customer =
      customers.find(
        c => c.id === customerId
      );

    try {

      await addTransaction({
        ...selectedTransaction,
        clientId: customerId,
        client:
          customer?.name ||
          'Consumidor Final'
      });

      setShowCustomerModal(false);
      setSelectedTransaction(null);

    } catch (e) {

      alert('Erro ao atualizar cliente.');

    }
  };

  // =========================================================
  // RETURN
  // =========================================================

  return (

    <div className="min-h-screen bg-slate-100 dark:bg-background-dark font-sans text-[11px] uppercase font-bold flex flex-col relative">

      {/* =====================================================
          ROMANEIO A4 - IMPRESSÃO
      ===================================================== */}

      <div
        id="receipt-reprint-area"
        className="a4-print-area"
      >

        {selectedTransaction && (

          <div className="a4-document">

            {/* CABEÇALHO */}

            <div className="a4-header">

              <div className="a4-header-left">

                <div className="a4-title">
                  ROMANEIO DE VENDA
                </div>

                <div className="a4-subtitle">
                  DOCUMENTO DE VENDA / PDV
                </div>

              </div>

              <div className="a4-header-right">

                <div className="a4-doc-number">
                  Nº {selectedTransaction.id.slice(-8)}
                </div>

                <div>
                  EMISSÃO: {selectedTransaction.date}
                </div>

              </div>

            </div>


            {/* DADOS DA EMPRESA */}

            <div className="a4-company-box">

              <div className="a4-company-name">
                {selectedTransaction.store}
              </div>

              <div className="a4-company-info">
                ROMANEIO / DOCUMENTO DE VENDA
              </div>

            </div>


            {/* DADOS DA VENDA */}

            <div className="a4-info-grid">

              <div className="a4-info-item a4-span-2">
                <span>CLIENTE</span>
                <strong>
                  {selectedTransaction.client ||
                    'CONSUMIDOR FINAL'}
                </strong>
              </div>

              <div className="a4-info-item">
                <span>VENDEDOR</span>
                <strong>
                  {getUserData(
                    selectedTransaction.vendorId
                  )?.name || 'BALCÃO'}
                </strong>
              </div>

              <div className="a4-info-item">
                <span>CAIXA</span>
                <strong>
                  {getUserData(
                    selectedTransaction.cashierId
                  )?.name ||
                    selectedTransaction.method ||
                    'SISTEMA'}
                </strong>
              </div>

              <div className="a4-info-item">
                <span>DATA</span>
                <strong>
                  {selectedTransaction.date}
                </strong>
              </div>

            </div>


            {/* TABELA DE PRODUTOS */}

            <div className="a4-section-title">
              ITENS DA VENDA
            </div>

            <table className="a4-items-table">

              <thead>

                <tr>

                  <th className="col-seq">
                    #
                  </th>

                  <th className="col-sku">
                    CÓDIGO
                  </th>

                  <th>
                    DESCRIÇÃO DO PRODUTO
                  </th>

                  <th className="col-quantity">
                    QTD.
                  </th>

                  <th className="col-price">
                    VALOR UNIT.
                  </th>

                  <th className="col-total">
                    VALOR TOTAL
                  </th>

                </tr>

              </thead>

              <tbody>

                {selectedTransaction.items?.map(
                  (item, idx) => (

                    <tr key={idx}>

                      <td className="text-center">
                        {idx + 1}
                      </td>

                      <td>
                        {item.sku || '---'}
                      </td>

                      <td>
                        {item.name}
                      </td>

                      <td className="text-right">
                        {Number(
                          item.quantity || 0
                        ).toFixed(2)}
                      </td>

                      <td className="text-right">
                        R${' '}
                        {Number(
                          item.salePrice || 0
                        ).toLocaleString(
                          'pt-BR',
                          {
                            minimumFractionDigits: 2
                          }
                        )}
                      </td>

                      <td className="text-right">
                        R${' '}
                        {(
                          Number(item.quantity || 0) *
                          Number(item.salePrice || 0)
                        ).toLocaleString(
                          'pt-BR',
                          {
                            minimumFractionDigits: 2
                          }
                        )}
                      </td>

                    </tr>

                  )
                )}

              </tbody>

            </table>


            {/* RESUMO */}

            <div className="a4-summary">

              <div className="a4-summary-left">

                <div>
                  <span>
                    QUANTIDADE TOTAL DE ITENS
                  </span>

                  <strong>
                    {selectedTransaction.items?.reduce(
                      (acc, i) =>
                        acc +
                        Number(i.quantity || 0),
                      0
                    ).toFixed(2)}
                  </strong>
                </div>

              </div>


              <div className="a4-summary-right">

                <div className="a4-total-label">
                  TOTAL GERAL
                </div>

                <div className="a4-total-value">
                  R${' '}
                  {Number(
                    selectedTransaction.value || 0
                  ).toLocaleString(
                    'pt-BR',
                    {
                      minimumFractionDigits: 2
                    }
                  )}
                </div>

              </div>

            </div>


            {/* PAGAMENTO */}

            <div className="a4-section-title">
              FORMA DE PAGAMENTO
            </div>

            <div className="a4-payment-box">

              <div>

                <span>
                  FORMA DE PAGAMENTO
                </span>

                <strong>
                  {selectedTransaction.method ||
                    'DINHEIRO'}

                  {selectedTransaction.installments
                    ? ` - ${selectedTransaction.installments}X`
                    : ''}
                </strong>

              </div>


              {selectedTransaction.cardOperatorId && (

                <>

                  <div>

                    <span>
                      OPERADORA
                    </span>

                    <strong>
                      {
                        getCardInfo(
                          selectedTransaction.cardOperatorId,
                          selectedTransaction.cardBrandId
                        ).operator
                      }
                    </strong>

                  </div>

                  <div>

                    <span>
                      BANDEIRA
                    </span>

                    <strong>
                      {
                        getCardInfo(
                          selectedTransaction.cardOperatorId,
                          selectedTransaction.cardBrandId
                        ).brand
                      }
                    </strong>

                  </div>

                  <div>

                    <span>
                      NSU
                    </span>

                    <strong>
                      {selectedTransaction.transactionSku ||
                        '---'}
                    </strong>

                  </div>

                  <div>

                    <span>
                      AUTORIZAÇÃO
                    </span>

                    <strong>
                      {selectedTransaction.authNumber ||
                        '---'}
                    </strong>

                  </div>

                </>

              )}

            </div>


            {/* OBSERVAÇÕES */}

            <div className="a4-section-title">
              OBSERVAÇÕES
            </div>

            <div className="a4-observations">
              DOCUMENTO REIMPRESSO PARA CONFERÊNCIA.
            </div>


            {/* ASSINATURAS */}

            <div className="a4-signatures">

              <div className="a4-signature">

                <div className="signature-line"></div>

                <span>
                  RESPONSÁVEL / VENDEDOR
                </span>

              </div>


              <div className="a4-signature">

                <div className="signature-line"></div>

                <span>
                  CLIENTE
                </span>

              </div>

            </div>


            {/* RODAPÉ */}

            <div className="a4-footer">

              <span>
                ROMANEIO GERADO PELO SISTEMA PDV
              </span>

              <span>
                REIMPRESSO EM{' '}
                {new Date().toLocaleString(
                  'pt-BR'
                )}
              </span>

            </div>

          </div>

        )}

      </div>


      {/* =====================================================
          CABEÇALHO DA TELA
      ===================================================== */}

      <header className="bg-primary p-4 flex items-center justify-between text-white shadow-lg shrink-0 print:hidden">

        <div className="flex items-center gap-4">

          <div className="bg-white rounded-lg p-1.5 flex items-center justify-center">

            <span className="material-symbols-outlined text-primary text-2xl">
              receipt_long
            </span>

          </div>

          <h1 className="text-sm font-black tracking-tight">
            DOCUMENTOS DE VENDAS PDV
          </h1>

        </div>

      </header>


      {/* =====================================================
          FILTROS
      ===================================================== */}

      <div className="p-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-end gap-4 shadow-sm print:hidden">

        <div className="space-y-1">

          <label className="text-[9px] text-slate-400 font-black px-1">
            DATA INICIAL:
          </label>

          <div className="h-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 flex items-center gap-2">

            <span className="material-symbols-outlined text-slate-400 text-sm">
              calendar_today
            </span>

            <input
              type="date"
              value={startDate}
              onChange={e =>
                setStartDate(e.target.value)
              }
              className="bg-transparent border-none text-[10px] font-black outline-none focus:ring-0 p-0 w-24"
            />

          </div>

        </div>


        <div className="space-y-1">

          <label className="text-[9px] text-slate-400 font-black px-1">
            DATA FINAL:
          </label>

          <div className="h-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 flex items-center gap-2">

            <span className="material-symbols-outlined text-slate-400 text-sm">
              calendar_today
            </span>

            <input
              type="date"
              value={endDate}
              onChange={e =>
                setEndDate(e.target.value)
              }
              className="bg-transparent border-none text-[10px] font-black outline-none focus:ring-0 p-0 w-24"
            />

          </div>

        </div>


        <div className="space-y-1">

          <label className="text-[9px] text-slate-400 font-black px-1">
            UNIDADE / LOJA:
          </label>

          <div className="h-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-3 flex items-center gap-2">

            <span className="material-symbols-outlined text-slate-400 text-sm">
              store
            </span>

            <select
              disabled={!isAdmin}
              value={storeFilter}
              onChange={e =>
                setStoreFilter(e.target.value)
              }
              className="bg-transparent border-none text-[10px] font-black outline-none focus:ring-0 p-0 pr-8"
            >

              <option value="TODAS">
                TODAS AS LOJAS
              </option>

              {establishments.map(est => (

                <option
                  key={est.id}
                  value={est.name}
                >
                  {est.name}
                </option>

              ))}

            </select>

          </div>

        </div>


        <div className="flex-1 space-y-1">

          <label className="text-[9px] text-slate-400 font-black px-1">
            PESQUISA RÁPIDA (ID OU CLIENTE):
          </label>

          <div className="relative">

            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">
              search
            </span>

            <input
              value={filter}
              onChange={e =>
                setFilter(e.target.value)
              }
              placeholder="DIGITE PARA BUSCAR..."
              className="w-full h-10 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded pl-10 text-[10px] font-black outline-none focus:ring-1 focus:ring-primary/30 uppercase"
            />

          </div>

        </div>


        <button
          onClick={() => {
            setFilter('');
            setStoreFilter('TODAS');
          }}
          className="h-10 px-4 bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded text-[9px] font-black hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center gap-2"
        >

          <span className="material-symbols-outlined text-sm">
            filter_alt_off
          </span>

          LIMPAR

        </button>

      </div>


      {/* =====================================================
          TABELA
      ===================================================== */}

      <div className="flex-1 overflow-auto bg-white dark:bg-slate-900 print:hidden">

        <table className="w-full text-left border-collapse min-w-[1200px]">

          <thead className="bg-primary text-white sticky top-0 z-20">

            <tr className="divide-x divide-white/10">

              <th className="px-3 py-2 text-center w-10">
                <span className="material-symbols-outlined text-sm">
                  settings
                </span>
              </th>

              <th className="px-3 py-2 w-20">
                Opções
              </th>

              <th className="px-3 py-2 w-24">
                ID
              </th>

              <th className="px-3 py-2 w-32">
                Loja
              </th>

              <th className="px-3 py-2 w-20">
                Vend.
              </th>

              <th className="px-3 py-2 w-40">
                Data de Emissão
              </th>

              <th className="px-3 py-2">
                Cliente
              </th>

              <th className="px-3 py-2 w-24 text-right">
                Qtd. Itens
              </th>

              <th className="px-3 py-2 w-32 text-right">
                Vr. Total
              </th>

            </tr>

          </thead>


          <tbody className="divide-y divide-slate-100 dark:divide-slate-800">

            {sales.map(s => (

              <tr
                key={s.id}
                onClick={() => {
                  setViewingDetail(s);
                  setActiveDetailTab('ITENS');
                }}
                className="hover:bg-slate-50 dark:hover:bg-slate-800/40 divide-x divide-slate-100 dark:divide-slate-800 transition-colors cursor-pointer group"
              >

                <td className="px-3 py-1.5 text-center">

                  <div className="size-2.5 bg-blue-600 rounded-full mx-auto"></div>

                </td>


                <td
                  className="px-3 py-1.5 relative"
                  onClick={e =>
                    e.stopPropagation()
                  }
                >

                  <button
                    onClick={() =>
                      setShowOptionsId(
                        showOptionsId === s.id
                          ? null
                          : s.id
                      )
                    }
                    className="bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded px-2 py-0.5 hover:bg-primary hover:text-white transition-all flex items-center justify-center"
                  >

                    <span className="material-symbols-outlined text-sm">
                      list
                    </span>

                  </button>


                  {showOptionsId === s.id && (

                    <div className="absolute left-full top-0 ml-1 z-50 bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 rounded-lg py-2 w-56">

                      <p className="px-4 py-1 text-[9px] text-slate-400 font-black border-b mb-1">
                        Ações Disponíveis
                      </p>


                      <button
                        onClick={() =>
                          handleReprint(s)
                        }
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                      >

                        <span className="material-symbols-outlined text-sm">
                          print
                        </span>

                        01 - Reimprimir Romaneio A4

                      </button>


                      <button
                        onClick={() => {
                          setSelectedTransaction(s);
                          setShowCustomerModal(true);
                          setShowOptionsId(null);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                      >

                        <span className="material-symbols-outlined text-sm">
                          person_edit
                        </span>

                        05 - Alterar Cliente

                      </button>


                      <button
                        onClick={() => {
                          setSelectedTransaction(s);
                          setShowVendorModal(true);
                          setShowOptionsId(null);
                        }}
                        className="w-full text-left px-4 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"
                      >

                        <span className="material-symbols-outlined text-sm">
                          badge
                        </span>

                        06 - Alterar Vendedor

                      </button>

                    </div>

                  )}

                </td>


                <td className="px-3 py-1.5 font-mono text-slate-400">
                  {s.id.slice(-6)}
                </td>


                <td className="px-3 py-1.5 text-primary">
                  {s.store}
                </td>


                <td className="px-3 py-1.5 text-primary">
                  {getUserData(
                    s.vendorId
                  )?.name?.split(' ')[0] ||
                    '---'}
                </td>


                <td className="px-3 py-1.5 text-slate-500">
                  {s.date}
                </td>


                <td className="px-3 py-1.5">
                  <span className="truncate max-w-[200px] uppercase">
                    {s.client ||
                      'Consumidor Final'}
                  </span>
                </td>


                <td className="px-3 py-1.5 text-right font-black tabular-nums">
                  {s.items
                    ?.reduce(
                      (acc, i) =>
                        acc +
                        Number(i.quantity || 0),
                      0
                    )
                    .toFixed(2)}
                </td>


                <td className="px-3 py-1.5 text-right font-black text-slate-900 dark:text-white tabular-nums">

                  R${' '}
                  {Number(
                    s.value || 0
                  ).toLocaleString(
                    'pt-BR',
                    {
                      minimumFractionDigits: 2
                    }
                  )}

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>


      {/* =====================================================
          RODAPÉ
      ===================================================== */}

      <footer className="bg-slate-400 p-2 flex justify-between items-center text-slate-900 font-black shrink-0 print:hidden">

        <div className="flex items-center gap-4">

          <span className="text-[12px]">
            TOTAL GERAL PESQUISA
          </span>

        </div>


        <div className="flex gap-10 pr-4">

          <span className="text-[12px] tabular-nums">

            {totals.qtyItems
              .toFixed(2)
              .replace('.', ',')}

          </span>


          <span className="text-[12px] tabular-nums">

            R${' '}
            {totals.totalValue.toLocaleString(
              'pt-BR',
              {
                minimumFractionDigits: 2
              }
            )}

          </span>

        </div>

      </footer>


      {/* =====================================================
          MODAL DETALHE
      ===================================================== */}

      {viewingDetail && (

        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/60 p-4 animate-in fade-in print:hidden">

          <div className="bg-slate-100 w-full max-w-[1200px] h-[90vh] rounded shadow-2xl flex flex-col overflow-hidden text-slate-700">

            <div className="bg-white p-3 border-b border-slate-300 flex items-center justify-between">

              <h2 className="text-sm font-bold flex items-center gap-2">

                Informações Gerais do Documento

                <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-[10px]">
                  VENDA
                </span>

              </h2>


              <button
                onClick={() =>
                  setViewingDetail(null)
                }
                className="size-8 hover:bg-rose-500 hover:text-white flex items-center justify-center rounded transition-all"
              >

                <span className="material-symbols-outlined">
                  close
                </span>

              </button>

            </div>


            <div className="p-4 space-y-4 overflow-y-auto">

              <div className="grid grid-cols-12 gap-2">

                <div className="col-span-2">
                  <DetailField
                    label="ID:"
                    value={viewingDetail.id.slice(-6)}
                  />
                </div>

                <div className="col-span-10">
                  <DetailField
                    label="LOJA:"
                    value={viewingDetail.store}
                    borderHighlight
                  />
                </div>

              </div>


              <div className="grid grid-cols-12 gap-2">

                <div className="col-span-10">

                  <DetailField
                    label="CLIENTE:"
                    value={
                      viewingDetail.client ||
                      'Consumidor Final'
                    }
                    borderHighlight
                  />

                </div>


                <div className="col-span-2">

                  <DetailField
                    label="DATA EMISSÃO:"
                    value={viewingDetail.date}
                    borderHighlight
                  />

                </div>

              </div>


              <div className="grid grid-cols-12 gap-2">

                <div className="col-span-4">

                  <DetailField
                    label="VENDEDOR:"
                    value={
                      getUserData(
                        viewingDetail.vendorId
                      )?.name ||
                      'NÃO INF.'
                    }
                    borderHighlight
                  />

                </div>


                <div className="col-span-4">

                  <DetailField
                    label="CAIXA:"
                    value={
                      getUserData(
                        viewingDetail.cashierId
                      )?.name ||
                      viewingDetail.method ||
                      'SISTEMA'
                    }
                    borderHighlight
                  />

                </div>


                <div className="col-span-4">

                  <button
                    onClick={() =>
                      handleReprint(
                        viewingDetail
                      )
                    }
                    className="w-full h-12 bg-primary text-white rounded font-black uppercase text-[10px] shadow flex items-center justify-center gap-2 hover:bg-blue-600"
                  >

                    <span className="material-symbols-outlined">
                      print
                    </span>

                    Reimprimir Romaneio A4

                  </button>

                </div>

              </div>


              <div className="bg-primary text-white flex items-center px-4 py-1.5 gap-8 mt-2">

                <button
                  onClick={() =>
                    setActiveDetailTab('ITENS')
                  }
                  className={`text-[10px] font-black pb-0.5 uppercase ${
                    activeDetailTab === 'ITENS'
                      ? 'border-b-2 border-white'
                      : 'opacity-70'
                  }`}
                >
                  ITENS
                </button>


                <button
                  onClick={() =>
                    setActiveDetailTab(
                      'PAGAMENTO'
                    )
                  }
                  className={`text-[10px] font-black pb-0.5 uppercase ${
                    activeDetailTab ===
                    'PAGAMENTO'
                      ? 'border-b-2 border-white'
                      : 'opacity-70'
                  }`}
                >
                  FORMAS DE PAGAMENTO
                </button>

              </div>


              <div className="bg-white border border-slate-300 flex flex-col min-h-[300px]">

                {activeDetailTab ===
                  'ITENS' && (

                  <div className="overflow-auto flex-1">

                    <table className="w-full text-left border-collapse text-[10px]">

                      <thead className="bg-primary text-white">

                        <tr>

                          <th className="px-2 py-1">
                            Produto
                          </th>

                          <th className="px-2 py-1 text-right">
                            Qtd.
                          </th>

                          <th className="px-2 py-1 text-right">
                            Vr. Unitário
                          </th>

                          <th className="px-2 py-1 text-right">
                            Vr. Total
                          </th>

                        </tr>

                      </thead>


                      <tbody>

                        {viewingDetail.items?.map(
                          (item, idx) => (

                            <tr
                              key={idx}
                              className="hover:bg-slate-50 border-b"
                            >

                              <td className="px-2 py-1">

                                <span className="text-blue-600 font-black">
                                  {item.sku}
                                </span>

                                {' - '}

                                {item.name}

                              </td>


                              <td className="px-2 py-1 text-right font-black">

                                {Number(
                                  item.quantity || 0
                                ).toFixed(2)}

                              </td>


                              <td className="px-2 py-1 text-right">

                                R${' '}

                                {Number(
                                  item.salePrice || 0
                                ).toLocaleString(
                                  'pt-BR',
                                  {
                                    minimumFractionDigits: 2
                                  }
                                )}

                              </td>


                              <td className="px-2 py-1 text-right font-black">

                                R${' '}

                                {(
                                  Number(
                                    item.quantity || 0
                                  ) *
                                  Number(
                                    item.salePrice || 0
                                  )
                                ).toLocaleString(
                                  'pt-BR',
                                  {
                                    minimumFractionDigits: 2
                                  }
                                )}

                              </td>

                            </tr>

                          )
                        )}

                      </tbody>

                    </table>

                  </div>

                )}


                {activeDetailTab ===
                  'PAGAMENTO' && (

                  <div className="p-8 space-y-6">

                    <div className="grid grid-cols-3 gap-6">

                      <div className="bg-slate-50 p-4 rounded border">

                        <p className="text-[9px] text-slate-400">
                          PAGAMENTO
                        </p>

                        <p className="text-sm font-black">
                          {viewingDetail.method ||
                            'DINHEIRO'}
                        </p>

                      </div>


                      <div className="bg-slate-50 p-4 rounded border">

                        <p className="text-[9px] text-slate-400">
                          TOTAL
                        </p>

                        <p className="text-sm font-black text-emerald-600">

                          R${' '}

                          {Number(
                            viewingDetail.value ||
                              0
                          ).toLocaleString(
                            'pt-BR',
                            {
                              minimumFractionDigits: 2
                            }
                          )}

                        </p>

                      </div>

                    </div>


                    {viewingDetail.cardOperatorId && (

                      <div className="grid grid-cols-4 gap-4">

                        <div className="bg-white p-3 rounded border">

                          <p className="text-[8px] text-slate-400">
                            OPERADORA
                          </p>

                          <p className="text-[10px] font-bold">

                            {
                              getCardInfo(
                                viewingDetail.cardOperatorId,
                                viewingDetail.cardBrandId
                              ).operator
                            }

                          </p>

                        </div>


                        <div className="bg-white p-3 rounded border">

                          <p className="text-[8px] text-slate-400">
                            BANDEIRA
                          </p>

                          <p className="text-[10px] font-bold">

                            {
                              getCardInfo(
                                viewingDetail.cardOperatorId,
                                viewingDetail.cardBrandId
                              ).brand
                            }

                          </p>

                        </div>


                        <div className="bg-white p-3 rounded border">

                          <p className="text-[8px] text-slate-400">
                            NSU
                          </p>

                          <p className="text-[10px] font-bold">

                            {viewingDetail.transactionSku ||
                              '---'}

                          </p>

                        </div>


                        <div className="bg-white p-3 rounded border">

                          <p className="text-[8px] text-slate-400">
                            AUTH
                          </p>

                          <p className="text-[10px] font-bold">

                            {viewingDetail.authNumber ||
                              '---'}

                          </p>

                        </div>

                      </div>

                    )}

                  </div>

                )}

              </div>

            </div>

          </div>

        </div>

      )}


      {/* =====================================================
          MODAL VENDEDOR
      ===================================================== */}

      {showVendorModal && (

        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in">

          <div className="bg-white dark:bg-slate-900 w-full max-w-lg rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">

            <div className="p-6 bg-primary text-white flex justify-between items-center font-black">

              <h3 className="text-lg uppercase">
                Alterar Vendedor
              </h3>

              <button
                onClick={() =>
                  setShowVendorModal(false)
                }
              >
                <span className="material-symbols-outlined">
                  close
                </span>
              </button>

            </div>


            <div className="p-8 space-y-4">

              <p className="text-[10px] text-slate-400 font-black uppercase mb-4 tracking-widest px-2">

                Selecione o novo vendedor
                para o documento{' '}

                {selectedTransaction?.id.slice(-6)}

              </p>


              <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-2">

                {users
                  .filter(
                    u =>
                      u.active &&
                      (
                        isAdmin ||
                        u.storeId ===
                          currentUser?.storeId
                      )
                  )
                  .map(v => (

                    <button
                      key={v.id}
                      onClick={() =>
                        handleUpdateVendor(
                          v.id
                        )
                      }
                      className={`w-full p-4 rounded-2xl flex items-center justify-between group transition-all ${
                        selectedTransaction?.vendorId ===
                        v.id
                          ? 'bg-primary text-white'
                          : 'bg-slate-50 dark:bg-slate-800 hover:bg-primary/10'
                      }`}
                    >

                      <span className={`text-xs font-black uppercase ${
                        selectedTransaction?.vendorId ===
                        v.id
                          ? 'text-white'
                          : 'text-slate-700 dark:text-slate-200'
                      }`}>

                        {v.name}

                      </span>


                      <span className="material-symbols-outlined opacity-0 group-hover:opacity-100 transition-opacity">
                        check_circle
                      </span>

                    </button>

                  ))}


                <button
                  onClick={() =>
                    handleUpdateVendor('')
                  }
                  className="w-full p-4 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-400 text-xs font-black uppercase hover:bg-rose-500 hover:text-white transition-all text-center"
                >
                  Limpar Vendedor (Balcão)
                </button>

              </div>

            </div>

          </div>

        </div>

      )}


      {/* =====================================================
          MODAL CLIENTE
      ===================================================== */}

      {showCustomerModal && (

        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4 animate-in fade-in">

          <div className="bg-white dark:bg-slate-900 w-full max-w-2xl rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95">

            <div className="p-6 bg-primary text-white flex justify-between items-center font-black">

              <h3 className="text-lg uppercase">
                Alterar Cliente
              </h3>

              <button
                onClick={() =>
                  setShowCustomerModal(false)
                }
              >

                <span className="material-symbols-outlined">
                  close
                </span>

              </button>

            </div>


            <div className="p-8 space-y-4">

              <div className="relative mb-6">

                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400">
                  search
                </span>

                <input
                  autoFocus
                  placeholder="BUSCAR CLIENTE PELO NOME..."
                  className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-12 pr-6 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-primary/20"
                />

              </div>


              <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-2">

                {customers.map(c => (

                  <button
                    key={c.id}
                    onClick={() =>
                      handleUpdateCustomer(
                        c.id
                      )
                    }
                    className={`w-full p-5 rounded-2xl flex flex-col text-left group transition-all ${
                      selectedTransaction?.clientId ===
                      c.id
                        ? 'bg-primary text-white'
                        : 'bg-slate-50 dark:bg-slate-800 hover:bg-primary/10'
                    }`}
                  >

                    <span className={`text-sm font-black uppercase ${
                      selectedTransaction?.clientId ===
                      c.id
                        ? 'text-white'
                        : 'text-slate-800 dark:text-slate-200'
                    }`}>

                      {c.name}

                    </span>


                    <span className={`text-[10px] font-bold ${
                      selectedTransaction?.clientId ===
                      c.id
                        ? 'text-white/60'
                        : 'text-slate-400'
                    }`}>

                      {c.cpfCnpj ||
                        'DOCUMENTO NÃO CADASTRADO'}

                    </span>

                  </button>

                ))}


                <button
                  onClick={() =>
                    handleUpdateCustomer('')
                  }
                  className="w-full p-4 rounded-2xl bg-slate-100 dark:bg-slate-700 text-slate-400 text-xs font-black uppercase hover:bg-rose-500 hover:text-white transition-all text-center"
                >

                  Consumidor Final
                  (Sem Cadastro)

                </button>

              </div>

            </div>

          </div>

        </div>

      )}


      {/* =====================================================
          CSS
      ===================================================== */}

      <style>{`

        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 20px;
        }


        /* ===================================================
           ROMANEIO A4
        =================================================== */

        .a4-print-area {
          display: none;
        }


        /* ===================================================
           IMPRESSÃO
        =================================================== */

        @media print {

          html,
          body,
          #root {
            width: 100% !important;
            min-width: 0 !important;
            max-width: none !important;

            margin: 0 !important;
            padding: 0 !important;

            background: white !important;
          }


          body {
            overflow: visible !important;
          }


          body * {
            visibility: hidden !important;
          }


          /* Esconde absolutamente tudo */

          header,
          footer,
          .print\\:hidden,
          div[class*="fixed"],
          div[class*="backdrop-blur"] {
            display: none !important;
          }


          /* =================================================
             ÁREA A4
          ================================================= */

          #receipt-reprint-area {

            display: block !important;

            visibility: visible !important;

            position: relative !important;

            width: 100% !important;

            max-width: none !important;

            min-width: 0 !important;

            margin: 0 auto !important;

            padding: 0 !important;

            background: white !important;

            color: black !important;

            overflow: visible !important;

            box-sizing: border-box !important;

          }


          #receipt-reprint-area * {

            visibility: visible !important;

          }


          /* =================================================
             DOCUMENTO
          ================================================= */

          .a4-document {

            display: block !important;

            width: 100% !important;

            max-width: 210mm !important;

            min-height: 297mm !important;

            margin: 0 auto !important;

            padding:

              10mm
              10mm
              10mm
              10mm !important;

            box-sizing: border-box !important;

            background: white !important;

            color: black !important;

            font-family:
              Arial,
              Helvetica,
              sans-serif !important;

            font-size: 10pt !important;

            line-height: 1.3 !important;

          }


          /* =================================================
             CABEÇALHO
          ================================================= */

          .a4-header {

            width: 100% !important;

            display: flex !important;

            justify-content: space-between !important;

            align-items: flex-start !important;

            border-bottom: 2px solid #000 !important;

            padding-bottom: 5mm !important;

            margin-bottom: 4mm !important;

          }


          .a4-header-left {

            text-align: left !important;

          }


          .a4-title {

            font-size: 20pt !important;

            font-weight: 900 !important;

            line-height: 1.1 !important;

          }


          .a4-subtitle {

            margin-top: 2mm !important;

            font-size: 9pt !important;

            font-weight: 700 !important;

          }


          .a4-header-right {

            text-align: right !important;

            font-size: 9pt !important;

            font-weight: 700 !important;

          }


          .a4-doc-number {

            font-size: 13pt !important;

            font-weight: 900 !important;

            margin-bottom: 2mm !important;

          }


          /* =================================================
             EMPRESA
          ================================================= */

          .a4-company-box {

            width: 100% !important;

            border: 1px solid #000 !important;

            padding: 4mm !important;

            margin-bottom: 4mm !important;

            box-sizing: border-box !important;

          }


          .a4-company-name {

            font-size: 14pt !important;

            font-weight: 900 !important;

          }


          .a4-company-info {

            font-size: 8pt !important;

            margin-top: 1mm !important;

          }


          /* =================================================
             INFORMAÇÕES
          ================================================= */

          .a4-info-grid {

            width: 100% !important;

            display: grid !important;

            grid-template-columns:
              2fr
              1fr
              1fr
              1fr !important;

            border-left: 1px solid #000 !important;

            border-top: 1px solid #000 !important;

            margin-bottom: 5mm !important;

          }


          .a4-info-item {

            min-height: 17mm !important;

            border-right: 1px solid #000 !important;

            border-bottom: 1px solid #000 !important;

            padding: 3mm !important;

            box-sizing: border-box !important;

            display: flex !important;

            flex-direction: column !important;

            justify-content: center !important;

          }


          .a4-info-item span {

            font-size: 7pt !important;

            font-weight: 700 !important;

            color: #444 !important;

            margin-bottom: 1mm !important;

          }


          .a4-info-item strong {

            font-size: 9pt !important;

            font-weight: 900 !important;

          }


          .a4-span-2 {

            grid-column: span 2 !important;

          }


          /* =================================================
             TÍTULOS
          ================================================= */

          .a4-section-title {

            width: 100% !important;

            box-sizing: border-box !important;

            background: #000 !important;

            color: white !important;

            font-size: 8pt !important;

            font-weight: 900 !important;

            padding: 2.5mm 3mm !important;

            margin-top: 4mm !important;

            margin-bottom: 0 !important;

          }


          /* =================================================
             TABELA
          ================================================= */

          .a4-items-table {

            width: 100% !important;

            max-width: 100% !important;

            border-collapse: collapse !important;

            table-layout: fixed !important;

            margin: 0 !important;

            padding: 0 !important;

            font-size: 8.5pt !important;

          }


          .a4-items-table th {

            background: #e5e5e5 !important;

            color: #000 !important;

            border: 1px solid #000 !important;

            padding: 2.5mm 2mm !important;

            font-weight: 900 !important;

            text-transform: uppercase !important;

          }


          .a4-items-table td {

            border: 1px solid #000 !important;

            padding: 2.5mm 2mm !important;

            vertical-align: middle !important;

            word-wrap: break-word !important;

            overflow-wrap: anywhere !important;

          }


          .a4-items-table th:nth-child(1),
          .a4-items-table td:nth-child(1) {
            width: 7% !important;
          }


          .a4-items-table th:nth-child(2),
          .a4-items-table td:nth-child(2) {
            width: 13% !important;
          }


          .a4-items-table th:nth-child(3),
          .a4-items-table td:nth-child(3) {
            width: 39% !important;
          }


          .a4-items-table th:nth-child(4),
          .a4-items-table td:nth-child(4) {
            width: 10% !important;
          }


          .a4-items-table th:nth-child(5),
          .a4-items-table td:nth-child(5) {
            width: 15% !important;
          }


          .a4-items-table th:nth-child(6),
          .a4-items-table td:nth-child(6) {
            width: 16% !important;
          }


          /* =================================================
             RESUMO
          ================================================= */

          .a4-summary {

            width: 100% !important;

            display: flex !important;

            justify-content: space-between !important;

            align-items: stretch !important;

            margin-top: 5mm !important;

            border: 2px solid #000 !important;

          }


          .a4-summary-left {

            flex: 1 !important;

            padding: 4mm !important;

          }


          .a4-summary-left span {

            display: block !important;

            font-size: 7pt !important;

            font-weight: 700 !important;

          }


          .a4-summary-left strong {

            display: block !important;

            font-size: 12pt !important;

            font-weight: 900 !important;

            margin-top: 1mm !important;

          }


          .a4-summary-right {

            min-width: 55mm !important;

            padding: 4mm !important;

            border-left: 2px solid #000 !important;

            text-align: right !important;

          }


          .a4-total-label {

            font-size: 8pt !important;

            font-weight: 900 !important;

          }


          .a4-total-value {

            font-size: 17pt !important;

            font-weight: 900 !important;

            margin-top: 1mm !important;

          }


          /* =================================================
             PAGAMENTO
          ================================================= */

          .a4-payment-box {

            width: 100% !important;

            display: grid !important;

            grid-template-columns:
              repeat(5, 1fr) !important;

            border-left: 1px solid #000 !important;

            border-bottom: 1px solid #000 !important;

          }


          .a4-payment-box > div {

            min-height: 18mm !important;

            padding: 3mm !important;

            border-right: 1px solid #000 !important;

            border-top: 1px solid #000 !important;

            box-sizing: border-box !important;

          }


          .a4-payment-box span {

            display: block !important;

            font-size: 7pt !important;

            font-weight: 700 !important;

            color: #444 !important;

            margin-bottom: 1mm !important;

          }


          .a4-payment-box strong {

            font-size: 8.5pt !important;

            font-weight: 900 !important;

            word-break: break-word !important;

          }


          /* =================================================
             OBSERVAÇÃO
          ================================================= */

          .a4-observations {

            width: 100% !important;

            min-height: 20mm !important;

            border: 1px solid #000 !important;

            padding: 4mm !important;

            box-sizing: border-box !important;

            font-size: 8pt !important;

          }


          /* =================================================
             ASSINATURAS
          ================================================= */

          .a4-signatures {

            width: 100% !important;

            display: flex !important;

            gap: 20mm !important;

            margin-top: 18mm !important;

          }


          .a4-signature {

            flex: 1 !important;

            text-align: center !important;

          }


          .signature-line {

            width: 100% !important;

            border-top: 1px solid #000 !important;

            margin-bottom: 2mm !important;

          }


          .a4-signature span {

            font-size: 7pt !important;

            font-weight: 700 !important;

          }


          /* =================================================
             RODAPÉ
          ================================================= */

          .a4-footer {

            width: 100% !important;

            display: flex !important;

            justify-content: space-between !important;

            border-top: 1px solid #000 !important;

            margin-top: 15mm !important;

            padding-top: 3mm !important;

            font-size: 6.5pt !important;

            font-weight: 700 !important;

          }


          /* =================================================
             CONFIGURAÇÃO DA FOLHA
          ================================================= */

          @page {

            size: A4 portrait;

            margin: 0;

          }


          /* =================================================
             EVITA CORTES
          ================================================= */

          .a4-document,
          .a4-header,
          .a4-company-box,
          .a4-info-grid,
          .a4-items-table,
          .a4-summary,
          .a4-payment-box,
          .a4-observations,
          .a4-signatures,
          .a4-footer {

            break-inside: avoid !important;

            page-break-inside: avoid !important;

          }


          .a4-items-table thead {

            display: table-header-group !important;

          }


          .a4-items-table tr {

            break-inside: avoid !important;

            page-break-inside: avoid !important;

          }

        }

      `}</style>

    </div>

  );
};


// =========================================================
// CAMPO DE DETALHE
// =========================================================

const DetailField = ({
  label,
  value,
  borderHighlight
}: {
  label: string;
  value: string;
  borderHighlight?: boolean;
}) => (

  <div className="flex flex-col gap-0.5">

    <label className="text-[9px] font-black text-slate-500 uppercase">
      {label}
    </label>

    <div
      className={`h-8 bg-white border ${
        borderHighlight
          ? 'border-emerald-500/50 rounded-lg'
          : 'border-slate-300'
      } px-2 flex items-center text-[10px] font-bold truncate shadow-inner`}
    >
      {value}
    </div>

  </div>

);


export default SalesInquiry;
