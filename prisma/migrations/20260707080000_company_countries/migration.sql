-- Operating countries for a company (ISO2 codes), shown as flags in the
-- companies table and picked with the CountryMultiSelect on create/edit.
ALTER TABLE "Company" ADD COLUMN "countries" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
