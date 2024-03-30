import {
  Address,
  beginCell,
  Cell,
  Contract,
  contractAddress,
  ContractProvider,
  Sender,
  SendMode,
  toNano,
  internal as internal_relaxed,
  storeMessageRelaxed,
} from "@ton/core";

import { Op } from "./JettonConstants";

export type JettonMinterContent = {
  type: 0 | 1;
  uri: string;
};

export type JettonMinterConfig = {
  mintable: number;
  admin: Address;
  stopped: number;
  premint: number;
  content: Cell;
  wallet_code: Cell;
};

export type JettonFactoryConfig = {
  admin_address: Address;
  jetton_master_code: Cell;
  jetton_wallet_code: Cell;
};

export function jettonMinterConfigToCell(config: JettonMinterConfig): Cell {
  return beginCell()
    .storeCoins(0)
    .storeUint(config.mintable, 1)
    .storeAddress(config.admin)
    .storeUint(config.stopped, 1)
    .storeUint(config.premint, 1)
    .storeRef(config.content)
    .storeRef(config.wallet_code)
    .endCell();
}

export function jettonFactoryConfigToCell(config: JettonFactoryConfig): Cell {
  return beginCell()
    .storeAddress(config.admin_address)
    .storeRef(config.jetton_master_code)
    .storeRef(config.jetton_wallet_code)
    .endCell();
}

export function jettonContentToCell(content: JettonMinterContent) {
  return beginCell()
    .storeUint(content.type, 8)
    .storeStringTail(content.uri) //Snake logic under the hood
    .endCell();
}

export class JettonFactory implements Contract {
  constructor(
    readonly address: Address,
    readonly init?: { code: Cell; data: Cell }
  ) {}

  static createFromAddress(address: Address) {
    return new JettonFactory(address);
  }

  static createFromConfig(
    config: JettonFactoryConfig,
    code: Cell,
    workchain = 0
  ) {
    const data = jettonFactoryConfigToCell(config);
    const init = { code, data };
    return new JettonFactory(contractAddress(workchain, init), init);
  }

  async sendDeploy(provider: ContractProvider, via: Sender, value: bigint) {
    await provider.internal(via, {
      value,
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: beginCell().endCell(),
    });
  }

  static claimMessage(admin_address: Address) {
    return beginCell()
      .storeUint(Op.claim, 32)
      .storeUint(0, 64) // op, queryId
      .storeAddress(admin_address)
      .endCell();
  }

  async sendClaim(provider: ContractProvider, via: Sender) {
    await provider.internal(via, {
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: JettonFactory.claimMessage(via.address!),
      value: toNano("0.1"),
    });
  }

  static createJettonMasterNoPremintMessage(
    total_supply: bigint,
    jetton_master_owner: Address,
    stopped: number,
    content: Cell
  ) {
    return beginCell()
      .storeUint(Op.create_jetton_master_nopremint, 32)
      .storeUint(0, 64) // op, queryId
      .storeCoins(total_supply)
      .storeAddress(jetton_master_owner)
      .storeUint(stopped, 1)
      .storeRef(content)
      .endCell();
  }

  async sendCreateJettonMasterNoPremint(
    provider: ContractProvider,
    via: Sender,
    total_supply: bigint,
    jetton_master_owner: Address,
    stopped: number,
    content: Cell
  ) {
    await provider.internal(via, {
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: JettonFactory.createJettonMasterNoPremintMessage(
        total_supply,
        jetton_master_owner,
        stopped,
        content
      ),
      value: toNano("1"),
    });
  }

  static createJettonMasterPremintMessage(
    total_ton_amount: bigint,
    total_supply: bigint,
    mintable: number,
    jetton_master_owner: Address,
    stopped: number,
    content: Cell
  ) {
    return beginCell()
      .storeUint(Op.create_jetton_master_premint, 32)
      .storeUint(0, 64) // op, queryId
      .storeCoins(total_ton_amount)
      .storeCoins(total_supply)
      .storeUint(mintable, 1)
      .storeAddress(jetton_master_owner)
      .storeUint(stopped, 1)
      .storeRef(content)
      .endCell();
  }

  async sendCreateJettonMasterPremint(
    provider: ContractProvider,
    via: Sender,
    total_ton_amount: bigint,
    total_supply: bigint,
    mintable: number,
    jetton_master_owner: Address,
    stopped: number,
    content: Cell
  ) {
    await provider.internal(via, {
      sendMode: SendMode.PAY_GAS_SEPARATELY,
      body: JettonFactory.createJettonMasterPremintMessage(
        total_ton_amount,
        total_supply,
        mintable,
        jetton_master_owner,
        stopped,
        content
      ),
      value: total_ton_amount + toNano("1.5"),
    });
  }

  async getAdmin(provider: ContractProvider) {
    let res = await provider.get("get_admin_address", []);
    return res.stack.readAddress();
  }
}
