import {
  Address,
  beginCell,
  Cell,
  fromNano,
  OpenedContract,
  toNano,
} from "@ton/core";
import { compile, sleep, NetworkProvider, UIProvider } from "@ton/blueprint";
import { JettonMinter } from "../wrappers/JettonMinterStoppable";
import { jettonContentToCell, JettonFactory } from "../wrappers/JettonFactory";
import {
  promptBool,
  promptAmount,
  promptAddress,
  promptUrl,
  displayContentCell,
  waitForTransaction,
  getLastBlock,
  getAccountLastTx,
} from "../wrappers/ui-utils";
import { TonClient4 } from "@ton/ton";
let minterContract: OpenedContract<JettonMinter>;
let factoryContract: OpenedContract<JettonFactory>;

const adminActions = ["claim"];
const userActions = [
  "createJettonMasterNoPremint",
  "createJettonMasterPremint",
  "Quit",
];

const failedTransMessage = (ui: UIProvider) => {
  ui.write(
    "Failed to get indication of transaction completion from API!\nCheck result manually, or try again\n"
  );
};

const claimAction = async (provider: NetworkProvider, ui: UIProvider) => {
  let retry: boolean;
  let curAdmin = await factoryContract.getAdmin();
  const api = provider.api() as TonClient4;
  const curState = await api.getAccount(
    await getLastBlock(provider),
    factoryContract.address
  );
  const beforeBalance = (
    await api.getAccount(await getLastBlock(provider), curAdmin)
  ).account.balance;
  ui.write(`Admin's balance before claim:${beforeBalance}\n`);
  if (
    curState.account.state.type !== "active" ||
    curState.account.state.code == null
  )
    throw "Last transaction can't be null on deployed contract";

  const factoryBalance = (
    await api.getAccount(await getLastBlock(provider), factoryContract.address)
  ).account.balance;
  ui.write(`Factory balance before claim:${factoryBalance}\n`);

  await factoryContract.sendClaim(provider.sender());
  let lastTx = await getAccountLastTx(provider, factoryContract.address);
  const transDone = await waitForTransaction(
    provider,
    factoryContract.address,
    lastTx,
    10
  );
  if (transDone) {
    const afterBalance = (
      await api.getAccount(await getLastBlock(provider), curAdmin)
    ).account.balance;
    ui.write(`Admin's balance after claim:${afterBalance}\n`);
    const factoryBalanceAfter = (
      await api.getAccount(
        await getLastBlock(provider),
        factoryContract.address
      )
    ).account.balance;
    ui.write(`Factory balance after claim:${factoryBalanceAfter}\n`);
  }
};

const createJettonMasterNoPremintAction = async (
  provider: NetworkProvider,
  ui: UIProvider
) => {
  const sender = provider.sender();
  let mintable = await promptBool("Mintable?", ["yes", "no"], ui);
  ui.write(`Mintable:${mintable}\n`);
  let mint: number;
  if (mintable) {
    mint = 0;
  } else {
    mint = 1;
  }

  let admin = await promptAddress(
    `Please specify admin address`,
    ui,
    sender.address
  );
  ui.write(`Admin address:${admin}\n`);
  let contentUrl = await promptUrl(
    "Please specify url pointing to jetton metadata(json):",
    ui
  );
  ui.write(`Jetton content url:${contentUrl}`);
  let dataCorrect = false;
  do {
    ui.write("Please verify data:\n");
    ui.write(`Admin:${admin}\n\n`);
    ui.write("Metadata url:" + contentUrl);
    dataCorrect = await promptBool("Is everything ok?", ["y", "n"], ui);
    if (!dataCorrect) {
      const upd = await ui.choose(
        "What do you want to update?",
        ["Admin", "Url"],
        (c) => c
      );

      if (upd == "Admin") {
        admin = await promptAddress(
          `Please specify admin address`,
          ui,
          sender.address
        );
      } else {
        contentUrl = await promptUrl(
          "Please specify url pointing to jetton metadata(json):",
          ui
        );
      }
    }
  } while (!dataCorrect);

  ui.write(`Creating JettonMaster with no premint\n`);
  const api = provider.api() as TonClient4;
  const curState = await api.getAccount(
    await getLastBlock(provider),
    factoryContract.address
  );
  if (
    curState.account.state.type !== "active" ||
    curState.account.state.code == null
  )
    throw "Last transaction can't be null on deployed contract";
  const result = await factoryContract.sendCreateJettonMasterNoPremint(
    provider.sender(),
    toNano("0"),
    admin,
    mint,
    jettonContentToCell({ type: 1, uri: contentUrl })
  );
  let lastTx = await getAccountLastTx(provider, factoryContract.address);
  const gotTrans = await waitForTransaction(
    provider,
    factoryContract.address,
    lastTx,
    30
  );
  if (gotTrans) {
    // ui.write("JettonMaster created successfully\n");
    let minter = await JettonMinter.createFromConfig(
      {
        admin,
        mintable: mint,
        premint: 0,
        stopped: 0,
        content: jettonContentToCell({ type: 1, uri: contentUrl }),
        wallet_code: await compile("JettonWallet"),
      },
      await compile("JettonMinter")
    );
    minterContract = provider.open(minter);

    let masterCurState = await api.getAccount(
      await getLastBlock(provider),
      minterContract.address
    );
    if (
      masterCurState.account.state.type !== "active" ||
      masterCurState.account.state.code == null
    )
      throw "Last transaction can't be null on deployed contract";
  } else {
    failedTransMessage(ui);
  }
};

