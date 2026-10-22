/* =====================================================================
   SIT — Requirement 4 (FAS) across BOTH portals
   A. e-Service Portal (parent)  : eservice-portal-parent.html
   B. Admin Portal (MOE + School): admin-portal-moe.html
   C. Cross-portal data consistency (the "integration" between mocks)
   Run:  node sit-r4.js
   ===================================================================== */
const fs = require("fs");
const vm = require("vm");

let PASS = 0, FAIL = 0;
function T(id, name, ok){
  console.log((ok ? "PASS" : "FAIL") + " | " + id + " | " + name);
  ok ? PASS++ : FAIL++;
}

/* ---------- DOM stub (per portal, so #app etc. don't collide) ---------- */
function el(){
  const base = { innerHTML:"", value:"", disabled:false, checked:false, style:{},
    classList:{ add(){}, remove(){}, toggle(){} }, children: [],
    appendChild(){}, remove(){}, click(){}, insertAdjacentHTML(){}, outerHTML:"" };
  return new Proxy(base, { get(t,k){ return k in t ? t[k] : undefined; }, set(t,k,v){ t[k]=v; return true; } });
}
function makeDom(){
  const nodes = {};
  return {
    nodes,
    document: {
      querySelector(s){ if(!nodes[s]) nodes[s]=el(); return nodes[s]; },
      querySelectorAll(){ return []; },
      createElement(){ return el(); }
    }
  };
}
/* synchronous timers so the Singpass mock chain runs to completion */
const timers = { setTimeout:(fn)=>{ fn(); return 1; }, setInterval:(fn)=>{ fn(); return 1; }, clearTimeout(){}, clearInterval(){} };

function boot(file){
  const src = fs.readFileSync(file, "utf8");
  const js = src.split("<script>")[1].split("</script>")[0];
  const dom = makeDom();
  const ctx = vm.createContext({ document: dom.document, console, process, window:{ scrollTo(){} }, ...timers });
  vm.runInContext(js, ctx);   // boots + initial render — throws on syntax error
  return { ctx, dom };
}

const P = boot("D:/MaivenPoint/eservice-portal-parent.html");   // parent portal
const A = boot("D:/MaivenPoint/admin-portal-moe.html");         // admin portal
const pr = (name, code) => vm.runInContext(code, P.ctx, { filename:"parent:"+name });
const ad = (name, code) => vm.runInContext(code, A.ctx, { filename:"admin:"+name });

/* ================= PHASE A — e-Service Portal (parent) ================= */
pr("A1 singpass login", `
  spStart(); spApp(); spVerify(document.createElement('div'));
`);
T("SIT-A1", "Singpass mock login (PAR→QR→callback→token→uinfin link) establishes the parent session",
  pr("A1 check", `state.parent && state.parent.nric==="S7234567A" && state.screen==="dashboard"`));

pr("A2 ai gathering", `
  aiHandleDirect("I want to apply for FAS");
  aiHandleDirect("5");
  aiHandleDirect("employed");
  aiHandleDirect("hdb");
`);
T("SIT-A2", "AI assistant asks follow-ups and collects household/employment/housing answers",
  pr("A2 check", `state.ai.gathered.householdSize==="5" && state.ai.gathered.employment==="Employed" && state.ai.gathered.housing==="HDB 3-room & above" && state.ai.stage===null`));

pr("A3 prefill", `nav('fas'); fasPrefill();`);
T("SIT-A3", "FAS form pre-filled from profile + chat answers; auto-selects only children WITH an Education Account",
  pr("A3 check", `JSON.stringify(state.fas.selectedChildren)==='["C1","C2"]' && state.fas.form.contact==="+65 9123 4567" && state.fas.form.householdSize==="5" && state.fas.aiFields.includes("householdSize")`));

pr("A4 xiaomei guard", `fasToggleChild('C3');`);
T("SIT-A4", "Child without Education Account (Tan Xiao Mei) cannot be included in the application",
  pr("A4 check", `!state.fas.selectedChildren.includes('C3')`));

pr("A5a validation", `
  logout();
  spStart(); spApp(); spVerify(document.createElement('div'));
  fasSubmit();
`);
T("SIT-A5a", "Submit blocked with clear field errors when required inputs are missing",
  pr("A5a check", `state.fas.errors.includes("children") && state.fas.errors.includes("declaration") && state.fas.status!=="submitted"`));
