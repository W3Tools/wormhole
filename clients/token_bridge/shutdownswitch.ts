import yargs from "yargs";

const {hideBin} = require('yargs/helpers')

import * as ethers from "ethers";
import * as web3s from '@solana/web3.js';

import {PublicKey, TransactionInstruction, AccountMeta, Keypair, Connection} from "@solana/web3.js";

import {setDefaultWasm, importCoreWasm, importTokenWasm, ixFromRust, BridgeImplementation__factory} from '@certusone/wormhole-sdk'
setDefaultWasm("node")

yargs(hideBin(process.argv))
    .command('cast_vote_on_evm', 'vote to enable / disable transaction processing', (yargs) => {
        return yargs
            .option('rpc', {
                alias: 'u',
                type: 'string',
                description: 'URL of the ETH RPC',
                default: "http://localhost:8545"
            })
            .option('bridge', {
                alias: 'b',
                type: 'string',
                description: 'Bridge address',
                default: "0x0290FB167208Af455bB137780163b7B7a9a10C16"
            })
            .option('key', {
                alias: 'k',
                type: 'string',
                description: 'Private key of the wallet',
                default: "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d"
            })
            .option('authproof', {
                alias: 'a',
                type: 'string',
                description: 'Authorization proof of the guardian / wallet combination, generated by admintemplate.go, default is for the default wallet and devnet guardian-0',
                default: "0x5f7e2dc4c9d1f3a7d111cd3581e1f185b3cf5ea01ac07414576778218f977bc05c611ae24e6743faf45a5d47c33e34727326702b113a9eba69d18cbf81f217b201"
            })
            .option('vote', {
                describe: '"enable" or "disable", where disable will vote to disable transaction processing"',
                type: "string",
                required: true
            })            
    }, async (argv: any) => {
        let provider = new ethers.providers.JsonRpcProvider(argv.rpc)
        let signer = new ethers.Wallet(argv.key, provider)
        let t = new BridgeImplementation__factory(signer);
        let tb = t.attach(argv.bridge);

        let vote = argv.vote as string;
        let enable = false;
        if (vote === "enable") {
            enable = true;
        } else if (vote !== "disable") {
            throw new Error("[" + vote + "] is an invalid vote, must be \"enable\" or \"disable\"");
        }

        console.log("Casting vote to " + vote + " transfers.");
        console.log("Hash: " + (await tb.castShutdownVote(argv.authproof, enable)).hash)
        console.log("Transaction processing is currently " + (await tb.enabledFlag() ? "enabled" : "disabled") + ", there are " + (await tb.numVotesToShutdown() + " votes to disable"));
    })
    .command('query_status_on_evm', 'query the current shutdown status', (yargs) => {
        return yargs
            .option('rpc', {
                alias: 'u',
                type: 'string',
                description: 'URL of the ETH RPC',
                default: "http://localhost:8545"
            })
            .option('bridge', {
                alias: 'b',
                type: 'string',
                description: 'Bridge address',
                default: "0x0290FB167208Af455bB137780163b7B7a9a10C16"
            })
            .option('key', {
                alias: 'k',
                type: 'string',
                description: 'Private key of the wallet',
                default: "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d"
            })
    }, async (argv: any) => {
        let provider = new ethers.providers.JsonRpcProvider(argv.rpc)
        let signer = new ethers.Wallet(argv.key, provider)
        let t = new BridgeImplementation__factory(signer);
        let tb = t.attach(argv.bridge);

        let numVotesToShutdown = await tb.numVotesToShutdown();
        console.log("Current shutdown status: " +
            ((await tb.enabledFlag()) ? "enabled" : "disabled") +
            ", numVotesToShutdown: " +
            numVotesToShutdown +
            ", requiredVotesToShutdown: " +
            (await tb.requiredVotesToShutdown())
        );

        if (numVotesToShutdown > 0) {
            let voters = await tb.currentVotesToShutdown();
            for (let voter of voters) {
                console.log("[" + voter + "] is voting to disable");
            }
        }
    })
    .command('listen_for_events_from_evm', 'listen for shutdown vote events', (yargs) => {
        return yargs
            .option('rpc', {
                alias: 'u',
                type: 'string',
                description: 'URL of the ETH RPC',
                default: "http://localhost:8545"
            })
            .option('token_bridge', {
                alias: 't',
                type: 'string',
                description: 'Token Bridge address',
                default: "0x0290FB167208Af455bB137780163b7B7a9a10C16"
            })
            .option('key', {
                alias: 'k',
                type: 'string',
                description: 'Private key of the wallet',
                default: "0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d"
            })
    }, async (argv: any) => {
        const bridge = await importCoreWasm()

        let provider = new ethers.providers.JsonRpcProvider(argv.rpc)
        let signer = new ethers.Wallet(argv.key, provider)
        let t = new BridgeImplementation__factory(signer);
        let tb = t.attach(argv.token_bridge);

        console.log("Listening for shutdown vote events.");

        tb.on('ShutdownVoteCast', function(voter, votedToEnable, numVotesToShutdown, enabledFlag, rawEvent) {
            console.log(new Date().toString() + ": ShutdownVoteCast:");
            console.log("   voter: [" + voter);
            console.log("   vote: " + votedToEnable);
            console.log("   numVotesToShutdown: " + numVotesToShutdown);
            console.log("   enabledFlag: " + enabledFlag);
            console.log("   sourceBridge: " + rawEvent.address);
            console.log("   txHash: " + rawEvent.transactionHash);
            console.log("");
        });

        tb.on('ShutdownStatusChanged', function(enabledFlag, numVotesToShutdown, rawEvent) {
            console.log(new Date().toString() + ": ShutdownStatusChanged:");
            console.log("   enabledFlag: " + enabledFlag);
            console.log("   numVotesToShutdown: " + numVotesToShutdown);
            console.log("   sourceBridge: " + rawEvent.address);
            console.log("   txHash: " + rawEvent.transactionHash);
            console.log("");
        });
    })
    .argv;
