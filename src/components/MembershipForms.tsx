"use client";

import { useEffect, useRef, useState } from "react";
import { DEFAULT_MEMBERSHIP_FEES, MEMBERSHIP_CERT_LABELS } from "@/lib/constants";
import { attachDemoProofToInput } from "@/lib/demo-proof";
import type { MembershipCertType } from "@prisma/client";

const TYPES = Object.entries(MEMBERSHIP_CERT_LABELS) as [MembershipCertType, string][];

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(",")[1] ?? "");
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function MembershipForms({
  memberships,
}: {
  memberships: {
    id: string;
    memberId: string;
    type: MembershipCertType;
    status: string;
    expiryDate: string | null;
    latestPaymentStatus: string | null;
  }[];
}) {
  const proofRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState<MembershipCertType>("INDIVIDUAL_PROFESSIONAL");
  const [membershipId, setMembershipId] = useState(memberships[0]?.id ?? "");
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [applyLoading, setApplyLoading] = useState(false);
  const [payLoading, setPayLoading] = useState(false);

  const fee = DEFAULT_MEMBERSHIP_FEES[type] ?? 0;
  const needsOrg = type.startsWith("INSTITUTIONAL");
  const selectedMembership = memberships.find((m) => m.id === membershipId);
  const canPay = memberships.length > 0 && Boolean(membershipId);

  useEffect(() => {
    if (memberships.length === 0) {
      setMembershipId("");
      return;
    }
    if (!membershipId || !memberships.some((m) => m.id === membershipId)) {
      setMembershipId(memberships[0].id);
    }
  }, [memberships, membershipId]);

  async function apply(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setApplyLoading(true);
    setMessage("");
    setIsError(false);
    
    const fd = new FormData(e.currentTarget);
    const orgNameValue = fd.get("orgName") as string;

    // FIX: Client side dynamic validation ensuring institutional profiles supply a name
    if (needsOrg && (!orgNameValue || !orgNameValue.trim())) {
      setIsError(true);
      setMessage("Organization Name is strictly required for Institutional memberships.");
      setApplyLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/membership/apply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, orgName: orgNameValue?.trim() || undefined }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage(
        data.message ??
          `Application created. Member ID: ${data.membership.memberId}. Submit payment on the right.`,
      );
      window.location.reload();
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setApplyLoading(false);
    }
  }

  async function pay(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!membershipId) {
      setIsError(true);
      setMessage("Step 1: Apply for membership first (left panel).");
      return;
    }
    setPayLoading(true);
    setMessage("");
    setIsError(false);
    const fd = new FormData(e.currentTarget);
    const file = fd.get("proof") as File;
    if (!file?.size) {
      setIsError(true);
      setMessage("Please upload payment proof (image or PDF, max 5MB).");
      setPayLoading(false);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setIsError(true);
      setMessage("Proof file too large (max 5MB).");
      setPayLoading(false);
      return;
    }
    try {
      const proofBase64 = await fileToBase64(file);
      const res = await fetch("/api/membership/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          membershipId,
          method: fd.get("method"),
          transactionDate: fd.get("transactionDate"),
          transactionNo: (fd.get("transactionNo") as string).trim(),
          amount: Number(fd.get("amount")),
          paymentFor: (fd.get("paymentFor") as string).trim(),
          payeeName: (fd.get("payeeName") as string)?.trim() || undefined,
          proofBase64,
          proofFileName: file.name,
          proofMimeType: file.type || "application/octet-stream",
          isRenewal: fd.get("isRenewal") === "on",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage("Payment submitted. An admin will verify it shortly.");
      window.location.reload();
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setPayLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      {message && (
        <div
          className={`p-4 rounded-xl text-sm border ${
            isError
              ? "bg-red-50 text-red-900 border-red-100"
              : "bg-indigo-50 text-indigo-900 border-indigo-100"
          }`}
        >
          {message}
        </div>
      )}

      {memberships.length > 0 && (
        <section className="p-6 bg-white rounded-2xl border">
          <h2 className="font-bold mb-4">Your memberships</h2>
          <ul className="space-y-2 text-sm">
            {memberships.map((m) => (
              <li key={m.id} className="flex flex-wrap gap-2 items-center border-b py-2">
                <span className="font-mono font-semibold">{m.memberId}</span>
                <span className="text-slate-600">{MEMBERSHIP_CERT_LABELS[m.type]}</span>
                <span className="badge badge-pending">{m.status}</span>
                {m.expiryDate && (
                  <span className="text-slate-500">Expires {m.expiryDate}</span>
                )}
                {m.latestPaymentStatus && (
                  <span className="text-slate-500">Payment: {m.latestPaymentStatus}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        <section className="p-6 bg-white rounded-2xl border">
          <p className="text-xs font-semibold text-indigo-600 mb-2">Step 1</p>
          <h2 className="font-bold mb-4">Apply for membership</h2>
          <form onSubmit={apply} className="space-y-3">
            <div>
              <label className="label">Membership type</label>
              <select
                className="input-field"
                value={type}
                onChange={(e) => setType(e.target.value as MembershipCertType)}
              >
                {TYPES.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-slate-500 mt-1">Suggested fee: ₱{fee.toLocaleString()}</p>
            </div>
            {needsOrg && (
              <div>
                <label className="label">Organization name</label>
                <input 
                  name="orgName" 
                  className="input-field" 
                  required 
                  maxLength={150} // FIX: Bound string depth
                />
              </div>
            )}
            <button type="submit" className="btn-primary w-full" disabled={applyLoading}>
              {applyLoading ? "Applying…" : "Apply"}
            </button>
          </form>
        </section>

        <section className="p-6 bg-white rounded-2xl border">
          <p className="text-xs font-semibold text-indigo-600 mb-2">Step 2</p>
          <h2 className="font-bold mb-4">Membership payment / renewal</h2>
          {!canPay ? (
            <p className="text-sm text-slate-600">
              Complete Step 1 first. After you apply, your membership will appear here for payment
              upload.
            </p>
          ) : (
            <form onSubmit={pay} className="space-y-3">
              <div>
                <label className="label">Membership record</label>
                <select
                  className="input-field"
                  value={membershipId}
                  onChange={(e) => setMembershipId(e.target.value)}
                  required
                >
                  {memberships.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.memberId} — {m.status}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="label">Payment method</label>
                <select name="method" className="input-field" required defaultValue="BANK">
                  <option value="BANK">Bank</option>
                  <option value="EWALLET">E-Wallet</option>
                </select>
              </div>
              <div>
                <label className="label">Transaction date</label>
                <input
                  name="transactionDate"
                  type="date"
                  className="input-field"
                  required
                  defaultValue={new Date().toISOString().slice(0, 10)}
                />
              </div>
              <input
                name="transactionNo"
                placeholder="Transaction #"
                className="input-field"
                required
                maxLength={50} // FIX: Matches backend optimization max check
              />
              <input
                name="amount"
                type="number"
                placeholder="Amount (PHP)"
                className="input-field"
                required
                min={1}
                step="0.01"
                defaultValue={selectedMembership ? fee : undefined}
              />
              <input
                name="paymentFor"
                placeholder="Payment for"
                className="input-field"
                required
                maxLength={100} // FIX: Prevents large text buffer overruns
                defaultValue={
                  selectedMembership
                    ? MEMBERSHIP_CERT_LABELS[selectedMembership.type]
                    : undefined
                }
              />
              <input 
                name="payeeName" 
                placeholder="Payee name (OR)" 
                className="input-field" 
                maxLength={100} // FIX: Structural string constraint
              />
              <label className="flex items-center gap-2 text-sm">
                <input name="isRenewal" type="checkbox" />
                This is a renewal payment
              </label>
              <div>
                <label className="label">Upload proof (image/PDF, max 5MB)</label>
                <input
                  ref={proofRef}
                  name="proof"
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  className="input-field"
                  required
                />
                <button
                  type="button"
                  className="mt-2 text-xs text-indigo-600 hover:underline"
                  onClick={() => {
                    if (attachDemoProofToInput(proofRef.current)) {
                      setIsError(false);
                      setMessage("Demo receipt attached. Fill transaction details and submit.");
                    }
                  }}
                >
                  Use demo receipt (for testing)
                </button>
              </div>
              <button type="submit" className="btn-primary w-full" disabled={payLoading}>
                {payLoading ? "Submitting…" : "Submit payment"}
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}