## Quick start

Install the CLI with Cargo (requires Rust 1.80+):

```bash
cargo install --path .
```

Then create a `tidepool.toml` in your project root and run `tidepool sync`.

By default, tidepool spawns one worker per CPU core. You can tune this via the
`workers` key — e.g. lower it if you're running alongside other heavy
processes, or bump it up if your sync is mostly I/O-bound.
