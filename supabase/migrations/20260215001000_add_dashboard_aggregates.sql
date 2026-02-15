-- RPCs for dashboard aggregates: inventory value and revenue MTD
-- Created: 2026-02-15

-- Compute total inventory value visible to the current user
CREATE OR REPLACE FUNCTION public.get_inventory_value()
RETURNS numeric LANGUAGE plpgsql STABLE AS $$
DECLARE
  has_unit_cost boolean;
  has_qty boolean;
  result numeric := 0;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'unit_cost'
  ) INTO has_unit_cost;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'inventory_items' AND column_name = 'quantity_on_hand'
  ) INTO has_qty;

  IF has_unit_cost AND has_qty THEN
    SELECT COALESCE(SUM(unit_cost * quantity_on_hand), 0) INTO result
    FROM public.inventory_items
    WHERE (created_by = auth.uid() OR public.has_role(auth.uid(), 'employee'));
  ELSE
    result := 0;
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_inventory_value() TO authenticated;

-- Compute revenue month-to-date (income) visible to the current user
CREATE OR REPLACE FUNCTION public.get_revenue_mtd(start_date date, end_date date)
RETURNS numeric LANGUAGE plpgsql STABLE AS $$
DECLARE
  has_amount boolean;
  has_date boolean;
  result numeric := 0;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_records' AND column_name = 'amount'
  ) INTO has_amount;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'financial_records' AND column_name = 'transaction_date'
  ) INTO has_date;

  IF has_amount AND has_date THEN
    SELECT COALESCE(SUM(amount), 0) INTO result
    FROM public.financial_records
    WHERE type = 'income'
      AND transaction_date >= start_date
      AND transaction_date <= end_date
      AND (created_by = auth.uid() OR public.has_role(auth.uid(), 'employee'));
  ELSE
    result := 0;
  END IF;

  RETURN result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_revenue_mtd(date, date) TO authenticated;
