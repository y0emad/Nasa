import { validationResult } from "express-validator";

export const checkErrors = (req: any, res: any, next: any) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array().map((error) => error.msg) });
  }
  next();
};