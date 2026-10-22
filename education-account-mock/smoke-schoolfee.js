/* Smoke: school user — handbook columns, school-own fee type, assign incl. MOE fee types */
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

r("state.admin=ADMIN_USERS.school; state.screen='admin';");

/* ---- 1. Handbook (school view) — mandatory MOE fee types lookup ---- */
r("nav('handbook');");
let hb = dom.nodes["#app"].innerHTML;
chk("handbook: Education Account column removed", !hb.includes("<th>Education Account</th>"));
chk("handbook: MOEFAS tier columns removed", !hb.includes("MOEFAS"));
chk("handbook: keeps Fee component + Default", hb.includes("<th>Fee component</th>") && hb.includes("<th class=\"num\">Default</th>"));
chk("handbook: mandatory fee types flagged with badge", hb.includes("Mandatory"));
chk("handbook: every MOE fee type is mandatory (MFT-01..04)", r("MASTER_FEE_TYPES.every(m=>m.mandatory===true)"));
chk("handbook: each in-scope card carries the Mandatory badge", (hb.match(/>Mandatory</g)||[]).length===2);
chk("handbook: mandatory types listed first", hb.indexOf("School Fees (Primary)") < hb.indexOf("Supplementary / Enrichment Programme"));
chk("handbook: primary school sees only Primary + All levels",
    hb.includes("School Fees (Primary)") && hb.includes("Supplementary / Enrichment Programme") &&
    !hb.includes("School Fees (Secondary)") && !hb.includes("MFT-04"));
chk("handbook: MFT id tags hidden", !hb.includes(">MFT-0") && r("MASTER_SHOW_ID")===false);
chk("handbook: MFC component ids hidden", !hb.includes(">MFC-0") && r("MFC_SHOW_ID")===false);
chk("handbook: search refreshes only the card list (typing keeps focus, no full render)",
    hb.includes("refreshHandbookList()") && !hb.includes('oninput="state.handbookQ=this.value;render()"'));
r("state.admin.scope='Angsana Secondary School'; nav('handbook');");
const hb2 = dom.nodes["#app"].innerHTML;
chk("handbook: secondary school sees only Secondary + All levels",
    hb2.includes("School Fees (Secondary)") && hb2.includes("Skills Programme") &&
    !hb2.includes("School Fees (Primary)") && !hb2.includes("MFT-01"));
r("state.admin.scope='Riverside Primary School'; nav('handbook');");

/* ---- 2. School fee catalogue page (own fee cards) ---- */
r("nav('master');");
const fp = dom.nodes["#app"].innerHTML;
chk("catalogue page: titled School fee catalogue", fp.includes("School fee catalogue"));
chk("plan cards: Education Account column removed", !fp.includes("<th>Education Account</th>"));
chk("plan cards: MOEFAS subsidy column removed", !fp.includes("MOEFAS subsidy"));
chk("plan cards: Component + Amount, Origin column removed",
    fp.includes("<th>Component</th>") && !fp.includes("<th>Origin</th>") && fp.includes("Amount</th>"));
chk("catalogue: level filter offered (All levels + the school's fee levels)",
    fp.includes(">All levels</option>") && fp.includes(">Primary 3</option>"));

/* ---- 3. School fee creation (no origin — always the school's own) ---- */
const ftBefore = r("FEE_TYPES.length");
r("planNew();");
let mh = dom.nodes["#modalHost"].innerHTML;
chk("fee modal: 'Fee type origin' removed", !mh.includes("Fee type origin"));
chk("fee modal: Level field removed (level is chosen at assign time)", !mh.includes("Level / Cohort"));
chk("fee modal: annotations removed, only the total calc kept",
    !mh.includes("No level here") && !mh.includes("Add your school fee components") &&
    !mh.includes("Issued charges are not affected") && !mh.includes("tick to include") &&
    mh.includes("0 components · total S$0.00"));
chk("fee modal: component rows have no tickbox, Add button sits on its own row below",
    !mh.includes("planRowToggle") && !mh.includes('type="checkbox"') &&
    mh.includes("＋ Add component"));
chk("planRowToggle removed from code", r("typeof planRowToggle") === "undefined");
chk("planPickMaster removed from code", r("typeof planPickMaster") === "undefined");
r("planSave();");
chk("fee without components is blocked", r("FEE_TYPES.length")===ftBefore && dom.nodes["#modalHost"].innerHTML.includes("Include at least one component"));
r("state.planDraft.name='Swimming CCA'; state.planDraft.localName='Pool rental'; state.planDraft.localAmt='60'; planAddLocal(); planSave();");
chk("school fee saved", r("FEE_TYPES.length")===ftBefore+1);
const own = JSON.parse(r("JSON.stringify(FEE_TYPES[FEE_TYPES.length-1])"));
chk("school fee: own=true, no level (chosen at assign time), no masterId, school-defined component",
    own.own===true && !own.level && !own.masterId && own.school==="Riverside Primary School" &&
    own.components.length===1 && own.components[0].isLocal===true && own.components[0].name==="Pool rental");
