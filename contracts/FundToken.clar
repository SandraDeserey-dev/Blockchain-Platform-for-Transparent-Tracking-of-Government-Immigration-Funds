;; FundToken.clar

(define-fungible-token fund-token u1000000000000)

(define-constant ERR-NOT-AUTHORIZED (err u100))
(define-constant ERR-INVALID-MAX-SUPPLY (err u101))
(define-constant ERR-INVALID-MINT-AMOUNT (err u102))
(define-constant ERR-INVALID-BURN-AMOUNT (err u103))
(define-constant ERR-INVALID-TRANSFER-AMOUNT (err u104))
(define-constant ERR-INVALID-PAUSE-STATE (err u105))
(define-constant ERR-MINTER-ALREADY-EXISTS (err u106))
(define-constant ERR-MINTER-NOT-FOUND (err u107))
(define-constant ERR-INVALID-TIMESTAMP (err u108))
(define-constant ERR-AUTHORITY-NOT-VERIFIED (err u109))
(define-constant ERR-INVALID-MIN-MINT (err u110))
(define-constant ERR-INVALID-MAX-MINT (err u111))
(define-constant ERR-MINTER-UPDATE-NOT-ALLOWED (err u112))
(define-constant ERR-INVALID-UPDATE-PARAM (err u113))
(define-constant ERR-MAX-MINTERS-EXCEEDED (err u114))
(define-constant ERR-INVALID-MINTER-TYPE (err u115))
(define-constant ERR-INVALID-INTEREST-RATE (err u116))
(define-constant ERR-INVALID-GRACE-PERIOD (err u117))
(define-constant ERR-INVALID-LOCATION (err u118))
(define-constant ERR-INVALID-CURRENCY (err u119))
(define-constant ERR-INVALID-STATUS (err u120))
(define-constant ERR-ALREADY-PAUSED (err u121))
(define-constant ERR-NOT-PAUSED (err u122))
(define-constant ERR-BLACKLISTED (err u123))
(define-constant ERR-INVALID-BLACKLIST-STATUS (err u124))
(define-constant ERR-MINT-CAP-EXCEEDED (err u125))
(define-constant ERR-INVALID-CAP-AMOUNT (err u126))
(define-constant ERR-CAP-ALREADY-SET (err u127))
(define-constant ERR-INVALID-DECIMALS (err u128))
(define-constant ERR-INVALID-URI (err u129))
(define-constant ERR-INVALID-METADATA (err u130))

(define-data-var next-minter-id uint u0)
(define-data-var max-minters uint u100)
(define-data-var mint-fee uint u1000)
(define-data-var authority-contract (optional principal) none)
(define-data-var contract-paused bool false)
(define-data-var token-uri (string-utf8 256) u"")
(define-data-var token-decimals uint u6)
(define-data-var total-minted uint u0)
(define-data-var mint-cap uint u1000000000000)
(define-data-var burn-enabled bool true)
(define-data-var transfer-enabled bool true)

(define-map minters
  uint
  {
    name: (string-utf8 100),
    max-mint: uint,
    mint-amount: uint,
    start-time: uint,
    penalty-rate: uint,
    threshold: uint,
    timestamp: uint,
    creator: principal,
    minter-type: (string-utf8 50),
    interest-rate: uint,
    grace-period: uint,
    location: (string-utf8 100),
    currency: (string-utf8 20),
    status: bool,
    min-mint: uint,
    max-loan: uint
  }
)

(define-map minters-by-name
  (string-utf8 100)
  uint)

(define-map minter-updates
  uint
  {
    update-name: (string-utf8 100),
    update-max-mint: uint,
    update-mint-amount: uint,
    update-timestamp: uint,
    updater: principal
  }
)

(define-map blacklist principal bool)

(define-map mint-caps principal uint)

(define-read-only (get-minter (id uint))
  (map-get? minters id)
)

(define-read-only (get-minter-updates (id uint))
  (map-get? minter-updates id)
)

