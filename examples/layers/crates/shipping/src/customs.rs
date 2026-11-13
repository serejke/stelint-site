/// Puts a copy of the invoice in each parcel of the shipment.
pub fn add_customs_papers(shipment: &mut Shipment) {
    shipment.attach_invoice_copies();
}
