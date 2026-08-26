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

  const [customerSearch, setCustomerSearch] =
    useState('');

  // =========================================================
  // PERMISSÕES
  // =========================================================

  const isAdmin =
    currentUser?.role === UserRole.ADMIN ||
    currentUser?.role === UserRole.MANAGER;

  const currentStore = establishments.find(
    e => e.id === currentUser?.storeId
  );

  // =========================================================
  // FILTRAGEM DAS VENDAS
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

      const search = filter.toLowerCase();

      const matchesSearch =
        !filter ||
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

      totalValue += s.value;

      s.items?.forEach(i => {
        qtyItems += i.quantity;
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

  const getUserData = (userId?: string) =>
    users.find(u => u.id === userId);

  // =========================================================
  // CARTÕES
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
  // FORMATAÇÃO
  // =========================================================

  const formatMoney = (value: number) => {

    return value.toLocaleString('pt-BR', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });

  };

  const formatDate = (date?: string) => {

    if (!date) return '';

    const parts = date.split('-');

    if (parts.length === 3) {
      return `${parts[2]}/${parts[1]}/${parts[0]}`;
    }

    return date;

  };

  // =========================================================
  // REIMPRESSÃO ROMANEIO A4
  // =========================================================

  const handleReprint = (sale: Transaction) => {

    setSelectedTransaction(sale);

    setTimeout(() => {

      window.print();

      setTimeout(() => {
        setSelectedTransaction(null);
      }, 800);

    }, 150);

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

    const customer = customers.find(
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
      setCustomerSearch('');

    } catch (e) {

      alert('Erro ao atualizar cliente.');

    }

  };

  // =========================================================
  // CLIENTES FILTRADOS
  // =========================================================

  const filteredCustomers = customers.filter(c =>
    c.name
      .toLowerCase()
      .includes(customerSearch.toLowerCase())
  );

  // =========================================================
  // RENDER
  // =========================================================

  return (

    <div className="min-h-screen bg-slate-100 dark:bg-background-dark font-sans text-[11px] uppercase font-bold flex flex-col relative">

      {/* =====================================================
          ROMANEIO A4
      ====================================================== */}

      <div
        id="receipt-reprint-area"
        className="hidden print:block"
      >

        {selectedTransaction && (

          <div className="a4-romaneio">

            {/* CABEÇALHO */}

            <div className="romaneio-header">

              <div className="romaneio-company">

                <div className="romaneio-company-name">
                  {selectedTransaction.store}
                </div>

                <div className="romaneio-company-subtitle">
                  DOCUMENTO DE VENDA
                </div>

              </div>

              <div className="romaneio-title-box">

                <div className="romaneio-title">
                  ROMANEIO
                </div>

                <div className="romaneio-subtitle">
                  REIMPRESSÃO
                </div>

              </div>

            </div>

            <div className="romaneio-line" />

            {/* DADOS DA VENDA */}

            <div className="romaneio-info-grid">

              <div className="romaneio-info-item">

                <span className="romaneio-label">
                  DOCUMENTO
                </span>

                <strong>
                  {selectedTransaction.id.slice(-8)}
                </strong>

              </div>

              <div className="romaneio-info-item">

                <span className="romaneio-label">
                  DATA DE EMISSÃO
                </span>

                <strong>
                  {formatDate(
                    selectedTransaction.date
                  )}
                </strong>

              </div>

              <div className="romaneio-info-item">

                <span className="romaneio-label">
                  LOJA / UNIDADE
                </span>

                <strong>
                  {selectedTransaction.store}
                </strong>

              </div>

              <div className="romaneio-info-item">

                <span className="romaneio-label">
                  VENDEDOR
                </span>

                <strong>
                  {
                    getUserData(
                      selectedTransaction.vendorId
                    )?.name || 'BALCÃO'
                  }
                </strong>

              </div>

            </div>

            {/* CLIENTE */}

            <div className="romaneio-customer">

              <div>

                <span className="romaneio-label">
                  CLIENTE
                </span>

                <strong>
                  {
                    selectedTransaction.client ||
                    'CONSUMIDOR FINAL'
                  }
                </strong>

              </div>

              <div>

                <span className="romaneio-label">
                  CAIXA
                </span>

                <strong>
                  {
                    getUserData(
                      selectedTransaction.cashierId
                    )?.name ||
                    'SISTEMA'
                  }
                </strong>

              </div>

            </div>

            {/* PRODUTOS */}

            <div className="romaneio-section-title">
              ITENS DA VENDA
            </div>

            <table className="romaneio-table">

              <thead>

                <tr>

                  <th className="col-seq">
                    #
                  </th>

                  <th className="col-sku">
                    SKU
                  </th>

                  <th className="col-desc">
                    DESCRIÇÃO DO PRODUTO
                  </th>

                  <th className="col-qtd">
                    QTD.
                  </th>

                  <th className="col-unit">
                    VALOR UNIT.
                  </th>

                  <th className="col-total">
                    VALOR TOTAL
                  </th>

                </tr>

              </thead>

              <tbody>

                {selectedTransaction.items?.map(
                  (item, index) => {

                    const itemTotal =
                      item.quantity *
                      item.salePrice;

                    return (

                      <tr key={index}>

                        <td className="text-center">
                          {index + 1}
                        </td>

                        <td>
                          {item.sku || '---'}
                        </td>

                        <td className="product-description">
                          {item.name}
                        </td>

                        <td className="text-right">
                          {item.quantity.toFixed(2)}
                        </td>

                        <td className="text-right">
                          R$ {formatMoney(
                            item.salePrice
                          )}
                        </td>

                        <td className="text-right strong">
                          R$ {formatMoney(
                            itemTotal
                          )}
                        </td>

                      </tr>

                    );

                  }
                )}

              </tbody>

              <tfoot>

                <tr>

                  <td
                    colSpan={3}
                    className="table-footer-label"
                  >
                    TOTAL DE ITENS
                  </td>

                  <td className="text-right">

                    {
                      selectedTransaction.items?.reduce(
                        (acc, item) =>
                          acc + item.quantity,
                        0
                      ).toFixed(2)
                    }

                  </td>

                  <td />

                  <td />

                </tr>

              </tfoot>

            </table>

            {/* FINANCEIRO */}

            <div className="romaneio-financial">

              <div className="payment-box">

                <div className="romaneio-section-title small">
                  FORMA DE PAGAMENTO
                </div>

                <div className="payment-main">

                  {
                    selectedTransaction.method ||
                    'DINHEIRO'
                  }

                  {selectedTransaction.installments
                    ? ` - ${selectedTransaction.installments}X`
                    : ''
                  }

                </div>

                {selectedTransaction.cardOperatorId && (

                  <div className="payment-details">

                    <div>

                      <span>
                        OPERADORA:
                      </span>

                      {
                        getCardInfo(
                          selectedTransaction.cardOperatorId,
                          selectedTransaction.cardBrandId
                        ).operator
                      }

                    </div>

                    <div>

                      <span>
                        BANDEIRA:
                      </span>

                      {
                        getCardInfo(
                          selectedTransaction.cardOperatorId,
                          selectedTransaction.cardBrandId
                        ).brand
                      }

                    </div>

                    <div>

                      <span>
                        NSU:
                      </span>

                      {
                        selectedTransaction.transactionSku ||
                        '---'
                      }

                    </div>

                    <div>

                      <span>
                        AUTORIZAÇÃO:
                      </span>

                      {
                        selectedTransaction.authNumber ||
                        '---'
                      }

                    </div>

                  </div>

                )}

              </div>

              <div className="total-box">

                <span className="total-label">
                  TOTAL DA VENDA
                </span>

                <strong>
                  R$ {formatMoney(
                    selectedTransaction.value
                  )}
                </strong>

              </div>

            </div>

            {/* OBSERVAÇÕES */}

            <div className="romaneio-observation">

              <span className="romaneio-label">
                OBSERVAÇÕES
              </span>

              <div className="observation-line" />
              <div className="observation-line" />
              <div className="observation-line" />

            </div>

            {/* ASSINATURAS */}

            <div className="signature-area">

              <div className="signature">

                <div className="signature-line" />

                <span>
                  RESPONSÁVEL / CLIENTE
                </span>

              </div>

              <div className="signature">

                <div className="signature-line" />

                <span>
                  VENDEDOR
                </span>

              </div>

            </div>

            {/* RODAPÉ */}

            <div className="romaneio-footer">

              <span>
                ROMANEIO DE VENDA
              </span>

              <span>
                REIMPRESSO EM{' '}
                {new Date().toLocaleString('pt-BR')}
              </span>

              <span>
                ID: {selectedTransaction.id}
              </span>

            </div>

          </div>

        )}

      </div>

      {/* =====================================================
          CABEÇALHO DA TELA
      ====================================================== */}

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
      ====================================================== */}

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
          TABELA DE VENDAS
      ====================================================== */}

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

                  <div className="size-2.5 bg-blue-600 rounded-full mx-auto" />

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

                    <div className="absolute left-full top-0 ml-1 z-50 bg-white dark:bg-slate-800 shadow-2xl border border-slate-200 dark:border-slate-700 rounded-lg py-2 w-60">

                      <p className="px-4 py-1 text-[9px] text-slate-400 font-black border-b mb-1">
                        AÇÕES DISPONÍVEIS
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

                        01 - Imprimir Romaneio A4

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
                  {getUserData(s.vendorId)?.name?.split(' ')[0] || '---'}
                </td>

                <td className="px-3 py-1.5 text-slate-500">
                  {s.date}
                </td>

                <td className="px-3 py-1.5">

                  <span className="truncate max-w-[200px] uppercase">
                    {s.client || 'Consumidor Final'}
                  </span>

                </td>

                <td className="px-3 py-1.5 text-right font-black tabular-nums">

                  {s.items
                    ?.reduce(
                      (acc, i) =>
                        acc + i.quantity,
                      0
                    )
                    .toFixed(2)}

                </td>

                <td className="px-3 py-1.5 text-right font-black text-slate-900 dark:text-white tabular-nums">

                  R$ {formatMoney(s.value)}

                </td>

              </tr>

            ))}

          </tbody>

        </table>

      </div>

      {/* =====================================================
          RODAPÉ
      ====================================================== */}

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
            R$ {formatMoney(
              totals.totalValue
            )}
          </span>

        </div>

      </footer>

      {/* =====================================================
          MODAL DETALHE
      ====================================================== */}

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

                    <span className="material-symbols-outlined text-sm">
                      print
                    </span>

                    Imprimir Romaneio A4

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
                    setActiveDetailTab('PAGAMENTO')
                  }
                  className={`text-[10px] font-black pb-0.5 uppercase ${
                    activeDetailTab === 'PAGAMENTO'
                      ? 'border-b-2 border-white'
                      : 'opacity-70'
                  }`}
                >
                  FORMAS DE PAGAMENTO
                </button>

              </div>

              <div className="bg-white border border-slate-300 flex flex-col min-h-[300px]">

                {activeDetailTab === 'ITENS' && (

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

                                {item.quantity.toFixed(2)}

                              </td>

                              <td className="px-2 py-1 text-right">

                                R$ {formatMoney(
                                  item.salePrice
                                )}

                              </td>

                              <td className="px-2 py-1 text-right font-black">

                                R$ {formatMoney(
                                  item.quantity *
                                  item.salePrice
                                )}

                              </td>

                            </tr>

                          )
                        )}

                      </tbody>

                    </table>

                  </div>

                )}

                {activeDetailTab === 'PAGAMENTO' && (

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

                          R$ {formatMoney(
                            viewingDetail.value
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

                            {
                              viewingDetail.transactionSku ||
                              '---'
                            }

                          </p>

                        </div>

                        <div className="bg-white p-3 rounded border">

                          <p className="text-[8px] text-slate-400">
                            AUTORIZAÇÃO
                          </p>

                          <p className="text-[10px] font-bold">

                            {
                              viewingDetail.authNumber ||
                              '---'
                            }

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
      ====================================================== */}

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

                Selecione o novo vendedor para o documento{' '}

                {selectedTransaction?.id.slice(-6)}:

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
                        handleUpdateVendor(v.id)
                      }
                      className={`w-full p-4 rounded-2xl flex items-center justify-between group transition-all ${
                        selectedTransaction?.vendorId === v.id
                          ? 'bg-primary text-white'
                          : 'bg-slate-50 dark:bg-slate-800 hover:bg-primary/10'
                      }`}
                    >

                      <span
                        className={`text-xs font-black uppercase ${
                          selectedTransaction?.vendorId === v.id
                            ? 'text-white'
                            : 'text-slate-700 dark:text-slate-200'
                        }`}
                      >
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
      ====================================================== */}

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
                  value={customerSearch}
                  onChange={e =>
                    setCustomerSearch(
                      e.target.value
                    )
                  }
                  placeholder="BUSCAR CLIENTE PELO NOME..."
                  className="w-full h-12 bg-slate-50 dark:bg-slate-800 border-none rounded-xl pl-12 pr-6 text-xs font-black uppercase outline-none focus:ring-2 focus:ring-primary/20"
                />

              </div>

              <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar pr-2">

                {filteredCustomers.map(c => (

                  <button
                    key={c.id}
                    onClick={() =>
                      handleUpdateCustomer(c.id)
                    }
                    className={`w-full p-5 rounded-2xl flex flex-col text-left group transition-all ${
                      selectedTransaction?.clientId === c.id
                        ? 'bg-primary text-white'
                        : 'bg-slate-50 dark:bg-slate-800 hover:bg-primary/10'
                    }`}
                  >

                    <span
                      className={`text-sm font-black uppercase ${
                        selectedTransaction?.clientId === c.id
                          ? 'text-white'
                          : 'text-slate-800 dark:text-slate-200'
                      }`}
                    >
                      {c.name}
                    </span>

                    <span
                      className={`text-[10px] font-bold ${
                        selectedTransaction?.clientId === c.id
                          ? 'text-white/60'
                          : 'text-slate-400'
                      }`}
                    >
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
                  Consumidor Final (Sem Cadastro)
                </button>

              </div>

            </div>

          </div>

        </div>

      )}

      {/* =====================================================
          CSS
      ====================================================== */}

      <style>{`

        /* ===================================================
           SCROLLBAR
        =================================================== */

        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 20px;
        }

        /* ===================================================
           ROMANEIO
        =================================================== */

        .a4-romaneio {

          width: 100%;
          max-width: none;

          min-height: 277mm;

          background: #ffffff;
          color: #111827;

          font-family:
            Arial,
            Helvetica,
            sans-serif;

          font-size: 10px;
          font-weight: 500;

          text-transform: uppercase;

          box-sizing: border-box;

        }

        /* ===================================================
           CABEÇALHO
        =================================================== */

        .romaneio-header {

          width: 100%;

          display: flex;

          justify-content: space-between;

          align-items: flex-start;

          padding-bottom: 10px;

          box-sizing: border-box;

        }

        .romaneio-company {

          flex: 1;

          min-width: 0;

        }

        .romaneio-company-name {

          font-size: 24px;

          font-weight: 900;

          line-height: 1.1;

          word-break: break-word;

        }

        .romaneio-company-subtitle {

          font-size: 9px;

          margin-top: 4px;

          color: #64748b;

          font-weight: 700;

        }

        .romaneio-title-box {

          width: 220px;

          flex-shrink: 0;

          text-align: right;

        }

        .romaneio-title {

          font-size: 24px;

          font-weight: 900;

          line-height: 1;

        }

        .romaneio-subtitle {

          font-size: 9px;

          margin-top: 5px;

          color: #64748b;

          font-weight: 800;

        }

        .romaneio-line {

          width: 100%;

          border-top: 2px solid #111827;

          margin-bottom: 10px;

        }

        /* ===================================================
           INFORMAÇÕES
        =================================================== */

        .romaneio-info-grid {

          width: 100%;

          display: grid;

          grid-template-columns:
            1fr
            1fr
            1.5fr
            1.5fr;

          border: 1px solid #cbd5e1;

          margin-bottom: 8px;

          box-sizing: border-box;

        }

        .romaneio-info-item {

          padding: 7px 9px;

          border-right: 1px solid #cbd5e1;

          display: flex;

          flex-direction: column;

          gap: 3px;

          min-width: 0;

        }

        .romaneio-info-item:last-child {

          border-right: none;

        }

        .romaneio-label {

          display: block;

          font-size: 7px;

          color: #64748b;

          font-weight: 900;

          letter-spacing: 0.4px;

        }

        .romaneio-info-item strong {

          font-size: 9px;

          font-weight: 900;

          word-break: break-word;

        }

        /* ===================================================
           CLIENTE
        =================================================== */

        .romaneio-customer {

          width: 100%;

          display: grid;

          grid-template-columns: 3fr 1fr;

          border: 1px solid #cbd5e1;

          margin-bottom: 10px;

          box-sizing: border-box;

        }

        .romaneio-customer > div {

          padding: 7px 9px;

          border-right: 1px solid #cbd5e1;

          display: flex;

          flex-direction: column;

          gap: 3px;

          min-width: 0;

        }

        .romaneio-customer > div:last-child {

          border-right: none;

        }

        /* ===================================================
           SEÇÃO
        =================================================== */

        .romaneio-section-title {

          width: 100%;

          background: #111827;

          color: white;

          padding: 6px 9px;

          font-size: 8px;

          font-weight: 900;

          letter-spacing: 0.5px;

          margin-top: 8px;

          box-sizing: border-box;

        }

        .romaneio-section-title.small {

          margin-top: 0;

          background: #e2e8f0;

          color: #111827;

        }

        /* ===================================================
           TABELA
        =================================================== */

        .romaneio-table {

          width: 100%;

          max-width: none;

          min-width: 0;

          border-collapse: collapse;

          table-layout: fixed;

          margin: 0 0 10px 0;

          box-sizing: border-box;

        }

        .romaneio-table th {

          background: #f1f5f9;

          border: 1px solid #cbd5e1;

          padding: 5px 6px;

          font-size: 7px;

          font-weight: 900;

          text-align: left;

          box-sizing: border-box;

        }

        .romaneio-table td {

          border: 1px solid #cbd5e1;

          padding: 5px 6px;

          font-size: 8px;

          vertical-align: middle;

          box-sizing: border-box;

          overflow-wrap: anywhere;

        }

        .romaneio-table tbody tr:nth-child(even) {

          background: #f8fafc;

        }

        /* COLUNAS */

        .romaneio-table .col-seq {

          width: 5%;

          text-align: center;

        }

        .romaneio-table .col-sku {

          width: 13%;

        }

        .romaneio-table .col-desc {

          width: 39%;

        }

        .romaneio-table .col-qtd {

          width: 10%;

          text-align: right;

        }

        .romaneio-table .col-unit {

          width: 16%;

          text-align: right;

        }

        .romaneio-table .col-total {

          width: 17%;

          text-align: right;

        }

        .product-description {

          font-weight: 700;

          white-space: normal;

          word-break: break-word;

          overflow-wrap: anywhere;

        }

        .text-right {

          text-align: right !important;

        }

        .text-center {

          text-align: center !important;

        }

        .strong {

          font-weight: 900 !important;

        }

        .table-footer-label {

          text-align: right;

          font-weight: 900;

          background: #f1f5f9;

        }

        /* ===================================================
           FINANCEIRO
        =================================================== */

        .romaneio-financial {

          width: 100%;

          display: grid;

          grid-template-columns: 1fr 270px;

          gap: 10px;

          margin-top: 6px;

          box-sizing: border-box;

        }

        .payment-box {

          border: 1px solid #cbd5e1;

          min-width: 0;

        }

        .payment-main {

          padding: 9px;

          font-size: 11px;

          font-weight: 900;

        }

        .payment-details {

          border-top: 1px solid #e2e8f0;

          padding: 7px 9px;

          display: grid;

          grid-template-columns: 1fr 1fr;

          gap: 5px 15px;

          font-size: 8px;

        }

        .payment-details span {

          color: #64748b;

          font-size: 7px;

          margin-right: 4px;

          font-weight: 900;

        }

        .total-box {

          border: 2px solid #111827;

          display: flex;

          flex-direction: column;

          justify-content: center;

          align-items: flex-end;

          padding: 12px;

          box-sizing: border-box;

        }

        .total-label {

          font-size: 8px;

          font-weight: 900;

          color: #64748b;

        }

        .total-box strong {

          font-size: 20px;

          font-weight: 900;

          margin-top: 3px;

        }

        /* ===================================================
           OBSERVAÇÕES
        =================================================== */

        .romaneio-observation {

          width: 100%;

          margin-top: 14px;

          box-sizing: border-box;

        }

        .observation-line {

          height: 20px;

          border-bottom: 1px solid #cbd5e1;

        }

        /* ===================================================
           ASSINATURAS
        =================================================== */

        .signature-area {

          width: 100%;

          display: grid;

          grid-template-columns: 1fr 1fr;

          gap: 80px;

          margin-top: 45px;

          padding: 0 50px;

          box-sizing: border-box;

        }

        .signature {

          text-align: center;

          font-size: 8px;

          font-weight: 900;

          color: #475569;

        }

        .signature-line {

          border-top: 1px solid #111827;

          margin-bottom: 5px;

        }

        /* ===================================================
           RODAPÉ
        =================================================== */

        .romaneio-footer {

          width: 100%;

          display: flex;

          justify-content: space-between;

          gap: 10px;

          border-top: 1px solid #cbd5e1;

          margin-top: 30px;

          padding-top: 7px;

          color: #64748b;

          font-size: 7px;

          font-weight: 700;

          box-sizing: border-box;

        }

        /* ===================================================
           IMPRESSÃO
        =================================================== */

        @media print {

          @page {

            size: A4 portrait;

            /*
             * Margem pequena para aproveitar
             * praticamente toda a folha.
             */

            margin: 5mm;

          }

          html,
          body {

            width: 100% !important;

            min-width: 0 !important;

            max-width: none !important;

            margin: 0 !important;

            padding: 0 !important;

            background: white !important;

            overflow: visible !important;

          }

          body * {

            visibility: hidden !important;

          }

          #root {

            display: block !important;

            width: 100% !important;

            min-width: 0 !important;

            max-width: none !important;

            margin: 0 !important;

            padding: 0 !important;

          }

          #receipt-reprint-area {

            display: block !important;

            position: absolute !important;

            left: 0 !important;

            top: 0 !important;

            width: 100% !important;

            max-width: none !important;

            min-width: 0 !important;

            margin: 0 !important;

            padding: 0 !important;

            background: white !important;

            border: none !important;

            box-sizing: border-box !important;

          }

          #receipt-reprint-area,
          #receipt-reprint-area * {

            visibility: visible !important;

          }

          .a4-romaneio {

            display: block !important;

            width: 100% !important;

            max-width: none !important;

            min-width: 0 !important;

            margin: 0 !important;

            padding: 0 !important;

            box-sizing: border-box !important;

            background: white !important;

            color: #111827 !important;

          }

          /*
           * GARANTE TODA A LARGURA DA TABELA
           */

          .romaneio-table {

            width: 100% !important;

            max-width: none !important;

            min-width: 0 !important;

            table-layout: fixed !important;

            margin-left: 0 !important;

            margin-right: 0 !important;

          }

          /*
           * LARGURA DAS COLUNAS NO A4
           */

          .romaneio-table .col-seq {

            width: 5% !important;

          }

          .romaneio-table .col-sku {

            width: 13% !important;

          }

          .romaneio-table .col-desc {

            width: 39% !important;

          }

          .romaneio-table .col-qtd {

            width: 10% !important;

          }

          .romaneio-table .col-unit {

            width: 16% !important;

          }

          .romaneio-table .col-total {

            width: 17% !important;

          }

          /*
           * EVITA CORTE DE TEXTO
           */

          .product-description {

            white-space: normal !important;

            overflow-wrap: anywhere !important;

            word-break: break-word !important;

          }

          /*
           * REPETE CABEÇALHO DA TABELA
           * EM NOVAS PÁGINAS
           */

          .romaneio-table thead {

            display: table-header-group;

          }

          /*
           * EVITA DIVIDIR UMA LINHA
           */

          .romaneio-table tr {

            page-break-inside: avoid;

            break-inside: avoid;

          }

          /*
           * MANTÉM BLOCOS JUNTOS
           */

          .romaneio-section-title,
          .romaneio-financial,
          .romaneio-observation,
          .signature-area {

            page-break-inside: avoid;

            break-inside: avoid;

          }

          /*
           * CABEÇALHO / CAMPOS
           */

          .romaneio-header,
          .romaneio-info-grid,
          .romaneio-customer,
          .romaneio-financial,
          .romaneio-observation,
          .romaneio-footer {

            width: 100% !important;

            max-width: none !important;

            box-sizing: border-box !important;

          }

          /*
           * NÃO MOSTRAR ELEMENTOS DA TELA
           */

          header,
          footer,
          button,
          input,
          select,
          textarea {

            display: none !important;

          }

          /*
           * GARANTE QUE O FUNDO SEJA BRANCO
           */

          * {

            -webkit-print-color-adjust: exact !important;

            print-color-adjust: exact !important;

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
