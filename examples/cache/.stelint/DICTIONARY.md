# Dictionary

The terms of this example.

| Term | Meaning |
|---|---|
| price | The last quote of one token from the price feed, with its time. |
| price cache | The prices in memory: the type `PriceCache`. |
| price feed | The service on the network that gives the quotes. |
| fresh price | A price that is younger than the time limit of the price cache. |
| stale price | A price that is older than the time limit of the price cache. |
| refresh task | A task that gets one new price from the price feed. |
