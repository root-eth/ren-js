import axios from "axios";
import BigNumber from "bignumber.js";
import bitcore, { Address, Networks, Script, Transaction } from "bitcore-lib";
import bs58 from "bs58";
import chai from "chai";
import chaiBigNumber from "chai-bignumber";
import { BN } from "ethereumjs-util";
import qrcode from "qrcode-terminal";
import HDWalletProvider from "truffle-hdwallet-provider";
import Web3 from "web3";
import { Contract } from "web3-eth-contract";
import { AbiItem } from "web3-utils";

import { payloadToABI } from "../src/abi";
import { Tokens } from "../src/assets";
import { Ox, strip0x } from "../src/blockchain/common";
import RenSDK, { getBTCTestnetUTXOs, ShiftObject } from "../src/index";
import { Network, NetworkTestnet } from "../src/networks";
import { Arg } from "../src/utils";

require("dotenv").config();

chai.use((chaiBigNumber)(BigNumber));
chai.should();

// tslint:disable:no-unused-expression

const USE_QRCODE = false;

const MNEMONIC = process.env.MNEMONIC;
// tslint:disable-next-line:mocha-no-side-effect-code
const INFURA_URL = `https://kovan.infura.io/v3/${process.env.INFURA_KEY}`;
const MERCURY_URL = `https://ren-mercury.herokuapp.com/btc-testnet3`;
const BITCOIN_KEY = process.env.TESTNET_BITCOIN_KEY;

/*

*MINTING*

`const shift = RenSDK.shift("BTC0Btc2Eth", renExAddress, 0.5 BTC (in sats), randomNonce, payload);`
`const gatewayAddress = await shift.addr();`
_user deposits BTC to gateway address_

`const deposit = await shift.wait(6 confirmations);`
_SDK waits for a BTC deposit_

`const signature = deposit.submit();`
_SDK calls sendMessage(gatewayAddress)_
_Darknodes see deposit and sign a mint request_

`signature.signAndSubmit(adapter, functionName)`
_SDK calls Web3.eth.Contract(adapter).functionName(mint request and signature)_
_e.g. on RenEx, this will mint BTC and swap it for DAI_

*BURNING*

_First, the front-end/user calls Web3.eth.Contract(adapter).burn() => LogShiftOut "1234"_

`RenSDK.burnStatus("1234", btcAddress)`
_Submit to darknodes => transaction hash_

 */

// The minimum ABI to approve and get ERC20 Token balance.
const minABI: AbiItem[] = [
    {
        constant: true,
        inputs: [
            {
                name: "account",
                type: "address"
            }
        ],
        name: "balanceOf",
        outputs: [
            {
                name: "",
                type: "uint256"
            }
        ],
        payable: false,
        stateMutability: "view",
        type: "function"
    },
    {
        constant: false,
        inputs: [
            {
                name: "spender",
                type: "address"
            }, {
                name: "value",
                type: "uint256"
            }
        ],
        name: "approve",
        outputs: [{
            name: "",
            type: "bool"
        }],
        payable: false,
        stateMutability: "nonpayable",
        type: "function"
    }
];

