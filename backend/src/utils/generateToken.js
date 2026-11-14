const jwt = require('jsonwebtoken');

/**
 * Generate a JSON Web Token (JWT) for an authenticated user.
 * @param {string} userId - The MongoDB ObjectId of the user.
 * @returns {string} Signed JWT string.
 */
const generateToken = (userId) => {
  const secret = process.env.JWT_SECRET || 'geoalarm_default_jwt_secret_dev_only';
  return jwt.sign({ id: userId }, secret, {
    expiresIn: '7d', // Token valid for 7 days
  });
};

module.exports = generateToken;
