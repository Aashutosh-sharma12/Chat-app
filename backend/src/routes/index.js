const { Router } = require('express');
const Joi = require('joi');
const { rateLimit } = require('express-rate-limit');
const { requireAuth } = require('../middleware/auth');
const validate = require('../middleware/validate');
const upload = require('../middleware/upload');
const auth = require('../controllers/auth.controller');
const users = require('../controllers/users.controller');
const conversations = require('../controllers/conversations.controller');
const media = require('../controllers/media.controller');
const push = require('../controllers/push.controller');
const calls = require('../controllers/calls.controller');

const router = Router();

const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 30, standardHeaders: 'draft-8', legacyHeaders: false });

const phone = Joi.string().trim().min(6).max(20).required();
const password = Joi.string().min(6).max(128).required();

// Auth
router.post(
  '/auth/register',
  authLimiter,
  validate(Joi.object({ phone, password, name: Joi.string().trim().min(1).max(60).required() })),
  auth.register
);
router.post('/auth/login', authLimiter, validate(Joi.object({ phone, password })), auth.login);
router.post('/auth/refresh', validate(Joi.object({ refreshToken: Joi.string().required() })), auth.refresh);
router.post('/auth/logout', requireAuth, validate(Joi.object({ pushToken: Joi.string() })), auth.logout);
router.get('/auth/me', requireAuth, auth.me);

// Users
router.get(
  '/users/search',
  requireAuth,
  validate(Joi.object({ phone: Joi.string().trim().max(20), q: Joi.string().trim().min(2).max(60) }), 'query'),
  users.search
);
router.patch(
  '/users/me',
  requireAuth,
  validate(
    Joi.object({
      name: Joi.string().trim().min(1).max(60),
      about: Joi.string().trim().max(140).allow(''),
      avatarUrl: Joi.string().uri().allow(null),
    }).min(1)
  ),
  users.updateMe
);
router.get('/users/:id', requireAuth, users.getById);

// Conversations & messages
router.get('/conversations', requireAuth, conversations.list);
router.post('/conversations/with/:userId', requireAuth, conversations.withUser);
router.get(
  '/conversations/:id/messages',
  requireAuth,
  validate(
    Joi.object({ before: Joi.date().iso(), limit: Joi.number().integer().min(1).max(100).default(30) }),
    'query'
  ),
  conversations.messages
);

// Media
router.post('/media', requireAuth, upload.single('file'), media.upload);

// Push tokens
router.post('/push/token', requireAuth, validate(Joi.object({ token: Joi.string().required() })), push.register);
router.delete('/push/token', requireAuth, validate(Joi.object({ token: Joi.string().required() })), push.unregister);

// Calls
router.get('/calls', requireAuth, calls.history);
router.get('/calls/ice-servers', requireAuth, calls.iceServers);

module.exports = router;
