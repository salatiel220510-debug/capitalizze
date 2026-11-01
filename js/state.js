export let state = {
  transactions: [],
  goals: [],
  budgets: {},
  banks: [],
  bills: [],
  debts: [],
  recurring: [], // NOVO
  categories: ['Geral', 'Alimentação', 'Transporte', 'Moradia', 'Lazer', 'Salário', 'Investimento', 'Dívidas'], // NOVO
  profile: { name: 'Visitante', email: '', avatar: null, joined: Date.now() }
};

export const AVAILABLE_BANKS = ['Nubank', 'Inter', 'Itaú', 'Bradesco', 'Caixa', 'Santander', 'C6 Bank', 'PicPay', 'Mercado Pago'];