const { authSchema } = require('../Helpers/validation_schema');
const User = require('../Models/User.model');
const createError = require('http-errors');
const { signAccessToken, signRefreshToken, verifyRefreshToken } = require('../Helpers/jwt_helper');
const client = require('../Helpers/init_redis');
const Logger = require('../Helpers/logger');

module.exports = {
    registerUser: async (req, res, next) => {
        try {
            const result = await authSchema.validateAsync(req.body);

            const doesExist = await User.findOne({ email: result.email });

            if (doesExist) {
                throw createError.Conflict(`${result.email}, is already been register`);
            }

            const user = new User(result);

            await user.save();
            /*            const accessToken = await signAccessToken(savedUser.id);
            const refreshToken = await signRefreshToken(savedUser.id);

            Logger.debug(
                `controller/authController : registerUser() { savedUser : ${user} / accessToken : ${accessToken} / refreshToken : ${refreshToken}`
            );
            res.send({ accessToken, refreshToken });*/
            res.sendStatus(200);
        } catch (e) {
            if (e.isJoi === true) {
                e.status = 422;
            }
            next(e);
        }
    },
    loginUser: async (req, res, next) => {
        try {
            const { email, password } = await authSchema.validateAsync(req.body);
            const user = await User.findOne({ email });

            if (!user) {
                throw createError.NotFound('User not registered');
            }

            const isMatch = user.checkPassword(password);

            if (!isMatch) {
                throw createError.Unauthorized('Username/Password not valid');
            }

            const accessToken = await signAccessToken(user.id);
            const refreshToken = await signRefreshToken(user.id);

            Logger.debug(
                `controller/authController : loginUser() { Logged_User : ${user} / accessToken : ${accessToken} / refreshToken : ${refreshToken}`
            );

            res.json({
                accessToken,
                refreshToken,
                userId: user.id,
            });
        } catch (e) {
            if (e.isJoi === true) {
                return next(createError.BadRequest('Invalid Username/Password'));
            }
            next(e);
        }
    },
    refreshToken: async (req, res, next) => {
        try {
            const { refreshToken } = req.body;
            if (!refreshToken) {
                Logger.debug('refreshToken not', refreshToken);
                throw createError.BadRequest();
            }
            Logger.debug('refreshToken in', refreshToken);

            const userId = await verifyRefreshToken(refreshToken);
            const accessToken = await signAccessToken(userId);

            Logger.debug(accessToken);

            res.send({ accessToken: accessToken });
        } catch (error) {
            next(error);
        }
    },
    logoutUser: async (req, res, next) => {
        try {
            const refreshToken = req.cookies.refreshToken;
            if (!refreshToken) {
                throw createError.BadRequest();
            }
            const userId = await verifyRefreshToken(refreshToken);
            client.del(userId, (error, value) => {
                if (error) {
                    throw createError.InternalServerError();
                }
                Logger.debug(
                    `controller/authController : logoutUser() { UserId : ${userId} / refreshToken : ${refreshToken} / value : ${value}`
                );
                res.sendStatus(204);
            });
        } catch (e) {
            next(e);
        }
    },
};
