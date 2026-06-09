
-- Add customer type (company vs individual) and person/address fields
DO $$ BEGIN
  CREATE TYPE public.customer_kind AS ENUM ('company', 'individual');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.customers
  ADD COLUMN IF NOT EXISTS customer_type public.customer_kind NOT NULL DEFAULT 'company',
  ADD COLUMN IF NOT EXISTS first_name text,
  ADD COLUMN IF NOT EXISTS last_name text,
  ADD COLUMN IF NOT EXISTS vat_number text,
  ADD COLUMN IF NOT EXISTS address text;

-- Company name no longer required at the database level (particulieren have none)
ALTER TABLE public.customers ALTER COLUMN company DROP NOT NULL;

-- Validation: company customers need a company name; individuals need first+last
ALTER TABLE public.customers DROP CONSTRAINT IF EXISTS customers_type_fields_chk;
ALTER TABLE public.customers
  ADD CONSTRAINT customers_type_fields_chk CHECK (
    (customer_type = 'company' AND company IS NOT NULL AND length(btrim(company)) > 0)
    OR
    (customer_type = 'individual'
     AND first_name IS NOT NULL AND length(btrim(first_name)) > 0
     AND last_name IS NOT NULL AND length(btrim(last_name)) > 0)
  );