chk("seed: school-own fee FT-06 carries no level", !r("FEE_TYPES.find(f=>f.id==='FT-06').level"));
r("nav('master'); render();");
chk("catalogue list shows 'School fee' label", dom.nodes["#app"].innerHTML.includes("<b>School fee</b>"));
r("planEdit('"+own.id+"');");
chk("editing school fee: no origin select", !dom.nodes["#modalHost"].innerHTML.includes("Fee type origin"));
r("closeModal();");
/* editing a MOE-derived legacy fee keeps its masterId */
const legacy = JSON.parse(r("JSON.stringify(FEE_TYPES.find(f=>f.masterId&&String(f.masterId).indexOf('MFT')===0)||null)"));
if (legacy){
  r("planEdit('"+legacy.id+"'); planSave();");
  chk("editing MOE-derived fee keeps its masterId", r("FEE_TYPES.find(f=>f.id==='"+legacy.id+"').masterId")===legacy.masterId);
} else chk("editing MOE-derived fee keeps its masterId (none in data)", true);
r("planEdit('FT-02'); planSave();");
chk("editing an extracted fee keeps its assign-time level (Primary 3)", r("FEE_TYPES.find(f=>f.id==='FT-02').level")==="Primary 3");

/* ---- 4. Assign: MOE bill (whole cohort) vs School bill (level / class / picked students) — never mixed ---- */
r("state.assign={school:'Riverside Primary School',mode:'moe',level:'',term:'',moeIds:[],schIds:[],comps:{},target:'level',klass:'',students:[],result:null}; nav('assign');");
let av = dom.nodes["#app"].innerHTML;
chk("assign: MOE bill / School bill toggle, MOE side first — the two are never mixed",
    av.includes(">MOE bill</button>") && av.includes(">School bill</button>") &&
    av.includes("<label>MOE bill</label>") && av.includes("＋ Add MOE bill") &&
    !av.includes("<label>School bill</label>") && !av.includes("＋ Add school bill") && !av.includes("assignToggle"));
chk("assign: labels trimmed (no '—' suffix) and dropdown hints removed",
    !av.includes("MOE bill —") && !av.includes("School bill —") &&
    !av.includes("No MOE fee type added yet") && !av.includes("No school fee added yet") &&
    !av.includes("Only levels matching") && !av.includes("Pick a fee type") && !av.includes("The charges are issued to"));
chk("assign: school dropdown removed (own school only)",
    !av.includes("<label>School</label>") && !av.includes("assignSet('school'"));
chk("assign: stepper no longer offers 'Create school fee'",
    !av.includes("Create school fee") && av.includes("Charge history"));
chk("assign: stepper shows labels only (no step numbers)",
    !av.includes('<span class="n">') && av.includes("Assign & generate charges"));
chk("assign: MOE dropdown scoped to the school's level (Primary — no Secondary types)",
    av.includes("School Fees (Primary)") && av.includes("Supplementary / Enrichment Programme") &&
    !av.includes("School Fees (Secondary)") && !av.includes("Skills Programme") && !av.includes("MFT-02") && !av.includes("MFT-04"));
const mftId = r("(()=>{const m=MASTER_FEE_TYPES.find(x=>x.levelScope==='Primary'); return m?m.id:''})()");
chk("a Primary-scoped MOE fee type exists in catalogue", !!mftId);
const mftSupp = r("MASTER_FEE_TYPES.find(x=>x.levelScope==='All levels').id");
r("assignAdd('moe','"+mftId+"');");
av = dom.nodes["#app"].innerHTML;
chk("assign: a MOE bill is added whole — components listed without checkboxes, mandatory badge shown",
    av.includes("Tuition Fee") && av.includes("Examination Fee") && av.includes("assigned whole — 3 components") && av.includes(">Mandatory<") &&
    !av.includes("assignComp('"+mftId+"'"));
