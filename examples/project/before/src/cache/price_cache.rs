//! Blazing-fast in-memory ticker store with stale-while-revalidate semantics.
//!
//! `PriceCache` sits between callers and the oracle. Lookups hit the ticker
//! cache first; if the entry is stale, we return it immediately and kick off a
//! background revalidation, so callers should generally never block on the
//! upstream feed.
//!
//! On a cold miss, the caller awaits the fetch directly. Entries are evicted
//! lazily — the ticker store doesn't run a sweeper; stale ticks are simply
//! overwritten by the next revalidation.
