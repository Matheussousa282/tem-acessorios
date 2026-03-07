
import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const { login, systemConfig, dbConnected } = useApp();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dbConnected) {
      setError('Banco de dados não configurado. Verifique as variáveis de ambiente.');
      return;
    }
    setLoading(true);
    setError('');
    
    const success = await login(username, password);
    if (success) {
      navigate('/');
    } else {
      setError('Acesso negado. Verifique se o nome e a senha estão corretos.');
    }
    setLoading(false);
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-background-light dark:bg-background-dark font-display relative overflow-hidden">
      {/* Background Orbs */}
      <div className="absolute top-0 right-0 size-[600px] bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
      <div className="absolute bottom-0 left-0 size-[400px] bg-emerald-500/5 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2"></div>

      <div className="w-full max-w-md px-6 z-10 animate-in fade-in zoom-in-95 duration-500">
        <div className="bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl p-10 rounded-[3rem] shadow-2xl border border-white/20 dark:border-slate-800">
          <div className="flex flex-col items-center mb-10">
            {systemConfig.logoUrl ? (
              <img src={systemConfig.logoUrl} className="h-20 mb-4 object-contain" alt="Logo" />
            ) : (
              <div className="bg-primary size-16 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-primary/20 mb-4">
                <span className="material-symbols-outlined text-4xl">storefront</span>
              </div>
            )}
            <h1 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter text-center">{systemConfig.companyName}</h1>
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1 text-center">Gestão Cloud ERP</p>
          </div>

          {!dbConnected && (
            <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 text-amber-600 rounded-2xl text-[10px] font-black text-center uppercase tracking-widest">
              Atenção: Banco de dados não configurado (DATABASE_URL ausente).
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl text-[10px] font-black text-center animate-in shake duration-300 uppercase tracking-widest">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Identificação do Usuário</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">person</span>
                <input 
                  type="text" 
                  required 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full h-14 bg-white dark:bg-slate-800 border-none rounded-2xl pl-12 pr-6 text-sm font-bold shadow-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all uppercase"
                  placeholder="USUÁRIO OU E-MAIL"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Senha de Acesso</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">lock</span>
                <input 
                  type="password" 
                  required 
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full h-14 bg-white dark:bg-slate-800 border-none rounded-2xl pl-12 pr-6 text-sm font-bold shadow-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full h-16 bg-primary hover:bg-blue-600 text-white rounded-[2rem] font-black text-sm uppercase tracking-widest shadow-xl shadow-primary/20 transition-all flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
            >
              {loading ? <span className="material-symbols-outlined animate-spin">sync</span> : 'Acessar Terminal'}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center gap-2">
             <p className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Tem Acessórios • v4.5.2</p>
             <p className="text-[9px] font-bold text-slate-400/50 uppercase tracking-tighter">Acesso Inicial: admin@erp.com / admin123</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
