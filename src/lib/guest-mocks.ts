import type { AdviceStreamHandle, DashboardTip } from './functions-client';

export const GUEST_DASHBOARD_TIPS: DashboardTip[] = [
  { icon: 'fa-piggy-bank', tip: 'Salary sacrifice $5k concessional — saves $1,500 at your 30% bracket.', type: 'tax' },
  { icon: 'fa-chart-line', tip: 'Portfolio is 73% Australian equities — consider rebalancing toward VGS.', type: 'investment' },
  { icon: 'fa-calendar', tip: '75 days to EOFY — book a tax planning session before end of May.', type: 'strategy' },
];

const TAX_ADVICE = `<h4>Diagnosis</h4>
<p>Your household's FY 2025-26 deductions are in <strong>healthy shape</strong> — 7 of 10 ATO categories claimed, totalling <strong>$8,277</strong>. Sam's work-from-home + self-education lines are working hard; Alex's nursing uniform claims are correctly categorised.</p>
<h5>Strengths</h5>
<ul>
<li><strong>Self-education is substantiated</strong> — the Sydney conference flights + hotel pair cleanly with the Udemy Kubernetes course. Keep the receipts and conference agenda together.</li>
<li><strong>Investment property interest</strong> on the Brunswick place is deductible at Joint ownership (50/50). Current claim of <strong>$1,850/mo</strong> looks right for the fixed-rate loan.</li>
<li>Sam's <strong>80% work-use iPhone ($1,216 deductible)</strong> is a defensible apportionment — maintain a 4-week usage log if audited.</li>
</ul>
<h4>Prescription</h4>
<ol>
<li><strong>Switch to the fixed-rate WFH method</strong> (67c/hr) — Sam's 3 days/week home pattern yields ~$1,150 vs. your current itemised claim of ~$582. Net benefit <strong>~$560</strong>.</li>
<li><strong>Claim Alex's laundry allowance</strong> — ATO allows $150/yr flat for nurse uniform laundering without receipts. You're leaving it on the table.</li>
<li><strong>Concessional super sacrifice</strong> — Sam at $145k (30% + 2% Medicare) benefits $1,600 from a $5k sacrifice. Concessional cap is $30k/yr including employer SG.</li>
<li><strong>CGT timing on VAS</strong> — the $6,075 gain held 18 months qualifies for the 50% discount. If you need to realise, split across two FYs to spread the marginal impact.</li>
</ol>
<p><em>General advice only. Not personal financial advice — confirm with your registered tax agent.</em></p>`;

const INVESTMENTS_ADVICE = `<h4>Diagnosis</h4>
<p>Portfolio value <strong>$338,120</strong> with <strong>+$55,427 unrealised gain (+19.6%)</strong>. Super dominates at <strong>67%</strong> of total holdings, which is normal for this household stage but means your discretionary wealth is concentrated.</p>
<h5>Per-member tax snapshot</h5>
<ul>
<li><strong>Sam (30% + 2% Medicare)</strong> — VAS, VGS, super. Realising the VAS $6,075 gain today with 50% discount = <strong>$972 CGT</strong>.</li>
<li><strong>Alex (30% + 2% Medicare)</strong> — CBA stake $15.8k with $3,552 gain. Selling today: <strong>$568 CGT</strong>.</li>
<li><strong>Joint — Brunswick IP</strong> — $175k unrealised. Each spouse would assess $87.5k × 50% discount × 32% = <strong>$14,000 each</strong> CGT if sold now.</li>
</ul>
<h4>Prescription</h4>
<ol>
<li><strong>Build defensive allocation</strong> — 0% bonds, 7% cash. Consider $10-20k into VAF or VDCO for rebalancing resilience.</li>
<li><strong>Tilt new contributions to VGS</strong> — you're 73% AU equities between VAS and CBA. VGS gets you international exposure without FX hedging complexity.</li>
<li><strong>Concessional super headroom</strong> — Sam ~$12k available, Alex ~$20k. Pre-tax contribution beats post-tax for both.</li>
<li><strong>Property</strong> — negatively geared; interest deductible and equity growing. Hold; reassess at next fixed-rate rollover.</li>
</ol>
<p><em>General advice only. Not personal financial advice. Consult a licensed adviser for your circumstances.</em></p>`;

function makeStreamHandle(fullText: string): AdviceStreamHandle {
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < fullText.length) {
    const size = 60 + Math.floor(Math.random() * 40);
    chunks.push(fullText.slice(cursor, cursor + size));
    cursor += size;
  }

  async function* stream() {
    for (const chunk of chunks) {
      await new Promise(r => setTimeout(r, 35));
      yield chunk;
    }
  }

  return {
    stream: stream(),
    final: new Promise<string>(resolve => {
      setTimeout(() => resolve(fullText), chunks.length * 35 + 50);
    }),
  };
}

export function mockTaxAdviceStream(): AdviceStreamHandle {
  return makeStreamHandle(TAX_ADVICE);
}

export function mockInvestmentsAdviceStream(): AdviceStreamHandle {
  return makeStreamHandle(INVESTMENTS_ADVICE);
}
