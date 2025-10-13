



export const handleError = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch((err) => {
      if (res.headersSent) {
        return next(err); 
      }
      next(err);
    });
  };
};
export const globalErrorHandler = (err, req, res, next) => {
  const statusCode = 400;
  const status = 'fail';

  res.status(statusCode).json({
    status,
    message: err.message || 'Something went wrong!',
  });
};