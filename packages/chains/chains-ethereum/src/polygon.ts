import { RenNetwork } from "@renproject/utils";

import { EthereumBaseChain } from "./base";
import { resolveEVMNetworkConfig } from "./utils/generic";
import {
    EthereumClassConfig,
    EthProvider,
    EthSigner,
    EVMNetworkConfig,
    EVMNetworkInput,
    populateEVMNetwork,
} from "./utils/types";

const polygonMainnetConfig: EVMNetworkConfig = populateEVMNetwork({
    selector: "Polygon",

    nativeAsset: { name: "Matic", symbol: "MATIC", decimals: 18 },
    averageConfirmationTime: 4,

    config: {
        chainId: "0x89",
        chainName: "Matic(Polygon) Mainnet",
        nativeCurrency: { name: "Matic", symbol: "MATIC", decimals: 18 },
        rpcUrls: [
            "https://polygon-rpc.com",
            "https://rpc-mainnet.maticvigil.com",
            "https://rpc-mainnet.matic.network",
            "wss://ws-mainnet.matic.network",
            "https://rpc-mainnet.matic.quiknode.pro",
            "https://matic-mainnet.chainstacklabs.com",
        ],
        blockExplorerUrls: ["https://polygonscan.com"],
    },

    logRequestLimit: 1000,
    addresses: {
        GatewayRegistry: "0xf36666C230Fa12333579b9Bd6196CB634D6BC506",
        BasicBridge: "0x82DF02A52E2e76C0c233367f2fE6c9cfe51578c5",
    },
});

const polygonTestnetConfig: EVMNetworkConfig = populateEVMNetwork({
    selector: "Polygon",
    isTestnet: true,

    nativeAsset: { name: "Testnet Matic", symbol: "MATIC", decimals: 18 },
    averageConfirmationTime: 4,

    config: {
        chainId: "0x13881",
        chainName: "Matic(Polygon) Testnet Mumbai",
        nativeCurrency: { name: "Matic", symbol: "tMATIC", decimals: 18 },
        rpcUrls: [
            "https://rpc-mumbai.maticvigil.com",
            "https://rpc-mumbai.matic.today",
            "wss://ws-mumbai.matic.today",
        ],
        blockExplorerUrls: ["https://mumbai.polygonscan.com/"],
    },

    logRequestLimit: 1000,
    addresses: {
        GatewayRegistry: "0x5076a1F237531fa4dC8ad99bb68024aB6e1Ff701",
        BasicBridge: "0xcb6bD6B6c7D7415C0157e393Bb2B6Def7555d518",
    },
});

export class Polygon extends EthereumBaseChain {
    public static chain = "Polygon";
    public static configMap = {
        [RenNetwork.Testnet]: polygonTestnetConfig,
        [RenNetwork.Mainnet]: polygonMainnetConfig,
    };
    public configMap = Polygon.configMap;

    public static assets = {
        MATIC: "MATIC",
    };
    public assets = Polygon.assets;

    public constructor({
        network,
        provider,
        signer,
        config,
    }: {
        network: EVMNetworkInput;
        provider: EthProvider;
        signer?: EthSigner;
        config?: EthereumClassConfig;
    }) {
        super({
            network: resolveEVMNetworkConfig(Polygon.configMap, network),
            provider,
            signer,
            config,
        });
    }
}
