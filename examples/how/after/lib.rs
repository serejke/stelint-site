/// Sends `req` again after a temporary error, for example if the response is
/// not [`Ok`].
pub fn send(req: Request) -> Result<Response, SendError> {
    todo!()
}
