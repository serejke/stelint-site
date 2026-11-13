//! The shipments of the orders, their parcels and their labels.

/// Prints the label of the parcel with the tracking number of the carrier.
pub fn print_label(parcel: &Parcel, carrier: &Carrier) -> Label {
    carrier.label(parcel)
}
