import { Terra } from './terra';
import { NextFunction, Request, Response } from 'express';
import { CosmosConfig } from './terra.config';

export const verifyCosmosIsAvailable = async (
  _req: Request,
  _res: Response,
  next: NextFunction
) => {
  const cosmos = Terra.getInstance(CosmosConfig.config.network.name);
  if (!cosmos.ready()) {
    await cosmos.init();
  }
  return next();
};
