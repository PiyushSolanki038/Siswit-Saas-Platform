import React from "react";
import { format } from "date-fns";
import type { Quote, QuoteItem } from "@/types/cpq";

interface QuotePDFTemplateProps {
  quote: Quote;
  items: QuoteItem[];
}

export const QuotePDFTemplate = React.forwardRef<HTMLDivElement, QuotePDFTemplateProps>(
  ({ quote, items }, ref) => {
    const formatCurrency = (val: number) => 
      new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR" }).format(val);

    // Calculations logic
    const grossAmount = items.reduce((sum, item) => sum + (item.quantity * item.unit_price), 0);
    const totalItemDiscounts = items.reduce((sum, item) => 
      sum + (item.quantity * item.unit_price * (item.discount_percent / 100)), 0);

    return (
      <div ref={ref} className="p-12 bg-white text-black min-h-[297mm] w-[210mm] border shadow-sm mx-auto print:shadow-none print:border-0">
        {/* Header */}
        <div className="flex justify-between items-start border-b pb-8 mb-8">
          <div>
            <h1 className="text-4xl font-bold tracking-tight text-primary">QUOTE</h1>
            <p className="text-muted-foreground mt-1">#{quote.quote_number || "Draft"}</p>
          </div>
          <div className="text-right">
            <h2 className="font-bold text-xl">SISWIT</h2>
            <p className="text-sm text-muted-foreground">contact@siswit.com</p>
          </div>
        </div>

        {/* Info Grid */}
        <div className="grid grid-cols-2 gap-12 mb-10">
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Billed To</p>
            <p className="font-bold">{quote.accounts?.name}</p>
            <p className="text-sm">{quote.accounts?.address}</p>
            <p className="text-sm">{quote.accounts?.city}, {quote.accounts?.state} {quote.accounts?.postal_code}</p>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground mb-2">Quote Details</p>
            <p className="text-sm"><span className="font-medium">Date:</span> {format(new Date(), "MMM d, yyyy")}</p>
            <p className="text-sm"><span className="font-medium">Valid Until:</span> {quote.valid_until ? format(new Date(quote.valid_until), "MMM d, yyyy") : "—"}</p>
          </div>
        </div>

        {/* Items Table */}
        <table className="w-full mb-10 border-collapse">
          <thead>
            <tr className="border-b-2 border-black text-left">
              <th className="py-3 text-sm uppercase">Item</th>
              <th className="py-3 text-sm uppercase text-right">Qty</th>
              <th className="py-3 text-sm uppercase text-right">Unit Price</th>
              <th className="py-3 text-sm uppercase text-right">Disc %</th>
              <th className="py-3 text-sm uppercase text-right">Total</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={idx} className="border-b border-gray-100">
                <td className="py-4">
                  <p className="font-bold">{item.product_name}</p>
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                </td>
                <td className="py-4 text-right">{item.quantity}</td>
                <td className="py-4 text-right">{formatCurrency(item.unit_price)}</td>
                <td className="py-4 text-right text-red-600">-{item.discount_percent}%</td>
                <td className="py-4 text-right font-medium">{formatCurrency(item.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals Section */}
        <div className="flex justify-end">
          <div className="w-64 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Gross Amount</span>
              <span>{formatCurrency(grossAmount)}</span>
            </div>
            {totalItemDiscounts > 0 && (
              <div className="flex justify-between text-sm text-red-600">
                <span>Product Discounts</span>
                <span>-{formatCurrency(totalItemDiscounts)}</span>
              </div>
            )}
            <div className="flex justify-between text-sm font-bold border-t pt-2">
              <span>Subtotal</span>
              <span>{formatCurrency(quote.subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Extra Discount ({quote.discount_percent}%)</span>
              <span className="text-red-600">-{formatCurrency(quote.discount_amount)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax ({quote.tax_percent}%)</span>
              <span>+{formatCurrency(quote.tax_amount)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold bg-gray-50 p-2">
              <span>Total</span>
              <span>{formatCurrency(quote.total)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        {quote.notes && (
          <div className="mt-12 pt-8 border-t text-xs text-muted-foreground">
            <p className="font-bold mb-1">Notes:</p>
            <p>{quote.notes}</p>
          </div>
        )}
      </div>
    );
  }
);

QuotePDFTemplate.displayName = "QuotePDFTemplate";