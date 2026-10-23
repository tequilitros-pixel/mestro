# POS2 payment provider audit — 2026-09-12

## Finding

This repository does not contain an electronic payment-provider integration.
The POS2 payment methods are the local enum `CASH`, `CARD`, and `TRANSFER`.
For `CARD` and `TRANSFER`, the client accepts a free-text `reference` and the
server stores that value on `Pos2Payment`; there is no provider SDK, payment
intent, charge lookup, refund endpoint, webhook handler, provider id, or
provider idempotency key.

Evidence searched:

- `package.json` and `package-lock.json`: no Stripe, Mercado Pago, Clip,
  Conekta, Openpay, Adyen, PayPal, or equivalent payment SDK.
- `app/api/pos2/**` and `lib/pos2/**`: no provider client, webhook, or refund
  transport. `createRefund` writes a local `Pos2Refund` and, for cash, a
  compensating `CashMovement`.
- `components/pos2/PaymentFlow.tsx`: electronic payment input is only a
  manually supplied external reference.

## Safety decision

An electronic refund cannot be certified or implemented as a real refund in
this checkout. Changing a local status or inserting `Pos2Refund` is not proof
that a card or transfer provider returned money. Electronic refunds therefore
remain a blocked integration capability until the real provider, credentials,
API contract, webhook/reconciliation behavior, and idempotency semantics are
identified and authorized for a disposable PostgreSQL test environment.

Cash refunds are locally supportable: the server locks the sale, validates
the remaining refundable amount, requires an open compensation cash session,
creates an append-only refund allocation and `REFUND_CASH` movement, and does
not mutate the original CashCut or envelope.

## Required next input

Provide the actual provider and its test/sandbox contract. The next phase must
model provider attempts separately from confirmed payments and support
`PROCESSING`, `UNKNOWN`, `PAID`, and `FAILED` transitions through provider
confirmation/reconciliation, never through a local-only state change.
