import React from "react";
import { format } from "date-fns";
import type { Quote, QuoteItem } from "@/types/cpq";

interface QuotePDFTemplateProps {
  quote: Quote;
  items: QuoteItem[];
}

export const QuotePDFTemplate = React.forwardRef<
  HTMLDivElement,
  QuotePDFTemplateProps
>(({ quote, items }, ref) => {
  const formatCurrency = (val: number) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
    }).format(val);

  const grossAmount = items.reduce(
    (sum, item) => sum + item.quantity * item.unit_price,
    0,
  );
  const totalItemDiscounts = items.reduce(
    (sum, item) =>
      sum + item.quantity * item.unit_price * (item.discount_percent / 100),
    0,
  );

  return (
    <div
      ref={ref}
      className="mx-auto print:mx-0 bg-slate-900 text-slate-100 min-h-[297mm] w-[210mm] p-10 shadow-md print:shadow-none print:border-0"
    >
      {/* Top accent */}
      <div className="flex items-center justify-between pb-6 border-b-2 border-slate-700 mb-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-lg bg-gradient-to-br from-indigo-600 to-cyan-500 flex items-center justify-center text-white font-bold">
            S
          </div>
          <div>
            <h3 className="text-2xl font-extrabold tracking-tight">SISWIT</h3>
            <p className="text-sm text-slate-300">
              Infrastructure · Cloud · Automation
            </p>
          </div>
        </div>

        <div className="text-right">
          <p className="uppercase text-xs text-slate-500 tracking-wider">
            Quote
          </p>
          <h1 className="text-3xl font-bold text-indigo-600">
            #{quote.quote_number || "Draft"}
          </h1>
          <p className="text-sm text-slate-500">
            {format(new Date(), "MMM d, yyyy")}
          </p>
        </div>
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-6 mb-8">
        <div className="p-4 border rounded-lg bg-slate-800">
          <p className="text-xs text-slate-300 uppercase tracking-wide mb-2">
            Billed To
          </p>
          <p className="font-semibold text-lg">{quote.accounts?.name}</p>
          <p className="text-sm text-slate-300">{quote.accounts?.address}</p>
          <p className="text-sm text-slate-300">
            {quote.accounts?.city}, {quote.accounts?.state}{" "}
            {quote.accounts?.postal_code}
          </p>
        </div>

        <div className="p-4 border rounded-lg bg-slate-800">
          <p className="text-xs text-slate-300 uppercase tracking-wide mb-2">
            Quote Details
          </p>
          <div className="flex justify-between text-sm text-slate-300">
            <span>Valid Until</span>
            <span>
              {quote.valid_until
                ? format(new Date(quote.valid_until), "MMM d, yyyy")
                : "—"}
            </span>
          </div>
          <div className="flex justify-between text-sm text-slate-300">
            <span>Prepared By</span>
            <span>{quote.created_by || quote.owner_id || "Sales"}</span>
          </div>
          <div className="flex justify-between text-sm text-slate-300">
            <span>PO / Ref</span>
            <span>
              {quote.opportunities?.name || quote.opportunity_id || "—"}
            </span>
          </div>
        </div>
      </div>

      {/* Items */}
      <div className="overflow-hidden rounded-lg border border-slate-700">
        <table className="w-full table-fixed">
          <thead className="bg-indigo-900">
            <tr>
              <th className="text-left px-4 py-3 text-sm text-indigo-200">
                Item
              </th>
              <th className="text-right px-4 py-3 text-sm text-indigo-200 w-20">
                Qty
              </th>
              <th className="text-right px-4 py-3 text-sm text-indigo-200 w-36">
                Unit
              </th>
              <th className="text-right px-4 py-3 text-sm text-indigo-200 w-24">
                Disc
              </th>
              <th className="text-right px-4 py-3 text-sm text-indigo-200 w-40">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr
                key={idx}
                className={idx % 2 === 0 ? "bg-slate-900" : "bg-slate-800"}
              >
                <td className="px-4 py-4 align-top">
                  <div className="font-semibold text-sm">
                    {item.product_name}
                  </div>
                  {item.description && (
                    <div className="text-xs text-slate-400 mt-1">
                      {item.description}
                    </div>
                  )}
                </td>
                <td className="px-4 py-4 text-right align-top">
                  {item.quantity}
                </td>
                <td className="px-4 py-4 text-right align-top">
                  {formatCurrency(item.unit_price)}
                </td>
                <td className="px-4 py-4 text-right align-top text-rose-400">
                  {item.discount_percent ? `-${item.discount_percent}%` : "—"}
                </td>
                <td className="px-4 py-4 text-right align-top font-semibold">
                  {formatCurrency(item.total)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Totals + Notes */}
      <div className="mt-6 flex gap-6">
        <div className="flex-1 text-sm text-slate-300">
          {quote.notes && (
            <div className="p-4 border rounded-md bg-slate-800">
              <p className="text-xs text-slate-400 uppercase mb-2">Notes</p>
              <p className="text-sm text-slate-300">{quote.notes}</p>
            </div>
          )}
        </div>

        <div className="w-80">
          <div className="p-4 rounded-lg bg-gradient-to-r from-slate-800 to-slate-900 border border-slate-700 text-slate-200">
            <div className="flex justify-between text-sm text-slate-200 mb-1">
              <span>Gross</span>
              <span>{formatCurrency(grossAmount)}</span>
            </div>
            {totalItemDiscounts > 0 && (
              <div className="flex justify-between text-sm text-rose-400 mb-1">
                <span>Product Discounts</span>
                <span>-{formatCurrency(totalItemDiscounts)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm text-slate-200 mb-1">
              <span>Subtotal</span>
              <span>{formatCurrency(quote.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm text-rose-400 mb-1">
              <span>Extra Discount</span>
              <span>-{formatCurrency(quote.discount_amount || 0)}</span>
            </div>
            <div className="flex justify-between text-sm text-slate-200 mb-1">
              <span>Tax</span>
              <span>+{formatCurrency(quote.tax_amount || 0)}</span>
            </div>
            <div className="mt-3 p-3 bg-indigo-500 text-white rounded-md flex justify-between items-center">
              <span className="font-semibold">Total</span>
              <span className="text-xl font-extrabold">
                {formatCurrency(quote.total ?? 0)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Signature and footer */}
      <div className="mt-10 grid grid-cols-2 gap-6 items-end">
        <div className="text-sm text-slate-300">
          <p className="uppercase text-xs text-slate-400 mb-2">Prepared By</p>
          <div className="h-16 border-b border-slate-700"></div>
          <p className="mt-2">
            {quote.created_by || quote.owner_id || "Sales"}
          </p>
        </div>

        <div className="text-right text-xs text-slate-400">
          <p>
            Thank you for considering SISWIT. For questions, reach us at
            contact@siswit.com
          </p>
          <p className="mt-3">SISWIT • www.siswit.com</p>
        </div>
      </div>
    </div>
  );
});

QuotePDFTemplate.displayName = "QuotePDFTemplate";
