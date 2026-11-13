//! The invoices of the orders and their payments.
//!
//! The payment provider accepts each payment. Then this crate settles the
//! invoice.

/// Settles the invoice when the payment provider accepts the payment.
pub fn settle(invoice: &mut Invoice, payment: &Payment) -> Result<(), BillingError> {
    invoice.record(payment)
}
