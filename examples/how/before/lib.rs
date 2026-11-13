/// Retries `req` on transient failures, e.g. if the response isn't [`Ok`].
pub fn send(req: Request) -> Result<Response, SendError> {
    todo!()
}
