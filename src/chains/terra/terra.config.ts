import { TokenListType } from "../../services/base";
import { ConfigManagerV2 } from "../../services/config-manager-v2";

export interface NetworkConfig {
  name: string;
  rpcURL: string;
  tokenListType: TokenListType;
  tokenListSource: string;
}

export interface Config {
  network: NetworkConfig;
  nativeCurrencySymbol: string;
  manualGasPrice: number;
}

export namespace CosmosConfig {
  export const config: Config = getTerraConfig('terra');
}

export function getTerraConfig(chainName: string): Config {
  const configManager = ConfigManagerV2.getInstance();
  const network = configManager.get(chainName + '.network'); // * Loads the network from the configmanager
  return {
    network: {
      name: network,
      rpcURL: configManager.get(chainName + '.networks.' + network + '.rpcURL'),
      tokenListType: configManager.get(
        chainName + '.networks.' + network + '.tokenListType'
      ),
      tokenListSource: configManager.get(
        chainName + '.networks.' + network + '.tokenListSource'
      ),
    },
    nativeCurrencySymbol: configManager.get(
      chainName + '.nativeCurrencySymbol'
    ),
    manualGasPrice: configManager.get(chainName + '.manualGasPrice'),
  };
}
// export function getCosmosConfig(chainName: string): Config {
//   const configManager = ConfigManagerV2.getInstance();
//   const network = configManager.get(chainName + '.network');
//   return {
//     network: {
//       name: network,
//       rpcURL: configManager.get(chainName + '.networks.' + network + '.rpcURL'),
//       tokenListType: configManager.get(
//         chainName + '.networks.' + network + '.tokenListType'
//       ),
//       tokenListSource: configManager.get(
//         chainName + '.networks.' + network + '.tokenListSource'
//       ),
//     },
//     nativeCurrencySymbol: configManager.get(
//       chainName + '.nativeCurrencySymbol'
//     ),
//     manualGasPrice: configManager.get(chainName + '.manualGasPrice'),
//   };
// }
