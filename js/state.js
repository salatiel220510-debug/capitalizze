export let state = {
  transactions: [],
  goals: [],
  budgets: {},
  banks: [],
  bills: [],
  debts: [],
  recurring: [],
  achievements: [],
  categories: ['Geral', 'Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Salário', 'Investimento', 'Dívidas'],
  profile: { 
    name: 'Visitante', 
    email: '', 
    avatar: null, 
    joined: Date.now(),
    hasSeenTour: false // NOVO: Controle do Tour
  }
};

export const AVAILABLE_BANKS = ['Nubank', 'Inter', 'Itaú', 'Bradesco', 'Caixa', 'Santander', 'C6 Bank', 'PicPay', 'Mercado Pago'];

export const ACHIEVEMENTS_LIST = [
  { id: 'first_tx', icon: '🚀', title: 'Primeiros Passos', desc: 'Adicionou a 1ª transação' },
  { id: 'first_budget', icon: '📊', title: 'Planejador', desc: 'Criou um orçamento' },
  { id: 'saver_1000', icon: '💰', title: 'Poupador', desc: 'Guardou R$ 1.000 em metas' },
  { id: 'debt_free', icon: '🕊️', title: 'Livre de Dívidas', desc: 'Sem dívidas ativas' },
  { id: 'multi_bank', icon: '🏦', title: 'Multibancarizado', desc: 'Usa 3+ bancos' }
];