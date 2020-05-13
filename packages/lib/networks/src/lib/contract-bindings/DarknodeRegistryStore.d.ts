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

export class DarknodeRegistryStore extends Contract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  );
  clone(): DarknodeRegistryStore;
  address: string;
  methods: {
    VERSION(): TransactionObject<string>;

    appendDarknode(
      _darknodeID: string,
      _darknodeOperator: string,
      _bond: number | string,
      _publicKey: string | number[],
      _registeredAt: number | string,
      _deregisteredAt: number | string
    ): TransactionObject<void>;

    begin(): TransactionObject<string>;

    blacklistRecoverableToken(_token: string): TransactionObject<void>;

    claimOwnership(): TransactionObject<void>;

    darknodeBond(darknodeID: string): TransactionObject<string>;

    darknodeDeregisteredAt(darknodeID: string): TransactionObject<string>;

    darknodeOperator(darknodeID: string): TransactionObject<string>;

    darknodePublicKey(darknodeID: string): TransactionObject<string>;

    darknodeRegisteredAt(darknodeID: string): TransactionObject<string>;

    initialize(_nextOwner: string): TransactionObject<void>;

    isOwner(): TransactionObject<boolean>;

    next(darknodeID: string): TransactionObject<string>;

    owner(): TransactionObject<string>;

    pendingOwner(): TransactionObject<string>;

    recoverTokens(_token: string): TransactionObject<void>;

    removeDarknode(darknodeID: string): TransactionObject<void>;

    ren(): TransactionObject<string>;

    renounceOwnership(): TransactionObject<void>;

    transferOwnership(newOwner: string): TransactionObject<void>;

    updateDarknodeBond(
      darknodeID: string,
      decreasedBond: number | string
    ): TransactionObject<void>;

    updateDarknodeDeregisteredAt(
      darknodeID: string,
      deregisteredAt: number | string
    ): TransactionObject<void>;
  };
  events: {
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