const createJettonMasterPremintAction = async (
  provider: NetworkProvider,
  ui: UIProvider
) => {
  const sender = provider.sender();
  let mintable = await promptBool("Mintable?", ["yes", "no"], ui);
  ui.write(`Mintable:${mintable}\n`);
  let mint: number;
  if (mintable) {
    mint = 0;
  } else {
    mint = 1;
  }
  let isPremint = true;
  if (mintable) {
    isPremint = await promptBool("Preminted?", ["yes", "no"], ui);
    ui.write(`Preminted:${isPremint}\n`);
  }
  let premint: number;
  if (isPremint) {
    premint = 1;
  } else {
    premint = 0;
  }

  let admin = await promptAddress(
    `Please specify admin address`,
    ui,
    sender.address
  );
  ui.write(`Admin address:${admin}\n`);
  let contentUrl = await promptUrl(
    "Please specify url pointing to jetton metadata(json):",
    ui
  );
  ui.write(`Jetton content url:${contentUrl}`);

  let premintAmount = await promptAmount("Premint amount:", ui);
  ui.write(`Premint amount:${premintAmount}\n`);

  let dataCorrect = false;
  do {
    ui.write("Please verify data:\n");
    ui.write(`Admin:${admin}\n\n`);
    ui.write("Metadata url:" + contentUrl);
    dataCorrect = await promptBool("Is everything ok?", ["y", "n"], ui);
    if (!dataCorrect) {
      const upd = await ui.choose(
        "What do you want to update?",
        ["Admin", "Url"],
        (c) => c
      );

      if (upd == "Admin") {
        admin = await promptAddress(
          `Please specify admin address`,
          ui,
          sender.address
        );
      } else {
        contentUrl = await promptUrl(
          "Please specify url pointing to jetton metadata(json):",
          ui
        );
      }
    }
  } while (!dataCorrect);

  ui.write(`Creating JettonMaster with premint\n`);
  const api = provider.api() as TonClient4;
  const curState = await api.getAccount(
    await getLastBlock(provider),
    factoryContract.address
  );
  if (
    curState.account.state.type !== "active" ||
    curState.account.state.code == null
  )
    throw "Last transaction can't be null on deployed contract";
  const result = await factoryContract.sendCreateJettonMasterPremint(
    provider.sender(),
    toNano("0.5"),
    toNano(premintAmount),
    mint,
    admin,
    0,
    jettonContentToCell({ type: 1, uri: contentUrl })
  );
  let lastTx = await getAccountLastTx(provider, factoryContract.address);
  const gotTrans = await waitForTransaction(
    provider,
    factoryContract.address,
    lastTx,
    30
  );
  if (gotTrans) {
    // ui.write("JettonMaster created successfully\n");
    let minter = await JettonMinter.createFromConfig(
      {
        admin,
        mintable: mint,
        premint,
        stopped: 0,
        content: jettonContentToCell({ type: 1, uri: contentUrl }),
        wallet_code: await compile("JettonWallet"),
      },
      await compile("JettonMinter")
    );
    minterContract = provider.open(minter);

    let masterCurState = await api.getAccount(
      await getLastBlock(provider),
      minterContract.address
    );
    if (
      masterCurState.account.state.type !== "active" ||
      masterCurState.account.state.code == null
    )
      throw "Last transaction can't be null on deployed contract";

    const supply = await minterContract.getTotalSupply();
    ui.write(`Total supply:${fromNano(supply)}\n`);

    if (supply == toNano(premintAmount)) {
      ui.write("Premint successfull!\n");
    } else {
      ui.write("Premint failed!\n");
    }
  } else {
    failedTransMessage(ui);
  }
};

export async function run(provider: NetworkProvider) {
  const ui = provider.ui();
  const sender = provider.sender();
  const hasSender = sender.address !== undefined;
  const api = provider.api();
  const factoryCode = await compile("JettonFactory");
  const minterCode = await compile("JettonMinter");
  const walletCode = await compile("JettonWallet");
  let done = false;
  let retry: boolean;
  let factoryAddress: Address;

  do {
    retry = false;
    factoryAddress = await promptAddress("Please enter factory address:", ui);
    factoryContract = provider.open(
      JettonFactory.createFromAddress(factoryAddress)
    );
    const api = provider.api() as TonClient4;
    const curState = await api.getAccount(
      await getLastBlock(provider),
      factoryAddress
    );
    if (
      curState.account.state.type !== "active" ||
      curState.account.state.code == null
    ) {
      ui.write("Contract is not deployed\n");
      retry = await promptBool("Retry?", ["yes", "no"], ui);
    }
  } while (retry);

  factoryContract = provider.open(
    JettonFactory.createFromAddress(factoryAddress)
  );
  const isAdmin = hasSender
    ? (await factoryContract.getAdmin()).equals(sender.address)
    : true;

  let actionList: string[];
  if (isAdmin) {
    actionList = [...adminActions, ...userActions];
    ui.write("Admin actions\n");
  } else {
    actionList = userActions;
    ui.write("User actions\n");
  }

  do {
    let action = await ui.choose("Choose action", actionList, (c) => c);
    switch (action) {
      case "claim":
        await claimAction(provider, ui);
        break;
      case "createJettonMasterNoPremint":
        await createJettonMasterNoPremintAction(provider, ui);
        break;
      case "createJettonMasterPremint":
        await createJettonMasterPremintAction(provider, ui);
        break;
      case "Quit":
        done = true;
        break;
      default:
        break;
    }
  } while (!done);
}
