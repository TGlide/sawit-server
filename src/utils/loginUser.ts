import { Request } from "express";
import { User } from "../entities/User";

export const loginUser = (req: Request, user: User) => {
  req.session!.userId = user.id;
};
