import {  fromBech32 } from '@cosmjs/encoding';
import { RequestValidator, Validator, mkRequestValidator, mkValidator, validateTokenSymbols, validateTxHash } from '../../services/validators';

export const invalidTerraAddressError: string =
  'The spender param is not a valid Terra address. (Bech32 format)';

export const isValidTerraAddress = (str: string): boolean => {
  try {
    // normalizeBech32(str);
    fromBech32(str);

    return true;
  } catch (e) {
    return false;
  }
};

// given a request, look for a key called address that is a Cosmos address
export const validatePublicKey: Validator = mkValidator(
  'address',
  invalidTerraAddressError,
  (val) => typeof val === 'string' && isValidTerraAddress(val)
);

export const validateTerraBalanceRequest: RequestValidator =
  mkRequestValidator([validatePublicKey, validateTokenSymbols]);

export const validateTerraPollRequest: RequestValidator = mkRequestValidator([
  validateTxHash,
]);
