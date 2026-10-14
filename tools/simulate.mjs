// Simulates a user with noisy opinions ranking via Dispatch. node tools/simulate.mjs
import { fitModel, nextDuel, nextRow, rowToComparisons, mulberry32, probit, remainingEstimate, contradictions, Placement } from '../js/model.js';
const N = 169, SDtrue = 11.6, EXCEL_NOISE = +(process.argv[2] || 3);
function gauss(r){let u=0,v=0;while(!u)u=r();while(!v)v=r();return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v)}
function run(seed, mode, actions){
  const r = mulberry32(seed);
  const truth = Array.from({length:N},(_,i)=>SDtrue*probit(1-(i+.5)/N));         // id i has true score
  const ids = truth.map((_,i)=>'c'+i);
  const noisy = truth.map(t=>t+gauss(r)*EXCEL_NOISE);
  const excelOrder = ids.map((_,i)=>i).sort((a,b)=>noisy[b]-noisy[a]);
  const entries = excelOrder.map((i,p)=>({coaster_id:ids[i],initial_rank:p+1}));
  const comps=[]; let model=fitModel({entries}); const err=()=>{let s=0;model.ranking.forEach((id,p)=>s+=Math.abs(p-+id.slice(1)));return s/N};
  const out={0:[err(),model.certainty]}; let t0=Date.now(),fits=0;
  const answer=(a,b)=>{const ia=+a.slice(1),ib=+b.slice(1);return r()<1/(1+Math.exp(-(truth[ia]-truth[ib])))?'a':'b'};
  for(let k=1;k<=actions;k++){
    if(mode==='duel'){const [a,b]=nextDuel(model,comps,{rand:r});comps.push({a,b,outcome:answer(a,b)});}
    else {const row=nextRow(model,comps,{rand:r});const u=row.map(id=>[id,truth[+id.slice(1)]+gauss(r)*1.8]).sort((x,y)=>y[1]-x[1]).map(x=>x[0]);comps.push(...rowToComparisons(u));}
    model=fitModel({entries,comparisons:comps,warm:model});fits++;
    if([25,50,100,150,200].includes(k))out[k]=[err(),model.certainty,remainingEstimate(model).duels];
  }
  return {out,ms:(Date.now()-t0)/fits};
}
for(const mode of ['duel','row']){
  const R=[1,2,3].map(s=>run(s,mode,150));
  const ks=Object.keys(R[0].out);
  console.log(mode, ks.map(k=>`${k}: err ${(R.reduce((a,x)=>a+x.out[k][0],0)/R.length).toFixed(1)} zeker ${(100*R.reduce((a,x)=>a+x.out[k][1],0)/R.length).toFixed(0)}% rest ${R[0].out[k][2]??'-'}`).join(' | '), `fit ${R[0].ms.toFixed(0)}ms`);
}
// placement sanity
{const r=mulberry32(9);const entries=Array.from({length:50},(_,i)=>({coaster_id:'c'+i,initial_rank:i+1}));const m=fitModel({entries});const P=new Placement(m,'new');let steps=0;while(!P.done){const opp=P.next();P.answer(+opp.slice(1)<20?'old':'new');steps++}console.log('placement steps',steps,'rank',P.initialRank)}
