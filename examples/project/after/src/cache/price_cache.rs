//! Keeps the last price of each token in memory. Thus a caller usually does
//! not wait for the price feed.
//!
//! [`PriceCache::get`] reads the price cache first:
//!
//! - For a fresh price, `get` returns it.
//! - For a stale price, `get` returns it and starts one refresh task.
//! - If the price cache has no price for the token, `get` waits for the
//!   price feed.
//!
//! The price cache has no task that removes stale prices. A refresh task
//! replaces a stale price.
