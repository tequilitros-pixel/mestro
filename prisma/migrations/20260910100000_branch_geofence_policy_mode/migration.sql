CREATE TYPE "BranchGeofenceMode" AS ENUM ('OFF', 'WARN', 'BLOCK');

ALTER TABLE "Branch" ADD COLUMN "geofenceMode" "BranchGeofenceMode";
