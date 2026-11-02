import { formatBRL } from '../utils.js';

export function initToolsEvents() {
  const simInputs = ['sim-initial', 'sim-monthly', 'sim-rate', 'sim-time'].map(id => document.getElementById(id));
  const calcSim = () => {
    const i = parseFloat(simInputs[0].value) || 0, m = parseFloat(simInputs[1].value) || 0, r = (parseFloat(simInputs[2].value) || 0)/100, t = parseInt(simInputs[3].value) || 0;
    const total = i + (m * t);
    const final = r === 0 ? total : (i * Math.pow(1+r, t)) + (m * ((Math.pow(1+r, t) - 1) / r));
    document.getElementById('sim-total-invested').textContent = formatBRL(total);
    document.getElementById('sim-interest').textContent = formatBRL(final - total);
    document.getElementById('sim-final').textContent = formatBRL(final);
  };
  simInputs.forEach(el => el.addEventListener('input', calcSim));

  const resCost = document.getElementById('res-cost'), resMonths = document.getElementById('res-months');
  const calcRes = () => { document.getElementById('res-result').textContent = formatBRL((parseFloat(resCost.value)||0) * (parseInt(resMonths.value)||0)); };
  [resCost, resMonths].forEach(el => el.addEventListener('input', calcRes));

  const calcVal = document.getElementById('calc-value'), calcFee = document.getElementById('calc-fee'), calcInst = document.getElementById('calc-installments');
  const calcTax = () => {
    const val = parseFloat(calcVal.value) || 0, fee = (parseFloat(calcFee.value) || 0) / 100, inst = parseInt(calcInst.value) || 1;
    const total = val * (1 + fee);
    document.getElementById('calc-total').textContent = formatBRL(total);
    document.getElementById('calc-per-installment').textContent = formatBRL(total / inst);
  };
  [calcVal, calcFee, calcInst].forEach(el => el.addEventListener('input', calcTax));

  const dailyInc = document.getElementById('daily-income'), dailyFix = document.getElementById('daily-fixed');
  const calcDaily = () => {
    const inc = parseFloat(dailyInc.value) || 0, fix = parseFloat(dailyFix.value) || 0;
    const avail = inc - fix; const daily = avail / 30;
    const resEl = document.getElementById('daily-result');
    resEl.textContent = formatBRL(daily > 0 ? daily : 0);
    resEl.style.color = avail <= 0 ? 'var(--danger)' : 'var(--success)';
  };
  [dailyInc, dailyFix].forEach(el => el.addEventListener('input', calcDaily));
}