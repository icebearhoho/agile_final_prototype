export const LEVELS = ["P1", "P2", "P3", "P4", "P5", "P6", "Sec 1", "Sec 2", "Sec 3", "Sec 4"] as const;
export type Level = (typeof LEVELS)[number];
export const STATUSES = ["Enrolled", "Not Enrolled"] as const;
export type StudentStatus = (typeof STATUSES)[number];
export type SbfasStatus = "Approved" | "Pending" | "Rejected" | "Not applied";

export type Student = {
  id: string;
  name: string;
  level: Level;
  class: string;
  status: StudentStatus;
  /** Education Account balance in SGD. */
  balance: number;
  sbfas: SbfasStatus;
  /** MOE-level FAS status. A student never receives both schemes: MOEFAS takes precedence over SBFAS (see lib/fees.fasOf). */
  moefas: SbfasStatus;
};

/** Classes offered by this (mock) school, two per level. */
export const CLASSES: Record<Level, [string, string]> = {
  P1: ["P1 Courage", "P1 Harmony"],
  P2: ["P2 Integrity", "P2 Respect"],
  P3: ["P3 Care", "P3 Resilience"],
  P4: ["P4 Courage", "P4 Harmony"],
  P5: ["P5 Integrity", "P5 Respect"],
  P6: ["P6 Care", "P6 Resilience"],
  "Sec 1": ["Sec 1 Aspire", "Sec 1 Bright"],
  "Sec 2": ["Sec 2 Aspire", "Sec 2 Bright"],
  "Sec 3": ["Sec 3 Aspire", "Sec 3 Bright"],
  "Sec 4": ["Sec 4 Aspire", "Sec 4 Bright"],
};

