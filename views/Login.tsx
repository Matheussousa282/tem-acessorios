
import React, { useState } from 'react';
import { useApp } from '../AppContext';
import { useNavigate } from 'react-router-dom';

const Login: React.FC = () => {
  const { login, systemConfig, refreshData, users, addUser } = useApp();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [setupLoading, setSetupLoading] = useState(false);
  const [showResetModal, setShowResetModal] = useState(false);

  // Estados Reset Senha
  const [resetName, setResetName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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

  const handleInitialSetup = async () => {
    setSetupLoading(true);
    try {
      const res = await fetch('/api/init-db');
      const data = await res.json();
      if (res.ok) {
        alert(`Sistema inicializado com sucesso! Use 'Administrador Sistema' / '123456'`);
        await refreshData();
      } else {
        alert("Erro ao configurar: " + data.error);
      }
    } catch (err) {
      alert("Erro de conexão com o servidor.");
    } finally {
      setSetupLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      alert("As senhas não conferem!");
      return;
    }
    
    const user = users.find(u => u.name.toLowerCase() === resetName.toLowerCase());
    if (!user) {
      alert("Colaborador não localizado no sistema!");
      return;
    }

    try {
      await addUser({ ...user, password: newPassword });
      alert("Senha alterada com sucesso! Tente realizar o login.");
      setShowResetModal(false);
      setResetName('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (e) {
      alert("Erro ao redefinir senha.");
    }
  };

  return (
    <div className="h-screen w-full flex items-center justify-center bg-background-light dark:bg-background-dark font-display relative overflow-hidden">
      {/* Círculos de Background Decorativos */}
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
            <p className="text-slate-500 text-xs font-bold uppercase tracking-widest mt-1 text-center">Acesso ao Terminal de Gestão</p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-500 rounded-2xl text-[10px] font-black text-center animate-in shake duration-300 uppercase tracking-widest">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Nome de Usuário</label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-lg">person</span>
                <input 
                  type="text" 
                  required 
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full h-14 bg-white dark:bg-slate-800 border-none rounded-2xl pl-12 pr-6 text-sm font-bold shadow-sm focus:ring-2 focus:ring-primary/20 outline-none transition-all uppercase"
                  placeholder="DIGITE SEU NOME"
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-2">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Senha de Acesso</label>
                <button type="button" onClick={() => setShowResetModal(true)} className="text-[9px] font-black text-primary uppercase hover:underline">Esqueci Senha</button>
              </div>
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
              {loading ? (
                <span className="material-symbols-outlined animate-spin">sync</span>
              ) : (
                <>
                  Entrar no Sistema
                  <span className="material-symbols-outlined text-xl">login</span>
                </>
              )}
            </button>
          </form>

          <div className="mt-10 pt-8 border-t border-slate-100 dark:border-slate-800 flex flex-col items-center gap-4">
             <button 
              onClick={handleInitialSetup}
              disabled={setupLoading}
              className="text-[10px] font-black text-slate-400 hover:text-primary transition-colors uppercase flex items-center gap-2"
             >
               {setupLoading ? 'Configurando...' : 'Sincronizar Estrutura'}
               <span className="material-symbols-outlined text-sm">settings</span>
             </button>
             <p className="text-[9px] text-slate-300 font-bold uppercase tracking-[0.2em]">Tem Acessorio v4.5.1</p>
          </div>
        </div>
      </div>

      {/* MODAL RESET SENHA */}
      {showResetModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-xl p-4">
          <div className="bg-white dark:bg-slate-900 w-full max-w-md rounded-[3rem] shadow-2xl overflow-hidden animate-in zoom-in-95">
             <div className="p-8 border-b border-slate-100 dark:border-slate-800 bg-primary text-white flex justify-between items-center">
                <h3 className="text-xl font-black uppercase tracking-tight">Recuperar Senha</h3>
                <button onClick={() => setShowResetModal(false)}><span className="material-symbols-outlined">close</span></button>
             </div>
             <form onSubmit={handleResetPassword} className="p-10 space-y-5">
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Confirme seu Nome de Usuário</label>
                   <input required value={resetName} onChange={e => setResetName(e.target.value)} type="text" className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 font-bold border-none uppercase" placeholder="EX: CARLOS SILVA" />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Nova Senha</label>
                   {/* Fix: Removed invalid 'underline' property from input */}
                   <input required value={newPassword} onChange={e => setNewPassword(e.target.value)} type="password" className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 font-bold border-none" placeholder="••••••••" />
                </div>
                <div className="space-y-1">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-2">Confirmar Nova Senha</label>
                   {/* Fix: Removed invalid 'underline' property from input */}
                   <input required value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} type="password" className="w-full h-14 bg-slate-50 dark:bg-slate-800 rounded-2xl px-6 font-bold border-none" placeholder="••••••••" />
                </div>
                <button type="submit" className="w-full h-16 bg-primary text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl">Alterar Senha Agora</button>
             </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Login;
