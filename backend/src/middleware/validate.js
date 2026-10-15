const ApiError = require('../utils/ApiError');

// Validates req[source] against a Joi schema and replaces it with the cleaned value.
const validate = (schema, source = 'body') => (req, res, next) => {
  const { value, error } = schema.validate(req[source], { abortEarly: false, stripUnknown: true });
  if (error) throw new ApiError(400, error.details.map((d) => d.message).join(', '));
  if (source === 'query') req.validQuery = value; // req.query is read-only in Express 5
  else req[source] = value;
  next();
};

module.exports = validate;
