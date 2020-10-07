import { ApolloServer } from "apollo-server-express";
import connectRedis from "connect-redis";
import cors from "cors";
import express from "express";
import session from "express-session";
import Redis from "ioredis";
import "reflect-metadata";
import { buildSchema } from "type-graphql";
import { createConnection } from "typeorm";
import { COOKIE_NAME, __port__ } from "./constants";
import { HelloResolver } from "./resolvers/hello";
import { PostResolver } from "./resolvers/post";
import { UserResolver } from "./resolvers/user";
import typeOrmConfig from "./type-orm.config";
import { MyContext } from "./types";

const main = async () => {
  const conn = await createConnection(typeOrmConfig);
  await conn.runMigrations();

  const RedisStore = connectRedis(session);
  const redis = new Redis();
  redis.on("error", console.error);

  const app = express();

  app.use(
    cors({
      origin: "http://localhost:3000",
      credentials: true,
    })
  );

  app.use(
    session({
      name: COOKIE_NAME,
      store: new RedisStore({
        client: redis,
        disableTouch: true,
      }),
      cookie: {
        maxAge: 1000 * 60 * 60 * 24 * 365 * 10, // 10 years
        sameSite: "lax",
        secure: false,
      },
      saveUninitialized: true,
      secret: "keyboard cat",
      resave: true,
    })
  );

  const apolloServer = new ApolloServer({
    schema: await buildSchema({
      resolvers: [HelloResolver, PostResolver, UserResolver],
      validate: false,
    }),
    context: ({ req, res }): MyContext => {
      const reqWithSession = req as MyContext["req"];
      return { req: reqWithSession, res, redis };
    },
  });

  apolloServer.applyMiddleware({
    app,
    cors: false,
  });

  app.listen(__port__, () => {
    console.log(`Server started on localhost:${__port__}`);
  });
};

main().catch((err) => {
  console.log(err);
});
