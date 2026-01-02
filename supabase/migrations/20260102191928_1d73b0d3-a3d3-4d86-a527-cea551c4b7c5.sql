-- Create table for PIX payments
CREATE TABLE public.pix_payments (
  id SERIAL PRIMARY KEY,
  admin_id INTEGER NOT NULL REFERENCES public.admins(id) ON DELETE CASCADE,
  admin_name TEXT NOT NULL,
  transaction_id TEXT UNIQUE NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  credits INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  paid_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE public.pix_payments ENABLE ROW LEVEL SECURITY;

-- Policies for pix_payments
CREATE POLICY "Users can view their own payments" 
ON public.pix_payments 
FOR SELECT 
USING (true);

CREATE POLICY "Allow insert payments" 
ON public.pix_payments 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Allow update payments" 
ON public.pix_payments 
FOR UPDATE 
USING (true);

-- Add index for faster lookups
CREATE INDEX idx_pix_payments_transaction_id ON public.pix_payments(transaction_id);
CREATE INDEX idx_pix_payments_admin_id ON public.pix_payments(admin_id);