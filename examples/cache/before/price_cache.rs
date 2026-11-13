//! In-memory price cache with stale-while-revalidate semantics.
//!
//! `PriceCache` sits between callers and the price feed. Lookups hit the cache
//! first; if the entry is stale, we return it immediately and kick off a
//! background refresh, so callers never block on the feed.
//!
//! On a cold miss, the caller awaits the fetch directly. Entries are evicted
//! lazily — the store doesn't run a sweeper; stale quotes are simply dropped on
//! the next read once they exceed `max_age`.
