/* Generated by ts-generator ver. 0.0.8 */
/* tslint:disable */

import BN from "bn.js";
import { Contract, ContractOptions } from "web3-eth-contract";
import { EventLog } from "web3-core";
import { EventEmitter } from "events";
import { ContractEvent, Callback, TransactionObject, BlockType } from "./types";

interface EventOptions {
  filter?: object;
  fromBlock?: BlockType;
  topics?: string[];
}

export class GatewayLogicV1 extends Contract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  );
  clone(): GatewayLogicV1;
  address: string;
  methods: {
    blacklistRecoverableToken(_token: string): TransactionObject<void>;

    burn(
      _to: string | number[],
      _amount: number | string
    ): TransactionObject<string>;

    burnFee(): TransactionObject<string>;

    claimOwnership(): TransactionObject<void>;

    claimTokenOwnership(): TransactionObject<void>;

    feeRecipient(): TransactionObject<string>;

    hashForSignature(
      _pHash: string | number[],
      _amount: number | string,
      _to: string,
      _nHash: string | number[]
    ): TransactionObject<string>;

    initialize(
      _token: string,
      _feeRecipient: string,
      _mintAuthority: string,
      _mintFee: number | string,
      _burnFee: number | string,
      _minimumBurnAmount: number | string
    ): TransactionObject<void>;

    isOwner(): TransactionObject<boolean>;

    minimumBurnAmount(): TransactionObject<string>;

    mint(
      _pHash: string | number[],
      _amountUnderlying: number | string,
      _nHash: string | number[],
      _sig: string | number[]
    ): TransactionObject<string>;

    mintAuthority(): TransactionObject<string>;

    mintFee(): TransactionObject<string>;

    nextN(): TransactionObject<string>;

    owner(): TransactionObject<string>;

    pendingOwner(): TransactionObject<string>;

    recoverTokens(_token: string): TransactionObject<void>;

    renounceOwnership(): TransactionObject<void>;

    status(arg0: string | number[]): TransactionObject<boolean>;

    token(): TransactionObject<string>;

    transferOwnership(newOwner: string): TransactionObject<void>;

    transferTokenOwnership(_nextTokenOwner: string): TransactionObject<void>;

    updateBurnFee(_nextBurnFee: number | string): TransactionObject<void>;

    updateFeeRecipient(_nextFeeRecipient: string): TransactionObject<void>;

    updateMinimumBurnAmount(
      _minimumBurnAmount: number | string
    ): TransactionObject<void>;

    updateMintAuthority(_nextMintAuthority: string): TransactionObject<void>;

    updateMintFee(_nextMintFee: number | string): TransactionObject<void>;

    verifySignature(
      _signedMessageHash: string | number[],
      _sig: string | number[]
    ): TransactionObject<boolean>;
  };
  events: {
    LogBurn: ContractEvent<{
      _to: string;
      _amount: string;
      _n: string;
      _indexedTo: string;
      0: string;
      1: string;
      2: string;
      3: string;
    }>;
    LogMint: ContractEvent<{
      _to: string;
      _amount: string;
      _n: string;
      _signedMessageHash: string;
      0: string;
      1: string;
      2: string;
      3: string;
    }>;
    LogMintAuthorityUpdated: ContractEvent<string>;
    OwnershipTransferred: ContractEvent<{
      previousOwner: string;
      newOwner: string;
      0: string;
      1: string;
    }>;
    allEvents: (
      options?: EventOptions,
      cb?: Callback<EventLog>
    ) => EventEmitter;
  };
}
