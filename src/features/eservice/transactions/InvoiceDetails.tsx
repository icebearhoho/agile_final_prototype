import { Badge } from "../../../components/ui/Badge";
import { Modal } from "../../../components/ui/Modal";
import type { Child } from "../../../data/parent";
import type { Charge } from "../../../data/fees";
import { balanceOf, chargeStatus, componentBalances } from "../../../lib/fees";
import { formatSGD } from "../../../lib/format";
import { fmtDate } from "../overview/shared";

const cents = (n: number) => Math.round(n * 100) / 100;

/** Per fee item: amount, FAS subsidy, what is paid and what is still owed (payments for one item count against that item only). */
export function componentLines(c: Charge) {
  const left = componentBalances(c);
  return c.components.map((x, k) => {
    const subsidy = Math.min(x.subsidy ?? 0, x.amount);
    const outstanding = left[k].amount;
    return { name: x.name, amount: x.amount, subsidy, paid: cents(x.amount - subsidy - outstanding), outstanding };
  });
}

type Props = { charge: Charge | null; child?: Child; klass?: string; onClose: () => void };

export function InvoiceDetails({ charge, child, klass, onClose }: Props) {
  const status = charge ? chargeStatus(charge) : "paid";
  return (
    <Modal open={charge !== null} onClose={onClose} title="Invoice details" wide>
      {charge && (
        <div className="text-on-surface">
          <div className="flex flex-wrap items-start justify-between gap-4 border-b border-line pb-5">
            <div>
              <p className="text-lg font-bold">Ministry of Education</p>
              <p className="text-on-surface-variant">Singapore · Education Account & FAS</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">Invoice</p>
              <p className="font-mono text-on-surface-variant">{charge.id}</p>
              <span className="mt-1 inline-block"><Badge tone={status === "paid" ? "success" : status === "overdue" ? "alert" : "neutral"}>{status === "paid" ? "Paid" : status === "overdue" ? "Overdue" : "Unpaid"}</Badge></span>
            </div>
          </div>
          <div className="flex flex-wrap justify-between gap-4 border-b border-line py-5">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-on-surface-variant">Bill to</p>
              <p className="mt-1 font-semibold">Parent/Guardian of {child?.name}</p>
              <p className="text-on-surface-variant">{child?.school}</p>
              <p className="text-on-surface-variant">{child?.level}{klass ? ` · ${klass}` : ""}</p>
            </div>
            <dl className="grid grid-cols-[auto_auto] gap-x-6 gap-y-2">
              <dt className="text-on-surface-variant">Bill date</dt><dd className="text-right font-semibold">{fmtDate(charge.issued)}</dd>
              <dt className="text-on-surface-variant">Due date</dt><dd className="text-right font-semibold">{fmtDate(charge.due)}</dd>
            </dl>
          </div>
          <h3 className="mt-5 font-semibold">Details of charges</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead className="border-b border-line text-[13px] text-on-surface-variant">
                <tr><th className="pb-2 font-medium">Item</th><th className="pb-2 text-right font-medium">Amount</th><th className="pb-2 text-right font-medium">Subsidy</th><th className="pb-2 text-right font-medium">Paid</th><th className="pb-2 text-right font-medium">Outstanding</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                <tr className="bg-surface-container-low font-semibold"><td className="px-2 py-2.5 uppercase" colSpan={4}>{child?.school}</td><td className="px-2 py-2.5 text-right tabular-nums">{formatSGD(balanceOf(charge))}</td></tr>
                <tr><td className="px-2 pt-3 font-semibold" colSpan={5}>{charge.title}</td></tr>
                {componentLines(charge).map((l) => (
                  <tr key={l.name} className="tabular-nums">
                    <td className="py-2.5 pl-5">{l.name}</td>
                    <td className="py-2.5 text-right">{formatSGD(l.amount)}</td>
                    <td className="py-2.5 text-right">{l.subsidy ? `-${formatSGD(l.subsidy)}` : "—"}</td>
                    <td className="py-2.5 text-right">{l.paid ? `-${formatSGD(l.paid)}` : "—"}</td>
                    <td className="py-2.5 text-right">{formatSGD(l.outstanding)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {charge.payments.length > 0 && (
            <>
              <h3 className="mt-5 font-semibold">Payments</h3>
              <ul className="mt-2 divide-y divide-line">
                {charge.payments.map((p) => (
                  <li key={p.id} className="flex justify-between gap-3 py-2"><span>{fmtDate(p.on)} · {p.method}</span><span className="tabular-nums">{formatSGD(p.amount)}</span></li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </Modal>
  );
}
