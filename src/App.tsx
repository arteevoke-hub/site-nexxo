import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase';
import { Session } from '@supabase/supabase-js';
import { LoginPage } from './components/LoginPage';
import { Layout } from './components/Layout';
import { PainelControle } from './components/PainelControle';
import { StockTable } from './components/StockTable';
import { AgenteIA } from './components/AgenteIA';
import { DicionarioSKU } from './components/DicionarioSKU';
import { RemessaFullList } from './components/RemessaFullList';
import { RemessaFullDetail } from './components/RemessaFullDetail';
import { ProducaoDashboard } from './components/ProducaoDashboard';
import { ProducaoKiosk } from './components/ProducaoKiosk';
import { FreelancerDashboard } from './components/FreelancerDashboard';
import { Loader2 } from 'lucide-react';

export type TabType = 'resumo' | 'lista' | 'estoque';
export type ViewType = 'painel' | 'produtos' | 'marketing' | 'pedidos' | 'financeiro' | 'agente' | 'dicionario' | 'remessa-list' | 'remessa-detail' | 'producao-dash' | 'producao-montagem' | 'freelancer-dash' | 'full-resumo' | 'full-new';

const MEIKE_EMAILS = [
  'marketing.meike@gmail.com',
  'sac.meike@gmail.com',
  'logistica.meike@gmail.com',
  'lrosa.meike@gmail.com'
];

const ONN_EMAILS = [
  'sac.onnstore@gmail.com',
  'onnstore.logistica@gmail.com',
  'marketing.onnstore@gmail.com',
  'lrosa.meike@gmail.com' // Admin acesso total
];

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('estoque');
  const [view, setView] = useState<ViewType>('remessa-list');
  const [selectedRemessa, setSelectedRemessa] = useState<string | null>(null);
  const [store, setStore] = useState<'MEIKE' | 'ONN' | null>(null);

  useEffect(() => {
    const validateSession = async (currentSession: Session | null) => {
      const savedStore = localStorage.getItem('nexxo_selected_store') as 'MEIKE' | 'ONN';
      setStore(savedStore);

      if (currentSession?.user?.email) {
        const email = currentSession.user.email.toLowerCase();
        let authorized = false;

        if (savedStore === 'MEIKE') {
          authorized = MEIKE_EMAILS.includes(email);
        } else if (savedStore === 'ONN') {
          authorized = ONN_EMAILS.includes(email);
        }

        if (!authorized) {
          console.error('Acesso não autorizado para esta unidade:', email);
          await supabase.auth.signOut();
          setSession(null);
          localStorage.removeItem('nexxo_selected_store');
          alert(`O e-mail ${email} não tem autorização para acessar a unidade ${savedStore}.`);
          window.location.reload();
        } else {
          setSession(currentSession);
        }
      } else {
        setSession(currentSession);
      }
      setAuthLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      validateSession(session);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      validateSession(session);
      // Limpa o hash da URL (comum após login com Supabase)
      if (window.location.hash && (_event === 'SIGNED_IN' || _event === 'INITIAL_SESSION')) {
        window.history.replaceState(null, '', window.location.pathname);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-950">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="animate-spin text-white" size={48} />
          <p className="text-slate-500 font-mono text-xs uppercase tracking-widest animate-pulse">Autenticando Protocolo...</p>
        </div>
      </div>
    );
  }

  if (!session) {
    return <LoginPage />;
  }

  return (
    <Layout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      view={view} 
      setView={setView}
      store={store}
    >
      <div className="flex-1 overflow-auto bg-[#F9F9F9]">
        {view === 'remessa-list' && (
          <RemessaFullList onSelect={(id) => { setSelectedRemessa(id); setView('remessa-detail'); }} />
        )}

        {view === 'remessa-detail' && (
          <RemessaFullDetail id={selectedRemessa!} onBack={() => setView('remessa-list')} />
        )}

        {view === 'full-new' && (
          <RemessaFullDetail id="new" onBack={() => setView('remessa-list')} />
        )}
        
        {view === 'painel' && <PainelControle />}
        {view === 'agente' && <AgenteIA />}
        {view === 'dicionario' && <DicionarioSKU />}
        {view === 'producao-dash' && <ProducaoDashboard />}
        {view === 'producao-montagem' && <ProducaoKiosk />}
        {view === 'freelancer-dash' && <FreelancerDashboard />}
        {view === 'produtos' && <StockTable activeTab={activeTab} setActiveTab={setActiveTab} />}
      </div>
    </Layout>
  );
}
