import { latency, TokenValue, tokenValueToString } from '../../services/base';
import { HttpException, TOKEN_NOT_SUPPORTED_ERROR_MESSAGE, TOKEN_NOT_SUPPORTED_ERROR_CODE } from '../../services/error-handler';
import { Terra } from './terra';
import {
  CosmosBalanceRequest,
  CosmosBalanceResponse,
  CosmosPollRequest,
  CosmosPollResponse,
} from './terra.requests';


import { decodeTxRaw } from '@cosmjs/proto-signing';

export async function balances(
  cosmosish: Terra,
  req: CosmosBalanceRequest
): Promise<CosmosBalanceResponse | string> {
  const initTime = Date.now();

  const wallet = await cosmosish.getWallet(req.address, 'terra');

  const { tokenSymbols } = req;

  tokenSymbols.forEach((symbol: string) => {
    const token = cosmosish.getTokenForSymbol(symbol);

    if (!token) {
      throw new HttpException(
        500,
        TOKEN_NOT_SUPPORTED_ERROR_MESSAGE + symbol,
        TOKEN_NOT_SUPPORTED_ERROR_CODE
      );
    }
  });

  const balances = await cosmosish.getBalances(wallet);
  const filteredBalances = toCosmosBalances(balances, tokenSymbols);

  return {
    network: cosmosish.chain,
    timestamp: initTime,
    latency: latency(initTime, Date.now()),
    balances: filteredBalances,
  };
}

export const toCosmosBalances = (
  balances: Record<string, TokenValue>,
  tokenSymbols: Array<string>
): Record<string, string> => {
  const walletBalances: Record<string, string> = {};

  tokenSymbols.forEach((symbol) => {
    let balance = '0.0';

    if (balances[symbol]) {
      balance = tokenValueToString(balances[symbol]);
    }

    walletBalances[symbol] = balance;
  });

  return walletBalances;
};

export async function poll(
  terra: Terra,
  req: CosmosPollRequest
): Promise<CosmosPollResponse> {
  const initTime = Date.now();
  const transaction = await terra.getTransaction(req.txHash);
  const currentBlock = await terra.getCurrentBlockNumber();

  return {
    network: terra.chain,
    timestamp: initTime,
    txHash: req.txHash,
    currentBlock,
    txBlock: transaction.height,
    gasUsed: transaction.gasUsed,
    gasWanted: transaction.gasWanted,
    txData: decodeTxRaw(transaction.tx),
  };
}
