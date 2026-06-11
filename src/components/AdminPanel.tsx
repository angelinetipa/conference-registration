"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { EVENT_CERT_LABELS } from "@/lib/constants";
import { StatusBadge } from "@/components/StatusBadge";

type AdminView = "event-payments" | "membership-payments" | "certificates" | null;

type EventPayment = {
  id: string;
  transactionNo: string;
  amount: string;
  status: string;
  payeeName: string | null;
  registration: { attendeeName: string; qrCode: string };
  createdAt: string;
  reviewedAt: string | null;
};

type MemPayment = {
  id: string;
  transactionNo: string;
  amount: string;
  status: string;
  isRenewal: boolean;
  membership: { memberId: string };
  createdAt: string;
  reviewedAt: string | null;
};

type Cert = {
  id: string;
  type: keyof typeof EVENT_CERT_LABELS;
  status: string;
  recipientName: string;
  paperTitle: string | null;
  createdAt: string;
  updatedAt: string;
  issuedAt: string | null;
};

function formatDate(value: string | null) {
  if (!value) return "Not yet reviewed";
  return new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function AdminPanel({
  eventPayments,
  membershipPayments,
  certificates,
}: {
  eventPayments: EventPayment[];
  membershipPayments: MemPayment[];
  certificates: Cert[];
}) {
  const [msg, setMsg] = useState("");
  const [view, setView] = useState<AdminView>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const router = useRouter();

  const eventPending = eventPayments.filter((payment) => payment.status === "PENDING");
  const eventApproved = eventPayments.filter((payment) => payment.status === "APPROVED");
  const eventRejected = eventPayments.filter((payment) => payment.status === "REJECTED");
  const membershipPending = membershipPayments.filter((payment) => payment.status === "PENDING");
  const membershipApproved = membershipPayments.filter((payment) => payment.status === "APPROVED");
  const membershipRejected = membershipPayments.filter((payment) => payment.status === "REJECTED");

  const groupedCertificates = useMemo(
    () => ({
      pending: certificates.filter((certificate) => certificate.status === "PENDING"),
      approved: certificates.filter((certificate) => certificate.status === "APPROVED"),
      issued: certificates.filter((certificate) => certificate.status === "ISSUED"),
      rejected: certificates.filter((certificate) => certificate.status === "REJECTED"),
    }),
    [certificates],
  );

  async function reviewPayment(
    id: string,
    action: "approve" | "reject",
    kind: "event" | "membership",
  ) {
    const actionKey = `${kind}-${id}-${action}`;
    setPendingAction(actionKey);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/payments/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, kind }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? `Failed to ${action} payment`);
      } else {
        setMsg(`${kind} payment ${action}d.`);
        router.refresh();
      }
    } finally {
      setPendingAction(null);
    }
  }

  async function reviewCert(id: string, action: "approve" | "reject") {
    const actionKey = `certificate-${id}-${action}`;
    setPendingAction(actionKey);
    setMsg("");
    try {
      const res = await fetch(`/api/admin/certificates/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Certificate update failed.");
        return;
      }
      setMsg(action === "approve" ? "Certificate approved and issued." : "Certificate rejected.");
      router.refresh();
    } finally {
      setPendingAction(null);
    }
  }

  return (
    <div className="space-y-8">
      {msg && (
        <div className="dashboard-card border-indigo-100 bg-indigo-50 p-4 text-sm font-bold text-indigo-800">
          {msg}
        </div>
      )}

      {!view && (
        <section className="grid gap-5 lg:grid-cols-3">
          <AdminChoice
            title="Event Payment Logs"
            description="Review event registration payments by pending, approved, and rejected status."
            count={eventPayments.length}
            onClick={() => setView("event-payments")}
          />
          <AdminChoice
            title="Membership Payment Logs"
            description="Review membership applications and renewal payments."
            count={membershipPayments.length}
            onClick={() => setView("membership-payments")}
          />
          <AdminChoice
            title="Certificate Logs"
            description="Approve, issue, and audit certificate requests."
            count={certificates.length}
            onClick={() => setView("certificates")}
          />
        </section>
      )}

      {view && (
        <button
          type="button"
          className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-600"
          onClick={() => setView(null)}
        >
          Back to admin options
        </button>
      )}

      {view === "event-payments" && (
        <div className="space-y-6">
          <PaymentGroup title="Pending event payments" payments={eventPending} kind="event" onReview={reviewPayment} pendingAction={pendingAction} />
          <PaymentGroup title="Approved event payments" payments={eventApproved} kind="event" onReview={reviewPayment} pendingAction={pendingAction} />
          <PaymentGroup title="Rejected event payments" payments={eventRejected} kind="event" onReview={reviewPayment} pendingAction={pendingAction} />
        </div>
      )}

      {view === "membership-payments" && (
        <div className="space-y-6">
          <PaymentGroup title="Pending membership payments" payments={membershipPending} kind="membership" onReview={reviewPayment} pendingAction={pendingAction} />
          <PaymentGroup title="Approved membership payments" payments={membershipApproved} kind="membership" onReview={reviewPayment} pendingAction={pendingAction} />
          <PaymentGroup title="Rejected membership payments" payments={membershipRejected} kind="membership" onReview={reviewPayment} pendingAction={pendingAction} />
        </div>
      )}

      {view === "certificates" && (
        <div className="space-y-6">
          <CertificateGroup title="Pending certificates" certificates={groupedCertificates.pending} onReview={reviewCert} pendingAction={pendingAction} />
          <CertificateGroup title="Approved certificates" certificates={groupedCertificates.approved} onReview={reviewCert} pendingAction={pendingAction} />
          <CertificateGroup title="Issued certificates" certificates={groupedCertificates.issued} onReview={reviewCert} pendingAction={pendingAction} />
          <CertificateGroup title="Rejected certificates" certificates={groupedCertificates.rejected} onReview={reviewCert} pendingAction={pendingAction} />
        </div>
      )}
    </div>
  );
}

function AdminChoice({
  title,
  description,
  count,
  onClick,
}: {
  title: string;
  description: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button type="button" className="dashboard-card dashboard-action-card p-5 text-left" onClick={onClick}>
      <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-black uppercase text-indigo-600">
        {count} records
      </span>
      <h2 className="mt-5 text-xl font-black text-slate-950">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-slate-600">{description}</p>
      <p className="mt-5 text-sm font-black text-indigo-600">Open logs -&gt;</p>
    </button>
  );
}

function PaymentGroup({
  title,
  payments,
  kind,
  onReview,
  pendingAction,
}: {
  title: string;
  payments: Array<EventPayment | MemPayment>;
  kind: "event" | "membership";
  onReview: (id: string, action: "approve" | "reject", kind: "event" | "membership") => void;
  pendingAction: string | null;
}) {
  return (
    <section className="dashboard-card p-5 md:p-6">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <div className="mt-5 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-xs uppercase text-slate-500">
            <tr>
              <th className="py-3 pr-4">Name / ID</th>
              <th className="py-3 pr-4">Transaction</th>
              <th className="py-3 pr-4">Amount</th>
              <th className="py-3 pr-4">Submitted</th>
              <th className="py-3 pr-4">Reviewed</th>
              <th className="py-3 pr-4">Status</th>
              <th className="py-3 pr-4">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {payments.map((payment) => {
              const eventPayment = payment as EventPayment;
              const membershipPayment = payment as MemPayment;
              return (
                <tr key={payment.id}>
                  <td className="py-3 pr-4 font-bold text-slate-900">
                    {kind === "event" ? eventPayment.registration.attendeeName : membershipPayment.membership.memberId}
                  </td>
                  <td className="py-3 pr-4 text-slate-600">{payment.transactionNo}</td>
                  <td className="py-3 pr-4 text-slate-600">PHP {payment.amount}</td>
                  <td className="py-3 pr-4 text-slate-500">{formatDate(payment.createdAt)}</td>
                  <td className="py-3 pr-4 text-slate-500">{formatDate(payment.reviewedAt)}</td>
                  <td className="py-3 pr-4"><StatusBadge status={payment.status} /></td>
                  <td className="py-3 pr-4">
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={`/api/payments/proof/${payment.id}?kind=${kind}`}
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700"
                      >
                        View proof
                      </a>
                      {payment.status === "PENDING" && (
                        <>
                          <button
                            type="button"
                            className="btn-primary px-3 py-2 text-xs"
                            disabled={pendingAction !== null}
                            onClick={() => onReview(payment.id, "approve", kind)}
                          >
                            {pendingAction === `${kind}-${payment.id}-approve` ? "Approving..." : "Approve"}
                          </button>
                          <button
                            type="button"
                            className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
                            disabled={pendingAction !== null}
                            onClick={() => onReview(payment.id, "reject", kind)}
                          >
                            {pendingAction === `${kind}-${payment.id}-reject` ? "Rejecting..." : "Reject"}
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {payments.length === 0 && <p className="py-5 text-sm text-slate-500">No records in this category.</p>}
      </div>
    </section>
  );
}

function CertificateGroup({
  title,
  certificates,
  onReview,
  pendingAction,
}: {
  title: string;
  certificates: Cert[];
  onReview: (id: string, action: "approve" | "reject") => void;
  pendingAction: string | null;
}) {
  return (
    <section className="dashboard-card p-5 md:p-6">
      <h2 className="text-xl font-black text-slate-950">{title}</h2>
      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {certificates.map((certificate) => (
          <article key={certificate.id} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-black text-slate-950">{EVENT_CERT_LABELS[certificate.type]}</h3>
                <p className="mt-1 text-sm font-semibold text-slate-600">{certificate.recipientName}</p>
                {certificate.paperTitle && <p className="mt-1 text-xs text-slate-500">Paper: {certificate.paperTitle}</p>}
              </div>
              <StatusBadge status={certificate.status} />
            </div>
            <div className="mt-4 grid gap-2 text-xs text-slate-500 sm:grid-cols-2">
              <p>Requested: {formatDate(certificate.createdAt)}</p>
              <p>Updated: {formatDate(certificate.updatedAt)}</p>
              <p>Issued: {formatDate(certificate.issuedAt)}</p>
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              {(certificate.status === "PENDING" || certificate.status === "APPROVED") && (
                <>
                  <button
                    type="button"
                    className="btn-primary px-3 py-2 text-xs"
                    disabled={pendingAction !== null}
                    onClick={() => onReview(certificate.id, "approve")}
                  >
                    {pendingAction === `certificate-${certificate.id}-approve` ? "Approving..." : "Approve"}
                  </button>
                  <button
                    type="button"
                    className="rounded-xl bg-red-600 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-red-700 disabled:opacity-60"
                    disabled={pendingAction !== null}
                    onClick={() => onReview(certificate.id, "reject")}
                  >
                    {pendingAction === `certificate-${certificate.id}-reject` ? "Rejecting..." : "Reject"}
                  </button>
                </>
              )}
              {certificate.status === "ISSUED" && (
                <a
                  href={`/api/certificates/event/${certificate.id}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-xs font-bold text-indigo-700"
                >
                  View certificate
                </a>
              )}
            </div>
          </article>
        ))}
        {certificates.length === 0 && <p className="text-sm text-slate-500">No records in this category.</p>}
      </div>
    </section>
  );
}
