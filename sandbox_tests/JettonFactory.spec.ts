import {
  Blockchain,
  SandboxContract,
  TreasuryContract,
  internal,
  BlockchainSnapshot,
} from "@ton/sandbox";
import { Cell, toNano, beginCell, Address, OpenedContract } from "@ton/core";
import { JettonWallet } from "../wrappers/JettonWallet";
import { JettonFactory } from "../wrappers/JettonFactory";
import {
  JettonMinter,
  jettonContentToCell,
} from "../wrappers/JettonMinterStoppable";
import "@ton/test-utils";
import { compile } from "@ton/blueprint";
import { prettyLogTransactions, printTransactionFees } from "@ton/sandbox";
import {
  randomAddress,
  getRandomTon,
  differentAddress,
  getRandomInt,
  testJettonTransfer,
  testJettonInternalTransfer,
  testJettonNotification,
  testJettonBurnNotification,
} from "./utils";
import { Op, Errors } from "../wrappers/JettonConstants";

let fwd_fee = 1804014n,
  gas_consumption = 15000000n,
  min_tons_for_storage = 10000000n;

describe("JettonFactory", () => {
  let jwallet_code = new Cell();
  let minter_code = new Cell();
  let factory_code = new Cell();
  let blockchain: Blockchain;
  let deployer: SandboxContract<TreasuryContract>;
  let notDeployer: SandboxContract<TreasuryContract>;
  let jettonFactory: SandboxContract<JettonFactory>;
  let jettonMinter: SandboxContract<JettonMinter>;
  let userWallet: (address: Address) => Promise<SandboxContract<JettonWallet>>;
  let defaultContent: Cell;

  beforeEach(async () => {
    jwallet_code = await compile("JettonWallet");
    minter_code = await compile("JettonMinter");
    factory_code = await compile("JettonFactory");
    blockchain = await Blockchain.create();
    deployer = await blockchain.treasury("deployer");
    notDeployer = await blockchain.treasury("notDeployer");
    defaultContent = jettonContentToCell({
      type: 1,
      uri: "https://testjetton.org/content.json",
    });
    jettonFactory = blockchain.openContract(
      JettonFactory.createFromConfig(
        {
          admin_address: deployer.address,
          jetton_master_code: minter_code,
          jetton_wallet_code: jwallet_code,
        },
        factory_code
      )
    );
    userWallet = async (address: Address) =>
      blockchain.openContract(
        JettonWallet.createFromAddress(
          await jettonMinter.getWalletAddress(address)
        )
      );

    let deployResult = await jettonFactory.sendDeploy(
      deployer.getSender(),
      toNano("1")
    );

    expect(deployResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: jettonFactory.address,
      deploy: true,
      success: true,
    });
  });

  it("should deploy JettonFactory", async () => {});

  it("should set admin correctly", async () => {
    let admin = await jettonFactory.getAdmin();
    // console.log("admin", admin);
    // console.log("deployer.address", deployer.address);
    expect(admin.toString()).toEqual(deployer.address.toString());
  });

  it("should deploy JettonMinter with no premint", async () => {
    let deployMinterResult =
      await jettonFactory.sendCreateJettonMasterNoPremint(
        deployer.getSender(),
        toNano("0"),
        deployer.address,
        0,
        defaultContent
      );
    // console.log("jettonFactory.address", jettonFactory.address);

    // prettyLogTransactions(deployMinterResult.transactions);
    // printTransactionFees(deployMinterResult.transactions);
    expect(deployMinterResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: jettonFactory.address,
      success: true,
    });

    jettonMinter = blockchain.openContract(
      JettonMinter.createFromConfig(
        {
          mintable: 0,
          admin: deployer.address,
          stopped: 0,
          premint: 0,
          content: defaultContent,
          wallet_code: jwallet_code,
        },
        minter_code
      )
    );
    expect(deployMinterResult.transactions).toHaveTransaction({
      from: jettonFactory.address,
      to: jettonMinter.address,
      deploy: true,
    });
  });

  it("should deploy JettonMinter with premint", async () => {
    let deployMinterResult = await jettonFactory.sendCreateJettonMasterPremint(
      deployer.getSender(),
      toNano("1"),
      toNano("1000"),
      0,
      deployer.address,
      0,
      defaultContent
    );
    prettyLogTransactions(deployMinterResult.transactions);
    printTransactionFees(deployMinterResult.transactions);
    expect(deployMinterResult.transactions).toHaveTransaction({
      from: deployer.address,
      to: jettonFactory.address,
      success: true,
    });

    jettonMinter = blockchain.openContract(
      JettonMinter.createFromConfig(
        {
          mintable: 0,
          admin: deployer.address,
          stopped: 0,
          premint: 1,
          content: defaultContent,
          wallet_code: jwallet_code,
        },
        minter_code
      )
    );
    expect(deployMinterResult.transactions).toHaveTransaction({
      from: jettonFactory.address,
      to: jettonMinter.address,
      deploy: true,
    });

    let totalSupply = await jettonMinter.getTotalSupply();
    expect(totalSupply).toEqual(toNano("1000"));

    let wallet = await userWallet(deployer.address);
    let balance = await wallet.getJettonBalance();
    expect(balance).toEqual(toNano("1000"));
  });
});
