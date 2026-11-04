-- Ejecutar en Supabase SQL editor tras generar los fixtures.
select prospect_email, status, failure_reason,
  coalesce(proposal_text ~* '(alpura|charly)' or commercial::text ~* '(alpura|charly)', false) as leaks_client_name,
  coalesce(proposal_text like '%—%' or commercial::text like '%—%', false) as em_dash,
  coalesce(proposal_text ~* 'ejemplo de prueba' or commercial::text ~* 'ejemplo de prueba', false) as test_label
from proposals
where prospect_email like 'reg+F%@example.com'
order by 1;
