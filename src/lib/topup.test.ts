import { describe, expect, test } from "vitest";
import { parseAmount } from "./amount";
import { conditionText, eligibleAccounts, eligibleForRule, matchesCondition, nextRuleId, retryableAccounts, targetLabel, totalFunds, transactionCode, type TopUpRule } from "./topup";
import { initialRegistry } from "../data/registryStore";
import { FUND_RULES, type Account, type Condition, type Transaction } from "../data/topup";
import { accountsOf } from "./accounts";

const reg = initialRegistry();
const ACCOUNTS = accountsOf(reg.students, reg.classes, reg.schools, { debits: {}, credits: {} });

const acc = (id: string, o: Partial<Account> = {}): Account => ({ id, nric: `T${id}`, name: id, school: "Riverbank Primary School", class: "P4 Courage", age: 10, citizen: true, enrolled: true, schooling: "Active", status: "Active", balance: 100, ...o });
const rule: TopUpRule = { ageMin: 7, ageMax: 12, citizenOnly: false, enrolledOnly: false, balanceMin: 0, balanceMax: 500 };
const ids = (r: Account[]) => r.map((a) => a.id);

describe("eligibleAccounts", () => {
  test("excludes ages outside the range, bounds inclusive", () => {
    const list = [acc("young", { age: 6 }), acc("min", { age: 7 }), acc("max", { age: 12 }), acc("old", { age: 13 })];
    expect(ids(eligibleAccounts(rule, list))).toEqual(["min", "max"]);
  });
  test("citizenOnly excludes non-citizens; ignored when off", () => {
    const list = [acc("c"), acc("n", { citizen: false })];
    expect(ids(eligibleAccounts({ ...rule, citizenOnly: true }, list))).toEqual(["c"]);
    expect(ids(eligibleAccounts(rule, list))).toEqual(["c", "n"]);
  });
  test("enrolledOnly excludes non-enrolled; ignored when off", () => {
    const list = [acc("e"), acc("x", { enrolled: false })];
    expect(ids(eligibleAccounts({ ...rule, enrolledOnly: true }, list))).toEqual(["e"]);
    expect(ids(eligibleAccounts(rule, list))).toEqual(["e", "x"]);
  });
  test("excludes balances outside the range, bounds inclusive", () => {
    const list = [acc("lo", { balance: 49.99 }), acc("min", { balance: 50 }), acc("max", { balance: 500 }), acc("hi", { balance: 500.01 })];
    expect(ids(eligibleAccounts({ ...rule, balanceMin: 50 }, list))).toEqual(["min", "max"]);
  });
  test("returns [] when nothing matches, and for empty input", () => {
    expect(eligibleAccounts({ ...rule, ageMin: 40, ageMax: 50 }, [acc("a")])).toEqual([]);
    expect(eligibleAccounts(rule, [])).toEqual([]);
  });
  test("inverted ranges match nothing", () => {
    expect(eligibleAccounts({ ...rule, ageMin: 12, ageMax: 7 }, [acc("a")])).toEqual([]);
  });
  test("citizenOnly and enrolledOnly together require both", () => {
    const list = [acc("both"), acc("nc", { citizen: false }), acc("ne", { enrolled: false }), acc("neither", { citizen: false, enrolled: false })];
    expect(ids(eligibleAccounts({ ...rule, citizenOnly: true, enrolledOnly: true }, list))).toEqual(["both"]);
  });
  test("does not mutate the input array", () => {
    const list = [acc("b", { age: 99 }), acc("a")];
    const copy = [...list];
    eligibleAccounts(rule, list);
    expect(list).toEqual(copy);
  });
});

test("mock accounts are aged 7 to 16 only (Req 1)", () => {
  const ages = ACCOUNTS.map((a) => a.age);
  expect(Math.min(...ages)).toBe(7);
  expect(Math.max(...ages)).toBe(16);
});

describe("totalFunds", () => {
  test("is exact in cents where float math drifts", () => {
    expect(0.1 * 3).not.toBe(0.3); // the bug this guards against
    expect(totalFunds(3, 0.1)).toBe(0.3);
    expect(totalFunds(7, 0.07)).toBe(0.49);
    expect(totalFunds(19, 200)).toBe(3800);
  });
  test("zero count gives zero", () => {
    expect(totalFunds(0, 200)).toBe(0);
  });
  test("handles a huge count", () => {
    expect(totalFunds(1_000_000, 1234567.89)).toBe(1234567890000);
    expect(totalFunds(1_000_000, 0.1)).toBe(100000);
  });
  test("a 3-decimal amount is rejected upstream by parseAmount", () => {
    expect(parseAmount("10.005")).toHaveProperty("error");
  });
});

