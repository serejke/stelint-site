//! The products of the shop, their variants and their price lists.
//!
//! A label shows on the page of a product until its end date.

/// Gives the price of a variant in a price list.
pub fn price(variant: &Variant, list: &PriceList) -> Option<Price> {
    list.get(variant.id)
}
