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

export class DarknodeSlasher extends Contract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  );
  clone(): DarknodeSlasher;
  address: string;
  methods: {
    blacklist(_guilty: string): TransactionObject<void>;

    blacklistSlashPercent(): TransactionObject<string>;

    blacklisted(arg0: string): TransactionObject<boolean>;

    claimOwnership(): TransactionObject<void>;

    darknodeRegistry(): TransactionObject<string>;

    initialize(_nextOwner: string): TransactionObject<void>;

    isOwner(): TransactionObject<boolean>;

    maliciousSlashPercent(): TransactionObject<string>;

    owner(): TransactionObject<string>;

    pendingOwner(): TransactionObject<string>;

    renounceOwnership(): TransactionObject<void>;

    secretRevealSlashPercent(): TransactionObject<string>;

    secretRevealed(arg0: string): TransactionObject<boolean>;

    setBlacklistSlashPercent(
      _percentage: number | string
    ): TransactionObject<void>;

    setMaliciousSlashPercent(
      _percentage: number | string
    ): TransactionObject<void>;

    setSecretRevealSlashPercent(
      _percentage: number | string
    ): TransactionObject<void>;

    slash(
      _guilty: string,
      _challenger: string,
      _percentage: number | string
    ): TransactionObject<void>;

    slashDuplicatePrecommit(
      _height: number | string,
      _round: number | string,
      _blockhash1: string | number[],
      _signature1: string | number[],
      _blockhash2: string | number[],
      _signature2: string | number[]
    ): TransactionObject<void>;

    slashDuplicatePrevote(
      _height: number | string,
      _round: number | string,
      _blockhash1: string | number[],
      _signature1: string | number[],
      _blockhash2: string | number[],
      _signature2: string | number[]
    ): TransactionObject<void>;

    slashDuplicatePropose(
      _height: number | string,
      _round: number | string,
      _blockhash1: string | number[],
      _validRound1: number | string,
      _signature1: string | number[],
      _blockhash2: string | number[],
      _validRound2: number | string,
      _signature2: string | number[]
    ): TransactionObject<void>;

    slashSecretReveal(
      _a: number | string,
      _b: number | string,
      _c: number | string,
      _d: number | string,
      _e: number | string,
      _f: number | string,
      _signature: string | number[]
    ): TransactionObject<void>;

    slashed(
      arg0: number | string,
      arg1: number | string,
      arg2: string
    ): TransactionObject<boolean>;

    transferOwnership(newOwner: string): TransactionObject<void>;

    updateDarknodeRegistry(_darknodeRegistry: string): TransactionObject<void>;
  };
  events: {
    LogDarknodeRegistryUpdated: ContractEvent<{
      _previousDarknodeRegistry: string;
      _nextDarknodeRegistry: string;
      0: string;
      1: string;
    }>;
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
