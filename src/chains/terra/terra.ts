// import { TerraBase } from './terra-base';
// import { getCosmosConfig } from './terra.config';
// import { getCosmosConfig } from '../../src/chains/cosmos/cosmos.config';
import { getTerraConfig } from './terra.config';
import { logger } from 'ethers';
import { Cosmosish } from '../../services/common-interfaces';
import { CosmosBase } from '../cosmos/cosmos-base';

export class Terra extends CosmosBase implements Cosmosish {
  private static _instances: { [name: string]: Terra };
  private _gasPrice: number;
  private _nativeTokenSymbol: string;
  private _chain: string;
  private _requestCount: number;
  private _metricsLogInterval: number;
  private _metricTimer;

  private constructor(network: string) {
    const config = getTerraConfig('terra');
    super(
      'terra',
      config.network.rpcURL,
      config.network.tokenListSource,
      config.network.tokenListType,
      config.manualGasPrice
    );
    this._chain = network;
    this._nativeTokenSymbol = config.nativeCurrencySymbol;

    this._gasPrice = config.manualGasPrice;

    this._requestCount = 0;
    this._metricsLogInterval = 300000; // 5 minutes

    this._metricTimer = setInterval(
      this.metricLogger.bind(this),
      this.metricsLogInterval
    );
  }

  public static getInstance(network: string): Terra {
    if (Terra._instances === undefined) {
      Terra._instances = {};
    }
    if (!(network in Terra._instances)) {
      Terra._instances[network] = new Terra(network);
    }
    return Terra._instances[network];
  }

  public static getConnectedInstances(): { [name: string]: Terra } {
    return Terra._instances;
  }

  public requestCounter(msg: any): void {
    if (msg.action === 'request') this._requestCount += 1;
  }

  public metricLogger(): void {
    logger.info(
      this.requestCount +
        ' request(s) sent in last ' +
        this.metricsLogInterval / 1000 +
        ' seconds.'
    );
    this._requestCount = 0; // reset
  }

  public get gasPrice(): number {
    return this._gasPrice;
  }

  public get chain(): string {
    return this._chain;
  }

  public get nativeTokenSymbol(): string {
    return this._nativeTokenSymbol;
  }

  public get requestCount(): number {
    return this._requestCount;
  }

  public get metricsLogInterval(): number {
    return this._metricsLogInterval;
  }

  async close() {
    clearInterval(this._metricTimer);
    if (this._chain in Terra._instances) {
      delete Terra._instances[this._chain];
    }
  }
}
