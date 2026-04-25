import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { Header } from './components/Header';
import { StockTable } from './components/StockTable';

export default function App() {
  const [activeTab, setActiveTab] = useState<'resumo' | 'lista' | 'estoque'>('estoque');

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      <Header 
        title="Estoque de Produtos" 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
      <StockTable 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
      />
    </Layout>
  );
}