describe("SDK methods", function () {
    // Disable test timeout.
    this.timeout(0);

    let provider: HDWalletProvider;
    let web3: Web3;
    let network: Network;
    let sdk: RenSDK;
    let accounts: string[];

    before(async () => {
        provider = new HDWalletProvider(MNEMONIC, INFURA_URL, 0, 10);
        web3 = new Web3(provider);
        network = NetworkTestnet;
        sdk = new RenSDK(network);
        accounts = await web3.eth.getAccounts();
    });

    // tslint:disable-next-line:no-any
    const checkzBTCBalance = async (contract: Contract, address: string): Promise<any> => {
        let balance: BN;

        try {
            balance = new BN((await contract.methods.balanceOf(accounts[0]).call()).toString());
        } catch (error) {
            console.error("Cannot check balance");
            throw error;
        }

        return balance;
    };

    // tslint:disable-next-line:no-any
    const checkBTCBalance = async (address: string): Promise<any> => {
        const utxos = await getBTCTestnetUTXOs(address, 10, 0);
        let utxoAmount = new BN(0);
        for (const utxo of utxos) {
            utxoAmount = utxoAmount.add(new BN(utxo.amount));
        }
        return utxoAmount;
    };

    const mintTest = async (
        btcShifter: string, adapterContract: string, amount: number,
        ethAddress: string, fromAddress: string, btcAddress: string,
        btcPrivateKey: bitcore.PrivateKey,
        submit: (shift: ShiftObject, fromAddress: string) => Promise<void>,
    ): Promise<void> => {
        const params: Arg[] = [
            {
                name: "_shifter",
                type: "address",
                value: btcShifter,
            },
            {
                name: "_address",
                type: "address",
                value: ethAddress,
            }
        ];
        const shift = sdk.shift({
            sendToken: Tokens.BTC.Btc2Eth,
            sendTo: adapterContract,
            sendAmount: amount,
            contractFn: "shiftIn",
            contractParams: params,
        });
        const gatewayAddress = shift.addr();

        if (USE_QRCODE) {
            // Generate a QR code with the payment details - an alternative
            qrcode.generate(`bitcoin:${gatewayAddress}?amount=${amount / 10 ** 8}`, { small: true });
            console.log(`Please deposit ${amount / 10 ** 8} BTC to ${gatewayAddress}`);
        } else {
            // Deposit BTC to gateway address.
            const utxos = await getBTCTestnetUTXOs(btcAddress, 10, 0);
            const bitcoreUTXOs: Transaction.UnspentOutput[] = [];
            let utxoAmount = 0;
            for (const utxo of utxos) {
                if (utxoAmount >= amount) {
                    break;
                }
                const bitcoreUTXO = new Transaction.UnspentOutput({
                    txId: utxo.txHash,
                    outputIndex: utxo.vout,
                    address: new Address(btcAddress),
                    script: new Script(utxo.scriptPubKey),
                    satoshis: utxo.amount,
                });
                bitcoreUTXOs.push(bitcoreUTXO);
                utxoAmount += utxo.amount;
            }

            const transaction = new bitcore.Transaction().from(bitcoreUTXOs).to(gatewayAddress, amount).change(new Address(btcAddress)).sign(btcPrivateKey);

            console.log(`Transferring ${amount / 10 ** 8} BTC to ${gatewayAddress} (from ${btcAddress})`);
            try {
                await axios.post(`${MERCURY_URL}/tx`, { stx: transaction.toString() });
            } catch (error) {
                console.log(`Unable to submit to Mercury (${error}). Trying chain.so...`);
                try {
                    console.log(transaction.toString());
                    await axios.post("https://chain.so/api/v2/send_tx/BTCTEST", { tx_hex: transaction.toString() });
                } catch (chainError) {
                    console.error(`chain.so returned error ${chainError.message}`);
                    console.log(`\n\n\nPlease check ${btcAddress}'s balance!\n`);
                    throw error;
                }
            }
        }

        await submit(shift, fromAddress);
    };

    const submitIndividual = async (shift: ShiftObject, fromAddress: string): Promise<void> => {
        // Wait for deposit to be received and submit to Lightnode + Ethereum.
        const confirmations = 0;
        console.log(`Waiting for ${confirmations} confirmations...`);
        const depositPromise = shift.wait(confirmations);
        depositPromise.on("deposit", (message) => { console.log(`[EVENT] Received a new deposit: ${JSON.stringify(message)}`); });
        const deposit = await depositPromise;
        console.log(`Submitting deposit!`);
        const signaturePromise = deposit.submit();
        signaturePromise.on("messageID", (message) => console.log(`[EVENT] Received messageID: ${message}`));
        const signature = await signaturePromise;
        console.log(`Submitting signature!`);
        const result = await signature.signAndSubmit(web3, fromAddress);
        console.log(result);
    };

    const submitTogether = async (shift: ShiftObject, fromAddress: string): Promise<void> => {
        // Wait for deposit to be received and submit to Lightnode + Ethereum.
        const confirmations = 0;
        const result = await shift.waitAndSubmit(web3, fromAddress, confirmations);
        console.log(result);
    };

    const burnTest = async (zBTCContract: Contract, btcShifter: string, adapterContract: string, amount: number, ethAddress: string, btcAddress: string) => {
        // Approve contract to spend zBTC.
        const approvePayload: Arg[] = [
            {
                name: "spender",
                type: "address",
                value: adapterContract,
            },
            {
                name: "value",
                type: "uint256",
                value: Ox(amount.toString(16)),
            },
        ];
        const approveParams = [
            ...approvePayload.map(value => value.value),
        ];

        console.log("Approving contract.");
        await zBTCContract.methods.approve(
            ...approveParams,
        ).send({ from: ethAddress, gas: 1000000 });

        // Send burn request to adapter contract.
        const payload: Arg[] = [
            {
                name: "_shifter",
                type: "address",
                value: btcShifter,
            },
            {
                name: "_to",
                type: "bytes",
                value: Ox(bs58.decode(btcAddress).toString("hex")),
            },
            {
                name: "_amount",
                type: "uint256",
                value: Ox(amount.toString(16)),
            },
        ];
        const ABI = payloadToABI("shiftOut", payload);
        const contract = new web3.eth.Contract(ABI, adapterContract);
        const params = [
            ...payload.map(value => value.value),
        ];
        console.log("Burning tokens.");

        const result = await contract.methods.shiftOut(
            ...params,
        ).send({ from: ethAddress, gas: 1000000 });
        console.log(result);

        const response = await sdk.burnDetails({
            web3,
            sendToken: Tokens.BTC.Eth2Btc,
            txHash: result.transactionHash,
        });
        console.log(response);
    };

    const removeVMFee = (value: BN): BN => value.sub(new BN(10000));
    const removeGasFee = (value: BN, bips: number): BN => value.sub(value.mul(new BN(bips)).div(new BN(10000)));

    it("should be able to mint and burn btc", async () => {
        const adapterContract = "0xC99Ab5d1d0fbf99912dbf0DA1ADC69d4a3a1e9Eb";
        const amount = 0.000225 * (10 ** 8);
        const ethAddress = accounts[0];
        const fromAddress = accounts[0];
        const btcPrivateKey = new bitcore.PrivateKey(BITCOIN_KEY, Networks.testnet);
        const btcAddress = btcPrivateKey.toAddress().toString();
        const zBTCContract = new web3.eth.Contract(minABI, strip0x(network.zBTC));

        // Test minting.
        console.log("Starting mint test:");
        const initialzBTCBalance = await checkzBTCBalance(zBTCContract, ethAddress);
        await mintTest(network.BTCShifter, adapterContract, amount, ethAddress, fromAddress, btcAddress, btcPrivateKey, submitIndividual);
        const finalzBTCBalance = await checkzBTCBalance(zBTCContract, ethAddress);

        // Check the minted amount is at least (amount - renVM fee - 10 bips) and at most (amount - renVM fee).
        const balance = finalzBTCBalance.sub(initialzBTCBalance); // BN
        balance.should.bignumber.least(removeVMFee(removeGasFee(new BN(amount), 10)));
        balance.should.bignumber.most(removeVMFee(new BN(amount)));

        // Test burning.
        console.log("Starting burn test:");
        const initialBTCBalance = await checkBTCBalance(btcAddress);
        await burnTest(zBTCContract, network.BTCShifter, adapterContract, balance.toNumber(), ethAddress, btcAddress);
        const finalBTCBalance = await checkBTCBalance(btcAddress);

        finalBTCBalance.sub(initialBTCBalance).should.bignumber.least(removeVMFee(removeGasFee(new BN(balance), 10)));
        finalBTCBalance.sub(initialBTCBalance).should.bignumber.most(removeVMFee(new BN(balance)));
    });

    it("should be able to mint using the helper function", async () => {
        const adapterContract = "0xC99Ab5d1d0fbf99912dbf0DA1ADC69d4a3a1e9Eb";
        const amount = 0.000225 * (10 ** 8);
        const ethAddress = accounts[0];
        const fromAddress = accounts[0];
        const btcPrivateKey = new bitcore.PrivateKey(BITCOIN_KEY, Networks.testnet);
        const btcAddress = btcPrivateKey.toAddress().toString();
        const zBTCContract = new web3.eth.Contract(minABI, strip0x(network.zBTC));

        console.log("Starting mint test:");
        const initialzBTCBalance = await checkzBTCBalance(zBTCContract, ethAddress);
        await mintTest(network.BTCShifter, adapterContract, amount, ethAddress, fromAddress, btcAddress, btcPrivateKey, submitTogether);
        const finalzBTCBalance = await checkzBTCBalance(zBTCContract, ethAddress);

        // Check the minted amount is at least (amount - renVM fee - 10 bips) and at most (amount - renVM fee).
        const balance = finalzBTCBalance.sub(initialzBTCBalance); // BN
        balance.should.bignumber.least(removeVMFee(removeGasFee(new BN(amount), 10)));
        balance.should.bignumber.most(removeVMFee(new BN(amount)));
    });
});
