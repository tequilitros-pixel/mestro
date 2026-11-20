-- Cortes vinculados a eventos mantienen consumo separado del inventario de sucursal.
-- Los cortes históricos conservan el comportamiento previo (false).
ALTER TABLE "CashCut"
ADD COLUMN "eventStockIsolated" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "EventSaleConsumption" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "saleId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "quantity" DECIMAL(18,6) NOT NULL,
  "unit" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reversedAt" TIMESTAMP(3),
  CONSTRAINT "EventSaleConsumption_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EventSaleConsumption_saleId_productId_key"
ON "EventSaleConsumption"("saleId","productId");
CREATE INDEX "EventSaleConsumption_eventId_productId_idx"
ON "EventSaleConsumption"("eventId","productId");

ALTER TABLE "EventSaleConsumption" ADD CONSTRAINT "EventSaleConsumption_eventId_fkey"
FOREIGN KEY ("eventId") REFERENCES "ServiceEvent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventSaleConsumption" ADD CONSTRAINT "EventSaleConsumption_saleId_fkey"
FOREIGN KEY ("saleId") REFERENCES "PosSale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "EventSaleConsumption" ADD CONSTRAINT "EventSaleConsumption_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "InventoryProduct"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
