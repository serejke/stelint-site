## Install

You must have Rust 1.80 or a newer version.

```bash
cargo install --path .
```

## Run

1. Write `tidepool.toml` in the root of your project.
2. Run `tidepool sync`.

`tidepool sync` starts one worker for each CPU core. To change this
number, set `workers` in `tidepool.toml`. Set a smaller number if other
programs use the CPU. Set a larger number if the workers usually wait for
the disk or the network.