pr("A5b submit", `
  state.fas.selectedChildren=["C1","C2"];
  state.fas.form={contact:"+65 9123 4567", residential:"Blk 216 Ang Mo Kio Ave 1, #12-345, Singapore 560216", householdSize:"5", employment:"Employed", housing:"HDB 3-room & above"};
  state.fas.declared=true;
  fasSubmit();
`);
T("SIT-A5b", "Valid family application submits and returns a FAS reference number",
  pr("A5b check", `state.fas.status==="submitted" && /^FAS-2026-\\d{3}$/.test(state.fas.refNo)`));
T("SIT-A5c", "Submitted screen tells the parent what happens next (MOEFAS first, school decides otherwise, bands not amounts)",
  pr("A5c check", `nav('fas'); var h=document.querySelector('#app').innerHTML; globalThis.__subH=h; h.includes("MOEFAS is assessed first") && h.includes("S$2,000 – S$3,999") && h.includes("Only ranges are used")`));

pr("A6 profile propagation", `
  logout();
  spStart(); spApp(); spVerify(document.createElement('div'));
  document.querySelector('#pfContact').value="+65 9123 4568";
  document.querySelector('#pfRes').value="Blk 999 New Rd, Singapore 100999";
  document.querySelector('#pfMail').value="Blk 216 Ang Mo Kio Ave 1, #12-345, Singapore 560216";
  profileSave();
`);
T("SIT-A6a", "US-042: edited personal details saved, validated, recorded in change history (mailing follows residential)",
  pr("A6a check", `var p=state.parent; p.profile.contact==="+65 9123 4568" && p.profile.mailing==="Blk 999 New Rd, Singapore 100999" && p.profileHistory.length===3`));
T("SIT-A6b", "Next FAS application auto-fills from the UPDATED profile, fields stay hand-editable",
  pr("A6b check", `logout(); spStart(); spApp(); spVerify(document.createElement('div')); nav('fas'); state.fas.form.contact==="+65 9123 4568" && state.fas.aiFields.includes("contact")`));

pr("A7 subsidy display", `nav('charges',{childId:'C1'});`);
T("SIT-A7", "Granted FAS subsidy is shown per fee component on the parent's outstanding charges",
  pr("A7 check", `var h=document.querySelector('#app').innerHTML; h.includes("FAS subsidy") && h.includes("\\u2212 S$100.00") && h.includes("Why is there a subsidy?")`));

/* ================= PHASE B — Admin Portal (MOE HQ + School) ================= */
ad("B0 login hq", `doAdminLogin('hq');`);

T("SIT-B1a", "ML classifier is deterministic & explainable — Low / Medium / High with tier recommendation",
  ad("B1a", `
    var hi=predictRisk({income:{members:6,hh:"\\u2264 S$1,999",pci:"\\u2264 S$800"},feesDue:350});
    var md=predictRisk({income:{members:4,hh:"S$2,000 – S$3,999",pci:"S$1,000 – S$1,499"},feesDue:302});
    var lo=predictRisk({income:{members:3,hh:"\\u2265 S$8,000",pci:"\\u2265 S$2,500"},feesDue:0});
    globalThis.__b1 = hi.level==="High" && hi.reco==="Tier 2 (SBFAS)"
                   && md.level==="Medium" && md.reco==="Tier 1 (SBFAS)"
                   && lo.level==="Low" && lo.reco==="No SBFAS \\u2014 monitor"
                   && hi.contrib.length>0 && /^0\\./.test(hi.conf);
  `) || vm.runInContext("globalThis.__b1", A.ctx));

ad("B1b auto assessment", `state.fasTab='assess'; assessRun('FAS-2026-0130');`);
T("SIT-B1b", "Rule-based auto-assessment: income bands by NRIC (ranges only) → AND conditions → Tier 2 MOEFAS granted automatically",
  vm.runInContext(`(function(){
    var a=FAS_APPS.find(x=>x.ref==="FAS-2026-0130");
    return a.status==="MOEFAS granted" && a.moefas.tier==="Tier 2"
      && state.lastTrace.steps[0].t.includes("S7888111H") && state.lastTrace.steps[0].t.includes("ranges only");
  })()`, A.ctx));

