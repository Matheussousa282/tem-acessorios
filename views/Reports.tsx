
import React, { useMemo, useState } from 'react';
import { useApp } from '../AppContext';
import { Transaction, UserRole } from '../types';
import { useLocation } from 'react-router-dom';

const Reports: React.FC = () => {
  const { transactions, users, currentUser, establishments } = useApp();
  const location = useLocation();
  const query = new URLSearchParams(location.search);
  const reportType = query.get('type') || 'evolucao';

  const todayStr = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState(todayStr);
  const [endDate, setEndDate] = useState(todayStr);

  const isAdmin = currentUser?.role === UserRole.ADMIN;
  const currentStore = establishments.find(e => e.id === currentUser?.storeId);
  const currentStoreName = currentStore?.name || '';

  const periodSales = useMemo(() => {
    return (transactions || []).filter(t => {
      const belongsToStore = isAdmin || t.store === currentStoreName;
      if (!belongsToStore) return false;
      if (t.type !== 'INCOME') return false;
      return t.date >= startDate && t.date <= endDate;
    });
  }, [transactions, startDate, endDate, isAdmin, currentStoreName]);

  const reportData = useMemo(() => {
    const map: Record<string, any> = {};

    periodSales.forEach(t => {
      let key = '';
      if (reportType === 'evolucao') key = t.date;
      else if (reportType === 'por_unidade') key = t.store;
      else if (reportType === 'por_cliente') key = t.client || 'Consumidor Final';
      else if (reportType === 'por_vendedor') key = users.find(u => u.id === t.vendorId)?.name || 'Venda Balcão';
      else if (reportType === 'por_ano') key = t.date.substring(0, 4);
      else if (reportType === 'ticket_vendedor') key = users.find(u => u.id === t.vendorId)?.name || 'Venda Balcão';
      else if (reportType === 'ticket_mes_ano') key = t.date.substring(0, 7);
      
      if (!map[key]) map[key] = { label: key, total: 0, count: 0, items: 0, cost: 0 };
      map[key].total += t.value;
      map[key].count += 1;
      t.items?.forEach(i => {
        map[key].items += i.quantity;
        map[key].cost += (i.costPrice || 0) * i.quantity;
      });
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [periodSales, reportType, users]);

  const productStats = useMemo(() => {
    const map: Record<string, any> = {};
    periodSales.forEach(t => {
      t.items?.forEach(item => {
        if (!map[item.id]) map[item.id] = { name: item.name, sku: item.sku, qty: 0, total: 0, cost: 0, isService: !!item.isService };
        map[item.id].qty += item.quantity;
        map[item.id].total += (item.salePrice * item.quantity);
        map[item.id].cost += (item.costPrice * item.quantity);
      });
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [periodSales]);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-3xl font-black uppercase tracking-tight">Relatórios Analíticos</h2>
          <p className="text-xs font-bold text-slate-400 uppercase mt-1">Visão: {reportType.replace('_', ' ')}</p>
        </div>
        <div className="flex gap-2 bg-white dark:bg-slate-800 p-2 rounded-2xl shadow-sm">
          <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase" />
          <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="bg-transparent border-none text-[10px] font-black uppercase" />
          <button onClick={() => window.print()} className="bg-primary text-white px-6 py-2 rounded-xl text-[10px] font-black uppercase">Imprimir</button>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-slate-800 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 dark:bg-slate-800/50 border-b">
            <tr className="text-[10px] font-black uppercase text-slate-400">
              <th className="px-8 py-5">Descrição / Agrupamento</th>
              <th className="px-8 py-5 text-center">Volume</th>
              <th className="px-8 py-5 text-right">Faturamento Bruto</th>
              {(reportType === 'margem_bruta' || reportType === 'por_produto') && <th className="px-8 py-5 text-right">Margem R$</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-bold">
            {(reportType.includes('produto') || reportType === 'por_servico' || reportType === 'margem_bruta') ? (
              productStats.filter(p => reportType === 'por_servico' ? p.isService : (reportType === 'por_produto' ? !p.isService : true)).map((p, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-8 py-5 text-xs uppercase">{p.name} <br/><span className="text-[9px] text-slate-400">SKU: {p.sku}</span></td>
                  <td className="px-8 py-5 text-center">{p.qty}</td>
                  <td className="px-8 py-5 text-right text-primary">R$ {p.total.toLocaleString('pt-BR')}</td>
                  {(reportType === 'margem_bruta' || reportType === 'por_produto') && <td className="px-8 py-5 text-right text-emerald-500">R$ {(p.total - p.cost).toLocaleString('pt-BR')}</td>}
                </tr>
              ))
            ) : (
              reportData.map((d, i) => (
                <tr key={i} className="hover:bg-slate-50">
                  <td className="px-8 py-5 text-xs uppercase">{d.label}</td>
                  <td className="px-8 py-5 text-center">{d.count} tickets</td>
                  <td className="px-8 py-5 text-right text-primary">R$ {d.total.toLocaleString('pt-BR')}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Reports;
