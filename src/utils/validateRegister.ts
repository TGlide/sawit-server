import { isEmail } from "class-validator";
import { User } from "../entities/User";
import { UsernamePasswordInput } from "../resolvers/user";

export const validateRegister = async (options: UsernamePasswordInput) => {
  const errors = [];
  if (options.username.length <= 2) {
    errors.push({
      field: "username",
      message: "length must be greater than 2",
    });
  }

  if (options.username.includes("@")) {
    errors.push({
      field: "username",
      message: "cannot include '@'",
    });
  }

  const hasUser = await User.findOne({ where: { username: options.username } });
  if (hasUser) {
    errors.push({
      field: "username",
      message: "Username already exists",
    });
  }

  if (!isEmail(options.email)) {
    errors.push({
      field: "email",
      message: "invalid email",
    });
  }

  if (options.password.length <= 2) {
    errors.push({
      field: "password",
      message: "length must be greater than 2",
    });
  }

  return errors;
};
