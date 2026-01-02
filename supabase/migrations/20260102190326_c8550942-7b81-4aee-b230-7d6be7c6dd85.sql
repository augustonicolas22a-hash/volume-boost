
-- Create enum for user roles
CREATE TYPE public.app_role AS ENUM ('dono', 'master', 'revendedor');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  name TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role)
);

-- Create credits table for tracking balances
CREATE TABLE public.credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  balance INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create credit_transactions table
CREATE TABLE public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_id UUID REFERENCES auth.users(id),
  to_user_id UUID REFERENCES auth.users(id) NOT NULL,
  amount INTEGER NOT NULL,
  unit_price DECIMAL(10,2),
  total_price DECIMAL(10,2),
  transaction_type TEXT NOT NULL, -- 'recharge', 'transfer'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create resellers relationship table (master -> revendedor)
CREATE TABLE public.reseller_relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  master_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reseller_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (master_id, reseller_id)
);

-- Enable RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reseller_relationships ENABLE ROW LEVEL SECURITY;

-- Security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Function to get user role
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id UUID)
RETURNS app_role
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role
  FROM public.user_roles
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Dono can view all profiles" ON public.profiles
  FOR SELECT USING (public.has_role(auth.uid(), 'dono'));

CREATE POLICY "Master can view their resellers profiles" ON public.profiles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'master') AND
    id IN (SELECT reseller_id FROM public.reseller_relationships WHERE master_id = auth.uid())
  );

-- RLS Policies for user_roles
CREATE POLICY "Users can view own role" ON public.user_roles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Dono can manage all roles" ON public.user_roles
  FOR ALL USING (public.has_role(auth.uid(), 'dono'));

CREATE POLICY "Master can view their resellers roles" ON public.user_roles
  FOR SELECT USING (
    public.has_role(auth.uid(), 'master') AND
    user_id IN (SELECT reseller_id FROM public.reseller_relationships WHERE master_id = auth.uid())
  );

-- RLS Policies for credits
CREATE POLICY "Users can view own credits" ON public.credits
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update own credits" ON public.credits
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Dono can view all credits" ON public.credits
  FOR SELECT USING (public.has_role(auth.uid(), 'dono'));

CREATE POLICY "Master can view their resellers credits" ON public.credits
  FOR SELECT USING (
    public.has_role(auth.uid(), 'master') AND
    user_id IN (SELECT reseller_id FROM public.reseller_relationships WHERE master_id = auth.uid())
  );

CREATE POLICY "Insert credits for new users" ON public.credits
  FOR INSERT WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'dono') OR public.has_role(auth.uid(), 'master'));

-- RLS Policies for credit_transactions
CREATE POLICY "Users can view own transactions" ON public.credit_transactions
  FOR SELECT USING (auth.uid() = from_user_id OR auth.uid() = to_user_id);

CREATE POLICY "Dono can view all transactions" ON public.credit_transactions
  FOR SELECT USING (public.has_role(auth.uid(), 'dono'));

CREATE POLICY "Users can insert transactions" ON public.credit_transactions
  FOR INSERT WITH CHECK (auth.uid() = from_user_id OR (public.has_role(auth.uid(), 'master') AND from_user_id IS NULL));

-- RLS Policies for reseller_relationships
CREATE POLICY "Master can view own resellers" ON public.reseller_relationships
  FOR SELECT USING (auth.uid() = master_id);

CREATE POLICY "Master can manage own resellers" ON public.reseller_relationships
  FOR ALL USING (auth.uid() = master_id);

CREATE POLICY "Dono can view all relationships" ON public.reseller_relationships
  FOR SELECT USING (public.has_role(auth.uid(), 'dono'));

CREATE POLICY "Reseller can view own relationship" ON public.reseller_relationships
  FOR SELECT USING (auth.uid() = reseller_id);

-- Trigger for new user profile
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data ->> 'name');
  
  INSERT INTO public.credits (user_id, balance)
  VALUES (NEW.id, 0);
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to transfer credits
CREATE OR REPLACE FUNCTION public.transfer_credits(
  _from_user_id UUID,
  _to_user_id UUID,
  _amount INTEGER
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _from_balance INTEGER;
BEGIN
  SELECT balance INTO _from_balance FROM public.credits WHERE user_id = _from_user_id FOR UPDATE;
  
  IF _from_balance < _amount THEN
    RETURN FALSE;
  END IF;
  
  UPDATE public.credits SET balance = balance - _amount, updated_at = NOW() WHERE user_id = _from_user_id;
  UPDATE public.credits SET balance = balance + _amount, updated_at = NOW() WHERE user_id = _to_user_id;
  
  INSERT INTO public.credit_transactions (from_user_id, to_user_id, amount, transaction_type)
  VALUES (_from_user_id, _to_user_id, _amount, 'transfer');
  
  RETURN TRUE;
END;
$$;

-- Function to recharge credits (for master)
CREATE OR REPLACE FUNCTION public.recharge_credits(
  _user_id UUID,
  _amount INTEGER,
  _unit_price DECIMAL,
  _total_price DECIMAL
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.credits SET balance = balance + _amount, updated_at = NOW() WHERE user_id = _user_id;
  
  INSERT INTO public.credit_transactions (to_user_id, amount, unit_price, total_price, transaction_type)
  VALUES (_user_id, _amount, _unit_price, _total_price, 'recharge');
  
  RETURN TRUE;
END;
$$;
