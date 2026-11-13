## Rolling back

If a deploy causes problems, you can roll back to the previous release. Before
doing so, it's worth confirming that the regression actually comes from the new
release rather than an upstream issue — check the service's error logs first.

Run the rollback script from the bastion host:

```bash
scripts/rollback.sh <version>
```

Make sure to drain traffic before running it. The script handles draining
automatically, redeploys the previous release, and restores traffic once health
checks pass.
