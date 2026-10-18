# Revisión de cuota y pausa de automatización · 18 de octubre de 2026

## Instrucción y alcance

El propietario comunica un aviso del 100 % de cuota y ordena no generar más gasto. Esta intervención opera únicamente sobre `joinsnipe/PDF`: consultas de lectura y modificación de workflows/documentación. No se ejecutan compilaciones, tests en runners, limpiezas mediante Actions, consultas de IA ni publicaciones. No se cambia la aplicación o su versión, otros repositorios ni presupuestos globales.

## Lo comprobado

- La API de ejecuciones devuelve 15 runs, todos completados. No hay trabajos activos ni ejecuciones posteriores al 16 de octubre. El último es [38949754884](https://github.com/joinsnipe/PDF/actions/runs/38949754884), de beta 8.
- Se consulta el inventario de artefactos de cada uno de esos 15 runs: **0 artefactos presentes**. No hay nuevos ZIP temporales de PDF que borrar.
- Se relee el log del [trabajo de limpieza 117107376313](https://github.com/joinsnipe/PDF/actions/runs/38940727756/job/117107376313), completado el 16 de octubre: confirma la eliminación de **10 artefactos, 1.941.340.802 bytes**, y **9 cachés npm, 1.785.988.024 bytes**. Total temporal retirado: 3.727.328.826 bytes.
- Los workflows posteriores publicaban directamente en Releases y no subían artefactos ni generaban cachés npm. La cuota de cachés es distinta de la compartida por artefactos y Packages; no se atribuye toda la suma anterior a la cuota de 500 MB.
- Las versiones públicas y sus descargas se conservan.

## Cambio preventivo

Se retiran los disparadores `push` y `pull_request` de los dos workflows. Solo se conserva `workflow_dispatch` como referencia, con `if: ${{ false }}` en todos los jobs, incluyendo build, release y cleanup. La condición impide asignar un runner a esas definiciones aunque se pulsen manualmente. El commit de pausa utiliza `[skip ci]` como protección adicional.

No reactivar los workflows ni reejecutar versiones históricas sin autorización explícita. Esta pausa en los archivos no equivale a desactivar Actions desde la administración del repositorio ni bloquea reejecuciones históricas.

## Por qué el aviso puede continuar

GitHub distingue el almacenamiento presente del acumulado durante el ciclo. El borrado elimina el almacenamiento actual y deja de sumar su permanencia futura, pero no descuenta el tiempo ya acumulado. Un aviso de cuota agotada no acredita por sí solo que ya haya un cargo.

No se ha accedido al desglose de facturación que originó el aviso. Por ello no se atribuye su causa exacta a PDF, a otro repositorio ni a un producto concreto.

## Límite de esta comprobación y paso del propietario

El conector disponible permite consultar runs y sus artefactos, pero no el inventario global de cachés, las opciones de administración de Actions ni Billing/Budgets. La limpieza histórica de cachés está acreditada en el log; su inventario actual no se ha reconsultado. No se ha verificado ni cambiado el método de pago, el presupuesto, los cargos o el periodo de reinicio.

El propietario debe abrir https://github.com/settings/billing → Budgets and alerts y comprobar el presupuesto del producto **Actions**. Para bloquear consumo adicional facturable, establecer **0 USD** y activar **Stop usage when budget limit is reached**, guardando el cambio. Un presupuesto de cuenta afecta a Actions de todos sus repositorios; un presupuesto de repositorio solo a PDF. Los cargos ya devengados no se anulan por crear un presupuesto.

Si GitHub exige añadir un método de pago para editar el presupuesto, no añadirlo con el propósito de desbloquear uso. La documentación indica que, sin un método de pago válido, se bloquea el uso al agotar la cuota. Verificar el estado concreto en Billing antes de concluir que no puede haber cargos.

Referencias oficiales consultadas el 18-10-2026:

- https://docs.github.com/en/billing/concepts/product-billing/github-actions
- https://docs.github.com/en/billing/concepts/budgets-and-alerts
- https://docs.github.com/en/billing/how-tos/set-up-budgets

## Comprobación del cambio sin consumo de Actions

Revisar las definiciones y verificar, después del commit, que el listado de ejecuciones no incorpora un run provocado por esta modificación. No lanzar un workflow para probar que está pausado.
