/* Transparent Fed policy scoring overlay.
   Keeps the existing dashboard data and visuals, but replaces the fixed statement
   sensitivity with an explicit score -> capped probability-adjustment framework. */
(function(){
  const toneScore={
    'Strongly Dovish':-2,'Dovish':-1,'Neutral':0,'Hawkish':1,'Strongly Hawkish':2
  };
  const clamp=(v,min,max)=>Math.max(min,Math.min(max,v));

  // Statement components are the same evidence already disclosed on the page.
  // Each component is ordinal, not statistically estimated.
  const statementComponents=[
    {name:'Inflation wording',tone:'Hawkish',score:1,fresh:'Fresh',note:'September removes the earlier supply-shock caveat and stresses a timelier return to 2%.'},
    {name:'Employment wording',tone:'Neutral',score:0,fresh:'Fresh',note:'Job gains and unemployment language is materially unchanged.'},
    {name:'Balance of risks',tone:'Neutral',score:0,fresh:'Fresh',note:'No explicit new risk-balance tilt is introduced.'},
    {name:'Forward guidance',tone:'Hawkish',score:1,fresh:'Fresh',note:'Price-stability language becomes more urgent without committing to another hike.'}
  ];

  const statementScore=statementComponents.reduce((s,x)=>s+x.score,0); // +2 currently
  // Rule-based sensitivity mapping: 2 percentage points per net score point,
  // capped at +/-6 pp so communication cannot dominate the market anchor.
  const statementAdjustment=clamp(statementScore*2,-6,6); // +4 pp currently

  const auxiliarySignals={
    minutes:{score:1,status:'Usable but dated',adjustment:0,note:'July minutes are hawkish versus June, but they predate the September hike and therefore do not alter the next-meeting probability.'},
    speeches:{score:1,status:'Usable but low-authority',adjustment:0,note:'Post-meeting Barkin/Goolsbee comments flag inflation risk, but neither is a Chair/Governor commitment; no numeric adjustment is applied.'},
    inflation:{score:0,status:'Stale / insufficient',adjustment:0,note:'PCE is above target, but this page does not yet contain paired fresh post-meeting inflation readings.'},
    labour:{score:0,status:'Insufficient',adjustment:0,note:'Most monthly labour series predate the latest meeting; one recent claims observation is not enough to establish a new slack trend.'},
    growth:{score:0,status:'Secondary cross-check',adjustment:0,note:'Growth and SEP inform the broader path but do not override fresher next-meeting evidence.'}
  };

  function freshnessClass(status){
    if(status==='Fresh')return 'fresh';
    if(status.includes('dated')||status.includes('low-authority')||status.includes('Secondary'))return 'dated';
    return 'stale';
  }

  const style=document.createElement('style');
  style.textContent=`
    .score-line{display:flex;align-items:center;justify-content:space-between;gap:8px;margin:5px 0 0;font-size:10px;color:#5b7088}
    .score-pill{display:inline-flex;align-items:center;justify-content:center;min-width:26px;padding:2px 6px;border-radius:999px;font-weight:900;background:#eef3f8;color:#34516f}
    .freshness{display:inline-flex;align-items:center;gap:4px;font-size:9px;font-weight:800;margin-top:5px}
    .freshness:before{content:'';width:6px;height:6px;border-radius:50%;background:#94a3b8}
    .freshness.fresh{color:#16745e}.freshness.fresh:before{background:#10b981}
    .freshness.dated{color:#8a651d}.freshness.dated:before{background:#d9a52e}
    .freshness.stale{color:#7b8797}.freshness.stale:before{background:#94a3b8}
    .confidence-box{margin:10px 0 14px;padding:11px 12px;border:1px solid #d6e4f3;background:#f6faff;border-radius:9px;font-size:11px;color:#425d79;line-height:1.45}
    .confidence-box b{color:#173f72}
    .bridge{grid-template-columns:repeat(5,minmax(0,1fr))!important}
    @media(max-width:950px){.bridge{grid-template-columns:repeat(2,minmax(0,1fr))!important}}
    @media(max-width:520px){.bridge{grid-template-columns:1fr!important}}
  `;
  document.head.appendChild(style);

  // Replace the communication cards with explicit component scores.
  window.renderCommunication=function(){
    if(typeof commShift!=='undefined'&&commShift){
      commShift.innerHTML=statementComponents.map(x=>
        '<div class="shift-cell"><b>'+x.name+'</b>'+
        '<span class="tone'+(x.tone==='Neutral'?' neutral':'')+'">'+x.tone+'</span>'+
        '<div class="score-line"><span>Signal score</span><span class="score-pill">'+(x.score>0?'+':'')+x.score+'</span></div>'+
        '<div class="freshness '+freshnessClass(x.fresh)+'">'+x.fresh+'</div><p>'+x.note+'</p></div>'
      ).join('')+
      '<div class="shift-cell"><b>Overall statement signal</b><span class="tone">Hawkish</span>'+
      '<div class="score-line"><span>Net score</span><span class="score-pill">+'+statementScore+'</span></div>'+
      '<div class="score-line"><span>Rule-based adjustment</span><span class="score-pill">+'+statementAdjustment+' pp</span></div>'+
      '<p>Mapping: 2 pp per net score point, capped at ±6 pp. This is a disclosed sensitivity rule, not an estimated coefficient.</p></div>';
    }
    if(typeof communicationEvidence!=='undefined'&&communicationEvidence){
      communicationEvidence.innerHTML='<a href="'+evidenceLinks.previous+'" target="_blank" rel="noopener">July statement</a> → <a href="'+evidenceLinks.latest+'" target="_blank" rel="noopener">September statement</a>. '+
      '<a href="'+evidenceLinks.juneMinutes+'" target="_blank" rel="noopener">June minutes</a> → <a href="'+evidenceLinks.julyMinutes+'" target="_blank" rel="noopener">July minutes</a>. '+
      'Minutes and post-meeting speeches are scored separately from the statement and receive 0 pp when freshness/authority is insufficient for the next-meeting forecast.';
    }
  };

  function applyTransfer(p,amount,from,to){
    if(!amount)return;
    if(amount>0){const move=Math.min(amount,p[from]);p[from]-=move;p[to]+=move;}
    else {const move=Math.min(-amount,p[to]);p[to]-=move;p[from]+=move;}
  }

  window.calculateScenario=function(k){
    if(typeof marketDirection==='undefined'||!marketDirection)return null;
    const p=[marketDirection.increase,marketDirection.same,marketDirection.decrease];
    // Observed base case: only the fresh statement qualifies for a numeric adjustment.
    applyTransfer(p,statementAdjustment,1,0); // Hold -> Increase for positive score.
    if(k==='hawk'){
      // Conditional scenario: fresh hawkish communication + inflation/labour confirmation.
      applyTransfer(p,6,1,0);
    }
    if(k==='dove'){
      // Conditional scenario: softer inflation + weaker labour + dovish communication.
      const shift=Math.min(9,p[0]);p[0]-=shift;p[1]+=shift*2/3;p[2]+=shift/3;
    }
    return roundedDistribution(p);
  };

  function confidence(){
    if(typeof marketDirection==='undefined'||!marketDirection)return {level:'Low',reason:'A current, internally consistent FedWatch market anchor is unavailable.'};
    const active=1; // fresh statement contributes; other observed modules currently do not.
    if(active>=3)return {level:'High',reason:'Several fresh, independent signals agree with current market pricing.'};
    if(active>=1)return {level:'Moderate',reason:'Market pricing and the latest FOMC statement are current, but fresh post-meeting inflation, labour and high-authority speech evidence is limited.'};
    return {level:'Low',reason:'Most non-market inputs are dated or insufficient for the next meeting.'};
  }

  // Keep the scenario object but make the methodology text explicit and non-arbitrary.
  if(typeof scenarioInfo!=='undefined'){
    scenarioInfo.base.delta='Observed adjustment: statement net score +'+statementScore+' → +'+statementAdjustment+' pp Increase / −'+statementAdjustment+' pp Hold. Other observed inputs: 0 pp because freshness/authority thresholds are not met.';
    scenarioInfo.base.assumptions=[
      ['Statement','Fresh September statement score: +'+statementScore+' (hawkish).'],
      ['Minutes / speeches','Scored separately, but no numeric adjustment because they are dated or insufficiently authoritative.'],
      ['Incoming data','No paired fresh post-meeting inflation or labour confirmation in this page.']
    ];
    scenarioInfo.hawk.delta='Conditional scenario: +6 pp additional Increase / −6 pp Hold, requiring fresh hawkish communication plus inflation/labour confirmation.';
    scenarioInfo.dove.delta='Conditional scenario: −9 pp Increase, +6 pp Hold, +3 pp Decrease, requiring fresh dovish communication plus softer inflation/weaker labour confirmation.';
  }

  window.renderPrediction=function(){
    const p=calculateScenario('base');
    const conf=confidence();
    const steps=[
      ['Market anchor',marketDirection?marketDirection.increase.toFixed(1)+'% hike':'Unavailable','FedWatch: Increase / Hold / Decrease','market'],
      ['FOMC statement',(marketDirection?(statementAdjustment>=0?'+':'')+statementAdjustment+' pp':'—'),'Score '+(statementScore>=0?'+':'')+statementScore+' · Fresh · capped rule-based mapping',''],
      ['Minutes',(auxiliarySignals.minutes.adjustment>=0?'+':'')+auxiliarySignals.minutes.adjustment+' pp','Score +'+auxiliarySignals.minutes.score+' · '+auxiliarySignals.minutes.status,''],
      ['Speeches',(auxiliarySignals.speeches.adjustment>=0?'+':'')+auxiliarySignals.speeches.adjustment+' pp','Score +'+auxiliarySignals.speeches.score+' · '+auxiliarySignals.speeches.status,''],
      ['Inflation','0 pp',auxiliarySignals.inflation.status+' · no fresh paired confirmation',''],
      ['Labour','0 pp',auxiliarySignals.labour.status+' · no confirmed slack trend',''],
      ['Growth / SEP','0 pp',auxiliarySignals.growth.status,''],
      ['Dashboard final',p?p[0]+' / '+p[1]+' / '+p[2]+'%':'Unavailable','Increase / Hold / Decrease · rounded','final']
    ];
    predictionBridge.innerHTML=steps.map(([name,value,detail,cls])=>'<div class="bridge-step '+cls+'"><span class="n">'+name+'</span><strong>'+value+'</strong><small>'+detail+'</small></div>').join('');
    bridgeNote.innerHTML=(marketDirection?'Market snapshot: '+new Date(marketStamp).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short',timeZone:'UTC'})+' UTC. ':'')+
      'Communication mapping is rule-based: 2 pp per net statement-score point, capped at ±6 pp. It is not statistically estimated. Stale/insufficient evidence contributes 0 pp. Rounded outcomes sum to 100%.'+
      '<div class="confidence-box"><b>Model confidence: '+conf.level+'</b><br>'+conf.reason+'</div>';
    renderScenario(activeScenario);
  };

  // Ensure scenario tabs use the revised scenario engine even if older listeners were attached first.
  document.querySelectorAll('.scenario').forEach(btn=>{
    btn.addEventListener('click',function(e){
      e.stopImmediatePropagation();
      document.querySelectorAll('.scenario').forEach(x=>x.classList.remove('active'));
      this.classList.add('active');
      renderScenario(this.dataset.s);
    },true);
  });

  renderCommunication();
  renderPrediction();
})();