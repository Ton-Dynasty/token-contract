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
import { JettonFactory } from "../wrappers/JettonFactory";
import {
  promptBool,
  promptAmount,
  promptAddress,
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
  let retry: boolean;
  let mintable = await promptBool("Mintable?", ["yes", "no"], ui);
  let mint: number;
};
