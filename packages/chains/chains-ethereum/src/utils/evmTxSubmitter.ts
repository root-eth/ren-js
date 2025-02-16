import {
    Contract,
    PayableOverrides,
    PopulatedTransaction,
    Signer,
} from "ethers";
import { Logger } from "ethers/lib/utils";

import {
    TransactionReceipt,
    TransactionResponse,
} from "@ethersproject/providers";
import {
    ChainTransaction,
    ChainTransactionProgress,
    ChainTransactionStatus,
    ErrorWithCode,
    eventEmitter,
    EventEmitterTyped,
    PromiEvent,
    TxSubmitter,
    utils,
} from "@renproject/utils";

import { AbiItem } from "./abi";
import { txHashToChainTransaction } from "./generic";
import {
    EVMParamValues,
    EVMPayload,
    PayloadHandler,
} from "./payloads/evmPayloadHandlers";
import { EVMNetworkConfig } from "./types";

/** Fix numeric values in the transaction config. */
export const fixEVMTransactionConfig = (
    ...txConfigs: Array<PayableOverrides | undefined>
): PayableOverrides => {
    let result: PayableOverrides = {};
    for (const txConfig of txConfigs) {
        result = {
            ...result,
            ...txConfig,
        };
        if (utils.isDefined(result.value)) {
            result.value = result.value.toString();
        }
        if (utils.isDefined(result.gasPrice)) {
            result.gasPrice = result.gasPrice.toString();
        }
    }
    return result;
};

/**
 * Call a method on an EVM contract from the provided signer.
 *
 * @param signer An Ethers signer to make the call from.
 * @param to The EVM contract's address.
 * @param abi The ABI of the method being called.
 * @param params The parameters for the method, as defined by the ABI.
 * @param txConfig Optional EVM transaction config.
 * @returns An unconfirmed transaction response.
 */
export const callContract = async (
    signer: Signer,
    to: string,
    abi: AbiItem,
    params: unknown[],
    txConfig?: PayableOverrides,
): Promise<TransactionResponse> => {
    if (!abi.name) {
        throw new Error(`ABI must include method name.`);
    }

    const contract = new Contract(to, [abi], signer);

    return await contract[abi.name](
        ...params,
        fixEVMTransactionConfig(txConfig),
    );
};

/**
 * EVMTxSubmitter handles submitting and waiting for EVM transactions.
 */
