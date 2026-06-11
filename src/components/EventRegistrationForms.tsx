"use client";

import { useRef, useState } from "react";
import { attachDemoProofToInput } from "@/lib/demo-proof";
import type { Event } from "@prisma/client";

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function EventRegistrationForms({ events }: { events: Event[] }) {
  const [selected, setSelected] = useState(events[0]?.id ?? "");
  const [qrUrl, setQrUrl] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isError, setIsError] = useState(false);
  const [loading, setLoading] = useState(false);
  const proofRef = useRef<HTMLInputElement>(null);

  const event = events.find((e) => e.id === selected);

  async function submitEarly(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setIsError(false);
    setQrUrl(null);
    const fd = new FormData(e.currentTarget);
    try {
      const res = await fetch("/api/registrations/early", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventId: selected, ...Object.fromEntries(fd) }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setQrUrl(data.qrDataUrl);
      setMessage("Early registration complete! Save your QR code below.");
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Failed");
    } finally {
      setLoading(false);
    }
  }

  async function submitPayment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setIsError(false);
    const fd = new FormData(e.currentTarget);
    const file = fd.get("proof") as File;
    if (!file?.size) {
      setIsError(true);
      setMessage("Please upload payment proof (image or PDF, max 5MB).");
      setLoading(false);
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setIsError(true);
      setMessage("Proof file too large (max 5MB).");
      setLoading(false);
      return;
    }
    try {
      const proofBase64 = await fileToBase64(file);
      const res = await fetch("/api/registrations/payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          eventId: selected,
          attendeeName: fd.get("attendeeName"),
          attendeeEmail: fd.get("attendeeEmail"),
          organization: fd.get("organization") || undefined,
          paperTitle: fd.get("paperTitle") || undefined,
          method: fd.get("method"),
          transactionDate: fd.get("transactionDate"),
          transactionNo: fd.get("transactionNo"),
          amount: Number(fd.get("amount")),
          paymentFor: fd.get("paymentFor"),
          payeeName: fd.get("payeeName") || undefined,
          proofBase64,
          proofFileName: file.name,
          proofMimeType: file.type || "application/octet-stream",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setMessage("Payment submitted. Awaiting admin verification. QR will be available after approval.");
      window.location.reload();
    } catch (err) {
      setIsError(true);
      setMessage(err instanceof Error ? err.message : "Payment failed");
    } finally {
      setLoading(false);
    }
  }

  if (!events.length) {
    return <p className="text-slate-600">No active events. Contact the organizer.</p>;
  }

  return (
    <div className="space-y-8">
      <div>
        <label className="label">Select event</label>
        <select
          className="input-field max-w-md"
          value={selected}
          onChange={(e) => {
            setSelected(e.target.value);
            setQrUrl(null);
            setMessage("");
          }}
        >
          {events.map((ev) => (
            <option key={ev.id} value={ev.id}>
              {ev.name}
            </option>
          ))}
        </select>
        {event && (
          <p className="text-sm text-slate-500 mt-2">
            {new Date(event.startDate).toLocaleDateString()} —{" "}
            {new Date(event.endDate).toLocaleDateString()} · Early fee: ₱
            {event.earlyFee?.toString() ?? "N/A"} · Regular: ₱{event.regularFee.toString()}
          </p>
        )}
      </div>

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

      {qrUrl && (
        <div className="p-6 bg-white rounded-2xl border text-center">
          <p className="font-semibold mb-4">Your event QR code</p>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={qrUrl} alt="Registration QR" className="mx-auto max-w-[280px]" />
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-8">
        <section className="p-6 bg-white rounded-2xl border border-slate-200 self-start">
          <h2 className="text-lg font-bold mb-1">A. Early registration</h2>
          <p className="text-sm text-slate-500 mb-4">Instant unique QR per participant</p>
          <form onSubmit={submitEarly} className="space-y-3">
            <Field name="attendeeName" label="Attendee name" required />
            <Field name="attendeeEmail" label="Email" type="email" required />
            <Field name="organization" label="Organization" />
            {event?.isResearchConf && <Field name="paperTitle" label="Paper title (optional)" />}
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              Register &amp; get QR
            </button>
          </form>
        </section>

        <section className="p-6 bg-white rounded-2xl border border-slate-200">
          <h2 className="text-lg font-bold mb-1">B. Confirmed registration (payment)</h2>
          <p className="text-sm text-slate-500 mb-4">
            Upload proof — approved after bank/e-wallet verification
          </p>
          <form onSubmit={submitPayment} className="space-y-3">
            <Field name="attendeeName" label="Attendee name" required />
            <Field name="attendeeEmail" label="Email" type="email" required />
            <Field name="organization" label="Organization" />
            <div>
              <label className="label">Payment method</label>
              <select name="method" className="input-field" required>
                <option value="BANK">Bank transfer</option>
                <option value="EWALLET">E-Wallet</option>
              </select>
            </div>
            <Field
              name="transactionDate"
              label="Transaction date"
              type="date"
              required
              defaultValue={new Date().toISOString().slice(0, 10)}
            />
            <Field name="transactionNo" label="Transaction number" required />
            <Field name="amount" label="Amount (PHP)" type="number" required />
            <Field name="paymentFor" label="Payment for" required />
            <Field name="payeeName" label="Payee name (for OR)" />
            <div>
              <label className="label">Upload proof (image/PDF, max 5MB)</label>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-dashed border-indigo-300 bg-indigo-50 px-4 py-3 text-sm font-semibold text-indigo-600 hover:bg-indigo-100 transition">
              Choose file to upload
                <input
                  ref={proofRef}
                  name="proof"
                  type="file"
                  accept="image/*,.pdf,application/pdf"
                  className="hidden"
                  required
                />
              </label>
              <button
                type="button"
                className="mt-2 text-xs text-indigo-600 hover:underline"
                onClick={() => {
                  if (attachDemoProofToInput(proofRef.current)) {
                    setIsError(false);
                    setMessage("Demo receipt attached. Complete the form and submit.");
                  }
                }}
              >
                Use demo receipt (for testing)
              </button>
            </div>
            <button type="submit" className="btn-primary w-full" disabled={loading}>
              Submit payment for verification
            </button>
          </form>
        </section>
      </div>
    </div>
  );
}

const FIELD_MAX: Record<string, number> = {
  attendeeName: 100,
  attendeeEmail: 150,
  organization: 150,
  paperTitle: 255,
  transactionNo: 50,
  paymentFor: 100,
  payeeName: 100,
};

const FIELD_MIN: Record<string, number> = {
  amount: 1,
};

function Field({
  name,
  label,
  type = "text",
  required,
  defaultValue,
}: {
  name: string;
  label: string;
  type?: string;
  required?: boolean;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="label" htmlFor={name}>
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        className="input-field"
        required={required}
        defaultValue={defaultValue}
        maxLength={FIELD_MAX[name]}
        min={type === "number" ? FIELD_MIN[name] : undefined}
        step={type === "number" ? "0.01" : undefined}
      />
    </div>
  );
}
