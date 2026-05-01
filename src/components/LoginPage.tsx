import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Loader2, Store, ArrowRight } from 'lucide-react';

const ALLOWED_EMAILS = {
  MEIKE: [
    'marketing.meike@gmail.com',
    'sac.meike@gmail.com',
    'logistica.meike@gmail.com',
    'lrosa.meike@gmail.com' // Adicionando seu e-mail de teste se necessário
  ],
  ONN: [
    'sac.onnstore@gmail.com',
    'onnstore.logistica@gmail.com',
    'marketing.onnstore@gmail.com'
  ]
};

export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedStore, setSelectedStore] = useState<'MEIKE' | 'ONN' | null>(null);

  const handleLogin = async (store: 'MEIKE' | 'ONN') => {
    try {
      setLoading(true);
      setError(null);
      setSelectedStore(store);
      
      // Salva a preferência de loja no localStorage para usar após o login
      localStorage.setItem('nexxo_selected_store', store);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin,
          queryParams: {
            prompt: 'select_account',
            access_type: 'offline',
          }
        },
      });
      if (error) throw error;
    } catch (err: any) {
      console.error('Erro ao fazer login:', err.message);
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 p-6 font-sans">
      <div className="w-full max-w-4xl space-y-12">
        
        {/* Header Branding */}
        <div className="text-center space-y-4">
          <h1 className="text-7xl font-black tracking-[0.2em] text-white uppercase leading-none opacity-20">NEXXO</h1>
          <div className="space-y-1">
            <h2 className="text-2xl font-black text-white tracking-widest uppercase italic">Hub de Operações Industriais</h2>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-[0.5em]">Escolha a unidade de processamento</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card Meikê */}
          <button 
            onClick={() => handleLogin('MEIKE')}
            disabled={loading}
            className="group relative overflow-hidden bg-slate-900 border border-slate-800 p-8 text-left transition-all hover:border-white hover:bg-slate-800 rounded-none disabled:opacity-50"
          >
            <div className="relative z-10 space-y-6">
              <div className="w-12 h-12 bg-slate-800 flex items-center justify-center text-white group-hover:bg-white group-hover:text-black transition-all rounded-none">
                <Store size={24} />
              </div>
              <div>
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter">MEIKÊ</h3>
                <p className="text-xs text-slate-500 font-mono uppercase mt-1">Unidade de Produção & Logística</p>
              </div>
              <div className="flex items-center gap-2 text-white font-black text-[10px] uppercase tracking-widest pt-4 opacity-50 group-hover:opacity-100">
                {loading && selectedStore === 'MEIKE' ? <Loader2 className="animate-spin" size={14} /> : <>ACESSAR AMBIENTE <ArrowRight size={14} /></>}
              </div>
            </div>
            <div className="absolute top-0 right-0 p-4 text-7xl font-black text-slate-800/20 group-hover:text-white/10 transition-all">01</div>
          </button>

          {/* Card Onn Store */}
          <button 
            onClick={() => handleLogin('ONN')}
            disabled={loading}
            className="group relative overflow-hidden bg-slate-900 border border-slate-800 p-8 text-left transition-all hover:border-white hover:bg-slate-800 rounded-none disabled:opacity-50"
          >
            <div className="relative z-10 space-y-6">
              <div className="w-12 h-12 bg-slate-800 flex items-center justify-center text-white group-hover:bg-white group-hover:text-black transition-all rounded-none">
                <Store size={24} />
              </div>
              <div>
                <h3 className="text-3xl font-black text-white uppercase tracking-tighter">ONN STORE</h3>
                <p className="text-xs text-slate-500 font-mono uppercase mt-1">E-commerce & Distribuição</p>
              </div>
              <div className="flex items-center gap-2 text-white font-black text-[10px] uppercase tracking-widest pt-4 opacity-50 group-hover:opacity-100">
                {loading && selectedStore === 'ONN' ? <Loader2 className="animate-spin" size={14} /> : <>ACESSAR AMBIENTE <ArrowRight size={14} /></>}
              </div>
            </div>
            <div className="absolute top-0 right-0 p-4 text-7xl font-black text-slate-800/20 group-hover:text-white/10 transition-all">02</div>
          </button>
        </div>

        {error && (
          <div className="max-w-md mx-auto bg-rose-500/10 border border-rose-500/20 p-4 text-center">
            <p className="text-[10px] text-rose-500 font-black uppercase tracking-widest">
              Falha na Autenticação: {error}
            </p>
          </div>
        )}

        <div className="text-center pt-12">
          <p className="text-[10px] text-slate-600 font-bold uppercase tracking-[0.3em]">
            © 2026 NEXXO SYSTEMS | INDUSTRIAL INTERFACE V4.0
          </p>
        </div>
      </div>
    </div>
  );
}
