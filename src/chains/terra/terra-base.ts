import axios from 'axios';
import { promises as fs } from 'fs';
import NodeCache from 'node-cache';
import fse from 'fs-extra';
import { BigNumber } from 'ethers';
import { AccountData, DirectSignResponse } from '@cosmjs/proto-signing';

import { IndexedTx, setupIbcExtension } from '@cosmjs/stargate';
import crypto from 'crypto'
// const crypto = require('crypto').webcrypto;
//Terra
// import { DirectSecp256k1Wallet } from '@cosmjs/proto-signing';
import {
  LCDClient,
  MnemonicKey,
  RawKey,
  Wallet,
} from '@terra-money/feather.js';
import { toBase64, fromBase64, fromHex } from '@cosmjs/encoding';
import { TokenListType, walletPath, TokenValue } from '../../services/base';
import { ConfigManagerCertPassphrase } from '../../services/config-manager-cert-passphrase';

export interface Token {
  base: string;
  //address Not needed for cosmos
  name: string;
  symbol: string;
  decimals: number;
}

type TerraWallet = Wallet;
export interface TerraAccount {
  address: string;
}


export interface KeyAlgorithm {
  name: string;
  salt: Uint8Array;
  iterations: number;
  hash: string;
}

export interface CipherAlgorithm {
  name: string;
  iv: Uint8Array;
}
export interface EncryptedPrivateKey {
  keyAlgorithm: KeyAlgorithm;
  cipherAlgorithm: CipherAlgorithm;
  ciphertext: Uint8Array;
}

export type NewBlockHandler = (bn: number) => void;

export type NewDebugMsgHandler = (msg: any) => void;

export class TerraBase {
  private _provider;
  protected tokenList: Token[] = [];
  private _tokenMap: Record<string, Token> = {};

  private _ready: boolean = false;
  private _initializing: boolean = false;
  private _initPromise: Promise<void> = Promise.resolve();

  public chainName;
  public rpcUrl;
  public gasPriceConstant;
  public tokenListSource: string;
  public tokenListType: TokenListType;
  public cache: NodeCache;

  constructor(
    chainName: string,
    rpcUrl: string,
    tokenListSource: string,
    tokenListType: TokenListType,
    gasPriceConstant: number
  ) {
    this._provider = new LCDClient({
      chainName: {
        chainID: chainName,
        gasAdjustment: 1.75,
        gasPrices: { uluna: gasPriceConstant },
        lcd: rpcUrl,
        prefix: 's',
      },
    });
    // this._provider = StargateClient.connect(rpcUrl);
    this.chainName = chainName;
    this.rpcUrl = rpcUrl;
    this.gasPriceConstant = gasPriceConstant;
    this.tokenListSource = tokenListSource;
    this.tokenListType = tokenListType;
    this.cache = new NodeCache({ stdTTL: 3600 }); // set default cache ttl to 1hr
  }

  ready(): boolean {
    return this._ready;
  }

  public get provider() {
    return this._provider;
  }

  async init(): Promise<void> {
    if (!this.ready() && !this._initializing) {
      this._initializing = true;
      this._initPromise = this.loadTokens(
        this.tokenListSource,
        this.tokenListType
      ).then(() => {
        this._ready = true;
        this._initializing = false;
      });
    }
    return this._initPromise;
  }

  // ? IMPLEMENTED, NOT SURE ABOUT THE RESULT
  async loadTokens(
    tokenListSource: string,
    tokenListType: TokenListType
  ): Promise<void> {
      this.tokenList = await this.getTokenList(tokenListSource, tokenListType);
      if (this.tokenList) {
        this.tokenList.forEach(
          (token: Token) => (this._tokenMap[token.symbol] = token)
        );
      }
  }

  // returns a Tokens for a given list source and list type
  // ? IMPLEMENTED
  async getTokenList(
    tokenListSource: string,
    tokenListType: TokenListType
  ): Promise<Token[]> {
    let tokens;
    if (tokenListType === 'URL') {
      ({ data: tokens } = await axios.get(tokenListSource));
    } else {
      ({ tokens } = JSON.parse(await fs.readFile(tokenListSource, 'utf8')));
    }
    return tokens;
  }

  // ? No need for this function, not a long token list
  // // ethereum token lists are large. instead of reloading each time with
  // // getTokenList, we can read the stored tokenList value from when the
  // // object was initiated.
  // // ! TO BE IMPLEMENTED
  // public get storedTokenList(): Token[] {
  //   return this.tokenList;
  // }

  // return the Token object for a symbol
  // ! TO BE IMPLEMENTED
  getTokenForSymbol(symbol: string): Token | null {
    return this._tokenMap[symbol] ? this._tokenMap[symbol] : null;
  }

  async getWalletFromPrivateKey(
    privateKey: string,
    prefix: string
  ): Promise<TerraWallet> {
    return this._provider.wallet(new RawKey(Buffer.from(privateKey)));
  }

  async getAccountsfromPrivateKey(
    privateKey: string,
    prefix: string
  ): Promise<string> {
    const wallet = await this.getWalletFromPrivateKey(privateKey, prefix);

    return wallet.key.accAddress('terra');
  }

