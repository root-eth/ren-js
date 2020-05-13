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

export class DarknodeRegistryProxy extends Contract {
  constructor(
    jsonInterface: any[],
    address?: string,
    options?: ContractOptions
  );
  clone(): DarknodeRegistryProxy;
  address: string;
  methods: {
    admin(): TransactionObject<string>;

    changeAdmin(newAdmin: string): TransactionObject<void>;

    implementation(): TransactionObject<string>;

    initialize(
      _logic: string,
      _admin: string,
      _data: string | number[]
    ): TransactionObject<void>;

    upgradeTo(newImplementation: string): TransactionObject<void>;

    upgradeToAndCall(
      newImplementation: string,
      data: string | number[]
    ): TransactionObject<void>;
  };
  events: {
    AdminChanged: ContractEvent<{
      previousAdmin: string;
      newAdmin: string;
      0: string;
      1: string;
    }>;
    Upgraded: ContractEvent<string>;
    allEvents: (
      options?: EventOptions,
      cb?: Callback<EventLog>
    ) => EventEmitter;
  };
}
