-- Migration 073: Add structured type + logo fields to payment_options
-- Replaces the flat generic fields with typed, structured payment method data.

ALTER TABLE public.payment_options
  ADD COLUMN IF NOT EXISTS type     text NOT NULL DEFAULT 'bank_transfer'
                                         CHECK (type IN ('bank_transfer', 'mobile_money', 'online')),
  ADD COLUMN IF NOT EXISTS branch   text,
  ADD COLUMN IF NOT EXISTS country  text,
  ADD COLUMN IF NOT EXISTS network  text,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS logo_url text;