describe("eligibleForRule", () => {
  const r = { conditions: [{ type: "range", min: 7, max: 12 }] as Condition[], minBalance: 100, maxBalance: 500, schooling: "Active" as const, schools: ["Riverbank Primary School"] };
  test("balance in [min, max); age inclusive; school must match", () => {
    const list = [acc("min", { balance: 100 }), acc("lo", { balance: 99.99 }), acc("eq", { balance: 500 }), acc("ok", { balance: 499.99 }), acc("old", { age: 13 }), acc("other", { school: "Elsewhere" })];
    expect(ids(eligibleForRule(r, list))).toEqual(["min", "ok"]);
  });
  test("closed accounts and other schooling statuses are excluded; no schools means all schools", () => {
    const list = [acc("closed", { status: "Closed" }), acc("gone", { schooling: "Inactive" }), acc("ok")];
    expect(ids(eligibleForRule(r, list))).toEqual(["ok"]);
    expect(ids(eligibleForRule({ ...r, schools: [] }, [acc("a", { school: "Elsewhere" }), acc("c", { status: "Closed" })]))).toEqual(["a"]);
  });
});

describe("rule conditions", () => {
  const base = { minBalance: 0, maxBalance: 500, schooling: "Active" as const, schools: [] as string[] };
  const list = [acc("a7", { age: 7, class: "P1 Joy" }), acc("a8", { age: 8, class: "P2 Joy" }), acc("a9", { age: 9, class: "P3 Joy" }), acc("a12", { age: 12, class: "P6 Joy" })];
  test("specific ages match only the listed ages (7 and 9, not 8)", () => {
    expect(ids(eligibleForRule({ ...base, conditions: [{ type: "age", age: 7 }, { type: "age", age: 9 }] }, list))).toEqual(["a7", "a9"]);
  });
  test("levels match the level of the student's class", () => {
    expect(ids(eligibleForRule({ ...base, conditions: [{ type: "level", level: "P1" }, { type: "level", level: "P6" }] }, list))).toEqual(["a7", "a12"]);
    expect(matchesCondition({ type: "level", level: "Sec 1" }, acc("x", { class: "Sec 1 Aspire" }))).toBe(true);
  });
  test("combined conditions are alternatives: an account needs to match only one", () => {
    expect(ids(eligibleForRule({ ...base, conditions: [{ type: "range", min: 7, max: 8 }, { type: "age", age: 12 }] }, list))).toEqual(["a7", "a8", "a12"]);
  });
  test("a rule with no conditions matches nobody", () => {
    expect(eligibleForRule({ ...base, conditions: [] }, list)).toEqual([]);
  });
  test("labels", () => {
    expect(conditionText({ type: "range", min: 7, max: 12 })).toBe("Age 7–12");
    expect(targetLabel({ mode: "mixed", conditions: [{ type: "range", min: 7, max: 10 }, { type: "age", age: 12 }, { type: "level", level: "P1" }] })).toBe("Age Range + Specific Age + Level");
    expect(targetLabel({ mode: "ages", conditions: [] })).toBe("Specific Ages");
  });
});

describe("retryableAccounts", () => {
  const tx = (o: Partial<Transaction>): Transaction => ({ ref: "TUT151026", type: "Single", recipient: "x", detail: "x", date: "2026-10-15", schedule: "Run now (ad-hoc)", accounts: 3, amount: 100, status: "Partial Success", by: "Daniel Lee", ...o });
  const accts = [acc("ok"), acc("later"), acc("closed", { status: "Closed" }), acc("fine")];
  const origin = tx({ targets: [{ student: "ok", account: "Tok", status: "Failed" }, { student: "later", account: "Tlater", status: "Failed" }, { student: "closed", account: "Tclosed", status: "Failed" }, { student: "fine", account: "Tfine", status: "Success" }] });
  test("only failed accounts that are Active can be retried", () => {
    expect(ids(retryableAccounts(origin, "SPE151026001", [origin], accts))).toEqual(["ok", "later"]);
  });
  test("an account already credited by a follow-up is not offered again; a failed follow-up does not count", () => {
    const paid = tx({ followupOf: "SPE151026001", targets: [{ student: "ok", account: "Tok", status: "Success" }] });
    const failedAgain = tx({ followupOf: "SPE151026001", targets: [{ student: "later", account: "Tlater", status: "Failed" }] });
    expect(ids(retryableAccounts(origin, "SPE151026001", [paid, failedAgain, origin], accts))).toEqual(["later"]);
  });
});

test("nextRuleId continues from the highest id", () => expect(nextRuleId(FUND_RULES)).toBe("TUR01004"));
test("transactionCode is TUT + DDMMYY", () => {
  expect(transactionCode("2026-11-03")).toBe("TUT031126");
  expect(transactionCode("")).toBe("TUT000000");
});
