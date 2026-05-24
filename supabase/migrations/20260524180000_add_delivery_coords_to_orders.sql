-- Add delivery latitude/longitude columns to orders
-- Run this with `supabase db push` or your migration runner against your Supabase project.

ALTER TABLE public.orders
  ADD COLUMN IF NOT EXISTS delivery_lat double precision,
  ADD COLUMN IF NOT EXISTS delivery_lng double precision;