// [name, level, class index (0|1), status, balance, sbfas, moefas]
// Exclusivity: no student has both schemes Approved — MOEFAS winners carry sbfas "Not applied".
type Row = [string, Level, 0 | 1, StudentStatus, number, SbfasStatus, SbfasStatus];
const ROWS: Row[] = [
  ["Tan Wei Jie", "P1", 0, "Enrolled", 214.35, "Not applied", "Approved"],
  ["Nur Aisyah binte Rahman", "P1", 1, "Enrolled", 187.9, "Approved", "Not applied"],
  ["Lim Xin Yi", "P1", 1, "Enrolled", 242.6, "Not applied", "Not applied"],
  ["Arjun s/o Krishnan", "P2", 0, "Enrolled", 538.15, "Pending", "Not applied"],
  ["Chua Jia Hui", "P2", 1, "Enrolled", 612.4, "Not applied", "Not applied"],
  ["Muhammad Irfan bin Hakim", "P2", 1, "Not Enrolled", 497.85, "Approved", "Not applied"],
  ["Meera d/o Ramasamy", "P2", 0, "Enrolled", 574.5, "Pending", "Not applied"],
  ["Ong Zi Han", "P3", 0, "Enrolled", 1043.2, "Not applied", "Not applied"],
  ["Priya d/o Subramaniam", "P3", 0, "Enrolled", 986.75, "Not applied", "Approved"],
  ["Ethan Teo Kai Ming", "P3", 1, "Enrolled", 1127.05, "Not applied", "Not applied"],
  ["Siti Nurhaliza binte Osman", "P3", 1, "Enrolled", 902.3, "Pending", "Not applied"],
  ["Goh Yu Xuan", "P4", 0, "Enrolled", 1568.9, "Not applied", "Not applied"],
  ["Rohan s/o Pillai", "P4", 0, "Enrolled", 1493.45, "Rejected", "Not applied"],
  ["Chloe Wong Shu Ting", "P4", 1, "Not Enrolled", 1604.1, "Not applied", "Not applied"],
  ["Haziq bin Abdullah", "P4", 1, "Enrolled", 1431.6, "Not applied", "Approved"],
  ["Sim Hui Min", "P5", 0, "Enrolled", 2036.55, "Not applied", "Not applied"],
  ["Daniel Koh Jun Wei", "P5", 0, "Enrolled", 1978.2, "Not applied", "Not applied"],
  ["Kavitha d/o Raman", "P5", 1, "Enrolled", 2112.8, "Approved", "Not applied"],
  ["Aqil Zafran bin Salleh", "P5", 1, "Not Enrolled", 1895.35, "Pending", "Not applied"],
  ["Yeo Rui En", "P6", 0, "Enrolled", 2587.9, "Not applied", "Not applied"],
  ["Isabelle Ng Pei Shan", "P6", 0, "Enrolled", 2641.15, "Not applied", "Not applied"],
  ["Vikram s/o Chandran", "P6", 1, "Enrolled", 2503.7, "Approved", "Not applied"],
  ["Nurul Huda binte Ismail", "P6", 1, "Enrolled", 2469.25, "Approved", "Not applied"],
  ["Lee Zhi Hao", "P6", 1, "Not Enrolled", 2552.0, "Not applied", "Not applied"],
  ["Tay Jing Wen", "Sec 1", 0, "Enrolled", 3014.6, "Not applied", "Not applied"],
  ["Mohamed Danish bin Yusof", "Sec 1", 0, "Enrolled", 2947.85, "Pending", "Pending"],
  ["Shreya d/o Nair", "Sec 1", 1, "Enrolled", 3086.3, "Not applied", "Not applied"],
  ["Jonathan Lau Kai Xiang", "Sec 1", 1, "Enrolled", 2993.4, "Approved", "Not applied"],
  ["Foo Mei Ling", "Sec 2", 0, "Enrolled", 3512.75, "Not applied", "Not applied"],
  ["Adrian Pereira", "Sec 2", 0, "Enrolled", 3468.1, "Not applied", "Not applied"],
  ["Nadia binte Jamal", "Sec 2", 1, "Not Enrolled", 3395.9, "Approved", "Not applied"],
  ["Kwok Yong Sheng", "Sec 2", 1, "Enrolled", 3541.25, "Rejected", "Not applied"],
  ["Rachel Chia Wen Hui", "Sec 3", 0, "Enrolled", 3987.45, "Not applied", "Not applied"],
  ["Imran Shah bin Zulkifli", "Sec 3", 0, "Enrolled", 3921.0, "Approved", "Not applied"],
  ["Deepa d/o Govindasamy", "Sec 3", 1, "Enrolled", 4058.7, "Pending", "Not applied"],
  ["Marcus Heng Zhe Yu", "Sec 3", 1, "Enrolled", 3874.15, "Not applied", "Not applied"],
  ["Ang Li Ying", "Sec 4", 0, "Enrolled", 4436.85, "Not applied", "Not applied"],
  ["Farhan bin Ahmad", "Sec 4", 0, "Enrolled", 4379.3, "Not applied", "Approved"],
  ["Bernice Seah Xin Rong", "Sec 4", 1, "Enrolled", 4502.6, "Not applied", "Not applied"],
  ["Joel Soh Wen Jie", "Sec 4", 1, "Not Enrolled", 4418.95, "Not applied", "Not applied"],
];

// Ordered by name (a visible column), not by level/class, so the list does not look sorted by hidden fields.
export const STUDENTS: Student[] = [...ROWS].sort((a, b) => a[0].localeCompare(b[0])).map(([name, level, c, status, balance, sbfas, moefas], i) => ({
  id: `S2026${String(i + 1).padStart(4, "0")}`,
  name,
  level,
  class: CLASSES[level][c],
  status,
  balance,
  sbfas,
  moefas,
}));

/** Existing Education Accounts (created by MOE at age 7) that are not yet assigned to this school. */
export type UnassignedAccount = { id: string; name: string; balance: number };
export const UNASSIGNED_ACCOUNTS: UnassignedAccount[] = [
  { id: "S20260101", name: "Wong Jia Wen", balance: 120.5 },
  { id: "S20260102", name: "Abdul Hakim bin Omar", balance: 845.0 },
  { id: "S20260103", name: "Devi d/o Muthu", balance: 1320.25 },
  { id: "S20260104", name: "Lucas Ho Zhi Kai", balance: 2210.8 },
  { id: "S20260105", name: "Siew Ling Tan", balance: 3105.4 },
];
