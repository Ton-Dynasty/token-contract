import { Address, toNano } from "@ton/core";
import {
  JettonMinter,
  JettonMinterContent,
  jettonContentToCell,
  jettonMinterConfigToCell,
} from "../wrappers/JettonMinterStoppable";
import { compile, NetworkProvider, UIProvider } from "@ton/blueprint";
import { promptAddress, promptBool, promptUrl } from "../wrappers/ui-utils";

const formatUrl =
  "https://github.com/ton-blockchain/TEPs/blob/master/text/0064-token-data-standard.md#jetton-metadata-example-offchain";
const exampleContent = {
  name: "Sample Jetton",
  description: "Sample of Jetton",
  symbol: "JTN",
  decimals: 9,
  image: "https://www.svgrepo.com/download/483336/coin-vector.svg",
};
const urlPrompt = "Please specify url pointing to jetton metadata(json):";

export async function run(provider: NetworkProvider) {
  const ui = provider.ui();
  const sender = provider.sender();
  const adminPrompt = `Please specify admin address`;
  ui.write(
    `Jetton deployer\nCurrent deployer onli supports off-chain format:${formatUrl}`
  );
  //   ui.write(`Is the Jetton mintable? (yes/no)`);
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

  let admin = await promptAddress(adminPrompt, ui, sender.address);
  ui.write(`Admin address:${admin}\n`);
  let contentUrl = await promptUrl(urlPrompt, ui);
  ui.write(`Jetton content url:${contentUrl}`);

  let dataCorrect = false;
  do {
    ui.write("Please verify data:\n");
    ui.write(`Admin:${admin}\n\n`);
    ui.write("Metadata url:" + contentUrl);
    dataCorrect = await promptBool("Is everything ok?(y/n)", ["y", "n"], ui);
    if (!dataCorrect) {
      const upd = await ui.choose(
        "What do you want to update?",
        ["Admin", "Url"],
        (c) => c
      );

      if (upd == "Admin") {
        admin = await promptAddress(adminPrompt, ui, sender.address);
      } else {
        contentUrl = await promptUrl(urlPrompt, ui);
      }
    }
  } while (!dataCorrect);

  const content = jettonContentToCell({ type: 1, uri: contentUrl });

  const wallet_code = await compile("JettonWallet");

  const minter = JettonMinter.createFromConfig(
    {
      mintable: mint,
      premint: premint,
      admin,
      stopped: 0,
      content,
      wallet_code,
    },
    await compile("JettonMinter")
  );
  const minterContract = provider.open(minter);
  await minterContract.sendDeploy(provider.sender(), toNano("0.1"));
}
