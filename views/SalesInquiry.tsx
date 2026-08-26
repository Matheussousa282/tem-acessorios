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
  // ESTADOS DE FILTRO
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
  // ESTADOS DOS MODAIS
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
  // USUÁRIO / LOJA
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

      const search = filter.toLowerCase().trim();

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
  // REIMPRESSÃO DO ROMANEIO
  // =========================================================

  const handleReprint = (sale: Transaction) => {

    setSelectedTransaction(sale);

    setTimeout(() => {

      window.print();

      setTimeout(() => {
        setSelectedTransaction(null);
      }, 1000);

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

      alert(
        'Erro ao atualizar vendedor.'
      );

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
      setCustomerSearch('');
      setSelectedTransaction(null);

    } catch (e) {

      alert(
        'Erro ao atualizar cliente.'
      );

    }
  };

  // =========================================================
  // CLIENTES FILTRADOS
  // =========================================================

  const filteredCustomers = useMemo(() => {

    const search =
      customerSearch
        .toLowerCase()
        .trim();

    if (!search) {
      return customers;
    }

    return customers.filter(c =>
      c.name
        .toLowerCase()
        .includes(search) ||
      c.cpfCnpj
        ?.toLowerCase()
        .includes(search)
    );

  }, [
    customers,
    customerSearch
  ]);

  // =========================================================
  // RENDER
  // =========================================================

  return (

    <div
      className="
        min-h-screen
        bg-slate-100
        dark:bg-background-dark
        font-sans
        text-[11px]
        uppercase
        font-bold
        flex
        flex-col
        relative
      "
    >

      {/* =====================================================
          ROMANEIO A4 - IMPRESSÃO
      ====================================================== */}

      <div
        id="receipt-reprint-area"
        className="hidden print:block"
      >

        {selectedTransaction && (

          <div className="romaneio-a4">

            {/* =================================================
                CABEÇALHO
            ================================================== */}

            <div className="romaneio-header">

              <div className="empresa-info">

                <h1>
                  {selectedTransaction.store}
                </h1>

                <h2>
                  ROMANEIO DE VENDA
                </h2>

                <p>
                  DOCUMENTO DE VENDA / REIMPRESSÃO
                </p>

              </div>

              <div className="documento-info">

                <div>
                  <strong>
                    DOCUMENTO
                  </strong>

                  <span>
                    {selectedTransaction.id.slice(-6)}
                  </span>
                </div>

                <div>
                  <strong>
                    DATA
                  </strong>

                  <span>
                    {selectedTransaction.date}
                  </span>
                </div>

              </div>

            </div>

            {/* =================================================
                DADOS DA VENDA
            ================================================== */}

            <div className="romaneio-section-title">
              DADOS DA VENDA
            </div>

            <div className="dados-grid">

              <div className="campo">

                <label>
                  CLIENTE
                </label>

                <span>
                  {selectedTransaction.client ||
                    'CONSUMIDOR FINAL'}
                </span>

              </div>

              <div className="campo">

                <label>
                  VENDEDOR
                </label>

                <span>
                  {
                    getUserData(
                      selectedTransaction.vendorId
                    )?.name ||
                    'BALCÃO'
                  }
                </span>

              </div>

              <div className="campo">

                <label>
                  CAIXA
                </label>

                <span>
                  {
                    getUserData(
                      selectedTransaction.cashierId
                    )?.name ||
                    selectedTransaction.method ||
                    'SISTEMA'
                  }
                </span>

              </div>

              <div className="campo">

                <label>
                  LOJA / UNIDADE
                </label>

                <span>
                  {selectedTransaction.store}
                </span>

              </div>

            </div>

            {/* =================================================
                ITENS
            ================================================== */}

            <div className="romaneio-section-title">
              ITENS DA VENDA
            </div>

            <table className="romaneio-table">

              <thead>

                <tr>

                  <th className="col-item">
                    ITEM
                  </th>

                  <th className="col-codigo">
                    CÓDIGO
                  </th>

                  <th className="col-descricao">
                    DESCRIÇÃO
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
                        {item.quantity.toFixed(2)}
                      </td>

                      <td className="text-right">
                        R${' '}
                        {item.salePrice.toLocaleString(
                          'pt-BR',
                          {
                            minimumFractionDigits: 2
                          }
                        )}
                      </td>

                      <td className="text-right font-bold">
                        R${' '}
                        {(
                          item.quantity *
                          item.salePrice
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

            {/* =================================================
                RESUMO
            ================================================== */}

            <div className="resumo-container">

              <div className="resumo-left">

                <div className="resumo-box">

                  <strong>
                    FORMA DE PAGAMENTO
                  </strong>

                  <span>
                    {selectedTransaction.method ||
                      'DINHEIRO'}

                    {selectedTransaction.installments
                      ? ` - ${selectedTransaction.installments}X`
                      : ''}
                  </span>

                </div>

                {selectedTransaction.cardOperatorId && (

                  <div className="resumo-box">

                    <strong>
                      DADOS DO CARTÃO
                    </strong>

                    <span>
                      OPERADORA:{' '}
                      {
                        getCardInfo(
                          selectedTransaction.cardOperatorId,
                          selectedTransaction.cardBrandId
                        ).operator
                      }
                    </span>

                    <span>
                      BANDEIRA:{' '}
                      {
                        getCardInfo(
                          selectedTransaction.cardOperatorId,
                          selectedTransaction.cardBrandId
                        ).brand
                      }
                    </span>

                    <span>
                      NSU:{' '}
                      {selectedTransaction.transactionSku ||
                        '---'}
                    </span>

                    <span>
                      AUTH:{' '}
                      {selectedTransaction.authNumber ||
                        '---'}
                    </span>

                  </div>

                )}

              </div>

              <div className="total-box">

                <div className="total-label">
                  TOTAL DA VENDA
                </div>

                <div className="total-value">

                  R${' '}

                  {selectedTransaction.value.toLocaleString(
                    'pt-BR',
                    {
                      minimumFractionDigits: 2
                    }
                  )}

                </div>

              </div>

            </div>

            {/* =================================================
                ASSINATURAS
            ================================================== */}

            <div className="assinaturas">

              <div className="assinatura">

                <div></div>

                <span>
                  RESPONSÁVEL / CLIENTE
                </span>

              </div>

              <div className="assinatura">

                <div></div>

                <span>
                  VENDEDOR
                </span>

              </div>

            </div>

            {/* =================================================
                RODAPÉ
            ================================================== */}

            <div className="romaneio-footer">

              <span>
                DOCUMENTO REIMPRESSO EM{' '}
                {new Date().toLocaleString(
                  'pt-BR'
                )}
              </span>

              <span>
                ROMANEIO DE VENDA
              </span>

            </div>

          </div>

        )}

      </div>


      {/* =====================================================
          CABEÇALHO DA TELA
      ====================================================== */}

      <header
        className="
          bg-primary
          p-4
          flex
          items-center
          justify-between
          text-white
          shadow-lg
          shrink-0
          print:hidden
        "
      >

        <div className="flex items-center gap-4">

          <div
            className="
              bg-white
              rounded-lg
              p-1.5
              flex
              items-center
              justify-center
            "
          >

            <span
              className="
                material-symbols-outlined
                text-primary
                text-2xl
              "
            >
              receipt_long
            </span>

          </div>

          <h1
            className="
              text-sm
              font-black
              tracking-tight
            "
          >
            DOCUMENTOS DE VENDAS PDV
          </h1>

        </div>

      </header>


      {/* =====================================================
          FILTROS
      ====================================================== */}

      <div
        className="
          p-4
          bg-white
          dark:bg-slate-900
          border-b
          border-slate-200
          dark:border-slate-800
          flex
          flex-wrap
          items-end
          gap-4
          shadow-sm
          print:hidden
        "
      >

        {/* DATA INICIAL */}

        <div className="space-y-1">

          <label
            className="
              text-[9px]
              text-slate-400
              font-black
              px-1
            "
          >
            DATA INICIAL:
          </label>

          <div
            className="
              h-10
              bg-slate-50
              dark:bg-slate-800
              border
              border-slate-200
              dark:border-slate-700
              rounded
              px-3
              flex
              items-center
              gap-2
            "
          >

            <span
              className="
                material-symbols-outlined
                text-slate-400
                text-sm
              "
            >
              calendar_today
            </span>

            <input
              type="date"
              value={startDate}
              onChange={e =>
                setStartDate(e.target.value)
              }
              className="
                bg-transparent
                border-none
                text-[10px]
                font-black
                outline-none
                focus:ring-0
                p-0
                w-24
              "
            />

          </div>

        </div>


        {/* DATA FINAL */}

        <div className="space-y-1">

          <label
            className="
              text-[9px]
              text-slate-400
              font-black
              px-1
            "
          >
            DATA FINAL:
          </label>

          <div
            className="
              h-10
              bg-slate-50
              dark:bg-slate-800
              border
              border-slate-200
              dark:border-slate-700
              rounded
              px-3
              flex
              items-center
              gap-2
            "
          >

            <span
              className="
                material-symbols-outlined
                text-slate-400
                text-sm
              "
            >
              calendar_today
            </span>

            <input
              type="date"
              value={endDate}
              onChange={e =>
                setEndDate(e.target.value)
              }
              className="
                bg-transparent
                border-none
                text-[10px]
                font-black
                outline-none
                focus:ring-0
                p-0
                w-24
              "
            />

          </div>

        </div>


        {/* LOJA */}

        <div className="space-y-1">

          <label
            className="
              text-[9px]
              text-slate-400
              font-black
              px-1
            "
          >
            UNIDADE / LOJA:
          </label>

          <div
            className="
              h-10
              bg-slate-50
              dark:bg-slate-800
              border
              border-slate-200
              dark:border-slate-700
              rounded
              px-3
              flex
              items-center
              gap-2
            "
          >

            <span
              className="
                material-symbols-outlined
                text-slate-400
                text-sm
              "
            >
              store
            </span>

            <select
              disabled={!isAdmin}
              value={storeFilter}
              onChange={e =>
                setStoreFilter(e.target.value)
              }
              className="
                bg-transparent
                border-none
                text-[10px]
                font-black
                outline-none
                focus:ring-0
                p-0
                pr-8
              "
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


        {/* PESQUISA */}

        <div className="flex-1 space-y-1">

          <label
            className="
              text-[9px]
              text-slate-400
              font-black
              px-1
            "
          >
            PESQUISA RÁPIDA (ID OU CLIENTE):
          </label>

          <div className="relative">

            <span
              className="
                material-symbols-outlined
                absolute
                left-3
                top-1/2
                -translate-y-1/2
                text-slate-400
                text-sm
              "
            >
              search
            </span>

            <input
              value={filter}
              onChange={e =>
                setFilter(e.target.value)
              }
              placeholder="DIGITE PARA BUSCAR..."
              className="
                w-full
                h-10
                bg-slate-50
                dark:bg-slate-800
                border
                border-slate-200
                dark:border-slate-700
                rounded
                pl-10
                text-[10px]
                font-black
                outline-none
                focus:ring-1
                focus:ring-primary/30
                uppercase
              "
            />

          </div>

        </div>


        {/* LIMPAR */}

        <button
          onClick={() => {

            setFilter('');
            setStoreFilter('TODAS');

          }}
          className="
            h-10
            px-4
            bg-slate-100
            dark:bg-slate-800
            border
            border-slate-200
            dark:border-slate-700
            rounded
            text-[9px]
            font-black
            hover:bg-rose-50
            hover:text-rose-600
            transition-all
            flex
            items-center
            gap-2
          "
        >

          <span
            className="
              material-symbols-outlined
              text-sm
            "
          >
            filter_alt_off
          </span>

          LIMPAR

        </button>

      </div>


      {/* =====================================================
          TABELA
      ====================================================== */}

      <div
        className="
          flex-1
          overflow-auto
          bg-white
          dark:bg-slate-900
          print:hidden
        "
      >

        <table
          className="
            w-full
            text-left
            border-collapse
            min-w-[1200px]
          "
        >

          <thead
            className="
              bg-primary
              text-white
              sticky
              top-0
              z-20
            "
          >

            <tr
              className="
                divide-x
                divide-white/10
              "
            >

              <th
                className="
                  px-3
                  py-2
                  text-center
                  w-10
                "
              >

                <span
                  className="
                    material-symbols-outlined
                    text-sm
                  "
                >
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

              <th
                className="
                  px-3
                  py-2
                  w-24
                  text-right
                "
              >
                Qtd. Itens
              </th>

              <th
                className="
                  px-3
                  py-2
                  w-32
                  text-right
                "
              >
                Vr. Total
              </th>

            </tr>

          </thead>

          <tbody
            className="
              divide-y
              divide-slate-100
              dark:divide-slate-800
            "
          >

            {sales.map(s => (

              <tr
                key={s.id}
                onClick={() => {

                  setViewingDetail(s);
                  setActiveDetailTab('ITENS');

                }}
                className="
                  hover:bg-slate-50
                  dark:hover:bg-slate-800/40
                  divide-x
                  divide-slate-100
                  dark:divide-slate-800
                  transition-colors
                  cursor-pointer
                  group
                "
              >

                <td
                  className="
                    px-3
                    py-1.5
                    text-center
                  "
                >

                  <div
                    className="
                      size-2.5
                      bg-blue-600
                      rounded-full
                      mx-auto
                    "
                  />

                </td>


                {/* OPÇÕES */}

                <td
                  className="
                    px-3
                    py-1.5
                    relative
                  "
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
                    className="
                      bg-slate-100
                      dark:bg-slate-800
                      border
                      border-slate-200
                      dark:border-slate-700
                      rounded
                      px-2
                      py-0.5
                      hover:bg-primary
                      hover:text-white
                      transition-all
                      flex
                      items-center
                      justify-center
                    "
                  >

                    <span
                      className="
                        material-symbols-outlined
                        text-sm
                      "
                    >
                      list
                    </span>

                  </button>


                  {showOptionsId === s.id && (

                    <div
                      className="
                        absolute
                        left-full
                        top-0
                        ml-1
                        z-50
                        bg-white
                        dark:bg-slate-800
                        shadow-2xl
                        border
                        border-slate-200
                        dark:border-slate-700
                        rounded-lg
                        py-2
                        w-56
                      "
                    >

                      <p
                        className="
                          px-4
                          py-1
                          text-[9px]
                          text-slate-400
                          font-black
                          border-b
                          mb-1
                        "
                      >
                        Ações Disponíveis
                      </p>


                      <button
                        onClick={() =>
                          handleReprint(s)
                        }
                        className="
                          w-full
                          text-left
                          px-4
                          py-2
                          hover:bg-slate-50
                          dark:hover:bg-slate-700
                          flex
                          items-center
                          gap-2
                        "
                      >

                        <span
                          className="
                            material-symbols-outlined
                            text-sm
                          "
                        >
                          print
                        </span>

                        01 - Reimprimir Romaneio

                      </button>


                      <button
                        onClick={() => {

                          setSelectedTransaction(s);
                          setShowCustomerModal(true);
                          setShowOptionsId(null);
                          setCustomerSearch('');

                        }}
                        className="
                          w-full
                          text-left
                          px-4
                          py-2
                          hover:bg-slate-50
                          dark:hover:bg-slate-700
                          flex
                          items-center
                          gap-2
                        "
                      >

                        <span
                          className="
                            material-symbols-outlined
                            text-sm
                          "
                        >
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
                        className="
                          w-full
                          text-left
                          px-4
                          py-2
                          hover:bg-slate-50
                          dark:hover:bg-slate-700
                          flex
                          items-center
                          gap-2
                        "
                      >

                        <span
                          className="
                            material-symbols-outlined
                            text-sm
                          "
                        >
                          badge
                        </span>

                        06 - Alterar Vendedor

                      </button>

                    </div>

                  )}

                </td>


                <td
                  className="
                    px-3
                    py-1.5
                    font-mono
                    text-slate-400
                  "
                >
                  {s.id.slice(-6)}
                </td>


                <td
                  className="
                    px-3
                    py-1.5
                    text-primary
                  "
                >
                  {s.store}
                </td>


                <td
                  className="
                    px-3
                    py-1.5
                    text-primary
                  "
                >
                  {
                    getUserData(
                      s.vendorId
                    )?.name.split(' ')[0] ||
                    '---'
                  }
                </td>


                <td
                  className="
                    px-3
                    py-1.5
                    text-slate-500
                  "
                >
                  {s.date}
                </td>


                <td
                  className="
                    px-3
                    py-1.5
                  "
                >

                  <span
                    className="
                      truncate
                      max-w-[200px]
                      uppercase
                    "
                  >
                    {s.client ||
                      'Consumidor Final'}
                  </span>

                </td>


                <td
                  className="
                    px-3
                    py-1.5
                    text-right
                    font-black
                    tabular-nums
                  "
                >
                  {s.items
                    ?.reduce(
                      (acc, i) =>
                        acc + i.quantity,
                      0
                    )
                    .toFixed(2)}
                </td>


                <td
                  className="
                    px-3
                    py-1.5
                    text-right
                    font-black
                    text-slate-900
                    dark:text-white
                    tabular-nums
                  "
                >

                  R${' '}

                  {s.value.toLocaleString(
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
          RODAPÉ DA TELA
      ====================================================== */}

      <footer
        className="
          bg-slate-400
          p-2
          flex
          justify-between
          items-center
          text-slate-900
          font-black
          shrink-0
          print:hidden
        "
      >

        <div className="flex items-center gap-4">

          <span className="text-[12px]">
            TOTAL GERAL PESQUISA
          </span>

        </div>

        <div
          className="
            flex
            gap-10
            pr-4
          "
        >

          <span
            className="
              text-[12px]
              tabular-nums
            "
          >
            {totals.qtyItems
              .toFixed(2)
              .replace('.', ',')}
          </span>

          <span
            className="
              text-[12px]
              tabular-nums
            "
          >

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
      ====================================================== */}

      {viewingDetail && (

        <div
          className="
            fixed
            inset-0
            z-[150]
            flex
            items-center
            justify-center
            bg-black/60
            p-4
            animate-in
            fade-in
            print:hidden
          "
        >

          <div
            className="
              bg-slate-100
              w-full
              max-w-[1200px]
              h-[90vh]
              rounded
              shadow-2xl
              flex
              flex-col
              overflow-hidden
              text-slate-700
            "
          >

            <div
              className="
                bg-white
                p-3
                border-b
                border-slate-300
                flex
                items-center
                justify-between
              "
            >

              <h2
                className="
                  text-sm
                  font-bold
                  flex
                  items-center
                  gap-2
                "
              >

                Informações Gerais do Documento

                <span
                  className="
                    bg-blue-100
                    text-blue-700
                    px-2
                    py-0.5
                    rounded-full
                    text-[10px]
                  "
                >
                  VENDA
                </span>

              </h2>


              <button
                onClick={() =>
                  setViewingDetail(null)
                }
                className="
                  size-8
                  hover:bg-rose-500
                  hover:text-white
                  flex
                  items-center
                  justify-center
                  rounded
                  transition-all
                "
              >

                <span
                  className="
                    material-symbols-outlined
                  "
                >
                  close
                </span>

              </button>

            </div>


            <div
              className="
                p-4
                space-y-4
                overflow-y-auto
              "
            >

              <div
                className="
                  grid
                  grid-cols-12
                  gap-2
                "
              >

                <div className="col-span-2">

                  <DetailField
                    label="ID:"
                    value={
                      viewingDetail.id.slice(-6)
                    }
                  />

                </div>

                <div className="col-span-10">

                  <DetailField
                    label="LOJA:"
                    value={
                      viewingDetail.store
                    }
                    borderHighlight
                  />

                </div>

              </div>


              <div
                className="
                  grid
                  grid-cols-12
                  gap-2
                "
              >

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
                    value={
                      viewingDetail.date
                    }
                    borderHighlight
                  />

                </div>

              </div>


              <div
                className="
                  grid
                  grid-cols-12
                  gap-2
                "
              >

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
                    className="
                      w-full
                      h-12
                      bg-primary
                      text-white
                      rounded
                      font-black
                      uppercase
                      text-[10px]
                      shadow
                      flex
                      items-center
                      justify-center
                      gap-2
                      hover:bg-blue-600
                    "
                  >

                    <span
                      className="
                        material-symbols-outlined
                        text-sm
                      "
                    >
                      print
                    </span>

                    Reimprimir Romaneio

                  </button>

                </div>

              </div>


              <div
                className="
                  bg-primary
                  text-white
                  flex
                  items-center
                  px-4
                  py-1.5
                  gap-8
                  mt-2
                "
              >

                <button
                  onClick={() =>
                    setActiveDetailTab(
                      'ITENS'
                    )
                  }
                  className={`
                    text-[10px]
                    font-black
                    pb-0.5
                    uppercase
                    ${
                      activeDetailTab === 'ITENS'
                        ? 'border-b-2 border-white'
                        : 'opacity-70'
                    }
                  `}
                >
                  ITENS
                </button>


                <button
                  onClick={() =>
                    setActiveDetailTab(
                      'PAGAMENTO'
                    )
                  }
                  className={`
                    text-[10px]
                    font-black
                    pb-0.5
                    uppercase
                    ${
                      activeDetailTab === 'PAGAMENTO'
                        ? 'border-b-2 border-white'
                        : 'opacity-70'
                    }
                  `}
                >
                  FORMAS DE PAGAMENTO
                </button>

              </div>


              <div
                className="
                  bg-white
                  border
                  border-slate-300
                  flex
                  flex-col
                  min-h-[300px]
                "
              >

                {/* ITENS */}

                {activeDetailTab === 'ITENS' && (

                  <div
                    className="
                      overflow-auto
                      flex-1
                    "
                  >

                    <table
                      className="
                        w-full
                        text-left
                        border-collapse
                        text-[10px]
                      "
                    >

                      <thead
                        className="
                          bg-primary
                          text-white
                        "
                      >

                        <tr>

                          <th className="px-2 py-1">
                            Produto
                          </th>

                          <th
                            className="
                              px-2
                              py-1
                              text-right
                            "
                          >
                            Qtd.
                          </th>

                          <th
                            className="
                              px-2
                              py-1
                              text-right
                            "
                          >
                            Vr. Unitário
                          </th>

                          <th
                            className="
                              px-2
                              py-1
                              text-right
                            "
                          >
                            Vr. Total
                          </th>

                        </tr>

                      </thead>


                      <tbody>

                        {viewingDetail.items?.map(
                          (item, idx) => (

                            <tr
                              key={idx}
                              className="
                                hover:bg-slate-50
                                border-b
                              "
                            >

                              <td className="px-2 py-1">

                                <span
                                  className="
                                    text-blue-600
                                    font-black
                                  "
                                >
                                  {item.sku}
                                </span>

                                {' - '}

                                {item.name}

                              </td>

                              <td
                                className="
                                  px-2
                                  py-1
                                  text-right
                                  font-black
                                "
                              >
                                {item.quantity.toFixed(2)}
                              </td>

                              <td
                                className="
                                  px-2
                                  py-1
                                  text-right
                                "
                              >
                                R${' '}
                                {item.salePrice.toLocaleString(
                                  'pt-BR',
                                  {
                                    minimumFractionDigits: 2
                                  }
                                )}
                              </td>

                              <td
                                className="
                                  px-2
                                  py-1
                                  text-right
                                  font-black
                                "
                              >
                                R${' '}
                                {(
                                  item.quantity *
                                  item.salePrice
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


                {/* PAGAMENTO */}

                {activeDetailTab === 'PAGAMENTO' && (

                  <div
                    className="
                      p-8
                      space-y-6
                    "
                  >

                    <div
                      className="
                        grid
                        grid-cols-3
                        gap-6
                      "
                    >

                      <div
                        className="
                          bg-slate-50
                          p-4
                          rounded
                          border
                        "
                      >

                        <p
                          className="
                            text-[9px]
                            text-slate-400
                          "
                        >
                          PAGAMENTO
                        </p>

                        <p
                          className="
                            text-sm
                            font-black
                          "
                        >
                          {viewingDetail.method ||
                            'DINHEIRO'}
                        </p>

                      </div>


                      <div
                        className="
                          bg-slate-50
                          p-4
                          rounded
                          border
                        "
                      >

                        <p
                          className="
                            text-[9px]
                            text-slate-400
                          "
                        >
                          TOTAL
                        </p>

                        <p
                          className="
                            text-sm
                            font-black
                            text-emerald-600
                          "
                        >

                          R${' '}

                          {viewingDetail.value.toLocaleString(
                            'pt-BR',
                            {
                              minimumFractionDigits: 2
                            }
                          )}

                        </p>

                      </div>

                    </div>


                    {viewingDetail.cardOperatorId && (

                      <div
                        className="
                          grid
                          grid-cols-4
                          gap-4
                        "
                      >

                        <div
                          className="
                            bg-white
                            p-3
                            rounded
                            border
                          "
                        >

                          <p
                            className="
                              text-[8px]
                              text-slate-400
                            "
                          >
                            OPERADORA
                          </p>

                          <p
                            className="
                              text-[10px]
                              font-bold
                            "
                          >
                            {
                              getCardInfo(
                                viewingDetail.cardOperatorId,
                                viewingDetail.cardBrandId
                              ).operator
                            }
                          </p>

                        </div>


                        <div
                          className="
                            bg-white
                            p-3
                            rounded
                            border
                          "
                        >

                          <p
                            className="
                              text-[8px]
                              text-slate-400
                            "
                          >
                            BANDEIRA
                          </p>

                          <p
                            className="
                              text-[10px]
                              font-bold
                            "
                          >
                            {
                              getCardInfo(
                                viewingDetail.cardOperatorId,
                                viewingDetail.cardBrandId
                              ).brand
                            }
                          </p>

                        </div>


                        <div
                          className="
                            bg-white
                            p-3
                            rounded
                            border
                          "
                        >

                          <p
                            className="
                              text-[8px]
                              text-slate-400
                            "
                          >
                            NSU
                          </p>

                          <p
                            className="
                              text-[10px]
                              font-bold
                            "
                          >
                            {
                              viewingDetail.transactionSku ||
                              '---'
                            }
                          </p>

                        </div>


                        <div
                          className="
                            bg-white
                            p-3
                            rounded
                            border
                          "
                        >

                          <p
                            className="
                              text-[8px]
                              text-slate-400
                            "
                          >
                            AUTH
                          </p>

                          <p
                            className="
                              text-[10px]
                              font-bold
                            "
                          >
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
          MODAL ALTERAR VENDEDOR
      ====================================================== */}

      {showVendorModal && (

        <div
          className="
            fixed
            inset-0
            z-[200]
            flex
            items-center
            justify-center
            bg-black/80
            backdrop-blur-xl
            p-4
            animate-in
            fade-in
          "
        >

          <div
            className="
              bg-white
              dark:bg-slate-900
              w-full
              max-w-lg
              rounded-[2.5rem]
              shadow-2xl
              overflow-hidden
              animate-in
              zoom-in-95
            "
          >

            <div
              className="
                p-6
                bg-primary
                text-white
                flex
                justify-between
                items-center
                font-black
              "
            >

              <h3 className="text-lg uppercase">
                Alterar Vendedor
              </h3>

              <button
                onClick={() =>
                  setShowVendorModal(false)
                }
              >

                <span
                  className="
                    material-symbols-outlined
                  "
                >
                  close
                </span>

              </button>

            </div>


            <div
              className="
                p-8
                space-y-4
              "
            >

              <p
                className="
                  text-[10px]
                  text-slate-400
                  font-black
                  uppercase
                  mb-4
                  tracking-widest
                  px-2
                "
              >
                Selecione o novo vendedor para
                o documento{' '}
                {selectedTransaction?.id.slice(-6)}:
              </p>


              <div
                className="
                  space-y-2
                  max-h-96
                  overflow-y-auto
                  custom-scrollbar
                  pr-2
                "
              >

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
                      className={`
                        w-full
                        p-4
                        rounded-2xl
                        flex
                        items-center
                        justify-between
                        group
                        transition-all
                        ${
                          selectedTransaction?.vendorId ===
                          v.id
                            ? 'bg-primary text-white'
                            : 'bg-slate-50 dark:bg-slate-800 hover:bg-primary/10'
                        }
                      `}
                    >

                      <span
                        className={`
                          text-xs
                          font-black
                          uppercase
                          ${
                            selectedTransaction?.vendorId ===
                            v.id
                              ? 'text-white'
                              : 'text-slate-700 dark:text-slate-200'
                          }
                        `}
                      >
                        {v.name}
                      </span>

                      <span
                        className="
                          material-symbols-outlined
                          opacity-0
                          group-hover:opacity-100
                          transition-opacity
                        "
                      >
                        check_circle
                      </span>

                    </button>

                  ))}


                <button
                  onClick={() =>
                    handleUpdateVendor('')
                  }
                  className="
                    w-full
                    p-4
                    rounded-2xl
                    bg-slate-100
                    dark:bg-slate-700
                    text-slate-400
                    text-xs
                    font-black
                    uppercase
                    hover:bg-rose-500
                    hover:text-white
                    transition-all
                    text-center
                  "
                >
                  Limpar Vendedor (Balcão)
                </button>

              </div>

            </div>

          </div>

        </div>

      )}


      {/* =====================================================
          MODAL ALTERAR CLIENTE
      ====================================================== */}

      {showCustomerModal && (

        <div
          className="
            fixed
            inset-0
            z-[200]
            flex
            items-center
            justify-center
            bg-black/80
            backdrop-blur-xl
            p-4
            animate-in
            fade-in
          "
        >

          <div
            className="
              bg-white
              dark:bg-slate-900
              w-full
              max-w-2xl
              rounded-[2.5rem]
              shadow-2xl
              overflow-hidden
              animate-in
              zoom-in-95
            "
          >

            <div
              className="
                p-6
                bg-primary
                text-white
                flex
                justify-between
                items-center
                font-black
              "
            >

              <h3 className="text-lg uppercase">
                Alterar Cliente
              </h3>

              <button
                onClick={() => {

                  setShowCustomerModal(false);
                  setCustomerSearch('');

                }}
              >

                <span
                  className="
                    material-symbols-outlined
                  "
                >
                  close
                </span>

              </button>

            </div>


            <div
              className="
                p-8
                space-y-4
              "
            >

              <div
                className="
                  relative
                  mb-6
                "
              >

                <span
                  className="
                    material-symbols-outlined
                    absolute
                    left-4
                    top-1/2
                    -translate-y-1/2
                    text-slate-400
                  "
                >
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
                  placeholder="
                    BUSCAR CLIENTE PELO NOME...
                  "
                  className="
                    w-full
                    h-12
                    bg-slate-50
                    dark:bg-slate-800
                    border-none
                    rounded-xl
                    pl-12
                    pr-6
                    text-xs
                    font-black
                    uppercase
                    outline-none
                    focus:ring-2
                    focus:ring-primary/20
                  "
                />

              </div>


              <div
                className="
                  space-y-2
                  max-h-96
                  overflow-y-auto
                  custom-scrollbar
                  pr-2
                "
              >

                {filteredCustomers.map(c => (

                  <button
                    key={c.id}
                    onClick={() =>
                      handleUpdateCustomer(
                        c.id
                      )
                    }
                    className={`
                      w-full
                      p-5
                      rounded-2xl
                      flex
                      flex-col
                      text-left
                      group
                      transition-all
                      ${
                        selectedTransaction?.clientId ===
                        c.id
                          ? 'bg-primary text-white'
                          : 'bg-slate-50 dark:bg-slate-800 hover:bg-primary/10'
                      }
                    `}
                  >

                    <span
                      className={`
                        text-sm
                        font-black
                        uppercase
                        ${
                          selectedTransaction?.clientId ===
                          c.id
                            ? 'text-white'
                            : 'text-slate-800 dark:text-slate-200'
                        }
                      `}
                    >
                      {c.name}
                    </span>

                    <span
                      className={`
                        text-[10px]
                        font-bold
                        ${
                          selectedTransaction?.clientId ===
                          c.id
                            ? 'text-white/60'
                            : 'text-slate-400'
                        }
                      `}
                    >
                      {c.cpfCnpj ||
                        'DOCUMENTO NÃO CADASTRADO'}
                    </span>

                  </button>

                ))}


                {filteredCustomers.length === 0 && (

                  <div
                    className="
                      text-center
                      py-8
                      text-slate-400
                      text-xs
                    "
                  >
                    NENHUM CLIENTE ENCONTRADO
                  </div>

                )}


                <button
                  onClick={() =>
                    handleUpdateCustomer('')
                  }
                  className="
                    w-full
                    p-4
                    rounded-2xl
                    bg-slate-100
                    dark:bg-slate-700
                    text-slate-400
                    text-xs
                    font-black
                    uppercase
                    hover:bg-rose-500
                    hover:text-white
                    transition-all
                    text-center
                  "
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
      ====================================================== */}

      <style>{`

        /* ================================================
           SCROLLBAR
        ================================================ */

        .custom-scrollbar::-webkit-scrollbar {
          width: 4px;
          height: 4px;
        }

        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 20px;
        }


        /* ================================================
           ROMANEIO A4
        ================================================ */

        .romaneio-a4 {

          width: 100%;
          max-width: 100%;

          margin: 0 auto;

          padding: 10mm;

          box-sizing: border-box;

          background: #ffffff;

          color: #111827;

          font-family:
            Arial,
            Helvetica,
            sans-serif;

          font-size: 10px;

          line-height: 1.35;
        }


        /* ================================================
           CABEÇALHO
        ================================================ */

        .romaneio-header {

          width: 100%;

          display: flex;

          justify-content: space-between;

          align-items: flex-start;

          padding-bottom: 12px;

          margin-bottom: 12px;

          border-bottom:
            2px solid #111827;

          box-sizing: border-box;
        }


        .empresa-info {

          flex: 1;

        }


        .empresa-info h1 {

          margin: 0;

          font-size: 20px;

          font-weight: 900;

          text-transform: uppercase;

        }


        .empresa-info h2 {

          margin: 4px 0 0 0;

          font-size: 15px;

          font-weight: 900;

          text-transform: uppercase;

        }


        .empresa-info p {

          margin: 4px 0 0 0;

          font-size: 9px;

          color: #4b5563;

          font-weight: bold;

        }


        .documento-info {

          width: 180px;

          display: grid;

          grid-template-columns:
            1fr 1fr;

          border:
            1px solid #111827;

        }


        .documento-info div {

          padding: 7px;

          display: flex;

          flex-direction: column;

          gap: 2px;

        }


        .documento-info div + div {

          border-left:
            1px solid #111827;

        }


        .documento-info strong {

          font-size: 8px;

          font-weight: 900;

        }


        .documento-info span {

          font-size: 11px;

          font-weight: bold;

        }


        /* ================================================
           TÍTULOS
        ================================================ */

        .romaneio-section-title {

          width: 100%;

          background: #e5e7eb;

          border:
            1px solid #9ca3af;

          padding: 6px 8px;

          margin-top: 10px;

          margin-bottom: 6px;

          box-sizing: border-box;

          font-size: 9px;

          font-weight: 900;

          text-transform: uppercase;

        }


        /* ================================================
           DADOS
        ================================================ */

        .dados-grid {

          width: 100%;

          display: grid;

          grid-template-columns:
            2fr
            1.5fr
            1.2fr
            1.5fr;

          border:
            1px solid #d1d5db;

          box-sizing: border-box;

        }


        .campo {

          min-height: 45px;

          padding: 6px 8px;

          display: flex;

          flex-direction: column;

          justify-content: center;

          box-sizing: border-box;

        }


        .campo + .campo {

          border-left:
            1px solid #d1d5db;

        }


        .campo label {

          font-size: 7px;

          font-weight: 900;

          color: #6b7280;

          margin-bottom: 3px;

        }


        .campo span {

          font-size: 9px;

          font-weight: 700;

          text-transform: uppercase;

          overflow: hidden;

          text-overflow: ellipsis;

        }


        /* ================================================
           TABELA
        ================================================ */

        .romaneio-table {

          width: 100%;

          border-collapse: collapse;

          table-layout: fixed;

          font-size: 9px;

        }


        .romaneio-table thead {

          background: #1f2937;

          color: white;

        }


        .romaneio-table th {

          padding: 7px 5px;

          border:
            1px solid #1f2937;

          font-size: 8px;

          font-weight: 900;

          text-transform: uppercase;

        }


        .romaneio-table td {

          padding: 6px 5px;

          border:
            1px solid #d1d5db;

          vertical-align: middle;

          word-wrap: break-word;

        }


        .romaneio-table tbody tr:nth-child(even) {

          background: #f9fafb;

        }


        .romaneio-table .col-item {

          width: 6%;

        }


        .romaneio-table .col-codigo {

          width: 14%;

        }


        .romaneio-table .col-descricao {

          width: 40%;

        }


        .romaneio-table .col-qtd {

          width: 10%;

        }


        .romaneio-table .col-unit {

          width: 15%;

        }


        .romaneio-table .col-total {

          width: 15%;

        }


        /* ================================================
           RESUMO
        ================================================ */

        .resumo-container {

          width: 100%;

          display: flex;

          justify-content: space-between;

          gap: 15px;

          margin-top: 12px;

          box-sizing: border-box;

        }


        .resumo-left {

          flex: 1;

          display: flex;

          gap: 8px;

        }


        .resumo-box {

          min-width: 180px;

          border:
            1px solid #d1d5db;

          padding: 8px;

          display: flex;

          flex-direction: column;

          gap: 3px;

          box-sizing: border-box;

        }


        .resumo-box strong {

          font-size: 8px;

          font-weight: 900;

          padding-bottom: 4px;

          border-bottom:
            1px solid #e5e7eb;

        }


        .resumo-box span {

          font-size: 8px;

          font-weight: 600;

        }


        /* ================================================
           TOTAL
        ================================================ */

        .total-box {

          width: 230px;

          border:
            2px solid #111827;

          padding: 10px;

          box-sizing: border-box;

          display: flex;

          flex-direction: column;

          justify-content: center;

          align-items: flex-end;

        }


        .total-label {

          font-size: 9px;

          font-weight: 900;

          text-transform: uppercase;

        }


        .total-value {

          margin-top: 4px;

          font-size: 19px;

          font-weight: 900;

        }


        /* ================================================
           ASSINATURAS
        ================================================ */

        .assinaturas {

          width: 100%;

          display: flex;

          justify-content: space-between;

          gap: 60px;

          margin-top: 45px;

          box-sizing: border-box;

        }


        .assinatura {

          flex: 1;

          text-align: center;

        }


        .assinatura div {

          width: 100%;

          border-top:
            1px solid #111827;

          margin-bottom: 5px;

        }


        .assinatura span {

          font-size: 8px;

          font-weight: 900;

          text-transform: uppercase;

        }


        /* ================================================
           RODAPÉ
        ================================================ */

        .romaneio-footer {

          width: 100%;

          margin-top: 25px;

          padding-top: 8px;

          border-top:
            1px solid #9ca3af;

          display: flex;

          justify-content: space-between;

          font-size: 7px;

          color: #6b7280;

          font-weight: bold;

        }


        /* ================================================
           IMPRESSÃO
        ================================================ */

        @media print {

          @page {
            size: A4 portrait;
            margin: 0;
          }

          html,
          body {
            width: 100% !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
          }

          body {
            overflow: visible !important;
          }

          body * {
            visibility: hidden !important;
          }

          #root {
            width: 100% !important;
            min-width: 0 !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }

          #receipt-reprint-area {
            visibility: visible !important;
            display: block !important;
            position: static !important;

            width: 100% !important;
            min-width: 0 !important;
            max-width: none !important;

            height: auto !important;

            margin: 0 !important;
            padding: 0 !important;

            left: auto !important;
            top: auto !important;

            background: #ffffff !important;
          }

          #receipt-reprint-area * {
            visibility: visible !important;
          }

          .romaneio-a4 {
            visibility: visible !important;
            display: block !important;

            width: 100% !important;
            min-width: 0 !important;
            max-width: none !important;

            min-height: 297mm !important;

            margin: 0 !important;
            padding: 10mm !important;

            box-sizing: border-box !important;

            background: #ffffff !important;
            color: #111827 !important;

            font-family: Arial, Helvetica, sans-serif !important;
            font-size: 10px !important;
            line-height: 1.3 !important;
          }

          .romaneio-header {
            width: 100% !important;

            display: flex !important;
            justify-content: space-between !important;
            align-items: flex-start !important;

            gap: 15px !important;

            padding-bottom: 8px !important;
            margin-bottom: 8px !important;

            border-bottom: 2px solid #111827 !important;

            box-sizing: border-box !important;
          }

          .empresa-info {
            flex: 1 1 auto !important;
            min-width: 0 !important;
          }

          .empresa-info h1 {
            margin: 0 !important;
            font-size: 19px !important;
            line-height: 1.1 !important;
            font-weight: 900 !important;
          }

          .empresa-info h2 {
            margin: 3px 0 0 !important;
            font-size: 14px !important;
            line-height: 1.1 !important;
            font-weight: 900 !important;
          }

          .empresa-info p {
            margin: 3px 0 0 !important;
            font-size: 8px !important;
            color: #4b5563 !important;
            font-weight: 700 !important;
          }

          .documento-info {
            flex: 0 0 170px !important;
            width: 170px !important;
            display: grid !important;
            grid-template-columns: 1fr 1fr !important;
            border: 1px solid #111827 !important;
          }

          .documento-info div {
            padding: 6px !important;
          }

          .documento-info strong {
            font-size: 7px !important;
            font-weight: 900 !important;
          }

          .documento-info span {
            font-size: 10px !important;
            font-weight: 900 !important;
          }

          .romaneio-section-title {
            width: 100% !important;

            margin-top: 7px !important;
            margin-bottom: 4px !important;

            padding: 5px 7px !important;

            background: #e5e7eb !important;
            border: 1px solid #9ca3af !important;

            box-sizing: border-box !important;

            font-size: 8px !important;
            line-height: 1.1 !important;
            font-weight: 900 !important;
          }

          .dados-grid {
            width: 100% !important;

            display: grid !important;

            grid-template-columns:
              2.2fr
              1.4fr
              1.2fr
              1.5fr !important;

            border: 1px solid #d1d5db !important;

            box-sizing: border-box !important;
          }

          .campo {
            min-width: 0 !important;
            min-height: 42px !important;
            padding: 5px 7px !important;

            box-sizing: border-box !important;
          }

          .campo label {
            font-size: 6.5px !important;
            margin-bottom: 2px !important;
          }

          .campo span {
            display: block !important;
            font-size: 8px !important;
            line-height: 1.2 !important;

            white-space: nowrap !important;
            overflow: hidden !important;
            text-overflow: ellipsis !important;
          }

          .romaneio-table {
            width: 100% !important;

            table-layout: fixed !important;
            border-collapse: collapse !important;

            font-size: 8px !important;
            margin: 0 !important;
          }

          .romaneio-table thead {
            background: #1f2937 !important;
            color: #ffffff !important;
          }

          .romaneio-table th {
            padding: 5px 4px !important;

            font-size: 7px !important;
            line-height: 1.1 !important;
            font-weight: 900 !important;

            border: 1px solid #1f2937 !important;
          }

          .romaneio-table td {
            padding: 5px 4px !important;

            font-size: 8px !important;
            line-height: 1.2 !important;

            border: 1px solid #d1d5db !important;

            vertical-align: middle !important;

            overflow-wrap: anywhere !important;
            word-break: break-word !important;
          }

          .romaneio-table .col-item {
            width: 6% !important;
          }

          .romaneio-table .col-codigo {
            width: 19% !important;
          }

          .romaneio-table .col-descricao {
            width: 37% !important;
          }

          .romaneio-table .col-qtd {
            width: 9% !important;
          }

          .romaneio-table .col-unit {
            width: 14.5% !important;
          }

          .romaneio-table .col-total {
            width: 14.5% !important;
          }

          .romaneio-table tbody tr:nth-child(even) {
            background: #f9fafb !important;
          }

          .romaneio-table tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: auto !important;
          }

          .resumo-container {
            width: 100% !important;

            display: flex !important;
            justify-content: space-between !important;
            align-items: stretch !important;

            gap: 10px !important;

            margin-top: 9px !important;

            box-sizing: border-box !important;
          }

          .resumo-left {
            flex: 1 1 auto !important;
            min-width: 0 !important;

            display: flex !important;
            gap: 7px !important;
          }

          .resumo-box {
            flex: 1 1 0 !important;
            min-width: 0 !important;

            padding: 7px !important;

            border: 1px solid #d1d5db !important;

            box-sizing: border-box !important;
          }

          .resumo-box strong {
            font-size: 7px !important;
            padding-bottom: 3px !important;
          }

          .resumo-box span {
            font-size: 7px !important;
            line-height: 1.2 !important;
          }

          .total-box {
            flex: 0 0 190px !important;
            width: 190px !important;

            padding: 8px !important;

            border: 2px solid #111827 !important;

            box-sizing: border-box !important;

            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: flex-end !important;
          }

          .total-label {
            font-size: 8px !important;
            line-height: 1.1 !important;
          }

          .total-value {
            margin-top: 3px !important;
            font-size: 17px !important;
            line-height: 1.1 !important;
            font-weight: 900 !important;
          }

          .assinaturas {
            width: 100% !important;

            display: flex !important;
            justify-content: space-between !important;

            gap: 35px !important;

            margin-top: 38px !important;

            box-sizing: border-box !important;
          }

          .assinatura {
            flex: 1 1 0 !important;
            min-width: 0 !important;
            text-align: center !important;
          }

          .assinatura div {
            width: 100% !important;

            border-top: 1px solid #111827 !important;

            margin-bottom: 4px !important;
          }

          .assinatura span {
            font-size: 7px !important;
            line-height: 1.1 !important;
            font-weight: 900 !important;
          }

          .romaneio-footer {
            width: 100% !important;

            margin-top: 18px !important;
            padding-top: 6px !important;

            border-top: 1px solid #9ca3af !important;

            display: flex !important;
            justify-content: space-between !important;
            gap: 10px !important;

            font-size: 6.5px !important;
            line-height: 1.1 !important;

            color: #6b7280 !important;
            font-weight: bold !important;
          }

          .romaneio-header,
          .dados-grid,
          .resumo-container,
          .assinaturas {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
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

  <div
    className="
      flex
      flex-col
      gap-0.5
    "
  >

    <label
      className="
        text-[9px]
        font-black
        text-slate-500
        uppercase
      "
    >
      {label}
    </label>

    <div
      className={`
        h-8
        bg-white
        border
        px-2
        flex
        items-center
        text-[10px]
        font-bold
        truncate
        shadow-inner
        ${
          borderHighlight
            ? 'border-emerald-500/50 rounded-lg'
            : 'border-slate-300'
        }
      `}
    >
      {value}
    </div>

  </div>

);

export default SalesInquiry;