ad("B2 login school", `doAdminLogin('school');`);
ad("B3 held", `
  MODEL.incomeDown=true;
  document.querySelector('#hpName').value="Chua Held";
  document.querySelector('#hpNric').value="S7012345X";
  document.querySelector('#hpKids').value="Chua Boy (P5-1)";
  document.querySelector('#hpSize').value="4";
  hardcopySave();
`);
T("SIT-B3a", "Income-service failure: application is HELD, never refused; failure logged",
  vm.runInContext(`FAS_APPS[0].status==="Submitted — assessment" && FAS_APPS[0].held===true && MODEL.log.some(l=>l.kind==="fail")`, A.ctx));
ad("B3b retry", `MODEL.incomeDown=false; state.assessRef=FAS_APPS[0].ref; assessRun(FAS_APPS[0].ref);`);
T("SIT-B3b", "After the service is restored the retry completes the assessment",
  vm.runInContext(`FAS_APPS[0].status==="MOEFAS granted"`, A.ctx));

ad("B4 route to school", `
  document.querySelector('#hpName').value="Neo Cheng Lim";
  document.querySelector('#hpNric').value="S7333111C";
  document.querySelector('#hpKids').value="Neo Boy (P5-1)";
  document.querySelector('#hpSize').value="4";
  hardcopySave();
  state.fasTab='queue'; state.mod='fas'; render();
`);
T("SIT-B4", "No MOEFAS tier met → routed to the school's SBFAS queue with the AI prediction attached",
  vm.runInContext(`(function(){
    var a=FAS_APPS[0];
    var h=document.querySelector('#app').innerHTML;
    return a.status==="Awaiting school decision" && a.school==="Riverside Primary School"
      && h.includes("Neo Cheng Lim") && h.includes("AI prediction attached") && h.includes("ML prediction");
  })()`, A.ctx));

ad("B5 grant", `
  sbfasGrant('FAS-2026-0121');
`);
T("SIT-B5a", "Grant modal marks the AI-recommended tier (⭐) and the officer stays the decision-maker",
  vm.runInContext(`document.querySelector('#modalHost').innerHTML.includes("AI recommended")`, A.ctx));
ad("B5b", `document.querySelector('#sbAmt').value="80.00"; sbfasDoGrant('FAS-2026-0121');`);
T("SIT-B5b", "SBFAS grant recorded under the officer's name and the school budget is updated",
  vm.runInContext(`(function(){
    var a=FAS_APPS.find(x=>x.ref==="FAS-2026-0121");
    var b=BUDGET.sbfas["Riverside Primary School"];
    return a.status==="SBFAS granted" && a.sbfas.granted===80 && a.sbfas.decidedBy==="Mr Raj Kumar"
      && b.granted===96880 && b.students===64;
  })()`, A.ctx));

ad("B6 decline", `sbfasDecline('FAS-2026-0113'); document.querySelector('#sbReason').value="Household income above school threshold"; sbfasDoDecline('FAS-2026-0113');`);
T("SIT-B6", "Decline requires a reason and records the outcome visible to the parent",
  vm.runInContext(`(function(){ var a=FAS_APPS.find(x=>x.ref==="FAS-2026-0113"); return a.status==="Declined" && !!a.sbfas.declined && !!a.sbfas.decidedBy; })()`, A.ctx));

T("SIT-B7", "Exclusivity: a student never receives MOEFAS and SBFAS at the same time",
  vm.runInContext(`FAS_APPS.every(a=>!((a.moefas&&a.moefas.tier)&&(a.sbfas&&a.sbfas.granted))) && FAS_APPS.filter(a=>a.status==="Awaiting school decision").every(a=>!a.moefas.tier)`, A.ctx));

T("SIT-B8", "School scoping: the queue contains only the school's own applications",
  vm.runInContext(`(function(){ var q=FAS_APPS.filter(a=>a.status==="Awaiting school decision"&&a.school.indexOf(state.admin.scope)>=0); return q.length>0 && q.every(a=>a.school.indexOf("Angsana")<0); })()`, A.ctx));

ad("B9 budget warn", `state.mod='budget'; render();`);
T("SIT-B9", "R6 budget tracking: crossing 80% raises the warning, grants are still recorded",
  vm.runInContext(`document.querySelector('#app').innerHTML.includes("81% of budget used")`, A.ctx));

ad("B10 model down", `MODEL.down=true; sbfasGrant(FAS_APPS[0].ref);`);
T("SIT-B10", "Model downtime: no recommendation shown, manual decision path, nothing blocked",
  vm.runInContext(`document.querySelector('#modalHost').innerHTML.includes("No recommendation available")`, A.ctx));
