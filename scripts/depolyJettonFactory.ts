import { Address, toNano } from "@ton/core";

import { compile, NetworkProvider, UIProvider } from "@ton/blueprint";
import { promptAddress, promptBool, promptUrl } from "../wrappers/ui-utils";
import { JettonWallet } from "../wrappers/JettonWallet";
import {
  JettonFactory,
  jettonFactoryConfigToCell,
} from "../wrappers/JettonFactory";
import {
  JettonMinter,
  jettonContentToCell,
} from "../wrappers/JettonMinterStoppable";
import "@ton/test-utils";

// const formatUrl =
//   "https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md#jetton-metadata-example-offchain";
// const exampleContent = {
//   name: "Sample Jetton",
//   description: "Sample of Jetton",
//   symbol: "JTN",
//   decimals: 9,
//   image: "https://www.svgrepo.com/download/483336/coin-vector.svg",
// };
// const urlPrompt = "Please specify url pointing to jetton metadata(json):";

export async function run(provider: NetworkProvider) {
  const ui = provider.ui();
  const sender = provider.sender();
  const adminPrompt = `Please specify admin address`;
  let admin = await promptAddress(adminPrompt, ui, sender.address);
  ui.write(`Admin address:${admin}\n`);
  let dataCorrect = false;
  do {
    ui.write("Please verify data:\n");
    ui.write(`Admin:${admin}\n\n`);
    dataCorrect = await promptBool("Is everything ok?(y/n)", ["y", "n"], ui);
  } while (!dataCorrect);
  const wallet_code = await compile("JettonWallet");
  const minter_code = await compile("JettonMinter");
  const factory_code = await compile("JettonFactory");
  const factory = JettonFactory.createFromConfig(
    {
      admin_address: admin,
      jetton_master_code: minter_code,
      jetton_wallet_code: wallet_code,
    },
    factory_code
  );
  const factoryContract = provider.open(factory);
  await factoryContract.sendDeploy(provider.sender(), toNano("0.2"));
}
