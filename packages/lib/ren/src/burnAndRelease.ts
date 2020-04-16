import {
    BurnAndReleaseParams, NetworkDetails, TxStatus, UnmarshalledBurnTx,
} from "@renproject/interfaces";
import { ResponseQueryBurnTx } from "@renproject/rpc";
import {
    extractBurnReference, extractError, forwardWeb3Events, generateBurnTxHash,
    ignorePromiEventError, newPromiEvent, Ox, payloadToABI, processBurnAndReleaseParams, PromiEvent,
    RenWeb3Events, resolveOutToken, txHashToBase64, Web3Events, withDefaultAccount,
} from "@renproject/utils";
import BigNumber from "bignumber.js";
import Web3 from "web3";
import { TransactionConfig } from "web3-core";

import { RenVMNetwork, unmarshalBurnTx } from "./renVMNetwork";

export class BurnAndRelease {
    private readonly params: BurnAndReleaseParams;
    private readonly renVMNetwork: RenVMNetwork;
    private readonly network: NetworkDetails;

    constructor(_renVMNetwork: RenVMNetwork, _network: NetworkDetails, _params: BurnAndReleaseParams) {
        this.renVMNetwork = _renVMNetwork;
        this.network = _network;
        this.params = processBurnAndReleaseParams(this.network, _params);
    }

    /**
     * createTransactions will create unsigned Ethereum transactions that can
     * be signed at a later point in time. The last transaction should contain
     * the burn that will be submitted to RenVM. Once signed and submitted,
     * a new BurnAndRelease object should be initialized with the burn
     * reference.
     *
     * @param {TransactionConfig} [txConfig] Optionally override default options
     *        like gas.
     * @returns {TransactionConfig[]}
     */
    public createTransactions = (txConfig?: TransactionConfig): TransactionConfig[] => {
        const contractCalls = this.params.contractCalls || [];

        return contractCalls.map(contractCall => {

            const { contractParams, contractFn, sendTo, txConfig: txConfigParam } = contractCall;

            const params = [
                ...(contractParams || []).map(value => value.value),
            ];

            const ABI = payloadToABI(contractFn, (contractParams || []));
            // tslint:disable-next-line: no-any
            const web3: Web3 = new (Web3 as any)();
            const contract = new web3.eth.Contract(ABI);

            const data = contract.methods[contractFn](
                ...params,
            ).encodeABI();

            return {
                to: sendTo,
                data,

                ...txConfigParam,
                ...{
                    value: txConfigParam && txConfigParam.value ? txConfigParam.value.toString() : undefined,
                    gasPrice: txConfigParam && txConfigParam.gasPrice ? txConfigParam.gasPrice.toString() : undefined,
                },

                ...txConfig,
            };
        });
    }

