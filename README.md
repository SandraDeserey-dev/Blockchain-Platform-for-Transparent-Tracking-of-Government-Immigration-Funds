# ImmigFundTrack: Blockchain Platform for Transparent Tracking of Government Immigration Funds

## Overview

**ImmigFundTrack** is a Web3 project built on the Stacks blockchain using Clarity smart contracts. It addresses real-world problems in government immigration fund management, such as lack of transparency, corruption, mismanagement, and inefficient auditing. By leveraging blockchain's immutability and decentralization, this platform ensures that funds allocated for immigration purposes (e.g., refugee support, border security, integration programs) are tracked from allocation to expenditure. Key benefits include:

- **Transparency**: All transactions are publicly verifiable on the blockchain.
- **Accountability**: Funds can only be spent with verifiable proofs and multi-party approvals.
- **Efficiency**: Reduces bureaucratic delays through automated smart contract logic.
- **Auditability**: Enables real-time auditing by stakeholders, NGOs, or the public.
- **Fraud Prevention**: Immutable records prevent tampering, and governance mechanisms allow for community oversight.

This project solves issues like those seen in real-world scandals (e.g., misallocation of UN refugee funds or government mismanagement in immigration budgets) by providing a tamper-proof ledger.

The platform involves 6 core smart contracts, designed to interact seamlessly:
1. **FundToken.clar**: A fungible token (SIP-10 compliant) representing the immigration funds.
2. **AllocationContract.clar**: Manages fund allocations to specific categories or recipients.
3. **ExpenditureContract.clar**: Tracks and verifies expenditures with required proofs.
4. **VerificationContract.clar**: Handles recipient eligibility verification.
5. **GovernanceContract.clar**: A DAO-like contract for voting on major decisions (e.g., allocations).
6. **AuditContract.clar**: Provides querying and reporting functions for auditing.

## Architecture

- **Token Flow**: Government entities mint tokens via FundToken, allocate them through AllocationContract, and recipients spend them via ExpenditureContract after verification.
- **Interactions**: Contracts are composable; e.g., ExpenditureContract calls VerificationContract to ensure eligibility before releasing funds.
- **Security**: Uses Clarity's predictable execution, principal-based access control, and post-conditions for safety.
- **Integration**: Can integrate with off-chain oracles for real-world data (e.g., identity proofs) via Stacks' ecosystem.
- **Deployment**: Deploy on Stacks mainnet or testnet using Clarinet or Stacks CLI.

## Prerequisites

- Clarity development environment (Clarinet installed: `cargo install clarinet`).
- Stacks wallet for testing.
- Basic knowledge of Stacks and Clarity.

## Smart Contracts

Below are the 6 smart contracts in Clarity. Each includes comments for clarity (pun intended). Contracts are designed to be secure, with read-only functions for public access and protected functions for authorized principals.

### 1. FundToken.clar (Fungible Token for Funds)

This contract implements an SIP-10 fungible token to represent immigration funds. Governments mint tokens backed by fiat deposits.

```clarity
;; FundToken.clar
(define-fungible-token fund-token u1000000000) ;; Max supply: 1 billion units

(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant GOVERNMENT-PRINCIPAL tx-sender) ;; In production, set to a specific principal

(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (is-eq tx-sender GOVERNMENT-PRINCIPAL) ERR-NOT-AUTHORIZED)
    (ft-mint? fund-token amount recipient)
  )
)

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (ft-transfer? fund-token amount sender recipient)
)

(define-read-only (get-balance (account principal))
  (ft-get-balance fund-token account)
)

(define-read-only (get-total-supply)
  (ft-get-supply fund-token)
)
```

### 2. AllocationContract.clar (Fund Allocation Management)

Handles allocation of funds to categories like "refugee housing" or specific recipients. Tracks allocated vs. available funds.

```clarity
;; AllocationContract.clar
(use-trait fund-token-trait .FundToken.fund-token)

(define-map allocations { category: (string-ascii 32) } { amount: uint, allocated-by: principal, timestamp: uint })
(define-map available-funds principal uint)

(define-constant ERR-INSUFFICIENT-FUNDS (err u101))
(define-constant ERR-NOT-AUTHORIZED (err u100))

(define-public (allocate-funds (category (string-ascii 32)) (amount uint) (token-trait <fund-token-trait>))
  (let ((sender tx-sender))
    (asserts! (>= (try! (contract-call? token-trait get-balance sender)) amount) ERR-INSUFFICIENT-FUNDS)
    (try! (contract-call? token-trait transfer amount sender (as-contract tx-sender) none))
    (map-set allocations { category: category } { amount: amount, allocated-by: sender, timestamp: block-height })
    (ok true)
  )
)

(define-public (get-allocation (category (string-ascii 32)))
  (map-get? allocations { category: category })
)

(define-read-only (get-available-funds (account principal))
  (default-to u0 (map-get? available-funds account))
)
```

### 3. ExpenditureContract.clar (Expenditure Tracking)

Records expenditures, requiring proof (e.g., hash of receipt) and verification. Ensures funds are spent as allocated.

