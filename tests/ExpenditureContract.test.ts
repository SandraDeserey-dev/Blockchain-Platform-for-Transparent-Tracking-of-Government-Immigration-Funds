// tests/ExpenditureContract.test.ts
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Cl, ClarityType, cvToValue, uintCV, stringAsciiCV, buffCV, someCV, noneCV, principalCV } from "@stacks/transactions";

interface Allocation {
  amount: bigint;
  "allocated-by": string;
  timestamp: bigint;
}

interface Expenditure {
  amount: bigint;
  category: string;
  "proof-hash": Uint8Array;
  spender: string;
  status: string;
  timestamp: bigint;
}

interface ExpenditureContractState {
  "total-allocated": bigint;
  "total-spent": bigint;
  "next-tx-id": bigint;
  "government-principal": string;
  "verifier-contract": { type: "none" } | { type: "some"; value: string };
  allocations: Map<string, Allocation>;
  expenditures: Map<bigint, Expenditure>;
  "category-spent": Map<string, bigint>;
}

class ExpenditureContractMock {
  state: ExpenditureContractState;
  blockHeight: bigint;
  caller: string;
  stxTransfers: Array<{ amount: bigint; from: string; to: string }>;

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      "total-allocated": 0n,
      "total-spent": 0n,
      "next-tx-id": 0n,
      "government-principal": "ST1GOV",
      "verifier-contract": { type: "none" },
      allocations: new Map(),
      expenditures: new Map(),
      "category-spent": new Map(),
    };
    this.blockHeight = 100n;
    this.caller = "ST1GOV";
    this.stxTransfers = [];
  }

  private isGovernment(): boolean {
    return this.caller === this.state["government-principal"];
  }

  private isVerifier(): boolean {
    return this.state["verifier-contract"].type === "some" && this.caller === this.state["verifier-contract"].value;
  }

  getAllocation(category: string): Allocation | null {
    return this.state.allocations.get(category) ?? null;
  }

  getExpenditure(txId: bigint): Expenditure | null {
    return this.state.expenditures.get(txId) ?? null;
  }

  getTotalAllocated(): bigint {
    return this.state["total-allocated"];
  }

  getTotalSpent(): bigint {
    return this.state["total-spent"];
  }

  getCategorySpent(category: string): bigint {
    return this.state["category-spent"].get(category) ?? 0n;
  }

  getNextTxId(): bigint {
    return this.state["next-tx-id"];
  }

  isValidCategory(category: string): boolean {
    return category.length > 0 && category.length <= 64;
  }

  setVerifierContract(verifier: string): { ok: true; value: true } | { ok: false; value: number } {
    if (!this.isGovernment()) return { ok: false, value: 100 };
    this.state["verifier-contract"] = { type: "some", value: verifier };
    return { ok: true, value: true };
  }

  setGovernmentPrincipal(newGov: string): { ok: true; value: true } | { ok: false; value: number } {
    if (!this.isGovernment()) return { ok: false, value: 100 };
    this.state["government-principal"] = newGov;
    return { ok: true, value: true };
  }

  allocateFunds(category: string, amount: bigint): { ok: true; value: true } | { ok: false; value: number } {
    if (!this.isGovernment()) return { ok: false, value: 100 };
    if (amount <= 0n) return { ok: false, value: 108 };
    if (!this.isValidCategory(category)) return { ok: false, value: 106 };
    if (this.state.allocations.size >= 50) return { ok: false, value: 109 };

    const existing = this.state.allocations.get(category);
    const newAmount = existing ? existing.amount + amount : amount;
    this.state.allocations.set(category, {
      amount: newAmount,
      "allocated-by": this.caller,
      timestamp: this.blockHeight,
    });
    this.state["total-allocated"] += amount;
    return { ok: true, value: true };
  }

  recordExpenditure(category: string, amount: bigint, proofHash: Uint8Array): { ok: true; value: bigint } | { ok: false; value: number } {
    if (amount <= 0n) return { ok: false, value: 108 };
    if (!this.isValidCategory(category)) return { ok: false, value: 106 };

    const allocation = this.state.allocations.get(category);
    if (!allocation) return { ok: false, value: 102 };

    const spent = this.getCategorySpent(category);
    if (allocation.amount < spent + amount) return { ok: false, value: 103 };

    if (this.state["verifier-contract"].type === "none") return { ok: false, value: 107 };

    const txId = this.state["next-tx-id"];
    this.state.expenditures.set(txId, {
      amount,
      category,
      "proof-hash": proofHash,
      spender: this.caller,
      status: "pending",
      timestamp: this.blockHeight,
    });
    this.state["next-tx-id"] += 1n;
    return { ok: true, value: txId };
  }

  approveExpenditure(txId: bigint): { ok: true; value: true } | { ok: false; value: number } {
    if (!this.isVerifier()) return { ok: false, value: 100 };

    const exp = this.state.expenditures.get(txId);
    if (!exp) return { ok: false, value: 102 };
    if (exp.status !== "pending") return { ok: false, value: 105 };

    this.state.expenditures.set(txId, { ...exp, status: "approved" });
    const currentSpent = this.state["category-spent"].get(exp.category) ?? 0n;
    this.state["category-spent"].set(exp.category, currentSpent + exp.amount);
    this.state["total-spent"] += exp.amount;
    return { ok: true, value: true };
  }

  rejectExpenditure(txId: bigint): { ok: true; value: true } | { ok: false; value: number } {
    if (!this.isVerifier()) return { ok: false, value: 100 };

    const exp = this.state.expenditures.get(txId);
    if (!exp) return { ok: false, value: 102 };
    if (exp.status !== "pending") return { ok: false, value: 105 };

    this.state.expenditures.set(txId, { ...exp, status: "rejected" });
    return { ok: true, value: true };
  }

  mintFunds(amount: bigint, recipient: string): { ok: true; value: true } | { ok: false; value: number } {
    if (!this.isGovernment()) return { ok: false, value: 100 };
    if (amount <= 0n) return { ok: false, value: 108 };
    return { ok: true, value: true };
  }
}