    /**
     * Read a burn reference from an Ethereum transaction - or submit a
     * transaction first if the transaction details have been provided.
     *
     * @param {TransactionConfig} [txConfig] Optionally override default options
     *        like gas.
     * @returns {(PromiEvent<BurnAndRelease, Web3Events & RenWeb3Events>)}
     */
    public readFromEthereum = (txConfig?: TransactionConfig): PromiEvent<BurnAndRelease, Web3Events & RenWeb3Events> => {

        const promiEvent = newPromiEvent<BurnAndRelease, Web3Events & RenWeb3Events>();

        (async () => {

            if (this.params.txHash) {
                return this;
            }

            const { web3Provider, contractCalls } = this.params;
            let { burnReference } = this.params;
            let ethereumTxHash = this.params.ethereumTxHash;

            // There are three parameter configs:
            // Situation (1): A `burnReference` is provided
            // Situation (2): Contract call details are provided
            // Situation (3): A txHash is provided

            // For (1), we don't have to do anything.
            if (!burnReference && burnReference !== 0) {

                if (!web3Provider) {
                    throw new Error("Must provide burn reference ID or web3 provider.");
                }

                const web3 = new Web3(web3Provider);

                // Handle situation (2)
                // Make a call to the provided contract and Pass on the
                // transaction hash.
                if (contractCalls) {

                    for (let i = 0; i < contractCalls.length; i++) {
                        const contractCall = contractCalls[i];
                        const last = i === contractCalls.length - 1;

                        const { contractParams, contractFn, sendTo, txConfig: txConfigParam } = contractCall;

                        const callParams = [
                            ...(contractParams || []).map(value => value.value),
                        ];

                        const ABI = payloadToABI(contractFn, contractParams);
                        const contract = new web3.eth.Contract(ABI, sendTo);

                        const tx = contract.methods[contractFn](
                            ...callParams,
                        ).send(await withDefaultAccount(web3, {
                            ...txConfigParam,
                            ...{
                                value: txConfigParam && txConfigParam.value ? txConfigParam.value.toString() : undefined,
                                gasPrice: txConfigParam && txConfigParam.gasPrice ? txConfigParam.gasPrice.toString() : undefined,
                            },

                            ...txConfig,
                        }));

                        if (last) {
                            forwardWeb3Events(tx, promiEvent);
                        }

                        ethereumTxHash = await new Promise((resolve, reject) => tx
                            .on("transactionHash", resolve)
                            .catch((error: Error) => {
                                // tslint:disable-next-line: no-console
                                try { if (ignorePromiEventError(error)) { console.error(extractError(error)); return; } } catch (_error) { /* Ignore _error */ }
                                reject(error);
                            })
                        );
                    }
                }

                if (!ethereumTxHash) {
                    throw new Error("Must provide txHash or contract call details.");
                }

                burnReference = await extractBurnReference(web3, ethereumTxHash);
            }

            this.params.burnReference = burnReference;

            return this;

        })().then(promiEvent.resolve).catch(promiEvent.reject);

        // TODO: Look into why .catch isn't being called on tx
        promiEvent.on("error", (error) => {
            // tslint:disable-next-line: no-console
            try { if (ignorePromiEventError(error)) { console.error(extractError(error)); return; } } catch (_error) { /* Ignore _error */ }
            promiEvent.reject(error);
        });

        return promiEvent;
    }

    /**
     * txHash calculates the RenVM transaction hash for the burn. This is
     * used to track the progress of the release in RenVM.
     */
    public txHash = (): string => {
        const txHash = this.params.txHash;
        if (txHash) {
            return txHashToBase64(txHash);
        }

        if (!this.params.burnReference && this.params.burnReference !== 0) {
            throw new Error("Must call `readFromEthereum` before calling `txHash`");
        }
        const burnReference = new BigNumber(this.params.burnReference).toFixed();
        return generateBurnTxHash(resolveOutToken(this.params.sendToken), burnReference);
    }

    /**
     * queryTx requests the status of the burn from RenVM.
     */
    public queryTx = async () =>
        unmarshalBurnTx(await this.renVMNetwork.queryTX(Ox(Buffer.from(this.txHash(), "base64"))))

    /**
     * submit queries RenVM for the status of the burn until the funds are
     * released.
     *
     * @returns {PromiEvent<UnmarshalledBurnTx, { txHash: [string], status: [TxStatus] }>}
     */
    public submit = (): PromiEvent<UnmarshalledBurnTx, { txHash: [string], status: [TxStatus] }> => {
        const promiEvent = newPromiEvent<UnmarshalledBurnTx, { txHash: [string], status: [TxStatus] }>();

        (async () => {
            const { burnReference } = this.params;
            if (!this.params.txHash && (!burnReference && burnReference !== 0)) {
                throw new Error("Must call `readFromEthereum` before calling `submit`");
            }

            const txHash = this.txHash();

            // const txHash = await this.renVMNetwork.submitTokenFromEthereum(this.params.sendToken, burnReference);
            promiEvent.emit("txHash", txHash);

            const response = await this.renVMNetwork.waitForTX<ResponseQueryBurnTx>(
                Ox(Buffer.from(txHash, "base64")),
                (status) => {
                    promiEvent.emit("status", status);
                },
                () => promiEvent._isCancelled(),
            );
            return unmarshalBurnTx(response);
        })().then(promiEvent.resolve).catch(promiEvent.reject);

        return promiEvent;
    }
}