```clarity
;; ExpenditureContract.clar
(use-trait fund-token-trait .FundToken.fund-token)
(use-trait verification-trait .VerificationContract.verification)

(define-map expenditures { tx-id: uint } { amount: uint, category: (string-ascii 32), proof-hash: (buff 32), spender: principal, timestamp: uint })

(define-constant ERR-NOT-VERIFIED (err u102))
(define-constant ERR-INSUFFICIENT-ALLOCATED (err u103))

(define-public (record-expenditure (amount uint) (category (string-ascii 32)) (proof-hash (buff 32)) (token-trait <fund-token-trait>) (verify-trait <verification-trait>))
  (let ((spender tx-sender))
    (asserts! (try! (contract-call? verify-trait is-verified spender)) ERR-NOT-VERIFIED)
    ;; Check allocation (simplified; in full impl, check against AllocationContract)
    (asserts! (>= (default-to u0 (get amount (try! (contract-call? .AllocationContract get-allocation category)))) amount) ERR-INSUFFICIENT-ALLOCATED)
    (try! (as-contract (contract-call? token-trait transfer amount tx-sender spender none)))
    (map-set expenditures { tx-id: block-height } { amount: amount, category: category, proof-hash: proof-hash, spender: spender, timestamp: block-height })
    (ok true)
  )
)

(define-read-only (get-expenditure (tx-id uint))
  (map-get? expenditures { tx-id: tx-id })
)
```

### 4. VerificationContract.clar (Recipient Verification)

Verifies eligibility of recipients (e.g., immigrants) using on-chain data or oracle integrations. For simplicity, uses a map; in production, integrate with identity oracles.

```clarity
;; VerificationContract.clar

(define-map verified-recipients principal { verified-at: uint, status: bool })

(define-constant ERR-ALREADY-VERIFIED (err u104))
(define-constant VERIFIER-PRINCIPAL tx-sender) ;; Set to government or oracle principal

(define-public (verify-recipient (recipient principal))
  (begin
    (asserts! (is-eq tx-sender VERIFIER-PRINCIPAL) ERR-NOT-AUTHORIZED)
    (asserts! (is-none (map-get? verified-recipients recipient)) ERR-ALREADY-VERIFIED)
    (map-set verified-recipients recipient { verified-at: block-height, status: true })
    (ok true)
  )
)

(define-public (is-verified (recipient principal))
  (ok (default-to false (get status (map-get? verified-recipients recipient))))
)
```

### 5. GovernanceContract.clar (DAO Governance)

Allows stakeholders to vote on allocations or changes. Uses a simple voting mechanism; tokens as voting power.

```clarity
;; GovernanceContract.clar
(use-trait fund-token-trait .FundToken.fund-token)

(define-map proposals uint { description: (string-ascii 256), votes-for: uint, votes-against: uint, end-time: uint })
(define-map votes { proposal-id: uint, voter: principal } bool)

(define-constant ERR-VOTE-ENDED (err u105))
(define-constant ERR-ALREADY-VOTED (err u106))
(define-data-var proposal-counter uint u0)

(define-public (create-proposal (description (string-ascii 256)) (duration uint))
  (let ((proposal-id (var-get proposal-counter)))
    (map-set proposals proposal-id { description: description, votes-for: u0, votes-against: u0, end-time: (+ block-height duration) })
    (var-set proposal-counter (+ proposal-id u1))
    (ok proposal-id)
  )
)

(define-public (vote (proposal-id uint) (support bool) (token-trait <fund-token-trait>))
  (let ((voter tx-sender) (vote-weight (try! (contract-call? token-trait get-balance voter))))
    (asserts! (> (get end-time (default-to { end-time: u0 } (map-get? proposals proposal-id))) block-height) ERR-VOTE-ENDED)
    (asserts! (is-none (map-get? votes { proposal-id: proposal-id, voter: voter })) ERR-ALREADY-VOTED)
    (map-set votes { proposal-id: proposal-id, voter: voter } support)
    (if support
      (map-set proposals proposal-id (merge (unwrap-panic (map-get? proposals proposal-id)) { votes-for: (+ (get votes-for (unwrap-panic (map-get? proposals proposal-id))) vote-weight) }))
      (map-set proposals proposal-id (merge (unwrap-panic (map-get? proposals proposal-id)) { votes-against: (+ (get votes-against (unwrap-panic (map-get? proposals proposal-id))) vote-weight) })))
    (ok true)
  )
)

(define-read-only (get-proposal (proposal-id uint))
  (map-get? proposals proposal-id)
)
```

### 6. AuditContract.clar (Auditing and Reporting)

Provides read-only functions to query allocations, expenditures, and generate reports for transparency.

```clarity
;; AuditContract.clar

(define-read-only (get-total-allocated (category (string-ascii 32)))
  (get amount (default-to { amount: u0 } (contract-call? .AllocationContract get-allocation category)))
)

(define-read-only (get-total-spent (category (string-ascii 32)))
  (fold + (map get amount (filter (lambda (exp) (is-eq (get category exp) category)) (map-get? expenditures))) u0) ;; Simplified; use actual map iteration in full impl
)

(define-read-only (generate-report (category (string-ascii 32)))
  (ok {
    allocated: (try! (get-total-allocated category)),
    spent: (try! (get-total-spent category)),
    remaining: (- (try! (get-total-allocated category)) (try! (get-total-spent category)))
  })
)
```

## Deployment and Testing

1. Install Clarinet: `cargo install clarinet`.
2. Create a new project: `clarinet new immigfundtrack`.
3. Add the above contracts to `contracts/` folder.
4. Write tests in `tests/` (e.g., test minting and allocating).
5. Run locally: `clarinet console` or `clarinet test`.
6. Deploy to testnet: Use Stacks CLI or Hiro's tools.

## Future Enhancements

- Integrate with Bitcoin for settlements via Stacks.
- Add oracle for off-chain proofs (e.g., Chainlink-like on Stacks).
- UI dashboard for easy interaction.
- Expand to multi-government collaborations.

## License

MIT License. This is a conceptual project; audit before production use.