/// Sends the request, retrying on transient failures with exponential backoff.
///
/// The delay starts at `policy.base_delay` and doubles after each failed
/// attempt, capped at `policy.max_delay`. Only connection errors and 5xx
/// responses are retried — 4xx responses are returned immediately, since
/// retrying them won't help.
///
/// Note: the backoff state is reset on success, so a long-lived client doesn't
/// accumulate delay across unrelated calls.
///
/// # Errors
///
/// Returns [`SendError::Exhausted`] if every attempt fails, or the underlying
/// error for non-retryable failures.
pub fn send_with_retry(req: Request, policy: &RetryPolicy) -> Result<Response, SendError> {
