import { v4 } from "uuid";

import argon2 from "argon2";

import {
  Arg,
  Ctx,
  Field,
  InputType,
  Mutation,
  Query,
  Resolver,
  ObjectType,
  FieldResolver,
  Root,
} from "type-graphql";
import { User } from "../entities/User";
import { MyContext } from "../types";
import { COOKIE_NAME, FORGET_PW_PREFIX } from "../constants";
import { isEmail } from "class-validator";
import { validateRegister } from "../utils/validateRegister";
import { sendEmail } from "../utils/sendEmail";
import { loginUser } from "../utils/loginUser";
import { hashPassword } from "../utils/hashPassword";

@InputType()
export class UsernamePasswordInput {
  @Field()
  username: string;
  @Field()
  email: string;
  @Field()
  password: string;
}

@ObjectType()
class FieldError {
  @Field()
  field: string;
  @Field()
  message: string;
}

@ObjectType()
class UserResponse {
  @Field(() => User, { nullable: true })
  user?: User;

  @Field(() => [FieldError], { nullable: true })
  errors?: FieldError[];
}

@Resolver(User)
export class UserResolver {
  @FieldResolver(() => String)
  email(@Root() user: User) {

  }

  @Query(() => User, { nullable: true })
  me(@Ctx() { req }: MyContext) {
    if (!req.session!.userId) {
      return null;
    }

    return User.findOne(req.session!.userId);
  }

  @Query(() => [User])
  users(): Promise<User[]> {
    return User.find();
  }

  @Query(() => User, { nullable: true })
  user(
    @Arg("username", { nullable: true }) username: string
  ): Promise<User | undefined> {
    return User.findOne({
      where: {
        username,
      },
    });
  }

  @Mutation(() => UserResponse)
  async register(
    @Arg("options") options: UsernamePasswordInput,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const errors = await validateRegister(options);

    if (errors.length) return { errors };

    const hashedPassword: string = await hashPassword(options.password);
    const user = await User.create({
      username: options.username,
      email: options.email,
      password: hashedPassword,
    }).save();

    loginUser(req, user);

    return { user };
  }

  @Mutation(() => UserResponse)
  async login(
    @Arg("usernameOrEmail") usernameOrEmail: string,
    @Arg("password") password: string,
    @Ctx() { req }: MyContext
  ): Promise<UserResponse> {
    const searchObject = isEmail(usernameOrEmail)
      ? { email: usernameOrEmail }
      : { username: usernameOrEmail };

    const user = await User.findOne({ where: searchObject });
    if (!user) {
      return {
        errors: [
          { field: "usernameOrEmail", message: "the user does not exist" },
        ],
      };
    }

    const valid = await argon2.verify(user.password, password);
    if (!valid) {
      return {
        errors: [{ field: "password", message: "wrong password" }],
      };
    }

    loginUser(req, user);

    return {
      user: user,
    };
  }

  @Mutation(() => Boolean)
  async logout(@Ctx() { req, res }: MyContext): Promise<Boolean> {
    return new Promise((resolve) =>
      req.session!.destroy((err) => {
        if (err) {
          console.log(err);
          resolve(false);
          return;
        }
        res.clearCookie(COOKIE_NAME);

        resolve(true);
      })
    );
  }

  @Mutation(() => UserResponse)
  async changePassword(
    @Arg("token") token: string,
    @Arg("newPassword") newPassword: string,
    @Ctx() { redis, req }: MyContext
  ): Promise<UserResponse> {
    const errors = [];
    if (newPassword.length <= 2) {
      errors.push({
        field: "newPassword",
        message: "length must be greater than 2",
      });
    }

    const key = FORGET_PW_PREFIX + token;
    let userId = await redis.get(key);

    if (userId === null) {
      errors.push({
        field: "token",
        message: "token expired",
      });
    }

    if (errors.length) return { errors };

    const userIdNum = parseInt(userId!);
    const user = await User.findOne(userIdNum);

    if (!user) {
      return {
        errors: [
          {
            field: "token",
            message: "user no longer exists",
          },
        ],
      };
    }

    await User.update(
      { id: userIdNum },
      { password: await hashPassword(newPassword) }
    );

    await redis.del(key);

    loginUser(req, user);

    return { user };
  }

  @Mutation(() => Boolean)
  async forgotPassword(
    @Ctx() { redis }: MyContext,
    @Arg("email") email: string
  ) {
    const user = await User.findOne({ where: { email } });
    if (!user) {
      return true;
    }

    const token = v4();
    await redis.set(
      FORGET_PW_PREFIX + token,
      user.id,
      "ex",
      1000 * 60 * 60 * 24 * 3
    );

    const html = `<a href="http://localhost:3000/change-password/${token}">reset password</a>`;
    await sendEmail(email, html);

    return true;
  }
}
