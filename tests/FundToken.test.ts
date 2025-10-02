// tests/FundToken.test.ts

import { describe, it, expect, beforeEach } from "vitest";
import { stringUtf8CV, uintCV } from "@stacks/transactions";

const ERR_NOT_AUTHORIZED = 100;
const ERR_INVALID_MAX_MINT = 111;
const ERR_INVALID_MINT_AMOUNT = 102;
const ERR_INVALID_START_TIME = 108;
const ERR_INVALID_PENALTY_RATE = 104;
const ERR_INVALID_VOTING_THRESHOLD = 105;
const ERR_MINTER_ALREADY_EXISTS = 106;
const ERR_MINTER_NOT_FOUND = 107;
const ERR_INVALID_MINTER_TYPE = 115;
const ERR_INVALID_INTEREST_RATE = 116;
const ERR_INVALID_GRACE_PERIOD = 117;
const ERR_INVALID_LOCATION = 118;
const ERR_INVALID_CURRENCY = 119;
const ERR_INVALID_MIN_MINT = 110;
const ERR_INVALID_MAX_LOAN = 111;
const ERR_MAX_MINTERS_EXCEEDED = 114;
const ERR_INVALID_UPDATE_PARAM = 113;
const ERR_AUTHORITY_NOT_VERIFIED = 109;

interface Minter {
  name: string;
  maxMint: number;
  mintAmount: number;
  startTime: number;
  penaltyRate: number;
  threshold: number;
  timestamp: number;
  creator: string;
  minterType: string;
  interestRate: number;
  gracePeriod: number;
  location: string;
  currency: string;
  status: boolean;
  minMint: number;
  maxLoan: number;
}

interface MinterUpdate {
  updateName: string;
  updateMaxMint: number;
  updateMintAmount: number;
  updateTimestamp: number;
  updater: string;
}

interface Result<T> {
  ok: boolean;
  value: T;
}

