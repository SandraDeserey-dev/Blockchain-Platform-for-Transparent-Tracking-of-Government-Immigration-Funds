;; ExpenditureContract.clar
(define-fungible-token fund-token)
(define-map allocations { category: (string-ascii 64) } { amount: uint, allocated-by: principal, timestamp: uint })
(define-map expenditures { tx-id: uint } { amount: uint, category: (string-ascii 64), proof-hash: (buff 32), spender: principal, status: (string-ascii 20), timestamp: uint })
(define-map category-spent { category: (string-ascii 64) } uint)
(define-data-var next-tx-id uint u0)
(define-data-var government-principal principal 'SP000000000000000000002Q6VF78)
(define-data-var verifier-contract (optional principal) none)
(define-data-var max-categories uint u50)
(define-data-var total-allocated uint u0)
(define-data-var total-spent uint u0)

(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INSUFFICIENT-FUNDS u101)
(define-constant ERR-CATEGORY-NOT-FOUND u102)
(define-constant ERR-INSUFFICIENT-ALLOCATION u103)
(define-constant ERR-INVALID-PROOF u104)
(define-constant ERR-ALREADY-SPENT u105)
(define-constant ERR-INVALID-CATEGORY u106)
(define-constant ERR-VERIFIER-NOT-SET u107)
(define-constant ERR-INVALID-AMOUNT u108)
(define-constant ERR-MAX-CATEGORIES u109)
(define-constant ERR-INVALID-STATUS u110)
(define-constant STATUS-PENDING "pending")
(define-constant STATUS-APPROVED "approved")
(define-constant STATUS-REJECTED "rejected")

(define-read-only (get-allocation (category (string-ascii 64)))
  (map-get? allocations { category: category }))

(define-read-only (get-expenditure (tx-id uint))
  (map-get? expenditures { tx-id: tx-id }))

(define-read-only (get-total-allocated))
  (var-get total-allocated)

(define-read-only (get-total-spent))
  (var-get total-spent)

(define-read-only (get-category-spent (category (string-ascii 64)))
  (default-to u0 (map-get? category-spent { category: category })))

(define-read-only (get-next-tx-id))
  (var-get next-tx-id)

(define-read-only (is-valid-category (category (string-ascii 64)))
  (and (> (len category) u0) (<= (len category) u64)))

(define-read-only (is-government (who principal))
  (is-eq who (var-get government-principal)))

(define-read-only (is-verifier-set))
  (is-some (var-get verifier-contract))

(define-private (update-total-allocated (amount uint))
  (var-set total-allocated (+ (var-get total-allocated) amount)))

(define-private (update-total-spent (amount uint))
  (var-set total-spent (+ (var-get total-spent) amount)))

(define-private (update-category-spent (category (string-ascii 64)) (amount uint))
  (map-set category-spent { category: category } (+ (get-category-spent category) amount)))

(define-public (set-verifier-contract (verifier principal))
  (begin
    (asserts! (is-government tx-sender) (err ERR-NOT-AUTHORIZED))
    (var-set verifier-contract (some verifier))
    (ok true)))

(define-public (set-government-principal (new-gov principal))
  (begin
    (asserts! (is-government tx-sender) (err ERR-NOT-AUTHORIZED))
    (var-set government-principal new-gov)
    (ok true)))

(define-public (allocate-funds (category (string-ascii 64)) (amount uint))
  (let ((existing (map-get? allocations { category: category })))
    (asserts! (is-government tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (asserts! (is-valid-category category) (err ERR-INVALID-CATEGORY))
    (asserts! (<= (len (keys allocations)) (var-get max-categories)) (err ERR-MAX-CATEGORIES))
    (match existing
      alloc
      (begin
        (map-set allocations { category: category } { amount: (+ (get amount alloc) amount), allocated-by: tx-sender, timestamp: block-height })
        (update-total-allocated amount)
        (ok true))
      (begin
        (map-set allocations { category: category } { amount: amount, allocated-by: tx-sender, timestamp: block-height })
        (update-total-allocated amount)
        (ok true)))))

(define-public (record-expenditure (category (string-ascii 64)) (amount uint) (proof-hash (buff 32)))
  (let ((tx-id (var-get next-tx-id))
        (allocation (unwrap! (map-get? allocations { category: category }) (err ERR-CATEGORY-NOT-FOUND)))
        (spent (get-category-spent category)))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (asserts! (is-valid-category category) (err ERR-INVALID-CATEGORY))
    (asserts! (>= (get amount allocation) (+ spent amount)) (err ERR-INSUFFICIENT-ALLOCATION))
    (asserts! (is-some (var-get verifier-contract)) (err ERR-VERIFIER-NOT-SET))
    (map-set expenditures { tx-id: tx-id } { amount: amount, category: category, proof-hash: proof-hash, spender: tx-sender, status: STATUS-PENDING, timestamp: block-height })
    (var-set next-tx-id (+ tx-id u1))
    (ok tx-id)))

(define-public (approve-expenditure (tx-id uint))
  (let ((exp (unwrap! (map-get? expenditures { tx-id: tx-id }) (err ERR-CATEGORY-NOT-FOUND)))
        (verifier (unwrap! (var-get verifier-contract) (err ERR-VERIFIER-NOT-SET))))
    (asserts! (is-eq tx-sender verifier) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-eq (get status exp) STATUS-PENDING) (err ERR-ALREADY-SPENT))
    (map-set expenditures { tx-id: tx-id } (merge exp { status: STATUS-APPROVED }))
    (update-category-spent (get category exp) (get amount exp))
    (update-total-spent (get amount exp))
    (ok true)))

(define-public (reject-expenditure (tx-id uint))
  (let ((exp (unwrap! (map-get? expenditures { tx-id: tx-id }) (err ERR-CATEGORY-NOT-FOUND)))
        (verifier (unwrap! (var-get verifier-contract) (err ERR-VERIFIER-NOT-SET))))
    (asserts! (is-eq tx-sender verifier) (err ERR-NOT-AUTHORIZED))
    (asserts! (is-eq (get status exp) STATUS-PENDING) (err ERR-ALREADY-SPENT))
    (map-set expenditures { tx-id: tx-id } (merge exp { status: STATUS-REJECTED }))
    (ok true)))

(define-public (mint-funds (amount uint) (recipient principal))
  (begin
    (asserts! (is-government tx-sender) (err ERR-NOT-AUTHORIZED))
    (asserts! (> amount u0) (err ERR-INVALID-AMOUNT))
    (ft-mint? fund-token amount recipient)))

(define-public (transfer-funds (amount uint) (recipient principal))
  (ft-transfer? fund-token amount tx-sender recipient))

(define-read-only (get-balance (who principal))
  (ft-get-balance fund-token who))

(define-read-only (get-supply))
  (ft-get-supply fund-token)