/* =====================================================================
   SIT — Requirement 5 (offline / paper FAS loop) across BOTH portals
   Parent prepares a prefilled offline form (reference code) in the
   e-Service Portal → school retrieves it by code / NRIC / name in the
   Admin Portal → verifies against the printed form → registers FAS.
   Run:  node sit-r5.js
   ===================================================================== */
const fs = require("fs");
const vm = require("vm");

let PASS = 0, FAIL = 0;
function T(id, name, ok){
  console.log((ok ? "PASS" : "FAIL") + " | " + id + " | " + name);
  ok ? PASS++ : FAIL++;
}

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
const timers = { setTimeout:(fn)=>{ fn(); return 1; }, setInterval:(fn)=>{ fn(); return 1; }, clearTimeout(){}, clearInterval(){} };

function boot(file){
  const js = fs.readFileSync(file, "utf8").split("<script>")[1].split("</script>")[0];
  const dom = makeDom();
  const ctx = vm.createContext({ document: dom.document, console, process, window:{ scrollTo(){}, print(){} }, ...timers });
  vm.runInContext(js, ctx);
  return { ctx, dom };
}

const P = boot("D:/MaivenPoint/eservice-portal-parent.html");
const A = boot("D:/MaivenPoint/admin-portal-moe.html");
const pr = (code) => vm.runInContext(code, P.ctx);
const ad = (code) => vm.runInContext(code, A.ctx);

/* ---- C1 first, before any runtime mutation: seed parity across portals ---- */
T("SIT-R5-C1", "Offline-form seed record identical in both portals",
  pr(`JSON.stringify(OFFLINE_FORMS[0])`) === ad(`JSON.stringify(OFFLINE_FORMS[0])`));

/* ================= PHASE P — parent prepares the offline form ================= */
pr(`spStart(); spApp(); spVerify(document.createElement('div'));`);
T("SIT-R5-P1", "Parent logged in; FAS screen offers the offline (paper) path",
  pr(`state.parent.nric==="S7234567A" && (nav('fas'), document.querySelector('#app').innerHTML.includes("Apply offline instead (R5)"))`));

pr(`offlineOpen();`);
T("SIT-R5-P2a", "Offline form generated with a reference code and 'Awaiting school collection' status",
  pr(`OFFLINE_FORMS.length===2 && /^OFF-2026-\\d{4}$/.test(OFFLINE_FORMS[1].code) && OFFLINE_FORMS[1].status==="Awaiting school collection" && OFFLINE_FORMS[1].nric==="S7234567A"`));
T("SIT-R5-P2b", "Prefilled form lists only children WITH an Education Account (no Tan Xiao Mei)",
  pr(`OFFLINE_FORMS[1].children.includes("Tan Jia Hui") && OFFLINE_FORMS[1].children.includes("Tan Jun Kai") && !OFFLINE_FORMS[1].children.includes("Tan Xiao Mei")`));
T("SIT-R5-P2c", "Printable form shown with the code, blank-by-hand fields, signature line and Print/PDF action",
  pr(`(function(){ var h=document.querySelector('#modalHost').innerHTML, c=OFFLINE_FORMS[1].code;
        return h.includes(c) && h.includes("Offline Application Form") && h.includes("Signature:") && h.includes("Print / Save as PDF") && h.includes("nothing to fill in"); })()`));
pr(`closeModal();`);

/* ================= PHASE A — school retrieves & registers ================= */
ad(`doAdminLogin('school'); state.fasTab='paper'; state.mod='fas'; render();`);
T("SIT-R5-A1", "School user sees the offline retrieval card on the Offline & hardcopy tab",
  ad(`document.querySelector('#app').innerHTML.includes("Retrieve an offline (paper) form")`));

ad(`state.offlineQ="OFF-2026-0731";`);
T("SIT-R5-A2a", "Retrieval by exact code returns the declared details + income bands (verify view)",
  ad(`offlineResult().includes("Siti Rahayu") && offlineResult().includes("S7555001F") && offlineResult().includes("ranges only, retrieved by NRIC") && offlineResult().includes("FAS-2026-0113")`));

ad(`state.offlineQ="OFF-206-0731";`);
T("SIT-R5-A2b", "Retrieval is fuzzy — a mistyped code still finds the form",
  ad(`offlineResult().includes("Siti Rahayu")`));

ad(`state.offlineQ="OFF-9999-0000";`);
T("SIT-R5-A3", "Unknown code gives a clear fallback message (manual entry still available)",
  ad(`offlineResult().includes("No offline form matches")`));

ad(`
  sbfasDecline('FAS-2026-0113');                      /* clear the queue first so the re-registration is not a duplicate */
  document.querySelector('#sbReason').value="Household income above school threshold";
  sbfasDoDecline('FAS-2026-0113');
  state.offlineQ="OFF-2026-0731";
  offlineUseForm("OFF-2026-0731");
  hardcopySave();
`);
T("SIT-R5-A4a", "'Use for FAS registration' fills the entry form from the retrieved data (no re-keying)",
  ad(`state.offlineUsed===null && FAS_APPS[0].nric==="S7555001F" && FAS_APPS[0].channel==="Paper" && FAS_APPS[0].school==="Riverside Primary School"`));
T("SIT-R5-A4b", "Registered application runs the same assessment; the offline form is marked collected with the new FAS reference",
  ad(`(FAS_APPS[0].status==="MOEFAS granted") && /^Collected by school — registered as FAS-2026-/.test(OFFLINE_FORMS[0].status) && OFFLINE_FORMS[0].collectedOn===TODAY`));

T("SIT-R5-A5", "HQ users don't get the school offline intake (school-only function per R5)",
  ad(`doAdminLogin('hq'); state.mod='fas'; render(); !document.querySelector('#app').innerHTML.includes("Retrieve an offline (paper) form")`));

console.log("\nRESULT: " + PASS + " passed, " + FAIL + " failed, " + (PASS+FAIL) + " total");
process.exit(FAIL ? 1 : 0);