ad("B10 restore", `MODEL.down=false; closeModal();`);

/* ================= PHASE C — cross-portal consistency ================= */
const pC1 = JSON.parse(pr("C1 extract", `JSON.stringify({name:STUDENTS.C1.name,sid:STUDENTS.C1.studentId,school:STUDENTS.C1.school,acc:STUDENTS.C1.account.no,led:STUDENTS.C1.ledger,ch:STUDENTS.C1.charges.map(c=>({id:c.id,title:c.title,term:c.term,status:c.status,components:c.components.map(x=>({name:x.name,amount:x.amount,subsidy:x.subsidy||0}))}))})`));
const aC1 = JSON.parse(ad("C1 extract", `JSON.stringify({name:STUDENTS.C1.name,sid:STUDENTS.C1.studentId,school:STUDENTS.C1.school,acc:STUDENTS.C1.account.no,led:STUDENTS.C1.ledger,ch:STUDENTS.C1.charges.map(c=>({id:c.id,title:c.title,term:c.term,status:c.status,components:c.components.map(x=>({name:x.name,amount:x.amount,subsidy:x.subsidy||0}))}))})`));
const pC2 = JSON.parse(pr("C2 extract", `JSON.stringify({name:STUDENTS.C2.name,acc:STUDENTS.C2.account.no,led:STUDENTS.C2.ledger,ch:STUDENTS.C2.charges.map(c=>({id:c.id,title:c.title,term:c.term,status:c.status,components:c.components.map(x=>({name:x.name,amount:x.amount,subsidy:x.subsidy||0}))}))})`));
const aC2 = JSON.parse(ad("C2 extract", `JSON.stringify({name:STUDENTS.C2.name,acc:STUDENTS.C2.account.no,led:STUDENTS.C2.ledger,ch:STUDENTS.C2.charges.map(c=>({id:c.id,title:c.title,term:c.term,status:c.status,components:c.components.map(x=>({name:x.name,amount:x.amount,subsidy:x.subsidy||0}))}))})`));
T("SIT-C1", "Shared student records identical in both portals (identity, school, account no, ledger, charges)",
  JSON.stringify(pC1)===JSON.stringify(aC1) && JSON.stringify(pC2)===JSON.stringify(aC2));

T("SIT-C2", "Same person joins the two systems by NRIC (parent login NRIC exists in the admin income service)",
  pr("C2 p", `SP_USERS.some(u=>u.nric==="S7234567A")`) && ad("C2 a", `!!INCOME_PRESETS["S7234567A"]`));

T("SIT-C3", "Income bands the parent is shown match the bands the admin income service returns (ranges only)",
  (function(){
    const preset = JSON.parse(ad("C3 preset", `JSON.stringify(INCOME_PRESETS["S7234567A"])`));
    const parentHtml = pr("C3 html", `globalThis.__subH`);
    return parentHtml.includes(preset.hh) && parentHtml.includes("S$800") && parentHtml.includes("Only ranges are used");
  })());

T("SIT-C4", "Subsidy on the parent's charge equals the MOEFAS tier subsidy per component (outcome loop)",
  (function(){
    const tier = JSON.parse(ad("C4 tier", `JSON.stringify(MOEFAS_SCHEME.tiers[1].subsidy)`));
    const comp = JSON.parse(pr("C4 comp", `JSON.stringify(Object.fromEntries(STUDENTS.C1.charges.find(c=>c.id==="CH-1001").components.map(x=>[x.name,x.subsidy||0])))`));
    return comp["Tuition Fee"]===tier["Tuition Fee"] && comp["Miscellaneous Fee"]===tier["Miscellaneous Fee"] && comp["Examination Fee"]===tier["Examination Fee"];
  })());

T("SIT-C5", "Outcome loop: admin record for this family (MOEFAS granted Tier 2) ↔ parent sees the subsidies applied",
  ad("C5 admin", `FAS_APPS.find(a=>a.nric==="S7234567A").status==="MOEFAS granted"`) &&
  pr("C5 parent", `STUDENTS.C1.charges.find(c=>c.id==="CH-1001").components.some(x=>x.subsidy>0)`));

T("SIT-C6", "System clock consistent across the two portals (same TODAY)",
  pr("C6", `TODAY`) === ad("C6", `TODAY`));

console.log("\nRESULT: " + PASS + " passed, " + FAIL + " failed, " + (PASS+FAIL) + " total");
process.exit(FAIL ? 1 : 0);
