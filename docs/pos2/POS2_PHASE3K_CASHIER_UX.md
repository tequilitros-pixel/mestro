# POS2 Phase 3K — Cashier UX

## Purpose and boundary

`/pos2` is an isolated cashier surface. It consumes the V2 catalog, pricing, Order, adjustment, Sale, Payment, compensation, CashSession and offline contracts; it does not duplicate their financial rules. POS V1 and all administrative screens remain available and unchanged.

The shell is a fixed, high-layer workspace so the cashier does not interact with administrative navigation during a sale. The header carries only branch/register context, connectivity, terminal authentication and cashier identity. Credentials remain in React memory and are never persisted by this UI.

## Interaction model

- Catalog search is local and matches name, SKU, internal code and barcode. Category changes do not navigate.
- Products without variants add in one tap. Products with variants open a focused selector.
- The cart reads authoritative Order DTOs after every online mutation. Quantity, price, promotions and totals are never computed as final facts in the browser.
- Destructive operations are separated and confirmed: Order void, Sale cancel, refund and CashSession close.
- Discounts and courtesies expose only active V2 rule versions allowed by the actor. Beneficiary and reason inputs appear when the rule requires them. Authorization is a deliberate confirmation recorded against the authenticated session actor; capability enforcement remains server-side and no insecure POS-only PIN exists.
- `BeginPayment` freezes the checkout flow. Cash, card, transfer and an explicit split-payment action are large choices rather than a dropdown.
- Cash tender and applied cash are separate. Exact, $100 and $200 quick tender controls coexist with numeric entry; an allocation cannot exceed the remaining balance, while tender may exceed its cash allocation.
- `CompleteSale` disables repeated taps. Its operation ID is UUIDv7 and is retained across an unknown network outcome, so verification replays the exact same command.
- Success shows the sale number, total, every payment method and prominent cash change. It resets to the catalog in one action and links to an isolated printable receipt.

## Offline and recovery

Offline catalog interaction creates an IndexedDB V2 `Pos2LocalDraft`. The UI labels every local price as an estimate through the draft state and prohibits financial completion offline. Drafts survive refresh, are recovered for the same branch/register and remain visible on conflict.

On reconnect the draft becomes a causal queue: `CreateOrder` followed by one `AddOrderLine` per local line. The existing sync coordinator injects server order/version mappings between commands. After acknowledgement, the UI retrieves the server Order and tells the cashier to review recalculated totals before payment.

Human conflict copy covers price/promotion changes, insufficient inventory, unavailable products, closed cash sessions, revoked/disabled terminals, permissions and order-version conflicts. Stack traces and capability keys are not shown.

## Responsive layouts

- Desktop: flexible catalog and fixed 390 px cart; five-column product grid at 1440 px.
- Tablet: compressed 330 px cart, touch-sized product cards and horizontally scrolling categories.
- Mobile: two-column catalog with a fixed bottom cart/payment action area. Safe bottom padding prevents browser chrome from covering checkout. Terminal credential remains available until connected, then collapses to protect header space.

## Accessibility

The surface uses named regions, navigation labels, dialog semantics, labeled inputs, native buttons/selects, disabled states and live alert banners. Critical controls meet approximately 44 px touch height. Color is accompanied by text for online/offline, success and errors. Keyboard/barcode scanners can type directly into the search input.

## Performance

The server resolves catalog prices in one batch at one timestamp. Local filtering makes one linear pass; rendering starts at 48 products and grows in 48-product pages. The Phase 3K domain test filters a 1,000-product dataset within a 50 ms local budget. No product image is required for interaction.

## Browser evidence

Evidence is stored in `docs/pos2/evidence/phase3k/`:

- `desktop-catalog-1440.png`, `desktop-cart-1440.png`
- `tablet-catalog-768.png`
- `mobile-catalog-390.png`, `mobile-success-390.png`
- `payment-desktop.png`, `payment-mixed.png`
- `offline-draft-mobile.png`, `conflict-price.png`
- `success-mixed.png`, `recent-sales.png`, `sale-detail-actions.png`

Browser automation used a local production build against disposable PostgreSQL DEV data. Interactive `next dev --webpack` QA was blocked by the repository CSP because React Refresh requires `unsafe-eval`; weakening CSP was deliberately rejected. Static DEV rendering was inspected, and all interactive flows were repeated against `next start` from the same successful local build.
