/* Smoke: MOE HQ fee dashboard — no FAS stat, fewer columns, primary/secondary only */
const fs = require("fs"), vm = require("vm");
function el(){
  const base = { innerHTML:"", value:"", disabled:false, checked:false, style:{},
    classList:{ add(){}, remove(){}, toggle(){} }, children: [],
    appendChild(){}, remove(){}, click(){}, insertAdjacentHTML(){}, outerHTML:"" };
  return new Proxy(base, { get(t,k){ return k in t ? t[k] : undefined; }, set(t,k,v){ t[k]=v; return true; } });
}
function makeDom(){
  const nodes = {};
  return { nodes, document: {
    querySelector(s){ if(!nodes[s]) nodes[s]=el(); return nodes[s]; },
    querySelectorAll(){ return []; }, createElement(){ return el(); } } };
}
const timers = { setTimeout:(fn)=>{ fn(); return 1; }, setInterval:(fn)=>{ fn(); return 1; }, clearTimeout(){}, clearInterval(){} };
const src = fs.readFileSync("D:/MaivenPoint/admin-portal-moe.html", "utf8");
const js = src.split("<script>")[1].split("</script>")[0];
const dom = makeDom();
const ctx = vm.createContext({ document: dom.document, console, window:{ scrollTo(){} }, ...timers });
vm.runInContext(js, ctx);
const r = c => vm.runInContext(c, ctx);

let pass = true;
function chk(name, ok){ console.log((ok?"PASS":"FAIL")+" | "+name); if(!ok) pass=false; }

r("state.admin = ADMIN_USERS.hq; state.screen='admin'; nav('fees');");
const h = dom.nodes["#app"].innerHTML;
const topTable = h.slice(h.indexOf("By school"));

chk("stat card 'FAS subsidies applied' removed", !h.includes("FAS subsidies applied"));
chk("top table: Students column removed", !topTable.includes(">Students<"));
chk("top table: Charges column removed", !topTable.includes(">Charges<"));
chk("top table: Subsidy column removed", !/<th[^>]*>Subsidy</.test(topTable));
chk("top table: Payable column removed", !/<th[^>]*>Payable</.test(topTable));
chk("top table keeps Fee value / Collected / Outstanding",
    topTable.includes(">Fee value<") && topTable.includes(">Collected<") && topTable.includes(">Outstanding<"));
chk("overdue not displayed on HQ dashboard", !/overdue/i.test(topTable));
chk("Little Oaks Kindergarten not listed", !topTable.includes("Little Oaks"));
chk("Riverside Primary listed", topTable.includes("Riverside Primary School"));
chk("Angsana Secondary listed", topTable.includes("Angsana Secondary School"));
chk("HQ dashboard: school-type filter offered (All / Primary / Secondary)",
    h.includes("All schools") && h.includes("Primary schools") && h.includes("Secondary schools"));
r("state.feeDashType='Primary'; render();");
const hp = dom.nodes["#app"].innerHTML;
const tp = hp.slice(hp.indexOf("By school"));
chk("HQ dashboard: Primary filter keeps Riverside, hides Angsana",
    tp.includes("Riverside Primary School") && !tp.includes("Angsana Secondary School"));
r("state.feeDashType='Secondary'; render();");
const hs2 = dom.nodes["#app"].innerHTML;
const ts2 = hs2.slice(hs2.indexOf("By school"));
chk("HQ dashboard: Secondary filter keeps Angsana, hides Riverside",
    ts2.includes("Angsana Secondary School") && !ts2.includes("Riverside Primary School"));
r("state.feeDashType=''; render();");

const agg = JSON.parse(r(`JSON.stringify((()=>{
  const rows = feeDashRows("").filter(x=>{
    const s = SCHOOLS.find(s=>s.name===x.st.school);
    return s && (s.type==="Primary"||s.type==="Secondary");
  });
  return { n: rows.length, ids: [...new Set(rows.map(x=>x.st.id))] }; })())`));
console.log("stats scope -> charges:", agg.n, "students:", agg.ids.join(","));
chk("kindergarten student (C3) excluded from top stats", !agg.ids.includes("C3"));
chk("all primary/secondary students with charges included", ["C1","C2","C4","C5"].every(id=>agg.ids.includes(id)));

r("state.feeDashSchool='Riverside Primary School'; render();");
const d = dom.nodes["#app"].innerHTML;
chk("drill-down still renders", d.includes("fee breakdown"));
chk("drill-down: Charges column removed", !/<th[^>]*>Charges</.test(d));
chk("drill-down: Subsidy column removed", !/<th[^>]*>Subsidy</.test(d));
chk("drill-down: Payable column removed", !/<th[^>]*>Payable</.test(d));
chk("drill-down keeps Fee value / Collected / Outstanding",
    d.includes(">Fee value<") && d.includes(">Collected<") && d.includes(">Outstanding<"));