r("assignAdd('moe','"+mftSupp+"');");
av = dom.nodes["#app"].innerHTML;
chk("assign: multiple MOE bills can be added together (each assigned whole)",
    (av.match(/assigned whole/g)||[]).length===2 && av.includes("Supplementary / Enrichment Programme") && (av.match(/badge b-blue">MOE<\/span>/g)||[]).length>=3);
r("assignRemove('moe','"+mftSupp+"');");
av = dom.nodes["#app"].innerHTML;
chk("assign: a MOE bill can be removed from the selection",
    (av.match(/assigned whole/g)||[]).length===1);
r("state.assign.comps['"+mftId+"']=['MFC-01'];");   /* crafted stale selection — must be ignored for MOE bills */
av = dom.nodes["#app"].innerHTML;
chk("assign: MOE components are not selectable (no checkbox; stale comps ignored)",
    !av.includes("assignComp('"+mftId+"'") && av.includes("assigned whole — 3 components"));
r("delete state.assign.comps['"+mftId+"'];");
r("assignAdd('sch','FT-02');");
chk("assign: a school bill cannot be added while on the MOE bill side (never mixed)",
    r("state.assign.schIds.length")===0 && !dom.nodes["#app"].innerHTML.includes("<label>School bill</label>"));
r("assignSet('level','Primary 3');");
av = dom.nodes["#app"].innerHTML;
chk("assign: MOE bill levels respect the type scope (Primary levels only)",
    av.includes(">Primary 3</option>") && !av.includes(">Secondary"));
chk("assign: generate button carries the counts (no preview table)",
    !av.includes("<h4>Preview") && !av.includes("Charges that will be created") &&
    av.includes("Generate 3 charges") && av.includes("3 to create · 0 already charged"));
const before = r("STUDENTS['C1'].charges.length + STUDENTS['C6'].charges.length + STUDENTS['C7'].charges.length");
r("assignGenerate();");
const res = JSON.parse(r("JSON.stringify(state.assign.result)"));
chk("assign: a MOE bill charges the WHOLE cohort (every Primary 3 student)",
    res.created===3 && res.skipped===0 && res.types===1 && res.who==="whole cohort" &&
    res.level==="Primary 3" && res.classes===2 && res.totalPerStudent===320 &&
    r("STUDENTS['C1'].charges.length + STUDENTS['C6'].charges.length + STUDENTS['C7'].charges.length")===before+3);
chk("assign: last-generation result card removed (feedback stays on the toast)",
    !dom.nodes["#app"].innerHTML.includes("Last generation result") &&
    !dom.nodes["#app"].innerHTML.includes("parents can now see them in the e-Service Portal"));
chk("assign: snapshot note reports the MOE extraction", !!res.snap && res.snap.indexOf(mftId)>=0);
const snap = JSON.parse(r("JSON.stringify(FEE_TYPES[FEE_TYPES.length-1])"));
chk("assign: MOE bill extracted whole into school fees (catalogue stable)",
    snap.masterId===mftId && snap.level==="Primary 3" && snap.components.length===r("MASTER_FEE_TYPES.find(m=>m.id==='"+mftId+"').components.length"));
chk("assign: MOE charges carry the whole component set",
    r("STUDENTS['C1'].charges.some(c=>c.ftId==='"+snap.id+"'&&c.components.length===3&&c.components.some(x=>x.name==='Examination Fee'))")===true);
r("assignGenerate();");
chk("assign: duplicates skipped on re-run", r("state.assign.result.created")===0 && r("state.assign.result.skipped")===3);
const mftSnaps = ()=>r("FEE_TYPES.filter(f=>f.masterId==='"+mftId+"'&&f.level).length");
r("assignSet('level','Primary 5'); assignGenerate();");
chk("assign: another cohort extracts its own snapshot",
    mftSnaps()===2 && r("state.assign.result.created")===r("Object.values(STUDENTS).filter(s=>s.school==='Riverside Primary School'&&s.level==='Primary 5').length"));
r("assignSet('level','Primary 3'); assignGenerate();");
chk("assign: re-assigning the same cohort reuses the snapshot — catalogue never changes",
    mftSnaps()===2 && r("state.assign.result.created")===0 && !!r("state.assign.result.snap"));

/* ---- 4a. School bills: the school's OWN fees — to a whole level, one class, or picked students ---- */
r("assignMode('sch');");
av = dom.nodes["#app"].innerHTML;
chk("assign: switching to School bill clears the MOE draft (the two are never mixed)",
    r("state.assign.moeIds.length")===0 && r("state.assign.schIds.length")===0 &&
    av.includes("<label>School bill</label>") && !av.includes("<label>MOE bill</label>") && !av.includes("assigned whole"));
chk("assign: school-bill dropdown lists only school-OWN fees — clearly different from the MOE catalogue",
    av.includes("Learning Journey") && av.includes("Robotics &amp; Coding Club") && av.includes("Swimming CCA") &&
    !av.includes("School Fees (Primary)") && !av.includes("Supplementary Programme"));
r("assignAdd('moe','"+mftId+"');");
chk("assign: a MOE bill cannot be added while on the School bill side", r("state.assign.moeIds.length")===0);
r("assignAdd('sch','FT-02');");
chk("assign: a MOE-extracted fee type cannot be re-assigned as a school bill", r("state.assign.schIds.length")===0);
r("assignAdd('sch','FT-07'); assignAdd('sch','FT-06');");
av = dom.nodes["#app"].innerHTML;
chk("assign: multiple school bills can be added together (components still tickable)",
    (av.match(/components<\/b> ticked/g)||[]).length===2 && av.includes("Robotics kit") && av.includes("Transport &amp; entry"));
r("assignRemove('sch','FT-06');");
av = dom.nodes["#app"].innerHTML;
chk("assign: a school bill can be removed from the selection",
    (av.match(/components<\/b> ticked/g)||[]).length===1 && !av.includes("Transport &amp; entry"));
chk("assign: school bill offers its components for cherry-picking", av.includes("2 of 2 components"));
chk("assign: target offered — whole level, one class, or selected students",
    av.includes("<label>Target") && av.includes("Whole level (cohort)</option>") &&
    av.includes("A specific class") && av.includes("Selected students"));
r("assignComp('FT-07','Instructor fee');");
av = dom.nodes["#app"].innerHTML;
chk("assign: unticking a component updates count + total",
    av.includes("1 of 2 components") && av.includes("S$35.00"));
r("assignRemove('sch','FT-07'); assignAdd('sch','FT-09'); assignComp('FT-09','Coach fee');");
av = dom.nodes["#app"].innerHTML;
chk("assign: a level-bound school bill (Swimming CCA · Primary 3) ticks down to one component",
    av.includes("1 of 2 components") && av.includes("S$45.00"));
r("assignSet('target','class');");
av = dom.nodes["#app"].innerHTML;
chk("assign: class target steps through level first — no classes listed yet",
    av.includes("— select level —") && !av.includes("P3-1") && !av.includes("P5-1"));
r("assignSet('cLevel','Primary 3');");
av = dom.nodes["#app"].innerHTML;
chk("assign: picking the level lists that level's classes only (Primary 3 — fee level honoured)",
    av.includes("P3-2") && av.includes("P3-1") && !av.includes("P5-1") && !av.includes("P1-1"));
r("assignSet('klass','K6'); assignGenerate();");
const resClass = JSON.parse(r("JSON.stringify(state.assign.result)"));
chk("assign: school bill to ONE class — the whole of P3-1 charged, nobody else touched",
    resClass.created===2 && resClass.skipped===0 && resClass.who==="class P3-1" && resClass.types===1 && resClass.totalPerStudent===45 &&
    r("STUDENTS['C6'].charges.some(c=>c.ftId==='FT-09'&&c.term==='2026 Term 4'&&c.components.length===1&&c.components[0].name==='Pool rental')")===true &&
    r("STUDENTS['C7'].charges.some(c=>c.ftId==='FT-09'&&c.term==='2026 Term 4'&&c.components.length===1)")===true &&
    r("STUDENTS['C1'].charges.some(c=>c.ftId==='FT-09'&&c.term==='2026 Term 4')")===false &&
    r("STUDENTS['C5'].charges.some(c=>c.ftId==='FT-09'&&c.term==='2026 Term 4')")===false);
r("assignRemove('sch','FT-09'); assignAdd('sch','FT-06'); assignSet('target','students');");
av = dom.nodes["#app"].innerHTML;
chk("assign: student picker stays empty until filtered — level > class > name search offered",
    !av.includes("assignStudent('") && av.includes("<label>Level") && av.includes("<label>Class") &&
    av.includes("Search student name") && av.includes("refreshAssignStuds()"));
r("assignSet('sLevel','Primary 1');");
av = dom.nodes["#app"].innerHTML;
chk("assign: a level alone lists nobody — the flow requires a class too",
    !av.includes("assignStudent('") && av.includes("— select class —") && !av.includes("All classes"));
r("assignSet('sKlass','K9');");
av = dom.nodes["#app"].innerHTML;
chk("assign: picking the class lists that class's students only",
    av.includes("assignStudent('C10')") && av.includes("assignStudent('C11')") && !av.includes("assignStudent('C1')"));
r("assignSet('sQ','Wei');");
av = dom.nodes["#app"].innerHTML;
chk("assign: name search narrows within the class to the one student",
    av.includes("assignStudent('C10')") && !av.includes("assignStudent('C11')") && av.includes("1 listed"));
const ljBefore = r("Object.values(STUDENTS).filter(s=>s.charges.some(c=>c.ftId==='FT-06'&&c.term==='2026 Term 4')).length");
r("assignStudent('C10'); assignGenerate();");
const resOne = JSON.parse(r("JSON.stringify(state.assign.result)"));
chk("assign: school bill to a SINGLE student — only C10 charged (nobody else gains the fee)",
    resOne.created===1 && resOne.who==="1 selected student" && resOne.types===1 &&
    r("STUDENTS['C10'].charges.some(c=>c.ftId==='FT-06'&&c.term==='2026 Term 4'&&c.components.length===1)")===true &&
    r("Object.values(STUDENTS).filter(s=>s.charges.some(c=>c.ftId==='FT-06'&&c.term==='2026 Term 4')).length")===ljBefore+1);
const p5missing = r("Object.values(STUDENTS).filter(s=>s.school==='Riverside Primary School'&&s.level==='Primary 5'&&!s.charges.some(c=>c.ftId==='FT-06'&&c.term==='2026 Term 4')).length");
r("assignSet('target','level'); assignSet('level','Primary 5'); assignGenerate();");
chk("assign: school bill to a whole level (every Primary 5 student still missing it)",
    p5missing>0 && r("state.assign.result.who")==="whole level" && r("state.assign.result.created")===p5missing);

/* ---- 4b. Assign: MOE fee types strictly level-scoped (same rule as the Handbook) ---- */
r("state.admin.scope='Angsana Secondary School'; state.assign={school:'Angsana Secondary School',mode:'moe',level:'',term:'',moeIds:[],schIds:[],comps:{},target:'level',klass:'',students:[],result:null}; nav('assign');");
const avs = dom.nodes["#app"].innerHTML;
chk("assign: MOE dropdown scoped to the school's level (Secondary — no Primary types)",
    avs.includes("School Fees (Secondary)") && avs.includes("Skills Programme") &&
    !avs.includes("School Fees (Primary)") && !avs.includes("MFT-01"));
r("state.admin.scope='Riverside Primary School'; state.assign={school:'Riverside Primary School',mode:'moe',level:'',term:'',moeIds:[],schIds:[],comps:{},target:'level',klass:'',students:[],result:null}; nav('assign');");
const ftBeforeGen = r("FEE_TYPES.length");
r("state.assign.level='Primary 3'; state.assign.comps={}; assignAdd('moe','MFT-02');");
chk("assign: out-of-level MOE type (MFT-02 for a primary school) cannot be added",
    r("JSON.stringify(state.assign.moeIds)")==="[]");
r("state.assign.moeIds=['MFT-02']; assignGenerate();");
chk("assign: out-of-level MOE type cannot be generated either",
    r("state.assign.result")===null && r("FEE_TYPES.length")===ftBeforeGen);

/* ---- 5. Fee features split: Student fees & dashboard (2 tabs) + Assign fees (own page) ---- */
r("nav('fees');");
const fv = dom.nodes["#app"].innerHTML;
chk("fees module: Student fees + Fee dashboard tabs only (Charge history lives in Assign fees)",
    fv.includes("Student fees") && fv.includes("Fee dashboard") && !fv.includes("feeTab='assign'") && !fv.includes("Charge history"));
chk("fees module: School fee plans tab removed", !fv.includes("School fee plans"));
chk("fees module: no Phương án C text", !fv.includes("Phương án C"));
const sbv = dom.nodes["#sidebar"].innerHTML;
chk("sidebar: 'Student fees & dashboard' + separate 'Assign fees' menu items",
    sbv.includes("Student fees &amp; dashboard") && sbv.includes("Assign fees</a>") && sbv.includes("nav('assign')"));
chk("fees module: Fee dashboard tab listed first", fv.indexOf("feeTab='dash'") < fv.indexOf("feeTab='stu'"));
r("state.feeTab='dash'; render();");
const dvt = dom.nodes["#app"].innerHTML;
chk("dashboard tab: pie-first — number stat cards removed, breakdown tables remain",
    !dvt.includes("Fee value issued") && dvt.includes("By level / cohort") && dvt.includes("By class") && dvt.includes("By fee type"));
chk("dashboard tab: no back-to-all-schools link (own school)", !dvt.includes("← All schools"));
chk("dashboard tab: pie chart renders with composition tabs",
    dvt.includes("Fee value composition") && dvt.includes("Collected vs Outstanding") && (dvt.match(/<circle /g)||[]).length>=2 && dvt.includes("%"));
r("state.feePie='level'; render();");
chk("dashboard tab: pie switches to by-level slices", (dom.nodes["#app"].innerHTML.match(/<circle /g)||[]).length>=6);
r("state.feePie='ft'; render();");
chk("dashboard tab: pie by fee type renders", (dom.nodes["#app"].innerHTML.match(/<circle /g)||[]).length>=3);
r("state.feePie='status'; render();");
r("nav('assign');");
const avp = dom.nodes["#app"].innerHTML;
chk("assign: standalone feature page — single h1, no tabs", (avp.match(/<h1 class="page">/g)||[]).length===1 && !avp.includes("feeTab"));
/* Charge history — step 2 of the assign flow, from the school user's lens: rounds of what was charged & when */
r("state.assignTab='history'; render();");
const hv = dom.nodes["#app"].innerHTML;
chk("charge history: columns Issued / Charge / Term / Amount only — Due hidden (data kept)",
    hv.includes("<th>Issued</th>") && hv.includes("<th>Charge</th>") && hv.includes("<th>Term</th>") &&
    /<th class="num">Amount<\/th>/.test(hv) && !hv.includes("<th>Due</th>") &&
    r("HIST_SHOW_DUE")===false);
const expRound = r("(()=>{const k=new Set(); Object.values(STUDENTS).filter(s=>s.school==='Riverside Primary School').forEach(s=>s.charges.forEach(c=>{const ft=FEE_TYPES.find(f=>f.id===c.ftId); k.add(c.issued+'|'+c.term+'|'+((ft&&ft.masterId)?'moe':'sch'))})); return k.size})()");
chk("charge history: one row per issuance round (school's action, not per student)",
    (hv.match(/class="clickable" onclick="histToggle\('/g)||[]).length===expRound && expRound>0 &&
    hv.includes("issuance round"));
chk("charge history: split by bill kind — MOE bills and School bills sections both listed, MOE first",
    hv.includes("<b>MOE bills</b>") && hv.includes("<b>School bills</b>") &&
    hv.indexOf("<b>MOE bills</b>") < hv.indexOf("<b>School bills</b>"));
chk("charge history: every round is pure — MOE rounds hold only MOE-extracted fee types, school rounds only school-own",
    r("(()=>{const {groups}=histRounds(); return groups.length>0 && groups.some(g=>g.kind==='moe') && groups.some(g=>g.kind!=='moe') && groups.every(g=>[...g.fts.values()].every(t=>(g.kind==='moe')===(!!(t.ft&&t.ft.masterId))))})()")===true);
chk("charge history: bill-kind filter offered (All bills / MOE bills / School bills)",
    hv.includes(">All bills<") && hv.includes('<option value="moe"') && hv.includes('<option value="sch"'));
r("state.histKind='moe'; render();");
const hvm = dom.nodes["#app"].innerHTML;
chk("charge history: MOE-bill filter shows only the MOE section with its rounds",
    hvm.includes("<b>MOE bills</b>") && !hvm.includes("<b>School bills</b>") && hvm.includes("MOE bills only") &&
    (hvm.match(/class="clickable" onclick="histToggle\('/g)||[]).length===r("histRounds().groups.length") && r("histRounds().groups.length")>0);
r("state.histKind='sch'; render();");
const hvs = dom.nodes["#app"].innerHTML;
chk("charge history: School-bill filter shows only the School section with its rounds",
    hvs.includes("<b>School bills</b>") && !hvs.includes("<b>MOE bills</b>") && hvs.includes("School bills only") &&
    (hvs.match(/class="clickable" onclick="histToggle\('/g)||[]).length===r("histRounds().groups.length") && r("histRounds().groups.length")>0);
r("state.histKind=''; render();");
chk("charge history: issued-date range filter offered (from → to)",
    hv.includes('type="date"') && hv.includes("→") && !hv.includes("All dates"));
chk("charge history: search refreshes only the list body (typing keeps focus, no full render)",
    hv.includes("refreshHistBody()") && !hv.includes('oninput="state.histQ=this.value;render()"'));
chk("charge history: Term dropdown back (All terms), Status dropdown still hidden",
    hv.includes("All terms") && !hv.includes(">Paid<") && hv.includes('type="date"') &&
    r("HIST_SHOW_TERM_DD")===true && r("HIST_SHOW_STATUS_DD")===false && r("HIST_SHOW_OUTSTANDING")===false);
const key1 = r("(()=>{const c=STUDENTS['C1'].charges[0]; const ft=FEE_TYPES.find(f=>f.id===c.ftId); return c.issued+'|'+c.term+'|'+((ft&&ft.masterId)?'moe':'sch')})()");
r("histToggle('"+key1+"');");
const hx = dom.nodes["#app"].innerHTML;
chk("charge history: expanding a round shows what was charged — fee types + components per student",
    hx.includes("Tuition Fee") && hx.includes("Total per student") && hx.includes("students") && hx.includes("levels"));
chk("charge history: expanded round tags MOE fees", hx.includes('<span class="badge b-blue">MOE</span>'));
r("histToggle('"+key1+"');");
const keyLJ = r("(()=>{const s=Object.values(STUDENTS).find(s=>s.school==='Riverside Primary School'&&s.charges.some(c=>c.ftId==='FT-06')); const c=s.charges.find(x=>x.ftId==='FT-06'); const ft=FEE_TYPES.find(f=>f.id===c.ftId); return c.issued+'|'+c.term+'|'+((ft&&ft.masterId)?'moe':'sch')})()");
r("histToggle('"+keyLJ+"');");
chk("charge history: expanded round tags school-own fees",
    dom.nodes["#app"].innerHTML.includes('<span class="badge b-purple">School</span>'));
r("histToggle('"+keyLJ+"');");
r("state.histTerm='2026 Term 3'; render();");
const expT3r = r("(()=>{const k=new Set(); Object.values(STUDENTS).filter(s=>s.school==='Riverside Primary School').forEach(s=>s.charges.forEach(c=>{if(c.term==='2026 Term 3'){const ft=FEE_TYPES.find(f=>f.id===c.ftId); k.add(c.issued+'|'+c.term+'|'+((ft&&ft.masterId)?'moe':'sch'))}})); return k.size})()");
chk("charge history: term filter narrows to that term's rounds",
    (dom.nodes["#app"].innerHTML.match(/class="clickable" onclick="histToggle\('/g)||[]).length===expT3r && expT3r>0 && expT3r<expRound);
r("state.histTerm=''; state.histFrom='2026-09-01'; state.histTo='2026-09-30'; render();");
const expSep = r("(()=>{const MK={Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12}; const k=new Set(); Object.values(STUDENTS).filter(s=>s.school==='Riverside Primary School').forEach(s=>s.charges.forEach(c=>{const p=c.issued.split(' '); const ik=p.length===3?(+p[2])*10000+MK[p[1]]*100+(+p[0]):0; if(ik>=20260901&&ik<=20260930){const ft=FEE_TYPES.find(f=>f.id===c.ftId); k.add(c.issued+'|'+c.term+'|'+((ft&&ft.masterId)?'moe':'sch'))}})); return k.size})()");
const hs = dom.nodes["#app"].innerHTML;
chk("charge history: date-range filter narrows to rounds issued in the range",
    (hs.match(/class="clickable" onclick="histToggle\('/g)||[]).length===expSep && expSep>0 && expSep<expRound &&
    hs.includes("issued-date filter active"));
r("state.histFrom=''; state.histTo=''; state.assignTab='form'; render();");
chk("charge history: back to the assign form (step 1)", dom.nodes["#app"].innerHTML.includes(">MOE bill<"));
r("nav('fees'); state.feeTab='stu'; render();");
const svt = dom.nodes["#app"].innerHTML;
chk("student fees: per-student table with Total payable / Paid / To collect",
    /<th[^>]*>Total payable<\/th>/.test(svt) && /<th[^>]*>Paid<\/th>/.test(svt) && /<th[^>]*>To collect<\/th>/.test(svt));
chk("student fees: flat per-charge rows removed", !svt.includes("<th>Fee type</th>") && !svt.includes("stuFeeDetail("));
chk("student fees: intro annotation removed", !svt.includes("Each student's fee position"));
chk("student fees: Totals table row removed (stat cards carry it)", !svt.includes("Totals —"));
chk("student fees: overdue not displayed (collapses to Outstanding)",
    !svt.includes("<option>Overdue</option>") && !svt.includes(">Overdue<"));
r("state.stuFeesStatus='Outstanding'; state.feeTab='stu'; render();");
chk("student fees: Outstanding filter still lists overdue-seeded students (Arjun)", dom.nodes["#app"].innerHTML.includes("Arjun Menon"));
r("state.stuFeesStatus='All'; render();");
r("nav('student',{adminStudent:'C8'});");
chk("student record: overdue charge shown as Outstanding", !dom.nodes["#app"].innerHTML.includes(">Overdue<") && dom.nodes["#app"].innerHTML.includes("Outstanding"));
r("nav('fees'); state.feeTab='stu'; render();");
const expP = r("STUDENTS['C1'].charges.reduce((s,c)=>s+payableOf(c),0)");
const expD = r("STUDENTS['C1'].charges.reduce((s,c)=>s+(c.status==='paid'?payableOf(c):0),0)");
const expC = r("STUDENTS['C1'].charges.reduce((s,c)=>s+(c.status!=='paid'?payableOf(c):0),0)");
chk("student fees: student row shows the 3 totals across all fee types",
    svt.includes("Tan Jia Hui") && svt.includes("S$"+expP.toFixed(2)) && svt.includes("S$"+expD.toFixed(2)) && svt.includes("S$"+expC.toFixed(2)));
r("stuToggle('C1');");
const sbe = dom.nodes["#stuFeesBody"].innerHTML;
chk("student fees: expansion groups components by fee type",
    sbe.includes("School Fees (Primary)") && sbe.includes("FT-01") && sbe.includes("Tuition Fee") &&
    sbe.includes("Supplementary Programme") && !sbe.includes("(Optional)") && sbe.includes("FT-02"));
chk("student fees: expansion shows paid info + subsidy per component",
    sbe.includes("PAY-0904-7712") && sbe.includes("− S$100.00"));
r("stuToggle('C1');");
chk("student fees: click again collapses the expansion", !dom.nodes["#stuFeesBody"].innerHTML.includes("Tuition Fee"));
const stuRowCount = s=>(s.match(/class="clickable" onclick="stuToggle\('/g)||[]).length;
chk("student fees: 16 Riverside students listed (mock data added)", stuRowCount(dom.nodes["#app"].innerHTML)===16);
r("state.admin.scope='Angsana Secondary School'; render();");
chk("student fees: 12 Angsana students listed (mock data added)", stuRowCount(dom.nodes["#app"].innerHTML)===12);
r("state.admin.scope='Riverside Primary School'; render();");

/* ---- 6. School fee catalogue (master module, school view) ---- */
r("nav('master');");
const fpv = dom.nodes["#app"].innerHTML;
chk("school fee catalogue: Phương án C callout removed", !fpv.includes("Phương án C"));
chk("catalogue: MOE-extracted and school-own fee types labelled distinctly",
    fpv.includes("MOE-extracted") && fpv.includes("<b>School fee</b>"));
chk("school fee catalogue: standardisation button removed", !fpv.includes("Request MOE standardisation"));
chk("planRequestStd removed from code", r("typeof planRequestStd") === "undefined");

/* origin concept fully removed: seed fees editable, no master badges/locks */
r("planEdit('FT-01');");
const em = dom.nodes["#modalHost"].innerHTML;
chk("edit seed fee: no master/school badges", !em.includes(">master</span>") && !em.includes(">school</span>"));
chk("edit seed fee: component names unlocked", !em.includes(" readonly"));
r("closeModal();");

r("state.feeMenuOpen=true; nav('master');");
const mv = dom.nodes["#app"].innerHTML;
chk("school master page: titled School fee catalogue", mv.includes("School fee catalogue") && !mv.includes("Master fee catalogue"));
chk("school master page: own fee cards + Edit, Assign shortcut removed",
    mv.includes("Edit fee") && !mv.includes("Assign →") && !mv.includes("gotoAssignFor") && mv.includes("Riverside Primary School"));
chk("gotoAssignFor removed from code", r("typeof gotoAssignFor") === "undefined");
chk("school master page: New school fee button", mv.includes("+ New school fee"));
chk("school master page: no catalogue/requests tabs", !mv.includes("National catalogue") && !mv.includes("Standardisation requests"));
let sb2 = dom.nodes["#sidebar"].innerHTML;
chk("school sidebar: 'School fee catalogue' label", sb2.includes("School fee catalogue") && !sb2.includes("Master catalogue"));
r("state.planLevelFilter='Primary 3'; render();");
const mv3 = dom.nodes["#app"].innerHTML;
const expCat = r("FEE_TYPES.filter(f=>f.school==='Riverside Primary School'&&(!f.level||f.level==='Primary 3')).length");
chk("school catalogue: level filter — all-level + matching-level fees only, other levels hidden",
    (mv3.match(/<div class="charge">/g)||[]).length===expCat && expCat>0 && !mv3.includes('b-purple">Primary 5</span>'));
r("state.planLevelFilter=''; render();");

/* HQ keeps its Master catalogue + Requests tabs */
r("state.admin=ADMIN_USERS.hq; state.feeMenuOpen=true; nav('master');");
const hmv = dom.nodes["#app"].innerHTML;
chk("HQ master page: Standardisation requests tab removed — single catalogue view",
    hmv.includes("Master fee catalogue") && !hmv.toLowerCase().includes("standardisation"));
chk("standardisation request machinery removed from code",
    r("typeof masterRequests")==="undefined" && r("typeof promoteApprove")==="undefined" && r("typeof promoteReject")==="undefined" && r("typeof PROMOTE_REQUESTS")==="undefined" && r("typeof PR_SEQ")==="undefined");
chk("HQ master page: mandatory tag removed — fee name shows only the level badge",
    !hmv.includes(">Mandatory<") && hmv.includes("badge b-purple") && hmv.includes("School Fees (Primary)"));
chk("HQ master page: MFT id tags hidden (flag, not deleted)",
    !hmv.includes(">MFT-0") && r("MASTER_SHOW_ID")===false);
chk("HQ master page: MFC component ids hidden", !hmv.includes(">MFC-0"));
chk("HQ master page: annotation under the fee name removed",
    !hmv.includes("Owner <b>MOE HQ</b>") && !hmv.includes("used by"));
chk("HQ master page: Option-C rationale notice removed",
    !hmv.includes("Why a national catalogue"));
chk("HQ master catalogue: school-type filter offered (All / Primary / Secondary)",
    hmv.includes("All fee types") && hmv.includes("Primary schools") && hmv.includes("Secondary schools"));
r("state.masterTypeFilter='Primary'; render();");
const mp = dom.nodes["#app"].innerHTML;
chk("HQ master catalogue: Primary filter shows Primary + All-levels types only",
    mp.includes("School Fees (Primary)") && mp.includes("Supplementary / Enrichment Programme") &&
    !mp.includes("School Fees (Secondary)") && !mp.includes("Skills Programme"));
r("state.masterTypeFilter='Secondary'; render();");
const ms = dom.nodes["#app"].innerHTML;
chk("HQ master catalogue: Secondary filter shows Secondary + All-levels types only",
    ms.includes("School Fees (Secondary)") && ms.includes("Skills Programme") &&
    ms.includes("Supplementary / Enrichment Programme") && !ms.includes("School Fees (Primary)"));
r("state.masterTypeFilter=''; render();");
chk("HQ sidebar: 'Master catalogue' label kept", dom.nodes["#sidebar"].innerHTML.includes("Master catalogue"));
r("masterEdit('MFT-03');");
const mm = dom.nodes["#modalHost"].innerHTML;
chk("master modal: Policy field removed — no mandatory UI, MFT id hidden in the header",
    !mm.includes("Policy") && !mm.includes(">Mandatory<") && !mm.includes("masterDraftSet('mandatory'") && !mm.includes("Edit master fee type —") && mm.includes("Edit master fee type"));
r("masterSave('MFT-03');");
chk("master modal: saving keeps MFT-03 mandatory (rule stays in the data)", r("MASTER_FEE_TYPES.find(m=>m.id==='MFT-03').mandatory")===true);
chk("master modal: Applies-to offers only Primary & Secondary",
    mm.includes(">Primary<") && mm.includes(">Secondary<") && !mm.includes(">All levels<") && !mm.includes(">Junior College<") && !mm.includes(">Kindergarten<"));
chk("master modal: snapshot notice removed", !mm.includes("Snapshots protect"));

/* assign dropdown marks mandatory MOE types */
r("state.admin=ADMIN_USERS.school; state.assign={school:'Riverside Primary School',level:'',term:'',moeIds:[],schIds:[],comps:{},result:null}; nav('assign');");
chk("assign: mandatory MOE types marked in dropdown", dom.nodes["#app"].innerHTML.includes("School Fees (Primary)"));
r("state.admin=ADMIN_USERS.hq; masterEdit(''); masterDraftSet('name','Mandatory Check Type'); masterDraftSet('levelScope','Primary'); masterCompSet(0,'name','Comp M'); masterCompSet(0,'amount','9'); masterSave('');");
chk("master modal: a newly created MOE fee type is mandatory by default", r("MASTER_FEE_TYPES[MASTER_FEE_TYPES.length-1].mandatory")===true);

/* ---- 6b. Top-up picker search is fuzzy (every search bar now fuzzy) ---- */
r("state.topupPick='Tan Ji Hui';");
chk("top-up picker: fuzzy search — non-contiguous tokens still find the account",
    r("topupCands().some(s=>s.id==='C1')")===true);
r("state.topupPick='zzz qqq';");
chk("top-up picker: nonsense query matches nothing", r("topupCands().length")===0);
r("state.topupPick='ea-2017-0012';");
chk("top-up picker: partial account number matches", r("topupCands().some(s=>s.id==='C1')")===true);
r("state.topupPick='';");

/* ---- 6. view-only demo role removed ---- */
r("state.admin=null; render();");
const lg = dom.nodes["#app"].innerHTML;
chk("login: view-only role removed", !lg.includes("Nurul") && !lg.includes("doAdminLogin('viewer')") && !lg.includes("School User (view-only)"));
chk("login: MOE HQ + School roles remain", lg.includes("MOE HQ User") && lg.includes("doAdminLogin('school')"));
chk("ADMIN_USERS has no viewer entry", r("typeof ADMIN_USERS.viewer") === "undefined");
r("doAdminLogin('school');");
chk("school login: Fee dashboard tab is the default", r("state.feeTab")==="dash");

process.exitCode = pass ? 0 : 1;
console.log(pass ? "ALL OK" : "FAILURES");
