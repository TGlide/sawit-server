import { ConnectionOptions } from "typeorm";
import { Post } from "./entities/Post";
import { User } from "./entities/User";
import path from "path";

const options: ConnectionOptions = {
  type: "postgres",
  host: "localhost",
  port: 1506,
  database: "sawit-v2",
  username: "postgres",
  password: "postlogin369",
  logging: true,
  synchronize: true,
  migrations: [path.join(__dirname, "./migrations/*")],
  entities: [Post, User],
};

export default options;