  // returns Wallet for an address
  // TODO: Abstract-away into base.ts
  async getWallet(address: string, prefix: string): Promise<TerraWallet> {
    const path = `${walletPath}/${this.chainName}`;

    const encryptedPrivateKey: EncryptedPrivateKey = JSON.parse(
      await fse.readFile(`${path}/${address}.json`, 'utf8'),
      (key, value) => {
        switch (key) {
          case 'ciphertext':
          case 'salt':
          case 'iv':
            return fromBase64(value);
          default:
            return value;
        }
      }
    );

    const passphrase = ConfigManagerCertPassphrase.readPassphrase();
    if (!passphrase) {
      throw new Error('missing passphrase');
    }

    return await this.decrypt(encryptedPrivateKey, passphrase, prefix);
  }

  private static async getKeyMaterial(password: string) {
    const enc = new TextEncoder();
    return await crypto.subtle.importKey(
      'raw',
      enc.encode(password),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
  }

  private static async getKey(
    keyAlgorithm: {
      salt: Uint8Array;
      name: string;
      iterations: number;
      hash: string;
    },
    keyMaterial: CryptoKey
  ) {
    return await crypto.subtle.deriveKey(
      keyAlgorithm,
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  // from Solana.ts
  async encrypt(privateKey: string, password: string): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(16));
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const keyMaterial = await TerraBase.getKeyMaterial(password);
    const keyAlgorithm = {
      name: 'PBKDF2',
      salt: salt,
      iterations: 500000,
      hash: 'SHA-256',
    };
    const key = await TerraBase.getKey(keyAlgorithm, keyMaterial);
    const cipherAlgorithm = {
      name: 'AES-GCM',
      iv: iv,
    };
    const enc = new TextEncoder();
    const ciphertext: Uint8Array = (await crypto.subtle.encrypt(
      cipherAlgorithm,
      key,
      enc.encode(privateKey)
    )) as Uint8Array;
    return JSON.stringify(
      {
        keyAlgorithm,
        cipherAlgorithm,
        ciphertext: new Uint8Array(ciphertext),
      },
      (key, value) => {
        switch (key) {
          case 'ciphertext':
          case 'salt':
          case 'iv':
            return toBase64(Uint8Array.from(Object.values(value)));
          default:
            return value;
        }
      }
    );
  }

  async decrypt(
    encryptedPrivateKey: EncryptedPrivateKey,
    password: string,
    prefix: string
  ): Promise<TerraWallet> {
    const keyMaterial = await TerraBase.getKeyMaterial(password);
    const key = await TerraBase.getKey(
      encryptedPrivateKey.keyAlgorithm,
      keyMaterial
    );
    const decrypted = await crypto.subtle.decrypt(
      encryptedPrivateKey.cipherAlgorithm,
      key,
      encryptedPrivateKey.ciphertext
    );
    const dec = new TextDecoder();
    dec.decode(decrypted);

    return await this.getWalletFromPrivateKey(dec.decode(decrypted), prefix);
  }
  // Todo Implement
  async getDenomMetadata(provider: LCDClient, denom: string): Promise<any> {
    // return await provider.queryClient.bank.denomMetadata(denom);
     return await provider.bank.denomMetadata(denom);
  }
  // Todo: Implement
  getTokenDecimals(token: any): number {
    return token ? token.denom_units[token.denom_units.length - 1].exponent : 6; // Last denom unit has the decimal amount we need from our list
  }

  // Todo: Implement
  async getBalances(wallet: TerraWallet): Promise<Record<string, TokenValue>> {
    const balances: Record<string, TokenValue> = {};
    const provider = this._provider;
    // const accounts = await wallet.getAccounts();

    const address = wallet.key.accAddress('terra');
    const allTokens = await provider.bank.balance(address);
    const proc = await provider.bank.balance(address);

    await Promise.all(
      allTokens.map(async (t: { denom: string; amount: string }) => {
        let token = this.getTokenByBase(t.denom);

        if (!token && t.denom.startsWith('ibc/')) {
          const ibcHash: string = t.denom.replace('ibc/', '');

          // Get base denom by IBC hash
          if (ibcHash) {
            /*There is a problem here.
             * Is trying to get the private query Client from
             * the StargateClient but the class doen't permit that.
             */
            const { denomTrace } = await setupIbcExtension(
              await provider.queryClient
            ).ibc.transfer.denomTrace(ibcHash);

            if (denomTrace) {
              const { baseDenom } = denomTrace;

              token = this.getTokenByBase(baseDenom);
            }
          }
        }

        // Not all tokens are added in the registry so we use the denom if the token doesn't exist
        balances[token ? token.symbol : t.denom] = {
          value: BigNumber.from(parseInt(t.amount, 10)),
          decimals: this.getTokenDecimals(token),
        };
      })
    );

    return balances;
  }

  // Todo: Implement
  // returns a cosmos tx for a txHash
  async getTransaction(id: string): Promise<IndexedTx> {
    const provider = this._provider;
    const transaction = await provider.tx();
    // const transaction = await provider.getTx(id);

    if (!transaction) {
      throw new Error('Transaction not found');
    }

    return transaction;
  }

  // Todo: Implement
  public getTokenBySymbol(tokenSymbol: string): Token | undefined {
    return this.tokenList.find(
      (token: Token) => token.symbol.toUpperCase() === tokenSymbol.toUpperCase()
    );
  }

  // Todo: Implement
  public getTokenByBase(base: string): Token | undefined {
    return this.tokenList.find((token: Token) => token.base === base);
  }

  // Todo: Implement
  async getCurrentBlockNumber(): Promise<number> {
    const provider = await this._provider;

    return await provider.getHeight();
  }
}
