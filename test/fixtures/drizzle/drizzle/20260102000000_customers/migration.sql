CREATE TABLE "customers" ("id" serial PRIMARY KEY NOT NULL, "name" text NOT NULL);
ALTER TABLE "customers" ADD CONSTRAINT "customers_owner_id_fk" FOREIGN KEY ("owner_id") REFERENCES "users"("id");