chk("overdue not displayed on drill-down", !/overdue/i.test(d));
chk("drill-down: By student section removed", !d.includes("By student"));
chk("drill-down: FAS subsidies stat card removed", !d.includes("FAS subsidies"));
chk("By level / class / fee type cards still present",
    d.includes("By level / cohort") && d.includes("By class") && d.includes("By fee type"));
chk("fee type Components button still present", d.includes(">Components<"));
chk("studentFeesModal removed from code", r("typeof studentFeesModal") === "undefined");
r("state.feeDashLevel='Primary 3'; render();");
chk("drill-down filters still render", dom.nodes["#app"].innerHTML.includes("filtered"));

/* school user view unaffected */
r("state.feeDashSchool=''; state.feeDashLevel=''; state.feeDashFt=''; state.admin=ADMIN_USERS.school; nav('fees');");
const sv = dom.nodes["#app"].innerHTML;
chk("school user: Student fees tab still present", sv.includes("Student fees"));
chk("school user: charge modal replaced by inline per-student expansion", r("typeof stuFeeDetail") === "undefined" && r("typeof stuToggle") === "function");

/* handbook hidden from MOE HQ, still available to school users */
r("state.admin=ADMIN_USERS.hq; state.feeMenuOpen=true; nav('dash');");
let sb = dom.nodes["#sidebar"].innerHTML;
chk("HQ sidebar: Fee Handbook + Assign fees hidden", !sb.includes("Fee Handbook") && !sb.includes("Assign fees"));
chk("HQ sidebar: Fee dashboard + Master catalogue still present",
    sb.includes("Fee dashboard") && sb.includes("Master catalogue"));
r("nav('handbook');");
chk("HQ nav('handbook') redirects to fee dashboard",
    r("state.mod") === "fees" && !dom.nodes["#app"].innerHTML.includes("Fee Handbook"));
r("state.admin=ADMIN_USERS.school; state.feeMenuOpen=true; nav('dash');");
sb = dom.nodes["#sidebar"].innerHTML;
chk("School sidebar: Fee Handbook still present", sb.includes("Fee Handbook"));
r("nav('handbook');");
chk("School nav('handbook') still works", dom.nodes["#app"].innerHTML.includes("Fee Handbook"));

/* master fee type modal (MOE HQ) */
r("state.admin=ADMIN_USERS.hq; state.sim=null; nav('master');");
r("masterEdit('');");
const mh = dom.nodes["#modalHost"].innerHTML;
chk("master modal: Handbook notes field removed", !mh.includes("Handbook notes"));
chk("master modal: payable checkbox + label + hint removed",
    !mh.includes("payable?") && !mh.includes("isPayableByEduAccount") && !mh.includes('payableEdu\',this.checked'));
chk("master modal: annotation line removed", !mh.includes("every school plan picks"));
chk("master modal: Applies to marked mandatory (*)", /Applies to <span/.test(mh));
chk("master modal: placeholder option present", mh.includes("— Select level scope —"));
const before = r("MASTER_FEE_TYPES.length");
r("masterDraftSet('name','Smoke Test Type'); masterCompSet(0,'name','Comp A'); masterCompSet(0,'amount','10'); masterSave('');");
chk("save blocked when Applies to empty",
    r("MASTER_FEE_TYPES.length") === before && dom.nodes["#modalHost"].innerHTML.includes("New master fee type"));
r("masterDraftSet('levelScope','Primary'); masterSave('');");
chk("save succeeds once Applies to chosen", r("MASTER_FEE_TYPES.length") === before + 1);
const last = JSON.parse(r("JSON.stringify(MASTER_FEE_TYPES[MASTER_FEE_TYPES.length-1])"));
chk("saved type: levelScope set, no notes field", last.levelScope === "Primary" && !("notes" in last));
r("closeModal();");
r("render();");
const mc = dom.nodes["#app"].innerHTML;
chk("catalogue table: Education Account column removed", !mc.includes("<th>Education Account</th>"));
chk("catalogue table: MOEFAS tier columns removed", !mc.includes("MOEFAS Tier 1") && !mc.includes("MOEFAS Tier 2"));
chk("catalogue table: payable badges removed", !mc.includes(">Payable<") && !mc.includes("Not payable"));
chk("catalogue table: subsidy note removed", !mc.includes("FAS subsidy amounts follow"));
chk("catalogue table: Component + Default amount + Total remain",
    mc.includes("<th>Component</th>") && mc.includes("Default amount") && mc.includes("Total (all components)"));

process.exitCode = pass ? 0 : 1;
console.log(pass ? "ALL OK" : "FAILURES");
