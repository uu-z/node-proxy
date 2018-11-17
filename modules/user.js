const _ = require("lodash");
const Joi = require("joi");
const validate = require("koa-joi-validate");
const { utils } = require("../plugins/utils");

const User = {
  name: "User",
  routes: {
    "get /users/:_id": "findUser",
    "get /users": "listUser",
    "get /me": {
      validators: "token",
      controllers: "me"
    },
    "post /signup": "signUp",
    "post /login": {
      validators: "login",
      controllers: "login"
    },
    "put /users/:_id": "updateUser"
  },
  validators: {
    token: () => ({
      headers: {
        authorization: Joi.string().required()
      }
    }),
    login: () => ({
      body: {
        identifier: Joi.string().required(),
        password: Joi.string().required()
      }
    })
  },
  controllers: {
    async signUp(ctx, next) {
      ctx.body = await utils.create("User", ctx.request.body);
    },
    async listUser(ctx, next) {
      const params = ctx.query;
      for (let [k, v] of Object.entries(params)) {
        params[k] = JSON.parse(v);
      }
      ctx.body = await utils.paginate("User", params.query || {}, params.paginate || {});
    },
    async findUser(ctx) {
      if (!ctx.params._id.match(/^[0-9a-fA-F]{24}$/)) return ctx.notFound();
      ctx.body = await utils.findOne("User", ctx.query);
    },
    async updateUser(ctx) {
      await utils.updateOne("User", ctx.query, ctx.request.body);
      ctx.body = await utils.findOne("User", ctx.query);
    },
    async login(ctx) {
      const { identifier, password } = ctx.request.body;
      const user = await utils
        .findOne("User", { $or: [{ email: identifier }, { username: identifier }] })
        .select("+password");
      if (!user) {
        return ctx.notFound;
      }
      const validPassword = await user.verifyPassword(password);
      if (validPassword) {
        delete user.password;
        ctx.body = { user, token: utils.signJWT({ data: user._id }) };
      } else {
        ctx.throw(401, "invalid username or password");
      }
    },
    async me(ctx) {
      const userId = _.get(ctx.state, "user.data");
      ctx.body = await utils.findOne("User", { _id: userId });
    }
  },
  services: {},
  models: {
    User: {
      schema: {
        username: {
          type: "string",
          default: null
        },
        email: {
          type: "string",
          required: true,
          unique: true
        },
        password: {
          type: "string",
          select: false,
          required: true,
          bcrypt: true,
          hidden: true
        },
        secret: {
          type: "string",
          bcrypt: true
        }
      }
    }
  }
};
module.exports = User;
