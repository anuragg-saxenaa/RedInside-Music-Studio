/**
 * Middleware to validate request body
 * @param {object} schema - Object with validation rules
 */
export function validateBody(schema) {
  return (req, res, next) => {
    const errors = [];

    for (const [field, rules] of Object.entries(schema)) {
      const value = req.body[field];

      // Check required
      if (rules.required && (value === undefined || value === null || value === '')) {
        errors.push(`${field} is required`);
        continue;
      }

      // Skip further validation if not provided and not required
      if (value === undefined || value === null) {
        continue;
      }

      // Check type
      if (rules.type && typeof value !== rules.type) {
        errors.push(`${field} must be of type ${rules.type}`);
      }

      // Check minLength
      if (rules.minLength && typeof value === 'string' && value.length < rules.minLength) {
        errors.push(`${field} must be at least ${rules.minLength} characters`);
      }

      // Check maxLength
      if (rules.maxLength && typeof value === 'string' && value.length > rules.maxLength) {
        errors.push(`${field} must be at most ${rules.maxLength} characters`);
      }

      // Check enum
      if (rules.enum && !rules.enum.includes(value)) {
        errors.push(`${field} must be one of: ${rules.enum.join(', ')}`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    next();
  };
}

/**
 * Middleware to validate request params
 * @param {string[]} requiredParams - Array of required param names
 */
export function validateParams(requiredParams) {
  return (req, res, next) => {
    const errors = [];

    for (const param of requiredParams) {
      if (!req.params[param]) {
        errors.push(`Parameter ${param} is required`);
      }
    }

    if (errors.length > 0) {
      return res.status(400).json({ error: errors.join('; ') });
    }

    next();
  };
}

export default { validateBody, validateParams };