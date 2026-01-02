-- Add unique constraint for monthly_goals upsert
ALTER TABLE public.monthly_goals 
ADD CONSTRAINT monthly_goals_month_year_unique UNIQUE (month, year);