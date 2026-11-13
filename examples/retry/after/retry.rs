/// Sends `req` again after a connection error or a `5xx` status code.
///
/// The first interval is `policy.base_delay`. Each new interval is two times
/// the previous interval, to a maximum of `policy.max_delay`. A `4xx` status
/// code stops the attempts, because a new attempt gives the same response.
///
/// A response with a `2xx` status code sets the interval to
/// `policy.base_delay` again. Thus one call does not increase the interval of
/// the next call.
///
/// # Errors
///
/// Returns [`SendError::Exhausted`] if the last attempt fails. For each other
/// error, returns the error of that attempt.
pub fn send_with_retry(req: Request, policy: &RetryPolicy) -> Result<Response, SendError> {
