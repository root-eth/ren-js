import {
    crossChainParamsType,
    RenVMCrossChainTransaction,
    RenVMProvider,
    RenVMTransaction,
    RenVMTransactionWithStatus,
    TransactionInput,
} from "@renproject/provider";
import {
    ChainTransactionProgress,
    ChainTransactionStatus,
    ErrorWithCode,
    eventEmitter,
    EventEmitterTyped,
    generateTransactionHash,
    PromiEvent,
    RenJSError,
    TxStatus,
    TxSubmitter,
    TypedPackValue,
    utils,
} from "@renproject/utils";

export class RenVMTxSubmitter<Transaction extends RenVMTransaction>
    implements
        TxSubmitter<
            ChainTransactionProgress & {
                response?: RenVMTransactionWithStatus<Transaction>;
            }
        >
{
    public chain = "RenVM";
    private provider: RenVMProvider;
    public tx: TransactionInput<TypedPackValue>;

    private signatureCallback?: (
        response: RenVMTransactionWithStatus<Transaction>,
    ) => Promise<void>;
    public eventEmitter: EventEmitterTyped<{
        progress: [
            ChainTransactionProgress & {
                response?: RenVMTransactionWithStatus<Transaction>;
            },
        ];
    }>;

    public progress: ChainTransactionProgress & {
        response?: RenVMTransactionWithStatus<Transaction>;
    };

    private updateProgress = (
        progress: Partial<
            ChainTransactionProgress & {
                response?: RenVMTransactionWithStatus<Transaction>;
            }
        >,
    ) => {
        const currentProgress = this.progress;
        this.progress = {
            ...currentProgress,
            ...progress,
        };
        this.eventEmitter.emit("progress", this.progress);
        return this.progress;
    };

    public constructor(
        provider: RenVMProvider,
        tx: {
            hash?: string;
            version?: string;
            selector: string;
            in: TypedPackValue;
        },
        signatureCallback?: (
            response: RenVMTransactionWithStatus<Transaction>,
        ) => Promise<void>,
    ) {
        this.provider = provider;
        this.eventEmitter = eventEmitter();
        this.signatureCallback = signatureCallback;

        const version = tx.version || "1";
        const expectedHash = utils.toURLBase64(
            generateTransactionHash(version, tx.selector, tx.in),
        );
        if (tx.hash && tx.hash !== expectedHash) {
            throw new Error(
                `Invalid hash (expected '${expectedHash}', got '${tx.hash}').`,
            );
        }
        const hash = tx.hash || expectedHash;
        this.tx = {
            ...tx,
            version,
            hash,
        };

        this.progress = {
            chain: this.chain,
            status: ChainTransactionStatus.Ready,
            target: 1,
            transaction: {
                chain: this.chain,
                txid: this.tx.hash,
                txidFormatted: this.tx.hash,
                txindex: "0",
            },
        };
    }

    public export(): TransactionInput<TypedPackValue> {
        return this.tx;
    }

    public async query(): Promise<
        ChainTransactionProgress & {
            response?: RenVMTransactionWithStatus<Transaction>;
        }
    > {
        const tx: RenVMTransactionWithStatus<Transaction> =
            await this.provider.queryTx(this.tx.hash, 1);

        if (
            tx.txStatus === TxStatus.TxStatusDone ||
            tx.txStatus === TxStatus.TxStatusReverted
        ) {
            return this._handleDoneTransaction(tx);
        } else {
            return this.updateProgress({
                response: tx,
                status: ChainTransactionStatus.Confirming,
            });
        }
    }

    public submit = (): PromiEvent<
        ChainTransactionProgress & {
            response?: RenVMTransactionWithStatus<Transaction>;
        },
        {
            progress: [
                ChainTransactionProgress & {
                    response?: RenVMTransactionWithStatus<Transaction>;
                },
            ];
        }
    > => {
        const promiEvent = utils.newPromiEvent<
            ChainTransactionProgress & {
                response?: RenVMTransactionWithStatus<Transaction>;
            },
            {
                progress: [
                    ChainTransactionProgress & {
                        response?: RenVMTransactionWithStatus<Transaction>;
                    },
                ];
            }
        >(this.eventEmitter);

        (async (): Promise<
            ChainTransactionProgress & {
                response?: RenVMTransactionWithStatus<Transaction>;
            }
        > => {
            // Alternate trying to submit and trying to query.
            const retries = 4;
            let errorInner;
            for (let i = 0; i < retries; i++) {
                try {
                    await this.provider.submitTx(this.tx, 1);
                    break;
                } catch (error: unknown) {
                    errorInner = error;
                }
                try {
                    await this.provider.queryTx(this.tx.hash, 1);
                    break;
                } catch (error: unknown) {
                    // Ignore error.
                }
                if (i === retries - 1) {
                    throw errorInner;
                }
            }

            if (this.progress.status === ChainTransactionStatus.Ready) {
                return this.updateProgress({
                    status: ChainTransactionStatus.Confirming,
                    confirmations: 0,
                });
            } else {
                return this.progress;
            }

            // const response = {
            //     version: parseInt(tx.version),
            //     hash: tx.hash,
            //     selector: tx.selector,
            //     in: unmarshalTypedPackValue(tx.in),
            // };
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };

    public wait = (): PromiEvent<
        ChainTransactionProgress & {
            response?: RenVMTransactionWithStatus<Transaction>;
        },
        {
            progress: [
                ChainTransactionProgress & {
                    response?: RenVMTransactionWithStatus<Transaction>;
                },
            ];
        }
    > => {
        const promiEvent = utils.newPromiEvent<
            ChainTransactionProgress & {
                response?: RenVMTransactionWithStatus<Transaction>;
            },
            {
                progress: [
                    ChainTransactionProgress & {
                        response?: RenVMTransactionWithStatus<Transaction>;
                    },
                ];
            }
        >(this.eventEmitter);

        (async (): Promise<
            ChainTransactionProgress & {
                response?: RenVMTransactionWithStatus<Transaction>;
            }
        > => {
            let tx: RenVMTransactionWithStatus<Transaction>;
            let existingStatus: TxStatus | undefined = undefined;
            while (true) {
                try {
                    tx = await this.provider.queryTx(this.tx.hash, 1);
                    if (
                        tx.txStatus === TxStatus.TxStatusDone ||
                        tx.txStatus === TxStatus.TxStatusReverted
                    ) {
                        break;
                    }
                    if (
                        tx.txStatus !== existingStatus ||
                        !this.progress.response
                    ) {
                        try {
                            existingStatus = tx.txStatus;
                            this.updateProgress({
                                response: tx,
                                status: ChainTransactionStatus.Confirming,
                                confirmations: 0,
                            });
                        } catch (error: unknown) {
                            // Ignore non-critical error.
                        }
                    }
                } catch (error: unknown) {
                    if (
                        error instanceof Error &&
                        /(not found)|(not available)/.exec(
                            String((error || {}).message),
                        )
                    ) {
                        // ignore
                    } else {
                        console.error(error);
                        // TODO: throw unexpected errors
                    }
                }
                await utils.sleep(15 * utils.sleep.SECONDS);
            }

            return await this._handleDoneTransaction(tx);
        })()
            .then(promiEvent.resolve)
            .catch(promiEvent.reject);

        return promiEvent;
    };

    /**
     * Process a complete RenVM transaction, handling checking for a revert
     * reason and calling the signatureCallback.
     */
    private _handleDoneTransaction = async (
        tx: RenVMTransactionWithStatus<Transaction>,
    ) => {
        if (tx.tx.out && tx.tx.out.revert && tx.tx.out.revert.length > 0) {
            const revertMessage: string = tx.tx.out.revert;
            this.updateProgress({
                status: ChainTransactionStatus.Reverted,
                revertReason: revertMessage,
                confirmations: 1,
            });
            throw new ErrorWithCode(
                `RenVM transaction reverted: ${revertMessage}`,
                RenJSError.RENVM_TRANSACTION_REVERTED,
            );
        }

        if (this.signatureCallback) {
            await this.signatureCallback(tx);
        }

        return this.updateProgress({
            response: tx,
            status: ChainTransactionStatus.Done,
            confirmations: 1,
        });
    };
}

export class RenVMCrossChainTxSubmitter extends RenVMTxSubmitter<RenVMCrossChainTransaction> {
    public constructor(
        provider: RenVMProvider,
        selector: string,
        params: RenVMCrossChainTransaction["in"],
        signatureCallback?: (
            response: RenVMTransactionWithStatus<RenVMCrossChainTransaction>,
        ) => Promise<void>,
    ) {
        super(
            provider,
            {
                selector,
                in: {
                    t: crossChainParamsType,
                    v: {
                        txid: utils.toURLBase64(params.txid),
                        txindex: params.txindex.toFixed(),
                        amount: params.amount.toFixed(),
                        payload: utils.toURLBase64(params.payload),
                        phash: utils.toURLBase64(params.phash),
                        to: params.to,
                        nonce: utils.toURLBase64(params.nonce),
                        nhash: utils.toURLBase64(params.nhash),
                        gpubkey: utils.toURLBase64(params.gpubkey),
                        ghash: utils.toURLBase64(params.ghash),
                    },
                },
            },
            signatureCallback,
        );
    }
}