(define-read-only (is-minter-registered (name (string-utf8 100)))
  (is-some (map-get? minters-by-name name))
)

(define-read-only (get-balance (account principal))
  (ft-get-balance fund-token account)
)

(define-read-only (get-total-supply)
  (ft-get-supply fund-token)
)

(define-read-only (get-token-uri)
  (ok (var-get token-uri))
)

(define-read-only (get-decimals)
  (ok (var-get token-decimals))
)

(define-read-only (is-paused)
  (var-get contract-paused)
)

(define-read-only (is-blacklisted (account principal))
  (default-to false (map-get? blacklist account))
)

(define-read-only (get-mint-cap (minter principal))
  (default-to u0 (map-get? mint-caps minter))
)

(define-private (validate-name (name (string-utf8 100)))
  (if (and (> (len name) u0) (<= (len name) u100))
      (ok true)
      (err ERR-INVALID-UPDATE-PARAM))
)

(define-private (validate-max-mint (mint uint))
  (if (and (> mint u0) (<= mint u1000000000))
      (ok true)
      (err ERR-INVALID-MAX-MINT))
)

(define-private (validate-mint-amount (amount uint))
  (if (> amount u0)
      (ok true)
      (err ERR-INVALID-MINT-AMOUNT))
)

(define-private (validate-start-time (time uint))
  (if (> time u0)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-penalty-rate (rate uint))
  (if (<= rate u100)
      (ok true)
      (err ERR-INVALID-PENALTY-RATE))
)

(define-private (validate-threshold (threshold uint))
  (if (and (> threshold u0) (<= threshold u100))
      (ok true)
      (err ERR-INVALID-VOTING-THRESHOLD))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-minter-type (type (string-utf8 50)))
  (if (or (is-eq type u"government") (is-eq type u"ngo") (is-eq type u"community"))
      (ok true)
      (err ERR-INVALID-MINTER-TYPE))
)

(define-private (validate-interest-rate (rate uint))
  (if (<= rate u20)
      (ok true)
      (err ERR-INVALID-INTEREST-RATE))
)

(define-private (validate-grace-period (period uint))
  (if (<= period u30)
      (ok true)
      (err ERR-INVALID-GRACE-PERIOD))
)

(define-private (validate-location (loc (string-utf8 100)))
  (if (and (> (len loc) u0) (<= (len loc) u100))
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-currency (cur (string-utf8 20)))
  (if (or (is-eq cur u"STX") (is-eq cur u"USD") (is-eq cur u"BTC"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
)

(define-private (validate-min-mint (min uint))
  (if (> min u0)
      (ok true)
      (err ERR-INVALID-MIN-MINT))
)

(define-private (validate-max-loan (max uint))
  (if (> max u0)
      (ok true)
      (err ERR-INVALID-MAX_LOAN))
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-private (validate-amount (amount uint))
  (if (> amount u0)
      (ok true)
      (err ERR-INVALID-TRANSFER-AMOUNT))
)

(define-private (validate-uri (uri (string-utf8 256)))
  (if (<= (len uri) u256)
      (ok true)
      (err ERR-INVALID-URI))
)

(define-private (validate-decimals (dec uint))
  (if (<= dec u18)
      (ok true)
      (err ERR-INVALID-DECIMALS))
)

(define-private (validate-cap-amount (cap uint))
  (if (> cap u0)
      (ok true)
      (err ERR-INVALID-CAP-AMOUNT))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-minters (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-MAX-MINTERS))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set max-minters new-max)
    (ok true)
  )
)

(define-public (set-mint-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set mint-fee new-fee)
    (ok true)
  )
)

(define-public (set-token-uri (new-uri (string-utf8 256)))
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (try! (validate-uri new-uri))
    (var-set token-uri new-uri)
    (ok true)
  )
)

(define-public (set-token-decimals (new-decimals uint))
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (try! (validate-decimals new-decimals))
    (var-set token-decimals new-decimals)
    (ok true)
  )
)

