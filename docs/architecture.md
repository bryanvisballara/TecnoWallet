# Arquitectura de TecnoWallet

## Principios

1. El ledger es la fuente de verdad financiera. Las correcciones se registran como reversos; nunca se reescribe una transacción contabilizada.
2. Todo importe se guarda como entero en unidades menores junto con su moneda ISO 4217.
3. Cada consulta y mutación se limita a un espacio de trabajo autorizado en el servidor.
4. Los clientes pueden operar sin conexión. Cada mutación tiene UUID, versión base y clave de idempotencia.
5. IA, OCR, bancos, archivos y notificaciones son adaptadores externos; el dominio no depende de proveedores.

## Límites

- `presentation`: controladores HTTP, DTOs y serialización.
- `application`: casos de uso, autorización y transacciones de aplicación.
- `domain`: reglas financieras y entidades sin dependencias de infraestructura.
- `infrastructure`: MongoDB, colas y adaptadores externos.

## Sincronización

El dispositivo registra primero la mutación en almacenamiento local, actualiza la interfaz de forma optimista y la envía por lotes. La API deduplica por UUID, compara la versión base y devuelve cambios posteriores al cursor. Un conflicto conserva ambas versiones para resolución explícita; las eliminaciones viajan como tombstones.

## Privacidad compartida

Los recursos compartidos pertenecen al espacio. Una transacción privada conserva el `ownerUserId`; otros miembros solo reciben agregados autorizados y nunca la descripción, adjuntos, comercio, ubicación o notas.

## Escalado

Las colecciones se indexan por `workspaceId` y cursor temporal. Los agregados de dashboard se pueden materializar y reconstruir desde el ledger. OCR, IA, exportaciones, webhooks y sincronizaciones bancarias se procesan asíncronamente. El diseño permite separar workers y API sin cambiar contratos.
