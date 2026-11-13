## Go back to the previous release

1. Make sure that the new release causes the problem. Read the error log of
   the service.
2. On the bastion host, run `scripts/rollback.sh <version>`.

The script removes the traffic from the service. Then it starts the
previous release. When the health checks pass, it sends the traffic to the
service again.