(define-public (pause-contract)
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (asserts! (not (var-get contract-paused)) (err ERR-ALREADY-PAUSED))
    (var-set contract-paused true)
    (ok true)
  )
)

(define-public (unpause-contract)
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (asserts! (var-get contract-paused) (err ERR-NOT-PAUSED))
    (var-set contract-paused false)
    (ok true)
  )
)

(define-public (add-to-blacklist (account principal))
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (map-set blacklist account true)
    (ok true)
  )
)

(define-public (remove-from-blacklist (account principal))
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (map-delete blacklist account)
    (ok true)
  )
)

(define-public (set-mint-cap (minter principal) (cap uint))
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (try! (validate-cap-amount cap))
    (asserts! (is-none (map-get? mint-caps minter)) (err ERR-CAP-ALREADY-SET))
    (map-set mint-caps minter cap)
    (ok true)
  )
)

(define-public (create-minter
  (minter-name (string-utf8 100))
  (max-mint uint)
  (mint-amount uint)
  (start-time uint)
  (penalty-rate uint)
  (threshold uint)
  (minter-type (string-utf8 50))
  (interest-rate uint)
  (grace-period uint)
  (location (string-utf8 100))
  (currency (string-utf8 20))
  (min-mint uint)
  (max-loan uint)
)
  (let (
        (next-id (var-get next-minter-id))
        (current-max (var-get max-minters))
        (authority (var-get authority-contract))
      )
    (asserts! (< next-id current-max) (err ERR-MAX-MINTERS-EXCEEDED))
    (try! (validate-name minter-name))
    (try! (validate-max-mint max-mint))
    (try! (validate-mint-amount mint-amount))
    (try! (validate-start-time start-time))
    (try! (validate-penalty-rate penalty-rate))
    (try! (validate-threshold threshold))
    (try! (validate-minter-type minter-type))
    (try! (validate-interest-rate interest-rate))
    (try! (validate-grace-period grace-period))
    (try! (validate-location location))
    (try! (validate-currency currency))
    (try! (validate-min-mint min-mint))
    (try! (validate-max-loan max-loan))
    (asserts! (is-none (map-get? minters-by-name minter-name)) (err ERR-MINTER-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-VERIFIED))))
      (try! (stx-transfer? (var-get mint-fee) tx-sender authority-recipient))
    )
    (map-set minters next-id
      {
        name: minter-name,
        max-mint: max-mint,
        mint-amount: mint-amount,
        start-time: start-time,
        penalty-rate: penalty-rate,
        threshold: threshold,
        timestamp: block-height,
        creator: tx-sender,
        minter-type: minter-type,
        interest-rate: interest-rate,
        grace-period: grace-period,
        location: location,
        currency: currency,
        status: true,
        min-mint: min-mint,
        max-loan: max-loan
      }
    )
    (map-set minters-by-name minter-name next-id)
    (var-set next-minter-id (+ next-id u1))
    (print { event: "minter-created", id: next-id })
    (ok next-id)
  )
)

