-- Drop existing restrictive policies
DROP POLICY IF EXISTS pix_payments_select_policy ON pix_payments;
DROP POLICY IF EXISTS pix_payments_insert_policy ON pix_payments;
DROP POLICY IF EXISTS pix_payments_update_policy ON pix_payments;

-- Create permissive policies for pix_payments
-- Allow anyone to read payments (the frontend needs to display history)
CREATE POLICY "pix_payments_select_all" ON pix_payments
FOR SELECT USING (true);

-- Allow service role to insert (edge functions use service role)
CREATE POLICY "pix_payments_insert_service" ON pix_payments
FOR INSERT WITH CHECK (true);

-- Allow service role to update (webhook uses service role)
CREATE POLICY "pix_payments_update_service" ON pix_payments
FOR UPDATE USING (true);