describe("ExpenditureContract", () => {
  let contract: ExpenditureContractMock;

  beforeEach(() => {
    contract = new ExpenditureContractMock();
    contract.reset();
  });

  it("should set verifier contract successfully", () => {
    const result = contract.setVerifierContract("ST1VERIFIER");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state["verifier-contract"]).toEqual({ type: "some", value: "ST1VERIFIER" });
  });

  it("should reject non-government from setting verifier", () => {
    contract.caller = "ST1HACKER";
    const result = contract.setVerifierContract("ST1VERIFIER");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(100);
  });

  it("should allocate funds successfully", () => {
    const result = contract.allocateFunds("refugee-housing", 1000000n);
    expect(result.ok).toBe(true);
    const allocation = contract.getAllocation("refugee-housing");
    expect(allocation?.amount).toBe(1000000n);
    expect(allocation?.["allocated-by"]).toBe("ST1GOV");
    expect(contract.getTotalAllocated()).toBe(1000000n);
  });

  it("should accumulate allocation on same category", () => {
    contract.allocateFunds("healthcare", 500000n);
    contract.allocateFunds("healthcare", 300000n);
    const allocation = contract.getAllocation("healthcare");
    expect(allocation?.amount).toBe(800000n);
    expect(contract.getTotalAllocated()).toBe(800000n);
  });

  it("should reject invalid category length", () => {
    const longCat = "a".repeat(65);
    const result = contract.allocateFunds(longCat, 1000n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(106);
  });

  it("should reject zero amount allocation", () => {
    const result = contract.allocateFunds("food-aid", 0n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(108);
  });

  it("should enforce max categories limit", () => {
    for (let i = 0; i < 50; i++) {
      contract.allocateFunds(`cat-${i}`, 1000n);
    }
    const result = contract.allocateFunds("cat-50", 1000n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(109);
  });

  it("should record expenditure with valid proof", () => {
    contract.allocateFunds("education", 200000n);
    contract.setVerifierContract("ST1VERIFIER");
    const proof = new Uint8Array(32).fill(1);
    const result = contract.recordExpenditure("education", 50000n, proof);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(0n);
    const exp = contract.getExpenditure(0n);
    expect(exp?.amount).toBe(50000n);
    expect(exp?.status).toBe("pending");
    expect(exp?.["proof-hash"]).toEqual(proof);
  });

  it("should reject expenditure without verifier set", () => {
    contract.allocateFunds("transport", 100000n);
    const result = contract.recordExpenditure("transport", 20000n, new Uint8Array(32));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(107);
  });

  it("should reject expenditure exceeding allocation", () => {
    contract.allocateFunds("shelter", 100000n);
    contract.setVerifierContract("ST1VERIFIER");
    const result = contract.recordExpenditure("shelter", 200000n, new Uint8Array(32));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(103);
  });

  it("should approve pending expenditure", () => {
    contract.allocateFunds("water", 150000n);
    contract.setVerifierContract("ST1VERIFIER");
    contract.caller = "ST1VERIFIER";
    contract.recordExpenditure("water", 30000n, new Uint8Array(32).fill(2));
    const result = contract.approveExpenditure(0n);
    expect(result.ok).toBe(true);
    const exp = contract.getExpenditure(0n);
    expect(exp?.status).toBe("approved");
    expect(contract.getCategorySpent("water")).toBe(30000n);
    expect(contract.getTotalSpent()).toBe(30000n);
  });

  it("should reject approval from non-verifier", () => {
    contract.allocateFunds("sanitation", 100000n);
    contract.setVerifierContract("ST1VERIFIER");
    contract.recordExpenditure("sanitation", 20000n, new Uint8Array(32));
    contract.caller = "ST1HACKER";
    const result = contract.approveExpenditure(0n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(100);
  });

  it("should reject double approval", () => {
    contract.allocateFunds("security", 100000n);
    contract.setVerifierContract("ST1VERIFIER");
    contract.caller = "ST1VERIFIER";
    contract.recordExpenditure("security", 15000n, new Uint8Array(32));
    contract.approveExpenditure(0n);
    const result = contract.approveExpenditure(0n);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(105);
  });

  it("should reject expenditure on non-existent category", () => {
    contract.setVerifierContract("ST1VERIFIER");
    const result = contract.recordExpenditure("ghost-cat", 1000n, new Uint8Array(32));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(102);
  });

  it("should mint funds as government", () => {
    const result = contract.mintFunds(5000000n, "ST1RECIPIENT");
    expect(result.ok).toBe(true);
  });

  it("should reject mint from non-government", () => {
    contract.caller = "ST1THIEF";
    const result = contract.mintFunds(1000n, "ST1RECIPIENT");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(100);
  });

  it("should change government principal", () => {
    contract.setGovernmentPrincipal("ST2NEWGOV");
    expect(contract.state["government-principal"]).toBe("ST2NEWGOV");
    contract.caller = "ST2NEWGOV";
    const result = contract.allocateFunds("emergency", 100000n);
    expect(result.ok).toBe(true);
  });

  it("should track multiple expenditures per category", () => {
    contract.allocateFunds("integration", 300000n);
    contract.setVerifierContract("ST1VERIFIER");
    contract.caller = "ST1VERIFIER";
    contract.recordExpenditure("integration", 40000n, new Uint8Array(32).fill(3));
    contract.recordExpenditure("integration", 35000n, new Uint8Array(32).fill(4));
    contract.approveExpenditure(0n);
    contract.approveExpenditure(1n);
    expect(contract.getCategorySpent("integration")).toBe(75000n);
  });

  it("should reject expenditure after full allocation spent", () => {
    contract.allocateFunds("legal-aid", 100000n);
    contract.setVerifierContract("ST1VERIFIER");
    contract.caller = "ST1VERIFIER";
    contract.recordExpenditure("legal-aid", 100000n, new Uint8Array(32));
    contract.approveExpenditure(0n);
    const result = contract.recordExpenditure("legal-aid", 1n, new Uint8Array(32));
    expect(result.ok).toBe(false);
    expect(result.value).toBe(103);
  });

  it("should allow rejected expenditure to be resubmitted", () => {
    contract.allocateFunds("training", 50000n);
    contract.setVerifierContract("ST1VERIFIER");
    contract.caller = "ST1VERIFIER";
    const tx1 = contract.recordExpenditure("training", 20000n, new Uint8Array(32).fill(5));
    contract.rejectExpenditure(tx1.value as bigint);
    const tx2 = contract.recordExpenditure("training", 20000n, new Uint8Array(32).fill(6));
    expect(tx2.ok).toBe(true);
  });

  it("should generate sequential tx-ids", () => {
    contract.allocateFunds("cat1", 100000n);
    contract.setVerifierContract("ST1VERIFIER");
    const tx1 = contract.recordExpenditure("cat1", 10000n, new Uint8Array(32));
    const tx2 = contract.recordExpenditure("cat1", 15000n, new Uint8Array(32));
    expect(tx1.value).toBe(0n);
    expect(tx2.value).toBe(1n);
    expect(contract.getNextTxId()).toBe(2n);
  });
});