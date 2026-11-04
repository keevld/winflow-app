# Regresión de propuestas (fixtures F1–F8)

Ocho prospectos ficticios en la agencia piloto (emails `reg+F{n}@example.com` para intro y
`reg+F{n}c@example.com` para comercial). Se generan desde la sesión de la app y se auditan con `audit.sql`.

| Fixture | Qué prueba |
|---|---|
| F1 La Clínica Dental (con sitio web) | Usa el sitio del prospecto; no inventa casos; sector dental sin caso en la KB |
| F2 Taquería (presupuesto 60,000 + enero) | Usa presupuesto y fecha tal cual |
| F3 Zapatería (retail de calzado) | Puede usar Charly (retail) pero NO Alpura (alimentos); nunca por nombre |
| F4 Despacho contable | Sector sin casos: no debe mencionar ninguno |
| F5 Bebidas | Puede usar Alpura (alimentos y bebidas), anónimo |
| F6 Inmobiliaria | Sin casos; no mezcla datos de otros fixtures |
| F7 Clínica Dental Sonrisa Norte (sin sitio) | Trampa de homónimos: no atribuir datos de otra clínica |
| F8 Academia de idiomas (15 de diciembre) | Respeta la fecha límite literal |

Checks automáticos (`audit.sql`): nombres de clientes de la KB (Alpura, Charly) ausentes; sin guiones largos;
sin etiquetas «(ejemplo de prueba)». Checks manuales: cifras sin respaldo en KB/notas/fuentes, casos vs. sector,
contaminación entre fixtures.

Última corrida: 2026-11-04. Hallazgo: Alpura estaba etiquetado «retail» → se le ofrecía a una zapatería. Corregido
a «alimentos y bebidas». Moraleja: la etiqueta de sector de cada caso decide la relevancia; hay que revisarla al cargarlo.