(define-public (update-minter
  (minter-id uint)
  (update-name (string-utf8 100))
  (update-max-mint uint)
  (update-mint-amount uint)
)
  (let ((minter (map-get? minters minter-id)))
    (match minter
      m
        (begin
          (asserts! (is-eq (get creator m) tx-sender) (err ERR-NOT-AUTHORIZED))
          (try! (validate-name update-name))
          (try! (validate-max-mint update-max-mint))
          (try! (validate-mint-amount update-mint-amount))
          (let ((existing (map-get? minters-by-name update-name)))
            (match existing
              existing-id
                (asserts! (is-eq existing-id minter-id) (err ERR-MINTER-ALREADY-EXISTS))
              (begin true)
            )
          )
          (let ((old-name (get name m)))
            (if (is-eq old-name update-name)
                (ok true)
                (begin
                  (map-delete minters-by-name old-name)
                  (map-set minters-by-name update-name minter-id)
                  (ok true)
                )
            )
          )
          (map-set minters minter-id
            {
              name: update-name,
              max-mint: update-max-mint,
              mint-amount: update-mint-amount,
              start-time: (get start-time m),
              penalty-rate: (get penalty-rate m),
              threshold: (get threshold m),
              timestamp: block-height,
              creator: (get creator m),
              minter-type: (get minter-type m),
              interest-rate: (get interest-rate m),
              grace-period: (get grace-period m),
              location: (get location m),
              currency: (get currency m),
              status: (get status m),
              min-mint: (get min-mint m),
              max-loan: (get max-loan m)
            }
          )
          (map-set minter-updates minter-id
            {
              update-name: update-name,
              update-max-mint: update-max-mint,
              update-mint-amount: update-mint-amount,
              update-timestamp: block-height,
              updater: tx-sender
            }
          )
          (print { event: "minter-updated", id: minter-id })
          (ok true)
        )
      (err ERR-MINTER-NOT-FOUND)
    )
  )
)

(define-public (mint (amount uint) (recipient principal))
  (begin
    (asserts! (not (var-get contract-paused)) (err ERR-INVALID-PAUSE-STATE))
    (asserts! (not (is-blacklisted tx-sender)) (err ERR-BLACKLISTED))
    (asserts! (not (is-blacklisted recipient)) (err ERR-BLACKLISTED))
    (try! (validate-mint-amount amount))
    (let ((cap (get-mint-cap tx-sender)))
      (if (> cap u0)
          (asserts! (<= amount cap) (err ERR-MINT-CAP-EXCEEDED))
          true
      )
    )
    (try! (ft-mint? fund-token amount recipient))
    (var-set total-minted (+ (var-get total-minted) amount))
    (print { event: "mint", amount: amount, recipient: recipient })
    (ok true)
  )
)

(define-public (burn (amount uint) (sender principal))
  (begin
    (asserts! (not (var-get contract-paused)) (err ERR-INVALID-PAUSE-STATE))
    (asserts! (var-get burn-enabled) (err ERR-INVALID-STATUS))
    (asserts! (not (is-blacklisted sender)) (err ERR-BLACKLISTED))
    (try! (validate-amount amount))
    (try! (ft-burn? fund-token amount sender))
    (print { event: "burn", amount: amount, sender: sender })
    (ok true)
  )
)

(define-public (transfer (amount uint) (sender principal) (recipient principal) (memo (optional (buff 34))))
  (begin
    (asserts! (not (var-get contract-paused)) (err ERR-INVALID-PAUSE-STATE))
    (asserts! (var-get transfer-enabled) (err ERR-INVALID-STATUS))
    (asserts! (not (is-blacklisted sender)) (err ERR-BLACKLISTED))
    (asserts! (not (is-blacklisted recipient)) (err ERR-BLACKLISTED))
    (try! (validate-amount amount))
    (try! (ft-transfer? fund-token amount sender recipient))
    (print { event: "transfer", amount: amount, sender: sender, recipient: recipient })
    (ok true)
  )
)

(define-public (get-minter-count)
  (ok (var-get next-minter-id))
)

(define-public (check-minter-existence (name (string-utf8 100)))
  (ok (is-minter-registered name))
)

(define-public (enable-burn)
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set burn-enabled true)
    (ok true)
  )
)

(define-public (disable-burn)
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set burn-enabled false)
    (ok true)
  )
)

(define-public (enable-transfer)
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set transfer-enabled true)
    (ok true)
  )
)

(define-public (disable-transfer)
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (var-set transfer-enabled false)
    (ok true)
  )
)

(define-public (set-global-mint-cap (new-cap uint))
  (begin
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-VERIFIED))
    (try! (validate-cap-amount new-cap))
    (var-set mint-cap new-cap)
    (ok true)
  )
)

(define-read-only (get-global-mint-cap)
  (ok (var-get mint-cap))
)

(define-read-only (get-total-minted)
  (ok (var-get total-minted))
)