class FundTokenMock {
  state: {
    nextMinterId: number;
    maxMinters: number;
    mintFee: number;
    authorityContract: string | null;
    minters: Map<number, Minter>;
    minterUpdates: Map<number, MinterUpdate>;
    mintersByName: Map<string, number>;
  } = {
    nextMinterId: 0,
    maxMinters: 100,
    mintFee: 1000,
    authorityContract: null,
    minters: new Map(),
    minterUpdates: new Map(),
    mintersByName: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  authorities: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextMinterId: 0,
      maxMinters: 100,
      mintFee: 1000,
      authorityContract: null,
      minters: new Map(),
      minterUpdates: new Map(),
      mintersByName: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.authorities = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isVerifiedAuthority(principal: string): Result<boolean> {
    return { ok: true, value: this.authorities.has(principal) };
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: false };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: false };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setMintFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: false };
    this.state.mintFee = newFee;
    return { ok: true, value: true };
  }

  createMinter(
    name: string,
    maxMint: number,
    mintAmount: number,
    startTime: number,
    penaltyRate: number,
    threshold: number,
    minterType: string,
    interestRate: number,
    gracePeriod: number,
    location: string,
    currency: string,
    minMint: number,
    maxLoan: number
  ): Result<number> {
    if (this.state.nextMinterId >= this.state.maxMinters) return { ok: false, value: ERR_MAX_MINTERS_EXCEEDED };
    if (!name || name.length > 100) return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
    if (maxMint <= 0 || maxMint > 1000000000) return { ok: false, value: ERR_INVALID_MAX_MINT };
    if (mintAmount <= 0) return { ok: false, value: ERR_INVALID_MINT_AMOUNT };
    if (startTime <= 0) return { ok: false, value: ERR_INVALID_START_TIME };
    if (penaltyRate > 100) return { ok: false, value: ERR_INVALID_PENALTY_RATE };
    if (threshold <= 0 || threshold > 100) return { ok: false, value: ERR_INVALID_VOTING_THRESHOLD };
    if (!["government", "ngo", "community"].includes(minterType)) return { ok: false, value: ERR_INVALID_MINTER_TYPE };
    if (interestRate > 20) return { ok: false, value: ERR_INVALID_INTEREST_RATE };
    if (gracePeriod > 30) return { ok: false, value: ERR_INVALID_GRACE_PERIOD };
    if (!location || location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (minMint <= 0) return { ok: false, value: ERR_INVALID_MIN_MINT };
    if (maxLoan <= 0) return { ok: false, value: ERR_INVALID_MAX_LOAN };
    if (!this.isVerifiedAuthority(this.caller).value) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (this.state.mintersByName.has(name)) return { ok: false, value: ERR_MINTER_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_VERIFIED };

    this.stxTransfers.push({ amount: this.state.mintFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextMinterId;
    const minter: Minter = {
      name,
      maxMint,
      mintAmount,
      startTime,
      penaltyRate,
      threshold,
      timestamp: this.blockHeight,
      creator: this.caller,
      minterType,
      interestRate,
      gracePeriod,
      location,
      currency,
      status: true,
      minMint,
      maxLoan,
    };
    this.state.minters.set(id, minter);
    this.state.mintersByName.set(name, id);
    this.state.nextMinterId++;
    return { ok: true, value: id };
  }

  getMinter(id: number): Minter | null {
    return this.state.minters.get(id) || null;
  }

  updateMinter(id: number, updateName: string, updateMaxMint: number, updateMintAmount: number): Result<boolean> {
    const minter = this.state.minters.get(id);
    if (!minter) return { ok: false, value: false };
    if (minter.creator !== this.caller) return { ok: false, value: false };
    if (!updateName || updateName.length > 100) return { ok: false, value: false };
    if (updateMaxMint <= 0 || updateMaxMint > 1000000000) return { ok: false, value: false };
    if (updateMintAmount <= 0) return { ok: false, value: false };
    if (this.state.mintersByName.has(updateName) && this.state.mintersByName.get(updateName) !== id) {
      return { ok: false, value: false };
    }

    const updated: Minter = {
      ...minter,
      name: updateName,
      maxMint: updateMaxMint,
      mintAmount: updateMintAmount,
      timestamp: this.blockHeight,
    };
    this.state.minters.set(id, updated);
    this.state.mintersByName.delete(minter.name);
    this.state.mintersByName.set(updateName, id);
    this.state.minterUpdates.set(id, {
      updateName,
      updateMaxMint,
      updateMintAmount,
      updateTimestamp: this.blockHeight,
      updater: this.caller,
    });
    return { ok: true, value: true };
  }

  getMinterCount(): Result<number> {
    return { ok: true, value: this.state.nextMinterId };
  }

  checkMinterExistence(name: string): Result<boolean> {
    return { ok: true, value: this.state.mintersByName.has(name) };
  }
}

describe("FundToken", () => {
  let contract: FundTokenMock;

  beforeEach(() => {
    contract = new FundTokenMock();
    contract.reset();
  });

  it("creates a minter successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createMinter(
      "Alpha",
      1000000,
      100,
      30,
      5,
      50,
      "government",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0);

    const minter = contract.getMinter(0);
    expect(minter?.name).toBe("Alpha");
    expect(minter?.maxMint).toBe(1000000);
    expect(minter?.mintAmount).toBe(100);
    expect(minter?.startTime).toBe(30);
    expect(minter?.penaltyRate).toBe(5);
    expect(minter?.threshold).toBe(50);
    expect(minter?.minterType).toBe("government");
    expect(minter?.interestRate).toBe(10);
    expect(minter?.gracePeriod).toBe(7);
    expect(minter?.location).toBe("VillageX");
    expect(minter?.currency).toBe("STX");
    expect(minter?.minMint).toBe(50);
    expect(minter?.maxLoan).toBe(1000);
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate minter names", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createMinter(
      "Alpha",
      1000000,
      100,
      30,
      5,
      50,
      "government",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    const result = contract.createMinter(
      "Alpha",
      2000000,
      200,
      60,
      10,
      60,
      "ngo",
      15,
      14,
      "CityY",
      "USD",
      100,
      2000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MINTER_ALREADY_EXISTS);
  });

  it("rejects non-authorized caller", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2FAKE";
    contract.authorities = new Set();
    const result = contract.createMinter(
      "Beta",
      1000000,
      100,
      30,
      5,
      50,
      "government",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });

  it("rejects minter creation without authority contract", () => {
    const result = contract.createMinter(
      "NoAuth",
      1000000,
      100,
      30,
      5,
      50,
      "government",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_VERIFIED);
  });

  it("rejects invalid max mint", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createMinter(
      "InvalidMaxMint",
      1000000001,
      100,
      30,
      5,
      50,
      "government",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_MAX_MINT);
  });

  it("rejects invalid mint amount", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createMinter(
      "InvalidMint",
      1000000,
      0,
      30,
      5,
      50,
      "government",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_MINT_AMOUNT);
  });

  it("rejects invalid minter type", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createMinter(
      "InvalidType",
      1000000,
      100,
      30,
      5,
      50,
      "invalid",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_MINTER_TYPE);
  });

  it("updates a minter successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createMinter(
      "OldMinter",
      1000000,
      100,
      30,
      5,
      50,
      "government",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    const result = contract.updateMinter(0, "NewMinter", 1500000, 200);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const minter = contract.getMinter(0);
    expect(minter?.name).toBe("NewMinter");
    expect(minter?.maxMint).toBe(1500000);
    expect(minter?.mintAmount).toBe(200);
    const update = contract.state.minterUpdates.get(0);
    expect(update?.updateName).toBe("NewMinter");
    expect(update?.updateMaxMint).toBe(1500000);
    expect(update?.updateMintAmount).toBe(200);
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent minter", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.updateMinter(99, "NewMinter", 1500000, 200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("rejects update by non-creator", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createMinter(
      "TestMinter",
      1000000,
      100,
      30,
      5,
      50,
      "government",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    contract.caller = "ST3FAKE";
    const result = contract.updateMinter(0, "NewMinter", 1500000, 200);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("sets mint fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setMintFee(2000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.mintFee).toBe(2000);
    contract.createMinter(
      "TestMinter",
      1000000,
      100,
      30,
      5,
      50,
      "government",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    expect(contract.stxTransfers).toEqual([{ amount: 2000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects mint fee change without authority contract", () => {
    const result = contract.setMintFee(2000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });

  it("returns correct minter count", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createMinter(
      "Minter1",
      1000000,
      100,
      30,
      5,
      50,
      "government",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    contract.createMinter(
      "Minter2",
      2000000,
      200,
      60,
      10,
      60,
      "ngo",
      15,
      14,
      "CityY",
      "USD",
      100,
      2000
    );
    const result = contract.getMinterCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks minter existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.createMinter(
      "TestMinter",
      1000000,
      100,
      30,
      5,
      50,
      "government",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    const result = contract.checkMinterExistence("TestMinter");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const result2 = contract.checkMinterExistence("NonExistent");
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("parses minter parameters with Clarity types", () => {
    const name = stringUtf8CV("TestMinter");
    const maxMint = uintCV(1000000);
    const mintAmount = uintCV(100);
    expect(name.value).toBe("TestMinter");
    expect(maxMint.value).toEqual(BigInt(1000000));
    expect(mintAmount.value).toEqual(BigInt(100));
  });

  it("rejects minter creation with empty name", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.createMinter(
      "",
      1000000,
      100,
      30,
      5,
      50,
      "government",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_UPDATE_PARAM);
  });

  it("rejects minter creation with max minters exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.state.maxMinters = 1;
    contract.createMinter(
      "Minter1",
      1000000,
      100,
      30,
      5,
      50,
      "government",
      10,
      7,
      "VillageX",
      "STX",
      50,
      1000
    );
    const result = contract.createMinter(
      "Minter2",
      2000000,
      200,
      60,
      10,
      60,
      "ngo",
      15,
      14,
      "CityY",
      "USD",
      100,
      2000
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_MINTERS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(false);
  });
});