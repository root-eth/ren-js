import { expect } from "chai";

import { Bitcoin } from "../src";

describe("Utils", () => {
    it("validateTransaction", () => {
        const bitcoin = new Bitcoin({
            network: "testnet",
        });

        expect(
            bitcoin.validateTransaction({
                txidFormatted:
                    "a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d",
            }),
        ).to.be.true;

        expect(
            bitcoin.validateTransaction({
                txidFormatted:
                    "a1075db55d416d3ca199f55b6084e2115b9345e16c5cf302fc80e9d5fbf5d48d",
                txid: "jdT1-9XpgPwC81xs4UWTWxHihGBb9ZmhPG1BXbVdB6E",
                txindex: "1",
            }),
        ).to.be.true;
    });
});
