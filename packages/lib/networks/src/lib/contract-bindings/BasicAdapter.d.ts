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

export class BasicAdapter extends Contract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  );
  clone(): BasicAdapter;
  address: string;
  methods: {
    acceptRelayedCall(
      relay: string,
      from: string,
      encodedFunction: string | number[],
      transactionFee: number | string,
      gasPrice: number | string,
      gasLimit: number | string,
      nonce: number | string,
      approvalData: string | number[],
      maxPossibleCharge: number | string
    ): TransactionObject<{
      0: string;
      1: string;
    }>;

    burn(
      _symbol: string,
      _to: string | number[],
      _amount: number | string
    ): TransactionObject<void>;

    getHubAddr(): TransactionObject<string>;

    initialize(): TransactionObject<void>;

    mint(
      _symbol: string,
      _recipient: string,
      _amount: number | string,
      _nHash: string | number[],
      _sig: string | number[]
    ): TransactionObject<void>;

    postRelayedCall(
      context: string | number[],
      success: boolean,
      actualCharge: number | string,
      preRetVal: string | number[]
    ): TransactionObject<void>;

    preRelayedCall(context: string | number[]): TransactionObject<string>;

    relayHubVersion(): TransactionObject<string>;

    setDefaultRelayHub(): TransactionObject<void>;
  };
  events: {
    RelayHubChanged: ContractEvent<{
      oldRelayHub: string;
      newRelayHub: string;
      0: string;
      1: string;
    }>;
    allEvents: (
      options?: EventOptions,
      cb?: Callback<EventLog>
    ) => EventEmitter;
  };
}