export class EVMTxSubmitter
    implements
        TxSubmitter<
            ChainTransactionProgress,
            PayableOverrides,
            PopulatedTransaction
        >
{
    public chain: string;
    public progress: ChainTransactionProgress;
    public eventEmitter: EventEmitterTyped<{
        progress: [ChainTransactionProgress];
    }>;

    private network: EVMNetworkConfig;
    private getSigner: () => Signer | undefined;
    private payload: EVMPayload;
    private tx?: TransactionResponse;
    private getPayloadHandler: (payloadType: string) => PayloadHandler;
    private getParams: () => EVMParamValues;
    private onReceipt?: (tx: TransactionReceipt) => void;
    public findExistingTransaction?: () => Promise<
        ChainTransaction | undefined
    >;

    private updateProgress(progress: Partial<ChainTransactionProgress>) {
        this.progress = {
            ...this.progress,
            ...progress,
        };
        this.eventEmitter.emit("progress", this.progress);
        return this.progress;
    }

    public constructor({
        network,
        getSigner,
        chain,
        payload,
        target,
        getPayloadHandler,
        getParams,
        onReceipt,
        findExistingTransaction,
    }: {
        network: EVMNetworkConfig;
        getSigner: () => Signer | undefined;
        chain: string;
        payload: EVMPayload;
        target: number;
        getPayloadHandler: (payloadType: string) => PayloadHandler;
        getParams: () => EVMParamValues;
        onReceipt?: (tx: TransactionReceipt) => void;
        findExistingTransaction?: () => Promise<ChainTransaction | undefined>;
    }) {
        this.network = network;
        this.getSigner = getSigner;
        this.chain = chain;
        this.payload = payload;
        this.getPayloadHandler = getPayloadHandler;
        this.getParams = getParams;
        this.onReceipt = onReceipt;
        this.findExistingTransaction = findExistingTransaction;

        this.eventEmitter = eventEmitter();

        this.progress = {
            chain,
            status: ChainTransactionStatus.Ready,
            confirmations: 0,
            target: target,
        };
    }

    public async export(
        options: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            overrides?: any[];
            txConfig?: PayableOverrides;
        } = {},
    ): Promise<PopulatedTransaction> {
        return await this.getPayloadHandler(this.payload.type).export({
            network: this.network,
            signer: this.getSigner(),
            payload: this.payload,
            evmParams: this.getParams(),
            overrides: options,
            getPayloadHandler: this.getPayloadHandler,
        });
    }

    public submit = (
        options: {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            overrides?: any[];
            txConfig?: PayableOverrides;
        } = {},
    ): PromiEvent<
        ChainTransactionProgress,
        {
            progress: [ChainTransactionProgress];
        }
    > => {
        const promiEvent = utils.newPromiEvent<
            ChainTransactionProgress,
            {
                progress: [ChainTransactionProgress];
            }
        >(this.eventEmitter);

        (async (): Promise<ChainTransactionProgress> => {
            const signer = this.getSigner();
            if (!signer) {
                throw new Error(`Must connect ${this.chain} signer.`);
            }
            if (this.findExistingTransaction && signer.provider) {
                const existingTransaction =
                    await this.findExistingTransaction();

                if (existingTransaction) {
                    if (existingTransaction.txidFormatted === "") {
                        this.updateProgress({
                            status: ChainTransactionStatus.Done,
                            confirmations: this.progress.target,
                        });
                        return this.progress;
                    }
                    this.tx = await signer.provider.getTransaction(
                        existingTransaction.txidFormatted,
                    );
                }
            }

            if (!this.tx) {
                if (!signer.provider) {
                    throw new Error("EVM signer has no connected provider.");
                }
                const tx = await this.getPayloadHandler(
                    this.payload.type,
                ).export({
                    network: this.network,
                    signer: signer,
                    payload: this.payload,
                    evmParams: this.getParams(),
                    overrides: options,
                    getPayloadHandler: this.getPayloadHandler,
                });
                // `populateTransaction` fills in the missing details - e.g.
                // gas details. It's commented out because it seems that it's
                // better to calculate this in the `sendTransaction` step.
                // const populatedTx = await signer.populateTransaction(tx);
                this.tx = await signer.sendTransaction(tx);
            }

            this.updateProgress({
                status: ChainTransactionStatus.Confirming,
                transaction: txHashToChainTransaction(this.chain, this.tx.hash),
                confirmations: this.tx.confirmations,
            });

            return this.progress;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };

    public wait = (
        target?: number,
    ): PromiEvent<
        ChainTransactionProgress,
        {
            progress: [ChainTransactionProgress];
        }
    > => {
        const promiEvent = utils.newPromiEvent<
            ChainTransactionProgress,
            {
                progress: [ChainTransactionProgress];
            }
        >(this.eventEmitter);

        (async (): Promise<ChainTransactionProgress> => {
            if (this.progress.status === ChainTransactionStatus.Ready) {
                throw new Error(`Must call ".submit" first.`);
            }

            target = utils.isDefined(target) ? target : this.progress.target;

            // Wait for each confirmation until the target is reached.
            while (
                this.tx &&
                (this.tx.confirmations < target || this.onReceipt)
            ) {
                try {
                    const receipt = await this.tx.wait(
                        Math.min(this.tx.confirmations + 1, target),
                    );
                    if (this.onReceipt) {
                        const onReceipt = this.onReceipt;
                        this.onReceipt = undefined;
                        onReceipt(receipt);
                    }
                    const existingConfirmations = this.tx.confirmations;
                    this.tx.confirmations = receipt.confirmations;

                    if (receipt.confirmations > existingConfirmations) {
                        this.updateProgress({
                            ...this.progress,
                            status:
                                this.tx.confirmations < this.progress.target
                                    ? ChainTransactionStatus.Confirming
                                    : ChainTransactionStatus.Done,
                            transaction: txHashToChainTransaction(
                                this.chain,
                                this.tx.hash,
                            ),
                            confirmations: this.tx.confirmations,
                        });
                    }
                } catch (error: unknown) {
                    if (ErrorWithCode.isErrorWithCode(error)) {
                        if (error.code === Logger.errors.TRANSACTION_REPLACED) {
                            // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion,@typescript-eslint/no-explicit-any
                            const replacement = (error as any)
                                .replacement as TransactionResponse;
                            const previousTx = this.tx;
                            this.tx = replacement;

                            this.updateProgress({
                                status: ChainTransactionStatus.Confirming,
                                transaction: txHashToChainTransaction(
                                    this.chain,
                                    replacement.hash,
                                ),
                                target: target,
                                confirmations: replacement.confirmations,

                                replaced: txHashToChainTransaction(
                                    this.chain,
                                    previousTx.hash,
                                ),
                            });

                            continue;
                        } else if (
                            error.code === Logger.errors.CALL_EXCEPTION
                        ) {
                            this.updateProgress({
                                status: ChainTransactionStatus.Reverted,
                                transaction: txHashToChainTransaction(
                                    this.chain,
                                    this.tx.hash,
                                ),
                                target: target,
                                // eslint-disable-next-line @typescript-eslint/no-unnecessary-type-assertion,@typescript-eslint/no-explicit-any
                                confirmations: (error as any).receipt
                                    .confirmations,
                                revertReason: error.message,
                            });

                            throw error;
                        }
                    }
                    console.error(error);
                    continue;
                }
            }

            if (
                this.progress.status !== ChainTransactionStatus.Done &&
                this.tx &&
                this.tx.confirmations >= this.progress.target
            ) {
                this.updateProgress({
                    status: ChainTransactionStatus.Done,
                });
            }

            return this.progress;
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };
}
